import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib";
import bcrypt from "bcrypt";
import { rateLimit } from "@/firewall";

export async function POST(params: NextRequest) {

  const rate = rateLimit(params, { windowMs: 60_0000, max: 5, keyPrefix: "Sign_up" });
  if (!rate.allowed) {
    const retryAfterSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
  }
  
  const { storeName, email, password } = await params.json();

  try {
    
    if (!storeName || !email || !password) return NextResponse.json({ success: false, error: "Invalid Credentials" }, { status: 400 });

    const { error } = await supabaseServer
    .from("tbl_auth")
    .insert([{ 
      email: email.toLowerCase(),
      password: String(await bcrypt.hash(password, 10)),
      storeName: storeName.toLowerCase()
    }]);

    if (error) {
      console.error("Supabase Query Error: ", error);
      return NextResponse.json({ success: false, error: error.details }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (e) {
    NextResponse.json({ success: false, message: "Something Went to Servers" }, { status: 500 });
    console.error(e);
  }

}