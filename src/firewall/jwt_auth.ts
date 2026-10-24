"use server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib";

export default async function auth_jwt(email: string) {

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not set");
    return { error: true, message: "Server misconfigured" };
  }

  const { data: wallet, error } = await supabaseServer
  .from("tbl_wallet")
  .select("network, email, username, wallet_address")
  .eq("email", email)
  .maybeSingle();

  if (error) {
    console.error("Supabase Query Error: ", error);
    return { error: true, message: "Could not load wallet" };
  }

  const { data: authAccount, error: authError } = await supabaseServer
    .from("tbl_auth")
    .select("status")
    .eq("email", email)
    .maybeSingle();

  if (authError) {
    console.error("Supabase auth status query error:", authError);
    return { error: true, message: "Could not load account network" };
  }

  // tbl_wallet stays on `stellar`; status selects which Stellar ledger this
  // session uses. Missing status keeps existing accounts on Mainnet.
  const data = wallet ? {
    ...wallet,
    network: wallet.network === "stellar"
      ? (authAccount?.status === 0 ? "stellar_testnet" : "stellar")
      : wallet.network,
  } : wallet;
  const token = jwt.sign({ data }, secret, { expiresIn: "7d" });

  const cookieStore = await cookies();
  cookieStore.set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
  });

  return { error: false, email };
}
