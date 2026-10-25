"use client";

import { useState, useEffect } from "react";
import { Fetch_to } from "@/utilities";
import { getWalletNetworkConfig, walletAssetLabel, walletNetworkLabel } from "@/utilities/network";
import userRoutes from "@/routes/user.json";

type Transaction = {
  id: string;
  name: string;
  address: string;
  type: "Receive" | "Withdraw" | "Send" | "Swap" | "Bridge" | "Paiflow";
  status: "Completed" | "Pending" | "Failed";
  amount: number;
  asset: string;
  date: string;
  hash: string;
  amountIn?: number;
  assetIn?: string;
  amountOut?: number;
  assetOut?: string;
  direction?: "received" | "sent";
};

type TransactionProps = {
  email: string;
  network: string;
}

type Filter = "All" | "Withdraw" | "Send" | "Receive" | "Swap" | "Bridge" | "Paiflow";
type TransactionCursors = Record<string, string | null>;
const EMPTY_TRANSACTION_ASSETS: string[] = [];
const emptyCursors = (assets: string[] = []): TransactionCursors =>
  Object.fromEntries(assets.map((asset) => [asset, null]));
const filters: Filter[] = ["All", "Withdraw", "Send", "Receive", "Swap", "Bridge", "Paiflow"];
const skeletonClass = "animate-pulse motion-reduce:animate-none rounded-md bg-foreground/10";

const cardClass = "rounded-xl border border-foreground/10 bg-background";

const shortAddress = (address: string) =>
  address.length > 15 ? `${address.slice(0, 7)}…${address.slice(-5)}` : address;

const explorerUrl = (network: string, hash: string) => {
  const explorer = getWalletNetworkConfig(network)?.explorer;
  return explorer?.transactionUrlTemplate.replace("{hash}", encodeURIComponent(hash)) ?? null;
};

const explorerName = (network: string) =>
  getWalletNetworkConfig(network)?.explorer.name ?? "network explorer";

export default function Transactions({ email, network } : TransactionProps) {
  const networkConfig = getWalletNetworkConfig(network);
  const transactionAssets = networkConfig?.transactionAssets ?? EMPTY_TRANSACTION_ASSETS;
  const availableFilters = networkConfig?.family === "stellar"
    ? filters
    : networkConfig?.family === "bot_chain"
      ? filters.filter((item) => item !== "Paiflow")
      : filters.filter((item) => item !== "Bridge" && item !== "Paiflow");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [page, setPage] = useState(1);
  const [cursor, setCursor] = useState<TransactionCursors>(() => emptyCursors(transactionAssets));
  const [cursorHistory, setCursorHistory] = useState<TransactionCursors[]>([]);
  const [nextCursor, setNextCursor] = useState<TransactionCursors | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(1);
    setCursor(emptyCursors(transactionAssets));
    setCursorHistory([]);
    setNextCursor(null);
    setHasMore(false);
    setSearch("");
    setFilter("All");
  }, [email, network, transactionAssets]);

  useEffect(() => {
    let cancelled = false;

    const loadTransactions = async () => {
      if (!email || !network) return;

      const route = networkConfig?.routes.transactions;

      if (!route) {
        setTransactions([]);
        setNextCursor(null);
        setHasMore(false);
        setError("Transactions are not available for this network.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        // The Stellar endpoint returns all wallet assets in one response;
        // querying it once per asset duplicates records and causes stale rows
        // when React reconciles the filter list.
        const requestAssets = networkConfig?.family === "stellar"
          ? [transactionAssets[0] ?? "XLM"]
          : transactionAssets;
        const [responses, friendsResponse] = await Promise.all([
          Promise.all(requestAssets.map((asset) =>
            Fetch_to("POST", route, { email, cursor: cursor[asset], asset, includeAllAssets: true })
          )),
          Fetch_to("GET", userRoutes.friends, {}, undefined, 1),
        ]);
        const failedResponse = responses.find((response) => !response.success);
        if (failedResponse) {
          throw new Error(failedResponse.message || "Could not load transactions.");
        }

        const records = responses.flatMap((response) => response.data?.transactions ?? []);
        const mappedRecords: (Transaction & { sourceType?: string })[] = records.map((record: {
          id: string;
          hash?: string;
          type?: string;
          date: string;
          amount: string;
          asset: string;
          amountIn?: string;
          assetIn?: string;
          amountOut?: string;
          assetOut?: string;
          from: string | null;
          to: string | null;
          direction: "received" | "sent";
          status: Transaction["status"];
        }) => ({
          id: record.id,
          hash: record.hash ?? record.id,
          sourceType: record.type,
          name: record.type === "swap"
            ? `${record.assetIn ?? record.asset} → ${record.assetOut ?? "token"}`
            : record.type === "paiflow_deposit" ? record.direction === "received" ? "Paiflow split received" : "Paiflow split deposit"
            : record.type === "bridge_transfer" ? "USDT bridge"
            : shortAddress((record.direction === "received" ? record.from : record.to) ?? "Wallet transfer"),
          address: (record.direction === "received" ? record.from : record.to) ?? "Unknown wallet",
          type: record.type === "swap" ? "Swap" as const
            : record.type === "bridge_candidate" || record.type === "bridge_transfer" ? "Bridge" as const
            : record.type === "paiflow_deposit" ? "Paiflow" as const
            : record.direction === "received" ? "Receive" as const : "Withdraw" as const,
          status: record.status,
          amount: Number(record.amount),
          asset: record.asset,
          amountIn: record.amountIn === undefined ? undefined : Number(record.amountIn),
          assetIn: record.assetIn,
          amountOut: record.amountOut === undefined ? undefined : Number(record.amountOut),
          assetOut: record.assetOut,
          direction: record.direction,
          date: record.date,
        })).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

        // A BDEX router call and its PIE or USDT ERC-20 transfer share a
        // transaction hash. Collapse those legs into one activity row.
        const swapCandidates = mappedRecords.filter((record) => record.sourceType === "swap_candidate");
        const bridgeCandidates = mappedRecords.filter((record) => record.sourceType === "bridge_candidate");
        const pairedHashes = new Set<string>();
        const swaps: Transaction[] = [];
        const bridges: Transaction[] = [];
        for (const candidate of swapCandidates) {
          const tokenLegs = mappedRecords.filter((record) =>
            record.hash === candidate.hash && record.asset !== "BOT" && record.sourceType === "transfer"
          );
          const sentToken = tokenLegs.find((record) => record.direction === "sent");
          const receivedToken = tokenLegs.find((record) => record.direction === "received");
          // A native BOT input is represented by the value sent to the router;
          // a native BOT output may only appear as a zero-value router call.
          const input = sentToken ?? (candidate.amount > 0 ? candidate : undefined);
          const output = receivedToken ?? (sentToken && candidate.amount === 0 ? candidate : undefined);
          if (!input || !output) {
            // Custom tokens are managed per wallet and are not part of the
            // fixed transaction asset queries. Keep the router call visible
            // as a generic swap instead of dropping a valid DEX transaction.
            pairedHashes.add(candidate.hash);
            swaps.push({
              id: `swap-${candidate.hash}`,
              name: "BOT Chain DEX swap",
              address: candidate.address,
              type: "Swap",
              status: candidate.status,
              amount: candidate.amount,
              asset: candidate.asset,
              date: candidate.date,
              hash: candidate.hash,
              direction: "sent",
            });
            continue;
          }
          pairedHashes.add(candidate.hash);
          swaps.push({
            id: `swap-${candidate.hash}`,
            name: `${input.asset} → ${output.asset}`,
            address: candidate.address,
            type: "Swap",
            status: candidate.status === "Completed" && input.status === "Completed" && output.status === "Completed" ? "Completed" : "Failed",
            amount: output.amount,
            asset: output.asset,
            date: candidate.date,
            hash: candidate.hash,
            amountIn: input.amount,
            assetIn: input.asset,
            // For token → native BOT, the explorer's normal tx list omits the
            // native output (it is an internal value transfer), so show its
            // asset but do not invent an output amount.
            amountOut: output.sourceType === "swap_candidate" && output.amount === 0 ? undefined : output.amount,
            assetOut: output.asset,
          });
        }
        for (const candidate of bridgeCandidates) {
          const tokenLeg = mappedRecords.find((record) =>
            record.hash === candidate.hash && record.asset === "USDT" && record.sourceType !== "bridge_candidate"
          );
          if (!tokenLeg) continue;

          pairedHashes.add(candidate.hash);
          bridges.push({
            id: `bridge-${candidate.hash}`,
            name: "USDT bridge",
            address: candidate.address,
            type: "Bridge",
            status: candidate.status === "Completed" && tokenLeg.status === "Completed" ? "Completed" : "Failed",
            amount: tokenLeg.amount,
            asset: "USDT",
            date: candidate.date,
            hash: candidate.hash,
            direction: "sent",
          });
        }
        const mapped: Transaction[] = [
          ...mappedRecords.filter((record) =>
            record.sourceType !== "swap_candidate" && record.sourceType !== "bridge_candidate" && !pairedHashes.has(record.hash)
          ),
          ...swaps,
          ...bridges,
        ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
        const friendByAddress = new Map<string, string>();
        const friends = Array.isArray(friendsResponse.data?.friends) ? friendsResponse.data.friends : [];
        for (const friend of friends) {
          if (typeof friend.walletAddress === "string" && typeof friend.username === "string") {
            friendByAddress.set(friend.walletAddress.toLowerCase(), friend.username);
          }
        }
        const labeledTransactions = mapped.map((transaction): Transaction => {
          if (transaction.type !== "Withdraw") return transaction;
          const friendName = friendByAddress.get(transaction.address.toLowerCase());
          return friendName ? { ...transaction, type: "Send", name: `To ${friendName}` } : transaction;
        });

        const updatedCursors = emptyCursors(transactionAssets);
        responses.forEach((response, index) => {
          updatedCursors[requestAssets[index]] = response.data?.nextCursor ?? null;
        });
        const more = responses.some((response) => response.data?.hasMore === true);

        if (!cancelled) {
          setTransactions(labeledTransactions);
          setNextCursor(more ? updatedCursors : null);
          setHasMore(more);
        }
      } catch (err) {
        if (!cancelled) {
          setTransactions([]);
          setNextCursor(null);
          setHasMore(false);
          setError(err instanceof Error ? err.message : "Could not load transactions.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadTransactions();
    return () => {
      cancelled = true;
    };
  }, [email, network, cursor, networkConfig, transactionAssets]);

  const query = search.trim().toLowerCase();
  const visibleTransactions = transactions.filter((transaction) =>
    (filter === "All" || transaction.type === filter || (filter === "Receive" && transaction.type === "Paiflow" && transaction.direction === "received")) &&
    (!query || [transaction.name, transaction.address, transaction.hash, transaction.status, transaction.asset, transaction.assetIn, transaction.assetOut, transaction.type]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(query)))
  );
  const completedCount = transactions.filter((t) => t.status === "Completed").length;
  const receivedTotals = transactions.reduce<Record<string, number>>((totals, transaction) => {
    if ((transaction.type === "Receive" || (transaction.type === "Paiflow" && transaction.direction === "received")) && transaction.status === "Completed") {
      totals[transaction.asset] = (totals[transaction.asset] ?? 0) + transaction.amount;
    }
    return totals;
  }, {});
  return (
    <div className="space-y-6 text-foreground">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Wallet activity</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-foreground/55">
            Browse recent {walletNetworkLabel(network)} activity{transactionAssets.length ? ` for ${transactionAssets.join(" and ")}` : ""}.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 14v2h12v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export
        </button>
      </header>

      <section aria-label="Transaction summary" className="grid gap-3 sm:grid-cols-3">
        <div className={`${cardClass} p-4`}>
          <p className="text-xs font-medium text-foreground/50">Transactions on this page</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? <span aria-hidden="true" className={`inline-block h-7 w-10 align-middle ${skeletonClass}`} /> : transactions.length}
          </p>
          <p className="mt-1 text-xs text-foreground/45">Showing activity for each wallet token</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-xs font-medium text-foreground/50">Completed on this page</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? <span aria-hidden="true" className={`inline-block h-7 w-10 align-middle ${skeletonClass}`} /> : completedCount}
          </p>
          <p className="mt-1 text-xs text-foreground/45">Successfully processed</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-xs font-medium text-foreground/50">Received on this page</p>
          <div className="mt-2 flex min-h-8 flex-wrap items-baseline gap-x-2 gap-y-1 text-2xl font-semibold tabular-nums">
            {loading ? (
              <span aria-hidden="true" className={`inline-block h-7 w-28 align-middle ${skeletonClass}`} />
            ) : (
              Object.keys(receivedTotals).length > 0
                ? Object.entries(receivedTotals).map(([asset, amount]) => (
                    <span key={asset} className="whitespace-nowrap">
                      {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)}
                      <span className="ml-1 text-sm font-medium text-foreground/50">{asset}</span>
                    </span>
                  ))
                : <span>0</span>
            )}
          </div>
          <p className="mt-1 text-xs text-foreground/45">Completed incoming payments</p>
        </div>
      </section>

      <section className={`${cardClass} overflow-hidden`} aria-labelledby="transaction-list-title">
        <div className="flex flex-col gap-4 border-b border-foreground/10 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="transaction-list-title" className="text-sm font-semibold">All activity</h2>
            <p className="mt-1 text-xs text-foreground/50">
              {visibleTransactions.length} matching {visibleTransactions.length === 1 ? "transaction" : "transactions"} on this page
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div role="group" aria-label="Filter transactions" className="flex max-w-full shrink-0 flex-nowrap overflow-x-auto overscroll-x-contain rounded-lg bg-foreground/5 p-1 sm:w-fit">
              {availableFilters.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  aria-pressed={filter === item}
                  className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    filter === item ? "bg-background text-foreground shadow-sm" : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="relative block sm:w-64">
              <span className="sr-only">Search transactions</span>
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40">
                <circle cx="8.75" cy="8.75" r="5.75" stroke="currentColor" strokeWidth="1.5" />
                <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search this page"
                className="w-full rounded-lg border border-foreground/15 bg-background py-2 pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-foreground/35 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>
        </div>

        {loading ? (
          <div role="status" aria-label="Loading transactions">
            <span className="sr-only">Loading transactions…</span>
            <div aria-hidden="true" className="divide-y divide-foreground/8 md:hidden">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className={`h-9 w-9 shrink-0 rounded-full ${skeletonClass}`} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <span className={`block h-4 w-2/3 ${skeletonClass}`} />
                      <span className={`block h-3 w-1/2 ${skeletonClass}`} />
                    </div>
                  </div>
                  <span className={`h-4 w-16 shrink-0 ${skeletonClass}`} />
                </div>
              ))}
            </div>
            <div aria-hidden="true" className="hidden overflow-hidden md:block">
              <div className="space-y-0 divide-y divide-foreground/8">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-[1.5fr_1fr_0.7fr_0.7fr_0.8fr_1.2fr] items-center gap-4 px-5 py-5">
                    <span className={`h-4 w-3/4 ${skeletonClass}`} />
                    <span className={`h-4 w-2/3 ${skeletonClass}`} />
                    <span className={`h-5 w-16 rounded-full ${skeletonClass}`} />
                    <span className={`ml-auto h-4 w-20 ${skeletonClass}`} />
                    <span className={`h-4 w-3/4 ${skeletonClass}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <p role="alert" className="px-5 py-16 text-center text-sm text-rose-600">{error}</p>
        ) : visibleTransactions.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-foreground/5 text-foreground/45">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium">No transactions found</p>
            <p className="mt-1 text-xs text-foreground/50">
              {filter === "Swap" ? "Swap records will appear here after real on-chain swaps are available." : filter === "Bridge" ? "Bridge transactions will appear here after a BOT Chain bridge transfer." : filter === "Send" ? "Transfers to your saved Otter friends will appear here." : "Try another search or filter."}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-foreground/8 md:hidden">
              {visibleTransactions.map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} network={network} />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-left">
                <thead className="sticky top-0 z-10 bg-background text-[11px] font-medium uppercase tracking-wide text-foreground/45">
                  <tr>
                    <th className="px-5 py-3">Transaction</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Token</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3">Transaction ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/8">
                  {visibleTransactions.map((transaction) => (
                    <tr key={transaction.id} className="transition-colors hover:bg-foreground/[0.02]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <DirectionIcon type={transaction.type} direction={transaction.direction} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{transaction.name}</p>
                            <p className="mt-0.5 font-mono text-xs text-foreground/45">
                              {transaction.type === "Swap" ? "Swap transaction" : transaction.type === "Bridge" ? "Bridge transfer" : transaction.type === "Paiflow" ? transaction.direction === "received" ? `Paiflow received · ${shortAddress(transaction.address)}` : `Paiflow deposit · ${shortAddress(transaction.address)}` : `${transaction.type === "Receive" ? "Received" : transaction.type === "Send" ? "Sent to" : "Sent"} · ${shortAddress(transaction.address)}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground/65">{formatDate(transaction.date)}</td>
                      <td className="px-5 py-4"><TokenBadge transaction={transaction} network={network} /></td>
                      <td className="px-5 py-4"><StatusBadge status={transaction.status} /></td>
                      <td className="px-5 py-4 text-right text-sm font-semibold tabular-nums">
                        <TransactionAmount transaction={transaction} />
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">
                        <ExplorerLink network={network} hash={transaction.hash} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!loading && !error && (transactions.length > 0 || page > 1) && (
          <nav
            aria-label="Transaction pages"
            className="flex flex-col gap-3 border-t border-foreground/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          >
            <p className="text-xs text-foreground/50">Page {page} · {transactions.length} transactions loaded</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const previousCursor = cursorHistory[cursorHistory.length - 1] ?? emptyCursors(transactionAssets);
                  setCursorHistory((history) => history.slice(0, -1));
                  setCursor(previousCursor);
                  setPage((current) => Math.max(1, current - 1));
                }}
                disabled={page === 1 || loading}
                className="rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/75 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span aria-live="polite" className="min-w-16 text-center text-xs text-foreground/55">Page {page}</span>
              <button
                type="button"
                onClick={() => {
                  if (!nextCursor) return;
                  setCursorHistory((history) => [...history, cursor]);
                  setCursor(nextCursor);
                  setPage((current) => current + 1);
                }}
                disabled={!hasMore || !nextCursor || loading}
                className="rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/75 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}

function TransactionCard({ transaction, network }: { transaction: Transaction; network: string }) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <DirectionIcon type={transaction.type} direction={transaction.direction} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{transaction.name}</p>
            <p className="mt-0.5 font-mono text-xs text-foreground/45">
              {transaction.type === "Swap" ? "Swap transaction" : transaction.type === "Bridge" ? "Bridge transfer" : transaction.type === "Paiflow" ? transaction.direction === "received" ? `Paiflow received · ${shortAddress(transaction.address)}` : `Paiflow deposit · ${shortAddress(transaction.address)}` : transaction.type === "Send" ? `Sent to ${shortAddress(transaction.address)}` : shortAddress(transaction.address)}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
          <TransactionAmount transaction={transaction} />
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 pl-12">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-foreground/50">{formatDate(transaction.date)}</p>
          <TokenBadge transaction={transaction} network={network} />
        </div>
        <StatusBadge status={transaction.status} />
      </div>
      <div className="mt-3 pl-12">
        <ExplorerLink network={network} hash={transaction.hash} />
      </div>
    </article>
  );
}

function ExplorerLink({ network, hash }: { network: string; hash: string }) {
  const href = explorerUrl(network, hash);
  if (!href) return <span className="text-foreground/50">{shortAddress(hash)}</span>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View transaction ${hash} on ${explorerName(network)}`}
      className="inline-flex items-center gap-1.5 text-primary transition-colors hover:underline"
    >
      <span>{shortAddress(hash)}</span>
      <span className="font-sans text-[11px]">View on {explorerName(network)} ↗</span>
    </a>
  );
}

function TokenBadge({ transaction, network }: { transaction: Transaction; network: string }) {
  const label = transaction.type === "Swap" && transaction.assetIn && transaction.assetOut
    ? `${transaction.assetIn} → ${transaction.assetOut}`
    : walletAssetLabel(network, transaction.asset);
  return (
    <span className="inline-flex rounded-md bg-foreground/5 px-2 py-1 text-xs font-medium text-foreground/70">
      {label}
    </span>
  );
}

function DirectionIcon({ type, direction }: { type: Transaction["type"]; direction?: Transaction["direction"] }) {
  const received = type === "Receive" || (type === "Paiflow" && direction === "received");
  const swapped = type === "Swap";
  const bridged = type === "Bridge";
  const paiflow = type === "Paiflow";
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${swapped ? "bg-secondary/15 text-secondary" : bridged ? "bg-cyan-500/10 text-cyan-600" : paiflow ? "bg-violet-500/10 text-violet-500" : received ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"}`}>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        {swapped || bridged ? (
          <path d="M3.5 6h12m0 0-3-3m3 3-3 3M16.5 14h-12m0 0 3 3m-3-3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d={received ? "M10 3.5v12m0 0 4-4m-4 4-4-4" : "M10 16.5v-12m0 0 4 4m-4-4-4 4"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </span>
  );
}

function TransactionAmount({ transaction }: { transaction: Transaction }) {
  if (transaction.type === "Swap" && transaction.amountIn !== undefined) {
    return (
      <span className="inline-flex flex-col items-end gap-0.5">
        <span className="text-foreground/65">−{formatAmount(transaction.amountIn)} {transaction.assetIn}</span>
        {transaction.amountOut !== undefined
          ? <span className="text-emerald-600">+{formatAmount(transaction.amountOut)} {transaction.assetOut}</span>
          : <span className="text-secondary">Swap → {transaction.assetOut}</span>}
      </span>
    );
  }
  if (transaction.type === "Swap") return <span className="text-secondary">Swap</span>;
  const received = transaction.direction ? transaction.direction === "received" : transaction.type === "Receive";
  return <span className={received ? "text-emerald-600" : "text-foreground"}>
    {received ? "+" : "−"}{formatAmount(transaction.amount)} {transaction.asset}
  </span>;
}

function StatusBadge({ status }: { status: Transaction["status"] }) {
  const styles: Record<Transaction["status"], string> = {
    Completed: "bg-emerald-500/10 text-emerald-700",
    Pending: "bg-amber-500/10 text-amber-700",
    Failed: "bg-rose-500/10 text-rose-700",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${styles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />{status}
    </span>
  );
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 7 }).format(amount);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}
