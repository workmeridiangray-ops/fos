---
name: Flames of Shiva Kundli Workspace
description: Warm white chart workspace with restrained gold and graphite.
colors:
  primary: "#80622f"
  primary-hover: "#6b5026"
  accent: "#84652c"
  canvas: "#f8f8f5"
  surface: "#fffffc"
  ink: "#292c2b"
  muted: "#636661"
  border: "#e5e5dd"
  selected: "#f2eddf"
  period-surface: "#f5f2e8"
typography:
  headline:
    fontFamily: '"DM Sans", sans-serif'
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"DM Sans", sans-serif'
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  label:
    fontFamily: '"DM Sans", sans-serif'
    fontSize: "13px"
  table:
    fontFamily: '"DM Sans", sans-serif'
    fontSize: "12px"
rounded:
  field: "6px"
  button: "7px"
  card: "13px"
  card-mobile: "12px"
spacing:
  control-gap: "8px"
  card-padding: "22px"
  card-padding-mobile: "17px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "white"
    rounded: "{rounded.button}"
    padding: "10px 15px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "#3d4039"
    rounded: "{rounded.button}"
    padding: "10px 15px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
  period-card:
    backgroundColor: "{colors.period-surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
---

# Design System: Flames of Shiva Kundli Workspace

## Overview

**Creative North Star: "The Private Chart Workspace"**

This record applies only to the private kundli workspace, governed by supplied-flames-kundli-2026. Warm white surfaces, graphite text, restrained champagne gold and DM Sans support a dense but calm working chart. The official supplied wordmark and emblem remain the identity assets.

The recorded implementation is public/kundli.css and public/kundli.js, reviewed at desktop and mobile sizes. The existing marketing identity in public/styles.css remains outside this record. Print styles exist, but print/PDF output was not visually verified and is not certified by this design record.

**Key Characteristics:**

- Fine borders and tonal separation rather than card shadows.
- Compact sans-serif hierarchy with chart geometry as the visual anchor.
- Desktop sidebar; mobile stacked cards and persistent bottom navigation.
- Official wordmark and emblem, without replacement logo artwork.

## Colors

Warm neutrals carry the workspace; muted gold distinguishes actions, selected navigation, chart lines and period progress.

### Primary

- **Burnished Gold** (`primary`): filled primary actions with white text. The reviewed pairing has a contrast ratio of approximately 5.67:1.
- **Deep Burnished Gold** (`primary-hover`): primary hover state.
- **Champagne Ink** (`accent`): keyboard focus, active mobile navigation and small accents. Chart strokes use a lighter gold suited to diagram geometry rather than button text.

### Neutral

- **Warm Canvas** (`canvas`): page background.
- **Ivory Surface** (`surface`): cards, sidebar and navigation chrome.
- **Graphite** (`ink`): headings and primary content.
- **Sage Graphite** (`muted`): supporting prose.
- **Limestone Line** (`border`): thin dividers and container edges.
- **Selected Parchment** (`selected`): selected desktop navigation.
- **Period Parchment** (`period-surface`): current-period card.

**The Scoped Palette Rule.** These tokens describe the kundli workspace; the marketing stylesheet retains its own palette and typography.

## Typography

**Display and Body Font:** DM Sans, with sans-serif fallback.

The hierarchy stays compact and readable beside detailed diagrams and tables. It uses medium and semibold weights rather than a contrasting display family.

- **Headline:** page heading; becomes (28px) at and below the intermediate desktop breakpoint.
- **Title:** standard section heading; mobile card headings use (17px).
- **Period value:** (24px), subordinate to the “Current dasha” section heading in document structure; its category suffix is (16px), regular weight.
- **Body and controls:** compact (12–14px) according to context. Supporting paragraphs use (1.65) line height.
- **Metadata:** (10–12px), with muted color. These are labels attached to data, not a display style.
- **Tables:** use the table role and tabular numerals for numeric comparisons.

## Layout

The desktop shell uses a fixed-width sidebar (226px) and a flexible workspace. The content container caps at (1500px), with desktop horizontal padding (38px). The overview is a two-column chart and summary composition with a (22px) gap; standard cards use the frontmatter padding token.

At (1180px) and below, the sidebar narrows to (190px), content gutters reduce and card padding becomes (18px). At (900px) and below, the sidebar gives way to a compact wordmark header and fixed bottom navigation, with (100px) content bottom padding. At (650px) and below, content gutters are (18px), cards stack, the three summary cards precede the chart, and current dasha follows it. Tabs and wide tables scroll horizontally.

The overview chart scales within its card, retaining a square drawing. The expanded dialog provides a separate scrollable chart viewport with a (620px) drawing width, including on mobile. The dialog itself scrolls and stays within the viewport; explanatory copy tells the user to pan the enlarged drawing.

## Elevation & Depth

Workspace cards have no box shadows. Fine borders, warm tonal changes and whitespace separate adjacent regions. The modal alone adds a dark translucent backdrop (`#22291bb3`) to distinguish the active layer; its shell remains a light bordered surface.

**The Border Before Shadow Rule.** Use the existing border and tonal vocabulary for workspace containers rather than adding raised card shadows.

## Shapes

Cards have gently rounded corners; mobile cards use their smaller radius token. Buttons are compact rounded rectangles, fields are slightly tighter, and avatars are circular. Segmented chart controls share a clipped rounded enclosure. Chart geometry remains precise SVG linework, independent of the rounded UI containers around it.

## Components

### Buttons

Primary actions use Burnished Gold and white; secondary actions use an ivory fill and a thin neutral border. Standard controls have a minimum height of (42px), reduced to (38px) for mobile heading actions. Secondary hover warms the fill and border; primary hover darkens its fill. Quiet actions remove the border and fill. Disabled actions use reduced opacity and a waiting cursor.

Every focusable workspace element receives a visible gold outline (2px) with an offset (4px). There is no decorative transition system in the workspace.

### Cards / Containers

Ivory cards use a single fine border and the card radius/padding tokens. The current-dasha card uses Period Parchment, a slightly warmer border and a thin progress bar. Its real section heading stays above the larger period value.

### Inputs / Fields

Labeled fields have an almost-white fill, fine border, field radius and a minimum height of (44px). Selects use the same restrained form language at a slightly smaller minimum height (39px). Form assistance remains adjacent to its control. Warm notice boxes and pale terracotta error boxes distinguish calculation and validation feedback.

### Navigation

Desktop links combine small SVG icons with sentence-case labels. The current page has a pale parchment background and stronger gold text. At the mobile navigation breakpoint, four destinations use vertically stacked icons and labels in the fixed bottom bar. Tabs use an underline and stronger text for the current section, and remain horizontally scrollable.

### Status tags

Small rectangular pale-green tags identify a current dasha period; retrograde markers use a pale-gold background next to planetary names. Their meaning is also written in text.

### Chart and data table

North and South Indian charts share the same chart controls, legends and expandable accessible house summary. Placements, signs and retrograde states are rendered from calculated data. The enlarged dialog prioritizes drawing legibility through scrolling. Tables use pale header rows, fine horizontal dividers, compact labels and horizontally scrollable wrappers.

### Loading

A small bordered ring spins while work is pending (0.9s, linear). Reduced-motion preferences disable the animation while keeping the loading text visible.

## Do's and Don'ts

### Do:

- Do keep this system scoped to the kundli workspace.
- Do use the supplied official wordmark and emblem assets.
- Do preserve calculated placements, legends and accessible house summaries.
- Do keep the expanded mobile chart scrollable at its readable fixed drawing width.
- Do retain visible keyboard focus and semantic headings.

### Don't:

- Don't apply this record as a marketing-site redesign.
- Don't shrink the expanded chart to fit a phone at the expense of placement legibility.
- Don't substitute illustrative mockup values for calculated data.
- Don't describe the print/PDF presentation as reviewed until it has been rendered and checked.
