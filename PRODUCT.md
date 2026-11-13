# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Customers create private birth profiles, calculate and save kundli reports, explore their chart data and consult readers. Approved readers and administrators retain the existing consultation and operational workflows.

## Product Purpose

Flames of Shiva combines astrology and spiritual reading workflows. This integration turns actual JyotishYamitra output into a readable, private chart workspace, with birth details, sixteen divisions, planetary positions, nested dashas, strengths, Ashtakavarga and printable reports.

## Capabilities and Constraints

The existing vanilla JavaScript frontend and shared Node/Cloudflare backend, authentication, database and role permissions must be preserved. Python calculations run in a separate isolated service, not inside Cloudflare Workers. Google Cloud Run in the meridian-gray project is the intended Python host; deployment and login are still pending. Unknown birth time cannot produce a precise ascendant or time-sensitive kundli. Private reference chart data is local development material and must never ship publicly.

## Brand Commitments

Preserve the official supplied Flames of Shiva wordmark and emblem. The user-provided modern desktop and mobile dashboard images govern the kundli module; other website surfaces retain their existing identity. Values and invented people in design mockups are illustrative.

## Product Principles

- Render calculated values, with their assumptions and limitations.
- Keep each person's profiles and reports private and owned by their account.
- Make all supported engine output navigable and readable on desktop and mobile.
- Preserve working account, reader, shop and consultation functionality.
- Describe missing calculations or hosting honestly.

## Accessibility & Inclusion

Use labeled forms, keyboard navigation, visible focus, accessible chart summaries and readable contrast. Mobile web remains a website, with stacked cards and bottom navigation.
