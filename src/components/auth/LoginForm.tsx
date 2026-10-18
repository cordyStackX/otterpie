"use client";

import { useState, FormEvent } from "react";
import { Fetch_to } from "@/utilities";
import { Button, Logo, TextField, ReceiptCard, Checkbox } from "@/components/ui";
import { useRouter } from "next/navigation";
import routes from "@/routes/auth.json";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!agreed) return setError("You need to agree to the Terms and Privacy Policy to continue.");

    try {
      
      const response = await Fetch_to("POST", routes.login, {
        email: email,
        password: password        
      });

      if (response.success) {
        router.push("/home");
      } else {
        return setError(response.message);
      }

    } catch {
      setError("That email and password don't match our records.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ReceiptCard>
      <Logo />

      <div className="bg-background px-6 pt-7 pb-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome back
        </h1>
        <p className="text-foreground/60 text-sm mt-1">
          Sign in to check today&apos;s tab.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <TextField
            id="email"
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@tindahan.com"
          />
          <TextField
            id="password"
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Checkbox
            id="terms"
            required
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            label={
              <>
                I agree to the{" "}
                <a href="/terms" className="text-primary hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </a>
                .
              </>
            }
          />

          <Button type="submit" loading={loading} loadingText="Signing in…">
            Sign in
          </Button>
        </form>

        <p className="text-center text-sm text-foreground/60 mt-6">
          <a href="/auth/forgot-password" className="text-primary font-medium hover:underline">
            Forgot Password
          </a>
        </p>

        <p className="text-center text-sm text-foreground/60 mt-4">
          New here?{" "}
          <a href="/auth/signup" className="text-primary font-medium hover:underline">
            Create an account
          </a>
        </p>
      </div>
    </ReceiptCard>
  );
}
