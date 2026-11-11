# Integrations and calculation accuracy

## Astronomy Engine / Luxon

The built-in report uses Astronomy Engine `GeoVector(body, date, true)` followed by `Ecliptic(vector).elon` for seven bodies. It reports **tropical, geocentric ecliptic longitudes of date**. It does not pretend to be a complete Vedic kundli. Ayanamsa is explicitly none; houses, ascendant, nodes, D9, dashas and interpretations are unavailable without the Vedic provider. Unknown birth time uses local noon and labels Moon positions as approximate. Luxon converts IANA timezones or explicit UTC offsets. Impossible dates, DST gaps, ambiguous DST overlaps and future birth dates are rejected.

Reference: https://github.com/cosinekitty/astronomy/tree/master/source/js
Reference: https://moment.github.io/luxon/api-docs/index.html

## Owner-supplied Vedic service

The owner confirmed they will provide a provider and credentials. No provider has been selected or live-validated. The current adapter is an explicit **custom gateway contract**, not a claim of compatibility with an unnamed commercial API. An actual provider may require OAuth and a translation layer; implement that mapping once the provider is supplied.

Set `ASTROLOGY_PROVIDER_URL` to an HTTPS gateway implementing:

- `POST /kundli`: complete birth input, `name`, ISO date, local `time`, `timezone`, `latitude`, `longitude`, `unknownTime`.
- `POST /compatibility`: `{first: birthInput, second: birthInput}`.
- `POST /horoscope`: `{sign, date}`.
- Header: `Authorization: Bearer <ASTROLOGY_PROVIDER_KEY>`.
- Response: `{assumptions: {...}, report: {...}}`; both properties are required.

Required assumptions: provider and engine version, UTC instant, source timezone, coordinates, ayanamsa, sidereal zodiac, node convention, house/chart convention, birth-time confidence. Complete kundli reports should include Rashi, planetary positions, Vimshottari major/subperiods, explicit yoga/dosha rules, remedies, D9 and interpretive content. Do not use random compatibility scores or invented predictions.

Current provider response rendering is structured JSON under report sections. Dedicated typed charts, dasha timelines and factor layouts remain to be implemented against the selected provider schema. The default tropical report uses a dedicated planetary table.

## Numerology

Pythagorean Latin A=1… I=9, J=1 repeating. Non-Latin names require a user-supplied transliteration. Sum all date digits for life path; preserve 11, 22, 33 on repeated reduction. Expression sums all letters; soul urge sums A/E/I/O/U; personality sums consonants (Y included); birthday reduces the birth day. A zero vowel total is explained as no matching letters. Meanings are symbolic reflection prompts.

## Tarot

22 Major Arcana, upright only. Each reveal uses a server-side Fisher–Yates shuffle with `crypto.randomInt`. User-selected positions are unique and drawn without replacement. One-card and three-card spreads have curated reflective questions. No external divination or prediction service is claimed.

## Resend

Server-side `POST https://api.resend.com/emails`, with a verified `EMAIL_FROM`. Codes expire after 10 minutes and allow at most five attempts. Codes and sessions are hashed at rest. Reset invalidates existing sessions. Delivery failures are explicit; no development OTP is returned to browsers.

Reference: https://resend.com/docs/api-reference/emails/send-email

## Stripe

Checkout Sessions for consultation and shop payments, server-authoritative INR paise totals, stable idempotency keys. Session IDs are stored for expiration and cancellation. Client success URLs never mark a payment successful. The raw webhook body is verified with SHA256 HMAC, timestamp tolerance and timing-safe comparison; provider event IDs deduplicate mutations transactionally.

Webhook URL: `https://YOUR_ORIGIN/api/payments/webhook`. Subscribe to `checkout.session.completed`, `checkout.session.expired`, `refund.created`, `refund.updated`, `refund.failed`. Confirmation checks `payment_status`, expected amount and currency. Refunds use the original payment intent. Stripe Connect transfers require a valid connected account; payout amounts are computed from paid completed sessions less recorded transfers.

Abandoned reservations without Checkout are released on the next API request after 30 minutes. Checkout sessions expire after roughly 30 minutes and their webhook releases holds. Production needs a reconciliation job for missed webhook delivery and explicit transfer reversal/dispute policies. Currently no asynchronous payment methods, chargeback automation, partial refund UI, tax invoices or provider reconciliation console are implemented.

References:
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/events/manage-webhook-endpoints
- https://docs.stripe.com/api/refunds/create
- https://docs.stripe.com/api/transfers/create

## Daily

Private named rooms are created on demand only for a confirmed participant during the scheduled appointment. Room/token expiration matches the scheduled end. Tokens bind to participant user ID and name. Maximum participants is two. Voice sessions start with video off. The app opens Daily's hosted call UI; it does not falsely display a connected call before provider success. No recording is enabled. Meeting URLs/tokens should never be logged or shared outside participants.

References:
- https://docs.daily.co/reference/rest-api/rooms/create-room
- https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token

## File storage

Private local disk under `DATA_DIR/uploads`. Upload size limit 5 MB, unpredictable IDs, authenticated downloads, owner/admin/explicit assigned reader/consultation participant access. Images are decoded with Sharp, limited to 40 million input pixels, orientation-normalised, resized and re-encoded without original metadata. Palm submissions require PNG/JPEG. PDFs must have a PDF header and EOF and cannot contain obvious script, embedded-file or automatic-action markers. This is not a malware scanner; production document intake should add a scanning/quarantine service. Do not place DATA_DIR under public assets. Local disk is a real persistence implementation; no S3 integration is claimed.

## Birthplace search

`GEOCODER_URL` is an operator-supplied self-hosted or contracted Nominatim-compatible search endpoint. Search is explicit button-triggered, never autocomplete. The adapter accepts JSONv2 `display_name`, `lat`, `lon`, caches results for a day, caps results at five and enforces at least 1.1 seconds between new server requests. It never sends birth names, dates or times to the geocoder, only the entered place query. geo-tz resolves coordinates to an IANA zone; the user can correct the inferred timezone. Configure endpoint-specific attribution and terms before production.

The public community Nominatim endpoint is deliberately disabled. Its usage policy restricts automatic platform integrations, autocomplete and heavy usage; operators must make an informed provider choice. Policy: https://operations.osmfoundation.org/policies/nominatim/ . Timezone library: https://github.com/evansiroky/node-geo-tz .

## Shared readings

Share creation requires an authenticated owner and explicit consent. Tokens are 32 random bytes, hashed at rest and expire after seven days. Anyone with a valid token can read the complete chosen report, including personal details. Owners can revoke every token for that report; deleting the report cascades to token records. A separate summary-sharing option contains no birth details. Links should be treated as private bearer credentials.
