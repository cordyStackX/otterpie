import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, createStellarWallet, createBotChainWallet, sendEmailConfirmation } from "@/lib";
import { rateLimit, encryptText } from "@/firewall";
import { getWalletNetworkConfig } from "@/utilities/network";

export async function POST(request: NextRequest) {
  const rate = rateLimit(request, { windowMs: 60_000, max: 5, keyPrefix: "Sign_up" });
  if (!rate.allowed) {
    const retryAfterSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Invalid credentials." }, { status: 400 });
    }

    const { email, password, network, username } = body as Record<string, unknown>;
    if (
      typeof email !== "string" || !email.trim() ||
      typeof password !== "string" || !password ||
      typeof network !== "string" ||
      typeof username !== "string" || !username.trim()
    ) {
      return NextResponse.json({ success: false, error: "Invalid credentials." }, { status: 400 });
    }
    if (username.trim().length >= 15) {
      return NextResponse.json({ success: false, error: "Username must be fewer than 15 characters." }, { status: 400 });
    }
    if (password.length <= 8) {
      return NextResponse.json({ success: false, error: "Password must be more than 8 characters." }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const networkConfig = getWalletNetworkConfig(network);
    if (!networkConfig?.signup.enabled || networkConfig.signup.value !== network) {
      return NextResponse.json({ success: false, error: "Choose a supported wallet network." }, { status: 400 });
    }

    let wallet: { walletAddress: string; secretKey: string };
    if (networkConfig.walletType === "stellar") wallet = createStellarWallet();
    else if (networkConfig.walletType === "evm") wallet = createBotChainWallet();
    else return NextResponse.json({ success: false, error: "Choose a supported wallet network." }, { status: 400 });

    const { error: accountError } = await supabaseServer
      .from("tbl_auth")
      .insert([{
        email: normalizedEmail,
        password: await bcrypt.hash(password, 10),
        username: username.trim().toLowerCase(),
        confirm_email: 0,
      }]);

    if (accountError) {
      if (accountError.code === "23505") {
        return NextResponse.json({ success: false, error: "That email or username is already registered." }, { status: 409 });
      }
      console.error("Signup account insert failed:", {
        code: accountError.code || "unknown",
        message: accountError.message,
        details: accountError.details,
        hint: accountError.hint,
      });
      return NextResponse.json({ success: false, error: "Could not create your account." }, { status: 500 });
    }

    const { error: walletError } = await supabaseServer
      .from("tbl_wallet")
      .insert([{
        wallet_address: wallet.walletAddress,
        secret_key: encryptText(wallet.secretKey, process.env.WALLET_BANK_KEY || ""),
        email: normalizedEmail,
        network,
        username: username.trim().toLowerCase(),
      }]);

    if (walletError) {
      await supabaseServer.from("tbl_auth").delete().eq("email", normalizedEmail);
      console.error("Signup wallet insert failed:", walletError.code || "unknown");
      return NextResponse.json({ success: false, error: "Could not create your wallet. Please try again." }, { status: 500 });
    }

    try {
      await sendEmailConfirmation(normalizedEmail, request);
    } catch (mailError) {
      await supabaseServer.from("tbl_wallet").delete().eq("email", normalizedEmail);
      await supabaseServer.from("tbl_auth").delete().eq("email", normalizedEmail);
      console.error("Signup confirmation email failed:", mailError instanceof Error ? mailError.name : "UnknownError");
      const message = mailError instanceof Error && mailError.message === "EmailConfirmationNotConfigured"
        ? "Email confirmation is not configured on the server."
        : "Could not send the confirmation email. Check your Gmail settings and try again.";
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: "Check your email to confirm your account." }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
