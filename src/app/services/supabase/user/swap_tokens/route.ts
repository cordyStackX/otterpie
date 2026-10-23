import { NextRequest, NextResponse } from "next/server";
import { Contract, JsonRpcProvider, Wallet, formatUnits, isAddress, parseUnits } from "ethers";
import bcrypt from "bcrypt";
import { BOT_CHAIN_PIE_TOKEN_ADDRESS, supabaseServer } from "@/lib";
import { decryptText, rateLimit, Security } from "@/firewall";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const botChainConfig = walletNetworks.bot_chain;
const swapConfig = botChainConfig.swapConfig;
const CHAIN_ID = botChainConfig.bridge.chainId;
const ROUTER_ADDRESS = swapConfig.routerAddress;
const WBOT_ADDRESS = swapConfig.wbotAddress;
const USDT_ADDRESS = swapConfig.usdtAddress;
const provider = new JsonRpcProvider(process.env.BOT_CHAIN_RPC_URL || botChainConfig.bridge.rpcUrl, CHAIN_ID, { staticNetwork: true });
const routerAbi = [
  "function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
];
const tokenAbi = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];
// type TokenRequest = { symbol: string; address: string | null };
type TokenInfo = { symbol: string; address: string | null; decimals: number };

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

async function resolveToken(value: unknown, savedTokens: unknown[]): Promise<TokenInfo> {
  if (!value || typeof value !== "object") throw new Error("Choose valid swap tokens.");
  const token = value as Record<string, unknown>;
  if (token.symbol === "BOT" && token.address === null) return { symbol: "BOT", address: null, decimals: 18 };
  const address = typeof token.address === "string" && isAddress(token.address) ? token.address : "";
  if (!address || typeof token.symbol !== "string") throw new Error("Choose a valid BOT Chain token.");
  const lower = address.toLowerCase();
  let symbol = "";
  if (lower === BOT_CHAIN_PIE_TOKEN_ADDRESS.toLowerCase() && token.symbol === "PIE") symbol = "PIE";
  if (lower === USDT_ADDRESS.toLowerCase() && token.symbol === "USDT") symbol = "USDT";
  const saved = savedTokens.find((item) => item && typeof item === "object" &&
    (item as { type?: unknown }).type === "evm" &&
    typeof (item as { address?: unknown }).address === "string" &&
    (item as { address: string }).address.toLowerCase() === lower &&
    (item as { symbol?: unknown }).symbol === token.symbol) as { symbol: string; address: string; decimals: number } | undefined;
  if (!symbol && saved) symbol = saved.symbol;
  if (!symbol) throw new Error("This token is not in your saved BOT Chain token list.");
  const decimals = Number(await new Contract(address, tokenAbi, provider).getFunction("decimals").staticCall());
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error("Token decimals are invalid.");
  return { symbol, address, decimals };
}

function routeFor(input: TokenInfo, output: TokenInfo) {
  if (input.address === null) return [WBOT_ADDRESS, output.address!];
  if (output.address === null) return [input.address, WBOT_ADDRESS];
  return [input.address, WBOT_ADDRESS, output.address];
}

async function quote(input: TokenInfo, output: TokenInfo, amount: string, walletAddress: string, slippage: number) {
  if (input.address === output.address) throw new Error("Choose two different tokens.");
  const amountIn = parseUnits(amount, input.decimals);
  if (amountIn <= BigInt(0)) throw new Error("Enter an amount greater than zero.");
  const path = routeFor(input, output);
  const router = new Contract(ROUTER_ADDRESS, routerAbi, provider);
  const amounts = await router.getFunction("getAmountsOut").staticCall(amountIn, path) as bigint[];
  const amountOut = amounts[amounts.length - 1];
  if (amounts.length < 2 || amountOut <= BigInt(0)) throw new Error("No usable BOT Chain liquidity route exists for this pair.");
  const balance = input.address
    ? BigInt(await new Contract(input.address, tokenAbi, provider).getFunction("balanceOf").staticCall(walletAddress))
    : await provider.getBalance(walletAddress);
  if (amountIn > balance) throw new Error(`Insufficient ${input.symbol} balance.`);
  const minimum = amountOut * BigInt(Math.floor((100 - slippage) * 100)) / BigInt(10_000);
  if (minimum <= BigInt(0)) throw new Error("The minimum receive amount is too small for the selected slippage.");
  return { amountIn, amountOut, minimum, balance, path };
}

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  if (!auth || auth.error) return jsonError("Unauthorized", 401);
  const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return jsonError("Unauthorized", 401);
  const rate = rateLimit(request, { windowMs: 60_000, max: 8, keyPrefix: "BOT_Chain_token_swap" });
  if (!rate.allowed) return jsonError("Too many swap requests. Please wait and try again.", 429);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object") return jsonError("Invalid request.");
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request.");
  }
  if (body.action !== "quote" && body.action !== "swap") return jsonError("Choose quote or swap.");
  if (typeof body.amount !== "string" || !/^\d+(?:\.\d{1,36})?$/.test(body.amount.trim())) return jsonError("Enter a valid swap amount.");
  const slippage = typeof body.slippage === "number" ? body.slippage : 1;
  if (!Number.isFinite(slippage) || slippage < 0.1 || slippage > 5) return jsonError("Slippage must be between 0.1% and 5%.");

  const walletResult = await supabaseServer.from("tbl_wallet").select("wallet_address, token_balance, network")
    .eq("email", email).in("network", ["bot_chain", "otterpie_bot_chain"]).maybeSingle();
  if (walletResult.error) return jsonError("Could not load your BOT Chain wallet.", 500);
  const walletRecord = walletResult.data;
  if (!walletRecord?.wallet_address || !isAddress(walletRecord.wallet_address)) return jsonError("BOT Chain wallet not found.", 404);
  const tokens = Array.isArray(walletRecord.token_balance) ? walletRecord.token_balance : [];

  try {
    const input = await resolveToken(body.from, tokens);
    const output = await resolveToken(body.to, tokens);
    const swapQuote = await quote(input, output, body.amount.trim(), walletRecord.wallet_address, slippage);
    if (body.action === "quote") return NextResponse.json({ success: true, quote: {
      amountIn: body.amount.trim(),
      amountOut: formatUnits(swapQuote.amountOut, output.decimals),
      minimumReceived: formatUnits(swapQuote.minimum, output.decimals),
      availableBalance: formatUnits(swapQuote.balance, input.decimals),
      slippage,
    } });

    if (typeof body.password !== "string" || !body.password) return jsonError("Confirm the swap with your account password.");
    const account = await supabaseServer.from("tbl_auth").select("password").eq("email", email).maybeSingle();
    if (account.error || !account.data?.password) return jsonError("Could not verify your password.", 500);
    if (!(await bcrypt.compare(body.password, account.data.password))) return jsonError("Password confirmation failed.", 401);
    const secretResult = await supabaseServer.from("tbl_wallet").select("secret_key")
      .eq("email", email).eq("network", walletRecord.network).maybeSingle();
    if (secretResult.error) return jsonError("Could not load your wallet signing key.", 500);
    if (!secretResult.data?.secret_key) return jsonError("Wallet signing key not found.", 404);

    const signer = new Wallet(decryptText(secretResult.data.secret_key, process.env.WALLET_BANK_KEY || ""), provider);
    if (signer.address.toLowerCase() !== walletRecord.wallet_address.toLowerCase()) return jsonError("Wallet key does not match the stored wallet.", 500);
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(CHAIN_ID)) return jsonError("BOT Chain RPC is connected to the wrong network.", 503);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
    if (!gasPrice) return jsonError("Could not estimate BOT Chain fees.", 503);
    const feeOptions = feeData.maxFeePerGas
      ? { maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? feeData.maxFeePerGas }
      : { gasPrice };
    const deadline = Math.floor(Date.now() / 1000) + 120;
    const nativeBalance = await provider.getBalance(signer.address);
    const router = new Contract(ROUTER_ADDRESS, routerAbi, signer);
    let tx;

    if (!input.address) {
      const method = router.getFunction("swapExactETHForTokens");
      const gas = await method.estimateGas(swapQuote.minimum, swapQuote.path, signer.address, deadline, { value: swapQuote.amountIn });
      if (swapQuote.amountIn + gas * gasPrice > nativeBalance) return jsonError("Keep extra BOT in your wallet to cover network fees.");
      tx = await method.send(swapQuote.minimum, swapQuote.path, signer.address, deadline, { value: swapQuote.amountIn, gasLimit: gas, ...feeOptions });
    } else {
      const inputToken = new Contract(input.address, tokenAbi, signer);
      const allowance = BigInt(await inputToken.getFunction("allowance").staticCall(signer.address, ROUTER_ADDRESS));
      if (allowance < swapQuote.amountIn) {
        const approve = inputToken.getFunction("approve");
        const approvalGas = await approve.estimateGas(ROUTER_ADDRESS, swapQuote.amountIn);
        const approvalTx = await approve.send(ROUTER_ADDRESS, swapQuote.amountIn, { gasLimit: approvalGas, ...feeOptions });
        await approvalTx.wait(1);
      }
      if (output.address === null) {
        const method = router.getFunction("swapExactTokensForETH");
        const gas = await method.estimateGas(swapQuote.amountIn, swapQuote.minimum, swapQuote.path, signer.address, deadline);
        if (gas * gasPrice > nativeBalance) return jsonError("Your BOT balance is not enough to cover network fees.");
        tx = await method.send(swapQuote.amountIn, swapQuote.minimum, swapQuote.path, signer.address, deadline, { gasLimit: gas, ...feeOptions });
      } else {
        const method = router.getFunction("swapExactTokensForTokens");
        const gas = await method.estimateGas(swapQuote.amountIn, swapQuote.minimum, swapQuote.path, signer.address, deadline);
        if (gas * gasPrice > nativeBalance) return jsonError("Your BOT balance is not enough to cover network fees.");
        tx = await method.send(swapQuote.amountIn, swapQuote.minimum, swapQuote.path, signer.address, deadline, { gasLimit: gas, ...feeOptions });
      }
    }
    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1) throw new Error("Swap transaction failed on-chain.");
    return NextResponse.json({ success: true, txHash: tx.hash, amountIn: body.amount, minimumReceived: formatUnits(swapQuote.minimum, output.decimals) });
  } catch (error) {
    console.error("BOT Chain token swap failed:", error);
    const message = error instanceof Error ? error.message : "Swap failed.";
    if (/liquidity|route|insufficient|slippage|revert/i.test(message)) return jsonError(message.slice(0, 240));
    return jsonError("Could not complete this swap. The pair may have no liquidity or the RPC may be unavailable.", 400);
  }
}
