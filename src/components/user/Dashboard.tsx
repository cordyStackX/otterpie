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
import { isBotChainNetwork } from "@/utilities/network";
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

function hueFromHex(color: string | undefined) {
  const match = color?.match(/^#([\da-f]{6})$/i);
  if (!match) return 190;
  const value = Number.parseInt(match[1], 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 190;
  const hue = max === r
    ? ((g - b) / delta) % 6
    : max === g
      ? (b - r) / delta + 2
      : (r - g) / delta + 4;
  return ((hue * 60) % 360 + 360) % 360;
}

type FormatAmount = (value: number) => string;

const makeFormatter = (symbol: string): FormatAmount => {
  const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 7 });
  return (value: number) => `${nf.format(value)} ${symbol}`.trim();
};

const compact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumSignificantDigits: 3,
  }).format(value);

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
// Each category shows its percentage of the current native wallet balance.
//
//   category amount = min(current balance × percent ÷ 100, goal)
//   available       = category amount − pending withdrawal (never below 0)
//
// Amounts stay in the same on-chain wallet; categories are a tracking view.
// ---------------------------------------------------------------------------
type CategoryRule = {
  id: string; // unique per category (crypto.randomUUID() when created)
  name: string;
  percent: number; // 0–100
  goal: number;
  icons?: string; // icon path under /public, stored with the category
  color?: string;
};

type CategoryBalance = CategoryRule & {
  available: number; // what can be withdrawn right now
};

// Stellar amounts have at most 7 decimals; rounding avoids 0.30000000000000004
const round7 = (n: number) => Math.round(n * 1e7) / 1e7;

function allocate(
  rules: CategoryRule[],
  balance: number,
  withdrawn: Record<string, number> = {}
): CategoryBalance[] {
  return rules.map((r) => {
    const share = round7((Math.max(balance, 0) * r.percent) / 100);
    const allocated = r.goal > 0 ? Math.min(share, r.goal) : share;
    const taken = withdrawn[r.id] ?? 0;

    return {
      ...r,
      available: round7(Math.max(allocated - taken, 0)),
    };
  });
}

// Each category stores its own icon path; this is the fallback if it is missing.
const DEFAULT_OTTER = "/icons/otters/otter-default.svg";

const CATEGORIES_PER_PAGE = 10;
const REFRESH_MS = 30_000; // how often the balance and transaction data refresh

// Both balance routes return balances as [{ asset, issuer, balance }]
const toSlices = (balances: { asset: string; balance: string }[]): Slice[] =>
  balances
    .map((b) => ({ name: b.asset, amount: parseFloat(b.balance) }))
    .filter((b) => Number.isFinite(b.amount));

type Category = { id: string; name: string; amount: number };
type Slice = { name: string; amount: number; color?: string };

// Incoming totals use the network's native coin.
type Incoming = {
  id: string;
  date: string;
  amount: number;
  direction?: "received" | "sent";
  status?: "Completed" | "Failed";
};

// Both transaction routes return [{ date, amount, asset, ... }]; keep only the
// network's own coin so the chart is in one unit.
const toIncoming = (
  txs: {
    id: string;
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
    .map((t) => ({ id: t.id, date: t.date, amount: parseFloat(t.amount), direction: t.direction, status: t.status }))
    .filter((t) => Number.isFinite(t.amount));

// Groups incoming payments into 7 daily or 12 monthly buckets (local time)
function buildTransfers(incoming: Incoming[], range: Range) {
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
  asset,
  network,
  email,
  formatAmount,
  onClose,
  onWithdrawn,
}: {
  category: Category;
  asset: string;
  network: string;
  email: string;
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
    if (!Number.isFinite(amountNumber) || amountNumber <= 0 || amountNumber > balance) {
      setError("Enter an amount greater than zero and no more than the available balance.");
      return;
    }
    setError("");
    setStatus("submitting");
    const endpoint = network === "stellar"
      ? withdrawRoutes.withdraw_stellar
      : isBotChainNetwork(network)
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
        asset,
        password,
        email,
      });
      if (!response.success) throw new Error(response.message || "The transfer could not be submitted.");
      const result = response.data as { txHash?: string; amount?: string };
      setSentTo(trimmed);
      setTxHash(result.txHash || "");
      if (result.amount) setAmount(result.amount);
      if (category.id !== "__wallet__") onWithdrawn(category.id, amountNumber);
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
              Withdrawal submitted
            </h2>
            <p className="mt-1.5 text-sm text-foreground/60">
              {formatAmount(Number(amount))} was submitted to{" "}
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
                {category.id === "__wallet__" ? `Withdraw ${asset}` : `Withdraw ${asset} from ${category.name}`}
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

            <label htmlFor="withdraw-amount" className="mt-5 block text-sm font-medium text-foreground">
              Amount ({asset})
            </label>
            <input
              id="withdraw-amount"
              type="number"
              min="0"
              max={balance}
              step={asset === "XLM" ? "0.0000001" : "any"}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (error) setError("");
              }}
              disabled={submitting || balance === 0}
              className="mt-1.5 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/25 disabled:opacity-50"
            />

            <label
              htmlFor="wallet-address"
              className="mt-4 block text-sm font-medium text-foreground"
            >
              Wallet address
            </label>
            {asset === "PIE" && (
              <p className="mt-2 text-xs text-foreground/50">BOT pays the network fee for this PIE transfer.</p>
            )}
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
                {submitting ? `Withdrawing ${asset}…` : "Withdraw"}
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

  // Category amounts are percentages of the current native balance.
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [allGoalRules, setAllGoalRules] = useState<CategoryRule[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1, totalPercent: 0 });
  const [withdrawn, setWithdrawn] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Category | null>(null);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<"BOT" | "PIE">("PIE");
  const [swapDirection, setSwapDirection] = useState<{ from: "BOT" | "PIE"; to: "BOT" | "PIE" } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Wallet balance (pie chart), formatted by the active network's ticker
  const [walletData, setWalletData] = useState<Slice[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingTransfers, setLoadingTransfers] = useState(true);
  const activeSymbol = network === "stellar" ? "XLM" : isBotChainNetwork(network) ? selectedAsset : "";
  const formatAmount = useMemo(() => makeFormatter(activeSymbol), [activeSymbol]);

  const nativeBalance = walletData.find((slice) => slice.name === activeSymbol)?.amount ?? 0;
  const isPieSelected = isBotChainNetwork(network) && activeSymbol === "PIE";
  const formatTransferAmount = formatAmount;
  const isEmptyWallet = !loadingBalance && nativeBalance === 0;

  const categories = allocate(rules, nativeBalance, withdrawn);
  const balanceTarget = allGoalRules.length > 0 && allGoalRules.every((rule) => rule.goal > 0 && rule.percent > 0)
    ? round7(Math.max(...allGoalRules.map((rule) => rule.goal / (rule.percent / 100))))
    : null;
  const allGoalsReached = balanceTarget !== null && nativeBalance >= balanceTarget;

  // Show the native balance by category, with any remainder left unassigned.
  const categorySlices = categories
    .map((category) => ({
      name: category.name,
      amount: category.available,
      color: category.color,
    }))
    .filter((slice) => slice.amount > 0);
  const categorizedTotal = categorySlices.reduce((sum, slice) => sum + slice.amount, 0);
  const unassignedAmount = round7(Math.max(nativeBalance - categorizedTotal, 0));
  const pieData: Slice[] = nativeBalance === 0
    ? [{ name: "Empty", amount: 1 }]
    : [
        ...categorySlices,
        ...(unassignedAmount > 0 ? [{ name: "Unassigned", amount: unassignedAmount, color: "#64748b" }] : []),
      ];

  const activeRange = ranges.find((r) => r.key === range)!;
  const transferData = useMemo(() => buildTransfers(incoming, range), [incoming, range]);
  const receivedTotal = round7(transferData.reduce((sum, d) => sum + d.amount, 0));
  const receivedAverage = Math.round((receivedTotal / transferData.length) * 100) / 100;

  // Category rules come from the database (jsonb column)
  useEffect(() => {
    let cancelled = false;

    const loadRules = async () => {
      if (!email || !activeSymbol) return;
      setLoadingCategories(true);
      setRules([]);
      setAllGoalRules([]);
      setPageInfo({ total: 0, totalPages: 1, totalPercent: 0 });
      try {
        const response = await Fetch_to("POST", routes.categories, {
          email,
          asset: activeSymbol,
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
          const allResponse = await Fetch_to("POST", routes.categories, {
            email,
            asset: activeSymbol,
            page: 1,
            limit: 50,
          });
          if (!cancelled && allResponse.success) setAllGoalRules(allResponse.data.rules);
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
  }, [email, page, activeSymbol]);

  // Wallet balance + transaction history: load once, then refresh every 30 seconds.
  // The full transaction history is needed to build category allocations accurately.
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let firstLoad = true;
    let historyComplete = false;

    // Start clean so data from a previous account/network never lingers
    setWalletData([]);
    setIncoming([]);
    setWithdrawn({});

    const config =
      network === "stellar"
        ? {
            balance: routes.stellar_balance,
            transactions: routes.stellar_transactions,
            symbol: "XLM",
          }
        : isBotChainNetwork(network)
          ? {
              balance: routes.bot_chain_balance,
              transactions: routes.bot_chain_transactions,
              symbol: selectedAsset,
            }
          : null;

    const getBalance = async () => {
      if (inFlight) return; // never stack requests when the network is slow
      inFlight = true;

      // Only the first load shows "Loading balance…"; refreshes update quietly
      if (firstLoad) {
        setLoadingBalance(true);
        setLoadingTransfers(true);
      }

      // null = that request failed, so keep whatever is already on screen
      let slices: Slice[] | null = null;
      let incomingTx: Incoming[] | null = null;
      let loadedTransferSymbol = config?.symbol ?? "";
      const loadFullHistory = !historyComplete;

      if (config) {
        try {
          const response = await Fetch_to("POST", config.balance, { email });
          if (response.success) slices = toSlices(response.data.balances);
        } catch {
          // Keep the previous balance
        }

        // Separate try so a transactions failure never wipes out the balance
        try {
          let txResponse = await Fetch_to("POST", config.transactions, {
            email,
            asset: activeSymbol,
          });
          if (txResponse.success) {
            if (typeof txResponse.data.asset === "string") loadedTransferSymbol = txResponse.data.asset;
            const txs = [...txResponse.data.transactions];
            let cursor: string | null = txResponse.data.nextCursor ?? null;
            let complete = true;
            const seenCursors = new Set<string>();

            while (loadFullHistory && cursor) {
              if (seenCursors.has(cursor)) {
                complete = false;
                break;
              }
              seenCursors.add(cursor);
              txResponse = await Fetch_to("POST", config.transactions, { email, cursor, asset: activeSymbol });
              if (!txResponse.success) {
                complete = false;
                break;
              }
              if (typeof txResponse.data.asset === "string") loadedTransferSymbol = txResponse.data.asset;
              txs.push(...txResponse.data.transactions);
              cursor = txResponse.data.nextCursor ?? null;
              if (txResponse.data.hasMore && !cursor) {
                complete = false;
                break;
              }
            }

            if (complete) incomingTx = toIncoming(txs, loadedTransferSymbol);
          }
        } catch {
          // Keep the previous transfer history
        }
      }

      inFlight = false;
      if (cancelled) return;

      if (slices) {
        setWalletData(slices);
        setWithdrawn({});
      }
      if (incomingTx) {
        if (loadFullHistory) historyComplete = true;
        setIncoming((current) => {
          if (loadFullHistory) return incomingTx!;
          const merged = new Map(current.map((tx) => [tx.id, tx]));
          for (const tx of incomingTx!) merged.set(tx.id, tx);
          return Array.from(merged.values());
        });
      }
      if (slices || incomingTx) setLastUpdated(new Date());

      if (firstLoad) {
        firstLoad = false;
        setLoadingBalance(false);
        setLoadingTransfers(false);
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
  }, [email, network, selectedAsset]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-foreground/55">
          Your wallet balance, categories and recent transfers.
          {lastUpdated && ` Updated ${lastUpdated.toLocaleTimeString()}.`}
        </p>
      </header>

      {/* Top row: wallet balance and transfer history */}
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
              <div aria-hidden="true" className={`flex h-44 w-44 items-center justify-center rounded-full border-[14px] border-foreground/10 sm:h-48 sm:w-48 ${skeletonClass}`}>
                <div className="flex flex-col items-center gap-2">
                  <span className={`h-3 w-16 ${skeletonClass}`} />
                  <span className={`h-6 w-28 ${skeletonClass}`} />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="relative my-auto h-48 w-full flex-none sm:h-52">
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
                  <p className="text-xs text-foreground/50">{activeSymbol === "PIE" ? "PIE balance" : "Native balance"}</p>
                  <p className="max-w-[62%] break-words text-center text-sm font-semibold leading-tight tabular-nums tracking-tight text-foreground sm:text-base">
                    {formatAmount(nativeBalance)}
                  </p>
                </div>
              </div>
            </>
          )}

          {!loadingBalance && (
            <div className="mb-4 rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-2.5 text-center">
              <p className="text-[11px] font-medium text-foreground/55">Balance target for all goals</p>
              {balanceTarget === null ? (
                <p className="mt-1 text-xs text-foreground/50">Set a goal and share for every category</p>
              ) : (
                <>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{formatAmount(balanceTarget)}</p>
                  <p className="mt-0.5 text-[11px] text-foreground/50">{allGoalsReached ? "All category goals reached" : `${formatAmount(nativeBalance)} current balance`}</p>
                </>
              )}
            </div>
          )}

          <div className="mt-auto flex w-full shrink-0 flex-col gap-2">
            {isBotChainNetwork(network) && (
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setSelectedAsset(isPieSelected ? "BOT" : "PIE");
                }}
                aria-label={isPieSelected ? "Switch to BOT Chain" : "Switch to PIE"}
                className="flex w-full items-center justify-center gap-1 rounded-md border border-yellow-400/50 bg-yellow-400/15 px-2 py-2 text-xs font-semibold text-yellow-300 outline-none transition-colors hover:bg-yellow-400/25 focus-visible:ring-2 focus-visible:ring-yellow-300/50"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m7 4 4 4-4 4" />
                  <path d="M11 8H3" />
                  <path d="m17 20-4-4 4-4" />
                  <path d="M13 16h8" />
                </svg>
                <span className="truncate">Switch to {isPieSelected ? "BOT Chain" : "PIE"}</span>
              </button>
            )}
            <div className="flex w-full gap-2">
              {!isPieSelected && (
                <button
                  type="button"
                  onClick={() => setSelected({ id: "__wallet__", name: "wallet", amount: nativeBalance })}
                  disabled={loadingBalance || nativeBalance <= 0 || !activeSymbol}
                  className="min-w-0 flex-1 rounded-md border border-primary/30 px-2 py-2 text-xs font-medium text-primary outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
                >
                  Withdraw
                </button>
              )}
              {isBotChainNetwork(network) && (
                <button
                  type="button"
                  onClick={() => setSwapDirection(isPieSelected ? { from: "PIE", to: "BOT" } : { from: "BOT", to: "PIE" })}
                  disabled={loadingBalance || nativeBalance <= 0}
                  className="min-w-0 flex-1 rounded-md border border-emerald-400/50 bg-emerald-500/15 px-2 py-2 text-xs font-semibold text-emerald-300 outline-none transition-colors hover:bg-emerald-500/25 focus-visible:ring-2 focus-visible:ring-emerald-300/50 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
                >
                  Swap {isPieSelected ? "PIE to BOT" : "BOT to PIE"}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Transfer history */}
        <section
          aria-labelledby="transfer-title"
          className={`${card} flex min-h-[22rem] min-w-0 flex-1 flex-col`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="transfer-title" className="text-sm font-semibold text-foreground">
            {isBotChainNetwork(network) ? `${activeSymbol} transfer history` : "Transfer history"}
              </h2>
              {loadingTransfers ? (
                <div role="status" aria-label="Loading transfer history" className="mt-2 space-y-2">
                  <span className={`block h-7 w-32 ${skeletonClass}`} />
                  <span className={`block h-3 w-48 max-w-full ${skeletonClass}`} />
                  <span className="sr-only">Loading transfer history…</span>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    {formatTransferAmount(receivedTotal)}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/50">
                    Received · last {activeRange.label} · avg {formatTransferAmount(receivedAverage)} {activeRange.averageLabel}
                  </p>
                </>
              )}
            </div>

            <div
              role="group"
              aria-label="Transfer history range"
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

          {loadingTransfers ? (
            <div role="status" aria-label="Loading transfer chart" className={`mt-4 h-64 w-full min-w-0 sm:h-72 ${skeletonClass}`} />
          ) : (
          <div className="mt-4 h-64 w-full min-w-0 flex-none sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={transferData} margin={{ left: -12, right: 4, top: 4 }}>
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
                  formatter={(value) => [formatTransferAmount(Number(value ?? 0)), "Received"]}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {transferData.map((d, i) => (
                    <Cell
                      key={d.label}
                      // Latest period at full strength, earlier ones softer
                      fill={`rgba(var(--primary-rgba), ${
                        i === transferData.length - 1 ? 1 : 0.4
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
            {activeSymbol ? `${activeSymbol} categories` : "Categories"}
            {loadingCategories ? (
              <span aria-hidden="true" className={`ml-2 inline-block h-3 w-6 align-middle ${skeletonClass}`} />
            ) : (
              <span className="ml-2 font-normal text-foreground/45">{pageInfo.total}</span>
            )}
          </h2>
          <Link
            href={`/user/add-category?asset=${encodeURIComponent(activeSymbol || "BOT")}`}
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
              const progress = c.goal > 0 ? Math.min((c.available / c.goal) * 100, 100) : 0;

              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isPieSelected) setSelected({ id: c.id, name: c.name, amount: c.available });
                    }}
                    disabled={isPieSelected}
                    aria-haspopup={isPieSelected ? undefined : "dialog"}
                    aria-label={isPieSelected
                      ? `${c.name}, ${formatAmount(c.available)} PIE category`
                      : `Withdraw from ${c.name}, balance ${formatAmount(c.available)}`}
                    className={`relative isolate block w-full overflow-hidden rounded-xl border border-foreground/10 border-l-4 bg-background px-4 py-3.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-default ${isPieSelected ? "" : "hover:bg-foreground/[0.02]"}`}
                    style={{ borderLeftColor: c.color || colorForIndex(i) }}
                  >
                    {/* Otter mascot as a soft background on the right of the card */}
                    <Image
                      src={c.icons || DEFAULT_OTTER}
                      alt=""
                      width={112}
                      height={112}
                      unoptimized
                      aria-hidden="true"
                      className="pointer-events-none absolute -bottom-4 -right-3 -z-10 h-28 w-28 opacity-40"
                      style={{
                        filter: `grayscale(0.35) sepia(0.7) saturate(2.2) hue-rotate(${hueFromHex(c.color) - 25}deg)`,
                      }}
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
                      Goal {c.goal > 0 ? formatAmount(c.goal) : "not set"}
                    </p>

                    <div
                      aria-hidden="true"
                      className="mt-2.5 h-1 overflow-hidden rounded-full bg-foreground/8"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: c.color || colorForIndex(i),
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
            {Math.round((100 - pageInfo.totalPercent) * 100) / 100}% of the current balance is
            not assigned to a category.
          </p>
        )}
      </section>

      {selected && !isPieSelected && (
        <WithdrawDialog
          key={selected.id}
          category={selected}
          asset={activeSymbol}
          formatAmount={formatAmount}
          email={email}
          onClose={() => setSelected(null)}
          network={network}
          onWithdrawn={(id, amount) =>
            setWithdrawn((prev) => ({
              ...prev,
              [id]: (prev[id] ?? 0) + amount,
            }))
          }
        />
      )}
      {swapDirection && (
        <SwapPreviewDialog
          key={`${swapDirection.from}-${swapDirection.to}`}
          from={swapDirection.from}
          to={swapDirection.to}
          balance={nativeBalance}
          email={email}
          onSwapped={async () => {
            const response = await Fetch_to("POST", routes.bot_chain_balance, { email }, undefined, 1);
            if (response.success) {
              setWalletData(toSlices(response.data.balances));
              setLastUpdated(new Date());
            }
          }}
          onClose={() => setSwapDirection(null)}
        />
      )}
    </div>
  );
}

function SwapPreviewDialog({
  from,
  to,
  balance,
  onSwapped,
  onClose,
}: {
  from: "BOT" | "PIE";
  to: "BOT" | "PIE";
  balance: number;
  email: string;
  onSwapped: () => Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [password, setPassword] = useState("");
  const [quote, setQuote] = useState<{ amountOut: string; minimumReceived: string; slippage: number } | null>(null);
  const [busy, setBusy] = useState<"quote" | "swap" | null>(null);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 7 });
  const direction = from === "PIE" ? "PIE_TO_BOT" : "BOT_TO_PIE";
  const canQuote = Number.isFinite(Number(amount)) && Number(amount) > 0 && Number(amount) <= balance;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const requestQuote = async () => {
    setError("");
    setQuote(null);
    setBusy("quote");
    try {
      const response = await Fetch_to("POST", routes.swap, {
        action: "quote",
        direction,
        amount: amount.trim(),
        slippage: Number(slippage),
      }, undefined, 1);
      if (!response.success) throw new Error(response.message || "Could not get a swap quote.");
      const result = response.data as { quote?: { amountOut: string; minimumReceived: string; slippage: number } };
      if (!result.quote) throw new Error("The swap service returned an invalid quote.");
      setQuote(result.quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get a swap quote.");
    } finally {
      setBusy(null);
    }
  };

  const submitSwap = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quote) return;
    if (!password) {
      setError("Enter your account password to confirm this swap.");
      return;
    }
    setError("");
    setBusy("swap");
    try {
      const response = await Fetch_to("POST", routes.swap, {
        action: "swap",
        direction,
        amount: amount.trim(),
        slippage: quote.slippage,
        password,
      }, undefined, 1);
      if (!response.success) throw new Error(response.message || "The swap could not be submitted.");
      const result = response.data as { txHash?: string };
      setTxHash(result.txHash || "");
      setPassword("");
      await onSwapped();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The swap could not be submitted.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="swap-preview-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClick={(event) => {
        if (!busy && event.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-foreground/10 bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/30 backdrop:backdrop-blur-[2px]"
    >
      <form onSubmit={submitSwap} className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="swap-preview-title" className="text-lg font-semibold tracking-tight">Swap {from} to {to}</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={busy !== null}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <label htmlFor="swap-amount" className="mt-5 block text-sm font-medium">You pay ({from})</label>
        <input
          id="swap-amount"
          type="number"
          min="0"
          max={balance}
          step="any"
          value={amount}
          onChange={(event) => { setAmount(event.target.value); setQuote(null); setError(""); }}
          placeholder="0"
          disabled={busy !== null || Boolean(txHash)}
          className="mt-1.5 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/25"
        />
        <p className="mt-1 text-xs text-foreground/50">Available: {formatter.format(balance)} {from}</p>
        <label htmlFor="swap-slippage" className="mt-4 block text-sm font-medium">Max slippage (%)</label>
        <input
          id="swap-slippage"
          type="number"
          min="0.1"
          max="5"
          step="0.1"
          value={slippage}
          onChange={(event) => { setSlippage(event.target.value); setQuote(null); }}
          disabled={busy !== null || Boolean(txHash)}
          className="mt-1.5 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/25 disabled:opacity-50"
        />
        {quote && (
          <div className="mt-4 rounded-lg bg-foreground/5 px-4 py-3">
            <p className="text-xs text-foreground/55">Estimated output</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatter.format(Number(quote.amountOut))} {to}</p>
            <p className="mt-1 text-xs text-foreground/50">Minimum received: {formatter.format(Number(quote.minimumReceived))} {to} · BDEX V2 fee: 0.3%</p>
          </div>
        )}
        <p className="mt-4 rounded-md border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-200">
          Real BOT Chain mainnet swap. BOT is also needed for gas. Review the quote and minimum output before confirming; swaps cannot be reversed.
        </p>
        {!txHash && !quote && (
          <button
            type="button"
            onClick={requestQuote}
            disabled={!canQuote || busy !== null || !Number.isFinite(Number(slippage)) || Number(slippage) < 0.1 || Number(slippage) > 5}
            className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "quote" ? "Getting quote…" : "Get swap quote"}
          </button>
        )}
        {quote && !txHash && (
          <>
            <label htmlFor="swap-password" className="mt-4 block text-sm font-medium">Confirm with your account password</label>
            <input
              id="swap-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError(""); }}
              disabled={busy !== null}
              required
              className="mt-1.5 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/25 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy !== null || !password}
              className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "swap" ? "Submitting swap…" : `Confirm swap ${from} to ${to}`}
            </button>
          </>
        )}
        {txHash && (
          <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            Swap confirmed. Transaction: <span className="break-all font-mono">{txHash}</span>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          disabled={busy !== null}
          className="mt-4 w-full rounded-md border border-foreground/15 px-4 py-2.5 text-sm font-medium text-foreground/80 outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
        >
          {txHash ? "Done" : "Cancel"}
        </button>
      </form>
    </dialog>
  );
}
