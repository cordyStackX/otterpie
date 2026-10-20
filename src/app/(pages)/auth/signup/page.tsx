"use client";
import { SignupForm } from "@/components/auth"; 
import { Fetch_to } from "@/utilities";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import routes from "@/routes/jwt.json";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    const verify = async() => {

      const response = await Fetch_to("GET", routes.verify);

      if (response.success) {
       router.push("/user"); 
      }
    };
    verify();
  }, []);
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-secondary/25 via-background to-background">
      <SignupForm />
    </main>
  );
}
