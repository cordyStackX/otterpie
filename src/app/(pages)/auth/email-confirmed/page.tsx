import Link from "next/link";

export const metadata = {
  title: "Email confirmation | Otterpie",
  referrer: "no-referrer" as const,
};

type EmailConfirmedPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function EmailConfirmedPage({ searchParams }: EmailConfirmedPageProps) {
  const { status } = await searchParams;
  const isComplete = status === "success" || status === "already-confirmed";
  const heading = status === "success"
    ? "Email confirmed"
    : status === "already-confirmed"
      ? "Email already confirmed"
      : status === "try-again"
        ? "Could not confirm your email"
        : "Confirmation link expired";
  const message = status === "success"
    ? "Your account is ready. You can sign in now."
    : status === "already-confirmed"
      ? "Your email is already confirmed. You can sign in to Otterpie."
      : status === "try-again"
        ? "Something went wrong while confirming your email. Please try the link again shortly."
        : "This link is invalid or expired. Please sign up again or contact support for help.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-secondary/25 via-background to-background px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-foreground/10 bg-background p-7 text-center shadow-sm">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${isComplete ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"}`}>
          {isComplete ? (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-7 w-7">
              <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-7 w-7">
              <path d="M12 8v4m0 4h.01M4.8 19h14.4c1.2 0 1.9-1.3 1.3-2.3L13.3 4.2c-.6-1-2-1-2.6 0L3.5 16.7c-.6 1 .1 2.3 1.3 2.3Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-foreground">{heading}</h1>
        <p className="mt-2 text-sm leading-6 text-foreground/60">{message}</p>
        <Link href={isComplete ? "/auth/login" : "/auth/signup"} className="mt-6 block rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90">
          {isComplete ? "Sign in" : "Back to sign up"}
        </Link>
      </section>
    </main>
  );
}
