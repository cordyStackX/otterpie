import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import type { NextRequest } from "next/server";

export async function sendEmailConfirmation(email: string, request: NextRequest) {
  const gmailAddress = process.env.GMAIL_EMAIL || process.env.NEXT_PUBLIC_EMAIL;
  const gmailAppPassword = process.env.APP_PASSWORD?.replace(/\s/g, "");
  const jwtSecret = process.env.JWT_SECRET;
  const configuredAppUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const requestHost = request.nextUrl.hostname.toLowerCase();
  const isLocalRequest = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(requestHost);
  const appUrl = isLocalRequest || process.env.NODE_ENV === "development"
    ? request.nextUrl.origin
    : configuredAppUrl || "";

  if (!gmailAddress || !gmailAppPassword || !jwtSecret || !appUrl) {
    throw new Error("EmailConfirmationNotConfigured");
  }

  const confirmationOrigin = new URL(appUrl);
  if (!isLocalRequest && process.env.NODE_ENV === "production" && confirmationOrigin.protocol !== "https:") {
    throw new Error("EmailConfirmationRequiresHttps");
  }

  const token = jwt.sign(
    { sub: email, purpose: "email-confirmation", nonce: randomUUID() },
    jwtSecret,
    { expiresIn: "24h", issuer: "otterpie", audience: "email-confirmation" }
  );
  const confirmationUrl = new URL("/services/supabase/auth/confirm-email", confirmationOrigin);
  confirmationUrl.searchParams.set("token", token);

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: gmailAddress, pass: gmailAppPassword },
  });
  await transporter.sendMail({
    from: `Otterpie <${gmailAddress}>`,
    to: email,
    subject: "Confirm your Otterpie email",
    text: `Welcome to Otterpie. Confirm your email using this link within 24 hours:\n\n${confirmationUrl.toString()}\n\nIf you did not create this account, you can ignore this email.`,
    html: `<div><h1>Welcome to Otterpie</h1><p>Confirm your email address to finish setting up your account. This link expires in 24 hours.</p><p><a href="${confirmationUrl.toString()}">Confirm email</a></p><p>If you did not create this account, you can ignore this email.</p></div>`,
  });
}
