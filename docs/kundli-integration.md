# Kundli integration

The new customer module lives at `/kundli`, `/birth-details`, `/kundli-saved` and `/kundli-overview?id=<run>`. The rest of the website keeps its existing authentication, profiles, consultations, payments and shop. Ready charts also appear in the existing dashboard and My readings history. Earlier tropical reports remain readable through My readings; new charts use the separate supplied Python engine.

## Local setup

Use Node 24 and Python 3.12 or 3.13. From the repository:

```sh
npm ci
python3 -m venv chart-service/.venv
chart-service/.venv/bin/pip install -r chart-service/requirements.txt
```

Generate a strong random shared key and put it in an untracked environment file or secret manager. Do not use the word `secret` or commit a key. Start the Python service from `chart-service`, with `CHART_API_KEY` in its environment:

```sh
.venv/bin/uvicorn api:app --host 127.0.0.1 --port 8080 --no-access-log
```

In the website `.env`, set `CHART_API_URL=http://127.0.0.1:8080`, `CHART_API_KEY` to the same key, and keep `NODE_ENV=development`. Run `npm start`; Node applies migration `006_kundli.sql` automatically. Production requires an HTTPS chart URL. No key or provider URL is emitted into browser JavaScript.

The Python service supports `PORT` through its Docker entrypoint, explicit `CORS_ORIGINS` (empty for server-to-server use), `CHART_MAX_JOBS` (default 2, maximum 4), `EPHE_PATH`, and `REQUIRE_SWISS_EPHEMERIS`. The website uses its existing geocoder contract and coordinate-to-timezone lookup, then evaluates the offset at the actual birth date through Luxon. Five reference cities work without the contracted geocoder; other cities need that geocoder or manually confirmed coordinates and timezone. Worker coordinate lookup is approximate near borders; users can correct the IANA zone. There is no silent default birthplace or device-timezone assumption in the kundli form; a new profile starts with an empty required timezone.

## Website API and persistence

All endpoints require an existing signed-in session. They never accept a browser-supplied owner. Charts use strict owner checks, including administrators; generic records retain the website's existing policies.

| Endpoint | Result |
| --- | --- |
| `POST /api/kundli/runs` | `{input, profileId?, requestKey}` validates details, claims an idempotent run, calculates and saves it. Returns 201 ready, 202 pending, or an actionable error. A failed run is retained and can be retried with the same key. Reusing a key with different birth details returns 409. |
| `GET /api/kundli/runs` | Latest 100 private runs, newest first; metadata and input only, no bulk chart payloads. |
| `GET /api/kundli/runs/:id` | Owned run with its actual saved chart, input and settings. |
| `DELETE /api/kundli/runs/:id` | Deletes only the owner's chart and cascades fine-period cache deletion; profile remains. |
| `GET /api/kundli/runs/:id/dashas?path=Sun-Rahu-Saturn` | Validates the three parent levels against the saved chart, computes only that fine branch, and stores a private cache. |

Migration 006 creates `kundli_runs` and `kundli_dasha_cache`. Initial reports are roughly 330 KB in tested births, bounded to 1 MB; they do not include the multi-megabyte full Sookshma tree. A unique `(owner,request_key)` constraint prevents duplicate runs. Claims use affected-row counts outside transactions so both SQLite and D1 behave correctly. Stale pending claims can retry after 70 seconds; job timeout is 45 seconds and backend request timeout 55 seconds. Generation and uncached fine branches are each limited to five requests per minute per account, alongside existing IP limits. Deletion races are checked after provider requests.

## Python API

`GET /health` returns readiness metadata without birth information. `POST /chart` requires `x-api-key` matching the server's configured `CHART_API_KEY`; absent configuration returns 503, wrong/missing key 401. Wildcard CORS is rejected. Responses use `Cache-Control: no-store`; access logs are disabled in the container.

Request fields: `name`, optional `gender` (`male`, `female`, `other`), `year`, `month`, `day`, `hour`, `minute`, `second`, `place`, `latitude`, `longitude`, numeric `timezone` in hours, optional `timezone_name` (IANA or `UTC+05:30`), `include_sookshma` (default false), optional `dasha_path` of exactly three planet names. The website always supplies both historical offset and zone name. The API validates calendar dates, future dates, finite coordinates, historical IANA offset agreement, DST gaps and ambiguous local times. An ambiguous clock requires a confirmed explicit UTC-offset zone. Unknown birth time is rejected by the website calculation endpoint; profiles may still be saved. No noon chart is fabricated.

The original wrapper's false flag only removed fine data **after** computing it. This integration skips fourth-level computation when false and restricts it to the requested parent branch when supplied. Direct `include_sookshma=true` without a branch remains compatible with full fourth-level output, bounded by service timeout and 8 MB output limit.

Every request spawns a new Python process. Mutable engine globals, Swiss Ephemeris state and accumulating Ashtakavarga arrays die with that process. The API exchanges JSON over stdin/stdout; no chart output filename, shared JSON file or personal log is created. Requests are limited to 8 KB and each instance admits at most the configured number of jobs. Capacity waits two seconds, then returns 429. Deploy Cloud Run with concurrency 2 and bounded instances.

## Schema to interface mapping

| Interface | Actual source |
| --- | --- |
| Birth strip / saved history | Validated run `input`; immutable calculation snapshot, separate from later profile edits. |
| Ascendant summary | `D1.ascendant.sign`, `lagna-lord`. |
| Moon / nakshatra / pada | `D1.planets.Moon.sign`, `rashi`, `nakshatra`, `pada`. |
| Sixteen divisional charts | Each `D*.houses`, `D*.planets`, **that division's** `ascendant`. North fixes houses 1–12; South fixes Aries–Pisces cells. Each house's `sign-num` maps the planet group; Asc belongs to H1 of that division. |
| Planet table | `name`, `sign`, `pos.{deg,min,sec}`, `house-num`, `nakshatra`, `pada`, `retro`, `house-rel`. `status` is an engine lifecycle field and is deliberately not relabeled as dignity. |
| Dasha levels | `Dashas.Vimshottari.{mahadashas,antardashas,paryantardashas,sookshmadashas}` dictionary keys encode parent paths. Actual date comparisons determine active state and elapsed progress; the engine's naive `current` field is ignored. Human duration strings can be inconsistent, so elapsed lengths derive from dates. |
| Strengths | All numeric leaves of `Balas` (Vimshopaka, Shadbala, Ishtabala, Kashtabala, BhavaBala), grouped by system/metric. Arrays map to houses, objects to planets. Bars preserve negative values and use the displayed metric's numeric scale; the table remains the precise accessible view. Values are engine values, not probability or prediction scores. |
| Ashtakavarga | `AshtakaVarga.Sun` through `Saturn` and `Total`. Arrays are **D1 house order**, not an assumed Aries-first sign sequence. Column headers show both house and actual D1 sign; row sums are arithmetic sums. |
| Print / Save PDF | Current owned run, all 16 SVG charts and planet tables, available first three dasha levels, currently opened fine branch, all strength metrics, Ashtakavarga, original input and calculation settings. Uses the browser's print dialog and Save as PDF. |

The adapter canonicalizes the supplied spelling `Saggitarius` to `Sagittarius` in sign labels only; calculations and sign numbers are unchanged.

Planet abbreviations are accompanied by a legend, full planet tables and expandable house summaries. Dense triangular cells use smaller two-column labels. SVG has accessible names; expanded charts use a native keyboard-trapped dialog. Print is built only from a report already fetched through owner authorization; no public export URL exists.

## Calculation assumptions

Sidereal Lahiri (`SIDM_LAHIRI`); Swiss Ephemeris via pyswisseph. Rahu uses the mean lunar node; Ketu is opposite. Houses are whole-sign and each divisional chart starts from its own ascendant. `houses_ex` explicitly uses whole-sign mode to avoid irrelevant Placidus failures at polar latitudes; exact poles may still be unsupported by the upstream calculations and fail explicitly.

No Swiss `.se1` files were supplied. Tested runs use the library's **Moshier analytical fallback**, reported in settings and the interface. To require data files, provision licensed files at `EPHE_PATH` and set `REQUIRE_SWISS_EPHEMERIS=true`; the job fails if Swiss data is unavailable. Do not relabel fallback output as file-based Swiss calculations. Initial metadata identifies ephemeris selection from the Sun preflight. Dasha date strings are interpreted at the fixed UTC offset at birth, not future DST changes. Fine divisions depend strongly on accurate recorded time. Traditional division names are navigation labels, not generated personal predictions.

Tests establish isolation, internal consistency and rendering regression. They do not independently certify astronomy, strengths, divisional formulae, or astrological interpretations. No dosha, yoga, remedy, horoscope or compatibility conclusion was invented by this module.

## Licences and release

Read `chart-service/NOTICE.md` and preserved notices before public activation. JyotishYamitra has a root MIT notice but two calculation modules carry AGPL-3.0-or-later headers; pyswisseph is AGPL-3.0; Swiss Ephemeris has AGPL / Professional terms. The owner selected the free AGPLv3 source-release route on 13 November 2026. Root LICENSE, preserved third-party notices, the exact binding/Swiss C source distribution and network-user source links implement that choice; publish and verify release kundli-agpl-v1 before activation.

The two outer integration ZIPs were identical; API and fixed-v2 calculation source was also identical. The runtime copy excludes all private reference JSON, preloaded preview HTML, demo generation scripts, screenshots and ZIP archives. Official supplied logos are used as trimmed web assets. Private rendering regression can be run with:

```sh
KUNDLI_REFERENCE_FILE=/absolute/private/reference.json node scripts-check-private-kundli.js
```

It renders all divisions in both layouts in memory and writes no personal artifact. Keep fixture paths and generated local reports outside the public repository and deployment source.
