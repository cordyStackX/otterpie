import Link from "next/link";
import Image from "next/image";

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type LegalDocumentProps = {
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
  otherPage: { href: string; label: string };
};

export default function LegalDocument({
  title,
  summary,
  updated,
  sections,
  otherPage,
}: LegalDocumentProps) {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <nav aria-label="Main navigation" className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
            <Image src="/logo.svg" alt="" width={40} height={40} className="h-10 w-10 rounded-xl bg-primary/10 p-1" />
            <span className="text-lg font-semibold tracking-tight">Otterpie</span>
          </Link>
          <Link href={otherPage.href} className="text-sm font-medium text-primary hover:underline">
            {otherPage.label}
          </Link>
        </nav>

        <header className="mt-12 border-b border-foreground/10 pb-8 sm:mt-16">
          <p className="text-sm font-medium text-primary">Otterpie policies</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-foreground/65">{summary}</p>
          <p className="mt-4 text-xs text-foreground/45">Last updated: {updated}</p>
        </header>

        <div className="mt-8 space-y-4">
          {sections.map((section, index) => (
            <section key={section.title} className="rounded-2xl border border-foreground/10 bg-foreground/[0.015] p-5 sm:p-7">
              <h2 className="text-lg font-semibold tracking-tight">
                <span className="mr-2 text-primary/70">{String(index + 1).padStart(2, "0")}</span>
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-foreground/65">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && (
                  <ul className="list-disc space-y-1 pl-5 marker:text-primary/70">
                    {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-8 flex flex-col gap-3 border-t border-foreground/10 pt-6 text-sm text-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="font-medium text-primary hover:underline">Back to Otterpie</Link>
          <p>
            Questions? Contact the project maintainer through the{" "}
            <a href="https://github.com/cordyStackX/otterpie" className="font-medium text-primary hover:underline" target="_blank" rel="noreferrer">
              Otterpie project page
            </a>.
          </p>
        </footer>
      </div>
    </main>
  );
}
