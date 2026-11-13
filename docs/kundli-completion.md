# Kundli delivery and continuation status — 13 November 2026

## Implemented locally

- Complete responsive kundli module using the supplied modern desktop/mobile references and official marks.
- Authenticated birth/profile workflow, required historical timezone, city resolution/manual correction, no precise unknown-time chart.
- Sixteen real divisional outputs, North fixed-house and South fixed-sign SVGs, division-specific ascendants, dense-cell handling and readable 620px expanded mobile canvas.
- Planet tables, actual-date active dashas/progress and all four levels with private lazy fine branches, all supported Balas with numeric plots/tables, individual and aggregate Ashtakavarga.
- Automatic private chart saving, idempotent requests/retry, profile snapshots, owner-only retrieval/deletion, saved history/search. Ready charts appear in the existing dashboard and My readings.
- Printable report with all sixteen actual charts/tables and complete saved engine output supported by this module. Native Chrome saved a 51-page A4 PDF; extracted text includes all divisions and sections; inspected chart/table and settings pages were readable.
- Isolated, authenticated FastAPI service with one fresh calculation process per request, limits/timeouts and no shared output files. Original false Sookshma flag now skips computation; fine branch filtering limits work and output.
- Migration 006, environment examples, locked Python dependencies, non-root multistage Dockerfile, allowlisted Docker/Cloud Build upload contexts, licensing notices, Cloud Run deployment helper, API/data mapping and setup documentation.

## Verification

| Check | Result |
| --- | --- |
| `npm run check`, `npm run lint`, `npm run build` | Passed |
| `npm run check:cloudflare` | Passed, local Wrangler 4.160.1 / existing compatibility date |
| `npm test` | 26 tests passed, including existing workflows and new ownership/idempotency/schema/layout/DST/cache coverage |
| `npm run test:cloudflare` | 15 tests passed using isolated local D1/R2; no production fixture writes |
| Python `pytest chart-service/tests -q` | 11 passed; two distinct births, repeat/concurrent isolation, zero coordinates/offset, DST/historical validation, fine periods and direct Swiss-library Sun consistency |
| Private reference regression | All 16 divisions rendered in both layouts in memory; ten bodies per division including Asc; no personal output written |
| Browser workflow | Two distinct synthetic profiles calculated, correct city timezone/coordinates, saved/reopened, D60 South expanded, four dasha levels/back, strengths, Ashtakavarga, existing history/dashboard verified |
| Responsive layout | Desktop 1512px and mobile 390px captures; mobile document width 390px, no horizontal page overflow; wide tables scroll within their regions |
| Visual finish review | Ship: enlarged mobile canvas resolved; primary button contrast resolved (5.67:1); proper Current dasha heading resolved. DESIGN.md and design sidecar recorded. |
| Mechanical design detector | One pass, no findings |
| Privacy/package scan | No personal reference JSON, preloaded preview, demo output, Python caches, test database, credentials or ZIP inputs in deployment bundle/source archive |

The direct-library check establishes mapping consistency, not independent astronomical certification. No Swiss ephemeris `.se1` files were supplied; local settings truthfully report Moshier analytical fallback. Full container build has not been run because Docker/Podman was unavailable; Cloud Build must build and test the image after project billing is enabled.

## Hosting decision and publication status

The complete kundli integration and AGPL source are published on GitHub. Release `kundli-agpl-v1` points to commit `4461f7a`; all 112 tracked release files were verified byte-for-byte against the public tag archive (10,975,012 bytes; SHA-256 `839efae18207bceffb92c2fb737a763e6123c92b0b8377dc1aa8153c4d67083e`). The Python service is now live on Render Free; the Cloudflare website connection is pending renewal of the expired Cloudflare CLI login. Existing production remains the prior version at `https://flames-of-shiva.work-meridiangray.workers.dev`, with its earlier deployed code. Do not describe the new calculation service as live. No Google Cloud Run service has been created. The Render HTTPS chart service is `https://flames-of-shiva-chart-api.onrender.com`.

The owner declined Google Cloud billing and selected Render Free (or suitable existing Hostinger hosting) on 13 November 2026. `render.yaml` and `docs/kundli-render.md` now describe the selected free Docker service. No Google Cloud resources will be deployed. The Worker upstream timeout is 120 seconds with a 150-second request reservation to accommodate free-tier wake-up.

Historical Google Cloud CLI sign-in in task-local `work/gcloud-config` was verified on 13 November 2026, and access to the active `meridian-gray` project works. The billing API returned `billingEnabled: false`; this is no longer a prerequisite because the Google Cloud route was declined. The owner selected the free AGPL route on 13 November 2026.

The owner authorized the free AGPLv3 route and publishing the required source on 13 November 2026. Root LICENSE licenses original application/integration code as AGPL-3.0-only. Existing upstream MIT/AGPL notices are preserved, and the exact pyswisseph 2.10.3.2 source distribution containing Swiss C source is included under third_party/sources with its verified SHA-256. Source and licence links are available without authentication on the website and chart service. The versioned source release is kundli-agpl-v1; its tag/archive are now published and verified. The deployment helper checks the published archive against local critical source files and stops if source is missing/different or billing is disabled.

GitHub's connected integration still returns 403 Resource not accessible by integration for repository writes. The owner's normal Chrome session is signed into the repository account, but the available native upload controls could not complete an upload preserving all folder paths. The task-local GitHub CLI device sign-in is now authorized and verified. A Git push dry run confirmed there was no HTTPS Git credential before this authorization. No secret, credential or personal chart was uploaded in those attempts.

No global geocoder credential/contract was supplied; five reference cities resolve locally, with manual confirmed coordinates/IANA zone for other places until the existing geocoder adapter is configured. Compatibility, interpretive predictions, email, payments and voice/video remain separate providers from the preceding website build.

## Replacement archive verified

The subsequently supplied `charnnt-api.zip` contains the previously described Dockerfile and .dockerignore. Its only differences from the earlier chart API ZIP are those two additions and Docker instructions in API_README.md. Engine, API and licence contents are unchanged. The existing hardened integration and container are retained. This attachment supplies no Google login, deployed host, ephemeris data files or licence permissions, so the pending deployment steps below are unchanged. No personal examples from the ZIP were copied into source or deployed.

## Exact next steps

1. Done: published and verified complete source and immutable tag `kundli-agpl-v1`.
2. Done: Render CLI authorized; owner confirmed workspace `mg` (`tea-db3mf0l9fdbs73edo5rg`). Created `flames-of-shiva-chart-api` (`srv-dbrfk356e07s73bi0l60`) on Free compute in Singapore. No Google Cloud resources or paid compute were enabled. Existing Render services remain untouched. The workspace already has several other free services, sharing the free allowance.
3. Done: Docker build and deploy `dep-dbrj3h56e07s73bsj9e0` reached live with commit `bfa77551ed1ef5fdc2739b55b42e3e40e4301125`. Verified health/source/licence HTTP 200, missing-key HTTP 401, authenticated sixteen-division base chart (2.84 seconds), selected fine branch (2.40 seconds, six periods), and consistent D1. A preceding idle-service wake-up health request completed in 13.6 seconds. The initial image was intentionally fail-closed without its key; the second deploy activated the configured credentials.
4. Pending: Cloudflare OAuth credential is expired and cannot refresh. Owner has been given a device authorization link. After approval, set backend-only Worker secrets, apply migration 006 remotely, deploy the tested Worker, and verify signed-in chart save/reopen/print behavior.
5. Record the verified Git commit, Render HTTPS URL/deploy ID and Worker version here.

The current checkout is `outputs/flames-of-shiva` on main, based on `615088d`. Source archive is `outputs/flames-of-shiva-source.zip` (updated after this report). Private supplied files, local test data, screenshots and PDF stay outside the repository under `work/`. Earlier local preview processes used website port 3011 and Python API port 8789. They are not a public host or durable deployment and may no longer be running.
