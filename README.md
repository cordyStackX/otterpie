# Otterpie

**One scan, sliced three ways.**
Automatic payment splitting for sari-sari stores, built on Stellar.

![License: CC0-1.0](https://img.shields.io/badge/license-CC0--1.0-blue)
![Built with Next.js](https://img.shields.io/badge/Next.js-black)
![Stellar](https://img.shields.io/badge/Stellar-testnet-7D00FF)

---

## The problem

Sari-sari store owners juggle supplier payments, daily income, and savings by hand — usually in cash, usually from memory. There's no easy way to split a single payment between what's owed to a supplier, what the store keeps, and what goes into savings.

## What Otterpie does

A customer scans one QR code to pay. That single payment lands in the store's Stellar wallet, then is automatically divided across **categories the owner defines themselves** — supplier share, rent, savings, personal income, anything — each with its own percentage.

No manual counting, no separate ledgers, no mental math at the register. One payment in, a clear visual breakdown out.

Built directly on the **Stellar network** using the Stellar SDK — each store gets its own Stellar wallet, generated and funded automatically on signup. Every payment is tracked and split against the owner's custom categories.

## Why not just use GCash?

GCash moves money from one person to one place, full stop. Otterpie takes that same payment and automatically divides it across **categories the store owner defines themselves** — supplier, rent, savings, personal, whatever fits their business — with a live visual breakdown of where every peso went. It's not a replacement for a wallet app; it's the budgeting layer GCash doesn't have.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS v4 |
| Backend | Next.js API routes |
| Database | Supabase (self-hosted via Docker) — Postgres under the hood |
| Auth | Custom email/password flow, bcrypt-hashed, Supabase `auth` schema |
| Payments | Stellar SDK (`@stellar/stellar-sdk`), Paiflow (`on_receive` + `split`) |
| Package manager | pnpm |

## Project structure

```
src
├── app
│   ├── globals.css
│   ├── layout.tsx
│   ├── (pages)        # routes: login, signup, forgot-password, ...
│   └── services        # API route handlers
├── components
│   ├── ui              # reusable atoms: Button, TextField, Logo, Checkbox, ReceiptCard, AuthCard
│   ├── login
│   ├── signup
│   └── forgot-password
├── config
│   ├── css/var.css      # color tokens (primary, secondary, background, foreground)
│   └── json_conf
├── firewall              # rate limiting, encryption helpers
├── lib                    # supabase clients, Stellar wallet creation, shared utilities
├── modules
├── routes
└── utilities              # analytics, SEO, metadata
```

## Getting started

### Prerequisites
- Node.js
- pnpm
- Docker (for self-hosted Supabase)

### 1. Clone and install
```bash
git clone https://github.com/cordyStackX/otterpie.git
cd otterpie
pnpm install
```

### 2. Set up environment variables
Create a `.env` file with:
```dotenv
# Supabase (server)
SUPABASE_URL=http://localhost:8000
SUPABASE_SECRET_KEY=your_secret_key

# Supabase (client)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key

# Security
API_KEY=generate_with_openssl_rand_base64_32
WALLET_BANK_KEY=generate_with_openssl_rand_base64_32
JWT_SECRET=generate_with_openssl_rand_base64_32
```

### 3. Start Supabase (Docker)
```bash
docker compose up -d
```

### 4. Run the dev server
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
- [ ] QR payment / scan flow
- [ ] Pie-split confirmation screen
- [ ] Owner dashboard (tabs, split breakdown)

## License

This project is released under **CC0 1.0 Universal** — public domain. See [LICENSE](./LICENSE) for the full text.

## Contributors

- [cordyStackX](https://github.com/cordyStackX) — Marc Giestin Louis Cordova