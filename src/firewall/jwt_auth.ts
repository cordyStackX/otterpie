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

  const { data, error } = await supabaseServer
  .from("tbl_wallet")
  .select("network, email, username, wallet_address")
  .eq("email", email)
  .maybeSingle();

  if (error) {
    return console.error("Supabase Query Error: ", error);
  }

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
