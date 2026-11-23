---
# gstack: design-md-format=spec
name: PowerOSC / Power Eyes Opticals
description: A warm, place-rooted optical retail brand — Chennai heritage, modern utility
colors:
  primary: "#0A2240"
  on-primary: "#FFFFFF"
  surface: "#F9FAFB"
  text: "#0F172A"
  text-muted: "#64748B"
  accent: "#C48A3F"
  success: "#16A34A"
  warning: "#D97706"
  error: "#DC2626"
typography:
  display:
    fontFamily: General Sans
    fontWeight: 600
    fontSize: clamp(2rem, 4vw, 3.5rem)
    letterSpacing: -0.02em
  body:
    fontFamily: General Sans
    fontSize: 1rem
    lineHeight: 1.5
  label:
    fontFamily: General Sans
    fontSize: 0.75rem
    letterSpacing: 0.04em
  mono:
    fontFamily: JetBrains Mono
    fontFeature: tnum
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "#0E2B4A"
  input:
    borderColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  nav-link:
    textColor: "{colors.text}"
---

# Power Eyes Opticals — Design System

## Overview

**Creative North Star:** A warm, place-rooted optical brand that feels like a trusted neighbourhood optician modernised — not a luxury template.
**Product context:** Optical retail ERP + consumer e-commerce for Power Eyes Opticals, Mogappair, Chennai. Two apps: `apps/erp` (staff) and `apps/web` (customers).
**Mode per surface:** Persuade (web marketing), Operate (ERP + checkout), Read (help/FAQ/blog)
**Key characteristics:** Trustworthy, warm, locally grounded, utility-first.

## Colors

**Strategy:** Restrained — one accent (gold) + neutrals, color is rare and meaningful.
**Light or dark:** Light. The use scene is bright retail + mobile browsing; dark mode is not needed for v1.

Navy is the primary (trust, depth). Gold is the accent (warmth, calls to action). Canvas is a near-white warm grey. Semantic colors (success/warning/error) are standard Tailwind greens/ambers/reds for familiarity.

## Typography

Display and body both use **General Sans** (Fontshare, free). This replaces the previous Inter + Playfair Display pairing, which was on the overused-fonts list and read as a generic luxury template.

- **Display:** General Sans 600, tight tracking (-0.02em). Used for hero headlines and section titles only.
- **Body:** General Sans 400, 1rem, 1.5 line-height. Used everywhere else.
- **Label:** General Sans 500, 0.75rem, tracked 0.04em. Used for form labels, badges, metadata.
- **Mono:** JetBrains Mono with tabular figures. Used for prices, SKUs, invoice numbers, prescription values.

**Justified exception:** Inter was previously used as body. General Sans is similar in proportions but has more character, avoiding the "default SaaS" look.

## Layout

- Max content width: 1280px (web), full-width with sidebar (ERP).
- Grid: 12-column on desktop, single column on mobile.
- Spacing scale: 4/8/16/24/32/48px (xs/sm/md/lg/xl/2xl).
- Section padding: `px-4 py-14 sm:px-6 lg:px-8` (matches existing `.section-pad`).

## Elevation & Depth

Shadows are subtle and offset (not zero-offset glows):
- Card: `0 1px 2px rgba(10,34,64,0.04)` + hover `0 4px 12px rgba(10,34,64,0.08)`.
- Modal/drawer: `0 8px 32px rgba(10,34,64,0.12)`.
- No glowing edges, no radial gradient halos.

## Shapes

- Radius hierarchy: sm (4px inputs/buttons), md (8px cards), lg (12px modals/drawers), full (pills for CTAs).
- Nested inner radius = outer radius − gap.

## Components

- **Buttons:** pill-shaped CTAs (full radius) for primary actions; rounded-md for secondary. Gold for primary CTA, navy for secondary, outline for tertiary.
- **Cards:** white surface, subtle border, rounded-lg, hover shadow. No nested cards.
- **Inputs:** rounded-sm, muted border, gold focus ring.
- **Nav:** navy background, white text, gold active indicator.

## Do's and Don'ts

- Do: Use General Sans for all text; use JetBrains Mono for numbers/prices/SKUs.
- Do: Keep the gold accent rare — only on primary CTAs and active states.
- Do: Use real product photos, never stock photos or CSS-shape illustrations.
- Don't: Use Inter, Roboto, Arial, or Playfair Display (overused).
- Don't: Use purple/violet/indigo gradients (AI slop).
- Don't: Use the 3-column feature grid with icon-in-circle.
- Don't: Center everything — left-align body text, center only hero headlines.
- Don't: Use decorative blobs, floating circles, or wavy dividers.
- Don't: Use `system-ui` as primary font.

## Motion

- **Approach:** minimal-functional — only transitions that aid comprehension.
- **Easing:** enter(ease-out) exit(ease-out) move(ease-in-out).
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms) long(400-700ms).
- **The one authored moment:** Product card hover — subtle lift + shadow increase (150ms ease-out).

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-11-22 | Initial design system created | Replaced Inter+Playfair with General Sans; kept navy/gold palette but documented as restrained strategy |