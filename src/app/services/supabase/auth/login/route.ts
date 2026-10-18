import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib";
import bcrypt from "bcrypt";
import { rateLimit, auth_jwt } from "@/firewall";

export async function POST(params: NextRequest) {

  const rate = rateLimit(params, { windowMs: 60_0000, max: 5, keyPrefix: "Log_In" });
  if (!rate.allowed) {
    const retryAfterSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
  }
  
  const { email, password } = await params.json();

  try {
    
    if (!email || !password) return NextResponse.json({ success: false, error: "Invalid Credentials" }, { status: 400 });

    const { data, error } = await supabaseServer
    .from("tbl_auth")
    .select("*")
    .eq("email", email)
    .maybeSingle();

    if (error) {
      console.error("Supabase Query Error: ", error);
      return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
    }

    if (!data) return NextResponse.json({ success: false, error: "Users not exist" }, { status: 404 });

    if (!await bcrypt.compare(password, data.password)) return NextResponse.json({ success: false, error: "Password not match" }, { status: 401 });

    await auth_jwt(email);

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, message: "Something Went to Servers" }, { status: 500 });
  }

}