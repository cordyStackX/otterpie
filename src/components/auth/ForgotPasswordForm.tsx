"use client";

import { useState, FormEvent } from "react";
import { Button, Logo, TextField, ReceiptCard } from "@/components/ui";
import { Fetch_to } from "@/utilities";
import routes from "@/routes/auth.json";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await Fetch_to("POST", routes["forgot-password"], { email });
      if (!response.success) {
        setError(response.message || "We couldn't send that reset link. Try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("We couldn't send that reset link. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <ReceiptCard>
        <Logo tagline="Sari-sari payments, split in one scan." />

        <div className="bg-background px-6 pt-7 pb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            Check your email
          </h1>
          <p className="text-foreground/60 text-sm mt-1">
            If an account exists for <span className="text-foreground">{email}</span>, we&apos;ll send a password reset link.
          </p>

          <p className="text-center text-sm text-foreground/60 mt-8">
            Didn&apos;t get it?{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-primary font-medium hover:underline"
            >
              Try another email
            </button>
          </p>

          <p className="text-center text-sm text-foreground/60 mt-2">
            <a href="/auth/login" className="text-primary font-medium hover:underline">
              Back to sign in
            </a>
          </p>
        </div>
      </ReceiptCard>
    );
  }

  return (
    <ReceiptCard>
      <Logo tagline="Organized payments, split in one scan." />

      <div className="bg-background px-6 pt-7 pb-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Reset your password
        </h1>
        <p className="text-foreground/60 text-sm mt-1">
          Enter your email and we&apos;ll send a link to reset it.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <TextField
            id="email"
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" loading={loading} loadingText="Sending link…">
            Send reset link
          </Button>
        </form>

        <p className="text-center text-sm text-foreground/60 mt-6">
          <a href="/auth/login" className="text-primary font-medium hover:underline">
            Back to sign in
          </a>
        </p>
      </div>
    </ReceiptCard>
  );
}
