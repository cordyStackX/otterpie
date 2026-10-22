"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Fetch_to } from "@/utilities";
import { getWalletNetworkConfig, walletAssetLabel, walletNetworkLabel } from "@/utilities/network";

type BalanceProps = { email: string; network: string };
type WalletBalance = { asset: string; balance: string; issuer?: string | null };

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 7 });

function formatBalance(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? numberFormatter.format(amount) : value;
}

export default function Balance({ email, network }: BalanceProps) {
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const config = getWalletNetworkConfig(network);
  const requestKey = `${network}:${email}`;
  const activeRequestKey = useRef(requestKey);
  const [loadedKey, setLoadedKey] = useState("");
  const showSkeleton = Boolean(email && config?.routes.balance && (loading || loadedKey !== requestKey));

  useEffect(() => {
    activeRequestKey.current = requestKey;
  }, [requestKey]);

  const orderedBalances = useMemo(() => {
    const assets = config?.transactionAssets ?? [];
    return [...balances].sort((a, b) => {
      if (a.asset === "PIE" && b.asset !== "PIE") return -1;
      if (b.asset === "PIE" && a.asset !== "PIE") return 1;
      const indexA = assets.indexOf(a.asset);
      const indexB = assets.indexOf(b.asset);
      return (indexA < 0 ? Number.MAX_SAFE_INTEGER : indexA) - (indexB < 0 ? Number.MAX_SAFE_INTEGER : indexB)
        || a.asset.localeCompare(b.asset);
    });
  }, [balances, config]);

  const loadBalances = useCallback(async (showLoading: boolean) => {
    if (!email || !config?.routes.balance) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const response = await Fetch_to("POST", config.routes.balance, { email });
      if (!response.success) throw new Error(response.message || "Could not load wallet balances.");
      const data = response.data as { balances?: WalletBalance[] };
      if (!Array.isArray(data?.balances)) throw new Error("The balance service returned an invalid response.");
      if (activeRequestKey.current !== requestKey) return;
      setBalances(data.balances.filter((item) => typeof item.asset === "string" && typeof item.balance === "string"));
      setUpdatedAt(new Date());
    } catch (loadError) {
      if (activeRequestKey.current === requestKey) {
        setError(loadError instanceof Error ? loadError.message : "Could not load wallet balances.");
      }
    } finally {
      if (activeRequestKey.current === requestKey) {
        setLoading(false);
        setRefreshing(false);
        setLoadedKey(requestKey);
      }
    }
  }, [config, email, requestKey]);

  useEffect(() => {
    void loadBalances(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadBalances(false);
    }, 30_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [loadBalances]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-primary">Wallet overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Balances</h1>
          <p className="mt-1 text-sm text-foreground/55">
            {config ? `Assets held in your ${walletNetworkLabel(network)} wallet.` : "Your wallet assets across supported networks."}
            {updatedAt && ` Updated ${updatedAt.toLocaleTimeString()}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadBalances(false)}
          disabled={showSkeleton || refreshing || !email || !config?.routes.balance}
          className="rounded-md border border-foreground/15 px-3 py-2 text-sm font-medium text-foreground/75 outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh balances"}
        </button>
      </header>

      {!config && (
        <div role="alert" className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4 text-sm text-amber-200">
          Balance information is not configured for this wallet network.
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-400">
          <p>{error}</p>
          <button type="button" onClick={() => void loadBalances(true)} className="mt-2 font-medium underline underline-offset-4">
            Try again
          </button>
        </div>
      )}

      {showSkeleton ? (
        <div role="status" aria-label="Loading wallet balances" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} aria-hidden="true" className="animate-pulse rounded-xl border border-foreground/10 bg-background p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="h-4 w-16 rounded bg-foreground/10" />
                  <div className="h-3 w-28 rounded bg-foreground/[0.07]" />
                </div>
                <div className="h-9 w-9 rounded-full bg-foreground/[0.07]" />
              </div>
              <div className="mt-7 h-7 w-40 max-w-full rounded bg-foreground/10" />
            </div>
          ))}
          <span className="sr-only">Loading wallet balances…</span>
        </div>
      ) : orderedBalances.length > 0 ? (
        <section aria-label="Wallet assets" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orderedBalances.map((item) => {
            const signatureAsset = item.asset === "PIE";
            return (
              <article
                key={`${item.asset}-${item.issuer ?? "native"}`}
                className={`rounded-xl border p-5 ${signatureAsset ? "border-primary/35 bg-primary/[0.06] ring-1 ring-primary/10" : "border-foreground/10 bg-background"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">{item.asset}</h2>
                      {signatureAsset && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Otterpie</span>}
                    </div>
                    <p className="mt-1 text-xs text-foreground/50">{walletAssetLabel(network, item.asset)}</p>
                  </div>
                  <span aria-hidden="true" className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${signatureAsset ? "bg-primary/15 text-primary" : "bg-foreground/5 text-foreground/60"}`}>
                    {item.asset === "PIE" ? "P" : item.asset.slice(0, 1)}
                  </span>
                </div>
                <p className="mt-6 break-all text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {formatBalance(item.balance)} <span className="text-sm font-medium text-foreground/55">{item.asset}</span>
                </p>
                {item.issuer && <p className="mt-2 break-all text-[11px] text-foreground/40">Issuer: {item.issuer}</p>}
              </article>
            );
          })}
        </section>
      ) : !error && config ? (
        <div className="rounded-xl border border-dashed border-foreground/15 p-10 text-center">
          <h2 className="text-base font-semibold text-foreground">No assets found</h2>
          <p className="mt-1 text-sm text-foreground/55">Balances for this wallet will appear here.</p>
        </div>
      ) : null}
    </div>
  );
}
