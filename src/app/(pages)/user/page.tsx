"use client";
import { Dashboard } from "@/components/user";
import { Sidebar } from "@/components/layout";
import { Fetch_to } from "@/utilities";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import routes from "@/routes/jwt.json";

export default function UserDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState({
    email: "", network: "", username: ""
  });

  useEffect(() => {
    const verify = async() => {

      const response = await Fetch_to("GET", routes.verify);

      if (response.success) {
        const data = response.data.message.data;
        setData(prev => ({ ...prev, 
          email: data.email,
          network: data.network,
          username: data.username
        }));
      } else {
        router.push("/auth/login");
      }

    };
    verify();
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <Sidebar userEmail={data.email} userName={data.username} />
      <Dashboard email={data.email} network={data.network} />
    </main>
  );
}