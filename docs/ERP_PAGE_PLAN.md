# PowerOS ERP — Page-by-Page Product Plan

> What an optical shop owner gets when they buy PowerOS: every page, what each of the
> 11 staff roles can see, and how navigation works — mapped 1:1 to shipped code.
>
> Source of truth: `apps/erp` (82 routes: 50 tenant + 19 platform + 11 print + 2 auth),
> `src/lib/rbac.ts` (route rules + 13 permissions), `src/components/Shell.tsx` (sidebar).

---

## 1. The workspace the owner buys

### 1.1 First-run journey

| Step | Page | What happens |
|---|---|---|
| 1 | `/login` | Email/password sign-in. Already signed in → bounced to `/`. |
| 2 | `/onboarding` | "Set up your organisation" — org name + first branch name + branch code. User becomes **Owner**. |
| 3 | `/` | Dashboard shows the amber **go-live banner** (owner only, until setup completes). |
| 4 | `/setup` | 7-step wizard: **Business & branches → Tax & invoicing → Catalogue → Team access → Website contact → Sales rules → Review & go live** (plus CSV import panel and Go-Live panel). Steps show ✓ Ready / ○ Needs attention. |
| 5 | Go-live | Owner flips `go_live` in org settings; banner disappears. |

### 1.2 Module-by-module page inventory (50 tenant routes)

#### A. Dashboard — `/`

One role-aware dashboard for every role (no per-role route sprawl):

- Greeting + **branch scope** + long date.
- **5 KPI cards**: Total customers · New this month · Sales today · Low stock (→ `/inventory?stock=low`) · Active repairs (→ `/repairs`).
- **Sales, last 14 days** bar chart (hover shows daily amount + orders).
- **Branch comparison table** (owner/admin/manager): Today / This month / Collected / Lab queue / Repairs / Low stock per branch + totals row. Clicking a row **focuses the whole app on that branch**.
- **4 quick-action tiles** — different per role (see §3.4), auto-filtered so a tile the role can't open never appears.
- **Today's appointments** list (→ `/appointments`).
- Go-live setup banner (owner) and `?denied=1` notice when a URL was blocked.

#### B. Front desk

| Route | Page | Internal navigation |
|---|---|---|
| `/customers` | Customer directory | Search; click a row → **drawer** with tabs **Overview · Profile · Prescriptions · Orders · Repairs · Notes**; `?new=1` opens the new-customer form. |
| `/prescriptions` | Eye-exam records | List + new-exam flow: **Start → Scan (OCR) → Values**; source = manual / OCR / external; ties to a customer. |
| `/appointments` | Appointment book | **Day view** with date picker; status counts (confirmed / completed / pending); booking drawer (customer search → type · date · time · duration · optometrist · notes); edit drawer; `?new=1`, eye-exam shortcut. |

#### C. Sales / POS

| Route | Page | Internal navigation |
|---|---|---|
| `/sales` | POS & order book | Mode tabs **Order / Quotation**; POS drawer (cart, customer, payment, GST supply type **intrastate/interstate**); order list with search + detail drawer; `?new=1`. |
| `/print/sale/[id]`, `/print/receipt/[id]`, `/print/rx/[id]`, `/print/credit-note/[id]` | Printed documents | Opened as print windows from the corresponding action. |

#### D. Workshop, lab & repairs

| Route | Page | Internal navigation |
|---|---|---|
| `/workshop` | Workshop & lab jobs | Tabs **Board / Buy**; filters: technician · priority (normal/urgent) · due date; job drawer; buying list (`/print/buying-list`, manager-only). |
| `/repairs` | Repair tracker | Status chips **All · Pending · In Progress · Ready · Delivered · Cancelled** with counts + search; drawer with item details, photos, WhatsApp updates (templates `repair_received` / `repair_in_progress` / `repair_ready`). |
| `/print/lab/[id]`, `/print/repair/[id]`, `/print/appointment/[id]`, `/print/labels`, `/print/locations` | Printouts | Lab job card, repair receipt, appointment slip, shelf labels, branch location list. |

#### E. Inventory & supply chain

| Route | Page | Access |
|---|---|---|
| `/inventory` | Products & stock | List ↔ **display-section view** (Window · Counter · Wall · Shelf · Back store); product drawer tabs **Basic · Details · Pricing · Stock …**; `?new=1`, `?stock=low`. |
| `/transfers` | Branch stock transfers | Create/track; links to approvals. |
| `/transfers/approvals` | Transfer approvals | Action needs `transfers_approve`. |
| `/purchases` | Purchase orders | Create/receive POs; needs `purchases_manage`. |
| `/purchase-invoices` | Supplier invoices | Tabs **Invoices · Suppliers**; needs `finance_view`. |
| `/stock-audits` | Cycle counts | Count & approve; needs `stock_audit`. |

#### F. Orders & communication

| Route | Page | Access |
|---|---|---|
| `/inbox` | Inbox & alerts | Attention boxes: **Low stock** (with cross-branch "transfer" hint), **Payment mismatches**, **Transfers awaiting action**, **Unpaid online orders > 1 day** — each links to the owning module. |
| `/web-orders` | Website order fulfilment | Needs `web_orders`. |
| `/crm` | CRM automation | Manager-tier + `crm_manage`. |

#### G. Finance & GST

| Route | Page | Internal navigation |
|---|---|---|
| `/finance` | Finance hub | Tabs **Dashboard · Cashbook · GST Ledger · Expenses · Day Closing · Credit Notes · Reports** (deep-linkable: `/finance?tab=Cashbook`). Sub-actions need `expenses`, `day_closing`, `credit_notes.issue`. |
| `/finance/reports` | Sales report | Date-range sales reporting. |
| `/finance/gstr1` | GSTR-1 export | GST return export. |
| `/accountant-export` | Accountant export | One month of finance records as a ZIP of CSVs. |
| `/reports` | *(redirects to `/finance`)* | Target of the manager's "Branch reports" tile. |
| `/reports/company-overview` | Company report | Standalone report page (see gap G4). |
| `/reports/branch-comparison` | Branch comparison report | Standalone report page (see gap G4). |
| `/print/subscription-invoice/[id]` | Tax invoice | Subscription billing invoice printout. |

#### H. Team & permissions

| Route | Page | Access |
|---|---|---|
| `/staff` | **Team hub** (admin) | Staff directory + **Invite staff**; embedded: **branch-access matrix**, **role-permissions matrix** (the live editor — "Staff → Permissions"), **assignments**; role explainer cards (Owner / Admin / Branch manager / Specialists / Staff). |
| `/staff/[id]/transfer` | Transfer employee | Move a staff member between branches (see gap G2). |
| `/staff/attendance` | Attendance register | See gap G2. |
| `/staff/leave` | Leave register | See gap G2. |
| `/settings/roles` | Roles & Permissions overview | Read-only grant overview, links back to `/staff` (see gap G3). |

#### I. Branches (multi-branch)

| Route | Page |
|---|---|
| `/branches` | Branch cards + **+ New Branch** (see gap G1 — no inbound link). |
| `/branches/new` | Create branch (redirects to `/branches` on save). |
| `/branches/[id]` | Branch profile; buttons → **Performance · Finance · Cashbook · Compare branches**. |
| `/branches/[id]/performance` | Branch KPIs vs others. |
| `/branches/[id]/finance` | Branch-scoped finance. |
| `/branches/[id]/cashbook` | Branch-scoped cashbook. |

> Branch **scope** (who sees which branch) is set from the header switcher and the
> dashboard comparison table; every list page filters to the scope automatically.

#### J. Website & storefront

| Route | Page | Access |
|---|---|---|
| `/website` | **Website Studio** | Theme/content for the customer-facing site; button **Pages & Guides** → `/website/pages`. |
| `/website/pages` | Pages & guides | Manage site pages. |
| `/website/coupons` | Coupons | Promo codes. |
| `/settings/domains` | **Store domains** | Custom domain per storefront (admin). |

> The customer-facing storefront itself is the separate `apps/web` app (public site,
> reviews, document links) — not part of the ERP shell.

#### K. Company profile

| Route | Page |
|---|---|
| `/company` | **Hub**: identity strip + 10 topic cards — Profile · Legal · GST · Documents · Branding · Contact · Address · Hours · Preferences · Policies (each card shows ✓ ready / ○ needs attention). |
| `/company/docs` | **Real editor**: licences, registrations & certificates. |
| `/company/branding` | **Real editor**: logo & brand colours. |
| `/company/policies` | **Real editor**: returns, warranty & privacy text. |
| `/company/[section]` | Dispatcher — profile/legal/address/hours/preferences → `/settings?section=business`, GST → `?section=tax`, contact → `?section=website`. |

#### L. Settings — `/settings` (admin)

Section rail (10 sections): **Business & Branches · Tax & Invoicing · Sales & Lab · Loyalty · Website & Contact · Analytics & Integrations · Code Prefixes (CUS-, REP-, ORD-…) · Message Templates · Team & Access · Change History**.

#### M. Subscription & support

| Route | Page | Contents |
|---|---|---|
| `/subscription` | Billing home | Status chip (active / trialing / grace / past_due / payment_pending / payment_failed / expired / suspended / cancelled), plan cards + **Razorpay checkout**, usage bars (used / max), invoices, **change plan**, cancel. |
| `/subscription/usage` | Entitlement usage | Per-limit usage detail (`my_org_usage`). |
| `/subscription/invoices` | Invoice history | Past invoices → print. |
| `/support` | Support tickets | Create/list tickets — **deliberately reachable even when the subscription has expired** (plan §8). |
| `/setup` | Go-live checklist | The 7-step wizard (§1.1). |

> **Lifecycle promise (plan §8):** an expired/suspended/cancelled plan never deletes
> company data. Billing, usage, support, exports and all reads stay open; only **writes**
> are blocked (cancelled keeps writes until the period ends).

#### N. Print pack — 11 routes

`/print/sale/[id]` · `/print/receipt/[id]` · `/print/rx/[id]` · `/print/appointment/[id]` · `/print/repair/[id]` · `/print/lab/[id]` · `/print/credit-note/[id]` · `/print/buying-list` *(manager)* · `/print/labels` · `/print/locations` · `/print/subscription-invoice/[id]`

Customer document links use `/d/<token>` (HMAC-signed, expiring, revocable — validated server-side, no login needed).

#### O. Auth

`/login` · `/onboarding` (org creation).

### 1.3 Platform Super Admin — 19 routes (NOT part of the shop package)

Separate `platform_users` authorization scope (middleware skips tenant RBAC for `/platform/*`):

`/platform` · `companies` · `companies/[id]` (+ `activity`, `records`, `support`, `usage`) · `subscriptions` (+ `[id]`) · `plans` (+ `new`, `[id]`) · `billing` · `support` · `announcements` · `security` (break-glass) · `admin` · `backup` · `maintenance`

The platform admin never auto-accesses a company's private records; break-glass is explicit and audited.

---

## 2. Role-by-role access (11 roles)

### 2.1 How access is enforced — three layers

1. **Sidebar filter** — every nav item runs through `routeAllowed()`; items the role can't open are hidden (including quick-action tiles, so no dead buttons).
2. **Middleware** — a direct URL attempt that fails `routeAllowed()` redirects to `/?denied=1`.
3. **Database** — RLS on every table + RPC grants is the real gate (the two UI layers only prevent navigation).

Plus a **subscription entitlement gate** on write modules (server actions), and per-page
button-level checks from `role_permissions`.

### 2.2 Route tiers

| Tier | Roles | Route powers |
|---|---|---|
| **admin** | `owner`, `admin` | Everything; bypasses all permission checks. |
| **manager** | `branch_manager` | Operational management; no `/staff`, `/settings`, `/website`, `/company`, `/subscription`. |
| **staff** | `staff`, `optometrist`, `sales_executive`, `cashier`, `inventory_manager`, `lab_technician`, `accountant`, `receptionist` | Base operations only; gated pages need explicit permission grants. |

**Tier gates (rbac.ts RULES):**

- **admin only:** `/staff`, `/settings`, `/website`, `/company`, `/subscription`
- **manager+:** `/reports`, `/crm`, `/print/buying-list`
- **everything else:** open to all tiers (data still RLS-scoped)

**Permission-gated routes (PERM_ROUTES — non-admins need the grant):**

| Route | Permission |
|---|---|
| `/finance`, `/finance/*`, `/purchase-invoices`, `/accountant-export` | `finance_view` |
| `/purchases` | `purchases_manage` |
| `/stock-audits` | `stock_audit` |
| `/web-orders` | `web_orders` |
| `/reports`, `/reports/*` | `reports_view` (+ manager tier) |
| `/crm` | `crm_manage` (+ manager tier) |

### 2.3 The 13 permissions and their default roles

| Permission | What it unlocks | Default roles |
|---|---|---|
| `finance_view` | Finance tabs, Purchase Invoices, Accountant Export | branch_manager, **accountant, cashier** |
| `expenses` | Record expenses | branch_manager, accountant |
| `day_closing` | Close the day (cash reconciliation) | branch_manager, accountant |
| `reports_view` | Finance → Sales report; reports pages | branch_manager, accountant |
| `catalogue_edit` | Edit products, brands, lenses, suppliers | branch_manager, **inventory_manager** |
| `stock_adjust` | Manual stock adjustments | branch_manager, inventory_manager |
| `stock_audit` | Stock Audit page + counts | branch_manager, inventory_manager |
| `transfers_approve` | Approve branch transfers | branch_manager, inventory_manager |
| `purchases_manage` | Purchase Orders page | branch_manager, inventory_manager |
| `web_orders` | Website Orders fulfilment | branch_manager, **sales_executive** |
| `credit_notes.issue` | Credit notes / refunds | branch_manager, **cashier** |
| `crm_manage` | CRM Automation page | branch_manager only |
| `discount_override` | Override discount limits at POS | branch_manager only |

Owners/admins always pass. Grants are edited live on `/staff` (role-permissions matrix)
and are per-organisation. **Generic `staff`, `optometrist`, `lab_technician` and
`receptionist` start with zero grants** — add what each person needs.

### 2.4 Sidebar visibility by access class

| Class | Sidebar items | Who sees them |
|---|---|---|
| **Base (13)** | Dashboard, Customers, Prescriptions, Appointments, POS & Orders, Workshop & Lab, Repairs, Inventory, Stock Transfers, Inbox & Alerts, Audit Log\*, Support, Setup checklist | **All 11 roles** |
| **Finance-gated** | Finance (5 submenu items), Purchase Invoices | finance_view → branch_manager, accountant, cashier |
| **Inventory-gated** | Purchase Orders, Stock Audit | purchases_manage / stock_audit → branch_manager, inventory_manager |
| **Orders-gated** | Website Orders | web_orders → branch_manager, sales_executive |
| **Manager-gated** | CRM Automation | manager tier + crm_manage → branch_manager |
| **Admin-only (6)** | Staff, Subscription, Website (Studio + Coupons), Company, Settings, Store Domains | owner, admin |

\* **Audit Log caveat (gap G7):** the menu item appears for every role (no route rule),
but the `audit_log` RLS policy only returns rows to owner/admin — everyone else opens an
empty page.

### 2.5 Role sheets — what each person gets

#### 👑 Owner — *admin tier*
- **Sees:** all 25 sidebar items, all 50 tenant routes.
- **Quick actions:** New customer · New sale / POS · New prescription · Book eye test.
- **Owns:** subscription & billing, staff, settings, company profile, website, go-live checklist, branch comparison on the dashboard.
- Platform Super Admin pages are a **separate login** — never mixed in.

#### 🛡 Admin — *admin tier*
- **Sees:** identical to Owner (all 25 items).
- **Quick actions:** New customer · New sale / POS · Staff · Subscription.
- Ownership-transfer controls are owner-only wherever offered.

#### 🌿 Branch manager — *manager tier*
- **Sees:** 19 items — everything except Staff, Subscription, Website, Company, Settings, Store Domains.
- **Default permissions:** all 13 (including `crm_manage`, `discount_override`).
- **Quick actions:** New customer · New sale / POS · Stock audit · Branch reports.
- Dashboard adds the branch comparison table; header switcher shows all branches.

#### 📒 Accountant — *staff tier*
- **Sees:** 15 items — Base 13 + **Finance** + Purchase Invoices.
- **Default permissions:** `finance_view`, `expenses`, `day_closing`, `reports_view`.
- **Quick actions:** Finance · Cashbook · GSTR-1 · Accountant export.
- **Never:** `/reports` pages (manager-tier), CRM, admin surfaces.

#### 💵 Cashier — *staff tier*
- **Sees:** 15 items — Base 13 + **Finance** + Purchase Invoices.
- **Default permissions:** `finance_view`, `credit_notes.issue`.
- **Quick actions:** POS billing · Order lookup · Cashbook · Cash closing ⚠ (see G5).
- Day-closing and expense buttons appear only if those grants are added.

#### 📦 Inventory manager — *staff tier*
- **Sees:** 15 items — Base 13 + **Purchase Orders** + **Stock Audit**.
- **Default permissions:** `catalogue_edit`, `stock_adjust`, `stock_audit`, `transfers_approve`, `purchases_manage`.
- **Quick actions:** Inventory · Stock audit · Transfers · Purchase orders.
- **No `finance_view`** → Purchase Invoices hidden (by design: finance sees supplier money).

#### 🛒 Sales executive — *staff tier*
- **Sees:** 14 items — Base 13 + **Website Orders**.
- **Default permissions:** `web_orders`.
- **Quick actions:** New customer · New sale / POS · Appointments · Web orders.

#### 👓 Optometrist — *staff tier*
- **Sees:** Base 13.
- **Default permissions:** none (grant `catalogue_edit`/`reports_view` as needed).
- **Quick actions:** Patient queue · New prescription · Eye examination · Customer 360.

#### 🔧 Lab technician — *staff tier*
- **Sees:** Base 13.
- **Default permissions:** none.
- **Quick actions:** Workshop & lab · Repairs · Inventory · Appointments.

#### 💁 Receptionist — *staff tier*
- **Sees:** Base 13.
- **Default permissions:** none.
- **Quick actions:** New customer · Appointments · New sale / POS · Repairs.

#### 🧑‍💼 Staff (generic) — *staff tier*
- **Sees:** Base 13.
- **Default permissions:** **none** — every capability is granted per person on `/staff`.
- **Quick actions:** New customer · New sale / POS · Appointments · Inventory.

> All staff-tier roles are blocked (→ `/?denied=1`) from: `/staff`, `/settings`,
> `/website`, `/company`, `/subscription`, `/crm`, `/reports`.

---

## 3. Detailed navigation

### 3.1 App shell

```
┌──────────────┬──────────────────────────────────────────────┐
│  SIDEBAR     │  HEADER  [☰ mobile] Power Eyes Opticals      │
│  (role-      │           [Branch switcher ▾] (A)name [role] │
│   filtered)  │           [← Website]                        │
│ 25 items     ├──────────────────────────────────────────────┤
│  + 2 sub-    │                                              │
│  menus       │  MAIN CONTENT (scoped to selected branch)    │
│              │                                              │
│  ────────    │                                              │
│  (A) avatar  │                                              │
│  Sign out    │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- **Sidebar** collapses to a slide-over on mobile (☰ / ✕).
- **Branch switcher** (header): `All branches` or one branch — sets the scope for every page; managers/owners can pick any branch, staff are bound to their assigned branches.
- **User chip**: avatar initial, name, role badge; **Sign out** at the sidebar foot.
- **Ctrl+K** anywhere opens the command palette.

### 3.2 Sidebar tree (exact order) and who sees each item

| # | Item | Route | Owner/Admin | Branch mgr | Accountant / Cashier | Inventory mgr | Sales exec | Staff-tier (no grants) |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | Dashboard | `/` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2 | Customers | `/customers` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 3 | Prescriptions | `/prescriptions` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4 | Appointments | `/appointments` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 5 | POS & Orders | `/sales` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 6 | Workshop & Lab | `/workshop` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 7 | Repairs | `/repairs` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 8 | Inventory | `/inventory` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 9 | Stock Transfers | `/transfers` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 10 | Purchase Invoices | `/purchase-invoices` | ✓ | ✓ | ✓ | — | — | — |
| 11 | Purchase Orders | `/purchases` | ✓ | ✓ | — | ✓ | — | — |
| 12 | Stock Audit | `/stock-audits` | ✓ | ✓ | — | ✓ | — | — |
| 13 | Inbox & Alerts | `/inbox` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 14 | Website Orders | `/web-orders` | ✓ | ✓ | — | — | ✓ | — |
| 15 | Audit Log | `/audit` | ✓ | ✓\* | ✓\* | ✓\* | ✓\* | ✓\* |
| 16 | **Finance ▸** | | ✓ | ✓ | ✓ | — | — | — |
| 16a | · Overview | `/finance` | ✓ | ✓ | ✓ | — | — | — |
| 16b | · Cashbook | `/finance?tab=Cashbook` | ✓ | ✓ | ✓ | — | — | — |
| 16c | · Sales Report | `/finance/reports` | ✓ | ✓ | ✓ | — | — | — |
| 16d | · GSTR-1 Export | `/finance/gstr1` | ✓ | ✓ | ✓ | — | — | — |
| 16e | · Accountant Export | `/accountant-export` | ✓ | ✓ | ✓ | — | — | — |
| 17 | CRM Automation | `/crm` | ✓ | ✓ | — | — | — | — |
| 18 | Staff | `/staff` | ✓ | — | — | — | — | — |
| 19 | Subscription | `/subscription` | ✓ | — | — | — | — | — |
| 20 | Support | `/support` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 21 | Setup checklist | `/setup` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 22 | **Website ▸** | | ✓ | — | — | — | — | — |
| 22a | · Website Studio | `/website` | ✓ | — | — | — | — | — |
| 22b | · Coupons | `/website/coupons` | ✓ | — | — | — | — | — |
| 23 | Company | `/company` | ✓ | — | — | — | — | — |
| 24 | Settings | `/settings` | ✓ | — | — | — | — | — |
| 25 | Store Domains | `/settings/domains` | ✓ | — | — | — | — | — |

\* visible but empty — see gap **G7**. Optometrist / lab / receptionist / staff all follow the last column; add the gated item back by granting its permission on `/staff`.

### 3.3 Command palette — Ctrl+K

- **Jump to:** Dashboard · Customers · Prescriptions · Appointments · POS & Orders · Workshop & Lab · Repairs · Inventory · Finance · Staff · Company · Settings.
- **Do:** New customer · New prescription · New sale · New repair · Book appointment · Add product.
- **Search customers:** type a name → results open the customer drawer.
- ⚠ Not role-filtered today — see gap **G6**.

### 3.4 Dashboard quick actions per role

| Role | Tile 1 | Tile 2 | Tile 3 | Tile 4 |
|---|---|---|---|---|
| Owner | New customer | New sale / POS | New prescription | Book eye test |
| Admin | New customer | New sale / POS | Staff | Subscription |
| Branch manager | New customer | New sale / POS | Stock audit | Branch reports → `/reports` |
| Optometrist | Patient queue | New prescription | Eye examination | Customer 360 |
| Cashier | POS billing | Order lookup | Cashbook | Cash closing ⚠ G5 |
| Receptionist | New customer | Appointments | New sale / POS | Repairs |
| Sales exec | New customer | New sale / POS | Appointments | Web orders |
| Inventory mgr | Inventory | Stock audit | Transfers | Purchase orders |
| Lab tech | Workshop & lab | Repairs | Inventory | Appointments |
| Accountant | Finance | Cashbook | GSTR-1 | Accountant export |
| Staff | New customer | New sale / POS | Appointments | Inventory |

KPI shortcuts (all roles): **Low stock** → `/inventory?stock=low`, **Active repairs** → `/repairs`, **Today's appointments** → `/appointments`.

### 3.5 URL conventions & deep links

| Pattern | Effect |
|---|---|
| `?new=1` | Opens the create form (customers, prescriptions, sales, repairs, appointments, inventory). |
| `?tab=<key>` | Finance deep link — `Cashbook`, `GST Ledger`, `Expenses`, `Day Closing`, `Credit Notes`, `Reports`. |
| `?stock=low` | Inventory pre-filtered to low stock. |
| `?exam=1` | Appointment book eye-exam shortcut. |
| `?denied=1` | Shown when middleware blocked a URL the role can't open. |
| `?e=…` | Error message (onboarding, transfers). |
| `/d/<token>` | Public customer document link (HMAC + expiry + revocation, no login). |
| `/print/...` | Print windows; `?dt=<token>` for customer-shared documents. |
| `/company/<section>` | Forwarder into the matching Settings section. |

### 3.6 Internal navigation cheat-sheet

| Page | Built-in navigation |
|---|---|
| Customers | Row → drawer: Overview · Profile · Prescriptions · Orders · Repairs · Notes |
| Sales | Order / Quotation modes → POS drawer → print receipt/sale/rx |
| Workshop | Board / Buy tabs + technician · priority · due filters |
| Repairs | Status chips: All · Pending · In Progress · Ready · Delivered · Cancelled |
| Inventory | List ↔ display sections (Window/Counter/Wall/Shelf/Back store); product drawer tabs |
| Purchase invoices | Invoices · Suppliers |
| Finance | Dashboard · Cashbook · GST Ledger · Expenses · Day Closing · Credit Notes · Reports |
| Prescriptions | New exam: Start → Scan (OCR) → Values; manual/OCR/external source |
| Appointments | Date-picker day view + booking/edit drawers |
| Staff | Directory → Branch access matrix → Role-permissions matrix → Assignments |
| Branch detail | Performance · Finance · Cashbook · Compare branches |
| Company hub | 10 topic cards → real editors (docs/branding/policies) or forwarded to Settings |
| Settings | 10-section rail |
| Subscription | Status → plan cards → usage bars → invoices → change/cancel |
| Website Studio | Pages & Guides button → `/website/pages`; Coupons in sidebar |
| Setup | 7-step rail with ✓/○ readiness |
| Transfers | List → `/transfers/approvals` ("All transfers") |

### 3.7 Navigation gaps found in the code (fix before demos)

| # | Gap | Impact | Suggested fix |
|---|---|---|---|
| **G1** | `/branches` has **no inbound link anywhere** — the whole branches subtree (detail, finance, cashbook, performance, new) is URL-only. | Owner can't click to branch management during a demo. | Add sidebar item **Branches** (admin) and/or link dashboard branch rows to `/branches/[id]`. |
| **G2** | `/staff/attendance`, `/staff/leave`, `/staff/[id]/transfer` are **unreachable** (text mentions them; no links). | Attendance/leave features invisible. | Add tabs/links on `/staff`. |
| **G3** | `/settings/roles` (Roles & Permissions overview) has **no inbound link**; `/staff` already embeds the live matrix. | Page is orphaned. | Link it from Settings → Team & Access, or delete it as redundant. |
| **G4** | `/reports/company-overview` orphaned; `/reports/branch-comparison` only reachable via the orphaned `/branches/[id]`. | Report pages invisible. | Add **Reports** entries under the Finance submenu or dashboard. |
| **G5** | Cashier tile "Cash closing" → `/finance?tab=Closing`, but the tab key is **`Day Closing`** — the deep link silently lands on Dashboard. | Broken shortcut. | Change href to `?tab=Day Closing`. |
| **G6** | Command palette is **not role-filtered** — staff see Staff/Company/Settings entries and bounce to `/?denied=1`. | Dead ends in Ctrl+K. | Filter palette `BASE` through `routeAllowed()` like the sidebar. |
| **G7** | **Audit Log** menu shows for every role, but `audit_read` RLS returns rows only to owner/admin → empty page for everyone else. | Confusing empty screen. | Add `/audit` to the ADMIN rules in `rbac.ts` (or hide the item). |
| **G8** | Header link labelled **"← Website"** points to `/` (the dashboard). | Misleading label. | Point it at the storefront URL or relabel. |

---

## 4. Suggested 10-minute sales demo tour

1. **Owner signs in** → dashboard: KPIs, 14-day trend, branch comparison, go-live checklist (`/setup` wizard).
2. **Front desk:** open a customer (drawer tabs), book an appointment, add a prescription (OCR flow).
3. **POS:** ring up an order, switch quotation mode, GST supply type, take payment, print receipt.
4. **After the sale:** workshop board → lab queue → repair tracker with WhatsApp updates.
5. **Stock:** low-stock KPI → inventory display sections → transfer between branches → approvals.
6. **Finance:** Cashbook, Day Closing, GSTR-1 export, accountant ZIP.
7. **Team:** invite staff on `/staff`, show the role-permissions matrix, then **log in as receptionist** — sidebar shrinks to 13 items, denied URLs bounce.
8. **Company & website:** company hub cards, Website Studio, coupons, store domains.
9. **Money:** `/subscription` plans + usage bars + invoices + Razorpay checkout.
10. **Close:** `/support` ticket + reassurance that expiry never deletes data.

---

## Appendix A — Complete route index (82 routes)

### Tenant ERP (50)

| Route | Access | Sidebar |
|---|---|---|
| `/` | all roles | #1 Dashboard |
| `/accountant-export` | `finance_view` | #16e |
| `/appointments` | all | #4 |
| `/audit` | any tier; rows owner/admin only (G7) | #15 |
| `/branches` | any tier; **no link** (G1) | — |
| `/branches/[id]` | any tier; via `/branches` | — |
| `/branches/[id]/cashbook` | any tier | — |
| `/branches/[id]/finance` | any tier | — |
| `/branches/[id]/performance` | any tier | — |
| `/branches/new` | any tier | — |
| `/company` | ADMIN | #23 |
| `/company/[section]` | ADMIN | dispatcher → Settings |
| `/company/branding` | ADMIN | hub card |
| `/company/docs` | ADMIN | hub card |
| `/company/policies` | ADMIN | hub card |
| `/crm` | MANAGER + `crm_manage` | #17 |
| `/customers` | all | #2 |
| `/finance` | `finance_view` | #16a |
| `/finance/gstr1` | `finance_view` | #16d |
| `/finance/reports` | `finance_view` | #16c |
| `/inbox` | all | #13 |
| `/inventory` | all | #8 |
| `/prescriptions` | all | #3 |
| `/purchase-invoices` | `finance_view` | #10 |
| `/purchases` | `purchases_manage` | #11 |
| `/repairs` | all | #7 |
| `/reports` | MANAGER + `reports_view` → redirects `/finance` | dashboard tile |
| `/reports/branch-comparison` | MANAGER + `reports_view` | — (G4) |
| `/reports/company-overview` | MANAGER + `reports_view` | — (G4) |
| `/sales` | all | #5 |
| `/settings` | ADMIN | #24 |
| `/settings/domains` | ADMIN | #25 |
| `/settings/roles` | ADMIN | — (G3) |
| `/setup` | all (edit: owner/admin) | #21 |
| `/staff` | ADMIN | #18 |
| `/staff/[id]/transfer` | ADMIN | — (G2) |
| `/staff/attendance` | ADMIN | — (G2) |
| `/staff/leave` | ADMIN | — (G2) |
| `/stock-audits` | `stock_audit` | #12 |
| `/subscription` | ADMIN | #19 |
| `/subscription/invoices` | ADMIN | from `/subscription` |
| `/subscription/usage` | ADMIN | from `/subscription` |
| `/support` | all | #20 |
| `/transfers` | all | #9 |
| `/transfers/approvals` | all (approve: `transfers_approve`) | from `/transfers` |
| `/web-orders` | `web_orders` | #14 |
| `/website` | ADMIN | #22a |
| `/website/coupons` | ADMIN | #22b |
| `/website/pages` | ADMIN | from Studio |
| `/workshop` | all | #6 |

### Platform Super Admin (19) — separate `platform_users` scope

`/platform` · `/platform/admin` · `/platform/announcements` · `/platform/backup` · `/platform/billing` · `/platform/companies` · `/platform/companies/[id]` · `…/activity` · `…/records` · `…/support` · `…/usage` · `/platform/maintenance` · `/platform/plans` · `/platform/plans/[id]` · `/platform/plans/new` · `/platform/security` · `/platform/subscriptions` · `/platform/subscriptions/[id]` · `/platform/support`

### Print (11)

`/print/appointment/[id]` · `/print/buying-list` *(MANAGER)* · `/print/credit-note/[id]` · `/print/lab/[id]` · `/print/labels` · `/print/locations` · `/print/receipt/[id]` · `/print/repair/[id]` · `/print/rx/[id]` · `/print/sale/[id]` · `/print/subscription-invoice/[id]`

### Auth (2) + public (1)

`/login` · `/onboarding` · `/d/<token>` (customer document link)

---

## Appendix B — Source of truth

| Concern | File |
|---|---|
| Route tiers, RULES, PERM_ROUTES, 13 permissions, `routeAllowed()` | `apps/erp/src/lib/rbac.ts` |
| Sidebar tree + role filtering (`visible()`) | `apps/erp/src/components/Shell.tsx` |
| Middleware (auth, deactivation, denied redirect, platform bypass) | `apps/erp/src/middleware.ts` |
| Role dashboards / quick actions | `apps/erp/src/app/(app)/page.tsx` |
| Command palette | `apps/erp/src/components/CommandPalette.tsx` |
| Permission defaults seeding | `supabase/migrations/20261212000000_role_model_expansion.sql` |
| Per-person grants editor | `apps/erp/src/app/(app)/staff/permissions.tsx` + `staff/actions.ts` |
| Entitlement gate (write modules) | `apps/erp/src/lib/subscription-core.ts` |
