import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib";
import bcrypt from "bcrypt";
import { Security, rateLimit, decryptText } from "@/firewall";

export async function POST(params: NextRequest) {
  const auth = await Security(params);
  if (auth?.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const rate = rateLimit(params, { windowMs: 60_000, max: 5, keyPrefix: "Show_wallet_secrets" });
  if (!rate.allowed) {
    const retryAfterSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  try {
    const {email, password} = await params.json();
    if (!password || !email) {
      return NextResponse.json({ success: false, error: "Invalid Credentials" }, { status: 400 });
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
      return NextResponse.json({ success: false, error: "Incorrect password." }, { status: 401 });
    }

    const { data: wallet, error: walletError } = await supabaseServer
      .from("tbl_wallet")
      .select("secret_key")
      .eq("email", email)
      .maybeSingle();

    if (walletError) {
      return NextResponse.json({ success: false, error: "Could not retrieve your wallet secret." }, { status: 500 });
    }

    if (!wallet?.secret_key) {
      return NextResponse.json({ success: false, error: "No wallet secret is available for this account." }, { status: 404 });
    }

    const secret = decryptText(wallet.secret_key, process.env.WALLET_BANK_KEY || "");
    if (!secret) {
      return NextResponse.json({ success: false, error: "Could not decrypt your wallet secret." }, { status: 500 });
    }

    return NextResponse.json({ success: true, secret }, { status: 200 });

  } catch {
    return NextResponse.json({ success: false, error: "Could not retrieve your wallet secret." }, { status: 500 });
  }
}
