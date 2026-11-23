# PowerOSC Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / Client                      │
├──────────────────────┬──────────────────────────────────────┤
│   apps/web (3000)    │        apps/erp (3001)                │
│   Next.js SSR/SSG    │        Next.js SSR                    │
│   Customer storefront│        Staff ERP/admin                │
├──────────────────────┴──────────────────────────────────────┤
│                    Supabase (PostgreSQL)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Auth     │ │ Database │ │ Storage  │ │ Edge Funcs   │  │
│  │ (RLS)    │ │ (RLS)    │ │ (images) │ │ (rate limit) │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    External Services                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ OCR Svc  │ │ WhatsApp │ │ Payment  │ │ Analytics    │  │
│  │ (self-   │ │ (templates)│ │ (Razorpay)│ │ (GA/Plausible)│  │
│  │ hosted)  │ │          │ │          │ │              │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
powerosc/
├── apps/
│   ├── web/          # Customer storefront (Next.js)
│   └── erp/          # Staff ERP (Next.js)
├── packages/
│   ├── ui/           # Shared UI components (Drawer, Modal, Pill, Toast)
│   └── business-rules/  # Shared domain logic (ctaFor, etc.)
├── scripts/          # DB utilities, seed scripts, verification
├── services/
│   └── ocr/          # Self-hosted OCR service (Python)
├── supabase/
│   ├── migrations/   # SQL migrations (timestamped)
│   ├── seed/         # Seed data
│   └── tests/        # RLS policy tests
├── tests/            # Playwright E2E tests
└── docs/             # Documentation
```

## Data Flow

### Customer Purchase (Web)
```
Customer → Browse products → Add to cart → Checkout →
  POST /api/checkout → Supabase (place_sale RPC) →
  Stock deducted per branch → Invoice generated →
  WhatsApp confirmation sent
```

### Prescription → Lab Order (ERP)
```
Staff → Create prescription (OCR or manual) →
  Create sale with lens lines →
  place_sale RPC auto-creates lab_order per lens line →
  Lab order carries customer power snapshot →
  Workshop board tracks: To buy → Ordered → Received →
  Edging → Fitting → QC → Ready → Delivered
```

### Multi-Tenancy
```
tenant (company) → branches → staff (with branch access) →
  customers (per tenant) → products (per tenant) →
  sales (per branch) → invoices (per branch)
```

All tables have `tenant_id` column. RLS policies enforce isolation at DB level.

## Key Technologies

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS |
| Backend | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| Monorepo | Turborepo + pnpm |
| Testing | Playwright (E2E), Node test runner (unit) |
| OCR | Self-hosted Python service |
| Payments | Razorpay (India) |
| Notifications | WhatsApp Business API (templates) |

## Database

- **Migrations:** `supabase/migrations/` — timestamped SQL files
- **Seeds:** `supabase/seed/` — initial data
- **RLS:** All tables have Row Level Security policies
- **RPCs:** `place_sale`, `create_credit_note`, `close_gst_period`, etc.

## Deployment

- **Web:** Vercel (or any Node.js host)
- **ERP:** Vercel (or any Node.js host)
- **OCR:** Self-hosted (Docker recommended)
- **Database:** Supabase (managed PostgreSQL)