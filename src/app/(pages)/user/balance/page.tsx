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
        <Balance email={data.email} network={data.network} />
      </section>
    </main>
  );
}
