"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Fetch_to } from "@/utilities";
import routes from "@/routes/user.json";

const PAIFLOW_URL = "https://beta.app.paiflow.xyz/";
const DEPLOYMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FLOWS = 5;

type PaiflowEntry = { id: string; createdAt: string; deploymentId: string; name: string };
type PaiflowTransaction = { hash: string; explorerUrl: string; amount: string; deploymentId: string };
type USDCCategory = { id: string; name: string; percent: number; goal: number };

export default function Paiflow({ network, email }: { network: string; email: string }) {
  const [flows, setFlows] = useState<PaiflowEntry[]>([]);
  const [usdcCategories, setUsdcCategories] = useState<USDCCategory[]>([]);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [deploymentId, setDeploymentId] = useState("");
  const [deploymentToken, setDeploymentToken] = useState("");
  const [flowName, setFlowName] = useState("");
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [loadingFlows, setLoadingFlows] = useState(true);
  const [savingFlow, setSavingFlow] = useState(false);
  const [removingFlowId, setRemovingFlowId] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [transaction, setTransaction] = useState<PaiflowTransaction | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingFlows, setEditingFlows] = useState(false);
  const isTestnet = network === "stellar_testnet";

  const loadFlows = useCallback(async () => {
    setLoadingFlows(true);
    const response = await Fetch_to("GET", routes.stellar_paiflow_flows, {}, undefined, 1);
    if (response.success) {
      const entries = Array.isArray(response.data?.flows) ? response.data.flows as PaiflowEntry[] : [];
      setFlows(entries);
      setSelectedFlowId((current) => entries.some((flow) => flow.id === current) ? current : entries[0]?.id ?? "");
      setError("");
    } else {
      setError(response.message || "Could not load your saved Paiflow deployments.");
    }
    setLoadingFlows(false);
  }, []);

  useEffect(() => {
    if (isTestnet) {
      void loadFlows();
      void Promise.all([
        Fetch_to("POST", routes.categories, { email, asset: "USDC", page: 1, limit: 50 }),
        Fetch_to("POST", routes.stellar_balance, { email }),
      ]).then(([categoryResponse, balanceResponse]) => {
        if (categoryResponse.success) {
          const rules = Array.isArray(categoryResponse.data?.rules) ? categoryResponse.data.rules : [];
          const categories = rules.filter((item: unknown): item is USDCCategory => {
            if (!item || typeof item !== "object") return false;
            const rule = item as Partial<USDCCategory>;
            return typeof rule.id === "string" && typeof rule.name === "string" &&
              Number.isFinite(Number(rule.percent)) && Number.isFinite(Number(rule.goal));
          }).map((rule: USDCCategory) => ({ ...rule, percent: Number(rule.percent), goal: Number(rule.goal) }));
          setUsdcCategories(categories);
          setSelectedCategoryId((current) => categories.some((category: USDCCategory) => category.id === current)
            ? current
            : categories[0]?.id ?? "");
        }
        if (balanceResponse.success) {
          const balances = Array.isArray(balanceResponse.data?.balances) ? balanceResponse.data.balances : [];
          setUsdcBalance(Math.max(0, Number(balances.find((item: { asset?: string }) => item.asset === "USDC")?.balance) || 0));
        }
      }).catch(() => {
        setUsdcCategories([]);
        setUsdcBalance(0);
      });
    }
    else setLoadingFlows(false);
  }, [isTestnet, loadFlows, email]);

  const categoryBudgets = usdcCategories.map((category: USDCCategory) => ({
    ...category,
    available: Math.max(0, Math.min(usdcBalance * category.percent / 100, category.goal > 0 ? category.goal : Number.POSITIVE_INFINITY)),
  }));
  const unassignedBudget = Math.max(0, usdcBalance - categoryBudgets.reduce((sum, category: USDCCategory & { available: number }) => sum + category.available, 0));
  const selectedCategory = categoryBudgets.find((category: USDCCategory & { available: number }) => category.id === selectedCategoryId);
  const selectedBudget = selectedCategory?.available ?? unassignedBudget;

  const addFlow = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!DEPLOYMENT_ID_PATTERN.test(deploymentId.trim())) {
      setError("Paste the Paiflow deployment ID, not a contract address.");
      return;
    }
    setSavingFlow(true);
    const response = await Fetch_to("POST", routes.stellar_paiflow_flows, {
      deploymentId: deploymentId.trim(),
      deploymentToken: deploymentToken.trim(),
      name: flowName.trim(),
    }, undefined, 1);
    if (response.success && response.data?.flow) {
      const flow = response.data.flow as PaiflowEntry;
      setFlows((current) => [flow, ...current]);
      setSelectedFlowId(flow.id);
      setDeploymentId("");
      setDeploymentToken("");
      setFlowName("");
      setMessage("Flow saved securely. Its API token is encrypted in Otterpie.");
      setAddDialogOpen(false);
    } else {
      setError(response.message || "Could not add this Paiflow deployment.");
    }
    setSavingFlow(false);
  };

  const removeFlow = async (flow: PaiflowEntry) => {
    setRemovingFlowId(flow.id);
    setError("");
    const response = await Fetch_to("DELETE", routes.stellar_paiflow_flows, { id: flow.id }, undefined, 1);
    if (response.success) {
      const remaining = flows.filter((item) => item.id !== flow.id);
      setFlows(remaining);
      if (selectedFlowId === flow.id) setSelectedFlowId(remaining[0]?.id ?? "");
      setMessage("Paiflow deployment removed.");
    } else {
      setError(response.message || "Could not remove this Paiflow deployment.");
    }
    setRemovingFlowId("");
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setTransaction(null);
    if (!selectedFlowId) {
      setError("Choose one of your saved Paiflow deployments.");
      return;
    }
    if (Number(amount) > selectedBudget) {
      setError(`This amount is above the selected ${selectedCategory?.name ?? "unassigned USDC"} balance (${selectedBudget.toFixed(2)} USDC).`);
      return;
    }
    setPaying(true);
    const response = await Fetch_to("POST", routes.stellar_paiflow_pay, {
      flowId: selectedFlowId,
      amount,
      password,
    }, undefined, 1);
    if (response.success && typeof response.data?.txHash === "string") {
      const flow = flows.find((item) => item.id === selectedFlowId);
      setTransaction({
        hash: response.data.txHash,
        explorerUrl: response.data.explorerUrl,
        amount: response.data.amount ?? amount,
        deploymentId: flow?.deploymentId ?? "",
      });
      setMessage(response.data.status === "PENDING"
        ? "Payment submitted and still confirming on Testnet. Check its status before retrying."
        : "USDC payment completed on Stellar Testnet.");
      setPassword("");
      setPaymentDialogOpen(false);
    } else {
      setError(response.message || "Could not send the Paiflow payment.");
    }
    setPaying(false);
  };

  return (
    <div className="space-y-6 text-foreground">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Stellar payment flows</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Paiflow</h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/55">Keep your splits together and fund one whenever you need.</p>
        </div>
        {isTestnet && (
          <div className="flex flex-wrap gap-2">
            <a href={PAIFLOW_URL} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium text-foreground/80 hover:bg-foreground/5">Open Paiflow ↗</a>
            <button type="button" onClick={() => { setError(""); setMessage(""); setAddDialogOpen(true); }} disabled={flows.length >= MAX_FLOWS || loadingFlows} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50">Add flow</button>
          </div>
        )}
      </header>

      {!isTestnet ? (
        <section className="max-w-3xl rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5 sm:p-7">
          <h2 className="text-sm font-semibold text-amber-200">Paiflow payments use Stellar Testnet</h2>
          <p className="mt-2 text-sm leading-6 text-foreground/60">Switch to Stellar Testnet in Settings before managing or funding Paiflow deployments. Testnet USDC has no real value.</p>
          <Link href="/user/setting" className="mt-3 inline-flex text-sm font-semibold text-primary underline underline-offset-4">Open Settings</Link>
        </section>
      ) : (
        <>
          <section aria-label="Paiflow overview" className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-foreground/10 bg-background p-4"><p className="text-xs font-medium text-foreground/50">Saved flows</p><p className="mt-2 text-2xl font-semibold tabular-nums">{loadingFlows ? "—" : flows.length}</p><p className="mt-1 text-xs text-foreground/45">Your Stellar Testnet splits</p></div>
            <div className="rounded-xl border border-foreground/10 bg-background p-4"><p className="text-xs font-medium text-foreground/50">Flow limit</p><p className="mt-2 text-2xl font-semibold tabular-nums">{MAX_FLOWS}</p><p className="mt-1 text-xs text-foreground/45">Maximum saved at once</p></div>
            <div className="rounded-xl border border-foreground/10 bg-background p-4"><p className="text-xs font-medium text-foreground/50">Network</p><p className="mt-2 text-lg font-semibold">Stellar Testnet</p><p className="mt-1 text-xs text-foreground/45">Test USDC only</p></div>
          </section>

          <section aria-labelledby="paiflow-list-title" className="overflow-hidden rounded-xl border border-foreground/10 bg-background">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-5 py-4">
              <div><h2 id="paiflow-list-title" className="text-sm font-semibold">Your flows</h2><p className="mt-1 text-xs text-foreground/50">Add a flow you deployed, then choose it to send USDC.</p></div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs tabular-nums text-foreground/60">{loadingFlows ? "Loading…" : `${flows.length} / ${MAX_FLOWS}`}</span>
                {flows.length > 0 && <button type="button" onClick={() => setEditingFlows((value) => !value)} className={`rounded-lg px-3 py-2 text-xs font-medium ${editingFlows ? "bg-primary/10 text-primary" : "border border-foreground/15 text-foreground/70 hover:bg-foreground/5"}`}>{editingFlows ? "Done" : "Manage flows"}</button>}
              </div>
            </div>
            {loadingFlows ? (
              <div role="status" aria-label="Loading saved Paiflow deployments" className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl bg-foreground/5" />)}</div>
            ) : flows.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl text-primary">⌁</div>
                <p className="mt-3 text-sm font-medium">No flows yet</p>
                <p className="mt-1 text-xs text-foreground/50">Deploy a split in Paiflow, then add it here.</p>
                <button type="button" onClick={() => setAddDialogOpen(true)} className="mt-4 text-sm font-medium text-primary hover:underline">Add your first flow</button>
              </div>
            ) : (
              <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {flows.map((flow, index) => (
                  <li key={flow.id} className="flex min-w-0 flex-col rounded-xl border border-foreground/10 p-4 transition-colors hover:border-primary/30">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{flow.name || `Split ${flows.length - index}`}</p><p className="mt-1 text-xs text-foreground/45">Paiflow deployment</p></div><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-500">Testnet</span></div>
                    <p className="mt-4 truncate rounded-lg bg-foreground/[0.04] px-3 py-2 font-mono text-xs text-foreground/55" title={flow.deploymentId}>{flow.deploymentId}</p>
                    <div className="mt-auto flex gap-2 pt-4">
                      <button type="button" onClick={() => { setSelectedFlowId(flow.id); setAmount(selectedBudget > 0 ? String(Number(selectedBudget.toFixed(7))) : ""); setError(""); setMessage(""); setPaymentDialogOpen(true); }} disabled={paying || editingFlows} className="flex-1 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-background disabled:opacity-50">Fund split</button>
                      {editingFlows && <button type="button" onClick={() => void removeFlow(flow)} disabled={removingFlowId !== "" || paying} className="rounded-lg border border-rose-500/25 px-3 py-2.5 text-xs font-medium text-rose-300 hover:bg-rose-500/5 disabled:opacity-50">{removingFlowId === flow.id ? "Removing…" : "Remove"}</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {error && <p role="alert" className="max-w-3xl rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-300">{error}</p>}
      {message && <p role="status" className="max-w-3xl rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">{message}</p>}
      {transaction && <div className="max-w-3xl rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4"><p className="text-sm font-medium">Payment submitted · {transaction.amount} USDC</p><p className="mt-1 break-all font-mono text-xs text-foreground/55">Deployment {transaction.deploymentId}</p><a href={transaction.explorerUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all font-mono text-xs text-primary underline underline-offset-4">View Testnet transaction · {transaction.hash}</a></div>}

      {addDialogOpen && isTestnet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/35 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingFlow) setAddDialogOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="add-paiflow-title" className="my-auto w-full max-w-lg rounded-2xl border border-foreground/10 bg-background p-5 text-foreground shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><h2 id="add-paiflow-title" className="text-lg font-semibold">Add a Paiflow split</h2><p className="mt-1 text-sm text-foreground/55">Deploy your flow, then copy its deployment details from Paiflow.</p></div><button type="button" aria-label="Close dialog" onClick={() => setAddDialogOpen(false)} className="rounded-lg px-2 py-1 text-foreground/50 hover:bg-foreground/5">✕</button></div>
            <form onSubmit={(event) => void addFlow(event)} className="mt-5 space-y-4">
              <label htmlFor="paiflow-name" className="block text-sm font-medium">Split name<input id="paiflow-name" value={flowName} onChange={(event) => setFlowName(event.target.value)} maxLength={60} placeholder="e.g. Weekend dinner" disabled={savingFlow || flows.length >= MAX_FLOWS} className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50 disabled:opacity-50" /></label>
              <label htmlFor="paiflow-deployment" className="block text-sm font-medium">Deployment ID<input id="paiflow-deployment" value={deploymentId} onChange={(event) => setDeploymentId(event.target.value)} required spellCheck={false} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" disabled={savingFlow || flows.length >= MAX_FLOWS} className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 font-mono text-sm outline-none focus:border-primary/50 disabled:opacity-50" /></label>
              <label htmlFor="paiflow-token" className="block text-sm font-medium">Deployment API token<input id="paiflow-token" type="password" autoComplete="off" value={deploymentToken} onChange={(event) => setDeploymentToken(event.target.value)} required placeholder="pfk_…" disabled={savingFlow || flows.length >= MAX_FLOWS} className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 font-mono text-sm outline-none focus:border-primary/50 disabled:opacity-50" /></label>
              <p className="text-xs leading-5 text-foreground/45">Use a Read and operate token. Otterpie encrypts the deployment details before storing them.</p>
              <a href={PAIFLOW_URL} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-primary hover:underline">Open Paiflow ↗</a>
              {error && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-300">{error}</p>}
              <div className="flex gap-3 border-t border-foreground/10 pt-4"><button type="button" onClick={() => setAddDialogOpen(false)} disabled={savingFlow} className="flex-1 rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium text-foreground/75 hover:bg-foreground/5">Cancel</button><button type="submit" disabled={savingFlow || flows.length >= MAX_FLOWS || !deploymentId || !deploymentToken} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50">{savingFlow ? "Checking…" : "Validate and add"}</button></div>
            </form>
          </section>
        </div>
      )}

      {paymentDialogOpen && isTestnet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/35 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !paying) setPaymentDialogOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="fund-paiflow-title" className="my-auto w-full max-w-lg rounded-2xl border border-foreground/10 bg-background p-5 text-foreground shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><h2 id="fund-paiflow-title" className="text-lg font-semibold">Fund this split</h2><p className="mt-1 text-sm text-foreground/55">Send USDC from your Otterpie Stellar Testnet wallet.</p></div><button type="button" aria-label="Close dialog" onClick={() => setPaymentDialogOpen(false)} className="rounded-lg px-2 py-1 text-foreground/50 hover:bg-foreground/5">✕</button></div>
            <form onSubmit={(event) => void submitPayment(event)} className="mt-5 space-y-4">
              {flows.length > 1 ? (
                <label htmlFor="paiflow-payment-flow" className="block text-sm font-medium">Choose a split<select id="paiflow-payment-flow" value={selectedFlowId} onChange={(event) => setSelectedFlowId(event.target.value)} required disabled={paying} className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm disabled:opacity-50">{flows.map((flow, index) => <option key={flow.id} value={flow.id}>Split {flows.length - index}</option>)}</select></label>
              ) : (
                <div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-2.5">
                  <p className="text-xs text-foreground/50">Selected split</p>
                  <p className="mt-1 text-sm font-medium">Split 1</p>
                  {flows[0] && <p className="mt-1 truncate font-mono text-xs text-foreground/45" title={flows[0].deploymentId}>{flows[0].deploymentId}</p>}
                </div>
              )}
              <label htmlFor="paiflow-category" className="block text-sm font-medium">USDC category
                <select id="paiflow-category" value={selectedCategoryId} onChange={(event) => {
                  const categoryId = event.target.value;
                  const category = categoryBudgets.find((item) => item.id === categoryId);
                  const available = category?.available ?? unassignedBudget;
                  setSelectedCategoryId(categoryId);
                  setAmount(available > 0 ? String(Number(available.toFixed(7))) : "");
                }} disabled={paying} className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm disabled:opacity-50">
                  <option value="">Unassigned USDC · {unassignedBudget.toFixed(2)} available</option>
                  {categoryBudgets.map((category) => <option key={category.id} value={category.id}>{category.name} · {category.available.toFixed(2)} available</option>)}
                </select>
                <span className="mt-1 block text-xs font-normal text-foreground/45">Selecting a category fills its available amount below. You can edit it before sending.</span>
              </label>
              <label htmlFor="paiflow-amount" className="block text-sm font-medium">USDC amount<input id="paiflow-amount" type="number" min="0.0000001" max={selectedBudget} step="0.0000001" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required disabled={paying} className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50 disabled:opacity-50" /><span className="mt-1 block text-xs font-normal text-foreground/45">Available in this selection: {selectedBudget.toFixed(2)} USDC</span></label>
              <label htmlFor="paiflow-password" className="block text-sm font-medium">Confirm with your account password<input id="paiflow-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={paying} className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50 disabled:opacity-50" /></label>
              <p className="text-xs leading-5 text-foreground/45">Otterpie prepares and signs the Paiflow deposit with your saved Stellar wallet.</p>
              {error && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm text-rose-300">{error}</p>}
              <div className="flex gap-3 border-t border-foreground/10 pt-4"><button type="button" onClick={() => setPaymentDialogOpen(false)} disabled={paying} className="flex-1 rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium text-foreground/75 hover:bg-foreground/5">Cancel</button><button type="submit" disabled={paying || !selectedFlowId || !amount || !password} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50">{paying ? "Sending…" : `Send ${amount || "USDC"}`}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
