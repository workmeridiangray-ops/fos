# Third-party calculation code and deployment licensing

The supplied JyotishYamitra runtime is by Shyam Bhat (2022–2023). Its root `vendor/LICENSE` is MIT, but `support/mod_lagna.py` and `support/mod_divisional.py` carry explicit **AGPL-3.0-or-later** headers. Both sets of notices are preserved. Treat those modules as AGPL-covered unless the copyright holder supplies a clear alternative permission; the root MIT notice is not assumed to override file-level headers. The calculation modules in the supplied API ZIP and fixed-v2 ZIP were byte-identical. Only runtime Python modules are included here; example birth records, preloaded reports, personal fixtures and screenshots are excluded.

Local integration changes: fresh process per job; corrected initial indentation and global reset; zero-coordinate and arbitrary historical-offset validation; whole-sign `houses_ex` call; optional fine-period computation and branch filtering; authenticated bounded FastAPI wrapper without shared output files. These modifications are described for attribution and review; no independent accuracy certification is claimed.

The runtime dependency `pyswisseph` 2.10.3.2 is AGPL-3.0. Its licence is in `licenses/pyswisseph-AGPL-3.0.txt`. Swiss Ephemeris has separate dual AGPL / Professional licensing terms in `licenses/swisseph-LICENSE.txt`.

The owner selected the **GNU AGPL version 3 source-release route on 13 November 2026** and authorized publishing the required source. Original application and integration code is AGPL-3.0-only; upstream notices and their original choices are preserved. No paid Professional licence is claimed or required under this chosen route. Complete original/modified application source, build scripts, source links and the exact pyswisseph distribution containing Swiss C source are supplied in release `kundli-agpl-v1`; see the root THIRD_PARTY_NOTICES.md and third_party/sources manifest. Website users and chart-service users receive prominent source links. Publish and verify that release before public activation.

Primary sources:
- https://github.com/astrorigin/pyswisseph
- https://github.com/astrorigin/pyswisseph/blob/master/LICENSE.txt
- https://github.com/aloistr/swisseph/blob/master/LICENSE
- https://www.astro.com/swisseph/swephinfo_e.htm

The MIT upstream notice and these dependency notices travel inside the container. Licence terms, not the package name or a GitHub repository's visibility, govern deployment.
