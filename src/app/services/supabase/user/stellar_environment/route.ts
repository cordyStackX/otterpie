import { NextRequest, NextResponse } from "next/server";
import { auth_jwt, Security } from "@/firewall";
import { supabaseServer } from "@/lib";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  if (!auth || auth.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let environment: unknown;
  try {
    environment = (await request.json())?.environment;
  } catch {
    return NextResponse.json({ success: false, error: "Choose Mainnet or Testnet." }, { status: 400 });
  }
  if (environment !== "mainnet" && environment !== "testnet") {
    return NextResponse.json({ success: false, error: "Choose Mainnet or Testnet." }, { status: 400 });
  }

  const { data: wallet, error: walletError } = await supabaseServer
    .from("tbl_wallet")
    .select("email")
    .eq("email", email)
    .eq("network", "stellar")
    .maybeSingle();

  if (walletError) {
    console.error("Could not verify Stellar wallet:", walletError);
    return NextResponse.json({ success: false, error: "Could not verify your Stellar wallet." }, { status: 500 });
  }
  if (!wallet) {
    return NextResponse.json({ success: false, error: "This account has no Stellar wallet." }, { status: 404 });
  }

  const { error: updateError } = await supabaseServer
    .from("tbl_auth")
    .update({ status: environment === "mainnet" ? 1 : 0 })
    .eq("email", email);

  if (updateError) {
    console.error("Could not update Stellar environment:", updateError);
    return NextResponse.json({ success: false, error: "Could not save the Stellar network setting." }, { status: 500 });
  }

  const session = await auth_jwt(email);
  if (session?.error) {
    return NextResponse.json({ success: false, error: "Network saved, but the session could not be refreshed. Please sign in again." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    network: environment === "testnet" ? "stellar_testnet" : "stellar",
  });
}
