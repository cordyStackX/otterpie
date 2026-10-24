import { NextRequest, NextResponse } from "next/server";
import { Asset, Horizon, Keypair, Operation, StrKey, TransactionBuilder } from "@stellar/stellar-sdk";
import bcrypt from "bcrypt";
import { decryptText, rateLimit, Security } from "@/firewall";
import { supabaseServer } from "@/lib";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STROOPS_PER_XLM = BigInt(10_000_000);

function decimalToStroops(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * STROOPS_PER_XLM + BigInt(fraction.padEnd(7, "0"));
}

function stroopsToDecimal(value: bigint): string {
  const whole = value / STROOPS_PER_XLM;
  const fraction = String(value % STROOPS_PER_XLM).padStart(7, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  if (!auth || auth.error) {
    if (auth?.error instanceof NextResponse) return auth.error;
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const network = "network" in auth ? auth.network : undefined;
  if (network !== "stellar" && network !== "stellar_testnet") {
    return NextResponse.json({ success: false, error: "This account is not using a Stellar network." }, { status: 400 });
  }
  const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const isTestnet = network === "stellar_testnet";
  const networkConfig = isTestnet ? walletNetworks.stellar_testnet : walletNetworks.stellar;
  const server = new Horizon.Server(isTestnet
    ? networkConfig.swapConfig.horizonUrl
    : process.env.STELLAR_HORIZON_URL || networkConfig.swapConfig.horizonUrl);

  const rate = rateLimit(request, { windowMs: 60_000, max: 5, keyPrefix: "Stellar_withdrawal" });
  if (!rate.allowed) {
    const retryAfterSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  let body: { address?: unknown; asset?: unknown; amount?: unknown; withdrawAll?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  const address = typeof body.address === "string" ? body.address.trim() : "";
  const assetCode = typeof body.asset === "string" ? body.asset.trim().toUpperCase() : "";
  const isNativeAsset = assetCode === "XLM";
  const isUsdcTestnet = isTestnet && assetCode === "USDC";
  const amountText = typeof body.amount === "string" ? body.amount.trim() : "";
  const withdrawAll = body.withdrawAll === true;
  const password = typeof body.password === "string" ? body.password : "";
  if (!isNativeAsset && !isUsdcTestnet) {
    return NextResponse.json({ success: false, error: "That asset cannot be withdrawn on the selected Stellar network." }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ success: false, error: "Confirm this transfer with your account password." }, { status: 400 });
  }
  if (!StrKey.isValidEd25519PublicKey(address)) {
    return NextResponse.json({ success: false, error: "Enter a valid Stellar wallet address." }, { status: 400 });
  }
  if (!withdrawAll && !/^\d+(?:\.\d{1,7})?$/.test(amountText)) {
    return NextResponse.json({ success: false, error: `Enter a valid ${assetCode} amount with up to 7 decimal places.` }, { status: 400 });
  }
  const requestedStroops = withdrawAll ? BigInt(0) : decimalToStroops(amountText);
  if (!withdrawAll && requestedStroops <= BigInt(0)) {
    return NextResponse.json({ success: false, error: "Amount must be greater than zero." }, { status: 400 });
  }

  const { data: account, error: accountError } = await supabaseServer
    .from("tbl_auth")
    .select("password")
    .eq("email", email)
    .maybeSingle();
  if (accountError) {
    return NextResponse.json({ success: false, error: "Could not verify your password." }, { status: 500 });
  }
  if (!account?.password || !(await bcrypt.compare(password, account.password))) {
    return NextResponse.json({ success: false, error: "Password confirmation failed." }, { status: 401 });
  }

  const { data: walletRecord, error: walletError } = await supabaseServer
    .from("tbl_wallet")
    .select("wallet_address, secret_key, network")
    .eq("email", email)
    .eq("network", "stellar")
    .maybeSingle();

  if (walletError) {
    return NextResponse.json({ success: false, error: "Could not load your wallet." }, { status: 500 });
  }
  if (!walletRecord?.wallet_address || !walletRecord.secret_key) {
    return NextResponse.json({ success: false, error: "Stellar wallet not found." }, { status: 404 });
  }
  if (!StrKey.isValidEd25519PublicKey(walletRecord.wallet_address)) {
    return NextResponse.json({ success: false, error: "Your stored wallet address is invalid." }, { status: 500 });
  }
  if (address === walletRecord.wallet_address) {
    return NextResponse.json({ success: false, error: "Choose a different destination wallet." }, { status: 400 });
  }

  try {
    const secret = decryptText(walletRecord.secret_key, process.env.WALLET_BANK_KEY || "");
    const signer = Keypair.fromSecret(secret);
    if (signer.publicKey() !== walletRecord.wallet_address) {
      return NextResponse.json({ success: false, error: "Wallet key does not match the stored address." }, { status: 500 });
    }

    const sourceAccount = await server.loadAccount(signer.publicKey());
    const nativeBalance = sourceAccount.balances.find((balance) => balance.asset_type === "native");
    if (!nativeBalance) {
      return NextResponse.json({ success: false, error: "No XLM balance is available to send." }, { status: 400 });
    }

    const token = isUsdcTestnet ? walletNetworks.stellar_testnet.tokens.USDC.classicAsset : null;
    const destinationAsset = token ? new Asset(token.code, token.issuer) : Asset.native();
    const sourceAssetBalance = token
      ? sourceAccount.balances.find((balance) =>
          (balance.asset_type === "credit_alphanum4" || balance.asset_type === "credit_alphanum12") &&
          balance.asset_code === token.code && balance.asset_issuer === token.issuer)
      : nativeBalance;
    if (!sourceAssetBalance) {
      return NextResponse.json({ success: false, error: token ? "Your Stellar Testnet wallet has no USDC trustline from the configured issuer." : "No XLM balance is available to send." }, { status: 400 });
    }

    const latestLedger = await server.ledgers().order("desc").limit(1).call();
    const reservePerEntry = BigInt(latestLedger.records[0]?.base_reserve_in_stroops ?? 0);
    if (reservePerEntry <= BigInt(0)) {
      return NextResponse.json({ success: false, error: "Could not read the Stellar reserve requirement." }, { status: 503 });
    }
    const minimumReserve = reservePerEntry * BigInt(2 + sourceAccount.subentry_count);
    const fee = BigInt(await server.fetchBaseFee());
    const availableNative = decimalToStroops(nativeBalance.balance) - minimumReserve;
    if (availableNative < fee) {
      return NextResponse.json({ success: false, error: "Your XLM balance is not enough to cover the required reserve and network fee." }, { status: 400 });
    }
    const availableToSend = token
      ? decimalToStroops(sourceAssetBalance.balance)
      : availableNative - fee;
    const amountStroops = withdrawAll ? availableToSend : requestedStroops;
    if (amountStroops <= BigInt(0)) {
      return NextResponse.json({ success: false, error: `Your available ${assetCode} balance is not enough to withdraw after reserving the network fee.` }, { status: 400 });
    }
    if (amountStroops > availableToSend) {
      return NextResponse.json({ success: false, error: `Insufficient available ${assetCode} balance.` }, { status: 400 });
    }

    const destinationAccount = await server.loadAccount(address);
    if (token && !destinationAccount.balances.some((balance) =>
      (balance.asset_type === "credit_alphanum4" || balance.asset_type === "credit_alphanum12") &&
      balance.asset_code === token.code && balance.asset_issuer === token.issuer)) {
      return NextResponse.json({ success: false, error: "The destination wallet needs a trustline to USDC from the configured Stellar Testnet issuer." }, { status: 400 });
    }

    const networkPassphrase = isTestnet
      ? networkConfig.swapConfig.networkPassphrase
      : process.env.STELLAR_NETWORK_PASSPHRASE || networkConfig.swapConfig.networkPassphrase;
    const transaction = new TransactionBuilder(sourceAccount, { fee: String(fee), networkPassphrase })
      .addOperation(Operation.payment({ destination: address, asset: destinationAsset, amount: stroopsToDecimal(amountStroops) }))
      .setTimeout(30)
      .build();
    transaction.sign(signer);
    const submitted = await server.submitTransaction(transaction);

    return NextResponse.json({ success: true, txHash: submitted.hash, amount: stroopsToDecimal(amountStroops), message: `${assetCode} transfer submitted.` });
  } catch {
    return NextResponse.json({ success: false, error: "Could not submit the XLM transfer. Check the address, amount, and wallet balance." }, { status: 502 });
  }
}
