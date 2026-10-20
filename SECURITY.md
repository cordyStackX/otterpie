# Security guide

This document describes the security-relevant parts of Otterpie as they exist in the codebase. It is an implementation overview, not a security audit or a claim that the application is production-ready for custody of valuable funds.

## System structure

- **Web UI:** Next.js client components collect sign-in, profile, and transaction inputs. Client code must never receive server secrets or be trusted to authorize an operation.
- **Route handlers:** `src/app/services/` contains the server-side API. Authenticated user routes use `Security()` from `src/firewall/security.ts`; it checks the signed session and request origin.
- **Database:** `src/lib/supabase-server.ts` creates a server-side Supabase client using `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. The secret key must remain server-only.
- **Authentication:** passwords are hashed with bcrypt. JWTs are signed with `JWT_SECRET`; the session cookie is configured as HttpOnly, Secure, and SameSite Strict in `src/firewall/jwt_auth.ts`.
- **Email flows:** confirmation and password-reset links use purpose-specific signed JWTs with expiry, issuer, and audience checks. Confirmation links expire after 24 hours; reset links expire after 20 minutes and are invalidated when the password changes.
- **Wallet storage and transactions:** wallet secret keys are encrypted before storage. Withdrawal handlers verify the signed-in account password, decrypt the stored key on the server, validate the transfer, and submit it to the selected chain. Private keys must never be sent to a browser, included in a JWT, or written to logs.

## Sensitive server configuration

Set these only in the deployment's server-side secret store. Never commit their values or expose them through `NEXT_PUBLIC_` variables.

- `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
- `JWT_SECRET`
- `WALLET_BANK_KEY`, `WALLET_BANK_KEY_1`, and `WALLET_BANK_KEY_2`
- `APP_PASSWORD` and a server-only Gmail address such as `GMAIL_EMAIL`
- Network endpoints such as `BOT_CHAIN_RPC_URL`, `STELLAR_HORIZON_URL`, and, where needed, `STELLAR_NETWORK_PASSPHRASE`

The wallet encryption uses AES-256-GCM with per-layer random salts and IVs and scrypt-derived keys. New `otterpie:v2:` values require all three wallet keys to decrypt. Older values use the original single-key format. Keep independent, access-controlled backups of the wallet encryption keys; losing a required key can make stored wallets unrecoverable. Because the application server has the keys, a compromise of that server or its environment can expose stored wallet secrets.

`NEXT_PUBLIC_EMAIL` is also accepted as an email sender fallback by existing code. Prefer the server-only `GMAIL_EMAIL` setting and do not put credentials or app passwords in any `NEXT_PUBLIC_` variable.

## Existing protections

- Passwords are hashed with bcrypt; plaintext passwords are not intended to be stored.
- Password-reset responses do not reveal whether an email is registered.
- Withdrawal handlers validate the destination and amount, check the on-chain balance and network fee/reserve, and require password confirmation before signing.
- Wallet keys are decrypted only in server route handlers. The withdrawal routes do not return them.
- Email and withdrawal routes use rate-limit helpers. `Security()` also applies a per-session/IP request limit and checks `Origin`/`Referer` when present.
- `.env*` files are listed in `.gitignore`; verify this remains true and do not force-add local environment files.

## Known limitations to address

These are visible in the current implementation and should be reviewed before using valuable funds:

1. **Bind wallet-secret retrieval to the authenticated user.** `src/app/services/supabase/user/show_secrets/route.ts` calls `Security()` but then uses the email supplied in the request body to look up the account and wallet. It should use the email returned by `Security()` instead. A password check does not replace authorization to the specific wallet.
2. **Keep JWT creation and verification claim shapes consistent.** `src/firewall/jwt_auth.ts` currently signs wallet details inside a `data` claim, while `src/firewall/security.ts` reads a top-level `email` claim. Reconcile and verify this contract before relying on `Security()` as the access control for protected routes.
3. **Rate limits are process-local.** The maps in `src/firewall/rate_limit.ts` and `src/firewall/security.ts` reset on restart and are not shared between server instances. Use a shared rate-limit store for horizontally scaled or serverless production deployments.
4. **Password confirmation is not multi-factor authentication.** It adds a fresh password check for each withdrawal, but a compromised account password and session can still authorize transfers. Consider an independent confirmation factor and transaction limits before holding significant user funds.
5. **Wallet-key custody remains a central risk.** Encryption at rest does not protect keys from code running on the application server, database-plus-key compromise, malicious deployments, or compromised dependencies. Do not market this design as non-custodial: the server can decrypt and sign with user keys.

## Before production or a real-funds trial

- Resolve the known limitations above and review the exact deployed code and environment configuration.
- Confirm the configured network is intentional. The current defaults target BOT Chain Mainnet (`https://rpc.botchain.ai`) and Stellar Public Network (`https://horizon.stellar.org`). Use test networks and test assets while validating the flow.
- Start with a small amount, confirm the network and recipient independently, and verify the transaction on the chain's explorer. A submitted transaction can be irreversible.
- Confirm backups and recovery procedures for Supabase data and all wallet-encryption keys. Restrict who can view or change production environment secrets.
- Rotate `JWT_SECRET`, wallet-encryption keys, database credentials, email credentials, and API credentials if they may have been exposed. Plan a wallet-key migration before rotating encryption keys used for existing rows.
- Review logs and error reporting to ensure no passwords, reset/confirmation tokens, wallet secrets, or signed transaction payloads are captured.

## Reporting a security issue

Do not publish a suspected vulnerability, secret, wallet address tied to a person, or exploit details in a public issue. Report it privately to the project maintainer through a trusted private channel. Include the affected route or file, impact, and safe reproduction steps; do not include real credentials or real wallet secrets.

If a wallet key may have been exposed, treat that wallet as compromised: move remaining assets to a newly generated wallet using a trusted device and revoke or rotate affected credentials. Do not send the exposed key to anyone during the report.
