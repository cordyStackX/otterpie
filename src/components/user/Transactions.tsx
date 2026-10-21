"use client";

import { useState, useEffect } from "react";
import { Fetch_to } from "@/utilities";
import { isBotChainNetwork, walletNetworkLabel } from "@/utilities/network";
import routes from "@/routes/user.json";

type Transaction = {
  id: string;
  name: string;
  address: string;
  type: "Receive" | "Withdraw" | "Swap";
  status: "Completed" | "Pending" | "Failed";
  amount: number;
  asset: string;
  date: string;
  hash: string;
  amountIn?: number;
  assetIn?: string;
  amountOut?: number;
  assetOut?: string;
};

type TransactionProps = {
  email: string;
  network: string;
}

type Filter = "All" | "Withdraw" | "Receive" | "Swap";
const filters: Filter[] = ["All", "Withdraw", "Receive", "Swap"];
const skeletonClass = "animate-pulse motion-reduce:animate-none rounded-md bg-foreground/10";

const cardClass = "rounded-xl border border-foreground/10 bg-background";

const shortAddress = (address: string) =>
  address.length > 15 ? `${address.slice(0, 7)}…${address.slice(-5)}` : address;

const explorerUrl = (network: string, hash: string) => {
  const encodedHash = encodeURIComponent(hash);
  if (network === "stellar") return `https://stellar.expert/explorer/public/tx/${encodedHash}`;
  if (isBotChainNetwork(network)) return `https://scan.botchain.ai/tx/${encodedHash}`;
  return null;
};

const explorerName = (network: string) =>
  network === "stellar" ? "Stellar Expert" : "BOT Chain Explorer";

export default function Transactions({ email, network } : TransactionProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [page, setPage] = useState(1);
  const [cursor, setCursor] = useState("");
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(1);
    setCursor("");
    setCursorHistory([]);
    setNextCursor(null);
    setHasMore(false);
    setSearch("");
    setFilter("All");
  }, [email, network]);

  useEffect(() => {
    let cancelled = false;

    const loadTransactions = async () => {
      if (!email || !network) return;

      const route = network === "stellar"
        ? routes.stellar_transactions
        : isBotChainNetwork(network)
          ? routes.bot_chain_transactions
          : null;

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
        const response = await Fetch_to("POST", route, { email, cursor: cursor || null });
        if (!response.success) {
          throw new Error(response.message || "Could not load transactions.");
        }

        const records = response.data?.transactions ?? [];
        const mapped: Transaction[] = records.map((record: {
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
          name: record.type === "swap"
            ? `${record.assetIn ?? record.asset} → ${record.assetOut ?? "token"}`
            : shortAddress((record.direction === "received" ? record.from : record.to) ?? "Wallet transfer"),
          address: (record.direction === "received" ? record.from : record.to) ?? "Unknown wallet",
          type: record.type === "swap" ? "Swap" as const : record.direction === "received" ? "Receive" as const : "Withdraw" as const,
          status: record.status,
          amount: Number(record.amount),
          asset: record.asset,
          amountIn: record.amountIn === undefined ? undefined : Number(record.amountIn),
          assetIn: record.assetIn,
          amountOut: record.amountOut === undefined ? undefined : Number(record.amountOut),
          assetOut: record.assetOut,
          date: record.date,
          hash: record.hash ?? record.id,
        }));

        if (!cancelled) {
          setTransactions(mapped);
          setNextCursor(response.data?.nextCursor ?? null);
          setHasMore(response.data?.hasMore === true);
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
  }, [email, network, cursor]);

  const query = search.trim().toLowerCase();
  const visibleTransactions = transactions.filter((transaction) =>
    (filter === "All" || transaction.type === filter) &&
    (!query || [transaction.name, transaction.address, transaction.hash, transaction.status, transaction.asset, transaction.assetIn, transaction.assetOut, transaction.type]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(query)))
  );
  const completedCount = transactions.filter((t) => t.status === "Completed").length;
  const receivedTotal = transactions
    .filter((t) => t.type === "Receive" && t.status === "Completed")
    .reduce((sum, t) => sum + t.amount, 0);
  return (
    <div className="space-y-6 text-foreground">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Wallet activity</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-foreground/55">
            Browse recent {walletNetworkLabel(network)} activity, 10 transactions at a time.
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
          <p className="mt-1 text-xs text-foreground/45">Up to 10 loaded at a time</p>
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
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {loading ? (
              <span aria-hidden="true" className={`inline-block h-7 w-28 align-middle ${skeletonClass}`} />
            ) : (
              <>
                {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(receivedTotal)}
                <span className="ml-1.5 text-sm font-medium text-foreground/50">
                  {network === "otterpie_bot_chain" ? "PIE" : isBotChainNetwork(network) ? "BOT" : "XLM"}
                </span>
              </>
            )}
          </p>
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
            <div role="group" aria-label="Filter transactions" className="flex rounded-lg bg-foreground/5 p-1">
              {filters.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  aria-pressed={filter === item}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
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
                  <div key={index} className="grid grid-cols-[1.5fr_1fr_0.7fr_0.7fr_1fr] items-center gap-4 px-5 py-5">
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
              {filter === "Swap" ? "Swap records will appear here after real on-chain swaps are available." : "Try another search or filter."}
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
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-foreground/[0.025] text-[11px] font-medium uppercase tracking-wide text-foreground/45">
                  <tr>
                    <th className="px-5 py-3">Transaction</th>
                    <th className="px-5 py-3">Date</th>
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
                          <DirectionIcon type={transaction.type} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{transaction.name}</p>
                            <p className="mt-0.5 font-mono text-xs text-foreground/45">
                              {transaction.type === "Swap" ? "Swap transaction" : `${transaction.type === "Withdraw" ? "Sent" : "Received"} · ${shortAddress(transaction.address)}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground/65">{formatDate(transaction.date)}</td>
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
                  const previousCursor = cursorHistory[cursorHistory.length - 1] ?? "";
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
          <DirectionIcon type={transaction.type} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{transaction.name}</p>
            <p className="mt-0.5 font-mono text-xs text-foreground/45">
              {transaction.type === "Swap" ? "Swap transaction" : shortAddress(transaction.address)}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
          <TransactionAmount transaction={transaction} />
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 pl-12">
        <p className="text-xs text-foreground/50">{formatDate(transaction.date)}</p>
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

function DirectionIcon({ type }: { type: Transaction["type"] }) {
  const received = type === "Receive";
  const swapped = type === "Swap";
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${swapped ? "bg-secondary/15 text-secondary" : received ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"}`}>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        {swapped ? (
          <path d="M3.5 6h12m0 0-3-3m3 3-3 3M16.5 14h-12m0 0 3 3m-3-3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d={received ? "M10 3.5v12m0 0 4-4m-4 4-4-4" : "M10 16.5v-12m0 0 4 4m-4-4-4 4"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </span>
  );
}

function TransactionAmount({ transaction }: { transaction: Transaction }) {
  if (transaction.type === "Swap" && transaction.amountIn !== undefined && transaction.amountOut !== undefined) {
    return (
      <span className="inline-flex flex-col items-end gap-0.5">
        <span className="text-foreground/65">−{formatAmount(transaction.amountIn)} {transaction.assetIn}</span>
        <span className="text-emerald-600">+{formatAmount(transaction.amountOut)} {transaction.assetOut}</span>
      </span>
    );
  }
  if (transaction.type === "Swap") return <span className="text-secondary">Swap</span>;
  return <span className={transaction.type === "Receive" ? "text-emerald-600" : "text-foreground"}>
    {transaction.type === "Receive" ? "+" : "−"}{formatAmount(transaction.amount)} {transaction.asset}
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
