"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Fetch_to } from "@/utilities"; 
import { getWalletNetworkConfig, walletNetworkLabel } from "@/utilities/network";
import routes from "@/routes/user.json";
import authRoutes from "@/routes/auth.json";

type SettingProps = {
  email: string;
  username: string;
  walletAddress: string;
  network: string;
  onUsernameChange: (username: string) => void;
};

const card = "rounded-2xl border border-foreground/10 bg-background shadow-sm";

export default function Setting({ email, username, walletAddress, network, onUsernameChange }: SettingProps) {
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [secretPassword, setSecretPassword] = useState("");
  const [agreedToSecretReveal, setAgreedToSecretReveal] = useState(false);
  const [secretConfirmationMessage, setSecretConfirmationMessage] = useState("");
  const [walletSecret, setWalletSecret] = useState("");
  const [revealingSecret, setRevealingSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newUsername, setNewUsername] = useState(username);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState("");
  const [sendingForgotPassword, setSendingForgotPassword] = useState(false);
  const [trustlineStatus, setTrustlineStatus] = useState<"loading" | "ready" | "missing" | "unfunded" | "error">("loading");
  const [trustlinePassword, setTrustlinePassword] = useState("");
  const [trustlineBusy, setTrustlineBusy] = useState(false);
  const [trustlineMessage, setTrustlineMessage] = useState("");
  const [trustlineRefresh, setTrustlineRefresh] = useState(0);
  const isStellarWallet = getWalletNetworkConfig(network)?.walletType === "stellar";

  useEffect(() => setNewUsername(username), [username]);

  useEffect(() => {
    if (!isStellarWallet) return;
    let cancelled = false;
    setTrustlineStatus("loading");
    setTrustlineMessage("");
    void (async () => {
      try {
        const response = await Fetch_to("POST", routes["bridge-non-evm"], { action: "destination" }, undefined, 1);
        if (!response.success) throw new Error(response.message || "Could not check the Stellar trustline.");
        const data = response.data as { address?: string; trustline?: boolean; funded?: boolean };
        if (data.address !== walletAddress) throw new Error("The Stellar wallet does not match this account.");
        if (!cancelled) setTrustlineStatus(data.funded === false ? "unfunded" : data.trustline ? "ready" : "missing");
      } catch (error) {
        if (!cancelled) {
          setTrustlineStatus("error");
          setTrustlineMessage(error instanceof Error ? error.message : "Could not check the Stellar trustline.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isStellarWallet, trustlineRefresh, walletAddress]);

  const createUsdt0Trustline = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trustlinePassword || trustlineBusy) return;
    setTrustlineBusy(true);
    setTrustlineMessage("");
    try {
      const response = await Fetch_to("POST", routes["bridge-non-evm"], { action: "trustline", password: trustlinePassword }, undefined, 1);
      if (!response.success) throw new Error(response.message || "Could not create the USDT0 trustline.");
      setTrustlinePassword("");
      setTrustlineStatus("ready");
      setTrustlineMessage("USDT0 trustline created. Your Stellar wallet can now receive USDT0.");
    } catch (error) {
      setTrustlineMessage(error instanceof Error ? error.message : "Could not create the USDT0 trustline.");
    } finally {
      setTrustlineBusy(false);
    }
  };

  const updateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanUsername = newUsername.trim();
    if (!cleanUsername || cleanUsername.length >= 15) {
      setUsernameMessage("Username must be between 1 and 14 characters.");
      return;
    }

    setSavingUsername(true);
    setUsernameMessage("");
    try {
      const response = await Fetch_to("PATCH", routes.modify_user_data, {
        hasUsername: cleanUsername,
        email,
      });
      if (!response.success) {
        setUsernameMessage(response.message || "Could not update username.");
        return;
      }
      const updatedUsername = cleanUsername.toLowerCase();
      setNewUsername(updatedUsername);
      onUsernameChange(updatedUsername);
      setUsernameMessage("Profile updated.");
    } catch {
      setUsernameMessage("Could not update username. Please try again.");
    } finally {
      setSavingUsername(false);
    }
  };

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length <= 8) {
      setPasswordMessage("Password must be more than 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("New password and confirmation do not match.");
      return;
    }

    setSavingPassword(true);
    setPasswordMessage("");
    try {
      const response = await Fetch_to("PATCH", routes.modify_user_data, { hasPassword: currentPassword, hasNewPassword: newPassword, email: email });
      if (!response.success) {
        setPasswordMessage(response.message || "Could not update password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated.");
    } catch {
      setPasswordMessage("Could not update password. Please try again.");
    } finally {
      setSavingPassword(false);
    }
  };

  const sendForgotPasswordLink = async () => {
    setSendingForgotPassword(true);
    setForgotPasswordMessage("");
    try {
      const response = await Fetch_to("POST", authRoutes["forgot-password"], { email });
      setForgotPasswordMessage(
        response.success
          ? `If an account exists for ${email}, a password reset link will be sent.`
          : response.message || "Could not send a reset link. Please try again."
      );
    } catch {
      setForgotPasswordMessage("Could not send a reset link. Please try again.");
    } finally {
      setSendingForgotPassword(false);
    }
  };

  const copyWalletAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const openSecretDialog = () => {
    setSecretPassword("");
    setAgreedToSecretReveal(false);
    setSecretConfirmationMessage("");
    setWalletSecret("");
    setSecretDialogOpen(true);
  };

  const closeSecretDialog = () => {
    setSecretDialogOpen(false);
    setSecretPassword("");
    setAgreedToSecretReveal(false);
    setSecretConfirmationMessage("");
    setWalletSecret("");
  };

  const showSecrets = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!secretPassword || !agreedToSecretReveal || revealingSecret) return;

    setRevealingSecret(true);
    setSecretConfirmationMessage("");
    try {
      const response = await Fetch_to("POST", routes.show_secrets, {
        email: email,
        password: secretPassword
      });

      if (!response.success) {
        setSecretConfirmationMessage(response.message || "Could not retrieve your wallet secret. Please try again.");
        return;
      }

      const secret = response.data?.secret;
      if (typeof secret !== "string" || !secret) {
        setSecretConfirmationMessage("Could not retrieve your wallet secret. Please try again.");
        return;
      }

      setWalletSecret(secret);
      setSecretPassword("");
    } catch {
      setSecretConfirmationMessage("Could not retrieve your wallet secret. Please try again.");
    } finally {
      setRevealingSecret(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 text-foreground">
      <header>
        <p className="text-sm font-medium text-primary">Account</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/55">
          Manage your profile details and review the wallet connected to your account.
        </p>
      </header>

      <section aria-labelledby="profile-title" className={`${card} p-5 sm:p-7`}>
        <div className="mb-6 flex items-start gap-4 border-b border-foreground/10 pb-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
              <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.6" />
              <path d="M5.5 20c.7-3.4 3-5.1 6.5-5.1s5.8 1.7 6.5 5.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 id="profile-title" className="text-lg font-semibold">Profile information</h2>
            <p className="mt-1 text-sm text-foreground/55">Your account name and sign-in email.</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={updateProfile}>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block text-sm font-medium" htmlFor="setting-username">
            Username
            <input
              id="setting-username"
              value={newUsername}
              onChange={(event) => { setNewUsername(event.target.value.slice(0, 14)); setUsernameMessage(""); }}
              maxLength={14}
              required
              className="mt-2 w-full rounded-xl border border-foreground/10 bg-background px-4 py-3 text-sm font-normal outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
            />
            <span className="mt-1.5 block text-xs font-normal text-foreground/45">Usernames must be fewer than 15 characters.</span>
          </label>
          <label className="block text-sm font-medium" htmlFor="setting-email">
            Email address
            <input
              id="setting-email"
              type="email"
              value={email}
              readOnly
              className="mt-2 w-full rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-sm font-normal text-foreground/75 outline-none"
            />
          </label>
        </div>
        {usernameMessage && <p role="status" className={`text-sm ${usernameMessage.includes("updated") ? "text-emerald-600" : "text-rose-600"}`}>{usernameMessage}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={savingUsername} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-wait disabled:opacity-60">
            {savingUsername ? "Saving…" : "Save profile"}
          </button>
        </div>
        </form>

        <div className="mt-7 border-t border-foreground/10 pt-6">
          <div className="mb-5">
            <h3 className="text-base font-semibold">Change password</h3>
            <p className="mt-1 text-sm text-foreground/55">Choose a new password for your account.</p>
          </div>
          <form
            className="space-y-5"
            onSubmit={updatePassword}
          >
            <label className="block text-sm font-medium" htmlFor="current-password">
              Current password
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => { setCurrentPassword(event.target.value); setPasswordMessage(""); }}
                required
                className="mt-2 w-full rounded-xl border border-foreground/10 bg-background px-4 py-3 text-sm font-normal outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm font-medium" htmlFor="new-password">
                New password
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => { setNewPassword(event.target.value); setPasswordMessage(""); }}
                  minLength={9}
                  required
                  className="mt-2 w-full rounded-xl border border-foreground/10 bg-background px-4 py-3 text-sm font-normal outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                />
                <span className="mt-1.5 block text-xs font-normal text-foreground/45">Use at least 9 characters.</span>
              </label>
              <label className="block text-sm font-medium" htmlFor="confirm-password">
                Confirm new password
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => { setConfirmPassword(event.target.value); setPasswordMessage(""); }}
                  minLength={9}
                  required
                  className="mt-2 w-full rounded-xl border border-foreground/10 bg-background px-4 py-3 text-sm font-normal outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                />
              </label>
            </div>
            {passwordMessage && (
              <p role="status" className={`text-sm ${passwordMessage.includes("updated") ? "text-emerald-600" : "text-rose-600"}`}>
                {passwordMessage}
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={sendForgotPasswordLink}
                disabled={sendingForgotPassword || !email}
                className="rounded-xl border border-foreground/15 px-5 py-3 text-center text-sm font-medium text-foreground/75 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {sendingForgotPassword ? "Sending link…" : "Forgot password?"}
              </button>
              <button
                type="submit"
                disabled={savingPassword}
                className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-wait disabled:opacity-60"
              >
                {savingPassword ? "Updating…" : "Update password"}
              </button>
            </div>
            {forgotPasswordMessage && (
              <p role="status" className={`text-right text-sm ${forgotPasswordMessage.startsWith("If an account exists") ? "text-emerald-600" : "text-rose-600"}`}>
                {forgotPasswordMessage}
              </p>
            )}
          </form>
        </div>
      </section>

      <section aria-labelledby="wallet-title" className={`${card} p-5 sm:p-7`}>
        <div className="mb-6 flex items-start gap-4 border-b border-foreground/10 pb-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
              <rect x="3.5" y="6" width="17" height="13.5" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3.5 9.5h17M16 14h1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M6 6V4.8A1.8 1.8 0 0 1 8.2 3h10.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 id="wallet-title" className="text-lg font-semibold">Wallet</h2>
            <p className="mt-1 text-sm text-foreground/55">Your public receiving address and wallet network.</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label htmlFor="setting-wallet-address" className="text-sm font-medium">Wallet address</label>
              {network && (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                  {walletNetworkLabel(network)}
                </span>
              )}
            </div>
            <div className="flex min-w-0 gap-2">
              <input
                id="setting-wallet-address"
                value={walletAddress || "Wallet address unavailable"}
                readOnly
                className="min-w-0 flex-1 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 font-mono text-xs text-foreground/75 outline-none sm:text-sm"
              />
              <button
                type="button"
                onClick={copyWalletAddress}
                disabled={!walletAddress}
                className="shrink-0 rounded-xl border border-foreground/10 px-3.5 py-3 text-sm font-medium transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={openSecretDialog}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 px-4 py-3 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:text-amber-300"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path d="M10 2.5 3.5 5v4.4c0 4.1 2.7 6.7 6.5 8.1 3.8-1.4 6.5-4 6.5-8.1V5L10 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M10 8v4m0 2h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Show wallet secret
          </button>
        </div>
        <p className="mt-4 text-xs leading-5 text-foreground/45">
          Your address is public and safe to share for receiving funds. Never share your wallet secret with anyone.
        </p>
      </section>

      {isStellarWallet && <section aria-labelledby="stellar-trustline-title" className={`${card} p-5 sm:p-7`}>
        <div className="mb-5 border-b border-foreground/10 pb-5">
          <h2 id="stellar-trustline-title" className="text-lg font-semibold">Stellar USDT0 trustline</h2>
          <p className="mt-1 text-sm leading-6 text-foreground/55">A trustline lets your Stellar wallet hold USDT0. Creating it reserves XLM on Stellar; the reserve is not a transaction fee.</p>
        </div>
        {trustlineStatus === "loading" ? <p role="status" className="text-sm text-foreground/55">Checking your USDT0 trustline…</p>
          : trustlineStatus === "ready" ? <p role="status" className="text-sm text-emerald-500">Your wallet has a USDT0 trustline and can receive USDT0.</p>
          : trustlineStatus === "unfunded" ? <p role="alert" className="text-sm text-amber-600 dark:text-amber-300">Fund your Stellar wallet with XLM before creating a trustline.</p>
          : trustlineStatus === "missing" ? <form onSubmit={(event) => void createUsdt0Trustline(event)} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label htmlFor="stellar-trustline-password" className="block text-sm font-medium">Confirm with your account password
              <input id="stellar-trustline-password" type="password" autoComplete="current-password" value={trustlinePassword} onChange={(event) => setTrustlinePassword(event.target.value)} required disabled={trustlineBusy} className="mt-2 w-full rounded-xl border border-foreground/10 bg-background px-4 py-3 text-sm font-normal outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15" />
            </label>
            <button type="submit" disabled={!trustlinePassword || trustlineBusy} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-background disabled:cursor-wait disabled:opacity-50">{trustlineBusy ? "Creating trustline…" : "Create USDT0 trustline"}</button>
          </form>
          : <div className="flex flex-wrap items-center gap-3"><p role="alert" className="text-sm text-rose-500">{trustlineMessage || "Could not check the USDT0 trustline."}</p><button type="button" onClick={() => setTrustlineRefresh((value) => value + 1)} className="text-sm font-medium text-primary underline">Try again</button></div>}
        {trustlineMessage && trustlineStatus !== "error" && <p role="status" className={`mt-3 text-sm ${trustlineStatus === "ready" ? "text-emerald-500" : "text-rose-500"}`}>{trustlineMessage}</p>}
      </section>}

      {secretDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSecretDialog();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-secret-title"
            className="my-auto w-full max-w-md rounded-2xl border border-foreground/10 bg-background p-6 text-foreground shadow-2xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                <path d="M12 3 2.8 19h18.4L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M12 9v4m0 3h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h2 id="wallet-secret-title" className="mt-4 text-lg font-semibold">Confirm wallet secret reveal</h2>
            <p className="mt-2 text-sm leading-6 text-foreground/60">
              Confirm your account password and acknowledge the risks before revealing your wallet secret.
            </p>

            {walletSecret ? (
              <div className="mt-5 space-y-4">
                <p className="text-sm leading-6 text-foreground/65">Your wallet secret is visible below. Anyone who gets it can control your wallet.</p>
                <textarea
                  aria-label="Wallet secret"
                  readOnly
                  value={walletSecret}
                  rows={4}
                  spellCheck={false}
                  className="w-full resize-y rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 font-mono text-sm leading-6 text-foreground outline-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeSecretDialog}
                    className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                  >
                    Hide wallet secret
                  </button>
                </div>
              </div>
            ) : (
            <form className="mt-5 space-y-4" onSubmit={showSecrets}>
              <label className="block text-sm font-medium" htmlFor="secret-confirm-password">
                Account password
                <input
                  id="secret-confirm-password"
                  type="password"
                  autoComplete="current-password"
                  value={secretPassword}
                  onChange={(event) => { setSecretPassword(event.target.value); setSecretConfirmationMessage(""); }}
                  required
                  className="mt-2 w-full rounded-xl border border-foreground/10 bg-background px-4 py-3 text-sm font-normal outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-foreground/70">
                Anyone with your wallet secret can control the funds in your wallet. Never share it or save it somewhere public.
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-foreground/10 p-4 text-sm leading-6 text-foreground/70">
                <input
                  type="checkbox"
                  checked={agreedToSecretReveal}
                  onChange={(event) => { setAgreedToSecretReveal(event.target.checked); setSecretConfirmationMessage(""); }}
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                />
                <span>
                  I have read and agree to the{" "}
                  <a href="/terms" target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">Terms of Service</a>
                  {" "}and{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">Privacy Policy</a>
                  {", and I understand the risk of revealing my wallet secret."}
                </span>
              </label>

              {secretConfirmationMessage && (
                <p role="status" className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm text-foreground/65">
                  {secretConfirmationMessage}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeSecretDialog}
                  className="rounded-xl border border-foreground/15 px-5 py-3 text-sm font-medium text-foreground/75 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!secretPassword || !agreedToSecretReveal || revealingSecret}
                  className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {revealingSecret ? "Verifying…" : "I agree, reveal secret"}
                </button>
              </div>
            </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
