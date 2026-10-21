import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Contract, JsonRpcProvider, Wallet, formatUnits, getAddress, isAddress, parseUnits } from "ethers";
import bcrypt from "bcrypt";
import { supabaseServer } from "@/lib";
import { decryptText, rateLimit, Security } from "@/firewall";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bridgeConfig = walletNetworks.bot_chain.bridge;
const DESTINATIONS = bridgeConfig.networks;
type DestinationKey = keyof typeof DESTINATIONS;

const provider = new JsonRpcProvider(
  process.env.BOT_CHAIN_RPC_URL || bridgeConfig.rpcUrl,
  bridgeConfig.chainId,
  { staticNetwork: true },
);

const routerAbi = [
  "function Bridge() view returns (address)",
  "function deposit(uint256 destinationChainId, bytes32 resourceId, address recipient, uint256 amount) payable",
  "function blacklist(address user) view returns (bool)",
];
const bridgeAbi = [
  "function fee(uint256 destinationChainId) view returns (uint256)",
  "function getTokenInfoByResourceId(bytes32 resourceId) view returns (uint8 assetsType, address tokenAddress, bool paused, uint256 decimals, bool burnable, bool mintable)",
];
const tokenAbi = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function isDestinationKey(value: unknown): value is DestinationKey {
  return typeof value === "string"
    && Object.hasOwn(DESTINATIONS, value)
    && DESTINATIONS[value as DestinationKey].outbound.enabled;
}

function toTronEvmAddress(value: string): string {
  // This is the public Base58 alphabet used to decode addresses, not a secret.
  // eslint-disable-next-line no-secrets/no-secrets -- public encoding alphabet
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let decoded = BigInt(0);
  for (const character of value) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error("Enter a valid Tron address starting with T.");
    decoded = decoded * BigInt(58) + BigInt(digit);
  }
  let hex = decoded.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const leadingZeroBytes = value.match(/^1*/)?.[0].length ?? 0;
  const bytes = Buffer.concat([Buffer.alloc(leadingZeroBytes), Buffer.from(hex, "hex")]);
  if (bytes.length !== 25 || bytes[0] !== 0x41) throw new Error("Enter a valid Tron mainnet address.");
  const payload = bytes.subarray(0, 21);
  const checksum = createHash("sha256").update(createHash("sha256").update(payload).digest()).digest().subarray(0, 4);
  if (!checksum.equals(bytes.subarray(21))) throw new Error("The Tron address checksum is invalid.");
  return getAddress(`0x${payload.subarray(1).toString("hex")}`);
}

function parseRecipient(destination: DestinationKey, value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a recipient wallet address.");
  const address = value.trim();
  if (DESTINATIONS[destination].outbound.addressType === "tron") return isAddress(address) ? getAddress(address) : toTronEvmAddress(address);
  if (!isAddress(address)) throw new Error(`Enter a valid ${DESTINATIONS[destination].label} address.`);
  return getAddress(address);
}

function parseBridgeInput(value: unknown): { action: "quote" | "bridge"; destination: DestinationKey; amount: string; recipient: string; password: string } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if ((body.action !== "quote" && body.action !== "bridge") || !isDestinationKey(body.destination)) return null;
  if (typeof body.amount !== "string" || !/^\d+(?:\.\d{1,18})?$/.test(body.amount.trim())) return null;
  if (typeof body.recipient !== "string") return null;
  return {
    action: body.action,
    destination: body.destination,
    amount: body.amount.trim(),
    recipient: body.recipient.trim(),
    password: typeof body.password === "string" ? body.password : "",
  };
}

async function getBridgeQuote(destination: DestinationKey, amountText: string, recipient: string, walletAddress: string) {
  const chain = await provider.getNetwork();
  if (chain.chainId !== BigInt(bridgeConfig.chainId)) throw new Error("BOT Chain RPC is connected to the wrong network.");

  const router = new Contract(bridgeConfig.router, routerAbi, provider);
  const token = new Contract(bridgeConfig.usdtToken, tokenAbi, provider);
  const [tokenDecimalsValue, tokenBalance, bridgeAddress] = await Promise.all([
    token.getFunction("decimals").staticCall() as Promise<bigint>,
    token.getFunction("balanceOf").staticCall(walletAddress) as Promise<bigint>,
    router.getFunction("Bridge").staticCall() as Promise<string>,
  ]);
  const decimals = Number(tokenDecimalsValue);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error("BOT Chain USDT decimals are invalid.");
  const amount = parseUnits(amountText, decimals);
  if (amount <= BigInt(0)) throw new Error("Enter an amount greater than zero.");
  if (amount <= parseUnits(bridgeConfig.minimumAmount, decimals)) throw new Error(`The bridge requires an amount greater than ${bridgeConfig.minimumAmount} USDT.`);
  if (amount > tokenBalance) throw new Error("Your BOT Chain USDT balance is too low for this amount.");

  const bridge = new Contract(bridgeAddress, bridgeAbi, provider);
  const [feeBpsValue, tokenInfo, senderBlocked, recipientBlocked] = await Promise.all([
    bridge.getFunction("fee").staticCall(DESTINATIONS[destination].outbound.chainId) as Promise<bigint>,
    bridge.getFunction("getTokenInfoByResourceId").staticCall(bridgeConfig.usdtResourceId) as Promise<[bigint, string, boolean, bigint, boolean, boolean]>,
    router.getFunction("blacklist").staticCall(walletAddress) as Promise<boolean>,
    router.getFunction("blacklist").staticCall(recipient) as Promise<boolean>,
  ]);
  if (Number(tokenInfo[0]) !== bridgeConfig.usdtResourceAssetType || tokenInfo[1].toLowerCase() !== bridgeConfig.usdtToken.toLowerCase()) {
    throw new Error("The configured bridge resource is not BOT Chain USDT.");
  }
  if (tokenInfo[2]) throw new Error("BOT Chain USDT bridging is paused by the bridge contract.");
  if (senderBlocked || recipientBlocked) throw new Error("This wallet cannot use the BOT Chain bridge.");
  if (feeBpsValue < BigInt(0) || feeBpsValue > BigInt(bridgeConfig.feeDenominatorBps)) throw new Error("The bridge returned an invalid fee.");

  const fee = amount * feeBpsValue / BigInt(bridgeConfig.feeDenominatorBps);
  if (fee >= amount) throw new Error("The bridge fee is greater than the amount entered.");
  return {
    router,
    token,
    amount,
    decimals,
    fee,
    feeBps: Number(feeBpsValue),
    balance: tokenBalance,
    recipient,
    destinationChainId: DESTINATIONS[destination].outbound.chainId,
  };
}

function getSafeError(error: unknown) {
  const message = error instanceof Error ? error.message : "The bridge request failed.";
  if (/insufficient|amount|fee|recipient|address|paused|blocked|revert|allowance|funds/i.test(message)) {
    return message.slice(0, 240);
  }
  return "Could not reach the BOT Chain bridge. Check the network and try again.";
}

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  if (!auth || auth.error) return jsonError("Unauthorized", 401);
  const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return jsonError("Unauthorized", 401);

  const rate = rateLimit(request, { windowMs: 60_000, max: 5, keyPrefix: "BOT_Chain_bridge" });
  if (!rate.allowed) return jsonError("Too many bridge requests. Please wait and try again.", 429);

  let rawBody: unknown;
  try { rawBody = await request.json(); }
  catch { return jsonError("Invalid request body."); }

  if (rawBody && typeof rawBody === "object" && (rawBody as Record<string, unknown>).action === "balance") {
    const walletResult = await supabaseServer
      .from("tbl_wallet")
      .select("wallet_address")
      .eq("email", email)
      .in("network", ["bot_chain", "otterpie_bot_chain"])
      .maybeSingle();
    if (walletResult.error) return jsonError("Could not load your BOT Chain wallet.", 500);
    const address = walletResult.data?.wallet_address;
    if (!address || !isAddress(address)) return jsonError("BOT Chain wallet not found.", 404);
    try {
      const token = new Contract(bridgeConfig.usdtToken, tokenAbi, provider);
      const [balance, decimals] = await Promise.all([
        token.getFunction("balanceOf").staticCall(address) as Promise<bigint>,
        token.getFunction("decimals").staticCall() as Promise<bigint>,
      ]);
      return NextResponse.json({ success: true, balance: formatUnits(balance, Number(decimals)) });
    } catch (error) {
      console.error("BOT Chain USDT balance lookup failed:", error);
      return jsonError("Could not load your BOT Chain USDT balance.", 502);
    }
  }

  const input = parseBridgeInput(rawBody);
  if (!input) return jsonError("Choose a supported destination, amount, and recipient address.");
  let recipient: string;
  try { recipient = parseRecipient(input.destination, input.recipient); }
  catch (error) { return jsonError(error instanceof Error ? error.message : "Invalid recipient address."); }

  const walletResult = await supabaseServer
    .from("tbl_wallet")
    .select("wallet_address, network")
    .eq("email", email)
    .in("network", ["bot_chain", "otterpie_bot_chain"])
    .maybeSingle();
  if (walletResult.error) return jsonError("Could not load your BOT Chain wallet.", 500);
  const walletRecord = walletResult.data;
  if (!walletRecord?.wallet_address || !isAddress(walletRecord.wallet_address)) return jsonError("BOT Chain wallet not found.", 404);

  try {
    const quote = await getBridgeQuote(input.destination, input.amount, recipient, walletRecord.wallet_address);
    const estimate = {
      amount: formatUnits(quote.amount, quote.decimals),
      fee: formatUnits(quote.fee, quote.decimals),
      feePercent: quote.feeBps / 100,
      receiveAmount: formatUnits(quote.amount - quote.fee, quote.decimals),
      availableBalance: formatUnits(quote.balance, quote.decimals),
      destination: DESTINATIONS[input.destination].label,
      recipient: quote.recipient,
      destinationChainId: quote.destinationChainId,
    };

    if (input.action === "quote") return NextResponse.json({ success: true, quote: estimate });
    if (!input.password) return jsonError("Confirm the bridge with your account password.");

    const accountResult = await supabaseServer.from("tbl_auth").select("password").eq("email", email).maybeSingle();
    if (accountResult.error || !accountResult.data?.password) return jsonError("Could not verify your password.", 500);
    if (!(await bcrypt.compare(input.password, accountResult.data.password))) return jsonError("Password confirmation failed.", 401);

    const secretResult = await supabaseServer
      .from("tbl_wallet")
      .select("secret_key")
      .eq("email", email)
      .in("network", ["bot_chain", "otterpie_bot_chain"])
      .maybeSingle();
    if (secretResult.error || !secretResult.data?.secret_key) return jsonError("BOT Chain wallet signing key not found.", 404);

    const privateKey = decryptText(secretResult.data.secret_key, process.env.WALLET_BANK_KEY || "");
    const signer = new Wallet(privateKey, provider);
    if (signer.address.toLowerCase() !== walletRecord.wallet_address.toLowerCase()) {
      return jsonError("Wallet key does not match the stored BOT Chain wallet.", 500);
    }
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(bridgeConfig.chainId)) return jsonError("BOT Chain RPC is connected to the wrong network.", 503);

    const token = new Contract(bridgeConfig.usdtToken, tokenAbi, signer);
    const allowance = BigInt(await token.getFunction("allowance").staticCall(signer.address, bridgeConfig.router));
    let approvalHash: string | undefined;
    if (allowance < quote.amount) {
      const approve = token.getFunction("approve");
      const approvalGas = await approve.estimateGas(bridgeConfig.router, quote.amount);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
      if (!gasPrice) return jsonError("Could not estimate BOT Chain transaction fees.", 503);
      const nativeBalance = await provider.getBalance(signer.address);
      if (nativeBalance < approvalGas * gasPrice) return jsonError("Keep BOT in your wallet to pay the USDT approval network fee.");
      const approval = await approve.send(bridgeConfig.router, quote.amount, { gasLimit: approvalGas, gasPrice });
      approvalHash = approval.hash;
      const approvalReceipt = await approval.wait(1);
      if (!approvalReceipt || approvalReceipt.status !== 1) throw new Error("USDT approval failed on BOT Chain.");
    }

    const router = new Contract(bridgeConfig.router, routerAbi, signer);
    const deposit = router.getFunction("deposit");
    const depositArgs = [quote.destinationChainId, bridgeConfig.usdtResourceId, quote.recipient, quote.amount] as const;
    const gasLimit = await deposit.estimateGas(...depositArgs);
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas;
    const gasPrice = maxFeePerGas ?? feeData.gasPrice;
    if (!gasPrice) return jsonError("Could not estimate BOT Chain transaction fees.", 503);
    const nativeBalance = await provider.getBalance(signer.address);
    if (nativeBalance < gasLimit * gasPrice) return jsonError("Keep BOT in your wallet to pay the bridge transaction network fee.");

    const tx = maxFeePerGas
      ? await deposit.send(...depositArgs, { gasLimit, maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? maxFeePerGas })
      : await deposit.send(...depositArgs, { gasLimit, gasPrice });
    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) throw new Error("Bridge deposit failed on BOT Chain.");

    return NextResponse.json({
      success: true,
      txHash: tx.hash,
      approvalHash,
      quote: estimate,
      status: "pending",
      message: "Bridge deposit confirmed on BOT Chain. Destination delivery is pending bridge validators.",
    });
  } catch (error) {
    console.error("BOT Chain bridge request failed:", error);
    return jsonError(getSafeError(error));
  }
}
