# Deployment

Target a Node 24 service with a persistent encrypted disk. This application is not a static export and is not compatible with Cloudflare Workers' Node SQLite environment. Do not deploy `public/` alone or place private data in public storage.

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
