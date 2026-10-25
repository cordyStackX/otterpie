import { StellarFeature } from "@/components/user";

export default function StellarNftMarketsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <section className="mx-auto max-w-7xl pt-8 md:pl-72">
        <StellarFeature
          title="XLM NFT Market"
          description="Explore Stellar NFT collections and marketplaces from Otterpie."
          details={["Browse collections and listings on Stellar.", "Review item details and prices before buying or selling.", "Manage Stellar NFT activity from your Otterpie wallet."]}
        />
      </section>
    </main>
  );
}
