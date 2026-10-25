"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Paiflow } from "@/components/user";
import { Fetch_to } from "@/utilities";
import routes from "@/routes/jwt.json";

export default function UserPaiflowPage() {
  const router = useRouter();
  const [account, setAccount] = useState({ network: "", email: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      const response = await Fetch_to("GET", routes.verify);
      if (!response.success) {
        router.push("/auth/login");
        return;
      }
      if (!cancelled) {
        setAccount({
          network: response.data.message.data.network,
          email: response.data.message.data.email,
        });
        setLoading(false);
      }
    };
    void verify();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <section className="mx-auto max-w-7xl pt-8 md:pl-72">
        {loading ? (
          <div role="status" aria-label="Loading Paiflow" className="space-y-4">
            <div className="h-8 w-40 animate-pulse rounded bg-foreground/10" />
            <div className="h-80 animate-pulse rounded-2xl border border-foreground/10 bg-foreground/[0.03]" />
          </div>
        ) : <Paiflow network={account.network} email={account.email} />}
      </section>
    </main>
  );
}
