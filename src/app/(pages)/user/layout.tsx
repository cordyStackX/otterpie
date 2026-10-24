"use client";

import { Sidebar } from "@/components/layout";
import { Fetch_to } from "@/utilities";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import routes from "@/routes/jwt.json";

type UserSession = { email: string; network: string; username: string; wallet_address: string };

const emptySession: UserSession = { email: "", network: "", username: "", wallet_address: "" };

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<UserSession>(emptySession);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const verifySession = async () => {
      const response = await Fetch_to("GET", routes.verify);
      if (!response.success) {
        router.replace("/auth/login");
        return;
      }
      const user = response.data.message.data;
      if (!cancelled) {
        setSession({
          email: user.email,
          network: user.network,
          username: user.username,
          wallet_address: user.wallet_address,
        });
        setSessionLoading(false);
      }
    };
    void verifySession();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    const updateUsername = (event: Event) => {
      const username = (event as CustomEvent<{ username?: string }>).detail?.username;
      if (typeof username === "string") setSession((current) => ({ ...current, username }));
    };
    window.addEventListener("otterpie:username-updated", updateUsername);
    return () => window.removeEventListener("otterpie:username-updated", updateUsername);
  }, []);

  return (
    <>
      <Sidebar
        userEmail={session.email}
        userName={session.username}
        wallet_address={session.wallet_address}
        network={session.network}
        sessionLoading={sessionLoading}
      />
      {children}
    </>
  );
}
