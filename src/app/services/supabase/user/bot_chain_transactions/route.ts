import { NextRequest, NextResponse } from "next/server";
import { formatEther, isAddress } from "ethers"; // ethers v6
import { Security } from "@/firewall";
import { supabaseServer } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read fresh transactions

// A plain RPC node cannot list the transactions of one address, so this reads
// them from the BOT Chain block explorer's Etherscan-style API:
//   <base>?module=account&action=txlist&address=0x...
// Override the base in .env.local with BOT_CHAIN_EXPLORER_API_URL if needed.
const EXPLORER_API_URL =
  process.env.BOT_CHAIN_EXPLORER_API_URL || "https://scan.botchain.ai/api";

const MAX_RESULTS = 1000; // newest 1,000 transactions is plenty for 12 months
const HISTORY_MONTHS = 12; // the dashboard shows up to 12 months

type Incoming = {
  id: string;
  date: string; // ISO timestamp
  amount: string;
  asset: string;
  from: string | null;
  to: string | null;
  direction: "received" | "sent";
  type: string;
  status: "Completed" | "Failed";
};

type ExplorerTx = {
  hash: string;
  from: string;
  to: string;
  value: string; // wei
  timeStamp: string; // unix seconds
  isError?: string; // "0" = success
};

export async function POST(params: NextRequest) {
  const auth = await Security(params);
  if (auth?.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await params.json();

  // Only the PUBLIC address is needed, so the private key is never selected.
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

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - HISTORY_MONTHS);

  try {
    const url = new URL(EXPLORER_API_URL);
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "txlist");
    url.searchParams.set("address", address);
    url.searchParams.set("sort", "desc");
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", String(MAX_RESULTS));

    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error("BOT Chain explorer returned", res.status);
      return NextResponse.json({ success: false, error: "Could not reach BOT Chain" }, { status: 502 });
    }

    const body = (await res.json()) as {
      status?: string;
      message?: string;
      result?: ExplorerTx[] | string;
    };

    // Etherscan-style APIs answer "No transactions found" with status "0" and
    // an empty list. That is a valid empty wallet, not an error.
    const list = Array.isArray(body.result) ? body.result : [];
    if (!Array.isArray(body.result) && body.status !== "0") {
      console.error("Unexpected explorer response", body);
      return NextResponse.json({ success: false, error: "Could not reach BOT Chain" }, { status: 502 });
    }

    const me = address.toLowerCase();
    const transactions: Incoming[] = [];

    for (const t of list) {
      const date = new Date(Number(t.timeStamp) * 1000);
      if (date < cutoff) continue;

      const received = t.to?.toLowerCase() === me;
      const sent = t.from?.toLowerCase() === me;
      const succeeded = t.isError === undefined || t.isError === "0";
      const hasValue = t.value !== "0" && t.value !== "";

      if ((received || sent) && hasValue) {
        transactions.push({
          id: t.hash,
          date: date.toISOString(),
          amount: formatEther(BigInt(t.value)),
          asset: "BOT",
          from: t.from ?? null,
          to: t.to ?? null,
          direction: received ? "received" : "sent",
          type: "transfer",
          status: succeeded ? "Completed" : "Failed",
        });
      }
    }

    return NextResponse.json({
      success: true,
      funded: transactions.length > 0,
      address,
      transactions,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: "Could not reach BOT Chain" }, { status: 502 });
  }
}
