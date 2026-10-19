import { NextRequest, NextResponse } from "next/server";
import { JsonRpcProvider, formatEther, isAddress } from "ethers"; // ethers v6
import { Security } from "@/firewall";
import { supabaseServer } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read a fresh balance

const BOT_CHAIN_ID = 677;

// Public BOT Chain mainnet RPC. Optionally override it in .env.local with
// BOT_CHAIN_RPC_URL (server-only, no NEXT_PUBLIC_ prefix) if you get a private
// endpoint or run your own node later.
const BOT_CHAIN_RPC_URL = process.env.BOT_CHAIN_RPC_URL || "https://rpc.botchain.ai";

// staticNetwork skips the extra "which chain are you?" call on every request
const provider = new JsonRpcProvider(BOT_CHAIN_RPC_URL, BOT_CHAIN_ID, {
  staticNetwork: true,
});

export async function POST(params: NextRequest) {
  const auth = await Security(params);
  if (auth?.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await params.json();

  // Reading a balance only needs the PUBLIC address, so the private key is
  // never selected, decrypted or held in memory here.
  const { data, error } = await supabaseServer
    .from("tbl_wallet")
    .select("wallet_address")
    .eq("email", email)
    // TODO: if this table holds both networks, filter by your network/chain column too
    // .eq("network", "bot_chain")
    .maybeSingle();

  if (error) {
    console.error("Supabase Query Error: ", error);
    return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
  }

  const address = data?.wallet_address;
  if (!address) {
    return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 404 });
  }

  if (!isAddress(address)) {
    console.error("Stored BOT Chain address is invalid");
    return NextResponse.json({ success: false, error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const wei = await provider.getBalance(address); // bigint, in wei
    const balance = formatEther(wei); // string like "1.2345"

    // Same shape as the Stellar route so the dashboard can treat both alike
    return NextResponse.json({
      success: true,
      funded: wei > BigInt(0),
      address,
      balances: [{ asset: "BOT", issuer: null, balance }],
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: "Could not reach BOT Chain" }, { status: 502 });
  }
}