"use client";

import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, formatUnits, getAddress, hexlify, parseUnits } from "ethers";
import { StrKey } from "@stellar/stellar-sdk";
import { Fetch_to } from "@/utilities";
import routes from "@/routes/user.json";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

type Props = { walletAddress: string };
type Eip1193Provider = { request(args: { method: string; params?: unknown[] }): Promise<unknown>; connect?: () => Promise<void> };
type WalletChoice = "walletconnect";
type Source = keyof typeof walletNetworks.stellar.bridge.networks;
type SourceConfig = (typeof walletNetworks.stellar.bridge.networks)[Source];
type Quote = { amount: string; receiveAmount: string; nativeFee: string; sourceAsset: string; sourceAddress: string };

const bridgeConfig = walletNetworks.stellar.bridge;
const sourceOptions = Object.entries(bridgeConfig.networks).filter(([key]) => key === "ethereum") as [Source, SourceConfig][];
const oftAbi = [
  "function quoteOFT(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes)) view returns (tuple(uint256,uint256), tuple(int256,string)[], tuple(uint256,uint256))",
  "function quoteSend(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes), bool) view returns (tuple(uint256,uint256))",
  "function send(tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes), tuple(uint256,uint256), address) payable returns (tuple(bytes32,uint64,tuple(uint256,uint256)), tuple(uint256,uint256))",
];
const tokenAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
];
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 7 });

function tupleValue(value: unknown, key: string, index: number): unknown {
  if (value && typeof value === "object") {
    const tuple = value as Record<string | number, unknown>;
    return tuple[key] ?? tuple[index];
  }
  return undefined;
}

function DirectionArrow({ vertical = false }: { vertical?: boolean } = {}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={`h-6 w-6 shrink-0 ${vertical ? "rotate-90" : ""}`}>
      <path d="M4 12h15m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function EvmToStellarBridge({ walletAddress }: Props) {
  const [source, setSource] = useState<Source>(sourceOptions[0][0]);
  const [amount, setAmount] = useState("");
  const [walletProvider, setWalletProvider] = useState<Eip1193Provider | null>(null);
  const [walletChoice, setWalletChoice] = useState<WalletChoice | null>(null);
  const [connectedAddress, setConnectedAddress] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [txHash, setTxHash] = useState("");
  const [approvalHash, setApprovalHash] = useState("");
  const [trustline, setTrustline] = useState<boolean | null>(null);
  const [stellarFunded, setStellarFunded] = useState<boolean | null>(null);
  const [trustlinePassword, setTrustlinePassword] = useState("");
  const [busy, setBusy] = useState<"connect" | "destination" | "trustline" | "quote" | "send" | null>(null);
  const [error, setError] = useState("");
  const selectedSource = bridgeConfig.networks[source];

  const refreshDestination = useCallback(async () => {
    setBusy("destination");
    try {
      const response = await Fetch_to("POST", routes["bridge-non-evm"], { action: "destination" }, undefined, 1);
      if (!response.success) throw new Error(response.message || "Could not check the Stellar receiving wallet.");
      const data = response.data as { address?: string; trustline?: boolean; funded?: boolean };
      if (data.address !== walletAddress) throw new Error("Your Stellar wallet address does not match the active session.");
      setTrustline(Boolean(data.trustline));
      setStellarFunded(data.funded !== false);
    } catch (destinationError) {
      setTrustline(null);
      setError(destinationError instanceof Error ? destinationError.message : "Could not check the Stellar receiving wallet.");
    } finally {
      setBusy(null);
    }
  }, [walletAddress]);

  useEffect(() => { void refreshDestination(); }, [refreshDestination]);

  const setupTrustline = async () => {
    setBusy("trustline");
    setError("");
    try {
      const response = await Fetch_to("POST", routes["bridge-non-evm"], { action: "trustline", password: trustlinePassword }, undefined, 1);
      if (!response.success) throw new Error(response.message || "Could not create the Stellar USDT0 trustline.");
      setTrustlinePassword("");
      await refreshDestination();
    } catch (trustlineError) {
      setError(trustlineError instanceof Error ? trustlineError.message : "Could not create the Stellar USDT0 trustline.");
      setBusy(null);
    }
  };

  const connect = async () => {
    setBusy("connect");
    setError("");
    try {
      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
      if (!projectId) throw new Error("WalletConnect is not configured. Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to your environment and restart the app.");
      const { EthereumProvider: WalletConnectProvider } = await import("@walletconnect/ethereum-provider");
      const provider = await WalletConnectProvider.init({
        projectId,
        optionalChains: sourceOptions.map(([, item]) => item.chainId) as [number, ...number[]],
        showQrModal: true,
        metadata: { name: "Otterpie", description: "Bridge USDT0 to Stellar", url: window.location.origin, icons: [] },
      }) as unknown as Eip1193Provider;
      await provider.connect?.();
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (!Array.isArray(accounts) || typeof accounts[0] !== "string") throw new Error("The wallet did not return an account.");
      setWalletProvider(provider);
      setWalletChoice("walletconnect");
      setConnectedAddress(getAddress(accounts[0]));
      setQuote(null);
      setTxHash("");
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Could not connect the EVM wallet.");
    } finally {
      setBusy(null);
    }
  };

  const changeWallet = async () => {
    if (walletChoice === "walletconnect" && walletProvider && "disconnect" in walletProvider) {
      try { await (walletProvider as Eip1193Provider & { disconnect(): Promise<void> }).disconnect(); } catch { /* clear the local connection even if the session already ended */ }
    }
    setWalletProvider(null);
    setWalletChoice(null);
    setConnectedAddress("");
    clearQuote();
  };

  const ensureSourceChain = async (provider: Eip1193Provider) => {
    const current = await provider.request({ method: "eth_chainId" });
    const currentChainId = typeof current === "string" ? Number.parseInt(current, 16) : Number(current);
    if (currentChainId === selectedSource.chainId) return;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${selectedSource.chainId.toString(16)}` }] });
    } catch {
      throw new Error(`Switch your connected wallet to ${selectedSource.label} and try again.`);
    }
  };

  const requestQuote = async () => {
    setBusy("quote");
    setError("");
    setQuote(null);
    setTxHash("");
    setApprovalHash("");
    try {
      if (trustline !== true) throw new Error("Set up the USDT0 trustline on your Stellar wallet before bridging.");
      if (!StrKey.isValidEd25519PublicKey(walletAddress)) throw new Error("The Stellar receiving address is invalid.");
      if (!walletProvider) throw new Error("Connect your EVM wallet first.");
      await ensureSourceChain(walletProvider);
      const provider = new BrowserProvider(walletProvider as never);
      const signer = await provider.getSigner();
      const account = await signer.getAddress();
      const token = new Contract(selectedSource.token, tokenAbi, provider);
      const oft = new Contract(selectedSource.oft, oftAbi, provider);
      const decimals = Number(await token.getFunction("decimals").staticCall());
      if (decimals !== selectedSource.decimals) throw new Error("The USDT0 token decimals do not match the configured network.");
      const amountLD = parseUnits(amount.trim(), decimals);
      if (amountLD <= BigInt(0)) throw new Error("Enter an amount greater than zero.");
      const tokenBalance = BigInt(await token.getFunction("balanceOf").staticCall(account));
      if (amountLD > tokenBalance) throw new Error("Your connected wallet does not have enough USDT0.");
      const stellarRecipient = hexlify(StrKey.decodeEd25519PublicKey(walletAddress));
      const sendParam = [bridgeConfig.sourceEid, stellarRecipient, amountLD, BigInt(0), "0x", "0x", "0x"];
      const oftQuote = await oft.getFunction("quoteOFT").staticCall(sendParam);
      const receipt = tupleValue(oftQuote, "oftReceipt", 2);
      const expectedReceived = BigInt(String(tupleValue(receipt, "amountReceivedLD", 1)));
      if (expectedReceived <= BigInt(0)) throw new Error("The USDT0 route returned an invalid receive amount.");
      sendParam[3] = expectedReceived;
      const feeQuote = await oft.getFunction("quoteSend").staticCall(sendParam, false);
      const nativeFee = tupleValue(feeQuote, "nativeFee", 0);
      if (nativeFee === undefined) throw new Error("The USDT0 route did not return its LayerZero message fee.");
      setQuote({
        amount: formatUnits(amountLD, decimals),
        receiveAmount: formatUnits(expectedReceived, decimals),
        nativeFee: formatUnits(BigInt(String(nativeFee)), 18),
        sourceAsset: selectedSource.tokenSymbol,
        sourceAddress: account,
      });
    } catch (quoteError) {
      setError(quoteError instanceof Error ? quoteError.message : "Could not get a USDT0 bridge quote.");
    } finally {
      setBusy(null);
    }
  };

  const submitBridge = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quote || !walletProvider) return;
    setBusy("send");
    setError("");
    try {
      await ensureSourceChain(walletProvider);
      const provider = new BrowserProvider(walletProvider as never);
      const signer = await provider.getSigner();
      const account = await signer.getAddress();
      if (account.toLowerCase() !== quote.sourceAddress.toLowerCase()) throw new Error("Your connected wallet changed. Review a new quote before sending.");
      const token = new Contract(selectedSource.token, tokenAbi, signer);
      const oft = new Contract(selectedSource.oft, oftAbi, signer);
      const amountLD = parseUnits(quote.amount, selectedSource.decimals);
      const allowance = BigInt(await token.getFunction("allowance").staticCall(account, selectedSource.oft));
      let approvalTxHash = "";
      if (allowance < amountLD) {
        const approve = token.getFunction("approve");
        if (allowance > BigInt(0)) {
          const reset = await approve.send(selectedSource.oft, BigInt(0));
          const resetReceipt = await reset.wait(1);
          if (!resetReceipt || resetReceipt.status !== 1) throw new Error("Could not reset the existing USDT0 approval.");
        }
        const approval = await approve.send(selectedSource.oft, amountLD);
        approvalTxHash = approval.hash;
        const receipt = await approval.wait(1);
        if (!receipt || receipt.status !== 1) throw new Error("USDT0 approval failed.");
      }
      const stellarRecipient = hexlify(StrKey.decodeEd25519PublicKey(walletAddress));
      const sendParam = [bridgeConfig.sourceEid, stellarRecipient, amountLD, parseUnits(quote.receiveAmount, selectedSource.decimals), "0x", "0x", "0x"];
      const feeQuote = await oft.getFunction("quoteSend").staticCall(sendParam, false);
      const nativeFee = BigInt(String(tupleValue(feeQuote, "nativeFee", 0)));
      const sent = await oft.getFunction("send").send(sendParam, { nativeFee, lzTokenFee: BigInt(0) }, account, { value: nativeFee });
      const receipt = await sent.wait(1);
      if (!receipt || receipt.status !== 1) throw new Error("The EVM bridge transaction failed.");
      setApprovalHash(approvalTxHash);
      setTxHash(sent.hash);
      setQuote(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send USDT0 to Stellar.");
    } finally {
      setBusy(null);
    }
  };

  const clearQuote = () => { setQuote(null); setTxHash(""); setApprovalHash(""); setError(""); };

  return (
    <form onSubmit={(event) => void submitBridge(event)} className="w-full min-w-0 max-w-full rounded-2xl border border-foreground/10 bg-background p-4 shadow-xl shadow-black/5 sm:p-6 lg:p-7">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] sm:items-end sm:gap-4">
        <div className="min-w-0"><label htmlFor="evm-stellar-source" className="mb-2 block text-xs font-medium uppercase tracking-wide text-foreground/50">From</label><select id="evm-stellar-source" value={source} onChange={(event) => { setSource(event.target.value as Source); clearQuote(); }} disabled={busy !== null || Boolean(txHash)} className="h-16 w-full min-w-0 rounded-xl border border-foreground/15 bg-foreground/[0.05] px-4 text-sm font-semibold text-foreground sm:h-[72px]">{sourceOptions.map(([key, item]) => <option key={key} value={key} className="bg-background">{item.label} · {item.tokenSymbol}</option>)}</select></div>
        <div aria-hidden="true" className="flex items-center justify-center text-primary sm:pb-3"><span className="sm:hidden"><DirectionArrow vertical /></span><span className="hidden sm:inline-flex"><DirectionArrow /></span></div>
        <div className="min-w-0"><p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/50">To</p><div className="flex h-16 min-w-0 flex-col justify-center rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 sm:h-[72px]"><p className="font-semibold text-foreground">Stellar</p><p className="mt-1 text-xs text-foreground/50">USDT0 · Stellar</p></div></div>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block min-w-0 text-xs font-medium uppercase tracking-wide text-foreground/50">Amount · {selectedSource.tokenSymbol}<input type="number" min={`0.${"0".repeat(selectedSource.decimals - 1)}1`} step={`0.${"0".repeat(selectedSource.decimals - 1)}1`} inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); clearQuote(); }} disabled={busy !== null || Boolean(txHash)} required placeholder="Amount to bridge" className="mt-2 h-12 w-full min-w-0 rounded-xl border border-foreground/15 bg-background px-4 text-sm font-normal text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25" /></label>
        <div className="min-w-0"><p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/50">Stellar recipient</p><div className="flex h-12 min-w-0 max-w-full items-center overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 font-mono text-xs text-foreground/70" title={walletAddress}>{walletAddress}</div></div>
      </div>

      {trustline === null ? <p role="status" className="mt-4 text-sm text-foreground/55">{busy === "destination" ? "Checking your Stellar receiving account…" : "Could not confirm the Stellar receiving account."}</p> : !stellarFunded ? <p role="alert" className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-sm text-amber-100/80">Your Stellar wallet must be funded before it can receive USDT0.</p> : !trustline ? (
        <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/5 p-4">
          <p className="text-sm text-amber-100/80">The receiving wallet needs a USDT0 trustline. Creating it reserves XLM on Stellar.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input type="password" autoComplete="current-password" value={trustlinePassword} onChange={(event) => setTrustlinePassword(event.target.value)} required placeholder="Otterpie account password" className="min-w-0 flex-1 rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground" />
            <button type="button" onClick={() => void setupTrustline()} disabled={busy !== null || !trustlinePassword} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === "trustline" ? "Creating…" : "Create trustline"}</button>
          </div>
        </div>
      ) : null}

      <p className="mt-4 break-all text-xs text-foreground/50">Connected source wallet: {connectedAddress || "Not connected"}{connectedAddress && walletChoice ? " · WalletConnect" : ""}</p>
      <p className="mt-2 text-xs leading-5 text-foreground/50">USDT0 is sent through LayerZero. The Stellar destination must have a USDT0 trustline. Delivery is asynchronous after the source transaction confirms.</p>
      {!connectedAddress && <button type="button" onClick={() => void connect()} disabled={busy !== null || !process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID} className="mt-5 min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === "connect" ? "Connecting…" : "Connect with WalletConnect"}</button>}
      {connectedAddress && !quote && !txHash && <button type="button" onClick={() => void changeWallet()} disabled={busy !== null} className="mt-3 text-xs font-medium text-primary underline disabled:opacity-50">Change wallet</button>}
      {connectedAddress && !quote && !txHash && <button type="button" onClick={() => void requestQuote()} disabled={busy !== null || trustline !== true || !amount} className="mt-5 min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === "quote" ? "Getting live quote…" : "Review bridge"}</button>}
      {quote && <div className="mt-5 rounded-xl border border-primary/15 bg-primary/[0.04] p-4">
        <div className="flex justify-between gap-3 text-sm"><span className="text-foreground/55">You send</span><span>{numberFormat.format(Number(quote.amount))} {quote.sourceAsset}</span></div>
        <div className="mt-2 flex justify-between gap-3 text-sm"><span className="text-foreground/55">Estimated receive</span><span className="font-semibold">{numberFormat.format(Number(quote.receiveAmount))} USDT0</span></div>
        <div className="mt-2 flex justify-between gap-3 text-sm"><span className="text-foreground/55">LayerZero message fee</span><span>{quote.nativeFee} {selectedSource.nativeAsset}</span></div>
        <p className="mt-3 text-xs text-foreground/50">You’ll confirm the token approval (if needed) and bridge transaction in your EVM wallet.</p>
        <button type="submit" disabled={busy !== null} className="mt-4 min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === "send" ? "Confirm in your wallet…" : `Send ${quote.amount} ${quote.sourceAsset} to Stellar`}</button>
      </div>}
      {txHash && <div role="status" className="mt-5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm"><p className="font-semibold text-emerald-300">Bridge transaction submitted</p><p className="mt-1 text-foreground/65">USDT0 delivery to Stellar is pending LayerZero.</p>{approvalHash && <p className="mt-2 break-all text-xs text-foreground/50">Approval: {approvalHash}</p>}<a href={`${selectedSource.explorerUrl}${txHash}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all font-mono text-xs text-primary underline">View source transaction: {txHash}</a><button type="button" onClick={() => { setTxHash(""); setAmount(""); }} className="mt-4 block text-sm font-medium text-primary underline">Bridge more</button></div>}
      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      <p className="mt-4 text-xs text-foreground/45">Keep enough source-chain ETH for gas and the LayerZero fee. The Stellar recipient is your linked Stellar wallet.</p>
    </form>
  );
}
