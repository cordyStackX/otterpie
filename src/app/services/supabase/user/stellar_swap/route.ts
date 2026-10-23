import { NextRequest, NextResponse } from "next/server";
import { Asset, Horizon, Keypair, Networks, Operation, StrKey, TransactionBuilder } from "@stellar/stellar-sdk";
import bcrypt from "bcrypt";
import { decryptText, rateLimit, Security } from "@/firewall";
import { supabaseServer } from "@/lib";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const swapConfig = walletNetworks.stellar.swapConfig;
const assetScale = BigInt(10 ** swapConfig.assetDecimals);
const amountPattern = new RegExp(`^\\d+(?:\\.\\d{1,${swapConfig.assetDecimals}})?$`);
const server = new Horizon.Server(process.env.STELLAR_HORIZON_URL || swapConfig.horizonUrl);
const passphrase = process.env.STELLAR_NETWORK_PASSPHRASE || swapConfig.networkPassphrase || Networks.PUBLIC;
type AssetInput = { code: string; issuer: string | null };
type SwapRequest = { source: AssetInput; destination: AssetInput; amount: string; slippage: number };

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function parseAsset(value: unknown): Asset {
  if (!value || typeof value !== "object") throw new Error("Choose valid Stellar assets.");
  const item = value as Record<string, unknown>;
  if (item.code === "XLM" && item.issuer === null) return Asset.native();
  if (typeof item.code !== "string" || !/^[a-zA-Z0-9]{1,12}$/.test(item.code) ||
      typeof item.issuer !== "string" || !StrKey.isValidEd25519PublicKey(item.issuer)) {
    throw new Error("Choose a valid Stellar classic asset.");
  }
  return new Asset(item.code, item.issuer);
}

function parseAmount(value: unknown): string {
  if (typeof value !== "string" || !amountPattern.test(value.trim())) throw new Error(`Enter an amount with up to ${swapConfig.assetDecimals} decimal places.`);
  const amount = value.trim();
  if (Number(amount) <= 0) throw new Error("Enter an amount greater than zero.");
  return amount;
}

function amountUnits(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * assetScale + BigInt(fraction.padEnd(swapConfig.assetDecimals, "0"));
}

function formatUnits(value: bigint): string {
  const whole = value / assetScale;
  const fraction = (value % assetScale).toString().padStart(swapConfig.assetDecimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function assetKey(asset: Asset) {
  return asset.isNative() ? "native" : `${asset.getCode()}:${asset.getIssuer()}`;
}

async function getQuote(source: Asset, destination: Asset, amount: string, walletAddress: string, slippage: number) {
  if (assetKey(source) === assetKey(destination)) throw new Error("Choose two different assets.");
  const account = await server.loadAccount(walletAddress);
  const hasAssetBalance = (balance: (typeof account.balances)[number], asset: Asset) => {
    if (asset.isNative()) return balance.asset_type === "native";
    if (balance.asset_type !== "credit_alphanum4" && balance.asset_type !== "credit_alphanum12") return false;
    return balance.asset_code === asset.getCode() && balance.asset_issuer === asset.getIssuer();
  };
  const sourceBalance = account.balances.find((balance) => hasAssetBalance(balance, source));
  if (!sourceBalance) throw new Error(`Your wallet has no trustline for ${source.isNative() ? "XLM" : source.getCode()}.`);
  const destinationBalance = account.balances.find((balance) => hasAssetBalance(balance, destination));
  if (!destinationBalance) throw new Error(`Add a trustline for ${destination.getCode()} before swapping into it.`);
  if (amountUnits(amount) > amountUnits(sourceBalance.balance)) throw new Error("Your available balance is lower than the amount entered.");

  const records = await server.strictSendPaths(source, amount, [destination]).call();
  const route = records.records.find((item) => Number(item.destination_amount) > 0);
  if (!route) throw new Error("No Stellar liquidity path is available for this asset pair.");
  const outputUnits = amountUnits(route.destination_amount);
  const minimumUnits = outputUnits * BigInt(Math.round(10_000 - slippage * 100)) / BigInt(10_000);
  if (minimumUnits <= BigInt(0)) throw new Error("Slippage setting is too high for this quote.");
  return { route, output: route.destination_amount, minimum: formatUnits(minimumUnits), balance: sourceBalance.balance };
}

async function loadWallet(email: string) {
  const { data, error } = await supabaseServer.from("tbl_wallet")
    .select("wallet_address, secret_key")
    .eq("email", email).eq("network", "stellar").maybeSingle();
  if (error || !data?.wallet_address || !data.secret_key) throw new Error("Stellar wallet not found.");
  if (!StrKey.isValidEd25519PublicKey(data.wallet_address)) throw new Error("Stored Stellar address is invalid.");
  return data;
}

async function verifyPassword(email: string, password: string) {
  const { data, error } = await supabaseServer.from("tbl_auth").select("password").eq("email", email).maybeSingle();
  if (error || !data?.password || !(await bcrypt.compare(password, data.password))) throw new Error("Password confirmation failed.");
}

function parseRequest(body: Record<string, unknown>): SwapRequest {
  const source = body.source as AssetInput;
  const destination = body.destination as AssetInput;
  const amount = parseAmount(body.amount);
  const slippage = typeof body.slippage === "number" ? body.slippage : 1;
  if (!Number.isFinite(slippage) || slippage < 0.1 || slippage > 5) throw new Error("Slippage must be between 0.1% and 5%.");
  parseAsset(source);
  parseAsset(destination);
  return { source, destination, amount, slippage };
}

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  if (!auth || auth.error) return jsonError("Unauthorized", 401);
  const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return jsonError("Unauthorized", 401);
  const rate = rateLimit(request, { windowMs: 60_000, max: 6, keyPrefix: "Stellar_classic_swap" });
  if (!rate.allowed) return jsonError("Too many swap requests. Please wait and try again.", 429);

  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object") return jsonError("Invalid request body.");
    body = value as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body.");
  }
  if (body.action !== "quote" && body.action !== "swap") return jsonError("Choose quote or swap.");
  let swap: SwapRequest;
  try { swap = parseRequest(body); }
  catch (error) { return jsonError(error instanceof Error ? error.message : "Invalid swap request."); }

  try {
    const wallet = await loadWallet(email);
    const source = parseAsset(swap.source);
    const destination = parseAsset(swap.destination);
    const quote = await getQuote(source, destination, swap.amount, wallet.wallet_address, swap.slippage);
    if (body.action === "quote") {
      return NextResponse.json({ success: true, quote: {
        amountIn: swap.amount,
        amountOut: quote.output,
        minimumReceived: quote.minimum,
        availableBalance: quote.balance,
        slippage: swap.slippage,
      } });
    }
    if (typeof body.password !== "string" || !body.password) return jsonError("Confirm the swap with your account password.");
    await verifyPassword(email, body.password);

    const account = await server.loadAccount(wallet.wallet_address);
    const path = quote.route.path.map((item) => {
      if (item.asset_type === "native") return Asset.native();
      if (item.asset_type === "credit_alphanum4" || item.asset_type === "credit_alphanum12") {
        return new Asset(item.asset_code, item.asset_issuer);
      }
      throw new Error("Stellar returned an unsupported liquidity path asset.");
    });
    const transaction = new TransactionBuilder(account, { fee: swapConfig.baseFeeStroops, networkPassphrase: passphrase })
      .addOperation(Operation.pathPaymentStrictSend({
        sendAsset: source,
        sendAmount: swap.amount,
        destination: wallet.wallet_address,
        destAsset: destination,
        destMin: quote.minimum,
        path,
      }))
      .setTimeout(30)
      .build();
    const signer = Keypair.fromSecret(decryptText(wallet.secret_key, process.env.WALLET_BANK_KEY || ""));
    if (signer.publicKey() !== wallet.wallet_address) return jsonError("Wallet key does not match the stored Stellar wallet.", 500);
    transaction.sign(signer);
    const result = await server.submitTransaction(transaction);
    return NextResponse.json({ success: true, txHash: result.hash, quote: { amountOut: quote.output, minimumReceived: quote.minimum } });
  } catch (error) {
    console.error("Stellar swap failed:", error);
    return jsonError(error instanceof Error ? error.message : "The Stellar swap failed.", 502);
  }
}
