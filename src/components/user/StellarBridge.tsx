"use client";

import { useCallback, useEffect, useState } from "react";
import { Fetch_to } from "@/utilities";
import routes from "@/routes/user.json";
import walletNetworks from "@/config/json_conf/wallet_networks.json";
import EvmToStellarBridge from "@/components/user/EvmToStellarBridge";

type Props = { walletAddress: string };
const config = walletNetworks.stellar.bridge;
type Destination = keyof typeof config.networks;
type Quote = {
  amount: string;
  receiveAmount: string;
  routeFee: string;
  availableBalance: string;
  nativeFee: string;
  nativeAsset: string;
  destination: string;
  recipient: string;
  destinationEid: number;
};
type TransactionDetails = {
  hash: string;
  successful: boolean;
  ledger: number;
  createdAt: string;
  feeCharged: string;
  sourceAccount: string;
  operationCount: number;
  memo: string | null;
};
const destinations = Object.entries(config.networks) as [Destination, (typeof config.networks)[Destination]][];
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 7 });

function DirectionArrow({ vertical = false }: { vertical?: boolean } = {}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={`h-6 w-6 shrink-0 ${vertical ? "rotate-90" : ""}`}>
      <path d="M4 12h15m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function StellarBridge({ walletAddress }: Props) {
  const [direction, setDirection] = useState<"stellar-to-evm" | "evm-to-stellar">("stellar-to-evm");
  const [destination, setDestination] = useState<Destination>(destinations[0][0]);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [password, setPassword] = useState("");
  const [balance, setBalance] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [txHash, setTxHash] = useState("");
  const [transactionDetails, setTransactionDetails] = useState<TransactionDetails | null>(null);
  const [transactionLookup, setTransactionLookup] = useState<"idle" | "loading" | "found" | "pending" | "error">("idle");
  const [busy, setBusy] = useState<"balance" | "quote" | "bridge" | null>(null);
  const [error, setError] = useState("");

  const refreshBalance = useCallback(async () => {
    setBusy("balance");
    try {
      const response = await Fetch_to("POST", routes["bridge-non-evm"], { action: "balance" }, undefined, 1);
      if (!response.success) throw new Error(response.message || "Could not load USDT0 balance.");
      const data = response.data as { balance?: string };
      if (typeof data.balance !== "string") throw new Error("Invalid Stellar balance response.");
      setBalance(data.balance);
    } catch {
      setBalance(null);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => { void refreshBalance(); }, [refreshBalance, walletAddress]);

  const fetchTransactionDetails = useCallback(async (hash: string, cancelled?: () => boolean) => {
    setTransactionLookup("loading");
    setTransactionDetails(null);
    for (let attempt = 0; attempt < 5; attempt++) {
      if (cancelled?.()) return;
      const response = await Fetch_to("POST", routes["stellar-transaction"], { hash }, undefined, 1);
      if (response.success) {
        const transaction = response.data?.transaction as TransactionDetails | undefined;
        if (transaction && typeof transaction.successful === "boolean") {
          if (!cancelled?.()) {
            setTransactionDetails(transaction);
            setTransactionLookup("found");
          }
          return;
        }
      }
      if (attempt < 4) await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    if (!cancelled?.()) setTransactionLookup("pending");
  }, []);

  useEffect(() => {
    if (!txHash) return;
    let cancelled = false;
    void fetchTransactionDetails(txHash, () => cancelled).catch(() => {
      if (!cancelled) setTransactionLookup("error");
    });
    return () => { cancelled = true; };
  }, [fetchTransactionDetails, txHash]);

  const request = async (action: "quote" | "bridge") => {
    setError("");
    if (action === "quote") setQuote(null);
    setBusy(action);
    try {
      const response = await Fetch_to("POST", routes["bridge-non-evm"], {
        action, destination, amount: amount.trim(), recipient: recipient.trim(),
        ...(action === "bridge" ? { password } : {}),
      }, undefined, 1);
      if (!response.success) throw new Error(response.message || "The Stellar bridge request failed.");
      const data = response.data as { quote?: Quote; txHash?: string };
      if (action === "quote") {
        if (!data.quote) throw new Error("The bridge service returned an invalid quote.");
        setQuote(data.quote);
        setBalance(data.quote.availableBalance);
      } else {
        if (!data.txHash) throw new Error("The Stellar RPC did not return a transaction hash.");
        setTxHash(data.txHash);
        setPassword("");
        void refreshBalance();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The Stellar bridge request failed.");
    } finally {
      setBusy(null);
    }
  };

  const clearQuote = () => { setQuote(null); setTxHash(""); setPassword(""); setError(""); setTransactionDetails(null); setTransactionLookup("idle"); };

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Bridge direction" className="grid grid-cols-2 gap-1 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-1">
        <button type="button" onClick={() => { setDirection("stellar-to-evm"); clearQuote(); }} aria-pressed={direction === "stellar-to-evm"} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${direction === "stellar-to-evm" ? "bg-primary text-white" : "text-foreground/60 hover:bg-foreground/[0.04]"}`}><span>Stellar</span><DirectionArrow /><span>Ethereum / Arbitrum</span></button>
        <button type="button" onClick={() => { setDirection("evm-to-stellar"); clearQuote(); }} aria-pressed={direction === "evm-to-stellar"} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${direction === "evm-to-stellar" ? "bg-primary text-white" : "text-foreground/60 hover:bg-foreground/[0.04]"}`}><span>Ethereum</span><DirectionArrow /><span>Stellar</span></button>
      </div>
      {direction === "evm-to-stellar" ? <EvmToStellarBridge walletAddress={walletAddress} /> : (
    <form onSubmit={(event) => { event.preventDefault(); if (quote && password) void request("bridge"); }} className="min-w-0 rounded-2xl border border-foreground/10 bg-background p-4 shadow-xl shadow-black/5 sm:p-6 lg:p-7">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] sm:items-end sm:gap-4">
        <div>
          <label htmlFor="stellar-bridge-source" className="mb-2 block text-xs font-medium uppercase tracking-wide text-foreground/50">From</label>
          <div id="stellar-bridge-source" className="flex h-16 min-w-0 flex-col justify-center rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 sm:h-[72px]">
            <p className="truncate font-semibold text-foreground">Stellar</p>
            <p className="mt-1 text-xs text-foreground/50">USDT0 · Stellar</p>
          </div>
        </div>
        <div aria-hidden="true" className="flex items-center justify-center text-primary sm:pb-3"><span className="sm:hidden"><DirectionArrow vertical /></span><span className="hidden sm:inline-flex"><DirectionArrow /></span></div>
        <div>
          <label htmlFor="stellar-bridge-destination" className="mb-2 block text-xs font-medium uppercase tracking-wide text-foreground/50">To</label>
          <div className="relative">
            <select id="stellar-bridge-destination" value={destination} onChange={(event) => { setDestination(event.target.value as Destination); clearQuote(); }} disabled={busy !== null || Boolean(txHash)} className="h-16 w-full appearance-none rounded-xl border border-foreground/15 bg-foreground/[0.05] px-4 pr-10 text-sm text-foreground outline-none transition hover:bg-foreground/[0.07] focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-60 sm:h-[72px]">
              {destinations.map(([key, item]) => <option key={key} value={key} className="bg-background text-foreground">{item.label} · USDT0 (LayerZero)</option>)}
            </select>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/60"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <label htmlFor="stellar-bridge-amount" className="text-xs font-medium uppercase tracking-wide text-foreground/50">Amount · USDT0</label>
            <span className="text-xs font-medium tabular-nums text-foreground/55" aria-live="polite">{busy === "balance" ? "Balance loading…" : `Balance: ${numberFormat.format(Number(balance ?? "0"))} USDT0`}</span>
          </div>
          <input id="stellar-bridge-amount" type="number" min="0.000001" step="0.0000001" inputMode="decimal" placeholder="Amount to bridge" value={amount} onChange={(event) => { setAmount(event.target.value); clearQuote(); }} disabled={busy !== null || Boolean(txHash)} required className="h-12 w-full min-w-0 rounded-xl border border-foreground/15 bg-background px-4 text-sm text-foreground outline-none transition placeholder:text-foreground/35 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-60" />
        </div>
        <div>
          <label htmlFor="stellar-bridge-recipient" className="mb-2 block text-xs font-medium uppercase tracking-wide text-foreground/50">Recipient wallet on {config.networks[destination].label}</label>
          <input id="stellar-bridge-recipient" type="text" autoComplete="off" spellCheck={false} placeholder="0x... (recipient wallet address)" value={recipient} onChange={(event) => { setRecipient(event.target.value); clearQuote(); }} disabled={busy !== null || Boolean(txHash)} required className="h-12 w-full min-w-0 rounded-xl border border-foreground/15 bg-background px-4 font-mono text-xs text-foreground outline-none transition placeholder:font-sans placeholder:text-foreground/35 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-60 sm:text-sm" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/50">
        <span className="break-all">Your Stellar wallet: <span className="font-mono">{walletAddress}</span></span>
      </div>
      <p className="mt-3 text-xs leading-5 text-foreground/50">Enter the destination wallet for USDT0. LayerZero quotes the transfer amount and XLM network fee before you confirm.</p>

      {!quote && !txHash && <button type="button" onClick={() => void request("quote")} disabled={busy !== null || !amount || !recipient.trim()} className="mt-5 min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50">{busy === "quote" ? "Checking bridge…" : "Review bridge"}</button>}

      {quote && !txHash && <div className="mt-5 space-y-3 rounded-xl border border-primary/15 bg-primary/[0.04] p-4 sm:p-5">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm"><span className="text-foreground/55">You send</span><span className="font-medium tabular-nums">{numberFormat.format(Number(quote.amount))} USDT0</span></div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm"><span className="text-foreground/55">OFT fee and precision adjustment</span><span className="font-medium tabular-nums">{numberFormat.format(Number(quote.routeFee))} USDT0</span></div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm"><span className="text-foreground/55">LayerZero message fee</span><span className="font-medium tabular-nums">{numberFormat.format(Number(quote.nativeFee))} XLM</span></div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-foreground/10 pt-3 text-sm"><span className="font-medium">Estimated receive</span><span className="font-semibold tabular-nums">{numberFormat.format(Number(quote.receiveAmount))} USDT0</span></div>
        <p className="text-xs text-foreground/45">XLM is also needed for the Stellar network fee.</p>
      </div>}

      {quote && !txHash && <>
        <label htmlFor="stellar-bridge-password" className="mt-5 block text-sm font-medium text-foreground">Confirm with your account password</label>
        <input id="stellar-bridge-password" type="password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} disabled={busy !== null} required className="mt-2 h-12 w-full min-w-0 rounded-xl border border-foreground/15 bg-background px-4 text-sm text-foreground outline-none transition focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-60" />
        <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100/80">This submits a Stellar mainnet transaction from your Otterpie wallet. LayerZero delivery to {config.networks[destination].label} is asynchronous.</p>
        <button type="submit" disabled={busy !== null || !password} className="mt-4 min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50">{busy === "bridge" ? "Submitting bridge…" : `Bridge ${numberFormat.format(Number(quote.amount))} USDT0`}</button>
      </>}

      {txHash && <div role="status" className={`mt-5 rounded-lg border p-4 text-sm ${transactionDetails && !transactionDetails.successful ? "border-red-500/25 bg-red-500/5" : "border-emerald-500/25 bg-emerald-500/5"}`}>
        <p className={`font-semibold ${transactionDetails && !transactionDetails.successful ? "text-red-300" : "text-emerald-300"}`}>
          {transactionDetails ? transactionDetails.successful ? "Stellar deposit confirmed" : "Stellar transaction failed" : "Bridge request submitted"}
        </p>
        <p className="mt-1 text-foreground/65">
          {transactionDetails && !transactionDetails.successful
            ? "The source transaction failed. Check the explorer record before trying again."
            : transactionDetails?.successful
              ? "The Stellar deposit is confirmed. Destination delivery is now pending LayerZero."
              : "Waiting for Horizon to confirm the Stellar deposit. LayerZero delivery starts after confirmation."}
        </p>
        {transactionLookup === "loading" && <p className="mt-3 text-xs text-foreground/55">Fetching transaction confirmation from Stellar…</p>}
        {transactionDetails && <dl className="mt-4 grid gap-2 border-t border-foreground/10 pt-3 text-xs sm:grid-cols-2">
          <div><dt className="text-foreground/45">Stellar status</dt><dd className={`mt-0.5 font-medium ${transactionDetails.successful ? "text-emerald-300" : "text-red-300"}`}>{transactionDetails.successful ? "Confirmed" : "Failed"}</dd></div>
          <div><dt className="text-foreground/45">Ledger</dt><dd className="mt-0.5 font-medium tabular-nums">{transactionDetails.ledger}</dd></div>
          <div><dt className="text-foreground/45">Network fee</dt><dd className="mt-0.5 font-medium tabular-nums">{(Number(transactionDetails.feeCharged) / 10_000_000).toFixed(7)} XLM</dd></div>
          <div><dt className="text-foreground/45">Operations</dt><dd className="mt-0.5 font-medium tabular-nums">{transactionDetails.operationCount}</dd></div>
          <div className="sm:col-span-2"><dt className="text-foreground/45">Included at</dt><dd className="mt-0.5 font-medium">{new Date(transactionDetails.createdAt).toLocaleString()}</dd></div>
        </dl>}
        {transactionLookup === "pending" && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-amber-200"><span>Horizon has not indexed this transaction yet.</span><button type="button" onClick={() => void fetchTransactionDetails(txHash)} className="underline underline-offset-2">Fetch again</button></div>}
        {transactionLookup === "error" && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-amber-200"><span>Could not fetch transaction details.</span><button type="button" onClick={() => void fetchTransactionDetails(txHash)} className="underline underline-offset-2">Retry</button></div>}
        <a href={`https://stellar.expert/explorer/public/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all font-mono text-xs text-primary underline underline-offset-4">View deposit transaction: {txHash}</a>
      </div>}
      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      <section aria-label="Supported Stellar bridge destinations" className="mt-6 border-t border-foreground/10 pt-5">
        <h2 className="text-sm font-semibold text-foreground">Supported destinations</h2>
        <p className="mt-1 text-sm text-foreground/55">{destinations.map(([, item]) => item.label).join(", ")} · USDT0 through LayerZero.</p>
        <p className="mt-2 text-xs text-foreground/45">Keep enough XLM for the LayerZero message fee and Soroban network resources.</p>
      </section>
    </form>
      )}
    </div>
  );
}
