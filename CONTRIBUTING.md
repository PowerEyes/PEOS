# Contributing to PowerOSC

## Getting Started

1. Clone the repo: `git clone https://github.com/your-org/powerosc.git`
2. Install dependencies: `pnpm install`
3. Set up environment: copy `apps/erp/.env.example` and `apps/web/.env.example` to `.env.local`
4. Run migrations: see `README.md` for SQL setup steps
5. Start dev: `pnpm dev` (or `pnpm dev:web` / `pnpm dev:erp`)

## Code Style

- **TypeScript** strict mode in both apps
- **Tailwind CSS** for styling — use design tokens from `DESIGN.md`
- **Server actions** for ERP mutations (not REST endpoints)
- **Supabase RLS** for data access — never bypass RLS in application code
- Format with Prettier: `pnpm prettier --write .`

## Testing

- **Unit tests:** `pnpm test:unit` (ERP only currently)
- **E2E tests:** `pnpm test:e2e` (Playwright, erp + web projects)
- **Typecheck:** `pnpm typecheck`
- **Lint:** `pnpm lint`
- **Migration verify:** `pnpm verify:migrations`

All PRs must pass typecheck + lint before merge.

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm typecheck && pnpm lint && pnpm test:unit`
4. Open a PR using the template
5. Request review from at least one maintainer

## Commit Messages

Use conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `refactor:` code refactor
- `test:` adding tests
- `chore:` maintenance

## Database Migrations

- Add new migrations in `supabase/migrations/` with timestamp prefix
- Run `pnpm verify:migrations` before committing
- Document rollback strategy in migration comments
- Never modify existing migration files — create new ones

## Design System

Read `DESIGN.md` before any UI work. Use the defined color tokens, typography, and spacing scale. Ask before departing from the design system.