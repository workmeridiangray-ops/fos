# Flames of Shiva

A working Node 24 and Cloudflare Workers application with a responsive branded frontend, SQLite persistence, customer/reader/admin access controls, astronomical positions, numerology, reflective tarot, reader onboarding, appointment reservations, persistent consultation chat, palmistry delivery, support and a configurable shop.

**Status:** substantial implementation, not a production-complete fulfilment of the entire brief. See [the precise completion report](docs/COMPLETION.md). Vedic reports await the provider the owner will supply. Provider credentials are intentionally absent. No real payments, email deliveries, video calls, refunds or payouts have been claimed or executed.

## Local setup

```sh
npm ci
cp .env.example .env
npm start
```

Open http://localhost:3000. Use Node 24 or later (native `node:sqlite` is required). No seeded accounts, readers, testimonials, products, orders or transactions exist in the application database. Tests create isolated disposable fixtures in the OS temporary directory.

Create an account in the interface. Configure Resend before requesting an email verification code. To bootstrap administration, set `ADMIN_EMAIL` to the exact account email **before verifying that email**. The matching account is promoted only after successful verification. Do not grant administration based on an unverified email. Subsequent roles are managed in Administration → Users.

## Configuration

Copy `.env.example` and set only the integrations you use:

| Variable | Purpose |
|---|---|
| `PORT`, `HOST` | Server port and bind address; localhost by default |
| `APP_ORIGIN` | Exact browser origin including scheme and port; used for CSRF and payment redirects |
| `DATA_DIR` | Persistent, private storage for SQLite and uploads |
| `NODE_ENV` | `production` enables Secure cookies and denies framing |
| `ADMIN_EMAIL` | Administrator bootstrap after email verification |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend key and verified sending identity |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout/refunds/transfers and signed webhook verification |
| `DAILY_API_KEY` | Private expiring Daily rooms and per-participant meeting tokens |
| `ASTROLOGY_PROVIDER_URL`, `ASTROLOGY_PROVIDER_KEY` | Owner-supplied Vedic provider adapter, described in `docs/INTEGRATIONS.md` |

Missing integrations produce setup-required responses and preserve the surrounding workflow. Secrets never belong in Git or frontend code. Use provider test mode first. Never use the automated test webhook secret outside tests.

## Checks

```sh
npm run check
npm run lint
npm test
npm run build
```

`check` validates JavaScript syntax. `npm run check:cloudflare` generates platform binding types and checks the TypeScript Worker entry point. `npm run test:cloudflare` runs the workflow and concurrency tests against isolated local D1/R2 bindings. `lint` applies ESLint correctness checks. `test` exercises calculations and HTTP workflows against a fresh temporary SQLite database. `build` creates a server deployment bundle in `dist/`; it is not a static-only site.

## Architecture

- `public/app.js`: accessible DOM components, routing, forms, state and API client.
- `public/styles.css`: black navigation, cream surfaces, gold accents, responsive layouts and print styles.
- `src/application.js`: shared API, sessions, permissions, bookings, shop, operations and webhooks.
- `src/server.js`: Node HTTP, native SQLite, private disk and Sharp adapters.
- `src/worker.ts`: Cloudflare D1/R2, rate limits and static asset bindings.
- `src/sql-store.js`: atomic batches with optimistic snapshot validation and retries.
- `src/calculations.js`: Astronomy Engine, Luxon, explicit Pythagorean rules and secure Major Arcana shuffle.
- `src/integrations.js`: Resend, Stripe, Daily and the Vedic contract adapter.
- `migrations/`: ordered transactional schema migrations recorded in `schema_versions`.
- `tests/`: disposable test fixtures only. Production never seeds fictional data.
- `docs/`: inventory, workflows, permissions, integration contracts, visual review and remaining work.

The checkout is linked to https://github.com/workmeridiangray-ops/fos.git, which was empty when inspected. The Framer project was inspected read-only; it has not been modified.

## Cloudflare

The full frontend and backend can run on Workers with D1 for relational data and private R2 for uploads. See [deployment instructions](docs/DEPLOYMENT.md). External provider credentials are still required for email, payments, calls and Vedic reports. GitHub contains the source; deployments currently use Wrangler rather than automatic GitHub builds.

```sh
npm run dev:cloudflare
npm run check:cloudflare
npm run test:cloudflare
```
