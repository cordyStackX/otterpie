import { StellarFeature } from "@/components/user";

export default function StellarTradePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <section className="mx-auto max-w-7xl pt-8 md:pl-72">
        <StellarFeature
          title="Trade"
          description="Stellar trading tools are being prepared for Otterpie."
          details={["Review Stellar asset prices and available swap routes.", "Swap supported Stellar assets from your Otterpie wallet.", "Review the quote and transaction before confirming."]}
        />
      </section>
    </main>
  );
}
