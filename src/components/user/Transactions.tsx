"use client";

import { useState, useEffect } from "react";
import { Fetch_to } from "@/utilities";
import routes from "@/routes/user.json";

type Transaction = {
  id: string;
  name: string;
  address: string;
  type: "Receive" | "Withdraw";
  status: "Completed" | "Pending" | "Failed";
  amount: number;
  asset: string;
  date: string;
  hash: string;
};

type TransactionProps = {
  email: string;
  network: string;
}

type Filter = "All" | "Withdraw" | "Receive";
const filters: Filter[] = ["All", "Withdraw", "Receive"];

const cardClass = "rounded-xl border border-foreground/10 bg-background";

const shortAddress = (address: string) =>
  address.length > 15 ? `${address.slice(0, 7)}…${address.slice(-5)}` : address;

export default function Transactions({ email, network } : TransactionProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadTransactions = async () => {
      if (!email || !network) return;

      const route = network === "stellar"
        ? routes.stellar_transactions
        : network === "bot_chain"
          ? routes.bot_chain_transactions
          : null;

      if (!route) {
        setTransactions([]);
        setError("Transactions are not available for this network.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await Fetch_to("POST", route, { email });
        if (!response.success) {
          throw new Error(response.message || "Could not load transactions.");
        }

        const records = response.data?.transactions ?? [];
        const mapped: Transaction[] = records.map((record: {
          id: string;
          date: string;
          amount: string;
          asset: string;
          from: string | null;
          to: string | null;
          direction: "received" | "sent";
          status: Transaction["status"];
        }) => ({
          id: record.id,
          name: shortAddress((record.direction === "received" ? record.from : record.to) ?? "Wallet transfer"),
          address: (record.direction === "received" ? record.from : record.to) ?? "Unknown wallet",
          type: record.direction === "received" ? "Receive" as const : "Withdraw" as const,
          status: record.status,
          amount: Number(record.amount),
          asset: record.asset,
          date: record.date,
          hash: record.id,
        }));

        if (!cancelled) setTransactions(mapped);
      } catch (err) {
        if (!cancelled) {
          setTransactions([]);
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
  }, [email, network]);

  const query = search.trim().toLowerCase();
  const visibleTransactions = transactions.filter((transaction) =>
    (filter === "All" || transaction.type === filter) &&
    (!query || [transaction.name, transaction.address, transaction.hash, transaction.status]
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
          <p className="mt-1 text-sm text-foreground/55">Review and search your recent wallet activity.</p>
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
          <p className="text-xs font-medium text-foreground/50">Total transactions</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{transactions.length}</p>
          <p className="mt-1 text-xs text-foreground/45">Across all activity</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-xs font-medium text-foreground/50">Completed</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{completedCount}</p>
          <p className="mt-1 text-xs text-foreground/45">Successfully processed</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-xs font-medium text-foreground/50">Received</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(receivedTotal)}
            <span className="ml-1.5 text-sm font-medium text-foreground/50">
              {network === "bot_chain" ? "BOT" : "XLM"}
            </span>
          </p>
          <p className="mt-1 text-xs text-foreground/45">Completed incoming payments</p>
        </div>
      </section>

      <section className={`${cardClass} overflow-hidden`} aria-labelledby="transaction-list-title">
        <div className="flex flex-col gap-4 border-b border-foreground/10 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="transaction-list-title" className="text-sm font-semibold">All activity</h2>
            <p className="mt-1 text-xs text-foreground/50">
              {visibleTransactions.length} {visibleTransactions.length === 1 ? "transaction" : "transactions"} shown
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
                placeholder="Search name or address"
                className="w-full rounded-lg border border-foreground/15 bg-background py-2 pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-foreground/35 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>
        </div>

        {loading ? (
          <p className="px-5 py-16 text-center text-sm text-foreground/50">Loading transactions…</p>
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
            <p className="mt-1 text-xs text-foreground/50">Try another search or filter.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-foreground/8 md:hidden">
              {visibleTransactions.map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} />
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
                              {transaction.type === "Withdraw" ? "Sent" : "Received"} · {shortAddress(transaction.address)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground/65">{formatDate(transaction.date)}</td>
                      <td className="px-5 py-4"><StatusBadge status={transaction.status} /></td>
                      <td className={`px-5 py-4 text-right text-sm font-semibold tabular-nums ${transaction.type === "Receive" ? "text-emerald-600" : "text-foreground"}`}>
                        {transaction.type === "Receive" ? "+" : "−"}{formatAmount(transaction.amount)} {transaction.asset}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-foreground/50">{shortAddress(transaction.hash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function TransactionCard({ transaction }: { transaction: Transaction }) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <DirectionIcon type={transaction.type} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{transaction.name}</p>
            <p className="mt-0.5 font-mono text-xs text-foreground/45">{shortAddress(transaction.address)}</p>
          </div>
        </div>
          <p className={`shrink-0 text-sm font-semibold tabular-nums ${transaction.type === "Receive" ? "text-emerald-600" : "text-foreground"}`}>
          {transaction.type === "Receive" ? "+" : "−"}{formatAmount(transaction.amount)} {transaction.asset}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 pl-12">
        <p className="text-xs text-foreground/50">{formatDate(transaction.date)}</p>
        <StatusBadge status={transaction.status} />
      </div>
    </article>
  );
}

function DirectionIcon({ type }: { type: Transaction["type"] }) {
  const received = type === "Receive";
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${received ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"}`}>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path d={received ? "M10 3.5v12m0 0 4-4m-4 4-4-4" : "M10 16.5v-12m0 0 4 4m-4-4-4 4"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
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
