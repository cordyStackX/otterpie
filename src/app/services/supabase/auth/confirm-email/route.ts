import { NextRequest, NextResponse } from "next/server";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { supabaseServer } from "@/lib";
import { rateLimit } from "@/firewall";

type ConfirmationPayload = JwtPayload & { purpose?: unknown };

function resultRedirect(request: NextRequest, status: string) {
  const requestHost = request.nextUrl.hostname.toLowerCase();
  const isLocalRequest = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(requestHost);
  const configuredAppUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const appUrl = isLocalRequest || process.env.NODE_ENV === "development"
    ? request.nextUrl.origin
    : configuredAppUrl;

  if (!appUrl) {
    return NextResponse.json({ success: false, error: "Email confirmation could not be completed." }, { status: 500 });
  }

  const destination = new URL("/auth/email-confirmed", appUrl);
  destination.searchParams.set("status", status);
  return NextResponse.redirect(destination);
}

export async function GET(request: NextRequest) {
  const rate = rateLimit(request, { windowMs: 60_000, max: 20, keyPrefix: "Confirm_email" });
  if (!rate.allowed) {
    return resultRedirect(request, "try-again");
  }

  const token = request.nextUrl.searchParams.get("token");
  const jwtSecret = process.env.JWT_SECRET;
  if (!token || !jwtSecret) return resultRedirect(request, "invalid");

  let payload: ConfirmationPayload;
  try {
    payload = jwt.verify(token, jwtSecret, {
      issuer: "otterpie",
      audience: "email-confirmation",
    }) as ConfirmationPayload;
  } catch {
    return resultRedirect(request, "invalid");
  }

  const email = typeof payload.sub === "string" ? payload.sub : "";
  if (!email || payload.purpose !== "email-confirmation") return resultRedirect(request, "invalid");

  const { data: account, error: accountError } = await supabaseServer
    .from("tbl_auth")
    .select("email, confirm_email")
    .eq("email", email)
    .maybeSingle();

  if (accountError || !account) return resultRedirect(request, "invalid");
  if (Number(account.confirm_email) === 1) return resultRedirect(request, "already-confirmed");

  const { data: confirmedAccount, error: confirmError } = await supabaseServer
    .from("tbl_auth")
    .update({ confirm_email: 1 })
    .eq("email", email)
    .eq("confirm_email", 0)
    .select("email")
    .maybeSingle();

  if (confirmError) return resultRedirect(request, "try-again");
  if (!confirmedAccount) {
    const { data: latestAccount } = await supabaseServer
      .from("tbl_auth")
      .select("confirm_email")
      .eq("email", email)
      .maybeSingle();

    if (Number(latestAccount?.confirm_email) === 1) return resultRedirect(request, "already-confirmed");
    return resultRedirect(request, "try-again");
  }

  return resultRedirect(request, "success");
}
