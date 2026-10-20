import { NextRequest, NextResponse } from "next/server";
import { JsonRpcProvider, Wallet, formatEther, isAddress, parseEther } from "ethers";
import bcrypt from "bcrypt";
import { decryptText, rateLimit, Security } from "@/firewall";
import { supabaseServer } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAIN_ID = 677;
const provider = new JsonRpcProvider(
  process.env.BOT_CHAIN_RPC_URL || "https://rpc.botchain.ai",
  CHAIN_ID,
  { staticNetwork: true }
);

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  if (auth.error !== false) {
    return auth.error instanceof NextResponse
      ? auth.error
      : NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(request, { windowMs: 60_000, max: 3, keyPrefix: "withdraw-botchain" });
  if (!limit.allowed) {
    return NextResponse.json({ success: false, error: "Too many withdrawal attempts. Try again in a minute." }, { status: 429 });
  }

  let body: { address?: unknown; amount?: unknown; withdrawAll?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  const address = typeof body.address === "string" ? body.address.trim() : "";
  const amountText = typeof body.amount === "string" ? body.amount.trim() : "";
  const withdrawAll = body.withdrawAll === true;
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ success: false, error: "Confirm this transfer with your account password." }, { status: 400 });
  }
  if (!isAddress(address)) {
    return NextResponse.json({ success: false, error: "Enter a valid EVM wallet address." }, { status: 400 });
  }
  if (!withdrawAll && !/^\d+(?:\.\d{1,18})?$/.test(amountText)) {
    return NextResponse.json({ success: false, error: "Enter a valid BOT amount with up to 18 decimal places." }, { status: 400 });
  }
  const { data: account, error: accountError } = await supabaseServer
    .from("tbl_auth")
    .select("password")
    .eq("email", auth.email)
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
    .eq("email", auth.email)
    .eq("network", "bot_chain")
    .maybeSingle();

  if (walletError) {
    return NextResponse.json({ success: false, error: "Could not load your wallet." }, { status: 500 });
  }
  if (!walletRecord?.wallet_address || !walletRecord.secret_key) {
    return NextResponse.json({ success: false, error: "BOT Chain wallet not found." }, { status: 404 });
  }
  if (!isAddress(walletRecord.wallet_address)) {
    return NextResponse.json({ success: false, error: "Your stored wallet address is invalid." }, { status: 500 });
  }
  if (address.toLowerCase() === walletRecord.wallet_address.toLowerCase()) {
    return NextResponse.json({ success: false, error: "Choose a different destination wallet." }, { status: 400 });
  }

  try {
    const privateKey = decryptText(walletRecord.secret_key, process.env.WALLET_BANK_KEY || "");
    const signer = new Wallet(privateKey, provider);
    if (signer.address.toLowerCase() !== walletRecord.wallet_address.toLowerCase()) {
      return NextResponse.json({ success: false, error: "Wallet key does not match the stored address." }, { status: 500 });
    }

    const balance = await provider.getBalance(signer.address);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
    if (!gasPrice) {
      return NextResponse.json({ success: false, error: "Could not estimate BOT Chain transaction fees." }, { status: 503 });
    }

    const requestedAmount = withdrawAll ? BigInt(0) : parseEther(amountText);
    if (!withdrawAll && requestedAmount <= BigInt(0)) {
      return NextResponse.json({ success: false, error: "Amount must be greater than zero." }, { status: 400 });
    }

    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(CHAIN_ID)) {
      return NextResponse.json({ success: false, error: "BOT Chain RPC is connected to the wrong network." }, { status: 503 });
    }

    const gasLimit = await provider.estimateGas({
      to: address,
      value: withdrawAll ? BigInt(0) : requestedAmount,
      from: signer.address,
    });
    const feeReserve = gasLimit * gasPrice;
    const amount = withdrawAll ? balance - feeReserve : requestedAmount;
    if (amount <= BigInt(0)) {
      return NextResponse.json({ success: false, error: "Your BOT balance is not enough to cover the network fee." }, { status: 400 });
    }
    if (amount + feeReserve > balance) {
      return NextResponse.json({ success: false, error: "Insufficient BOT balance to cover the amount and network fee." }, { status: 400 });
    }

    const transaction = { to: address, value: amount };
    const feeOptions = feeData.maxFeePerGas
      ? {
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? feeData.maxFeePerGas,
        }
      : { gasPrice };
    const sent = await signer.sendTransaction({ ...transaction, gasLimit, ...feeOptions });
    return NextResponse.json({ success: true, txHash: sent.hash, amount: formatEther(amount), message: "BOT transfer submitted." });
  } catch (error) {
    // Avoid returning provider details, which may contain transaction internals.
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("insufficient funds")) {
      return NextResponse.json({ success: false, error: "Insufficient BOT balance to cover the amount and network fee." }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Could not submit the BOT transfer. Check the address, amount, and wallet balance." }, { status: 502 });
  }
}
