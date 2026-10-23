import { NextRequest, NextResponse } from "next/server";
import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  authorizeEntry,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import bcrypt from "bcrypt";
import { decryptText, rateLimit, Security } from "@/firewall";
import { supabaseServer } from "@/lib";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bridgeConfig = walletNetworks.stellar.bridge;
const bridgeToken = walletNetworks.stellar.tokens.USDT0;
const NETWORKS = bridgeConfig.networks;
type Destination = keyof typeof NETWORKS;
const rpcServer = new rpc.Server(process.env.STELLAR_RPC_URL || bridgeConfig.rpcUrl);
const horizonServer = new Horizon.Server(process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org");
const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.PUBLIC;
const tokenContract = new Contract(bridgeToken.sacContract);
const oftContract = new Contract(bridgeToken.oftContract);

async function stellarWalletHasUsdt0Trustline(address: string) {
  const account = await horizonServer.loadAccount(address);
  return account.balances.some((balance) =>
    (balance.asset_type === "credit_alphanum4" || balance.asset_type === "credit_alphanum12") &&
    balance.asset_code === bridgeToken.classicAsset.code &&
    balance.asset_issuer === bridgeToken.classicAsset.issuer,
  );
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function isDestination(value: unknown): value is Destination {
  return typeof value === "string" && Object.hasOwn(NETWORKS, value);
}

function parseAmount(value: unknown): bigint {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,7})?$/.test(value.trim())) {
    throw new Error("Enter a valid USDT0 amount with up to 7 decimal places.");
  }
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = BigInt(whole) * BigInt(10_000_000) + BigInt(fraction.padEnd(7, "0"));
  if (amount <= BigInt(0)) throw new Error("Enter an amount greater than zero.");
  return amount;
}

function decimal(value: bigint): string {
  const whole = value / BigInt(10_000_000);
  const fraction = (value % BigInt(10_000_000)).toString().padStart(7, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function nativeDecimal(value: bigint): string {
  const whole = value / BigInt(10_000_000);
  const fraction = (value % BigInt(10_000_000)).toString().padStart(7, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new Error("The Stellar contract returned an invalid response.");
}

function sendParam(destination: Destination, recipient: string, amount: bigint) {
  const recipientBytes = Buffer.from(recipient.slice(2).padStart(64, "0"), "hex");
  const dust = amount % BigInt(10); // Stellar has 7 decimals; the shared OFT precision is 6.
  return nativeToScVal({
    dst_eid: NETWORKS[destination].eid,
    to: recipientBytes,
    amount_ld: amount,
    min_amount_ld: amount - dust,
    extra_options: Buffer.alloc(0),
    compose_msg: Buffer.alloc(0),
    oft_cmd: Buffer.alloc(0),
  }, { type: {
    dst_eid: ["symbol", "u32"],
    to: ["symbol", "bytes"],
    amount_ld: ["symbol", "i128"],
    min_amount_ld: ["symbol", "i128"],
    extra_options: ["symbol", "bytes"],
    compose_msg: ["symbol", "bytes"],
    oft_cmd: ["symbol", "bytes"],
  } });
}

async function simulateCall(address: string, method: string, args: ReturnType<typeof nativeToScVal>[]) {
  const source = await rpcServer.getAccount(address);
  const tx = new TransactionBuilder(source, { fee: BASE_FEE })
    .setNetworkPassphrase(networkPassphrase)
    .setTimeout(30)
    .addOperation(oftContract.call(method, ...args))
    .build();
  const simulation = await rpcServer.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) {
    const message = "error" in simulation ? simulation.error : "Stellar could not quote this route.";
    throw new Error(message.slice(0, 240));
  }
  return { source, tx, simulation, result: scValToNative(simulation.result.retval) };
}

async function getTokenBalance(address: string): Promise<bigint> {
  const operation = tokenContract.call("balance", new Address(address).toScVal());
  const tx = new TransactionBuilder(await rpcServer.getAccount(address), { fee: BASE_FEE })
    .setNetworkPassphrase(networkPassphrase).setTimeout(30).addOperation(operation).build();
  const simulation = await rpcServer.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) {
    throw new Error("Could not read your Stellar USDT0 balance.");
  }
  return BigInt(String(scValToNative(simulation.result.retval)));
}

async function getQuote(destination: Destination, amount: bigint, recipient: string, walletAddress: string) {
  const balance = await getTokenBalance(walletAddress);
  if (amount > balance) throw new Error("Your Stellar USDT0 balance is lower than the amount entered.");

  const params = sendParam(destination, recipient, amount);
  const oftQuote = await simulateCall(walletAddress, "quote_oft", [
    new Address(walletAddress).toScVal(), params,
  ]);
  if (!Array.isArray(oftQuote.result) || oftQuote.result.length < 3) {
    throw new Error("The Stellar OFT returned an invalid amount quote.");
  }
  const receipt = toRecord(oftQuote.result[2]);
  const received = BigInt(String(receipt.amount_received_ld ?? receipt.amountReceivedLd ?? "-1"));
  if (received < BigInt(0) || received > amount) throw new Error("The Stellar OFT returned an invalid receive amount.");

  const { result } = await simulateCall(walletAddress, "quote_send", [
    new Address(walletAddress).toScVal(), params, nativeToScVal(false),
  ]);
  const fee = toRecord(result);
  const nativeFeeValue = fee.native_fee ?? fee.nativeFee;
  if (nativeFeeValue === undefined || nativeFeeValue === null) throw new Error("The Stellar OFT did not return the LayerZero fee.");
  const nativeFee = BigInt(String(nativeFeeValue));
  if (nativeFee < BigInt(0)) throw new Error("The Stellar OFT returned an invalid LayerZero fee.");
  return { amount, balance, nativeFee, received, destination, recipient };
}

async function loadWallet(email: string) {
  const result = await supabaseServer.from("tbl_wallet")
    .select("wallet_address, secret_key, network")
    .eq("email", email).eq("network", "stellar").maybeSingle();
  if (result.error) throw new Error("Could not load your Stellar wallet.");
  if (!result.data?.wallet_address || !result.data.secret_key) throw new Error("Stellar wallet not found.");
  if (!StrKey.isValidEd25519PublicKey(result.data.wallet_address)) throw new Error("Your stored Stellar address is invalid.");
  return result.data;
}

async function verifyPassword(email: string, password: string) {
  const result = await supabaseServer.from("tbl_auth").select("password").eq("email", email).maybeSingle();
  if (result.error || !result.data?.password) throw new Error("Could not verify your password.");
  if (!(await bcrypt.compare(password, result.data.password))) throw new Error("Password confirmation failed.");
}

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  if (!auth || auth.error) return jsonError("Unauthorized", 401);
  const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return jsonError("Unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object") return jsonError("Invalid request body.");
    body = raw as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body.");
  }

  const actionLimits = {
    destination: { max: 30, message: "Too many destination checks. Please wait and try again." },
    balance: { max: 30, message: "Too many balance checks. Please wait and try again." },
    quote: { max: 12, message: "Too many bridge quotes. Please wait and try again." },
    trustline: { max: 3, message: "Too many trustline requests. Please wait and try again." },
    bridge: { max: 3, message: "Too many bridge submissions. Please wait and try again." },
  } as const;
  if (typeof body.action !== "string" || !Object.hasOwn(actionLimits, body.action)) {
    return jsonError("Choose a supported bridge action.");
  }
  const action = body.action as keyof typeof actionLimits;
  const actionLimit = actionLimits[action];
  const rate = rateLimit(request, {
    windowMs: 60_000,
    max: actionLimit.max,
    keyPrefix: `Stellar_USDT0_bridge_${action}`,
  });
  if (!rate.allowed) return jsonError(actionLimit.message, 429);

  if (action === "destination") {
    const result = await supabaseServer.from("tbl_wallet").select("wallet_address")
      .eq("email", email).eq("network", "stellar").maybeSingle();
    if (result.error) return jsonError("Could not load your Stellar wallet.", 500);
    const address = result.data?.wallet_address;
    if (!address || !StrKey.isValidEd25519PublicKey(address)) return jsonError("Stellar wallet not found.", 404);
    try {
      return NextResponse.json({
        success: true,
        address,
        trustline: await stellarWalletHasUsdt0Trustline(address),
      });
    } catch (error) {
      if ((error as { response?: { status?: number } })?.response?.status === 404) {
        return NextResponse.json({ success: true, address, trustline: false, funded: false });
      }
      return jsonError("Could not check the Stellar receiving account.", 502);
    }
  }

  if (action === "trustline") {
    if (typeof body.password !== "string" || !body.password) return jsonError("Confirm trustline setup with your account password.");
    try {
      await verifyPassword(email, body.password);
      const wallet = await loadWallet(email);
      if (await stellarWalletHasUsdt0Trustline(wallet.wallet_address)) {
        return NextResponse.json({ success: true, trustline: true, message: "USDT0 trustline already exists." });
      }
      const signer = Keypair.fromSecret(decryptText(wallet.secret_key, process.env.WALLET_BANK_KEY || ""));
      if (signer.publicKey() !== wallet.wallet_address) return jsonError("Wallet key does not match the stored Stellar wallet.", 500);
      const account = await horizonServer.loadAccount(wallet.wallet_address);
      const transaction = new TransactionBuilder(account, {
        fee: String(await horizonServer.fetchBaseFee()),
        networkPassphrase,
      })
        .addOperation(Operation.changeTrust({ asset: new Asset(bridgeToken.classicAsset.code, bridgeToken.classicAsset.issuer) }))
        .setTimeout(30)
        .build();
      transaction.sign(signer);
      await horizonServer.submitTransaction(transaction);
      return NextResponse.json({ success: true, trustline: true, message: "USDT0 trustline established." });
    } catch (error) {
      console.error("Stellar USDT0 trustline setup failed:", error);
      if (error instanceof Error && error.message === "Password confirmation failed.") return jsonError(error.message, 401);
      return jsonError("Could not establish the USDT0 trustline. Make sure your Stellar account has enough XLM for the reserve and fee.", 502);
    }
  }

  if (action === "balance") {
    try {
      const wallet = await loadWallet(email);
      return NextResponse.json({ success: true, balance: decimal(await getTokenBalance(wallet.wallet_address)) });
    } catch (error) {
      console.error("Stellar USDT0 balance lookup failed:", error);
      return jsonError("Could not load your Stellar USDT0 balance.", 502);
    }
  }
  if (!isDestination(body.destination)) return jsonError("Choose a supported USDT0 destination.");
  if (typeof body.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(body.recipient.trim())) {
    return jsonError(`Enter a valid ${NETWORKS[body.destination].label} recipient address.`);
  }
  let amount: bigint;
  try { amount = parseAmount(body.amount); }
  catch (error) { return jsonError(error instanceof Error ? error.message : "Invalid amount."); }
  const recipient = `0x${body.recipient.trim().slice(2).toLowerCase()}`;

  try {
    const wallet = await loadWallet(email);
    const quote = await getQuote(body.destination, amount, recipient, wallet.wallet_address);
    const quoteResponse = {
      amount: decimal(quote.amount),
      receiveAmount: decimal(quote.received),
      routeFee: decimal(quote.amount - quote.received),
      availableBalance: decimal(quote.balance),
      nativeFee: nativeDecimal(quote.nativeFee),
      nativeAsset: "XLM",
      destination: NETWORKS[body.destination].label,
      recipient,
      destinationEid: NETWORKS[body.destination].eid,
    };
    if (action === "quote") return NextResponse.json({ success: true, quote: quoteResponse });
    if (typeof body.password !== "string" || !body.password) return jsonError("Confirm the bridge with your account password.");
    await verifyPassword(email, body.password);

    const secret = decryptText(wallet.secret_key, process.env.WALLET_BANK_KEY || "");
    const signer = Keypair.fromSecret(secret);
    if (signer.publicKey() !== wallet.wallet_address) return jsonError("Wallet key does not match the stored Stellar wallet.", 500);

    const params = sendParam(body.destination, recipient, amount);
    const feeScVal = nativeToScVal({ native_fee: quote.nativeFee, zro_fee: BigInt(0) }, {
      type: { native_fee: ["symbol", "i128"], zro_fee: ["symbol", "i128"] },
    });
    const { tx, simulation } = await simulateCall(wallet.wallet_address, "send", [
      new Address(wallet.wallet_address).toScVal(), params, feeScVal, new Address(wallet.wallet_address).toScVal(),
    ]);
    const invoke = tx.operations[0];
    if (invoke.type !== "invokeHostFunction") throw new Error("Could not prepare the Stellar bridge transaction.");
    const latestLedger = await rpcServer.getLatestLedger();
    const authEntries = await Promise.all((simulation.result?.auth ?? []).map((entry) =>
      authorizeEntry(entry, signer, latestLedger.sequence + 100, networkPassphrase),
    ));
    const prepared = rpc.assembleTransaction(tx, simulation)
      .clearOperations()
      .addOperation(Operation.invokeHostFunction({ source: invoke.source, func: invoke.func, auth: authEntries }))
      .build();

    const horizonAccount = await horizonServer.loadAccount(wallet.wallet_address);
    const native = horizonAccount.balances.find((item) => item.asset_type === "native");
    const root = await horizonServer.root() as unknown as { base_reserve_in_stroops?: string };
    const nativeStroops = native ? (() => {
      const [whole, fraction = ""] = native.balance.split(".");
      return BigInt(whole) * BigInt(10_000_000) + BigInt(fraction.padEnd(7, "0"));
    })() : BigInt(0);
    const baseReserve = BigInt(root.base_reserve_in_stroops ?? "0");
    const minReserve = baseReserve * BigInt(2 + horizonAccount.subentry_count);
    const totalXlmFee = BigInt(prepared.fee) + quote.nativeFee;
    if (nativeStroops - minReserve <= totalXlmFee) return jsonError("Keep enough available XLM for your Stellar reserve, the LayerZero fee, and Soroban network resources.");

    prepared.sign(signer);
    const submitted = await rpcServer.sendTransaction(prepared);
    if (submitted.status === "ERROR") throw new Error("Stellar rejected the bridge transaction. Review your balance and try again.");
    return NextResponse.json({
      success: true,
      txHash: submitted.hash,
      message: "USDT0 bridge transaction submitted to Stellar. LayerZero delivery to the destination network is pending.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Stellar USDT0 bridge request failed.";
    console.error("Stellar USDT0 bridge request failed:", error);
    if (/password confirmation/i.test(message)) return jsonError(message, 401);
    if (/balance|amount|recipient|route|slippage|fee|minimum|paused|insufficient/i.test(message)) return jsonError(message.slice(0, 240));
    return jsonError("Could not reach the Stellar LayerZero bridge. Check your network and try again.", 502);
  }
}
