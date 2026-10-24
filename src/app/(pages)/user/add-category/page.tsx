"use client";
import { Categories } from "@/components/user";
import { Fetch_to } from "@/utilities";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import routes from "@/routes/jwt.json";

export default function AddCategoryPage() {
  const router = useRouter();
  const [data, setData] = useState({
    email: "", network: "", username: "", wallet_address: ""
  });

  useEffect(() => {
    const verify = async() => {

      const response = await Fetch_to("GET", routes.verify);

      if (response.success) {
        const data = response.data.message.data;
        setData(prev => ({ ...prev,
          email: data.email,
          network: data.network,
          username: data.username,
          wallet_address: data.wallet_address
        }));
      } else {
        router.push("/auth/login");
      }

    };
    verify();
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <section className="mx-auto max-w-7xl pt-8 md:pl-72">
        <Categories email={data.email} network={data.network} />
      </section>
    </main>
  );
}
