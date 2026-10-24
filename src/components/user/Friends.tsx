"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Fetch_to } from "@/utilities";
import { getWalletNetworkConfig, isBotChainNetwork, walletNetworkLabel } from "@/utilities/network";
import routes from "@/routes/user.json";
import sessionRoutes from "@/routes/jwt.json";

type OtterFriend = {
  email: string;
  username: string;
  walletAddress: string | null;
  walletNetwork: string | null;
  available: boolean;
};
type SendAsset = { asset: string; balance: string };
type SendResult = { amount: string; asset: string; txHash: string; explorerUrl?: string };

const skeleton = "animate-pulse rounded bg-foreground/10";

function canSendTo(friend: OtterFriend, network: string) {
  if (!friend.walletAddress || !friend.walletNetwork) return false;
  const sender = getWalletNetworkConfig(network);
  const recipient = getWalletNetworkConfig(friend.walletNetwork);
  if (!sender || !recipient || sender.family !== recipient.family) return false;
  return sender.family !== "stellar" || friend.walletNetwork === network;
}

export default function Friends() {
  const [friends, setFriends] = useState<OtterFriend[]>([]);
  const [balances, setBalances] = useState<SendAsset[]>([]);
  const [network, setNetwork] = useState("");
  const [email, setEmail] = useState("");
  const [friendSearch, setFriendSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  const [addMessage, setAddMessage] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sendingTo, setSendingTo] = useState<OtterFriend | null>(null);
  const [sendAsset, setSendAsset] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendPassword, setSendPassword] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  const walletConfig = getWalletNetworkConfig(network);
  const withdrawRoute = walletConfig?.routes.withdraw ?? "";
  const availableAssets = useMemo(() => {
    const allowed = isBotChainNetwork(network)
      ? ["BOT", "PIE", "USDT"]
      : network === "stellar_testnet" ? ["XLM", "USDC"] : ["XLM"];
    return balances.filter((item) => allowed.includes(item.asset) && Number(item.balance) > 0);
  }, [balances, network]);
  const selectedAsset = availableAssets.find((item) => item.asset === sendAsset) ?? availableAssets[0];
  const visibleFriends = useMemo(() => {
    const query = friendSearch.trim().toLowerCase();
    if (!query) return friends;
    return friends.filter((friend) =>
      [friend.username, friend.email, friend.walletAddress ?? ""]
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [friendSearch, friends]);

  const loadBalances = useCallback(async (activeNetwork: string) => {
    setBalanceLoading(true);
    const config = getWalletNetworkConfig(activeNetwork);
    if (!config?.routes.balance) {
      setBalances([]);
      setBalanceLoading(false);
      return;
    }
    const response = await Fetch_to("POST", config.routes.balance, {}, undefined, 1);
    const items = response.success && Array.isArray(response.data?.balances)
      ? response.data.balances as SendAsset[]
      : [];
    setBalances(items);
    setBalanceLoading(false);
  }, []);

  const loadFriends = useCallback(async () => {
    setLoading(true);
    const [sessionResponse, friendsResponse] = await Promise.all([
      Fetch_to("GET", sessionRoutes.verify, {}, undefined, 1),
      Fetch_to("GET", routes.friends, {}, undefined, 1),
    ]);
    if (!sessionResponse.success) {
      setError("Your session expired. Please sign in again.");
      setLoading(false);
      return;
    }
    const activeNetwork = sessionResponse.data?.message?.data?.network;
    if (typeof activeNetwork !== "string") {
      setError("Could not determine your wallet network.");
      setLoading(false);
      return;
    }
    setNetwork(activeNetwork);
    if (friendsResponse.success) {
      setFriends(Array.isArray(friendsResponse.data?.friends) ? friendsResponse.data.friends : []);
      setError("");
    } else {
      setError(friendsResponse.message || "Could not load your Otter friends.");
    }
    setLoading(false);
    void loadBalances(activeNetwork);
  }, [loadBalances]);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  const addFriend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setAddError("");
    setAddMessage("");
    setError("");
    setMessage("");
    const response = await Fetch_to("POST", routes.friends, { action: "add", email: email.trim() }, undefined, 1);
    if (response.success && response.data?.friend) {
      setFriends((current) => current.some((friend) => friend.email === response.data.friend.email)
        ? current
        : [...current, response.data.friend]);
      setEmail("");
      setAddMessage(`${response.data.friend.username} added to your Otter friends.`);
    } else {
      setAddError(response.message || "Could not add this Otter friend.");
    }
    setSaving(false);
  };

  const removeFriend = async (friend: OtterFriend) => {
    setRemovingEmail(friend.email);
    setError("");
    setMessage("");
    const response = await Fetch_to("POST", routes.friends, { action: "remove", email: friend.email }, undefined, 1);
    if (response.success) {
      setFriends((current) => current.filter((item) => item.email !== friend.email));
      setMessage(`${friend.username} removed from your Otter friends.`);
    } else {
      setError(response.message || "Could not remove this Otter friend.");
    }
    setRemovingEmail(null);
  };

  const openSend = (friend: OtterFriend) => {
    setSendingTo(friend);
    setSendAsset(availableAssets[0]?.asset ?? "");
    setSendAmount("");
    setSendPassword("");
    setSendError("");
    setSendResult(null);
  };

  const sendFunds = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sendingTo || !selectedAsset || !withdrawRoute) return;
    const amount = Number(sendAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(selectedAsset.balance)) {
      setSendError("Enter an amount greater than zero and within your available balance.");
      return;
    }
    setSendBusy(true);
    setSendError("");
    const response = await Fetch_to("POST", withdrawRoute, {
      address: sendingTo.walletAddress,
      asset: selectedAsset.asset,
      amount: sendAmount.trim(),
      password: sendPassword,
    }, undefined, 1);
    if (response.success && typeof response.data?.txHash === "string") {
      const hash = response.data.txHash as string;
      const txTemplate = walletConfig?.explorer.transactionUrlTemplate;
      setSendResult({
        amount: typeof response.data.amount === "string" ? response.data.amount : sendAmount.trim(),
        asset: selectedAsset.asset,
        txHash: hash,
        explorerUrl: txTemplate?.replace("{hash}", encodeURIComponent(hash)),
      });
      setSendPassword("");
      void loadBalances(network);
    } else {
      setSendError(response.message || "Could not send this transfer.");
    }
    setSendBusy(false);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <section className="mx-auto max-w-7xl space-y-6 pt-8 md:pl-72">
        <header>
          <p className="text-sm font-medium text-primary">Your people</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Friends</h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/55">
            Add Otterpie accounts by email, view their public wallet address, or send them funds on a matching network.
          </p>
        </header>

        <section className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-7" aria-labelledby="add-friend-title">
          <div className="flex items-start gap-3">
            <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
                <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20M18 8h5m-2.5-2.5v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h2 id="add-friend-title" className="text-base font-semibold">Add New Otter Friend</h2>
              <p className="mt-1 text-sm text-foreground/50">Enter the email address they use for their confirmed Otterpie account.</p>
            </div>
          </div>

          <form onSubmit={(event) => void addFriend(event)} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="otter-friend-email" className="sr-only">Friend’s Otterpie email</label>
            <input id="otter-friend-email" type="email" autoComplete="email" required maxLength={254} value={email}
              onChange={(event) => setEmail(event.target.value)} disabled={saving} placeholder="friend@example.com"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm outline-none placeholder:text-foreground/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
            <button type="submit" disabled={saving || !email.trim()} className="min-h-11 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "Adding friend…" : "Add Otter Friend"}
            </button>
          </form>
          {addError && <p role="alert" className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-300">{addError}</p>}
          {addMessage && <p role="status" className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">{addMessage}</p>}
        </section>

        <section className="overflow-hidden rounded-2xl border border-foreground/10 bg-background" aria-labelledby="manage-friends-title">
          <div className="flex flex-col gap-1 border-b border-foreground/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 id="manage-friends-title" className="text-base font-semibold">Manage Otter Friends</h2>
              <p className="mt-1 text-sm text-foreground/50">Wallet addresses come from each friend’s Otterpie wallet record.</p>
            </div>
            <span className="text-xs text-foreground/40">{loading ? "Loading…" : `${friends.length} friend${friends.length === 1 ? "" : "s"}`}</span>
          </div>

          {!loading && friends.length > 0 && (
            <div className="border-b border-foreground/10 px-5 py-4 sm:px-6">
              <label htmlFor="friend-search" className="sr-only">Search friends</label>
              <input
                id="friend-search"
                type="search"
                value={friendSearch}
                onChange={(event) => setFriendSearch(event.target.value)}
                placeholder="Search by name, email, or wallet address"
                className="min-h-10 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm outline-none placeholder:text-foreground/35 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 sm:max-w-md"
              />
              {friendSearch.trim() && <p className="mt-2 text-xs text-foreground/45">Showing {visibleFriends.length} of {friends.length} friends</p>}
            </div>
          )}

          {error && <p role="alert" className="mx-5 mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-300 sm:mx-6">{error}</p>}
          {message && <p role="status" className="mx-5 mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300 sm:mx-6">{message}</p>}

          {loading ? (
            <div role="status" aria-label="Loading Otter friends" className="space-y-4 p-5 sm:p-6">
              <span className="sr-only">Loading your friends…</span>
              {[0, 1, 2].map((item) => <div key={item} className="flex items-center gap-4"><div className={`${skeleton} h-11 w-11 rounded-full`} /><div className="flex-1 space-y-2"><div className={`${skeleton} h-4 w-36`} /><div className={`${skeleton} h-3 w-52 max-w-full`} /></div><div className={`${skeleton} h-9 w-20`} /></div>)}
            </div>
          ) : friends.length === 0 ? (
            <div className="px-5 py-12 text-center sm:px-6">
              <p className="text-sm font-medium">No Otter friends yet</p>
              <p className="mt-1 text-sm text-foreground/45">Add a confirmed Otterpie account using their email above.</p>
            </div>
          ) : visibleFriends.length === 0 ? (
            <div className="px-5 py-12 text-center sm:px-6">
              <p className="text-sm font-medium">No matching friends</p>
              <p className="mt-1 text-sm text-foreground/45">Try another name, email, or wallet address.</p>
            </div>
          ) : (
            <ul className="divide-y divide-foreground/10">
              {visibleFriends.map((friend) => {
                const networkMatches = canSendTo(friend, network);
                return (
                  <li key={friend.email} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:px-6">
                    <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold uppercase text-primary">{(friend.username || friend.email).slice(0, 1)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{friend.username}</p>
                      <p className="mt-0.5 break-all text-sm text-foreground/50">{friend.email}</p>
                      {friend.available && friend.walletAddress ? (
                        <div className="mt-3 rounded-lg border border-foreground/10 bg-foreground/[0.03] p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/40">{friend.walletNetwork ? walletNetworkLabel(friend.walletNetwork) : "Wallet"} address</p>
                          <p className="mt-1 break-all font-mono text-xs leading-5 text-foreground/70">{friend.walletAddress}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-amber-200/70">{friend.available ? "No wallet address is available for this account." : "This Otterpie account is no longer available."}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button type="button" onClick={() => openSend(friend)} disabled={!networkMatches || balanceLoading || availableAssets.length === 0}
                        title={!networkMatches ? "Your friend needs a wallet on the same network." : availableAssets.length === 0 ? "No supported asset balance is available to send." : undefined}
                        className="min-h-9 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                        Send funds
                      </button>
                      <button type="button" onClick={() => void removeFriend(friend)} disabled={removingEmail !== null}
                        className="min-h-9 rounded-lg border border-foreground/15 px-3 py-2 text-xs font-medium text-foreground/65 transition-colors hover:border-rose-400/30 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50">
                        {removingEmail === friend.email ? "Removing…" : "Unfriend"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </section>

      {sendingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !sendBusy) setSendingTo(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="send-friend-title" className="w-full max-w-md rounded-2xl border border-foreground/10 bg-background p-6 text-foreground shadow-2xl">
            {sendResult ? (
              <div>
                <p className="text-xs font-medium text-emerald-400">Transfer submitted</p>
                <h2 id="send-friend-title" className="mt-1 text-lg font-semibold">Sent {sendResult.amount} {sendResult.asset}</h2>
                <p className="mt-2 text-sm text-foreground/55">To {sendingTo.username} · {walletNetworkLabel(network)}</p>
                <p className="mt-3 break-all rounded-lg bg-foreground/[0.04] p-3 font-mono text-xs text-foreground/60">{sendResult.txHash}</p>
                {sendResult.explorerUrl && <a href={sendResult.explorerUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-primary underline underline-offset-4">View transaction</a>}
                <button type="button" onClick={() => setSendingTo(null)} className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background">Done</button>
              </div>
            ) : (
              <form onSubmit={(event) => void sendFunds(event)}>
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-xs font-medium text-primary">{walletNetworkLabel(network)}</p><h2 id="send-friend-title" className="mt-1 text-lg font-semibold">Send funds to {sendingTo.username}</h2></div>
                  <button type="button" aria-label="Close" disabled={sendBusy} onClick={() => setSendingTo(null)} className="text-2xl leading-none text-foreground/50">×</button>
                </div>
                <p className="mt-3 break-all rounded-lg bg-foreground/[0.04] p-3 font-mono text-xs text-foreground/55">{sendingTo.walletAddress}</p>
                <label htmlFor="friend-send-asset" className="mt-4 block text-sm font-medium">Asset</label>
                <select id="friend-send-asset" value={selectedAsset?.asset ?? ""} onChange={(event) => { setSendAsset(event.target.value); setSendAmount(""); setSendError(""); }} disabled={sendBusy || availableAssets.length === 0} className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm">
                  {availableAssets.length === 0 ? <option value="">No supported balance available</option> : availableAssets.map((asset) => <option key={asset.asset} value={asset.asset}>{asset.asset} · {asset.balance}</option>)}
                </select>
                <p className="mt-2 text-xs text-foreground/45">Available: {selectedAsset?.balance ?? "0"} {selectedAsset?.asset ?? ""}</p>
                <label htmlFor="friend-send-amount" className="mt-4 block text-sm font-medium">Amount</label>
                <input id="friend-send-amount" type="number" min="0" max={selectedAsset?.balance} step="any" inputMode="decimal" value={sendAmount}
                  onChange={(event) => setSendAmount(event.target.value)} disabled={sendBusy || !selectedAsset} required className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm" />
                <label htmlFor="friend-send-password" className="mt-4 block text-sm font-medium">Confirm with your account password</label>
                <input id="friend-send-password" type="password" autoComplete="current-password" value={sendPassword} onChange={(event) => setSendPassword(event.target.value)} disabled={sendBusy} required className="mt-1.5 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-sm" />
                {sendError && <p role="alert" className="mt-3 text-sm text-rose-400">{sendError}</p>}
                <p className="mt-3 text-xs leading-5 text-foreground/45">This sends a direct wallet transfer. Check the friend’s address and network before confirming.</p>
                <button type="submit" disabled={sendBusy || !selectedAsset || availableAssets.length === 0} className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50">
                  {sendBusy ? "Sending transfer…" : `Send ${sendAsset || "funds"}`}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
