# Third-party notices and corresponding source

Original Flames of Shiva application and integration code is released under GNU AGPL version 3 only, by the owner's authorization on 13 November 2026. The full licence is in LICENSE. The versioned release is `kundli-agpl-v1`.

## JyotishYamitra and Swiss Ephemeris

- Supplied JyotishYamitra runtime: copyright Shyam Bhat, 2022–2023. `chart-service/vendor/LICENSE` preserves the supplied root MIT notice. `support/mod_lagna.py` and `support/mod_divisional.py` retain their explicit AGPL-3.0-or-later headers; this combined release uses AGPL version 3. The source in `chart-service/vendor` is the complete runtime used here, with the integration modifications described in `chart-service/NOTICE.md`. Personal examples and reference reports are excluded; they are not needed to build or run the software.
- pyswisseph 2.10.3.2: AGPL-3.0. Exact upstream source distribution, including the embedded Swiss Ephemeris C source and its build scripts, is in `third_party/sources`. Its original PyPI URL and verified SHA-256 are recorded in `third_party/sources/manifest.json`. Dependency licence copies are in `chart-service/licenses`. The unmodified C and wrapper source needed to compile the binding is available in the same source release as the application.
- Swiss Ephemeris: copyright Astrodienst AG. Its dual AGPL/Professional licence notice is preserved in `chart-service/licenses/swisseph-LICENSE.txt`. This release chooses its AGPL route, not its paid Professional route. No external Swiss ephemeris data files are supplied or required for the tested Moshier analytical fallback.

## Other runtime and build dependencies

`package-lock.json` records exact Node dependency versions, registry source archive URLs and integrity hashes. `chart-service/requirements.txt` records exact Python dependency versions; upstream releases are available from https://pypi.org/ and their declared project source locations. `npm ci` and the documented Python/Docker build reconstruct these unmodified dependencies. System libraries, Python/Node runtimes and general-purpose build tools retain their own licences. See each exact package distribution's copyright, licence and NOTICE files; this licence does not erase them.

Direct Node dependencies installed for this release:

| Package | Version | Declared licence |
| --- | --- | --- |
| @photostructure/tz-lookup | 11.8.0 | CC0-1.0 |
| astronomy-engine | 2.1.19 | MIT |
| fast-png | 8.0.0 | MIT |
| geo-tz | 8.1.11 | MIT |
| jpeg-js | 0.4.4 | BSD-3-Clause |
| luxon | 3.7.2 | MIT |
| sharp | 0.35.5 | Apache-2.0 |
| @cloudflare/workers-types | 5.20261110.1 | MIT OR Apache-2.0 |
| @types/node | 26.6.6 | MIT |
| eslint | 10.14.0 | MIT |
| globals | 17.14.0 | MIT |
| prettier | 3.10.0 | MIT |
| typescript | 7.0.2 | Apache-2.0 |
| wrangler | 4.160.1 | MIT OR Apache-2.0 |

## Fonts and branding

DM Sans and Playfair Display retain their SIL Open Font License notices in `public/assets/DM-Sans-OFL.txt` and `public/assets/Playfair-Display-OFL.txt`. These notices govern those font files.

The supplied Flames of Shiva wordmark and emblem are project branding. The code licence does not grant rights to use Flames of Shiva names, trademarks or branding to imply endorsement. Asset copyrights and separately applicable licences are preserved.

## Source availability and builds

This repository contains the complete original application, modified calculation runtime, migrations, locked dependencies, local setup instructions, Dockerfiles and deployment scripts for this release. The source offer is linked from the website footer, every kundli workspace screen, and the chart service's public `/source` route. The service also provides `/license` and a source Link response header.

Source: https://github.com/workmeridiangray-ops/fos/tree/kundli-agpl-v1

Download: https://github.com/workmeridiangray-ops/fos/archive/refs/tags/kundli-agpl-v1.tar.gz

The tag must exist and match the code being deployed before service activation. For later releases, create a new versioned tag and update source links, rather than moving this tag. Customer records, credentials, local test databases and the supplied personal fixture are excluded from the public release.
