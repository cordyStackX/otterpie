import Image from "next/image";
import Link from "next/link";

const sampleCategories = [
  { label: "Stock & supplies", share: "50%", color: "bg-primary" },
  { label: "Savings", share: "30%", color: "bg-secondary" },
  { label: "For the store", share: "20%", color: "bg-amber-400" },
];

function ArrowUpRight() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M5 15 15 5M6 5h9v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0 text-primary">
      <path d="m4 10.5 4 4L16 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="relative isolate overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(ellipse_at_65%_0%,rgba(var(--primary-rgba),0.17),transparent_58%)]" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Otterpie home" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <Image src="/logo.svg" alt="" width={44} height={44} priority className="h-11 w-11 rounded-xl bg-primary/10 p-1" />
          <span className="text-xl font-bold tracking-tight">otterpie<span className="text-primary">.</span></span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm font-medium text-foreground/65 md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-foreground">How it works</a>
          <a href="#made-for-stores" className="transition-colors hover:text-foreground">For your store</a>
          <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/auth/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:bg-foreground/5 hover:text-foreground sm:px-4">
            Sign in
          </Link>
          <Link href="/auth/signup" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-background shadow-sm shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4">
            Get started <ArrowUpRight />
          </Link>
        </div>
      </header>

      <section className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-16 lg:grid-cols-[1fr_0.95fr] lg:gap-16 lg:px-12 lg:pb-32 lg:pt-20">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3.5 py-1.5 text-xs font-semibold tracking-wide text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            A little more clarity for every store day
          </div>
          <h1 className="mt-6 text-[2.8rem] font-semibold leading-[1.05] tracking-[-0.055em] sm:text-6xl lg:text-[4.4rem]">
            One scan.
            <br />
            <span className="text-primary">Every fund</span> in its place.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-foreground/65 sm:text-lg sm:leading-8">
            A friendlier way to keep track of store payments. See what came in, plan how it is divided, and keep your goals close at hand.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-background shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              Set up your store <ArrowUpRight />
            </Link>
            <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-foreground/15 px-6 text-sm font-semibold transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              See how it works
            </a>
          </div>
          <p className="mt-5 text-xs leading-5 text-foreground/45">Choose Stellar or BOT Chain when you create your account.</p>
        </div>

        <div className="relative mx-auto w-full max-w-[34rem] lg:ml-auto">
          <div aria-hidden="true" className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-secondary/20 blur-3xl sm:-right-12 sm:h-52 sm:w-52" />
          <div aria-hidden="true" className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative rounded-[1.75rem] border border-foreground/10 bg-background/90 p-3 shadow-[0_32px_100px_-45px_rgba(var(--primary-rgba),0.55)] backdrop-blur sm:p-4">
            <div className="rounded-[1.25rem] border border-foreground/10 bg-foreground/[0.025] p-5 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-foreground/50">YOUR STORE OVERVIEW</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight">A clearer picture</p>
                </div>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Example</span>
              </div>

              <div className="mt-6 flex items-center gap-4 rounded-2xl border border-foreground/10 bg-background p-4 sm:p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <path d="M4 7.5h16v11H4zM7 7.5V5h10v2.5M4 11h16" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M8 14.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground/50">Incoming payment</p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">25.00 <span className="text-sm font-medium text-foreground/50">XLM</span></p>
                </div>
                <span className="hidden rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 sm:inline-flex">Received</span>
              </div>

              <div className="mt-5 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground/55">Your category plan</span>
                <span className="text-foreground/40">Example split</span>
              </div>
              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-foreground/5">
                <span className="w-1/2 bg-primary" />
                <span className="w-[30%] bg-secondary" />
                <span className="w-1/5 bg-amber-400" />
              </div>
              <ul className="mt-4 space-y-3">
                {sampleCategories.map((category) => (
                  <li key={category.label} className="flex items-center gap-2.5 text-sm">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${category.color}`} />
                    <span className="flex-1 text-foreground/65">{category.label}</span>
                    <span className="font-semibold tabular-nums">{category.share}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-primary/[0.07] px-3.5 py-3">
                <Image src="/icons/otters/otter-savings.svg" alt="" width={34} height={34} className="h-8 w-8" />
                <p className="text-xs leading-5 text-foreground/60"><span className="font-semibold text-foreground">Your plan, at a glance.</span> Track category shares as your wallet balance changes.</p>
              </div>
            </div>
          </div>
          <Image src="/icons/otters/otter-default.svg" alt="" width={104} height={104} className="absolute -bottom-9 -right-4 z-10 h-20 w-20 rotate-6 drop-shadow-lg sm:-bottom-10 sm:-right-7 sm:h-24 sm:w-24" />
        </div>
      </section>

      <section id="how-it-works" className="border-y border-foreground/8 bg-foreground/[0.025]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">A simpler daily rhythm</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Know what came in. Know what it means.</h2>
            <p className="mt-4 text-sm leading-7 text-foreground/60 sm:text-base">Otterpie gives your wallet activity a little more context, so your store goals are easier to keep in view.</p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { number: "01", title: "Set your shares", text: "Create categories for supplies, savings, rent, or whatever matters to your shop." },
              { number: "02", title: "Receive to your wallet", text: "Share your store QR code so customers can send funds to your selected network." },
              { number: "03", title: "See the breakdown", text: "Follow your balance, recent transactions, and the category plan in one dashboard." },
            ].map((step) => (
              <article key={step.number} className="rounded-2xl border border-foreground/10 bg-background p-6 sm:p-7">
                <span className="text-xs font-bold tracking-[0.16em] text-primary">{step.number}</span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-foreground/60">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="made-for-stores" className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-12">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-foreground/10 bg-primary/[0.06] p-7 sm:p-10">
          <div aria-hidden="true" className="absolute -right-8 -top-8 h-40 w-40 rounded-full border border-primary/15" />
          <div aria-hidden="true" className="absolute -right-1 top-0 h-28 w-28 rounded-full border border-primary/15" />
          <div className="relative max-w-sm">
            <span className="inline-flex rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary shadow-sm">Made for the everyday</span>
            <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight">Your store has a lot to keep moving.</h2>
            <p className="mt-4 text-sm leading-7 text-foreground/65">A small shop runs on a hundred little decisions. Otterpie helps make the money side easier to see, without another notebook to carry.</p>
            <Image src="/icons/otters/otter-supplier.svg" alt="" width={160} height={160} className="mt-5 h-32 w-32 object-contain" />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-primary">Small details, less mental math</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">A calmer view of your wallet.</h2>
          <ul className="mt-7 space-y-4">
            {[
              "Choose the categories and percentages that fit your business.",
              "Set goals and watch your available category amounts change with your balance.",
              "Review recent activity and find payments across supported networks.",
              "Keep your store name and payment QR together in one place.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-6 text-foreground/65">
                <CheckMark /> <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link href="/auth/signup" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            Make your store account <ArrowUpRight />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-primary px-6 py-10 text-background sm:px-10 sm:py-12 lg:px-14">
          <div aria-hidden="true" className="absolute -right-8 -top-24 h-64 w-64 rounded-full border border-white/15 sm:-right-2 sm:h-80 sm:w-80" />
          <div aria-hidden="true" className="absolute -right-14 -top-16 h-56 w-56 rounded-full border border-white/15 sm:right-10 sm:h-64 sm:w-64" />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <p className="text-sm font-semibold text-white/75">A good place to start</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Give your next store day a clearer start.</h2>
              <p className="mt-3 text-sm leading-6 text-white/75">Set up your wallet and build a category plan that feels like yours.</p>
            </div>
            <Link href="/auth/signup" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-background px-5 text-sm font-semibold text-primary shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary">
              Create your account <ArrowUpRight />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-foreground/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg bg-primary/10 p-1" />
            <span className="text-sm font-bold tracking-tight">otterpie<span className="text-primary">.</span></span>
          </Link>
          <p className="text-xs text-foreground/45">A clearer way to keep your store funds in view.</p>
          <nav aria-label="Legal" className="flex gap-5 text-xs font-medium text-foreground/55">
            <Link href="/terms" className="hover:text-primary">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-primary">Privacy Policy</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
