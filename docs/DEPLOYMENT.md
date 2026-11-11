# Deployment

## Cloudflare Workers, D1 and private R2

The repository includes a complete Worker backend adapter, not just a frontend export. `src/application.js` is shared with the Node server. `wrangler.jsonc` identifies the owner account, D1 database and private R2 bucket; those identifiers are not secrets. There is no automatic GitHub deployment configured.

1. Run `npm ci`, `npm run check`, `npm run lint`, `npm test`, `npm run check:cloudflare`, and `npm run test:cloudflare`.
2. Authenticate with `npx wrangler login` and verify `npx wrangler whoami`.
3. For a different account, create a D1 database and private R2 bucket, then update account/database/bucket identifiers in `wrangler.jsonc`. Keep the bucket private; file access passes through authenticated API permission checks.
4. Apply schema with `npx wrangler d1 migrations apply flames-of-shiva --remote`. Back up first on subsequent releases.
5. Set each actual integration secret using `npx wrangler secret put NAME`: `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DAILY_API_KEY`, `ASTROLOGY_PROVIDER_URL`, `ASTROLOGY_PROVIDER_KEY`, and optional contracted `GEOCODER_URL`. Only set integrations in use. Never use fixture values from the isolated test runner on the deployed service.
6. Run `npx wrangler deploy --dry-run`, then `npm run deploy:cloudflare`. Use `npx wrangler deploy --keep-vars` if retaining dashboard variables. The empty `APP_ORIGIN` uses the incoming HTTPS origin; set an exact canonical origin for a custom domain. Do not copy localhost `APP_ORIGIN` from the Node example into production secrets.
7. Verify HTTPS, public routes/assets, API permissions, provider setup-required states and a real provider test-mode end-to-end workflow before enabling sales.
8. Create and email-verify the designated administrator after configuring email delivery. Administration is never granted merely by entering an unverified email.

Worker rate-limit bindings protect API, authentication and code requests. D1 batches atomically commit related updates; a database revision guard validates all reads and retries concurrent changes. Every application write uses the shared SQL store. Do not bypass it with competing live administrative SQL writes during transactions. Private uploads are written to R2 before their metadata is saved. Configure retention of orphaned uploads and restore-test D1/R2 backups together.

The Cloudflare image adapter decodes/re-encodes PNG/JPEG, removes metadata and bounds decoded image size to four megapixels and input size to 5 MB. Unlike the Node Sharp adapter, it does not auto-rotate EXIF orientation or downscale large originals. Export correctly oriented, smaller images before upload. PDF checks are defensive format checks, not malware scanning.

Birthplace timezone suggestions in the Worker use `@photostructure/tz-lookup`; the Node host uses `geo-tz`. Both produce IANA zone names. Boundary suggestions must be confirmed/corrected by the user. Astronomical calculations use the submitted timezone, coordinates and recorded UTC instant.

`npm run test:cloudflare` starts a local Worker with temporary D1/R2 storage and disposable fixture secrets, runs the API and concurrency tests, then removes that storage. It never writes test records or test credentials to the remote application.

## Node 24 with persistent disk

The original Node host remains supported. `public/` alone cannot provide the backend.

1. Run `npm ci`, `npm run check`, `npm run lint`, `npm test`, `npm run build`.
2. Deploy the repository (or the server bundle under `dist`) to a Node service.
3. Set `NODE_ENV=production`, `HOST=0.0.0.0`, the service `PORT`, `APP_ORIGIN=https://your-domain` and `DATA_DIR=/var/lib/flames` or the platform's mounted private disk.
4. Put HTTPS in front of the Node process. Production cookies are Secure and won't work on HTTP. Proxy requests to the configured port. Keep request limits aligned with the 8 MB JSON/5 MB file limits.
5. Configure Resend sender and Stripe/Daily/Vedic service credentials. Keep credentials in the hosting platform secret manager. Restart after changing environment values.
6. Configure the Stripe webhook and test delivery/replay. Confirm no payment is marked paid by redirect alone. Test refund lifecycle and Connect transfers in test mode.
7. Create/verify the designated administrator account. Publish actual readers, inventory and editorial content. There are no seeded business records.
8. Complete all remaining production items in COMPLETION.md before enabling real sales or sensitive document intake.

A Dockerfile is included. Example development deployment:

```sh
docker build -t flames-of-shiva .
docker run --env-file .env -e HOST=0.0.0.0 -p 3000:3000 -v flames-data:/app/data flames-of-shiva
```

Set production HTTPS variables appropriately rather than reusing a local `.env` unchanged. Docker image construction has not been executed in this session.

## Migrations and backups

Migrations apply in filename order within transactions, and each applied version is stored in `schema_versions`. Back up before any release that changes schema. Use SQLite's online backup/VACUUM INTO mechanism or a filesystem snapshot with the service stopped; do not copy only an active WAL database file. Back up the database and private uploads together, encrypt backups, and restore-test them. There is no down-migration tool; restore a backup to roll back data schema.

Run one application instance against one local disk. Horizontal deployment needs a shared transactional database and object storage adapter, plus a shared rate limiter. Per-process rate limiting is not a distributed abuse-control service.

## Operations checklist

- Monitor non-2xx API responses, webhook failures and provider timeouts without logging secrets, room tokens, birth details or upload bodies.
- Reconcile pending Checkout sessions against Stripe and repair missed webhook deliveries.
- Schedule backup, retention, stale reservation and privacy-deletion jobs.
- Establish taxes/shipping, cancellation/refund, reader commission, payout/dispute and credential-review policies.
- Add full PDF malware scanning and quarantine if accepting external credential PDFs.
- Complete a formal security and accessibility review before public production launch.
