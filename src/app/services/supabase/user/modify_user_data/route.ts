import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { supabaseServer } from "@/lib";
import { auth_jwt, Security, rateLimit } from "@/firewall";

export async function PATCH(request: NextRequest) {
  const auth = await Security(request);
  if (auth?.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const rate = rateLimit(request, { windowMs: 60_0000, max: 5, keyPrefix: "Update_user" });
  if (!rate.allowed) {
    const retryAfterSeconds = Math.ceil((rate.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
  }

  try {
    const { email, hasUsername, hasStoreName, hasPassword, hasNewPassword } = await request.json();

    if (!hasUsername && !hasStoreName && !hasPassword) {
      return NextResponse.json({ success: false, error: "No account changes provided" }, { status: 400 });
    }

    let cleanUsername: string | undefined;
    if (hasUsername) {
      if (typeof hasUsername !== "string") {
        return NextResponse.json({ success: false, error: "Invalid username" }, { status: 400 });
      }
      cleanUsername = hasUsername.trim();
      if (!cleanUsername || cleanUsername.length >= 15) {
        return NextResponse.json(
          { success: false, error: "Username must be between 1 and 14 characters" },
          { status: 400 }
        );
      }
    }

    let cleanStoreName: string | undefined;
    if (hasStoreName !== undefined) {
      if (typeof hasStoreName !== "string") {
        return NextResponse.json({ success: false, error: "Invalid store name" }, { status: 400 });
      }
      cleanStoreName = hasStoreName.trim();
      if (!cleanStoreName || cleanStoreName.length > 60) {
        return NextResponse.json(
          { success: false, error: "Store name must be between 1 and 60 characters" },
          { status: 400 }
        );
      }
    }

    const accountUpdate: { username?: string; storeName?: string; password?: string } = {};
    if (cleanUsername !== undefined) accountUpdate.username = cleanUsername.toLowerCase();
    if (cleanStoreName !== undefined) accountUpdate.storeName = cleanStoreName.toLowerCase();

    if (hasPassword) {
      if (typeof hasPassword !== "string" || typeof hasNewPassword !== "string") {
        return NextResponse.json({ success: false, error: "Enter your current and new passwords" }, { status: 400 });
      }
      if (hasNewPassword.length <= 8) {
        return NextResponse.json({ success: false, error: "Password must be more than 8 characters" }, { status: 400 });
      }

      const { data: account, error: accountError } = await supabaseServer
        .from("tbl_auth")
        .select("password")
        .eq("email", email)
        .maybeSingle();

      if (accountError) {
        if (accountError.code === "23505") {
          return NextResponse.json({ success: false, error: "That username is already registered" }, { status: 409 });
        }
        console.error("Account lookup error:", accountError);
        return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
      }
      if (!account) {
        return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
      }
      if (!(await bcrypt.compare(hasNewPassword, account.password))) {
        return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 401 });
      }

      accountUpdate.password = await bcrypt.hash(hasNewPassword, 10);
    }

    const { data: updatedAccount, error: updateError } = await supabaseServer
      .from("tbl_auth")
      .update(accountUpdate)
      .eq("email", email)
      .select("email")
      .maybeSingle();

    if (updateError) {
      if (updateError.code === "23505") {
        return NextResponse.json({ success: false, error: "That username is already registered" }, { status: 409 });
      }
      console.error("Account update error:", updateError);
      return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
    }
    if (!updatedAccount) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    }

    await auth_jwt(email);
    return NextResponse.json({ success: true, message: "Account updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Account update error:", error);
    return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
  }
}
