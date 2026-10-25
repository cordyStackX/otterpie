type StellarFeatureProps = {
  title: string;
  description: string;
  details: string[];
};

export default function StellarFeature({ title, description, details }: StellarFeatureProps) {
  return (
    <div className="space-y-6 text-foreground">
      <header>
        <p className="text-sm font-medium text-primary">Stellar · Features</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-foreground/55">{description}</p>
      </header>
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-foreground/10 bg-background p-6 sm:p-10">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
              <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48 8.48 2.12 2.12m0-12.72-2.12 2.12m-8.48 8.48-2.12 2.12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Under development</p>
          <h2 className="mt-2 text-xl font-semibold sm:text-2xl">{title} is on the way</h2>
          <p className="mt-3 text-sm leading-6 text-foreground/55">{description}</p>
          <div className="mt-6 w-full rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 text-left">
            <p className="text-sm font-medium">Planned for this feature</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-foreground/55">
              {details.map((detail) => <li key={detail}>• {detail}</li>)}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
