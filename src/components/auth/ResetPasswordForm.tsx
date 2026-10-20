"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button, Logo, ReceiptCard, TextField } from "@/components/ui";
import { Fetch_to } from "@/utilities";
import routes from "@/routes/auth.json";

type ResetPasswordFormProps = {
  token: string;
};

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing or invalid. Request a new one.");
      return;
    }
    if (password.length <= 8) {
      setError("Password must be more than 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await Fetch_to("POST", routes["reset-password"], { token, password });
      if (!response.success) {
        setError(response.message || "This reset link is invalid or expired.");
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setResetComplete(true);
    } catch {
      setError("We couldn't reset your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReceiptCard>
      <Logo tagline="Organized payments, split in one scan." />
      <div className="bg-background px-6 pb-8 pt-7">
        {resetComplete ? (
          <>
            <h1 className="text-2xl font-semibold text-foreground">Password updated</h1>
            <p className="mt-2 text-sm text-foreground/60">Your password has been reset. You can sign in with your new password now.</p>
            <Link href="/auth/login" className="mt-6 block rounded-md bg-primary px-3 py-2.5 text-center text-sm font-medium text-background transition-colors hover:bg-primary/90">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-foreground">Choose a new password</h1>
            <p className="mt-1 text-sm text-foreground/60">This reset link is valid for 20 minutes and can only be used once.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <TextField
                id="new-password"
                label="New password"
                type="password"
                autoComplete="new-password"
                minLength={9}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <TextField
                id="confirm-password"
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                minLength={9}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <Button type="submit" loading={loading} loadingText="Updating password…">
                Reset password
              </Button>
            </form>
          </>
        )}
      </div>
    </ReceiptCard>
  );
}
