import { Sidebar } from "@/components/layout";

export default function TransactionsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <Sidebar />
      <section className="mx-auto max-w-6xl pt-8 md:pl-72">
        <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
        <p className="mt-2 text-muted-foreground">Review your recent transactions.</p>
      </section>
    </main>
  );
}
