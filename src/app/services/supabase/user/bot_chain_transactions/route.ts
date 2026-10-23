import { NextRequest, NextResponse } from "next/server";
import { formatEther, formatUnits, isAddress } from "ethers"; // ethers v6
import { Security } from "@/firewall";
import { BOT_CHAIN_PIE_TOKEN_ADDRESS, supabaseServer } from "@/lib";
import { isBotChainNetwork } from "@/utilities/network";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read fresh transactions

// A plain RPC node cannot list the transactions of one address, so this reads
// them from the BOT Chain block explorer's Etherscan-style API:
//   <base>?module=account&action=txlist&address=0x...
// Override the base in .env.local with BOT_CHAIN_EXPLORER_API_URL if needed.
const botChainConfig = walletNetworks.bot_chain;
const EXPLORER_API_URL = process.env.BOT_CHAIN_EXPLORER_API_URL || botChainConfig.explorer.apiUrl;
const BDEX_V2_ROUTER = botChainConfig.swapConfig.routerAddress;
const BOT_CHAIN_USDT_TOKEN_ADDRESS = botChainConfig.bridge.usdtToken;
const BOT_CHAIN_BRIDGE_ROUTER = botChainConfig.bridge.router;

const EXPLORER_PAGE_SIZE = 50;
const MAX_EXPLORER_PAGES = 5; // cap work per request while searching for 10 transfers
const TRANSACTION_PAGE_SIZE = 10;

type Incoming = {
  id: string;
  hash?: string;
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

type TokenTransfer = {
  block_number: number;
  log_index: number;
  timestamp: string;
  transaction_hash: string;
  from: { hash: string };
  to: { hash: string };
  total: { value: string; decimals?: string | null };
  token: { address?: string; address_hash?: string; decimals?: string | null };
};

function decodePageCursor(cursor: unknown): Record<string, string> | null {
  if (typeof cursor !== "string") return null;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return null;
    return Object.fromEntries(
      Object.entries(decoded).filter((entry): entry is [string, string | number] =>
        typeof entry[1] === "string" || typeof entry[1] === "number"
      ).map(([key, value]) => [key, String(value)])
    );
  } catch {
    return null;
  }
}

export async function POST(params: NextRequest) {
  const auth = await Security(params);
  if (auth?.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { email, cursor, asset } = await params.json();

  // Only the PUBLIC address is needed, so the private key is never selected.
  const { data, error } = await supabaseServer
    .from("tbl_wallet")
    .select("wallet_address, network")
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

  if ((asset === "PIE" || asset === "USDT") && isBotChainNetwork(data.network)) {
    try {
      const tokenAddress = asset === "PIE" ? BOT_CHAIN_PIE_TOKEN_ADDRESS : BOT_CHAIN_USDT_TOKEN_ADDRESS;
      const explorerOrigin = new URL(EXPLORER_API_URL).origin;
      const url = new URL(
        `/api/v2/addresses/${address}/token-transfers`,
        explorerOrigin,
      );
      url.searchParams.set("type", "ERC-20");
      url.searchParams.set("token", tokenAddress);
      for (const [key, value] of Object.entries(decodePageCursor(cursor) ?? {})) {
        url.searchParams.set(key, value);
      }

      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      // A fresh wallet may not be indexed yet. Show an empty token history
      // until the explorer indexes its first transfer.
      if (response.status !== 404 && !response.ok) {
        console.error("BOT Chain token-transfer API returned", response.status);
        return NextResponse.json({ success: false, error: "Could not reach BOT Chain" }, { status: 502 });
      }

      const body = response.status === 404
        ? null
        : (await response.json()) as {
            items?: TokenTransfer[];
            next_page_params?: Record<string, string | number> | null;
          };
      if (body && !Array.isArray(body.items)) {
        console.error("Unexpected BOT Chain token-transfer response");
        return NextResponse.json({ success: false, error: `Could not read ${asset} transfers` }, { status: 502 });
      }

      const me = address.toLowerCase();
      const zeroAddress = "0x0000000000000000000000000000000000000000";
      const transactions: Incoming[] = (body?.items ?? [])
        .filter((transfer) =>
          (transfer.token?.address_hash ?? transfer.token?.address)?.toLowerCase() === tokenAddress.toLowerCase()
        )
        .map((transfer) => {
          const from = transfer.from?.hash ?? null;
          const to = transfer.to?.hash ?? null;
          const received = to?.toLowerCase() === me;
          const bridgeMint = asset === "USDT" && received && from?.toLowerCase() === zeroAddress;
          const decimals = Number(transfer.total?.decimals ?? transfer.token?.decimals ?? 18);
          const date = new Date(transfer.timestamp);
          return {
            id: `${transfer.transaction_hash}-${transfer.log_index}`,
            hash: transfer.transaction_hash,
            date: date.toISOString(),
            amount: formatUnits(BigInt(transfer.total.value), decimals),
            asset,
            from,
            to,
            direction: received ? "received" : "sent",
            type: bridgeMint ? "bridge_transfer" : "transfer",
            status: "Completed",
          };
        });
      const nextCursor = body?.next_page_params && Object.keys(body.next_page_params).length > 0
        ? Buffer.from(JSON.stringify(body.next_page_params)).toString("base64url")
        : null;

      return NextResponse.json({
        success: true,
        funded: transactions.length > 0,
        address,
        asset,
        transactions,
        nextCursor,
        hasMore: nextCursor !== null,
      });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ success: false, error: "Could not reach BOT Chain" }, { status: 502 });
    }
  }

  try {
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
        const received = t.to?.toLowerCase() === me;
        const sent = t.from?.toLowerCase() === me;
        const succeeded = t.isError === undefined || t.isError === "0";
        const hasValue = t.value !== "0" && t.value !== "";
        const isBDEXRouterCall = sent && t.to?.toLowerCase() === BDEX_V2_ROUTER;
        const isBridgeRouterCall = sent && t.to?.toLowerCase() === BOT_CHAIN_BRIDGE_ROUTER.toLowerCase();

        if ((received || sent) && (hasValue || isBDEXRouterCall || isBridgeRouterCall)) {
          transactions.push({
            id: t.hash,
            hash: t.hash,
            date: date.toISOString(),
            amount: formatEther(BigInt(t.value)),
            asset: "BOT",
            from: t.from ?? null,
            to: t.to ?? null,
            direction: received ? "received" : "sent",
            // The UI pairs router calls with their token transfer logs by hash.
            type: isBDEXRouterCall ? "swap_candidate" : isBridgeRouterCall ? "bridge_candidate" : "transfer",
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
      asset: "BOT",
      transactions,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: "Could not reach BOT Chain" }, { status: 502 });
  }
}
