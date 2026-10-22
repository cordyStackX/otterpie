"use client";

import { Balance } from "@/components/user";
import { Sidebar } from "@/components/layout";
import { Fetch_to } from "@/utilities";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import routes from "@/routes/jwt.json";

export default function UserBalancePage() {
  const router = useRouter();
  const [data, setData] = useState({ email: "", network: "", username: "", wallet_address: "" });
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    const verify = async () => {
      const response = await Fetch_to("GET", routes.verify);
      if (response.success) {
        const user = response.data.message.data;
        setData({
          email: user.email,
          network: user.network,
          username: user.username,
          wallet_address: user.wallet_address,
        });
        setLoadingSession(false);
      } else {
        router.push("/auth/login");
      }
    };
    void verify();
  }, [router]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <Sidebar userEmail={data.email} userName={data.username} wallet_address={data.wallet_address} network={data.network} />
      <section className="mx-auto max-w-7xl pt-8 md:pl-72">
        {loadingSession ? (
          <div role="status" aria-label="Loading wallet session" className="mx-auto max-w-5xl space-y-6">
            <span className="sr-only">Loading your wallet session…</span>
            <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
              <div className="h-3 w-40 rounded bg-foreground/10" />
              <div className="mt-3 h-8 w-32 rounded bg-foreground/10" />
              <div className="mt-2 h-4 w-72 max-w-full rounded bg-foreground/[0.07]" />
            </div>
            <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-32 animate-pulse motion-reduce:animate-none rounded-xl border border-foreground/10 bg-foreground/[0.03]" />
              ))}
            </div>
          </div>
        ) : (
          <Balance email={data.email} network={data.network} />
        )}
      </section>
    </main>
  );
}
