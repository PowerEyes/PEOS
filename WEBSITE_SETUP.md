# PowerOS Website — Setup Guide

## 1. Run the migration
In Supabase SQL Editor run `supabase/migrations/0009_website.sql`.
Then seed: `supabase/seed/seed_finance.sql` (already done if on Build 6+).

## 2. Add environment variables
Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same as the ERP
- Rx OCR uses the internal service configured on the ERP server; do not expose the OCR service publicly or add hosted OCR API tokens to the storefront.
- `NEXT_PUBLIC_WEB_URL` — your production website URL (used in Website Controller link)

## 3. Run
```bash
pnpm install
pnpm dev          # runs ERP on :3001, Website on :3000
```

## 4. First-time content
- In PowerOS ERP → Website Controller → Homepage, the seed SQL created
  3 collection banners and a hero slide. Edit their titles and CTAs.
- In Inventory, turn on "Visible on website", "Featured" or "Bestseller"
  for the products you want on the homepage and category pages.

## 5. Production (Vercel)
- Add `apps/web` as a second Vercel project in the same repo.
- Set Root Directory = `apps/web`.
- Add the same env vars.
- Update Supabase Auth → Redirect URLs with your website domain.

## 6. Settings authority
Storefront and Website Studio values are settings-catalog keys, not hardcoded
page values. Write authority is resolved per key by
`setting_definitions.write_role` / `write_permission`: owner/admin can edit
operational website keys, while `write_role = 'owner'` keys (for example tax
identity, numbering prefixes and module toggles) remain owner-only. There is no
literal `manager` role; use `admin` for company manager and `branch_manager`
for branch manager. Secrets belong only in the deployment secret manager or
`integration_secrets`; never place a service-role or webhook secret in
`NEXT_PUBLIC_*`.

## Architecture
Public website reads from Supabase directly (anon key, RLS policies
added in 0009_website.sql). Only `visible_on_website = true` products
appear. Changing a product in PowerOS → visible immediately on the site
(Next.js revalidates every 60 seconds or on demand).

## Instant updates (optional)
To push changes in under 1 second, add a Supabase Database Webhook:
  URL: https://your-website.vercel.app/api/revalidate
  Secret: any random string
  Events: products INSERT, UPDATE

Then add `apps/web/src/app/api/revalidate/route.ts`:
```ts
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
export async function POST(req: Request) {
  if (req.headers.get("x-supabase-secret") !== process.env.REVALIDATE_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  revalidatePath("/"); revalidatePath("/eyeglasses"); revalidatePath("/sunglasses");
  return NextResponse.json({ revalidated: true });
}
```
