import Image from "next/image";
import Link from "next/link";
import pieTokenConfig from "@/config/json_conf/token_address.json";
import PieExchangeRate from "@/components/landpage/PieExchangeRate";

const pieTokens = pieTokenConfig.tokens;

const applyAddressTemplate = (template: string, address: string) =>
  template.replace("{address}", address);

const sampleCategories = [
  { label: "Trading funds", share: "50%", color: "bg-primary" },
  { label: "Savings", share: "30%", color: "bg-secondary" },
  { label: "Rent", share: "20%", color: "bg-amber-400" },
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

      <header className="fixed left-1/2 top-3 z-50 mx-auto flex w-[calc(100%-2.5rem)] max-w-7xl -translate-x-1/2 items-center justify-between rounded-full border border-foreground/10 bg-background/85 px-4 py-2.5 shadow-lg shadow-black/10 backdrop-blur-xl transition-all duration-200 hover:border-primary/25 hover:bg-white hover:shadow-xl hover:shadow-black/15 focus-within:border-primary/25 focus-within:bg-white dark:hover:bg-[#0a0a0a] dark:focus-within:bg-[#0a0a0a] sm:w-[calc(100%-4rem)] sm:px-8 lg:w-[calc(100%-6rem)] lg:px-12">
        <Link href="/" aria-label="Otterpie home" className="group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <Image src="/logo.svg" alt="" width={44} height={44} priority className="h-11 w-11 rounded-xl bg-primary/10 p-1 transition duration-200 group-hover:scale-105 group-hover:bg-primary/20" />
          <span className="text-xl font-bold tracking-tight transition-colors group-hover:text-primary">Otterpie<span className="text-primary">.</span></span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 text-sm font-medium text-foreground/65 md:flex">
          <a href="#stellar-paiflow" className="rounded-lg px-3 py-2 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Paiflow</a>
          <a href="#how-it-works" className="rounded-lg px-3 py-2 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">How it works</a>
          <a href="#flexible-plans" className="rounded-lg px-3 py-2 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Your plans</a>
          <a href="#roadmap" className="rounded-lg px-3 py-2 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Roadmap</a>
          <Link href="/terms" className="rounded-lg px-3 py-2 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Terms</Link>
          <Link href="/privacy" className="rounded-lg px-3 py-2 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Privacy</Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/auth/login" className="rounded-full px-4 py-2.5 text-sm font-semibold text-foreground/75 transition-all hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            Sign in
          </Link>
          <Link href="/auth/signup" className="group inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-background shadow-sm shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0">
            Get started <span className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"><ArrowUpRight /></span>
          </Link>
        </div>
      </header>

      <div aria-hidden="true" className="h-20" />

      <section className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-16 lg:grid-cols-[1fr_0.95fr] lg:gap-16 lg:px-12 lg:pb-32 lg:pt-20">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3.5 py-1.5 text-xs font-semibold tracking-wide text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            A little more clarity for every money goal
          </div>
          <h1 className="mt-6 text-[2.8rem] font-semibold leading-[1.05] tracking-[-0.055em] sm:text-6xl lg:text-[4.4rem]">
            One wallet.
            <br />
            <span className="text-primary">Every plan</span> in view.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-foreground/65 sm:text-lg sm:leading-8">
            See what came in, follow your balance, and organize funds around the things that matter to you — from trading and savings to rent and everyday spending.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-background shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              Set up your wallet <ArrowUpRight />
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
                  <p className="text-xs font-medium text-foreground/50">YOUR WALLET OVERVIEW</p>
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

      <section aria-label="Otterpie token networks and exchange rates" className="border-y border-foreground/8 bg-foreground/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-8 sm:px-8 lg:px-12">
          {pieTokens.map((token) => (
            <article key={token.id} aria-labelledby={`pie-token-title-${token.id}`} className="flex flex-col gap-6 rounded-2xl border border-foreground/10 bg-background/50 p-5 md:flex-row md:items-center md:justify-between sm:p-6">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-400/20 bg-amber-400/10 p-1.5">
                    <Image src={token.logoPath} alt={`${token.name} token brand`} width={48} height={48} className="h-full w-full object-contain" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{token.name} token · {token.chainName}</p>
                    <h2 id={`pie-token-title-${token.id}`} className="mt-1 text-xl font-semibold tracking-tight">{token.name} <span className="text-foreground/55">({token.symbol})</span></h2>
                    <p className="mt-1 text-xs text-foreground/50">Token contract</p>
                    <a
                      href={applyAddressTemplate(token.explorerTokenUrlTemplate, token.token_address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block break-all font-mono text-xs text-foreground/70 underline decoration-foreground/20 underline-offset-2 transition-colors hover:text-primary hover:decoration-primary"
                    >
                      {token.token_address}
                    </a>
                  </div>
                </div>
                <PieExchangeRate token={token} />
              </div>
              <a
                href={applyAddressTemplate(token.poolUrlTemplate, token.token_address)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.08] px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {token.poolButtonLabel} <ArrowUpRight />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section id="stellar-paiflow" aria-labelledby="stellar-paiflow-title" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-primary">Stellar Testnet · Paiflow</p>
          <h2 id="stellar-paiflow-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">One USDC payment. A configured split.</h2>
          <p className="mt-4 text-sm leading-6 text-foreground/60 sm:text-base">
            Otterpie prepares and signs the deposit with your Stellar wallet. Paiflow runs the recipients and split rules already set in your flow.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-4 sm:p-6">
          <svg role="img" aria-labelledby="paiflow-diagram-title paiflow-diagram-description" viewBox="0 0 1080 220" className="mx-auto block h-auto min-w-[820px] w-full max-w-6xl">
            <title id="paiflow-diagram-title">Otterpie and Paiflow Stellar Testnet payment flow</title>
            <desc id="paiflow-diagram-description">You confirm a USDC payment in Otterpie. Otterpie prepares and signs it with your Stellar wallet. Stellar Testnet records the deposit. Paiflow distributes it to recipients configured in the flow.</desc>
            <defs>
              <marker id="paiflow-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0 0 8 4 0 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </marker>
            </defs>
            <g fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
              <path d="M238 110h30" markerEnd="url(#paiflow-arrow)" />
              <path d="M508 110h30" markerEnd="url(#paiflow-arrow)" />
              <path d="M778 110h30" markerEnd="url(#paiflow-arrow)" />
            </g>
            <g>
              <rect x="8" y="42" width="230" height="136" rx="22" className="fill-background stroke-foreground/15" />
              <circle cx="40" cy="77" r="16" className="fill-primary/15" />
              <text x="40" y="82" textAnchor="middle" className="fill-primary text-[13px] font-bold">1</text>
              <text x="30" y="119" className="fill-foreground text-[16px] font-semibold">You confirm</text>
              <text x="30" y="145" className="fill-foreground/60 text-[13px]">USDC amount + saved flow</text>

              <rect x="278" y="42" width="230" height="136" rx="22" className="fill-background stroke-foreground/15" />
              <circle cx="310" cy="77" r="16" className="fill-primary/15" />
              <text x="310" y="82" textAnchor="middle" className="fill-primary text-[13px] font-bold">2</text>
              <text x="300" y="119" className="fill-foreground text-[16px] font-semibold">Otterpie signs</text>
              <text x="300" y="145" className="fill-foreground/60 text-[13px]">Your Stellar wallet · XLM fee</text>

              <rect x="548" y="42" width="230" height="136" rx="22" className="fill-background stroke-foreground/15" />
              <circle cx="580" cy="77" r="16" className="fill-primary/15" />
              <text x="580" y="82" textAnchor="middle" className="fill-primary text-[13px] font-bold">3</text>
              <text x="570" y="119" className="fill-foreground text-[16px] font-semibold">Stellar Testnet</text>
              <text x="570" y="145" className="fill-foreground/60 text-[13px]">USDC deposit is recorded</text>

              <rect x="818" y="42" width="254" height="136" rx="22" className="fill-background stroke-foreground/15" />
              <circle cx="850" cy="77" r="16" className="fill-primary/15" />
              <text x="850" y="82" textAnchor="middle" className="fill-primary text-[13px] font-bold">4</text>
              <text x="840" y="119" className="fill-foreground text-[16px] font-semibold">Paiflow distributes</text>
              <text x="840" y="145" className="fill-foreground/60 text-[13px]">To recipients in the flow</text>
            </g>
          </svg>
        </div>
        <p className="mx-auto mt-4 max-w-4xl text-center text-xs leading-5 text-foreground/45">
          Testnet only. XLM covers Stellar network fees; USDC is the deposited asset. Otterpie cannot change a deployment’s recipients or split rules. Testnet assets have no intended real-world value.
        </p>
      </section>

      <section id="how-it-works" className="border-y border-foreground/8 bg-foreground/[0.025]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">A simpler daily rhythm</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Know what came in. Know what it means.</h2>
            <p className="mt-4 text-sm leading-7 text-foreground/60 sm:text-base">Otterpie gives your wallet activity more context, helping you understand what came in, what went out, and how your funds are organized.</p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { number: "01", title: "Choose your categories", text: "Create categories for trading, savings, rent, bills, or any goal you want to track." },
              { number: "02", title: "Receive to your wallet", text: "Use your payment QR to receive funds on your selected network." },
              { number: "03", title: "Understand your activity", text: "Follow your balance, review transactions, and see how funds are organized in one dashboard." },
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

      <section id="flexible-plans" className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-12">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-foreground/10 bg-primary/[0.06] p-7 sm:p-10">
          <div aria-hidden="true" className="absolute -right-8 -top-8 h-40 w-40 rounded-full border border-primary/15" />
          <div aria-hidden="true" className="absolute -right-1 top-0 h-28 w-28 rounded-full border border-primary/15" />
          <div className="relative max-w-sm">
            <span className="inline-flex rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary shadow-sm">Plans for each asset</span>
            <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight">Give every balance a plan.</h2>
            <p className="mt-4 text-sm leading-7 text-foreground/65">Make categories for goals like savings, rent, or trading. Set a share and an optional target, then see how the plan compares with your current balance.</p>
            <p className="mt-4 text-xs leading-5 text-foreground/45">Categories are a planning view. Your funds stay in the wallet and are not moved or locked.</p>
            <Image src="/icons/otters/otter-supplier.svg" alt="" width={160} height={160} className="mt-5 h-32 w-32 object-contain" />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-primary">Plan by asset and network</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Your categories follow the balance you’re viewing.</h2>
          <ul className="mt-7 space-y-4">
            {[
              "Set a percentage and optional target for each category; the dashboard estimates its share from your current balance.",
              "Keep plans separate for assets such as BOT, PIE, Stellar Testnet USDC, and Stellar Mainnet USDT0.",
              "Switch Stellar between Mainnet and Testnet to view the matching balances, activity, and category plans.",
              "Use a Stellar Testnet USDC category as a budgeting guide when funding a saved Paiflow split.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm leading-6 text-foreground/65">
                <CheckMark /> <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link href="/auth/signup" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            Create your wallet <ArrowUpRight />
          </Link>
        </div>
      </section>

      <section id="roadmap" aria-labelledby="roadmap-title" className="border-y border-foreground/8 bg-foreground/[0.025]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-primary">What’s here and what’s next</p>
            <h2 id="roadmap-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Built so far. Still building.</h2>
            <p className="mt-4 text-sm leading-6 text-foreground/60 sm:text-base">Explore the wallet tools already available, then see what we’re developing for BOT Chain and Stellar.</p>
          </div>

          <div className="mt-10">
            <div className="mb-4 flex items-center gap-3">
              <h3 className="text-lg font-semibold">Available now</h3>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Ready to use</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { title: "Wallet dashboard", description: "View balances, recent activity, and transaction details across supported networks." },
                { title: "Category plans", description: "Set percentage shares and goals for supported assets. Funds stay in your wallet." },
                { title: "Transfers and Friends", description: "Send supported assets to compatible BOT Chain or Stellar wallets, including saved Otterpie friends." },
                { title: "Swaps and bridges", description: "Use supported BOT Chain swaps and USDT routes, plus configured Stellar Mainnet USDT0 tools." },
                { title: "Stellar Testnet", description: "Switch your Stellar wallet to Testnet, request test XLM, and set up a test USDC trustline." },
                { title: "Paiflow on Testnet", description: "Save and fund up to five eligible USDC split deployments using your Stellar Testnet wallet." },
              ].map((feature) => (
                <article key={feature.title} className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
                  <h4 className="font-semibold tracking-tight">{feature.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-foreground/60">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <h3 className="mb-4 text-lg font-semibold">In development</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Trade", network: "BOT Chain + Stellar", description: "Trading tools for assets on each supported network." },
              { title: "AI Trade", network: "BOT Chain + Stellar", description: "AI-assisted trading tools with clear controls and transaction review." },
              { title: "NFT Markets", network: "PIE Markets + XLM", description: "Explore NFT market features for the BOT Chain and Stellar communities." },
              { title: "P2P", network: "BOT Chain + Stellar", description: "Peer-to-peer offers with terms and settlement details to review." },
            ].map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-6">
                <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">In development</span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-1 text-xs font-medium text-foreground/45">{feature.network}</p>
                <p className="mt-3 text-sm leading-6 text-foreground/60">{feature.description}</p>
              </article>
            ))}
            </div>
          </div>
          <p className="mt-5 text-center text-xs text-foreground/40">Plans may change as we build and test each feature.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-primary px-6 py-10 text-background sm:px-10 sm:py-12 lg:px-14">
          <div aria-hidden="true" className="absolute -right-8 -top-24 h-64 w-64 rounded-full border border-white/15 sm:-right-2 sm:h-80 sm:w-80" />
          <div aria-hidden="true" className="absolute -right-14 -top-16 h-56 w-56 rounded-full border border-white/15 sm:right-10 sm:h-64 sm:w-64" />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <p className="text-sm font-semibold text-white/75">A good place to start</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Give your money plans a clearer start.</h2>
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
          <p className="text-xs text-foreground/45">A clearer way to keep your balances and transactions in view.</p>
          <nav aria-label="Legal" className="flex gap-5 text-xs font-medium text-foreground/55">
            <Link href="/terms" className="hover:text-primary">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-primary">Privacy Policy</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
