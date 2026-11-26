# PowerOS Phase 1 — Design System & Shared Components

## Status
Phase 1 foundational implementation started. Shared UI primitives and application chrome have been updated. Page-by-page adoption remains the next work item; this is not a claim that all 160 routes are redesigned.

## Standards
- Consistent page identity: meaningful page title, description, context and actions.
- Responsive first: mobile, tablet and desktop layouts; controls remain touch-accessible.
- Accessibility: visible focus, semantic landmarks, skip-to-content link, ARIA labels/states, reduced-motion support and keyboard operability.
- Reliability: loading, empty, error/retry, permission, offline, stale and save states should be explicit where data/actions are involved.
- Visual consistency: shared spacing, typography, surface, border, focus, button, badge and table styles.
- Avoid fake business data. Components must receive real data or explicitly identified examples.

## Shared UI primitives added
`packages/ui/src/design-system.tsx`:
- `Button` — primary, secondary, ghost, danger, success variants; 3 sizes.
- `Card` — reusable surface with optional title, description, actions and padding variants.
- `PageHeader` — page title, description, eyebrow, actions and metadata.
- `StatusBadge` — neutral/info/success/warning/danger/purple semantic tones.
- `LoadingState` — accessible loading status.
- `EmptyState` — empty content guidance and optional action.
- `ErrorState` — error messaging and optional retry.
- `Notice` — info/success/warning/danger callout.
- `Field` — label, required marker, hint and error wrapper.

These are exported from `packages/ui/src/index.ts` for reuse by ERP and web apps.

## ERP shell updates
- Added human-readable route labels for page title and breadcrumbs.
- Added skip-to-main-content link.
- Added `main-content` landmark and responsive content container.
- Mobile navigation button now declares controls and expanded state.
- Navigation focus visibility strengthened.
- Page content spacing now scales across mobile/tablet/desktop.

## Global styles
- Added consistent design tokens for canvas, surface, border, text, muted, primary and focus colors.
- Standardized field, button, card and table wrapper styles in ERP.
- Added consistent field styles and responsive section spacing to storefront/portal stylesheet.
- Preserved reduced-motion support and print rules.

## Verification performed
- Existing ERP test suite: **52/52 passing**.
- TypeScript/TSX syntax transpilation: **4/4 touched source/config files passing**.
- Full typecheck and framework build: not run (workspace dependencies/tooling are not installed in the provided environment).
- Visual/browser/accessibility audit: not run; requires installed app and browser test environment.

## Next
1. Build/adopt shared components in the high-use ERP pages.
2. Create page-specific layout patterns (list/detail/workflow/dashboard/form/report).
3. Audit responsive layouts with actual browser viewports.
4. Add accessibility and interaction tests for shared components.
5. Continue module-by-module acceptance checklist; do not mark route complete based on appearance alone.
