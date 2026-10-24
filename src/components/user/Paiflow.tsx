"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Fetch_to } from "@/utilities";
import routes from "@/routes/user.json";

const PAIFLOW_URL = "https://beta.app.paiflow.xyz/";
const DEPLOYMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function Paiflow({ network }: { network: string }) {
  const [contractAddress, setContractAddress] = useState("");
  const [linkedAddress, setLinkedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentPassword, setPaymentPassword] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentTx, setPaymentTx] = useState<{ hash: string; explorerUrl: string } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isTestnet = network === "stellar_testnet";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const response = await Fetch_to("GET", routes.stellar_paiflow_trans);
      if (cancelled) return;
      if (response.success) {
        const address = response.data?.address;
        if (typeof address === "string" && DEPLOYMENT_ID_PATTERN.test(address)) {
          setLinkedAddress(address);
        } else if (typeof address === "string" && address) {
          setError("Your saved value is a contract address. Relink using the Paiflow deployment URL or ID to open its payment page.");
        }
      } else {
        setError(response.message || "Could not load the linked Paiflow.");
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const linkFlow = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    const response = await Fetch_to("POST", routes.stellar_paiflow_trans, {
      action: "link",
      address: contractAddress,
    });
    if (response.success && typeof response.data?.address === "string") {
      setLinkedAddress(response.data.address);
      setContractAddress("");
      setMessage("Paiflow linked to your account.");
    } else {
      setError(response.message || "Could not link this Paiflow.");
    }
    setSaving(false);
  };

  const unlinkFlow = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    const response = await Fetch_to("POST", routes.stellar_paiflow_trans, { action: "unlink" });
    if (response.success) {
      setLinkedAddress(null);
      setMessage("Paiflow unlinked from your account.");
    } else {
      setError(response.message || "Could not unlink this Paiflow.");
    }
    setSaving(false);
  };

  const sendPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPaymentBusy(true);
    setPaymentMessage("");
    setPaymentError("");
    setPaymentTx(null);
    const response = await Fetch_to("POST", routes.stellar_paiflow_pay, {
      amount: paymentAmount,
      password: paymentPassword,
    });
    if (response.success && typeof response.data?.txHash === "string") {
      setPaymentTx({ hash: response.data.txHash, explorerUrl: response.data.explorerUrl });
      setPaymentMessage(response.data.status === "PENDING"
        ? "Payment submitted and still confirming on Testnet. Check its status before trying again."
        : "USDC payment completed on Testnet.");
      setPaymentPassword("");
    } else {
      setPaymentError(response.message || "Could not send the Paiflow payment.");
    }
    setPaymentBusy(false);
  };

  return (
    <div className="space-y-6 text-foreground">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Stellar payment flows</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Paiflow</h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/55">
            Create a split flow in Paiflow, then link its deployment so you can open the Testnet payment page.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {isTestnet ? "Stellar Testnet" : "Stellar Mainnet"}
        </span>
      </header>

      {!isTestnet && (
        <div role="status" className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4">
          <h2 className="text-sm font-semibold text-amber-200">Paiflow currently supports Testnet only</h2>
          <p className="mt-1 text-sm leading-6 text-foreground/60">
            Paiflow’s current guide and starter target Stellar Testnet. Mainnet flows need Paiflow Mainnet deployment and API support; a Testnet contract cannot be used on Mainnet.
          </p>
          <Link href="/user/setting" className="mt-3 inline-flex text-sm font-semibold text-primary underline underline-offset-4">Switch to Stellar Testnet in Settings</Link>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M8 5h8a2 2 0 0 1 2 2v2M16 19H8a2 2 0 0 1-2-2v-2M14 6l4 3-4 3M10 18l-4-3 4-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/40">Step 1</p>
          <h2 className="mt-2 text-lg font-semibold">Build your split in Paiflow</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-foreground/55">
            Set the recipients and their shares, deploy the flow to Stellar Testnet, then copy the deployment URL or ID.
          </p>
          <a
            href={PAIFLOW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            Open Paiflow
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path d="M11 3h6v6m0-6-8 8M15 11v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <p className="mt-3 text-xs text-foreground/40">Opens beta.app.paiflow.xyz in a new tab.</p>
        </article>

        <article className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/40">Step 2</p>
          <h2 className="mt-2 text-lg font-semibold">Link your deployed flow</h2>
          <p className="mt-2 text-sm leading-6 text-foreground/55">
            Paste the Paiflow deployment URL or deployment ID. The contract address starting with C… is different. You can unlink the flow any time.
          </p>
          {loading ? (
            <div role="status" aria-label="Loading linked Paiflow" className="mt-6 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-foreground/10" />
              <div className="h-11 w-full animate-pulse rounded-lg bg-foreground/10" />
            </div>
          ) : linkedAddress ? (
            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
              <p className="text-xs font-medium text-foreground/55">Linked Paiflow deployment</p>
              <p className="mt-2 break-all font-mono text-sm text-foreground">{linkedAddress}</p>
              <form onSubmit={sendPayment} className="mt-5 border-t border-foreground/10 pt-5">
                <h3 className="text-sm font-semibold text-foreground">Send USDC from your Otterpie wallet</h3>
                <p className="mt-1 text-xs leading-5 text-foreground/50">
                  Testnet only. Otterpie will prepare the Paiflow deposit, sign it with your saved Stellar wallet, and submit it to the flow.
                </p>
                <label htmlFor="paiflow-payment-amount" className="mt-4 block text-xs font-medium text-foreground/65">USDC amount</label>
                <input
                  id="paiflow-payment-amount"
                  type="number"
                  min="0.0000001"
                  step="0.0000001"
                  inputMode="decimal"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  disabled={!isTestnet || paymentBusy}
                  required
                  className="mt-2 w-full rounded-lg border border-foreground/15 bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                />
                <label htmlFor="paiflow-payment-password" className="mt-4 block text-xs font-medium text-foreground/65">Confirm with your account password</label>
                <input
                  id="paiflow-payment-password"
                  type="password"
                  autoComplete="current-password"
                  value={paymentPassword}
                  onChange={(event) => setPaymentPassword(event.target.value)}
                  disabled={!isTestnet || paymentBusy}
                  required
                  className="mt-2 w-full rounded-lg border border-foreground/15 bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!isTestnet || paymentBusy || !paymentAmount || !paymentPassword}
                  className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {paymentBusy ? "Preparing and sending…" : `Send ${paymentAmount || "USDC"} to Paiflow`}
                </button>
                {paymentMessage && <p role="status" className="mt-3 text-sm text-emerald-400">{paymentMessage}</p>}
                {paymentError && <p role="alert" className="mt-3 text-sm text-rose-400">{paymentError}</p>}
                {paymentTx && (
                  <a href={paymentTx.explorerUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all font-mono text-xs text-primary underline underline-offset-4">
                    Testnet transaction: {paymentTx.hash}
                  </a>
                )}
              </form>
              <button
                type="button"
                onClick={unlinkFlow}
                disabled={saving}
                className="mt-4 rounded-lg border border-foreground/15 px-4 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:bg-foreground/5 disabled:opacity-50"
              >
                {saving ? "Please wait…" : "Unlink Paiflow"}
              </button>
            </div>
          ) : (
            <>
              <label htmlFor="paiflow-contract" className="mt-6 block text-xs font-medium text-foreground/65">
                Paiflow deployment URL or ID
              </label>
              <input
                id="paiflow-contract"
                type="text"
                value={contractAddress}
                onChange={(event) => setContractAddress(event.target.value.trim())}
                placeholder="https://beta.app.paiflow.xyz/deployments/… or deployment ID"
                disabled={!isTestnet || saving}
                autoComplete="off"
                spellCheck={false}
                className="mt-2 w-full rounded-lg border border-foreground/15 bg-background px-3 py-3 font-mono text-sm text-foreground outline-none placeholder:text-foreground/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                onClick={linkFlow}
                disabled={!isTestnet || saving || !contractAddress.trim()}
                className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Linking…" : "Link Paiflow"}
              </button>
            </>
          )}
          {message && <p role="status" className="mt-3 text-sm text-emerald-400">{message}</p>}
          {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
          <p className="mt-3 text-xs leading-5 text-foreground/40">
            Linking saves the deployment ID to your account. Payments use your saved Otterpie Stellar wallet and require your account password confirmation.
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6" aria-labelledby="paiflow-how-title">
        <h2 id="paiflow-how-title" className="text-sm font-semibold">How the flow will work in Otterpie</h2>
        <div className="mt-4 grid gap-4 text-sm text-foreground/55 sm:grid-cols-3">
          <p><span className="font-semibold text-foreground">1.</span> Create and deploy the split flow in Paiflow.</p>
          <p><span className="font-semibold text-foreground">2.</span> Link its deployment URL or ID here. You can unlink it whenever you need.</p>
          <p><span className="font-semibold text-foreground">3.</span> Review recipients and confirm a payment with your Stellar wallet.</p>
        </div>
      </section>
    </div>
  );
}
