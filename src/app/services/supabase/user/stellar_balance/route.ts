import { NextRequest, NextResponse } from "next/server";
import { Horizon, StrKey } from "@stellar/stellar-sdk";
import { Security } from "@/firewall";
import { supabaseServer } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read a fresh balance

const server = new Horizon.Server(
  process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org"
);

export async function POST(params: NextRequest) {
  const auth = await Security(params);
  if (auth?.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await params.json();

  // Reading a balance only needs the PUBLIC address, so the secret key is
  // never selected, decrypted or held in memory here.
  const { data, error } = await supabaseServer
    .from("tbl_wallet")
    .select("wallet_address")
    .eq("email", email)
    // TODO: if this table holds both networks, filter by your network/chain column too
    // .eq("network", "stellar")
    .maybeSingle();

  if (error) {
    console.error("Supabase Query Error: ", error);
    return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
  }

  const address = data?.wallet_address;
  if (!address) {
    return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 404 });
  }

  if (!StrKey.isValidEd25519PublicKey(address)) {
    console.error("Stored Stellar address is invalid");
    return NextResponse.json({ success: false, error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const account = await server.loadAccount(address);

    const balances = account.balances.map((b) => {
      if (b.asset_type === "native") {
        return { asset: "XLM", issuer: null, balance: b.balance };
      }
      if (b.asset_type === "liquidity_pool_shares") {
        return { asset: `pool:${b.liquidity_pool_id}`, issuer: null, balance: b.balance };
      }
      return { asset: b.asset_code, issuer: b.asset_issuer, balance: b.balance };
    });

    return NextResponse.json({ success: true, funded: true, address, balances });
  } catch (e) {
    // Horizon returns 404 for an address that was never funded on this network
    if ((e as { response?: { status?: number } })?.response?.status === 404) {
      return NextResponse.json({ success: true, funded: false, address, balances: [] });
    }

    console.error(e);
    return NextResponse.json({ success: false, error: "Could not reach the Stellar network" }, { status: 502 });
  }
}