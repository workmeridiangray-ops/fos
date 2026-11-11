# Page and state inventory / implementation checklist

Created before implementation. Source: supplied brief and read-only Framer project WbsYE0A653U4Z73iz5ms (Playfair Display / DM Sans). No repository, ZIPs, seven boards, wordmark files or celestial artwork were attached. Unrelated attachments in the global attachment index were excluded.

| Area | Routes / workflow | Access | Required states |
|---|---|---|---|
| Public | /, /about, /explore-readings, /services/:slug, /reader-search, /reader-profile?id=, /daily-horoscope, /blog, /article?id=, /contact | Everyone | listing, filters, details, no results, provider unavailable |
| Identity | /sign-in, /sign-up, /otp-verification, /forgot-password, /reset-password | Everyone | validation, pending email, delivery failure, expired code, success |
| Customer | /customer-dashboard, /account, /notifications, /birth-profiles, /profile-edit, /favourites, /my-readings | Owner | loading, empty, create/edit/delete, saved, forbidden |
| Kundli | /kundli, /birth-details, /kundli-calculation, /kundli-overview, /planet-details, /dasha-timeline | Owner | input, unknown time, coordinates/timezone, progress, provider unavailable, report tabs, save, share, print/PDF |
| Compatibility | /compatibility-details, /compatibility-report | Owner | two profiles, validation, progress, provider unavailable, factors, save, consultation |
| Tarot | /tarot-reading, /tarot-spread, /tarot-card-selection, /tarot-interpretation | Everyone; owner to save | question, spread, selection, reveal, interpretation, saved |
| Numerology | /numerology, /numerology-report | Everyone; owner to save | input, calculation, explanations, save, print/PDF |
| Palmistry | /palmistry-upload | Owner | guidance, left/right secure upload, validation, submission, awaiting reader, delivery |
| Booking | /booking, /session-intake, /payment, /booking-confirmation, /appointments | Owner | reader search, format/duration, UTC slot/timezone, intake, reserve, payment pending/success/failure, cancel, reschedule |
| Session | /live-session, /session-summary | Customer or assigned reader | waiting, connected chat, voice/video setup required, reconnect, messages/files, end, feedback, rebook |
| Payments/support | /transactions, /receipt, /refunds, /help, /support, /ticket?id= | Owner / support admin | history, receipt, refund request/status, ticket create/reply/close |
| Reader | /reader-application, /application-status, /reader-dashboard, /reader-settings, /availability, /reader-requests, /reader-notes, /earnings, /payout-details, /payout-history | Applicant / approved reader | credentials, submitted, changes requested, approval, services/languages/pricing, slots, private notes, ledger |
| Admin | /admin, /admin/users, /admin/readers, /admin/applications, /admin/bookings, /admin/transactions, /admin/refunds, /admin/payouts, /admin/support, /admin/content, /admin/services, /admin/permissions, /admin/settings, /admin/audit | Admin | lists, review, approval/rejection, updates, audit, forbidden |
| Shop | /shop, /product?id=, /cart, /checkout, /addresses, /order-confirmation, /orders, /order?id= | Everyone; owner checkout | filters, details, quantities, empty cart, address, payment setup required, order status |

## Completion policy
Each module is audited in COMPLETION.md with implemented behavior, tests, and remaining work. A route existing is not evidence that its entire workflow is complete. Production credentials and missing reference assets must remain explicit external setup.
