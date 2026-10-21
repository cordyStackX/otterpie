"use client";
import { Fetch_to } from "@/utilities";
import { useState, FormEvent } from "react";
import { Button, Logo, TextField, ReceiptCard, Checkbox, Select } from "@/components/ui";
import routes from "@/routes/auth.json"; 

export default function SignupForm() {
  const [storeName, setStoreName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [network, setNetwork] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if(!agreed) return setError("You need to agree to the Terms and Privacy Policy to continue.");

    if (username.trim().length >= 15) {
      setError("Username must be fewer than 15 characters.");
      return;
    }

    if (password.length <= 8) {
      setError("Password must be more than 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      
      const response = await Fetch_to("POST", routes.singup, {
        storeName: storeName,
        email: email,
        password: confirmPassword,
        network: network,
        username: username
      },);

      if (response.success) {
        setConfirmationSent(true);
      } else {
        return setError(response.message);
      }

    } catch (e) {
      setError("Something Went Wrong");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (confirmationSent) {
    return (
      <ReceiptCard>
        <Logo tagline="Set up your store in a few taps." />
        <div className="bg-background px-6 pb-8 pt-7">
          <h1 className="text-2xl font-semibold text-foreground">Confirm your email</h1>
          <p className="mt-2 text-sm leading-6 text-foreground/60">
            We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Open it to activate your account, then sign in.
          </p>
          <p className="mt-6 text-center text-sm text-foreground/60">
            Already confirmed?{" "}
            <a href="/auth/login" className="font-medium text-primary hover:underline">Sign in</a>
          </p>
        </div>
      </ReceiptCard>
    );
  }

  return (
    <ReceiptCard>
      <Logo tagline="Set up your store in a few taps." />

      <div className="bg-background px-6 pt-7 pb-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Create your account
        </h1>
        <p className="text-foreground/60 text-sm mt-1">
          Start splitting payments the moment you open.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <TextField
            id="storeName"
            label="Store name"
            type="text"
            required
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Enter store name"
          />
          <TextField
            id="username"
            label="Username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.slice(0, 14))}
            placeholder="Enter username"
            autoComplete="username_v1"
            maxLength={14}
          />
          <p className="-mt-3 text-xs text-foreground/50">Up to 14 characters.</p>
          <TextField
            id="email"
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="eamil"
          />
          
          <TextField
            id="password"
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={9}
          />
          <p className="-mt-3 text-xs text-foreground/50">Use at least 9 characters.</p>
          <TextField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            minLength={9}
          />
          <Select
            id="network"
            label="Wallet network"
            required
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            options={[
              { value: "", label: "Select Networks" },
              { value: "bot_chain", label: "BOT Chain Mainnet" },
              { value: "stellar", label: "Stellar Mainnet" }
            ]}
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


          <Button type="submit" loading={loading} loadingText="Creating account…">
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-foreground/60 mt-6">
          Already have an account?{" "}
          <a href="/auth/login" className="text-primary font-medium hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </ReceiptCard>
  );
}
