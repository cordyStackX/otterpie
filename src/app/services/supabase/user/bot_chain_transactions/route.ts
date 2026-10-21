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

const EXPLORER_PAGE_SIZE = 50;
const MAX_EXPLORER_PAGES = 5; // cap work per request while searching for 10 transfers
const TRANSACTION_PAGE_SIZE = 10;
const HISTORY_MONTHS = 12;

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

  const { email, cursor } = await params.json();

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

  try {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - HISTORY_MONTHS);
    const me = address.toLowerCase();
    const transactions: Incoming[] = [];
    const parsedCursor = typeof cursor === "string" && /^\d+:\d+$/.test(cursor)
      ? cursor.split(":").map(Number)
      : [1, 0];
    const [parsedPage, parsedIndex] = parsedCursor;
    const cursorIsValid = Number.isSafeInteger(parsedPage) && parsedPage >= 1 &&
      Number.isSafeInteger(parsedIndex) && parsedIndex >= 0 && parsedIndex < EXPLORER_PAGE_SIZE;
    const cursorPage = cursorIsValid ? parsedPage : 1;
    const cursorIndex = cursorIsValid ? parsedIndex : 0;
    let explorerPage = cursorPage;
    let startIndex = cursorIndex;
    let nextCursor: string | null = null;
    let hasMore = false;
    let reachedCutoff = false;

    for (let requestIndex = 0; requestIndex < MAX_EXPLORER_PAGES; requestIndex++) {
      const url = new URL(EXPLORER_API_URL);
      url.searchParams.set("module", "account");
      url.searchParams.set("action", "txlist");
      url.searchParams.set("address", address);
      url.searchParams.set("sort", "desc");
      url.searchParams.set("page", String(explorerPage));
      url.searchParams.set("offset", String(EXPLORER_PAGE_SIZE));

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
      const list = Array.isArray(body.result) ? body.result : [];
      if (!Array.isArray(body.result) && body.status !== "0") {
        console.error("Unexpected explorer response", body);
        return NextResponse.json({ success: false, error: "Could not reach BOT Chain" }, { status: 502 });
      }

      if (list.length === 0) break;

      for (let index = startIndex; index < list.length; index++) {
        const t = list[index];
        const date = new Date(Number(t.timeStamp) * 1000);
        if (date < cutoff) {
          reachedCutoff = true;
          break;
        }
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

        const hasRemainingInPage = index < list.length - 1;
        const nextPageExists = hasRemainingInPage || list.length === EXPLORER_PAGE_SIZE;
        nextCursor = hasRemainingInPage
          ? `${explorerPage}:${index + 1}`
          : nextPageExists ? `${explorerPage + 1}:0` : null;

        if (transactions.length >= TRANSACTION_PAGE_SIZE) {
          hasMore = nextPageExists;
          break;
        }
      }

      if (transactions.length >= TRANSACTION_PAGE_SIZE) break;
      if (reachedCutoff) {
        nextCursor = null;
        hasMore = false;
        break;
      }
      if (list.length < EXPLORER_PAGE_SIZE) {
        nextCursor = null;
        hasMore = false;
        break;
      }

      explorerPage += 1;
      startIndex = 0;
      nextCursor = `${explorerPage}:0`;
      hasMore = true;
    }

    return NextResponse.json({
      success: true,
      funded: transactions.length > 0,
      address,
      transactions,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: "Could not reach BOT Chain" }, { status: 502 });
  }
}
