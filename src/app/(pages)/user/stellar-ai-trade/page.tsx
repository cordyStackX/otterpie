import { StellarFeature } from "@/components/user";

export default function StellarAITradePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <section className="mx-auto max-w-7xl pt-8 md:pl-72">
        <StellarFeature
          title="AI Trade"
          description="AI-assisted trading for Stellar is planned for this page."
          details={["Configure a strategy and its risk limits.", "Review proposed trades before they run.", "Track strategy activity and pause it at any time."]}
        />
      </section>
    </main>
  );
}
