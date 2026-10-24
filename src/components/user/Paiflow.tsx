"use client";


export default function Paiflow({ network }: { network: string }) {
  const isTestnet = network === "stellar_testnet";

  return (
    <div className="space-y-6 text-foreground">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Features</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Paiflow</h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/55">
            Shared payments for Otterpie friends, powered by Stellar.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {isTestnet ? "Stellar Testnet" : "Stellar Mainnet"}
        </span>
      </header>

      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-foreground/10 bg-background p-6 sm:p-10">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-7 w-7">
              <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48 8.48 2.12 2.12m0-12.72-2.12 2.12m-8.48 8.48-2.12 2.12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Under development</p>
          <h2 className="mt-2 text-xl font-semibold sm:text-2xl">Paiflow splits are under development</h2>
          <p className="mt-3 text-sm leading-6 text-foreground/55">
            We’re building an Otterpie-managed way to split a payment among friends using their Otterpie accounts and Stellar wallets.
          </p>
          <div className="mt-6 w-full rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 text-left">
            <p className="text-sm font-medium">What we’re working on</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-foreground/55">
              <li>Choose a category for a shared payment.</li>
              <li>Add Otterpie friends and set each person’s share.</li>
              <li>Review the split before sending on Stellar Testnet.</li>
            </ul>
          </div>
          {!isTestnet && (
            <p className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-left text-xs leading-5 text-amber-100/75">
              The first version is being prepared for Stellar Testnet. Mainnet payments will not be available in this feature yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
