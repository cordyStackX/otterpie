import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, sendEmailConfirmation } from "@/lib";
import { rateLimit } from "@/firewall";

const genericResponse = {
  success: true,
  message: "If an unconfirmed account matches, a new confirmation link will be sent.",
};

export async function POST(request: NextRequest) {
  const rate = rateLimit(request, { windowMs: 60_000, max: 3, keyPrefix: "Resend_confirmation" });
  if (!rate.allowed) {
    const retryAfterSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("identifier" in body) || typeof body.identifier !== "string") {
      return NextResponse.json({ success: false, error: "Enter your email or username." }, { status: 400 });
    }

    const identifier = body.identifier.trim().toLowerCase();
    if (!identifier || identifier.length > 254) {
      return NextResponse.json({ success: false, error: "Enter your email or username." }, { status: 400 });
    }

    let account: { email: string; confirm_email: number | string | null } | null = null;
    if (identifier.includes("@")) {
      const { data, error } = await supabaseServer
        .from("tbl_auth")
        .select("email, confirm_email")
        .eq("email", identifier)
        .maybeSingle();
      if (error) return NextResponse.json({ success: false, error: "Could not process your request." }, { status: 500 });
      account = data;
    } else {
      const { data, error } = await supabaseServer
        .from("tbl_auth")
        .select("email, confirm_email")
        .eq("username", identifier)
        .limit(2);
      if (error) return NextResponse.json({ success: false, error: "Could not process your request." }, { status: 500 });
      if (data?.length === 1) account = data[0];
    }

    if (account && (account.confirm_email === 0 || account.confirm_email === "0")) {
      try {
        await sendEmailConfirmation(account.email, request);
      } catch (mailError) {
        console.error("Confirmation email resend failed:", mailError instanceof Error ? mailError.name : "UnknownError");
      }
    }

    return NextResponse.json(genericResponse);
  } catch {
    return NextResponse.json({ success: false, error: "Could not process your request." }, { status: 500 });
  }
}
