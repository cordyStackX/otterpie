import type { Metadata } from "next";
import LandingPage from "@/components/landpage";

export const metadata: Metadata = {
  title: "Otterpie — One scan, every fund in its place",
  description:
    "A clearer way for small stores to track wallet payments, plan category shares, and keep everyday money organized.",
};

export default function Home() {
  return <LandingPage />;
}
