"use client";

import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, getAddress, isAddress, parseUnits } from "ethers";
import { Fetch_to } from "@/utilities";
import routes from "@/routes/user.json";
import { getWalletNetworkConfig, walletNetworkLabel } from "@/utilities/network";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

type BridgeProps = { network: string; walletAddress: string };
const botChainBridge = walletNetworks.bot_chain.bridge;
type BridgeNetwork = keyof typeof botChainBridge.networks;
type Destination = BridgeNetwork;
const minimumBridgeInput = Number(botChainBridge.minimumAmount) + Number(botChainBridge.minimumInputIncrement);
type BridgeQuote = {
  amount: string;
  fee: string;
  feePercent: number;
  receiveAmount: string;
  availableBalance: string;
  destination: string;
  recipient: string;
  destinationChainId: number;
};

const destinationOptions = Object.entries(botChainBridge.networks)
  .filter(([, config]) => config.outbound.enabled) as [Destination, (typeof botChainBridge.networks)[Destination]][];
const format = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });

function DirectionArrow({ reverse = false, vertical = false }: { reverse?: boolean; vertical?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`h-5 w-5 shrink-0 ${vertical ? "rotate-90" : ""} ${reverse ? "rotate-180" : ""}`}
    >
      <path d="M4 12h15m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type InboundNetwork = BridgeNetwork;
type EthereumProvider = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
type EvmWalletProvider = EthereumProvider & { connect?: () => Promise<void>; disconnect?: () => Promise<void> };
type TronContractMethod = { call(): Promise<unknown>; send(options?: Record<string, unknown>): Promise<unknown> };
type TronContract = Record<string, (...args: unknown[]) => TronContractMethod>;
type TronWebLike = {
  defaultAddress?: { base58?: string };
  fullNode?: { host?: string };
  address: { toHex(address: string): string };
  contract(abi: unknown[], address: string): Promise<TronContract>;
  trx: { getContract(address: string): Promise<{ bytecode?: string; contract_address?: string }> };
};
type TronProvider = {
  isTronLink?: boolean;
  request(args: { method: string; params?: unknown }): Promise<unknown>;
  tronWeb: TronWebLike | false;
};
declare global {
  interface Window { ethereum?: EthereumProvider; tron?: TronProvider }
}

const inboundOptions = Object.entries(botChainBridge.networks)
  .filter(([, config]) => config.inbound.enabled) as [InboundNetwork, (typeof botChainBridge.networks)[InboundNetwork]][];
const ERC20_BRIDGE_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const GATEWAY_ABI = ["function deposit(uint256 destinationChainId, bytes32 resourceId, address recipient, uint256 amount) payable"];
const TRON_ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
];
const TRON_GATEWAY_ABI = [{ type: "function", name: "deposit", stateMutability: "payable", inputs: [{ name: "destinationChainId", type: "uint256" }, { name: "resourceId", type: "bytes32" }, { name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }];

function parseTokenAmount(value: string, decimals: number): bigint {
  if (!/^\d+(?:\.\d*)?$/.test(value.trim())) throw new Error("Enter a valid USDT amount.");
  return parseUnits(value.trim(), decimals);
}

function InboundBridge({ onBusyChange, walletAddress }: { onBusyChange: (busy: boolean) => void; walletAddress: string }) {
  const [source, setSource] = useState<InboundNetwork>(inboundOptions[0][0]);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState("");
  const [evmProvider, setEvmProvider] = useState<EvmWalletProvider | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ hash: string; approvalHash?: string } | null>(null);
  const networkConfig = botChainBridge.networks[source];
  const config = networkConfig.inbound;

  const connect = async () => {
    setError("");
    try {
      if (config.wallet === "tronlink") {
        const tronProvider = window.tron;
        if (!tronProvider) throw new Error("Install TronLink, then try again.");
        await tronProvider.request({ method: "eth_requestAccounts" });
        const tronWeb = tronProvider.tronWeb;
        if (!tronWeb || !tronWeb.defaultAddress?.base58) throw new Error("TronLink did not return an active account.");
        setConnectedAddress(tronWeb.defaultAddress.base58);
      } else {
        const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
        if (!projectId) throw new Error("WalletConnect is not configured. Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to your environment and restart the app.");
        let walletProvider = evmProvider;
        if (!walletProvider) {
          const { EthereumProvider: WalletConnectProvider } = await import("@walletconnect/ethereum-provider");
          walletProvider = await WalletConnectProvider.init({
            projectId,
            optionalChains: [config.chainId],
            showQrModal: true,
            metadata: {
              name: "Otterpie",
              description: "Bridge USDT to BOT Chain",
              url: window.location.origin,
              icons: [],
            },
          });
          setEvmProvider(walletProvider);
        }
        await walletProvider.connect?.();
        const accounts = await walletProvider.request({ method: "eth_requestAccounts" });
        if (!Array.isArray(accounts) || typeof accounts[0] !== "string") throw new Error("The wallet did not return an account.");
        setConnectedAddress(getAddress(accounts[0]));
      }
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Could not connect the wallet.");
    }
  };

  const submitInbound = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setBusy(true);
    onBusyChange(true);
    try {
      if (!isAddress(walletAddress)) throw new Error("Your session does not include a valid BOT Chain wallet address.");
      const amountUnits = parseTokenAmount(amount, config.decimals);
      if (amountUnits <= BigInt(0)) throw new Error("Enter an amount greater than zero.");
      if (config.wallet === "tronlink") {
        const provider = window.tron;
        const tronWeb = provider?.tronWeb;
        if (!provider || !tronWeb) throw new Error("Connect TronLink first.");
        const nodeHost = tronWeb.fullNode?.host || "";
        if (/nile|shasta|testnet/i.test(nodeHost)) throw new Error("Switch TronLink to Tron Mainnet.");
        const [tokenCode, gatewayCode] = await Promise.all([tronWeb.trx.getContract(config.token), tronWeb.trx.getContract(config.gateway)]);
        if (!tokenCode?.bytecode || !gatewayCode?.bytecode) throw new Error("The official bridge contracts were not found on the selected Tron network.");
        const account = tronWeb.defaultAddress?.base58;
        if (!account || account !== connectedAddress) throw new Error("The active TronLink account changed. Reconnect and review again.");
        const token = await tronWeb.contract(TRON_ERC20_ABI, config.token);
        const gateway = await tronWeb.contract(TRON_GATEWAY_ABI, config.gateway);
        const balance = BigInt(String(await token.balanceOf(account).call()));
        if (amountUnits > balance) throw new Error("Your Tron USDT balance is lower than the amount entered.");
        const allowance = BigInt(String(await token.allowance(account, config.gateway).call()));
        let approvalHash: string | undefined;
        if (allowance < amountUnits) {
          const approval = await token.approve(config.gateway, amountUnits.toString()).send({ feeLimit: 100_000_000, shouldPollResponse: true, keepTxID: true });
          approvalHash = Array.isArray(approval) && typeof approval[0] === "string"
            ? approval[0]
            : typeof approval === "string" ? approval : (approval as { txid?: string })?.txid;
          if (Array.isArray(approval) && approval[1] === false) throw new Error("USDT approval failed on Tron.");
          if (!approvalHash) throw new Error("TronLink did not return the USDT approval transaction ID.");
        }
        const tronRecipient = `41${getAddress(walletAddress).slice(2)}`;
        const tx = await gateway.deposit(botChainBridge.chainId, botChainBridge.usdtResourceId, tronRecipient, amountUnits.toString()).send({ feeLimit: 100_000_000, shouldPollResponse: false });
        const hash = typeof tx === "string" ? tx : (tx as { txid?: string })?.txid;
        if (!hash) throw new Error("TronLink did not return the bridge transaction ID.");
        setResult({ hash, approvalHash });
      } else {
        const activeProvider = evmProvider ?? window.ethereum;
        if (!activeProvider) throw new Error("Connect an EVM wallet first.");
        const provider = new BrowserProvider(activeProvider as never);
        const signer = await provider.getSigner();
        const account = await signer.getAddress();
        if (account.toLowerCase() !== connectedAddress.toLowerCase()) throw new Error("The active wallet account changed. Reconnect and review again.");
        const network = await provider.getNetwork();
        if (network.chainId !== BigInt(config.chainId)) {
          try {
            await activeProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${config.chainId.toString(16)}` }] });
          } catch { throw new Error(`Switch your wallet to ${networkConfig.label} and try again.`); }
          const switched = await provider.getNetwork();
          if (switched.chainId !== BigInt(config.chainId)) throw new Error(`Switch your wallet to ${networkConfig.label} and try again.`);
        }
        const token = new Contract(config.token, ERC20_BRIDGE_ABI, signer);
        const [balanceValue, decimalsValue, allowanceValue] = await Promise.all([
          token.getFunction("balanceOf").staticCall(account) as Promise<bigint>,
          token.getFunction("decimals").staticCall() as Promise<bigint>,
          token.getFunction("allowance").staticCall(account, config.gateway) as Promise<bigint>,
        ]);
        const decimals = Number(decimalsValue);
        if (!Number.isInteger(decimals) || decimals !== config.decimals) throw new Error("Unexpected USDT decimals for this network.");
        const balance = BigInt(balanceValue);
        if (amountUnits > balance) throw new Error(`Your ${networkConfig.label} USDT balance is lower than the amount entered.`);
        let approvalHash: string | undefined;
        if (BigInt(allowanceValue) < amountUnits) {
          const approve = token.getFunction("approve");
          if (BigInt(allowanceValue) > BigInt(0)) {
            const reset = await approve.send(config.gateway, BigInt(0));
            const resetReceipt = await reset.wait(1);
            if (!resetReceipt || resetReceipt.status !== 1) throw new Error("Could not reset the existing USDT approval.");
          }
          const approval = await approve.send(config.gateway, amountUnits);
          approvalHash = approval.hash;
          const receipt = await approval.wait(1);
          if (!receipt || receipt.status !== 1) throw new Error("USDT approval failed.");
        }
        const gateway = new Contract(config.gateway, GATEWAY_ABI, signer);
        const deposit = gateway.getFunction("deposit");
        const tx = await deposit.send(botChainBridge.chainId, botChainBridge.usdtResourceId, getAddress(walletAddress), amountUnits);
        const receipt = await tx.wait(1);
        if (!receipt || receipt.status !== 1) throw new Error("The source-chain bridge transaction failed.");
        setResult({ hash: tx.hash, approvalHash });
      }
    } catch (bridgeError) {
      setError(bridgeError instanceof Error ? bridgeError.message : "The inbound bridge transaction failed.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  };

  return (
    <form onSubmit={submitInbound} className="rounded-2xl border border-foreground/10 bg-background p-4 shadow-xl shadow-black/5 sm:p-6 lg:p-7">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] sm:items-end sm:gap-4">
        <div className="min-w-0">
          <label htmlFor="bridge-source-network" className="mb-2 block text-xs font-medium uppercase tracking-wide text-foreground/50">From</label>
          <div className="relative h-16 rounded-xl border border-foreground/15 bg-foreground/[0.05] transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 hover:bg-foreground/[0.07] sm:h-[72px]">
            <select
              id="bridge-source-network"
              aria-label="Source network"
              value={source}
              onChange={(event) => { void evmProvider?.disconnect?.(); setEvmProvider(null); setSource(event.target.value as InboundNetwork); setConnectedAddress(""); setResult(null); setError(""); }}
              disabled={busy || Boolean(result)}
              className="h-full w-full cursor-pointer appearance-none rounded-xl bg-transparent px-4 pr-10 text-sm font-semibold text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {inboundOptions.map(([key, item]) => <option key={key} value={key} className="bg-background text-foreground">{item.label} · USDT</option>)}
            </select>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/70">
              <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <div aria-hidden="true" className="flex items-center justify-center text-primary sm:pb-3"><span className="sm:hidden"><DirectionArrow vertical /></span><span className="hidden sm:inline-flex"><DirectionArrow /></span></div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/50">To</p>
          <div className="flex h-16 flex-col justify-center rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 sm:h-[72px]">
            <p className="truncate text-sm font-semibold text-foreground">BOT Chain</p>
            <p className="mt-1 text-xs text-foreground/50">USDT · EVM</p>
          </div>
        </div>
      </div>
      <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium uppercase tracking-wide text-foreground/50">Amount · USDT
          <input type="number" min={`0.${"0".repeat(config.decimals - 1)}1`} step={`0.${"0".repeat(config.decimals - 1)}1`} inputMode="decimal" placeholder="Amount to bridge" value={amount} onChange={(event) => { setAmount(event.target.value); setResult(null); setError(""); }} disabled={busy || Boolean(result)} required className="mt-2 h-12 w-full min-w-0 rounded-xl border border-foreground/15 bg-background px-4 text-sm text-foreground outline-none transition focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25 placeholder:font-normal placeholder:text-foreground/35" />
        </label>
        <label className="block text-xs font-medium uppercase tracking-wide text-foreground/50">Your BOT Chain recipient
          <input type="text" value={walletAddress} readOnly aria-readonly="true" placeholder="Loading session wallet…" className="mt-2 h-12 w-full min-w-0 rounded-xl border border-foreground/15 bg-foreground/[0.03] px-4 font-mono text-xs text-foreground/75 outline-none sm:text-sm" />
        </label>
      </div>
      <div className="mt-5 rounded-lg border border-primary/15 bg-primary/[0.04] p-4 text-sm text-foreground/70">
        {config.wallet === "tronlink" ? "Connect TronLink" : "Choose an EVM wallet with WalletConnect"} to review the source address and submit the transaction. The official bridge docs list inbound bridging as free; your source network gas or TRX resource cost still applies.
      </div>
      {!connectedAddress ? (
        <button type="button" onClick={() => void connect()} className="mt-5 min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background">{config.wallet === "tronlink" ? "Connect TronLink" : "Choose EVM wallet"}</button>
      ) : (
        <>
          <p className="mt-4 break-all text-xs text-foreground/50">Connected source wallet: {connectedAddress}</p>
          {!result && <button type="submit" disabled={busy || !amount || !isAddress(walletAddress)} className="mt-4 min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Confirm in your wallet…" : `Bridge ${amount || "USDT"} to BOT Chain`}</button>}
        </>
      )}
      {result && <div role="status" className="mt-5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm"><p className="font-semibold text-emerald-300">Inbound bridge transaction submitted</p>{result.approvalHash && <p className="mt-2 break-all text-xs text-foreground/55">Approval: {result.approvalHash}</p>}<a href={`${config.explorerUrl}${result.hash}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all text-xs text-primary underline">View source transaction: {result.hash}</a><p className="mt-2 text-xs text-foreground/55">The bridge validators will release USDT to the BOT Chain recipient after source-chain confirmations.</p></div>}
      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      <p className="mt-4 text-xs text-foreground/45">Only use the official USDT and bridge contracts. Keep enough ETH, BNB, or TRX/resources for network fees. Your wallet will show each approval and bridge transaction for confirmation.</p>
    </form>
  );
}

export default function Bridge({ network, walletAddress }: BridgeProps) {
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [inboundBusy, setInboundBusy] = useState(false);
  const [destination, setDestination] = useState<Destination>(destinationOptions[0][0]);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [password, setPassword] = useState("");
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [botUsdtBalance, setBotUsdtBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [busy, setBusy] = useState<"quote" | "bridge" | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{ txHash: string; approvalHash?: string; message: string } | null>(null);
  const walletConfig = getWalletNetworkConfig(network);
  const supportsEvmBridge = walletConfig?.walletType === "evm";
  const selectedDestination = botChainBridge.networks[destination];
  const addressPlaceholder = selectedDestination.outbound.addressType === "tron" ? "T... or 0x... (Tron recipient)" : "0x... (recipient wallet address)";
  const refreshBotUsdtBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const response = await Fetch_to("POST", routes.bridge, { action: "balance" }, undefined, 1);
      if (!response.success) throw new Error(response.message || "Could not load balance.");
      const result = response.data as { balance?: string };
      if (typeof result.balance !== "string") throw new Error("Invalid balance response.");
      setBotUsdtBalance(result.balance);
    } catch {
      setBotUsdtBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (direction === "outbound") void refreshBotUsdtBalance();
  }, [direction, refreshBotUsdtBalance]);

  const clearQuote = () => {
    setQuote(null);
    setSubmitted(null);
    setPassword("");
    setError("");
  };

  const requestQuote = async () => {
    setError("");
    setQuote(null);
    setSubmitted(null);
    setBusy("quote");
    try {
      const response = await Fetch_to("POST", routes.bridge, {
        action: "quote", destination, amount: amount.trim(), recipient: recipient.trim(),
      }, undefined, 1);
      if (!response.success) throw new Error(response.message || "Could not get a bridge quote.");
      const result = response.data as { quote?: BridgeQuote };
      if (!result.quote) throw new Error("The bridge service returned an invalid quote.");
      setQuote(result.quote);
      setBotUsdtBalance(result.quote.availableBalance);
    } catch (quoteError) {
      setError(quoteError instanceof Error ? quoteError.message : "Could not get a bridge quote.");
    } finally {
      setBusy(null);
    }
  };

  const submitBridge = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quote) return;
    setError("");
    setBusy("bridge");
    try {
      const response = await Fetch_to("POST", routes.bridge, {
        action: "bridge", destination, amount: amount.trim(), recipient: recipient.trim(), password,
      }, undefined, 1);
      if (!response.success) throw new Error(response.message || "The bridge request could not be submitted.");
      const result = response.data as { txHash?: string; approvalHash?: string; message?: string };
      if (!result.txHash) throw new Error("The bridge service did not return a transaction hash.");
      setSubmitted({
        txHash: result.txHash,
        approvalHash: result.approvalHash,
        message: result.message || "Bridge deposit submitted.",
      });
      setPassword("");
      void refreshBotUsdtBalance();
    } catch (bridgeError) {
      setError(bridgeError instanceof Error ? bridgeError.message : "The bridge request could not be submitted.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-primary">Move USDT across chains</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Bridge</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground/55">Move USDT between BOT Chain and supported networks.</p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-xs font-medium text-primary">USDT · Mainnet</span>
      </header>

      <div role="group" aria-label="Bridge direction" className="grid grid-cols-1 gap-1 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-1 sm:grid-cols-2">
        <button type="button" onClick={() => { setDirection("outbound"); clearQuote(); }} aria-pressed={direction === "outbound"} disabled={inboundBusy || busy !== null} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 ${direction === "outbound" ? "bg-primary text-white shadow-sm" : "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground"}`}><span>BOT Chain</span><DirectionArrow /><span>Other network</span></button>
        <button type="button" onClick={() => { setDirection("inbound"); clearQuote(); }} aria-pressed={direction === "inbound"} disabled={inboundBusy || busy !== null} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 ${direction === "inbound" ? "bg-primary text-white shadow-sm" : "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground"}`}><span>Other network</span><DirectionArrow /><span>BOT Chain</span></button>
      </div>

      {direction === "inbound" ? <InboundBridge onBusyChange={setInboundBusy} walletAddress={walletAddress} /> : !supportsEvmBridge ? (
        <section role="status" className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-5">
          <h2 className="text-base font-semibold text-amber-200">Bridging unavailable for this wallet</h2>
          {!network ? (
            <p className="mt-2 text-sm text-foreground/70">Loading your wallet network…</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-foreground/70">
                {walletConfig ? walletNetworkLabel(network) : "This network"} is not an EVM network. Non-EVM is not available for bridging.
              </p>
              <p className="mt-3 text-xs text-foreground/50">Your Stellar wallet and XLM balance are not affected.</p>
            </>
          )}
        </section>
      ) : (
        <form onSubmit={submitBridge} className="min-w-0 rounded-2xl border border-foreground/10 bg-background p-4 shadow-xl shadow-black/5 sm:p-6 lg:p-7">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] sm:items-end sm:gap-4">
            <div>
              <label htmlFor="bridge-source" className="mb-2 block text-xs font-medium uppercase tracking-wide text-foreground/50">From</label>
              <div id="bridge-source" className="flex h-16 min-w-0 flex-col justify-center rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 sm:h-[72px]">
                <p className="truncate font-semibold text-foreground">BOT Chain</p>
                <p className="mt-1 text-xs text-foreground/50">USDT · EVM</p>
              </div>
            </div>
            <div aria-hidden="true" className="flex items-center justify-center text-primary sm:pb-3"><span className="sm:hidden"><DirectionArrow vertical /></span><span className="hidden sm:inline-flex"><DirectionArrow /></span></div>
            <div>
              <label htmlFor="bridge-destination" className="mb-2 block text-xs font-medium uppercase tracking-wide text-foreground/50">To</label>
              <div className="relative">
              <select
                id="bridge-destination"
                value={destination}
                onChange={(event) => { setDestination(event.target.value as Destination); clearQuote(); }}
                disabled={busy !== null || Boolean(submitted)}
                className="h-16 w-full min-w-0 appearance-none rounded-xl border border-foreground/15 bg-foreground/[0.05] px-4 pr-10 text-sm text-foreground outline-none transition hover:bg-foreground/[0.07] focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-60 sm:h-[72px]"
              >
                {destinationOptions.map(([key, item]) => <option key={key} value={key} className="bg-background text-foreground">{item.label} · USDT ({item.outbound.tokenStandard})</option>)}
              </select>
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/60"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
          </div>

          <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <label htmlFor="bridge-amount" className="text-xs font-medium uppercase tracking-wide text-foreground/50">Amount · USDT</label>
                <span className="text-xs font-medium tabular-nums text-foreground/55" aria-live="polite">
                  {balanceLoading ? "Balance loading…" : `Balance: ${format.format(Number(botUsdtBalance ?? "0"))} USDT`}
                </span>
              </div>
              <input
                id="bridge-amount"
                type="number"
                min={minimumBridgeInput}
                step={botChainBridge.minimumInputIncrement}
                inputMode="decimal"
                placeholder={`More than ${botChainBridge.minimumAmount} USDT`}
                value={amount}
                onChange={(event) => { setAmount(event.target.value); clearQuote(); }}
                disabled={busy !== null || Boolean(submitted)}
                required
                className="h-12 w-full min-w-0 rounded-xl border border-foreground/15 bg-background px-4 text-sm text-foreground outline-none transition placeholder:text-foreground/35 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="bridge-recipient" className="mb-2 block text-xs font-medium uppercase tracking-wide text-foreground/50">Recipient wallet on {selectedDestination.label}</label>
              <input
                id="bridge-recipient"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={addressPlaceholder}
                value={recipient}
                onChange={(event) => { setRecipient(event.target.value); clearQuote(); }}
                disabled={busy !== null || Boolean(submitted)}
                required
                className="h-12 w-full min-w-0 rounded-xl border border-foreground/15 bg-background px-4 font-mono text-xs text-foreground outline-none transition placeholder:font-sans placeholder:text-foreground/35 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-60 sm:text-sm"
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-foreground/50">
            Enter the wallet address that should receive USDT on the selected network. The bridge requires more than {botChainBridge.minimumAmount} USDT; the fee is quoted from the live BOT Chain bridge contract.
          </p>

          {quote && !submitted && (
            <div className="mt-5 space-y-3 rounded-xl border border-primary/15 bg-primary/[0.04] p-4 sm:p-5">
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm"><span className="text-foreground/55">You send</span><span className="font-medium tabular-nums">{format.format(Number(quote.amount))} USDT</span></div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm"><span className="text-foreground/55">Bridge fee ({quote.feePercent}%)</span><span className="font-medium tabular-nums">{format.format(Number(quote.fee))} USDT</span></div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-foreground/10 pt-3 text-sm"><span className="font-medium">Estimated receive</span><span className="font-semibold tabular-nums">{format.format(Number(quote.receiveAmount))} USDT</span></div>
              <p className="text-xs text-foreground/45">BOT is also needed to pay the source-chain network fee.</p>
            </div>
          )}

          {!quote && !submitted && (
            <button
              type="button"
              onClick={() => void requestQuote()}
              disabled={busy !== null || !amount || !recipient.trim()}
              className="mt-5 min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "quote" ? "Checking bridge…" : "Review bridge"}
            </button>
          )}

          {quote && !submitted && (
            <>
              <label htmlFor="bridge-password" className="mt-5 block text-sm font-medium text-foreground">Confirm with your account password</label>
              <input
                id="bridge-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(""); }}
                disabled={busy !== null}
                required
                className="mt-2 h-12 w-full min-w-0 rounded-xl border border-foreground/15 bg-background px-4 text-sm text-foreground outline-none transition focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-60"
              />
              <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100/80">
                This submits a real BOT Chain mainnet transaction from your Otterpie wallet. Destination delivery is asynchronous and handled by bridge validators.
              </p>
              <button
                type="submit"
                disabled={busy !== null || !password}
                className="mt-4 min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === "bridge" ? "Submitting bridge…" : `Bridge ${format.format(Number(quote.amount))} USDT`}
              </button>
            </>
          )}

          {submitted && (
            <div role="status" className="mt-5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm">
              <p className="font-semibold text-emerald-300">Bridge request submitted</p>
              <p className="mt-1 text-foreground/65">{submitted.message}</p>
              {submitted.approvalHash && <p className="mt-3 text-xs text-foreground/50">USDT approval: {submitted.approvalHash}</p>}
              <a href={walletNetworks.bot_chain.explorer.transactionUrlTemplate.replace("{hash}", submitted.txHash)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all font-mono text-xs text-primary underline underline-offset-4">View deposit transaction: {submitted.txHash}</a>
            </div>
          )}

          {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}

          <section aria-label="Supported networks" className="mt-6 border-t border-foreground/10 pt-5">
            <h2 className="text-sm font-semibold text-foreground">Supported destinations</h2>
            <p className="mt-1 text-sm text-foreground/55">{destinationOptions.map(([, item]) => `${item.label} (${item.outbound.tokenStandard})`).join(", ")} USDT.</p>
            <p className="mt-2 text-xs text-foreground/45">Stellar is not supported for bridging. Your XLM wallet is unaffected.</p>
          </section>
        </form>
      )}
    </div>
  );
}
