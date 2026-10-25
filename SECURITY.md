# Security guide

This document describes the security-relevant parts of Otterpie as they exist in the codebase. It is an implementation overview, not a security audit or a claim that the application is production-ready for custody of valuable funds.

## System structure

- **Web UI:** Next.js client components collect sign-in, profile, and transaction inputs. Client code must never receive server secrets or be trusted to authorize an operation.
- **Route handlers:** `src/app/services/` contains the server-side API. Authenticated user routes use `Security()` from `src/firewall/security.ts`; it checks the signed session and request origin.
- **Database:** `src/lib/supabase-server.ts` creates a server-side Supabase client using `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. The secret key must remain server-only.
- **Authentication:** passwords are hashed with bcrypt. JWTs are signed with `JWT_SECRET`; the session cookie is configured as HttpOnly, Secure, and SameSite Strict in `src/firewall/jwt_auth.ts`.
- **Email flows:** confirmation and password-reset links use purpose-specific signed JWTs with expiry, issuer, and audience checks. Confirmation links expire after 24 hours; reset links expire after 20 minutes and are invalidated when the password changes.
- **Wallet storage and transactions:** wallet secret keys are encrypted before storage. Supported transfer, swap, trustline, bridge, and Paiflow handlers can decrypt keys on the server and sign transactions after their respective checks. Private keys must never be sent to a browser, included in a JWT, or written to logs.
- **Paiflow:** saved deployment IDs and per-deployment API tokens are encrypted before they are stored in the `paiflow` table. The payment route restricts use to Stellar Testnet USDC deposit flows with Execute support, verifies the account password, validates the prepared transaction's network and source, signs it server-side, and submits it through the Paiflow SDK. The deployment's configured recipients and split logic are controlled by that deployment, not by Otterpie.

## Sensitive server configuration

Set these only in the deployment's server-side secret store. Never commit their values or expose them through `NEXT_PUBLIC_` variables.

- `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
- `API_KEY` and `JWT_SECRET`
- `WALLET_BANK_KEY`, `WALLET_BANK_KEY_1`, and `WALLET_BANK_KEY_2`
- `APP_PASSWORD` and a server-only Gmail address such as `GMAIL_EMAIL`
- Network endpoints such as `BOT_CHAIN_RPC_URL`, `STELLAR_HORIZON_URL`, and, where needed, `STELLAR_NETWORK_PASSPHRASE`

Paiflow API tokens are supplied for individual deployments in the Paiflow settings UI and stored encrypted in Supabase; they are not a shared environment token. `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is a client-visible project identifier, not a secret.

The wallet encryption uses AES-256-GCM with per-layer random salts and IVs and scrypt-derived keys. New `otterpie:v2:` values require all three wallet keys to decrypt. Older values use the original single-key format. Keep independent, access-controlled backups of the wallet encryption keys; losing a required key can make stored wallets unrecoverable. Because the application server has the keys, a compromise of that server or its environment can expose stored wallet secrets.

`NEXT_PUBLIC_EMAIL` is also accepted as an email sender fallback by existing code. Prefer the server-only `GMAIL_EMAIL` setting and do not put credentials or app passwords in any `NEXT_PUBLIC_` variable.

## Existing protections

- Passwords are hashed with bcrypt; plaintext passwords are not intended to be stored.
- Password-reset responses do not reveal whether an email is registered.
- Withdrawal handlers validate the destination and amount, check the on-chain balance and network fee/reserve, and require password confirmation before signing.
- Wallet keys are decrypted only in server route handlers. The withdrawal routes do not return them.
- Email, withdrawal, trustline, and Paiflow routes use rate-limit helpers. `Security()` also applies a per-session/IP request limit and checks `Origin`/`Referer` when present.
- `.env*` files are listed in `.gitignore`; verify this remains true and do not force-add local environment files.
- Paiflow payment submission checks that the prepared XDR is for the stored Stellar wallet and Testnet network before signing. It returns a transaction reference; users should verify the resulting transaction before retrying a payment.

## Known limitations to address

These are visible in the current implementation and should be reviewed before using valuable funds:

1. **Bind wallet-secret retrieval to the authenticated user.** `src/app/services/supabase/user/show_secrets/route.ts` authenticates a session with `Security()` but looks up the account and wallet using an email from the request body. Use the authenticated email returned by `Security()` for both lookups. A password check does not replace authorization to the wallet associated with the active session.
2. **Rate limits are process-local.** The maps in `src/firewall/rate_limit.ts` and `src/firewall/security.ts` reset on restart and are not shared between server instances. Use a shared rate-limit store for horizontally scaled or serverless deployments. Also ensure proxy headers used for client IP and request origin are set only by trusted infrastructure.
3. **Password confirmation is not multi-factor authentication.** A compromised account password and session can still authorize signing operations. Consider independent confirmation and transaction limits before holding significant user funds.
4. **Wallet-key custody remains a central risk.** Encryption at rest does not protect keys from code running on the application server, database-plus-key compromise, malicious deployments, or compromised dependencies. The server can decrypt and sign with user keys; do not describe these generated wallets as non-custodial.
5. **Third-party operations add separate trust boundaries.** Paiflow deployment credentials authorize operations on the selected deployment, and bridge/swap routes depend on external contracts, RPC providers, and liquidity. Restrict Paiflow tokens to the required deployment and permissions, use Testnet while validating, and verify transaction status before retrying uncertain submissions.

## Before production or a real-funds trial

- Resolve the known limitations above and review the exact deployed code and environment configuration.
- Confirm the configured network is intentional. The app includes BOT Chain Mainnet, Stellar Mainnet, and Stellar Testnet. Stellar Testnet uses the same Stellar wallet key as Mainnet but a separate ledger. Use test networks and test assets while validating the flow, and verify the wallet's selected network before signing.
- Start with a small amount, confirm the network and recipient independently, and verify the transaction on the chain's explorer. A submitted transaction can be irreversible.
- Confirm backups and recovery procedures for Supabase data and all wallet-encryption keys. Restrict who can view or change production environment secrets.
- Rotate `JWT_SECRET`, wallet-encryption keys, database credentials, email credentials, and API credentials if they may have been exposed. Plan a wallet-key migration before rotating encryption keys used for existing rows.
- Review logs and error reporting to ensure no passwords, reset/confirmation tokens, wallet secrets, or signed transaction payloads are captured.

## Reporting a security issue

Do not publish a suspected vulnerability, secret, wallet address tied to a person, or exploit details in a public issue. Report it privately to the project maintainer through a trusted private channel. Include the affected route or file, impact, and safe reproduction steps; do not include real credentials or real wallet secrets.

If a wallet key may have been exposed, treat that wallet as compromised: move remaining assets to a newly generated wallet using a trusted device and revoke or rotate affected credentials. Do not send the exposed key to anyone during the report.
