"use client";
import { Fetch_to } from "@/utilities";
import { useState, FormEvent } from "react";
import { Button, Logo, TextField, ReceiptCard, Checkbox, Select } from "@/components/ui";
import { useRouter } from "next/navigation";
import routes from "@/routes/auth.json"; 

export default function SignupForm() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [network, setNetwork] = useState("stellar");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if(!agreed) return setError("You need to agree to the Terms and Privacy Policy to continue.");

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
        router.push("/auth/login");
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
            placeholder="Aling Nena's Store"
          />
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
            id="username"
            label="Username"
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
          />
          <TextField
            id="password"
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder=""
          />
          <TextField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder=""
          />
          <Select
            id="network"
            label="Wallet network"
            required
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            options={[
              { value: "stellar", label: "Stellar" },
              { value: "bot_chain", label: "Bot Chain" },
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
