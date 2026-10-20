import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib";
import bcrypt from "bcrypt";
import { rateLimit, auth_jwt } from "@/firewall";

export async function POST(request: NextRequest) {
  const rate = rateLimit(request, { windowMs: 60_0000, max: 5, keyPrefix: "Log_In" });
  if (!rate.allowed) {
    const retryAfterSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  try {
    const body = await request.json();
    const rawIdentifier = typeof body.identifier === "string" ? body.identifier : body.email;
    const password = body.password;

    if (typeof rawIdentifier !== "string" || typeof password !== "string" || !rawIdentifier.trim() || !password) {
      return NextResponse.json({ success: false, error: "Enter your username or email and password" }, { status: 400 });
    }

    const identifier = rawIdentifier.trim().toLowerCase();
    const { data: emailAccount, error: emailError } = await supabaseServer
      .from("tbl_auth")
      .select("email, password")
      .eq("email", identifier)
      .maybeSingle();

    if (emailError) {
      console.error("Login lookup error:", emailError);
      return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
    }

    let account = emailAccount;
    if (!account) {
      const { data: usernameAccounts, error: usernameError } = await supabaseServer
        .from("tbl_auth")
        .select("email, password")
        .eq("username", identifier)
        .limit(2);

      if (usernameError) {
        console.error("Login username lookup error:", usernameError);
        return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
      }
      const matchingAccounts = usernameAccounts ?? [];
      if (matchingAccounts.length > 1) {
        return NextResponse.json(
          { success: false, error: "That username belongs to multiple accounts. Sign in with your email instead." },
          { status: 409 }
        );
      }
      account = matchingAccounts[0] ?? null;
    }

    if (!account) {
      const error = identifier.includes("@") ? "Email does not exist" : "Username does not exist";
      return NextResponse.json({ success: false, error }, { status: 404 });
    }

    if (!(await bcrypt.compare(password, account.password))) {
      return NextResponse.json({ success: false, error: "Password is incorrect" }, { status: 401 });
    }

    const session = await auth_jwt(account.email);
    if (!session || session.error) {
      return NextResponse.json({ success: false, error: "Could not start your session" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
