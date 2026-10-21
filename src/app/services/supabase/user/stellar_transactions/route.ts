import { NextRequest, NextResponse } from "next/server";
import { Horizon, StrKey } from "@stellar/stellar-sdk";
import { Security } from "@/firewall";
import { supabaseServer } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read fresh transactions

const server = new Horizon.Server(
  process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org"
);

const HORIZON_PAGE_SIZE = 200; // Horizon's max per page
const MAX_HORIZON_PAGES = 5; // safety cap while finding 10 matching transactions
const TRANSACTION_PAGE_SIZE = 10;

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

  const { email, cursor } = await params.json();

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

  try {
    const transactions: Incoming[] = [];
    let operations = server
      .payments()
      .forAccount(address)
      .order("desc")
      .limit(HORIZON_PAGE_SIZE);

    const validCursor = typeof cursor === "string" && /^[\d-]{1,128}$/.test(cursor) ? cursor : null;
    if (validCursor) operations = operations.cursor(validCursor);
    let page = await operations.call();
    let nextCursor: string | null = validCursor;
    let hasMore = false;

    for (let pageIndex = 0; pageIndex < MAX_HORIZON_PAGES; pageIndex++) {
      for (let recordIndex = 0; recordIndex < page.records.length; recordIndex++) {
        const rec = page.records[recordIndex];
        const r = rec as unknown as Record<string, string>;
        nextCursor = r.paging_token ?? nextCursor;

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
          if (transactions.length >= TRANSACTION_PAGE_SIZE) {
            hasMore = recordIndex < page.records.length - 1 || page.records.length === HORIZON_PAGE_SIZE;
            break;
          }
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
          if (transactions.length >= TRANSACTION_PAGE_SIZE) {
            hasMore = recordIndex < page.records.length - 1 || page.records.length === HORIZON_PAGE_SIZE;
            break;
          }
        }
      }

      if (transactions.length >= TRANSACTION_PAGE_SIZE) break;

      const last = page.records[page.records.length - 1];
      if (!last || page.records.length < HORIZON_PAGE_SIZE) {
        hasMore = false;
        break;
      }

      page = await page.next();
      hasMore = page.records.length > 0;
    }

    return NextResponse.json({
      success: true,
      funded: true,
      address,
      transactions,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    });
  } catch (e) {
    // Horizon returns 404 for an address that was never funded on this network
    if ((e as { response?: { status?: number } })?.response?.status === 404) {
      return NextResponse.json({ success: true, funded: false, address, transactions: [], nextCursor: null, hasMore: false });
    }

    console.error(e);
    return NextResponse.json({ success: false, error: "Could not reach the Stellar network" }, { status: 502 });
  }
}
