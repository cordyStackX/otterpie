"use client";

import { Paiflow } from "@/components/user";
import { Fetch_to } from "@/utilities";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import routes from "@/routes/jwt.json";

export default function UserPaiflowPage() {
  const router = useRouter();
  const [data, setData] = useState({ email: "", network: "", username: "", wallet_address: "" });
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      const response = await Fetch_to("GET", routes.verify);
      if (!response.success) {
        router.push("/auth/login");
        return;
      }
      const user = response.data.message.data;
      if (!cancelled) {
        setData({
          email: user.email,
          network: user.network,
          username: user.username,
          wallet_address: user.wallet_address,
        });
        setLoadingSession(false);
      }
    };
    void verify();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <section className="mx-auto max-w-7xl pt-8 md:pl-72">
        {loadingSession ? (
          <div role="status" aria-label="Loading wallet session" className="mx-auto max-w-5xl space-y-6">
            <span className="sr-only">Loading your wallet session…</span>
            <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
              <div className="h-3 w-40 rounded bg-foreground/10" />
              <div className="mt-3 h-8 w-32 rounded bg-foreground/10" />
              <div className="mt-2 h-4 w-72 max-w-full rounded bg-foreground/[0.07]" />
            </div>
            <div aria-hidden="true" className="grid gap-4 lg:grid-cols-2">
              <div className="h-80 animate-pulse motion-reduce:animate-none rounded-2xl border border-foreground/10 bg-foreground/[0.03]" />
              <div className="h-80 animate-pulse motion-reduce:animate-none rounded-2xl border border-foreground/10 bg-foreground/[0.03]" />
            </div>
          </div>
        ) : (
          <Paiflow network={data.network} />
        )}
      </section>
    </main>
  );
}
