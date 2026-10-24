import { StrKey } from "@stellar/stellar-sdk";
import { NextRequest, NextResponse } from "next/server";
import { Security } from "@/firewall";
import { supabaseServer } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  if (!auth || auth.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
  const network = "network" in auth ? auth.network : undefined;
  if (!email) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (network !== "stellar_testnet") {
    return NextResponse.json({ success: false, error: "Switch to Stellar Testnet before requesting test funds." }, { status: 400 });
  }

  const { data: wallet, error } = await supabaseServer
    .from("tbl_wallet")
    .select("wallet_address")
    .eq("email", email)
    .eq("network", "stellar")
    .maybeSingle();

  if (error) {
    console.error("Could not load Stellar wallet for Friendbot:", error);
    return NextResponse.json({ success: false, error: "Could not load your Stellar wallet." }, { status: 500 });
  }
  const address = wallet?.wallet_address;
  if (!address || !StrKey.isValidEd25519PublicKey(address)) {
    return NextResponse.json({ success: false, error: "Your Stellar wallet address is invalid." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const friendbotUrl = new URL("https://friendbot.stellar.org/");
    friendbotUrl.searchParams.set("addr", address);
    const friendbotResponse = await fetch(friendbotUrl, { signal: controller.signal });
    const body = await friendbotResponse.text();
    if (!friendbotResponse.ok) {
      let detail = body;
      try {
        const parsed = JSON.parse(body) as { detail?: string; error?: string; title?: string };
        detail = parsed.detail || parsed.error || parsed.title || body;
      } catch {
        // Friendbot may return plain text for error responses.
      }
      return NextResponse.json({ success: false, error: detail || `Friendbot returned ${friendbotResponse.status}.` }, { status: 502 });
    }

    return NextResponse.json({ success: true, address, message: "Friendbot funded the Stellar Testnet account." });
  } catch (error) {
    console.error("Friendbot request failed:", error);
    return NextResponse.json({ success: false, error: "Could not reach Friendbot. Please try again." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
