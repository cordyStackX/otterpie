import { NextRequest, NextResponse } from "next/server";
import { Asset, Horizon, Keypair, Networks, Operation, StrKey, TransactionBuilder } from "@stellar/stellar-sdk";
import bcrypt from "bcrypt";
import { decryptText, rateLimit, Security } from "@/firewall";
import { supabaseServer } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const horizonUrl = process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org";
const server = new Horizon.Server(horizonUrl);
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
  if (auth?.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const rate = rateLimit(request, { windowMs: 60_000, max: 5, keyPrefix: "Show_wallet_secrets" });
  if (!rate.allowed) {
    const retryAfterSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  let body: { email: string; address?: unknown; amount?: unknown; withdrawAll?: unknown; password?: unknown };
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
  if (!StrKey.isValidEd25519PublicKey(address)) {
    return NextResponse.json({ success: false, error: "Enter a valid Stellar wallet address." }, { status: 400 });
  }
  if (!withdrawAll && !/^\d+(?:\.\d{1,7})?$/.test(amountText)) {
    return NextResponse.json({ success: false, error: "Enter a valid XLM amount with up to 7 decimal places." }, { status: 400 });
  }
  const requestedStroops = withdrawAll ? BigInt(0) : decimalToStroops(amountText);
  if (!withdrawAll && requestedStroops <= BigInt(0)) {
    return NextResponse.json({ success: false, error: "Amount must be greater than zero." }, { status: 400 });
  }

  const { data: account, error: accountError } = await supabaseServer
    .from("tbl_auth")
    .select("password")
    .eq("email", body.email)
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
    .eq("email", body.email)
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

    const [root, latestLedger] = await Promise.all([
      server.root(),
      server.ledgers().order("desc").limit(1).call(),
    ]);
    const reservePerEntry = BigInt(latestLedger.records[0]?.base_reserve_in_stroops ?? 0);
    if (reservePerEntry <= BigInt(0)) {
      return NextResponse.json({ success: false, error: "Could not read the Stellar reserve requirement." }, { status: 503 });
    }
    const minimumReserve = reservePerEntry * BigInt(2 + sourceAccount.subentry_count);
    const fee = BigInt(await server.fetchBaseFee());
    const availableToSend = BigInt(nativeBalance.balance.replace(".", "").padEnd(8, "0")) - minimumReserve - fee;
    const amountStroops = withdrawAll ? availableToSend : requestedStroops;
    if (amountStroops <= BigInt(0)) {
      return NextResponse.json({ success: false, error: "Your XLM balance is not enough to cover the required reserve and network fee." }, { status: 400 });
    }
    if (amountStroops > availableToSend) {
      return NextResponse.json({ success: false, error: "Insufficient available XLM after the required account reserve and network fee." }, { status: 400 });
    }

    const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || root.network_passphrase ||
      (/testnet|bohr/i.test(horizonUrl) ? Networks.TESTNET : Networks.PUBLIC);
    const transaction = new TransactionBuilder(sourceAccount, { fee: String(fee), networkPassphrase })
      .addOperation(Operation.payment({ destination: address, asset: Asset.native(), amount: stroopsToDecimal(amountStroops) }))
      .setTimeout(30)
      .build();
    transaction.sign(signer);
    const submitted = await server.submitTransaction(transaction);

    return NextResponse.json({ success: true, txHash: submitted.hash, amount: stroopsToDecimal(amountStroops), message: "XLM transfer submitted." });
  } catch {
    return NextResponse.json({ success: false, error: "Could not submit the XLM transfer. Check the address, amount, and wallet balance." }, { status: 502 });
  }
}
