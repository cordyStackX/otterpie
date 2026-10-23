"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Fetch_to } from "@/utilities";
import { getWalletNetworkConfig, walletAssetLabel, walletNetworkLabel } from "@/utilities/network";

type BalanceProps = { email: string; network: string };
type WalletBalance = { asset: string; balance: string; issuer?: string | null; contract?: string; custom?: boolean; decimals?: number; trustline?: boolean };
type ManagedToken =
  | { type: "evm"; address: string; symbol: string; decimals: number }
  | { type: "stellar"; code: string; issuer: string };
type StellarSwapAsset = { code: string; issuer: string | null; balance: string };
type EvmSwapAsset = { symbol: string; address: string | null; decimals: number; balance: string };

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
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [managedTokens, setManagedTokens] = useState<ManagedToken[]>([]);
  const [tokenCode, setTokenCode] = useState("");
  const [tokenIssuer, setTokenIssuer] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [tokenNotice, setTokenNotice] = useState("");
  const [swapOpen, setSwapOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const config = getWalletNetworkConfig(network);
  const requestKey = `${network}:${email}`;
  const activeRequestKey = useRef(requestKey);
  const [loadedKey, setLoadedKey] = useState("");
  const showSkeleton = Boolean(email && config?.routes.balance && (loading || loadedKey !== requestKey));

  const loadManagedTokens = useCallback(async () => {
    if (!config) return;
    if (!config.routes.manageTokens) return;
    const response = await Fetch_to("POST", config.routes.manageTokens, { action: "list", network });
    if (!response.success) return;
    const data = response.data as { tokens?: ManagedToken[] };
    setManagedTokens(Array.isArray(data?.tokens) ? data.tokens : []);
  }, [config, network]);

  useEffect(() => { void loadManagedTokens(); }, [loadManagedTokens]);

  const updateManagedTokens = async (body: Record<string, string>) => {
    setTokenBusy(true);
    setTokenError("");
    setTokenNotice("");
    try {
      const response = await Fetch_to("POST", config?.routes.manageTokens ?? "/services/supabase/user/manage_tokens", { ...body, network });
      if (!response.success) throw new Error(response.message || "Could not update your token list.");
      const data = response.data as { tokens?: ManagedToken[] };
      setManagedTokens(Array.isArray(data.tokens) ? data.tokens : []);
      setTokenAddress("");
      setTokenCode("");
      setTokenIssuer("");
      setTokenNotice(body.action === "remove" ? "Token removed from your list." : "Token added to your list.");
      await loadBalances(false);
    } catch (e) {
      setTokenError(e instanceof Error ? e.message : "Could not update your token list.");
    } finally {
      setTokenBusy(false);
    }
  };

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

  const withdrawAssets = useMemo(() => {
    if (config?.walletType === "stellar") {
      return balances.filter((item) => item.asset === "XLM").map((item) => ({ asset: item.asset, balance: Number(item.balance), decimals: 7 }));
    }
    if (config?.family === "bot_chain") {
      return balances.filter((item) => ["BOT", "PIE", "USDT"].includes(item.asset)).map((item) => ({
        asset: item.asset,
        balance: Number(item.balance),
        decimals: item.decimals ?? (item.asset === "USDT" ? 6 : 18),
      }));
    }
    return [];
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
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Balances</h1>
          <p className="mt-1 text-xs text-foreground/55 sm:text-sm">
            {config ? `Assets held in your ${walletNetworkLabel(network)} wallet.` : "Your wallet assets across supported networks."}
            {updatedAt && ` Updated ${updatedAt.toLocaleTimeString()}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadBalances(false)}
          disabled={showSkeleton || refreshing || !email || !config?.routes.balance}
          className="rounded-md border border-foreground/15 px-3 py-2 text-xs font-medium text-foreground/75 outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
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

      {config && (
        <section className="rounded-xl border border-foreground/10 bg-background p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground sm:text-base">Manage tokens</h2>
              <p className="mt-1 text-xs text-foreground/55 sm:text-sm">
                {config.walletType === "stellar"
                  ? "Import Stellar classic assets by asset code and issuer. A trustline is required to hold a balance."
                  : "Import ERC-20 tokens deployed on BOT Chain by contract address."}
              </p>
            </div>
            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
              {config.routes.withdraw && <button type="button" disabled={showSkeleton || !withdrawAssets.some((item) => item.balance > 0)} onClick={() => setWithdrawOpen(true)} className="min-w-0 rounded-md border border-foreground/15 px-2 py-2 text-xs font-semibold leading-tight text-foreground/80 hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm">Withdraw</button>}
              {(config.walletType === "stellar" || config.walletType === "evm") && <button type="button" disabled={showSkeleton || orderedBalances.length < 2} onClick={() => setSwapOpen(true)} className="min-w-0 rounded-md border border-primary/40 px-2 py-2 text-xs font-semibold leading-tight text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-sm"><span className="sm:hidden">Swap</span><span className="hidden sm:inline">Swap tokens</span></button>}
              <button type="button" onClick={() => { setTokenDialogOpen((open) => !open); setTokenError(""); setTokenNotice(""); }} className="min-w-0 rounded-md bg-primary px-2 py-2 text-xs font-semibold leading-tight text-background hover:opacity-90 sm:px-4 sm:text-sm">
                <span className="sm:hidden">{tokenDialogOpen ? "Close manager" : "Manage tokens"}</span>
                <span className="hidden sm:inline">{tokenDialogOpen ? "Close token manager" : "Add or manage tokens"}</span>
              </button>
            </div>
          </div>

          {tokenDialogOpen && (
            <div className="mt-5 border-t border-foreground/10 pt-5">
              <form onSubmit={(event) => { event.preventDefault(); void updateManagedTokens(config.walletType === "stellar"
                ? { action: "add", code: tokenCode, issuer: tokenIssuer }
                : { action: "add", address: tokenAddress }); }} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                {config.walletType === "stellar" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-medium text-foreground/70">Asset code
                      <input value={tokenCode} onChange={(event) => setTokenCode(event.target.value)} maxLength={12} required placeholder="USDC" className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
                    </label>
                    <label className="text-xs font-medium text-foreground/70">Issuer public key
                      <input value={tokenIssuer} onChange={(event) => setTokenIssuer(event.target.value)} required placeholder="G..." className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/50" />
                    </label>
                  </div>
                ) : (
                  <label className="text-xs font-medium text-foreground/70">BOT Chain ERC-20 contract address
                    <input value={tokenAddress} onChange={(event) => setTokenAddress(event.target.value)} required placeholder="0x..." className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/50" />
                  </label>
                )}
                <button disabled={tokenBusy} className="self-end rounded-md border border-primary/40 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50">{tokenBusy ? "Saving…" : "Add token"}</button>
              </form>

              {managedTokens.length > 0 ? (
                <ul className="mt-5 divide-y divide-foreground/10 rounded-lg border border-foreground/10">
                  {managedTokens.map((token) => {
                    const key = token.type === "evm" ? `evm:${token.address.toLowerCase()}` : `stellar:${token.code}:${token.issuer}`;
                    const label = token.type === "evm" ? `${token.symbol} · ${token.address}` : `${token.code} · ${token.issuer}`;
                    return <li key={key} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-xs text-foreground/75">
                      <span className="break-all">{label}</span>
                      <button type="button" disabled={tokenBusy} onClick={() => void updateManagedTokens({ action: "remove", key })} className="text-red-400 hover:underline disabled:opacity-50">Remove</button>
                    </li>;
                  })}
                </ul>
              ) : <p className="mt-4 text-sm text-foreground/45">No custom tokens saved for this wallet.</p>}
              {tokenNotice && <p role="status" className="mt-3 text-sm text-emerald-400">{tokenNotice}</p>}
              {tokenError && <p role="alert" className="mt-3 text-sm text-red-400">{tokenError}</p>}
              {config.walletType === "evm" && <p className="mt-4 text-xs text-foreground/45">Imported tokens appear in balances. Swaps are available only for assets with a configured BOT Chain liquidity route.</p>}
              {config.walletType === "stellar" && <p className="mt-4 text-xs text-foreground/45">Importing a token only tracks it here; your Stellar account must establish its trustline before it can hold the asset.</p>}
            </div>
          )}
        </section>
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
                key={`${item.contract ?? item.asset}-${item.issuer ?? "native"}`}
                className={`rounded-xl border p-4 sm:p-5 ${signatureAsset ? "border-primary/35 bg-primary/[0.06] ring-1 ring-primary/10" : "border-foreground/10 bg-background"}`}
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
                <p className="mt-5 break-all text-xl font-semibold tabular-nums tracking-tight text-foreground sm:mt-6 sm:text-2xl">
                  {formatBalance(item.balance)} <span className="text-sm font-medium text-foreground/55">{item.asset}</span>
                </p>
                {item.issuer && <p className="mt-2 break-all text-[10px] text-foreground/40 sm:text-[11px]">Issuer: {item.issuer}</p>}
                {item.trustline === false && <p className="mt-2 text-[10px] leading-4 text-amber-200/75 sm:text-[11px]">Trustline not enabled · required to receive USDT0</p>}
                {item.contract && <p className="mt-2 break-all text-[10px] text-foreground/40 sm:text-[11px]">Contract: {item.contract}</p>}
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

      {swapOpen && config?.walletType === "stellar" && config.routes.swap && (
        <StellarSwapDialog route={config.routes.swap}
          assets={balances.filter((item) => item.issuer !== undefined || item.asset === "XLM")
            .map((item) => ({ code: item.asset, issuer: item.issuer ?? null, balance: item.balance }))}
          onClose={() => setSwapOpen(false)} onSwapped={() => loadBalances(false)} />
      )}
      {swapOpen && config?.walletType === "evm" && config.routes.swap && (
        <EvmSwapDialog route={config.routes.swap}
          assets={balances.map((item) => ({
            symbol: item.asset,
            address: item.contract ?? null,
            decimals: item.decimals ?? (item.asset === "BOT" ? 18 : item.asset === "PIE" ? 18 : item.asset === "USDT" ? 6 : 18),
            balance: item.balance,
          }))}
          onClose={() => setSwapOpen(false)} onSwapped={() => loadBalances(false)} />
      )}
      {withdrawOpen && config?.routes.withdraw && (
        <BalanceWithdrawDialog route={config.routes.withdraw} email={email} assets={withdrawAssets}
          onClose={() => setWithdrawOpen(false)} onWithdrawn={() => loadBalances(false)} />
      )}
    </div>
  );
}

function BalanceWithdrawDialog({ route, email, assets, onClose, onWithdrawn }: {
  route: string;
  email: string;
  assets: { asset: string; balance: number; decimals: number }[];
  onClose: () => void;
  onWithdrawn: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [asset, setAsset] = useState(assets.find((item) => item.balance > 0)?.asset ?? assets[0]?.asset ?? "");
  const selected = assets.find((item) => item.asset === asset) ?? assets[0];
  const balance = selected?.balance ?? 0;
  const [amount, setAmount] = useState(selected?.balance ? String(selected.balance) : "");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ amount: string; txHash: string; address: string } | null>(null);

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!selected || !Number.isFinite(value) || value <= 0 || value > balance || !address.trim() || !password) {
      setError("Enter a valid amount, destination address, and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await Fetch_to("POST", route, { email, asset, address: address.trim(), amount: amount.trim(), password });
      if (!response.success) throw new Error(response.message || "The withdrawal could not be submitted.");
      const data = response.data as { amount?: string; txHash?: string };
      setResult({ amount: data.amount || amount.trim(), txHash: data.txHash || "", address: address.trim() });
      setPassword("");
      await onWithdrawn();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The withdrawal could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialogRef} aria-labelledby="balance-withdraw-title" onClose={onClose}
      onCancel={(event) => { if (busy) event.preventDefault(); }}
      onClick={(event) => { if (event.target === dialogRef.current && !busy) dialogRef.current?.close(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-foreground/10 bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/30 backdrop:backdrop-blur-[2px]">
      <div className="p-6">
        {result ? (
          <div className="text-center">
            <h2 id="balance-withdraw-title" className="text-lg font-semibold">Withdrawal submitted</h2>
            <p className="mt-2 text-sm text-foreground/60">{result.amount} {asset} sent to <span className="break-all font-mono">{result.address}</span>.</p>
            {result.txHash && <p className="mt-2 break-all font-mono text-xs text-foreground/50">Transaction: {result.txHash}</p>}
            <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-background">Done</button>
          </div>
        ) : (
          <form onSubmit={(event) => void submit(event)}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-medium text-primary">{selected?.asset === "XLM" ? "Stellar" : "BOT Chain"}</p><h2 id="balance-withdraw-title" className="mt-1 text-lg font-semibold">Withdraw assets</h2></div>
              <button type="button" aria-label="Close" disabled={busy} onClick={() => dialogRef.current?.close()} className="text-2xl leading-none text-foreground/50">×</button>
            </div>
            {assets.length > 1 && <label className="mt-4 block text-sm font-medium">Asset<select value={asset} onChange={(event) => { const next = assets.find((item) => item.asset === event.target.value); setAsset(event.target.value); setAmount(next?.balance ? String(next.balance) : ""); setError(""); }} disabled={busy} className="mt-1.5 block w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm">{assets.map((item) => <option key={item.asset} value={item.asset}>{item.asset} · {item.balance}</option>)}</select></label>}
            <p className="mt-4 rounded-lg bg-foreground/5 px-4 py-3 text-sm">Available: <strong>{balance} {asset}</strong></p>
            <label className="mt-4 block text-sm font-medium">Amount ({asset})<input type="number" min="0" max={balance} step={selected ? `0.${"0".repeat(Math.max(selected.decimals - 1, 0))}1` : "any"} value={amount} onChange={(event) => setAmount(event.target.value)} disabled={busy || balance <= 0} required className="mt-1.5 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm" /></label>
            <label className="mt-4 block text-sm font-medium">Destination wallet address<input value={address} onChange={(event) => setAddress(event.target.value)} disabled={busy} required autoComplete="off" spellCheck={false} placeholder={asset === "XLM" ? "G..." : "0x..."} className="mt-1.5 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 font-mono text-sm" /></label>
            <label className="mt-4 block text-sm font-medium">Confirm with your password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} required className="mt-1.5 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm" /></label>
            {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={busy || balance <= 0} className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">{busy ? "Submitting withdrawal…" : `Withdraw ${asset}`}</button>
          </form>
        )}
      </div>
    </dialog>
  );
}

function EvmSwapDialog({ route, assets, onClose, onSwapped }: {
  route: string;
  assets: EvmSwapAsset[];
  onClose: () => void;
  onSwapped: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const keyOf = (asset: EvmSwapAsset) => asset.address?.toLowerCase() ?? "native";
  const positiveAssets = assets.filter((asset) => Number(asset.balance) > 0);
  const initialFrom = positiveAssets[0];
  const [fromKey, setFromKey] = useState(initialFrom ? keyOf(initialFrom) : "");
  const [toKey, setToKey] = useState(assets.find((asset) => keyOf(asset) !== (initialFrom ? keyOf(initialFrom) : ""))
    ? keyOf(assets.find((asset) => keyOf(asset) !== (initialFrom ? keyOf(initialFrom) : ""))!) : "");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [password, setPassword] = useState("");
  const [quote, setQuote] = useState<{ amountOut: string; minimumReceived: string; availableBalance: string } | null>(null);
  const [busy, setBusy] = useState<"quote" | "swap" | null>(null);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const findAsset = (key: string) => assets.find((asset) => keyOf(asset) === key);
  const from = findAsset(fromKey);
  const to = findAsset(toKey);
  const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 7 });
  const label = (asset: EvmSwapAsset) => `${asset.symbol}${asset.address ? ` · ${asset.address.slice(0, 6)}…${asset.address.slice(-4)}` : " · native"}`;
  const payload = (asset: EvmSwapAsset) => ({ symbol: asset.symbol, address: asset.address });
  useEffect(() => { if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal(); }, []);

  const requestQuote = async () => {
    if (!from || !to) return;
    setBusy("quote"); setError(""); setQuote(null);
    try {
      const response = await Fetch_to("POST", route, { action: "quote", from: payload(from), to: payload(to), amount: amount.trim(), slippage: Number(slippage) }, undefined, 1);
      if (!response.success) throw new Error(response.message || "No swap quote is available for this pair.");
      const result = response.data as { quote?: { amountOut: string; minimumReceived: string; availableBalance: string } };
      if (!result.quote) throw new Error("The swap service returned an invalid quote.");
      setQuote(result.quote);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not get a swap quote."); }
    finally { setBusy(null); }
  };

  const submitSwap = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quote || !from || !to) return;
    setBusy("swap"); setError("");
    try {
      const response = await Fetch_to("POST", route, { action: "swap", from: payload(from), to: payload(to), amount: amount.trim(), slippage: Number(slippage), password }, undefined, 1);
      if (!response.success) throw new Error(response.message || "The swap could not be submitted.");
      const result = response.data as { txHash?: string };
      setTxHash(result.txHash || ""); setPassword(""); await onSwapped();
    } catch (e) { setError(e instanceof Error ? e.message : "The swap could not be submitted."); }
    finally { setBusy(null); }
  };

  const changeFrom = (key: string) => {
    setFromKey(key);
    if (toKey === key) setToKey(assets.find((asset) => keyOf(asset) !== key) ? keyOf(assets.find((asset) => keyOf(asset) !== key)!) : "");
    setQuote(null); setError("");
  };

  return <dialog ref={dialogRef} onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-foreground/10 bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/30 backdrop:backdrop-blur-[2px]">
    <form onSubmit={submitSwap} className="p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium text-primary">BOT Chain · DEX route</p><h2 className="mt-1 text-lg font-semibold">Swap tokens</h2></div><button type="button" disabled={busy !== null} onClick={() => dialogRef.current?.close()} className="text-2xl leading-none text-foreground/50">×</button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-foreground/65">You pay
          <select value={fromKey} onChange={(event) => changeFrom(event.target.value)} disabled={busy !== null || Boolean(txHash)} className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground">
            {positiveAssets.map((asset) => <option key={keyOf(asset)} value={keyOf(asset)}>{label(asset)} · {fmt.format(Number(asset.balance))}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-foreground/65">You receive
          <select value={toKey} onChange={(event) => { setToKey(event.target.value); setQuote(null); setError(""); }} disabled={busy !== null || Boolean(txHash)} className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground">
            {assets.filter((asset) => keyOf(asset) !== fromKey).map((asset) => <option key={keyOf(asset)} value={keyOf(asset)}>{label(asset)}</option>)}
          </select>
        </label>
      </div>
      <label className="mt-4 block text-xs font-medium text-foreground/65">Amount to swap
        <input type="number" min="0" step="any" value={amount} onChange={(event) => { setAmount(event.target.value); setQuote(null); }} disabled={busy !== null || Boolean(txHash)} placeholder="0" className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground" />
      </label>
      <label className="mt-4 block text-xs font-medium text-foreground/65">Max slippage (%)
        <input type="number" min="0.1" max="5" step="0.1" value={slippage} onChange={(event) => { setSlippage(event.target.value); setQuote(null); }} disabled={busy !== null || Boolean(txHash)} className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground" />
      </label>
      {quote && <div className="mt-4 rounded-lg bg-foreground/5 p-3"><p className="text-xs text-foreground/50">Estimated output</p><p className="mt-1 text-lg font-semibold">{quote.amountOut} {to?.symbol}</p><p className="text-xs text-foreground/50">Minimum received: {quote.minimumReceived} {to?.symbol}</p></div>}
      {!quote && !txHash && <button type="button" onClick={() => void requestQuote()} disabled={!from || !to || Number(amount) <= 0 || busy !== null || Number(slippage) < 0.1 || Number(slippage) > 5} className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">{busy === "quote" ? "Getting live quote…" : "Get swap quote"}</button>}
      {quote && !txHash && <><label className="mt-4 block text-xs font-medium text-foreground/65">Confirm with your account password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy !== null} className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground" /></label><button type="submit" disabled={!password || busy !== null} className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">{busy === "swap" ? "Submitting swap…" : "Confirm BOT Chain swap"}</button></>}
      {txHash && <p className="mt-4 break-all rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-400">Swap confirmed: {txHash}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
      <p className="mt-4 text-xs text-foreground/45">Quotes use available DEX pools and route through wrapped BOT for token-to-token pairs. Keep BOT for network fees. Imported tokens with no liquidity route cannot be swapped.</p>
    </form>
  </dialog>;
}

function StellarSwapDialog({ route, assets, onClose, onSwapped }: {
  route: string;
  assets: StellarSwapAsset[];
  onClose: () => void;
  onSwapped: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tradeable = assets.filter((asset) => !asset.code.startsWith("pool:"));
  const positiveAssets = tradeable.filter((asset) => Number(asset.balance) > 0);
  const sourceKey = (asset: StellarSwapAsset) => asset.issuer ? `${asset.code}:${asset.issuer}` : "XLM";
  const [source, setSource] = useState(positiveAssets[0] ? sourceKey(positiveAssets[0]) : "");
  const initialSource = positiveAssets[0] ? sourceKey(positiveAssets[0]) : "";
  const [destination, setDestination] = useState(tradeable.find((asset) => sourceKey(asset) !== initialSource)
    ? sourceKey(tradeable.find((asset) => sourceKey(asset) !== initialSource)!) : "");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [password, setPassword] = useState("");
  const [quote, setQuote] = useState<{ amountOut: string; minimumReceived: string; availableBalance: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"quote" | "swap" | null>(null);
  const [txHash, setTxHash] = useState("");
  const findAsset = (key: string) => tradeable.find((asset) => sourceKey(asset) === key);
  const selectedSource = findAsset(source);
  const selectedDestination = findAsset(destination);
  const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 7 });

  useEffect(() => { if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal(); }, []);
  const assetPayload = (asset: StellarSwapAsset) => ({ code: asset.code, issuer: asset.issuer });
  const requestQuote = async () => {
    if (!selectedSource || !selectedDestination) return;
    setBusy("quote"); setError(""); setQuote(null);
    try {
      const response = await Fetch_to("POST", route, { action: "quote", source: assetPayload(selectedSource), destination: assetPayload(selectedDestination), amount: amount.trim(), slippage: Number(slippage) }, undefined, 1);
      if (!response.success) throw new Error(response.message || "Could not quote this Stellar swap.");
      const data = response.data as { quote?: { amountOut: string; minimumReceived: string; availableBalance: string } };
      if (!data.quote) throw new Error("The swap service returned an invalid quote.");
      setQuote(data.quote);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not quote this Stellar swap."); }
    finally { setBusy(null); }
  };
  const submitSwap = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quote || !selectedSource || !selectedDestination) return;
    setBusy("swap"); setError("");
    try {
      const response = await Fetch_to("POST", route, { action: "swap", source: assetPayload(selectedSource), destination: assetPayload(selectedDestination), amount: amount.trim(), slippage: Number(slippage), password }, undefined, 1);
      if (!response.success) throw new Error(response.message || "The swap could not be submitted.");
      const result = response.data as { txHash?: string };
      setTxHash(result.txHash || ""); setPassword(""); await onSwapped();
    } catch (e) { setError(e instanceof Error ? e.message : "The swap could not be submitted."); }
    finally { setBusy(null); }
  };

  return <dialog ref={dialogRef} onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-foreground/10 bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/30 backdrop:backdrop-blur-[2px]">
    <form onSubmit={submitSwap} className="p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium text-primary">Stellar path payment</p><h2 className="mt-1 text-lg font-semibold">Swap assets</h2></div><button type="button" disabled={busy !== null} onClick={() => dialogRef.current?.close()} className="text-2xl leading-none text-foreground/50">×</button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-foreground/65">You pay
          <select value={source} onChange={(event) => { const next = event.target.value; setSource(next); if (destination === next) setDestination(tradeable.find((asset) => sourceKey(asset) !== next) ? sourceKey(tradeable.find((asset) => sourceKey(asset) !== next)!) : ""); setQuote(null); setError(""); }} disabled={busy !== null || Boolean(txHash)} className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground">
            {positiveAssets.map((asset) => <option key={sourceKey(asset)} value={sourceKey(asset)}>{asset.code} · {fmt.format(Number(asset.balance))}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-foreground/65">You receive
          <select value={destination} onChange={(event) => { setDestination(event.target.value); setQuote(null); setError(""); }} disabled={busy !== null || Boolean(txHash)} className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground">
            {tradeable.filter((asset) => sourceKey(asset) !== source).map((asset) => <option key={sourceKey(asset)} value={sourceKey(asset)}>{asset.code}</option>)}
          </select>
        </label>
      </div>
      <label className="mt-4 block text-xs font-medium text-foreground/65">Amount to swap
        <input type="number" min="0" step="any" value={amount} onChange={(event) => { setAmount(event.target.value); setQuote(null); }} disabled={busy !== null || Boolean(txHash)} placeholder="0" className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground" />
      </label>
      <label className="mt-4 block text-xs font-medium text-foreground/65">Max slippage (%)
        <input type="number" min="0.1" max="5" step="0.1" value={slippage} onChange={(event) => { setSlippage(event.target.value); setQuote(null); }} disabled={busy !== null || Boolean(txHash)} className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground" />
      </label>
      {quote && <div className="mt-4 rounded-lg bg-foreground/5 p-3"><p className="text-xs text-foreground/50">Estimated output</p><p className="mt-1 text-lg font-semibold">{quote.amountOut} {selectedDestination?.code}</p><p className="text-xs text-foreground/50">Minimum received: {quote.minimumReceived} {selectedDestination?.code}</p></div>}
      {!quote && !txHash && <button type="button" onClick={() => void requestQuote()} disabled={!selectedSource || !selectedDestination || Number(amount) <= 0 || busy !== null || Number(slippage) < 0.1 || Number(slippage) > 5} className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">{busy === "quote" ? "Getting live quote…" : "Get swap quote"}</button>}
      {quote && !txHash && <><label className="mt-4 block text-xs font-medium text-foreground/65">Confirm with your account password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy !== null} className="mt-1 w-full rounded-md border border-foreground/15 bg-background px-3 py-2.5 text-sm text-foreground" /></label><button type="submit" disabled={!password || busy !== null} className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">{busy === "swap" ? "Submitting swap…" : "Confirm Stellar swap"}</button></>}
      {txHash && <p className="mt-4 break-all rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-400">Swap submitted: {txHash}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
      <p className="mt-4 text-xs text-foreground/45">Quote and execution use Stellar’s available path liquidity. Keep XLM for network fees. The receiving asset needs a trustline.</p>
    </form>
  </dialog>;
}
