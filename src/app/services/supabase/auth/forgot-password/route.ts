import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib";
import { rateLimit } from "@/firewall";

const genericResponse = {
  success: true,
  message: "If an account exists for that email, a password reset link will be sent.",
};

export async function POST(request: NextRequest) {
  const rate = rateLimit(request, { windowMs: 60_000, max: 5, keyPrefix: "Forgot_password" });
  if (!rate.allowed) {
    const retryAfterSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("email" in body) || typeof body.email !== "string") {
      return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
    }

    const gmailAddress = process.env.GMAIL_EMAIL || process.env.NEXT_PUBLIC_EMAIL;
    const gmailAppPassword = process.env.APP_PASSWORD?.replace(/\s/g, "");
    const jwtSecret = process.env.JWT_SECRET;
    const configuredAppUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    const requestHost = request.nextUrl.hostname.toLowerCase();
    const isLocalRequest = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(requestHost);
    // Local testing should stay on the exact localhost host and port, even when APP_URL points to production.
    // Public deployments use an explicit trusted URL rather than the request Host header.
    const appUrl = isLocalRequest || process.env.NODE_ENV === "development"
      ? request.nextUrl.origin
      : configuredAppUrl || "";

    if (!gmailAddress || !gmailAppPassword || !jwtSecret || !appUrl) {
      return NextResponse.json({ success: false, error: "Password reset email is not configured on the server." }, { status: 500 });
    }

    const resetOrigin = new URL(appUrl);
    if (!isLocalRequest && process.env.NODE_ENV === "production" && resetOrigin.protocol !== "https:") {
      return NextResponse.json({ success: false, error: "Password reset URL must use HTTPS." }, { status: 500 });
    }

    const { data: account, error: accountError } = await supabaseServer
      .from("tbl_auth")
      .select("email, password")
      .eq("email", email)
      .maybeSingle();

    if (accountError) {
      return NextResponse.json({ success: false, error: "Could not process your request. Please try again." }, { status: 500 });
    }
    if (!account) return NextResponse.json(genericResponse);

    const passwordVersion = createHash("sha256").update(account.password).digest("hex");
    const token = jwt.sign(
      { sub: account.email, purpose: "password-reset", passwordVersion },
      jwtSecret,
      { expiresIn: "20m", issuer: "otterpie", audience: "password-reset" }
    );

    const resetUrl = new URL("/auth/reset-password", resetOrigin);
    resetUrl.searchParams.set("token", token);

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: gmailAddress, pass: gmailAppPassword },
    });

    try {
      await transporter.sendMail({
        from: `Otterpie <${gmailAddress}>`,
        to: account.email,
        subject: "Reset your Otterpie password",
        text: `Use this link to reset your Otterpie password. It expires in 20 minutes.\n\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`,
        html: `<div><h1>Reset your Otterpie password</h1><p>Use the button below to choose a new password. This link expires in 20 minutes.</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
      });
    } catch (mailError) {
      // Do not reveal whether the address exists or log mail credentials or reset tokens.
      console.error("Password reset email delivery failed:", mailError instanceof Error ? mailError.name : "UnknownError");
    }

    return NextResponse.json(genericResponse);
  } catch {
    return NextResponse.json({ success: false, error: "Could not process your request. Please try again." }, { status: 500 });
  }
}
