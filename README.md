# Otterpie

**A wallet that shows where the money goes.**
An adaptable wallet to track balances, understand transactions, and organize funds around your goals. Available on Stellar and BOT Chain mainnets.

![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)
![Built with Next.js](https://img.shields.io/badge/Next.js-black)
![Stellar Mainnet](https://img.shields.io/badge/Stellar-mainnet-7D00FF)
![BOT Chain Mainnet](https://img.shields.io/badge/BOT%20Chain-mainnet-42c7df)

---

## The problem

Money often has different purposes: saving for a goal, setting aside rent, managing trading funds, or covering everyday spending. When everything sits together in one wallet, it can be hard to tell how much is available for each purpose and where the money went. People end up reviewing transactions and tracking those amounts by hand.

## What Otterpie does

Otterpie gives each user a wallet on their selected network: Stellar or BOT Chain. Users can check their balance, review incoming and outgoing transactions, and organize funds across **categories they define themselves** — such as trading, savings, rent, bills, or everyday spending. Each category shows its percentage of the current wallet balance, with any unassigned share kept visible. These categories are a tracking view; funds remain in the same wallet.

The goal is a clearer picture of your money: what came in, what went out, how much is available, and how funds are set aside for different plans.

Built for **Stellar Mainnet** and **BOT Chain Mainnet**. Each user selects a network during signup and gets a wallet for that network. Stellar wallets use the Stellar SDK; BOT Chain wallets use EVM-compatible tooling. Wallet activity is tracked against the user's custom categories.

## Supported networks

| Network | Environment | Wallet support |
|---|---|---|
| Stellar | Mainnet (`horizon.stellar.org`) | Stellar wallet generated on signup |
| BOT Chain | Mainnet (Chain ID `677`) | EVM-compatible wallet generated on signup |

## Why not just use GCash?

Otterpie helps users understand wallet activity, not just receive payments. It lets them review transactions and organize balances into **their own categories** — trading, savings, rent, bills, or whatever fits their plans — so they can see how money is moving and what they have set aside.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS v4 |
| Backend | Next.js API routes |
| Database | Supabase (self-hosted via Docker) — Postgres under the hood |
| Auth | Custom email/password flow, bcrypt-hashed, Supabase `auth` schema |
| Wallets and chain access | Stellar SDK (`@stellar/stellar-sdk`), ethers v6, Stellar Horizon, BOT Chain RPC and explorer |
| Package manager | pnpm |

## Project structure

```
src/
├── app/                         # Next.js pages, layouts, global styles, and route handlers
│   ├── (pages)/                 # Grouped website pages; this folder is omitted from page URLs
│   │   ├── auth/                # Signup, login, password recovery, and email confirmation pages
│   │   ├── privacy/             # Privacy policy page
│   │   ├── terms/               # Terms of service page
│   │   └── user/                # Dashboard, categories, settings, and transaction pages
│   ├── page.tsx                 # Public landing page
│   └── services/                # Server API endpoints
│       ├── jwt/                 # JWT verification and sign-out endpoints
│       ├── supabase/            # Auth, user, category, wallet balance, and history endpoints
│       └── withdraw/            # Stellar and BOT Chain withdrawal endpoints
├── components/                  # React UI grouped by feature
│   ├── auth/                    # Signup, login, reset, and forgot-password forms
│   ├── landpage/                # Landing page sections
│   ├── layout/                  # Shared navigation and sidebar
│   ├── legal/                   # Shared legal document layout
│   ├── ui/                      # Reusable buttons, fields, logos, and other UI elements
│   └── user/                    # Dashboard, categories, settings, and transactions UI
├── config/                      # Theme variables and site metadata
├── firewall/                    # Request security, JWT helpers, rate limits, and encryption
├── lib/                         # Server-side clients, wallet creation, and email helpers
├── modules/                     # Shared module exports and feature integrations
├── routes/                      # JSON route maps used by the frontend
├── types/                       # Shared TypeScript declarations
└── utilities/                   # Fetch helpers, analytics, SEO, and metadata utilities
```

## Getting started

### Prerequisites
- Node.js
- pnpm
- Docker (for the self-hosted Supabase project in `supabase-project`)

### 1. Clone the repository
```bash
git clone https://github.com/cordyStackX/otterpie.git
cd otterpie
```

### 2. Generate local security keys

Run the setup script from the project root:

```bash
bash setup.sh --keys-only
```

It creates or updates `.env` with strong random values for `API_KEY`, `JWT_SECRET`, `WALLET_BANK_KEY`, `WALLET_BANK_KEY_1`, and `WALLET_BANK_KEY_2`. Existing non-empty values are kept, and generated secrets are not printed to the terminal.

Then edit `.env` and add your service configuration:

```dotenv
# Supabase (server)
SUPABASE_URL=http://localhost:8000
SUPABASE_SECRET_KEY=your_secret_key

# Supabase (client)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key

# App URLs (use your production URL in deployment settings)
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email confirmation and password recovery (Gmail app password)
NEXT_PUBLIC_EMAIL=your_email@example.com
APP_PASSWORD=your_gmail_app_password

# Optional network endpoint overrides; defaults point to the public mainnets
# STELLAR_HORIZON_URL=https://horizon.stellar.org
# BOT_CHAIN_RPC_URL=https://rpc.botchain.ai
# BOT_CHAIN_EXPLORER_API_URL=https://scan.botchain.ai/api
```

`.env` is ignored by Git. For production, add the required values through your hosting provider's encrypted environment settings. Keep the three `WALLET_BANK_KEY*` values backed up and unchanged after wallet secrets are saved; changing them prevents the app from decrypting those saved secrets. Use the same wallet encryption keys in production that were used to create the stored wallet records.

### 3. Install, check, build, and start

After `.env` has your Supabase and email settings, run:

```bash
bash setup.sh
```

The full setup installs packages with `pnpm install`, starts the existing Supabase Docker stack with `sh supabase-project/run.sh start`, runs `pnpm lint` and `pnpm build`, then starts the production server with `pnpm start`. The Supabase stack reads its own configuration from `supabase-project/.env`; the root `.env` contains Otterpie's application settings. Configure both files for your environment. `pnpm start` stays in the foreground; stop it with `Ctrl+C`.

`supabase-project/setup.sh` is the Supabase project's bootstrap script for preparing a new deployment. For this already-configured project, use `supabase-project/run.sh start` to start its containers; the root `setup.sh` calls that command for you.

To run the development server with hot reload instead:

```bash
pnpm dev
```

---

## Design

- **Colors:** ocean blue primary (`#0077b6`), light aqua secondary (`#90e0ef`) — defined once in `config/css/var.css` and wired into Tailwind v4 via `@theme inline`.
- **Auth screens:** a clean, trust-forward card — the kind of look a financial app needs before it earns the right to be playful.
- **Mascot:** an otter, dividing every payment like slices of a pie.

## Roadmap

- [x] Auth (login, signup, forgot password)
- [x] Stellar wallet generation on signup
- [x] Encrypted wallet storage
- [x] QR payment / scan flow
- [x] Pie-split confirmation screen
- [x] Owner dashboard (tabs, split breakdown)

## License

This project is released under the **Apache License 2.0**. See [LICENSE](./LICENSE) for the full text.

## Contributors

- [cordyStackX](https://github.com/cordyStackX) — Marc Giestin Louis Cordova
