## Design System
Read DESIGN.md before visual or UI work: it defines the fonts, colors, spacing, and
aesthetic direction. Ask the user before departing from it. When reviewing or QA-ing
UI, flag code that doesn't match DESIGN.md.

## Development
- `pnpm dev` — runs all apps via Turborepo
- `pnpm dev:web` — runs only the web storefront (port 3000)
- `pnpm dev:erp` — runs only the ERP (port 3001)
- `pnpm verify:migrations` — verifies migration files are consistent
- `pnpm test:unit` — runs unit tests
- `pnpm test:e2e` — runs Playwright E2E tests