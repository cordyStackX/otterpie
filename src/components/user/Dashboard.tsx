"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Fetch_to } from "@/utilities";
import routes from "@/routes/user.json";
import withdrawRoutes from "@/routes/withdraw.json";

type DashboardProps = {
  email: string;
  network: string;
};

const ranges = [
  { key: "7d", label: "7 days", averageLabel: "per day" },
  { key: "12m", label: "12 months", averageLabel: "per month" },
] as const;

type Range = (typeof ranges)[number]["key"];

// Colors cycle through primary/secondary at different opacities so any number
// of user-made categories stay distinguishable within the two-color palette.
function colorForIndex(i: number) {
  const base = i % 2 === 0 ? "var(--primary-rgba)" : "var(--secondary-rgba)";
  const alphaCycle = [1, 0.75, 0.5, 0.35];
  const alpha = alphaCycle[Math.floor(i / 2) % alphaCycle.length];
  return `rgba(${base}, ${alpha})`;
}

// Wallet amounts are formatted by the active network's ticker.
const NETWORK_SYMBOL: Record<string, string> = {
  stellar: "XLM",
  bot_chain: "BOT", // TODO: put the real ticker here
};

type FormatAmount = (value: number) => string;

const makeFormatter = (network: string): FormatAmount => {
  const symbol = NETWORK_SYMBOL[network] ?? "";
  const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 7 });
  return (value: number) => `${nf.format(value)} ${symbol}`.trim();
};

const compact = (value: number) =>
  value >= 1000 ? `${value / 1000}k` : String(value);

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid rgba(var(--primary-rgba), 0.15)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  fontSize: 12,
  padding: "6px 10px",
};

const tick = { fill: "var(--foreground)", fontSize: 12, opacity: 0.55 };

const card = "rounded-xl border border-foreground/10 bg-background p-5";
const skeletonClass = "animate-pulse motion-reduce:animate-none rounded-md bg-foreground/10";

// ---------------------------------------------------------------------------
// Category allocation: each category takes a percentage of everything the
// wallet has received, until it reaches its goal. After that it stops growing.
//
//   share     = totalReceived × percent ÷ 100
//   allocated = min(share, goal)            (goal = 0 means "no goal")
//   available = allocated − withdrawn       (never below 0)
//
// Example: 20% Savings, goal 2000. Received 5000 → 1000. Received 15000 → 2000.
// Received 0 → every category is 0.
// ---------------------------------------------------------------------------
type CategoryRule = {
  id: string; // unique per category (crypto.randomUUID() when created)
  name: string;
  percent: number; // 0–100
  goal: number; // 0 = no goal
  icons?: string; // icon path under /public, stored with the category
  color?: string;
};

type CategoryBalance = CategoryRule & {
  allocated: number; // total earned by this category so far (capped by goal)
  withdrawn: number;
  available: number; // what can be withdrawn right now
  goalReached: boolean;
};

// Stellar amounts have at most 7 decimals; rounding avoids 0.30000000000000004
const round7 = (n: number) => Math.round(n * 1e7) / 1e7;

function allocate(
  rules: CategoryRule[],
  totalReceived: number,
  withdrawn: Record<string, number> = {}
): { categories: CategoryBalance[]; unallocated: number } {
  const received = Math.max(totalReceived, 0);

  const categories = rules.map((r) => {
    const share = (received * r.percent) / 100;
    const allocated = round7(r.goal > 0 ? Math.min(share, r.goal) : share);
    const taken = withdrawn[r.id] ?? 0;

    return {
      ...r,
      allocated,
      withdrawn: taken,
      available: round7(Math.max(allocated - taken, 0)),
      goalReached: r.goal > 0 && allocated >= r.goal,
    };
  });

  // Whatever the categories did not take (percentages under 100%, or goals hit)
  const allocatedTotal = categories.reduce((sum, c) => sum + c.allocated, 0);
  const unallocated = round7(Math.max(received - allocatedTotal, 0));

  return { categories, unallocated };
}

// Percentages across all categories should not go over 100
// const totalPercent = (rules: CategoryRule[]) =>
//   rules.reduce((sum, r) => sum + r.percent, 0);

// Each category stores its own icon path; this is the fallback if it is missing.
const DEFAULT_OTTER = "/icons/otters/otter-default.svg";

const CATEGORIES_PER_PAGE = 10;
const REFRESH_MS = 30_000; // how often the balance and sales refresh

// Both balance routes return balances as [{ asset, issuer, balance }]
const toSlices = (balances: { asset: string; balance: string }[]): Slice[] =>
  balances
    .map((b) => ({ name: b.asset, amount: parseFloat(b.balance) }))
    .filter((b) => Number.isFinite(b.amount));

type Category = { id: string; name: string; amount: number };
type Slice = { name: string; amount: number; color?: string };

// Sales = money received by the wallet (incoming payments), in the network's coin
type Incoming = {
  date: string;
  amount: number;
  direction?: "received" | "sent";
  status?: "Completed" | "Failed";
};

// Both transaction routes return [{ date, amount, asset, ... }]; keep only the
// network's own coin so the chart is in one unit.
const toIncoming = (
  txs: {
    date: string;
    amount: string;
    asset: string;
    direction?: "received" | "sent";
    status?: "Completed" | "Failed";
  }[],
  symbol: string
): Incoming[] =>
  txs
    .filter((t) => t.asset === symbol && t.direction !== "sent" && t.status !== "Failed")
    .map((t) => ({ date: t.date, amount: parseFloat(t.amount), direction: t.direction, status: t.status }))
    .filter((t) => Number.isFinite(t.amount));

// Groups incoming payments into 7 daily or 12 monthly buckets (local time)
function buildSales(incoming: Incoming[], range: Range) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

  const now = new Date();
  const buckets: { key: string; label: string; amount: number }[] = [];

  if (range === "7d") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      buckets.push({
        key: dayKey(d),
        label: d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        amount: 0,
      });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: monthKey(d),
        label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        amount: 0,
      });
    }
  }

  const byKey = new Map(buckets.map((b) => [b.key, b] as const));
  for (const tx of incoming) {
    const d = new Date(tx.date);
    const bucket = byKey.get(range === "7d" ? dayKey(d) : monthKey(d));
    if (bucket) bucket.amount += tx.amount;
  }

  return buckets.map((b) => ({ label: b.label, amount: round7(b.amount) }));
}

function shortAddress(address: string) {
  return address.length > 14
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

// Uses the native <dialog> element for focus trapping, Escape-to-close and a backdrop.
function WithdrawDialog({
  category,
  network,
  email,
  withdrawAll = false,
  formatAmount,
  onClose,
  onWithdrawn,
}: {
  category: Category;
  network: string;
  email: string;
  withdrawAll?: boolean;
  formatAmount: FormatAmount;
  onClose: () => void;
  onWithdrawn: (id: string, amount: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [balance] = useState(category.amount); // available category balance at open
  const [amount, setAmount] = useState(category.amount ? String(category.amount) : "");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [sentTo, setSentTo] = useState("");
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = address.trim();
    const amountNumber = Number(amount);
    if (!password) {
      setError("Enter your account password to confirm this transfer.");
      return;
    }
    if (!withdrawAll && (!Number.isFinite(amountNumber) || amountNumber <= 0 || amountNumber > balance)) {
      setError("Enter an amount greater than zero and no more than the available balance.");
      return;
    }
    setError("");
    setStatus("submitting");
    const endpoint = network === "stellar"
      ? withdrawRoutes.withdraw_stellar
      : network === "bot_chain"
        ? withdrawRoutes.withdraw_botchain
        : null;
    if (!endpoint) {
      setError("Withdrawals are not supported for this wallet network.");
      setStatus("idle");
      return;
    }
    try {
      const response = await Fetch_to("POST", endpoint, {
        address: trimmed,
        amount: amount.trim(),
        withdrawAll,
        password,
        email,
      });
      if (!response.success) throw new Error(response.message || "The transfer could not be submitted.");
      const result = response.data as { txHash?: string; amount?: string };
      setSentTo(trimmed);
      setTxHash(result.txHash || "");
      if (result.amount) setAmount(result.amount);
      if (!withdrawAll) onWithdrawn(category.id, amountNumber);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The transfer could not be submitted.");
      setStatus("idle");
    } finally {
      setPassword("");
    }
  };

  const submitting = status === "submitting";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="withdraw-title"
      onClose={onClose}
      onCancel={(e) => {
        if (submitting) e.preventDefault();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes it
        if (e.target === dialogRef.current && !submitting) dialogRef.current?.close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-foreground/10 bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/30 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-6">
        {status === "done" ? (
          <div className="text-center">
            <div
              aria-hidden="true"
              className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 12 5 5L20 7" />
              </svg>
            </div>
            <h2 id="withdraw-title" className="mt-4 text-lg font-semibold">
              Transfer submitted
            </h2>
            <p className="mt-1.5 text-sm text-foreground/60">
              {formatAmount(Number(amount))} from {category.name} was submitted to{" "}
              <span className="font-mono text-foreground">{shortAddress(sentTo)}</span>.
            </p>
            {txHash && <p className="mt-2 break-all font-mono text-xs text-foreground/50">Transaction: {txHash}</p>}
            <button
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close()}
              className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="flex items-start justify-between gap-4">
              <h2 id="withdraw-title" className="text-lg font-semibold tracking-tight">
                {withdrawAll ? "Withdraw all wallet funds" : `Withdraw from ${category.name}`}
              </h2>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                disabled={submitting}
                aria-label="Close"
                className="-mr-2 -mt-1 flex h-8 w-8 items-center justify-center rounded-md text-foreground/50 outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 rounded-lg bg-foreground/5 px-4 py-3">
              <p className="text-xs text-foreground/55">Available to withdraw</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
                {formatAmount(balance)}
              </p>
            </div>

            {withdrawAll && (
              <p className="mt-2 text-xs text-foreground/50">
                The network will calculate the maximum sendable amount after reserving fees
                {network === "stellar" ? " and Stellar's minimum account balance" : ""}.
              </p>
            )}

            {!withdrawAll && (
              <>
                <label htmlFor="withdraw-amount" className="mt-5 block text-sm font-medium text-foreground">
                  Amount ({network === "stellar" ? "XLM" : "BOT"})
                </label>
                <input
                  id="withdraw-amount"
                  type="number"
                  min="0"
                  max={balance}
                  step={network === "stellar" ? "0.0000001" : "any"}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (error) setError("");
                  }}
                  disabled={submitting || balance === 0}
                  className="mt-1.5 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/25 disabled:opacity-50"
                />
              </>
            )}

            <label
              htmlFor="wallet-address"
              className="mt-4 block text-sm font-medium text-foreground"
            >
              Wallet address
            </label>
            <input
              id="wallet-address"
              type="text"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (error) setError("");
              }}
              disabled={submitting || balance === 0}
              placeholder="Paste the destination address"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "wallet-error" : "wallet-hint"}
              className={`mt-1.5 w-full rounded-md border bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none transition-colors placeholder:font-sans placeholder:text-foreground/35 focus:ring-2 disabled:opacity-50 ${
                error
                  ? "border-red-500/60 focus:ring-red-500/25"
                  : "border-foreground/15 focus:border-primary/50 focus:ring-primary/25"
              }`}
            />
            {error ? (
              <p id="wallet-error" role="alert" className="mt-1.5 text-xs text-red-600">
                {error}
              </p>
            ) : (
              <p id="wallet-hint" className="mt-1.5 text-xs text-foreground/50">
                Confirm the network and address carefully. Transfers cannot be reversed.
              </p>
            )}

            <label htmlFor="withdraw-password" className="mt-4 block text-sm font-medium text-foreground">
              Confirm with your password
            </label>
            <input
              id="withdraw-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              disabled={submitting || balance === 0}
              required
              className="mt-1.5 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/25 disabled:opacity-50"
            />

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                disabled={submitting}
                className="flex-1 rounded-md border border-foreground/15 px-4 py-2.5 text-sm font-medium text-foreground/80 outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || balance === 0}
                className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
              >
                {submitting ? "Withdrawing…" : "Withdraw"}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}

export default function Dashboard({ email, network }: DashboardProps) {
  const [range, setRange] = useState<Range>("7d");

  // percent = share of incoming funds, goal = stop receiving once reached (0 = no goal)
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1, totalPercent: 0 });
  const [withdrawn, setWithdrawn] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Category | null>(null);

  // Wallet balance (pie chart), formatted by the active network's ticker
  const [walletData, setWalletData] = useState<Slice[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);
  const formatAmount = useMemo(() => makeFormatter(network), [network]);

  const walletTotal = walletData.reduce((sum, d) => sum + d.amount, 0);
  const nativeSymbol = NETWORK_SYMBOL[network];
  const nativeBalance = walletData.find((slice) => slice.name === nativeSymbol)?.amount ?? 0;
  const isEmptyWallet = !loadingBalance && walletTotal === 0;

  // Everything the wallet has received = current balance + what was already withdrawn.
  // (Refetch the balance after a real withdrawal so this stays correct.)
  const withdrawnTotal = Object.values(withdrawn).reduce((s, v) => s + v, 0);
  const { categories } = allocate(
    rules,
    walletTotal + withdrawnTotal,
    withdrawn
  );

  // Show how the current wallet balance is divided across categories. Any funds
  // outside category allocations get their own slice. Scale allocations down if
  // they briefly exceed the live balance (for example, immediately after a send).
  const categoryTotal = categories.reduce((sum, category) => sum + category.available, 0);
  const categoryScale = categoryTotal > walletTotal && categoryTotal > 0
    ? walletTotal / categoryTotal
    : 1;
  const categorySlices = categories
    .map((category) => ({
      name: category.name,
      amount: round7(category.available * categoryScale),
      color: category.color,
    }))
    .filter((slice) => slice.amount > 0);
  const categorizedTotal = categorySlices.reduce((sum, slice) => sum + slice.amount, 0);
  const unassignedAmount = round7(Math.max(walletTotal - categorizedTotal, 0));
  const pieData: Slice[] = isEmptyWallet
    ? [{ name: "Empty", amount: 1 }]
    : [
        ...categorySlices,
        ...(unassignedAmount > 0 ? [{ name: "Unassigned", amount: unassignedAmount }] : []),
      ];

  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const activeRange = ranges.find((r) => r.key === range)!;
  const salesData = useMemo(() => buildSales(incoming, range), [incoming, range]);
  const salesTotal = round7(salesData.reduce((sum, d) => sum + d.amount, 0));
  const salesAverage = Math.round((salesTotal / salesData.length) * 100) / 100;

  // Category rules come from the database (jsonb column)
  useEffect(() => {
    let cancelled = false;

    const loadRules = async () => {
      setLoadingCategories(true);
      try {
        const response = await Fetch_to("POST", routes.categories, {
          email,
          page,
          limit: CATEGORIES_PER_PAGE,
        });

        if (!cancelled && response.success) {
          const d = response.data;
          setRules(d.rules);
          setPageInfo({
            total: d.total,
            totalPages: d.totalPages,
            totalPercent: d.totalPercent,
          });
          // The server clamps the page (e.g. after categories were deleted)
          if (d.page !== page) setPage(d.page);
        }
      } catch {
        // Keep the list empty; the empty state tells the user to add categories
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    };

    loadRules();
    return () => {
      cancelled = true;
    };
  }, [email, page]);

  // Wallet balance + sales: load once, then refresh every 30 seconds
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let firstLoad = true;

    // Start clean so data from a previous account/network never lingers
    setWalletData([]);
    setIncoming([]);

    const config =
      network === "stellar"
        ? {
            balance: routes.stellar_balance,
            transactions: routes.stellar_transactions,
            symbol: "XLM",
          }
        : network === "bot_chain"
          ? {
              balance: routes.bot_chain_balance,
              transactions: routes.bot_chain_transactions,
              symbol: "BOT",
            }
          : null;

    const getBalance = async () => {
      if (inFlight) return; // never stack requests when the network is slow
      inFlight = true;

      // Only the first load shows "Loading balance…"; refreshes update quietly
      if (firstLoad) {
        setLoadingBalance(true);
        setLoadingSales(true);
      }

      // null = that request failed, so keep whatever is already on screen
      let slices: Slice[] | null = null;
      let incomingTx: Incoming[] | null = null;

      if (config) {
        try {
          const response = await Fetch_to("POST", config.balance, { email });
          if (response.success) slices = toSlices(response.data.balances);
        } catch {
          // Keep the previous balance
        }

        // Separate try so a transactions failure never wipes out the balance
        try {
          const txResponse = await Fetch_to("POST", config.transactions, { email });
          if (txResponse.success) {
            incomingTx = toIncoming(txResponse.data.transactions, config.symbol);
          }
        } catch {
          // Keep the previous sales history
        }
      }

      inFlight = false;
      if (cancelled) return;

      if (slices) setWalletData(slices);
      if (incomingTx) setIncoming(incomingTx);
      if (slices || incomingTx) setLastUpdated(new Date());

      if (firstLoad) {
        firstLoad = false;
        setLoadingBalance(false);
        setLoadingSales(false);
      }
    };

    getBalance();

    // Skip refreshes while the tab is hidden; catch up as soon as it is visible
    const onVisible = () => {
      if (document.visibilityState === "visible") getBalance();
    };
    const timer = setInterval(onVisible, REFRESH_MS);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [email, network]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-foreground/55">
          Your wallet balance, categories and recent sales.
          {lastUpdated && ` Updated ${lastUpdated.toLocaleTimeString()}.`}
        </p>
      </header>

      {/* Top row: pie (compact) + sales history (wide) */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Wallet balance */}
        <section
          aria-labelledby="earnings-title"
          className={`${card} flex min-h-[22rem] w-full flex-col lg:w-80 lg:shrink-0`}
        >
          <h2 id="earnings-title" className="text-sm font-semibold text-foreground">
            Wallet balance
          </h2>

          {loadingBalance ? (
            <div role="status" aria-label="Loading wallet balance" className="flex flex-1 flex-col items-center justify-center">
              <span className="sr-only">Loading wallet balance…</span>
              <div aria-hidden="true" className={`flex h-48 w-48 items-center justify-center rounded-full border-[14px] border-foreground/10 sm:h-56 sm:w-56 ${skeletonClass}`}>
                <div className="flex flex-col items-center gap-2">
                  <span className={`h-3 w-16 ${skeletonClass}`} />
                  <span className={`h-6 w-28 ${skeletonClass}`} />
                </div>
              </div>
              <div aria-hidden="true" className="mt-3 w-full max-w-64 space-y-2">
                <span className={`block h-3 w-full ${skeletonClass}`} />
                <span className={`block h-3 w-4/5 ${skeletonClass}`} />
              </div>
            </div>
          ) : (
            <>
              <div className="relative mt-2 h-56 w-full flex-none sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius="66%"
                      outerRadius="94%"
                      paddingAngle={isEmptyWallet ? 0 : 2}
                      cornerRadius={3}
                      strokeWidth={0}
                      isAnimationActive={!isEmptyWallet}
                    >
                      {pieData.map((d, i) => (
                        <Cell
                          key={d.name}
                          fill={
                            isEmptyWallet
                              ? "rgba(var(--primary-rgba), 0.12)"
                              : d.color || colorForIndex(i)
                          }
                        />
                      ))}
                    </Pie>
                    {!isEmptyWallet && (
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => [
                          formatAmount(Number(value ?? 0)),
                          name,
                        ]}
                      />
                    )}
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-xs text-foreground/50">Total balance</p>
                  <p className="max-w-[62%] break-words text-center text-sm font-semibold leading-tight tabular-nums tracking-tight text-foreground sm:text-base">
                    {formatAmount(walletTotal)}
                  </p>
                </div>
              </div>
              {!isEmptyWallet && pieData.length > 0 && (
                <ul aria-label="Wallet balance by category" className="mt-2 max-h-20 space-y-1 overflow-y-auto">
                  {pieData.map((slice, index) => (
                    <li key={slice.name} className="flex min-w-0 items-center gap-2 text-xs">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: slice.color || colorForIndex(index) }}
                      />
                      <span className="min-w-0 flex-1 truncate text-foreground/65">{slice.name}</span>
                      <span className="shrink-0 tabular-nums text-foreground/80">
                        {formatAmount(slice.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setSelected({ id: "__all__", name: "wallet", amount: nativeBalance })}
            disabled={loadingBalance || nativeBalance <= 0 || !nativeSymbol}
            className="mt-3 w-full rounded-md border border-primary/30 px-3 py-2 text-sm font-medium text-primary outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Withdraw all funds
          </button>
        </section>

        {/* Sales history */}
        <section
          aria-labelledby="sales-title"
          className={`${card} flex min-h-[22rem] min-w-0 flex-1 flex-col`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="sales-title" className="text-sm font-semibold text-foreground">
                Sales history
              </h2>
              {loadingSales ? (
                <div role="status" aria-label="Loading sales history" className="mt-2 space-y-2">
                  <span className={`block h-7 w-32 ${skeletonClass}`} />
                  <span className={`block h-3 w-48 max-w-full ${skeletonClass}`} />
                  <span className="sr-only">Loading sales history…</span>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    {formatAmount(salesTotal)}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/50">
                    Last {activeRange.label} · avg {formatAmount(salesAverage)} {activeRange.averageLabel}
                  </p>
                </>
              )}
            </div>

            <div
              role="group"
              aria-label="Sales range"
              className="flex gap-0.5 rounded-lg bg-foreground/5 p-0.5 text-xs"
            >
              {ranges.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  aria-pressed={range === r.key}
                  className={`rounded-md px-3 py-1.5 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    range === r.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {loadingSales ? (
            <div role="status" aria-label="Loading sales chart" className={`mt-4 h-64 w-full min-w-0 sm:h-72 ${skeletonClass}`} />
          ) : (
          <div className="mt-4 h-64 w-full min-w-0 flex-none sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData} margin={{ left: -12, right: 4, top: 4 }}>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="rgba(var(--primary-rgba), 0.1)"
                />
                <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={compact}
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(var(--primary-rgba), 0.06)" }}
                  contentStyle={tooltipStyle}
                  formatter={(value) => [formatAmount(Number(value ?? 0)), "Sales"]}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {salesData.map((d, i) => (
                    <Cell
                      key={d.label}
                      // Latest period at full strength, earlier ones softer
                      fill={`rgba(var(--primary-rgba), ${
                        i === salesData.length - 1 ? 1 : 0.4
                      })`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          )}
        </section>
      </div>

      {/* Categories: compact cards, current value only */}
      <section aria-labelledby="categories-title">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="categories-title" className="text-sm font-semibold text-foreground">
            Categories
            {loadingCategories ? (
              <span aria-hidden="true" className={`ml-2 inline-block h-3 w-6 align-middle ${skeletonClass}`} />
            ) : (
              <span className="ml-2 font-normal text-foreground/45">{pageInfo.total}</span>
            )}
          </h2>
          <Link
            href="/user/add-category"
            className="rounded text-sm font-medium text-primary outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Manage categories
          </Link>
        </div>

        {loadingCategories ? (
          <div role="status" aria-label="Loading dashboard categories" className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
            {Array.from({ length: Math.min(CATEGORIES_PER_PAGE, 4) }).map((_, index) => (
              <div key={index} aria-hidden="true" className="rounded-xl border border-foreground/10 bg-background px-4 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`h-4 w-2/3 ${skeletonClass}`} />
                  <span className={`h-3 w-8 ${skeletonClass}`} />
                </div>
                <span className={`mt-4 block h-6 w-1/2 ${skeletonClass}`} />
                <span className={`mt-2 block h-3 w-1/3 ${skeletonClass}`} />
                <span className={`mt-3 block h-1 w-full ${skeletonClass}`} />
              </div>
            ))}
            <span className="sr-only">Loading categories…</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-foreground/15 p-8 text-center text-sm text-foreground/60">
            You haven&rsquo;t added any categories yet.{" "}
            <Link
              href="/user/add-category"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Add your first category
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
            {categories.map((c, i) => {
              const progress =
                c.goal > 0 ? Math.min((c.allocated / c.goal) * 100, 100) : c.percent;

              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected({ id: c.id, name: c.name, amount: c.available })}
                    aria-haspopup="dialog"
                    aria-label={`Withdraw from ${c.name}, balance ${formatAmount(c.available)}`}
                    className="relative isolate block w-full overflow-hidden rounded-xl border border-foreground/10 bg-background px-4 py-3.5 text-left outline-none transition-colors hover:border-primary/40 hover:bg-foreground/[0.02] focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {/* Otter mascot as a soft background on the right of the card */}
                    <Image
                      src={c.icons || DEFAULT_OTTER}
                      alt=""
                      width={112}
                      height={112}
                      unoptimized
                      aria-hidden="true"
                      className="pointer-events-none absolute -bottom-4 -right-3 -z-10 h-28 w-28 opacity-30"
                    />

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm text-foreground/70">
                          {c.name}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-foreground/45">
                        {c.percent}%
                      </span>
                    </div>

                    <p className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-foreground">
                      {formatAmount(c.available)}
                    </p>
                    <p className="mt-0.5 text-xs text-foreground/50">
                      {c.goal > 0
                        ? c.goalReached
                          ? `Goal reached · ${formatAmount(c.goal)}`
                          : `Goal ${formatAmount(c.goal)}`
                        : "No goal"}
                    </p>

                    <div
                      aria-hidden="true"
                      className="mt-2.5 h-1 overflow-hidden rounded-full bg-foreground/8"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: colorForIndex(i),
                        }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {pageInfo.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1 || loadingCategories}
              className="rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/80 outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs tabular-nums text-foreground/50">
              Page {page} of {pageInfo.totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(p + 1, pageInfo.totalPages))}
              disabled={page >= pageInfo.totalPages || loadingCategories}
              className="rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/80 outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}

        {!loadingCategories && pageInfo.total > 0 && pageInfo.totalPercent < 100 && (
          <p className="mt-3 text-xs text-foreground/50">
            {Math.round((100 - pageInfo.totalPercent) * 100) / 100}% of incoming funds is
            not assigned to a category.
          </p>
        )}
      </section>

      {selected && (
        <WithdrawDialog
          key={selected.id}
          category={selected}
          formatAmount={formatAmount}
          email={email}
          onClose={() => setSelected(null)}
          network={network}
          withdrawAll={selected.id === "__all__"}
          onWithdrawn={(id, amount) =>
            setWithdrawn((prev) => ({
              ...prev,
              [id]: (prev[id] ?? 0) + amount,
            }))
          }
        />
      )}
    </div>
  );
}
