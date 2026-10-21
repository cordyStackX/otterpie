import { NextRequest, NextResponse } from "next/server";
import { Horizon, StrKey } from "@stellar/stellar-sdk";
import { Security } from "@/firewall";
import { supabaseServer } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read fresh transactions

const server = new Horizon.Server(
  process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org"
);

const PAGE_SIZE = 200; // Horizon's max per page
const MAX_PAGES = 5; // safety cap: at most 1,000 operations per request
const HISTORY_MONTHS = 12; // the dashboard shows up to 12 months

type Incoming = {
  id: string;
  hash: string;
  date: string; // ISO timestamp
  amount: string;
  asset: string; // "XLM" or the asset code
  from: string | null;
  to: string | null;
  direction: "received" | "sent";
  type: string;
  status: "Completed";
};

export async function POST(params: NextRequest) {
  const auth = await Security(params);
  if (auth?.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await params.json();

  // Only the PUBLIC address is needed, so the secret key is never selected.
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

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - HISTORY_MONTHS);

  try {
    const transactions: Incoming[] = [];

    let page = await server
      .payments()
      .forAccount(address)
      .order("desc")
      .limit(PAGE_SIZE)
      .call();

    for (let i = 0; i < MAX_PAGES; i++) {
      for (const rec of page.records) {
        const r = rec as unknown as Record<string, string>;

        // First funding of the account
        if (r.type === "create_account" && r.account === address) {
          transactions.push({
            id: r.id,
            hash: r.transaction_hash ?? r.id,
            date: r.created_at,
            amount: r.starting_balance,
            asset: "XLM",
            from: r.funder ?? null,
            to: address,
            direction: "received",
            type: r.type,
            status: "Completed",
          });
          continue;
        }

        // Payments to or from this wallet (plain payment or path payment).
        const isPayment =
          r.type === "payment" ||
          r.type === "path_payment_strict_send" ||
          r.type === "path_payment_strict_receive";

        if (isPayment && (r.to === address || r.from === address)) {
          transactions.push({
            id: r.id,
            hash: r.transaction_hash ?? r.id,
            date: r.created_at,
            amount: r.amount,
            asset: r.asset_type === "native" ? "XLM" : r.asset_code,
            from: r.from ?? null,
            to: r.to ?? null,
            direction: r.to === address ? "received" : "sent",
            type: r.type,
            status: "Completed",
          });
        }
      }

      const last = page.records[page.records.length - 1];
      const reachedCutoff = !last || new Date(last.created_at) < cutoff;
      if (reachedCutoff || page.records.length < PAGE_SIZE) break;

      page = await page.next();
    }

    return NextResponse.json({ success: true, funded: true, address, transactions });
  } catch (e) {
    // Horizon returns 404 for an address that was never funded on this network
    if ((e as { response?: { status?: number } })?.response?.status === 404) {
      return NextResponse.json({ success: true, funded: false, address, transactions: [] });
    }

    console.error(e);
    return NextResponse.json({ success: false, error: "Could not reach the Stellar network" }, { status: 502 });
  }
}
