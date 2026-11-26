# PowerOSC — Design & Developer Experience Improvement Report

Synthesized from `/design-consultation` and `/devex-review` skill passes. No browser run; findings are from codebase inspection.

## 1. Design System Gaps

### No DESIGN.md anywhere
Neither `apps/web` nor `apps/erp` nor the repo root has a `DESIGN.md`. Every component invents its own tokens. **Fix:** Run `/design-consultation` to create one at repo root, shared by both apps.

### Overused fonts (anti-slop violations)
- `apps/web/tailwind.config.ts`: `sans: Inter`, `display: Playfair Display` — both on the overused-as-display list.
- `apps/erp/tailwind.config.ts`: same Inter + `--font-display`.
- `globals.css` declares `--font-inter: Arial, Helvetica, sans-serif` and `--font-playfair: Georgia` as *fallbacks*, so when fonts fail to load the page silently degrades to system fonts — but the Tailwind config names them as if loaded. Mismatch.
- **Fix:** Pick verified faces per the procedure (audience world → shortlist 3 → exclusions → verify on Google Fonts/Fontshare). For an optical retail brand, consider a grotesk with character (e.g., General Sans, Cabinet Grotesk) for UI and an editorial serif only where the brief calls for it.

### Duplicated, divergent tailwind configs
`apps/web` and `apps/erp` each define their own `navy`/`gold`/`canvas` tokens with slightly different hex values (`#F9FAFB` vs `#F6F8FB`). Drift is already happening. **Fix:** Move shared tokens into `packages/ui/tailwind-preset` and extend from it.

### "Luxury template" aesthetic
navy-900 + gold-500 + cream canvas + Playfair display is the textbook "premium optical" template. Per anti-convergence, this is fine only if the brief asked for it. The README/metadata suggests a local Chennai optical brand — the design should reflect that place, not a generic luxury template.
- **Risk to take:** one deliberate departure. E.g., a warm off-white paper ground with a single saturated accent derived from the brand's actual signage, instead of navy/gold.

### Component-level
- `.card` is defined twice in `globals.css` (lines 9 and 27) with conflicting shadows — last wins, but the duplication is a smell.
- `.btn-gold` / `.btn-navy` / `.btn-outline` are global utility classes instead of Tailwind components — inconsistent with the rest of the codebase which uses Tailwind classes.
- `content-visibility: auto` on all `img` can cause layout shift on scroll; needs `contain-intrinsic-size`.

## 2. Developer Experience Gaps

### Setup friction (TTHW)
README requires running 6+ SQL files in order, editing seed files, and approving yourself via commented SQL. TTHW is well over 10 minutes (Red Flag tier). **Fix:** Provide a single `pnpm db:setup` script that runs migrations + seeds in order, plus a `pnpm db:reset`.

### No `.env.example` discoverability
README references `apps/erp/.env.example` but there's no top-level env documentation. Web app env is undocumented.

### Monorepo DX
- `turbo.json` present but no `dev:web` / `dev:erp` shortcuts — `pnpm dev` runs everything.
- `pnpm test:unit` only runs `apps/erp/tests/*.test.mjs`; web has no unit tests.
- E2E tests exist (good) but `test-results/` and `playwright-report/` are committed (bloat).

### force-dynamic everywhere
`apps/web/src/app/layout.tsx` sets `export const dynamic = "force-dynamic"` on the root layout, opting the entire site out of static generation. This kills TTFB and caching. **Fix:** Make only the CMS-driven pages dynamic; let marketing pages be static with ISR.

### Error handling
- `apps/web/src/app/error.tsx` exists (good) but no `not-found.tsx` customization beyond default.
- No `loading.tsx` at root (only on some routes) — inconsistent skeleton states.
- ERP has `error.tsx` and `not-found.tsx` (good).

### TypeScript
- `apps/web/tsconfig.tsbuildinfo` is committed (should be gitignored).
- No shared types package — `packages/` only has `ui` and `business-rules`.

### Linting/formatting
- Prettier is a devDependency but no `.prettierrc` visible; no lint script at root level beyond turbo.

## 3. Recommended Priority Order

1. **Create DESIGN.md** (design-consultation) — fixes font, color, spacing drift across both apps.
2. **Extract shared Tailwind preset** — stops token drift.
3. **Fix force-dynamic** — biggest perf win for web.
4. **Add `pnpm db:setup`** — cuts TTHW from >10 min to <3 min.
5. **Replace Inter/Playfair** with verified faces.
6. **Gitignore `tsbuildinfo`, `test-results/`, `playwright-report/`**.
7. **Add root-level `dev:web` / `dev:erp` scripts**.

## 4. What's Already Good

- Comprehensive E2E test suite (Playwright, erp + web projects).
- Supabase RLS + multi-tenancy model.
- Print routes for invoices/receipts (A5, labels).
- `packages/business-rules` for shared domain logic.
- Settings audit history, GST ledger, credit notes — strong domain modeling.
- `content-visibility` and reduced-motion support in CSS.

## 5. Suggested Next Commands

- `/design-consultation` → create `DESIGN.md` at repo root.
- `/plan-eng-review` → review the force-dynamic + db:setup changes before implementing.
- `/qa` → run after fixes to verify no regressions.
- `/ship` → open PR.

---

*Generated by combining design-consultation + devex-review skill analysis. No browser or live testing performed.*