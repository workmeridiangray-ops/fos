# Workflows and permissions

## Customer

1. Sign up → sign in → request email code → verify. Email provider setup is required for verification and password recovery.
2. Add/edit birth profiles. The five-city list has known coordinates; other places accept manual coordinates and any IANA timezone/explicit offset.
3. Numerology and tarot work without sign-in; sign in to save. Birth chart calculations require sign-in. Saved reports can be reopened, filtered, deleted and printed to PDF. Sharing can copy a public summary or create an explicit-consent link expiring after seven days. All reading links can be revoked by the owner.
4. Search readers by practice/name/language → reader profile → choose actual slot in browser timezone → format and intake → reserve using an idempotency key → Stripe Checkout → verified webhook confirmation.
5. Manage appointment: cancel pending reservation or move to an available slot with the same reader and price. Paid cancellation goes through refund request and administrator review.
6. Waiting room → scheduled persistent chat → optional private Daily call → end confirmation → transcript, private feedback and rebooking. Messages poll every five seconds; reconnect retries. Shared files are accessible to consultation participants and administrators only.
7. Palmistry: upload both images → submit → admin assigns an approved reader → reader downloads images and writes report → customer sees delivered report and notification.
8. Support: create ticket → reply in private conversation → mark resolved. Refund requests are private, duplicate-protected and reviewed separately.
9. Shop: browse real admin-entered catalog → filter/search → product quantity → cart → save address → place order with stock reservation → checkout → verified paid state → admin processing/shipped/delivered. Cancel unpaid order releases stock; the second cancellation cannot restock twice.

## Reader

Customer account → application with supporting files → admin review (approve/request changes/reject) → approved reader role → profile, languages, practices and rate → publish non-overlapping UTC slots → consultation requests → session workspace, private notes and assigned palmistry reports → earnings and Connect account reference → admin-submitted transfer history.

Reader earnings currently allocate the full paid completed session amount. There is no silently assumed commission, payout minimum or settlement delay. Agree and implement these policies before live revenue activity. Connect account onboarding itself happens outside this app; the current form stores an already-created account reference.

## Administrator

`ADMIN_EMAIL` matching an email is not sufficient for administrator access: the account must verify its email first. Every subsequent protected API request reads the current role from SQLite, so role changes take effect without relying on browser claims.

Admin can review applications and credentials, grant/revoke user roles (except their own through the UI), view bookings and payment records, review refunds, submit provider transfers, assign palm submissions, fulfil shop orders, reply to support, publish and edit articles/products/services, save policy drafts and read audit history. Secrets are environment-only. Policy drafts are not legal terms and are not automatically published.

## Server enforcement

| Resource | Customer | Reader | Admin |
|---|---|---|---|
| Public catalog/readers | Read | Read | Publish/manage |
| Private birth profiles/reports/addresses | Own | Own | Operational access |
| Bookings/chat | Customer participant | Assigned reader | Operational access |
| Reader private notes | No | Own assigned-session notes | Operational access |
| Credentials | Own upload | Own upload | Review |
| Palm images | Own | Explicitly assigned reader | Assign/review |
| Consultation shared files | Participant | Participant | Operational access |
| Applications | Own, submit | Own | Review |
| Availability | Browse | Own non-overlapping slots | Browse |
| Refunds | Own confirmed paid bookings | No customer refund rights | Review/provider request |
| Earnings/payout references | No | Own | Transfer/review |
| Support | Own tickets | Own tickets | All tickets/replies |
| Audit/roles/settings | No | No | Admin only |

## Recovery behavior

- Invalid/missing fields: HTML validation plus server validation; inputs remain visible after errors.
- Missing provider: HTTP 503 setup-required message, no fabricated success.
- Unauthorized/forbidden: 401/403, no private data returned.
- Slot/stock conflict: 409, authoritative database state wins.
- Duplicate payment request: same provider idempotency key; duplicate webhook event is acknowledged without replaying changes.
- Failure before provider response: pending records remain traceable; retry the existing checkout or cancel it.
- No data: explicit empty states with a relevant next action.
- Invalid route: usable not-found page with home navigation.

## Not yet automated

Provider webhook reconciliation, account/data deletion requests, retention/consent policy, refund settlement notifications, transfer reversal/dispute ledger adjustments, cancellation policy cutoffs, shipping/tax computation, availability recurrence and external calendar sync. See COMPLETION.md before production.
