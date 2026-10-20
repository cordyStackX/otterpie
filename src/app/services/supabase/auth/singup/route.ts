import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, createStellarWallet, createBotChainWallet } from "@/lib";
import bcrypt from "bcrypt";
import { rateLimit, encryptText } from "@/firewall";

export async function POST(params: NextRequest) {

  const rate = rateLimit(params, { windowMs: 60_0000, max: 5, keyPrefix: "Sign_up" });
  if (!rate.allowed) {
    const retryAfterSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
  }
  
  const { storeName, email, password, network, username } = await params.json();

  try {
    
    if (!storeName || !email || !password || !network || !username) {
      return NextResponse.json({ success: false, error: "Invalid Credentials" }, { status: 400 });
    }

    if (typeof username !== "string" || username.trim().length >= 15) {
      return NextResponse.json(
        { success: false, error: "Username must be fewer than 15 characters" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length <= 8) {
      return NextResponse.json(
        { success: false, error: "Password must be more than 8 characters" },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
    .from("tbl_auth")
    .insert([{ 
      email: email.toLowerCase(),
      password: String(await bcrypt.hash(password, 10)),
      storeName: storeName.toLowerCase(),
      username: username.trim().toLowerCase()
    }]);

    if (error) {
      if (error.code === "23505") {
          return NextResponse.json({ success: false, error: "That email is already registered" }, { status: 409 });
      }
      console.error("Supabase Query Error: ", error);
      return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
    }

    let wallet: {
      walletAddress: string;
      secretKey: string;
    };

    if (network === "stellar") {
        wallet = createStellarWallet();
    } else if (network === "bot_chain") {
        wallet = createBotChainWallet();
    } else {
        throw new Error("Unsupported network");
    }

    const { error: WalletErr } = await supabaseServer
    .from("tbl_wallet")
    .insert([{ 
      wallet_address: wallet.walletAddress,
      secret_key: encryptText(wallet.secretKey, process.env.WALLET_BANK_KEY || ""),
      email: email,
      network: network,
      username: username
    }]);

    if (WalletErr) {
      console.error("Supabase Query Error: ", WalletErr);
      return NextResponse.json({ success: false, error: WalletErr.details }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, message: "Something Went to Servers" }, { status: 500 });
  }

}
