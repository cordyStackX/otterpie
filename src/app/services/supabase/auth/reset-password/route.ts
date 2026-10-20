import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import jwt, { type JwtPayload } from "jsonwebtoken";
import bcrypt from "bcrypt";
import { supabaseServer } from "@/lib";
import { rateLimit } from "@/firewall";

type ResetTokenPayload = JwtPayload & {
  purpose?: unknown;
  passwordVersion?: unknown;
};

export async function POST(request: NextRequest) {
  const rate = rateLimit(request, { windowMs: 60_000, max: 10, keyPrefix: "Reset_password" });
  if (!rate.allowed) {
    const retryAfterSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { success: false, error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  try {
    const body: unknown = await request.json();
    if (
      !body || typeof body !== "object" ||
      !("token" in body) || typeof body.token !== "string" || !body.token ||
      !("password" in body) || typeof body.password !== "string"
    ) {
      return NextResponse.json({ success: false, error: "This reset link is invalid or expired." }, { status: 400 });
    }
    if (body.password.length <= 8) {
      return NextResponse.json({ success: false, error: "Password must be more than 8 characters." }, { status: 400 });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json({ success: false, error: "Could not reset your password. Please try again." }, { status: 500 });
    }

    let payload: ResetTokenPayload;
    try {
      payload = jwt.verify(body.token, jwtSecret, {
        issuer: "otterpie",
        audience: "password-reset",
      }) as ResetTokenPayload;
    } catch {
      return NextResponse.json({ success: false, error: "This reset link is invalid or expired." }, { status: 400 });
    }

    const email = typeof payload.sub === "string" ? payload.sub : "";
    if (!email || payload.purpose !== "password-reset" || typeof payload.passwordVersion !== "string") {
      return NextResponse.json({ success: false, error: "This reset link is invalid or expired." }, { status: 400 });
    }

    const { data: account, error: accountError } = await supabaseServer
      .from("tbl_auth")
      .select("email, password")
      .eq("email", email)
      .maybeSingle();

    if (accountError) {
      return NextResponse.json({ success: false, error: "Could not reset your password. Please try again." }, { status: 500 });
    }
    if (!account) {
      return NextResponse.json({ success: false, error: "This reset link is invalid or expired." }, { status: 400 });
    }

    const currentPasswordVersion = createHash("sha256").update(account.password).digest("hex");
    if (currentPasswordVersion !== payload.passwordVersion) {
      return NextResponse.json({ success: false, error: "This reset link has already been used or expired." }, { status: 400 });
    }

    const newPasswordHash = await bcrypt.hash(body.password, 10);
    const { data: updatedAccount, error: updateError } = await supabaseServer
      .from("tbl_auth")
      .update({ password: newPasswordHash })
      .eq("email", email)
      .eq("password", account.password)
      .select("email")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ success: false, error: "Could not reset your password. Please try again." }, { status: 500 });
    }
    if (!updatedAccount) {
      return NextResponse.json({ success: false, error: "This reset link has already been used or expired." }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Your password has been reset. You can now sign in." });
  } catch {
    return NextResponse.json({ success: false, error: "Could not reset your password. Please try again." }, { status: 500 });
  }
}
