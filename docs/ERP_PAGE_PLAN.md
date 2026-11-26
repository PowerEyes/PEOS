# PowerOS ERP — Page-by-Page Product Plan

> What an optical shop owner gets when they buy PowerOS: every page, what each of the
> 11 staff roles can see, and how navigation works — mapped 1:1 to shipped code.
>
> Source of truth: `apps/erp` (82 routes: 50 tenant + 19 platform + 11 print + 2 auth),
> `src/lib/rbac.ts` (route rules + 13 permissions), `src/components/Shell.tsx` (sidebar).
>
> **Status:** the eight navigation gaps originally found during this audit (G1–G8) have
> been **fixed in code** — see §3.7 for what shipped.

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
- **Branch comparison table** (owner/admin/manager): Today / This month / Collected / Lab queue / Repairs / Low stock per branch + totals row. Clicking a row **focuses the whole app on that branch**; the card header links **View all branches →** `/branches`.
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
| `/reports` | *(redirects to `/finance`)* | Legacy URL — the manager's "Branch reports" tile now targets `/reports/branch-comparison` directly. |
| `/reports/company-overview` | Company report | Standalone report — sidebar **Reports ▸ Company overview**. |
| `/reports/branch-comparison` | Branch comparison report | Standalone report — sidebar **Reports ▸ Branch comparison**; also the target of the dashboard tile and the branch-detail "Compare branches" button. |
| `/print/subscription-invoice/[id]` | Tax invoice | Subscription billing invoice printout. |

#### H. Team & permissions

| Route | Page | Access |
|---|---|---|
| `/staff` | **Team hub** (admin) | Staff directory + header buttons **Attendance · Leave · Invite staff**; embedded: **branch-access matrix**, **role-permissions matrix** (the live editor — "Staff → Permissions"), **assignments**; per-row **Transfer** action; role explainer cards. |
| `/staff/[id]/transfer` | Transfer employee | Reached from the per-row **Transfer** action on `/staff`. |
| `/staff/attendance` | Attendance register | Reached from the **Attendance** button in the `/staff` header. |
| `/staff/leave` | Leave register | Reached from the **Leave** button in the `/staff` header. |
| `/settings/roles` | Roles & Permissions overview | Read-only grant overview that links back to `/staff`; reached via **Roles overview** in Settings → Team & Access. |

#### I. Branches (multi-branch)

| Route | Page |
|---|---|
| `/branches` | Branch cards; sidebar **Branches** (manager-tier) + **View all branches** link on the dashboard comparison card. **+ New Branch** shows for owner/admin only (creation is owner/admin by rule *and* action). |
| `/branches/new` | Create branch (admin-only route; redirects to `/branches` on save). |
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
> reviews, document links) — not part of the ERP shell. The header **← Website** link
> opens it (`NEXT_PUBLIC_WEB_URL`) in a new tab.

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
Team & Access carries links to **Open Staff**, **Roles overview** (`/settings/roles`) and the **Setup checklist**.

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

1. **Sidebar filter** — every nav item runs through `routeAllowed()`; items the role can't open are hidden (including quick-action tiles and command-palette entries, so no dead buttons).
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

- **admin only:** `/staff`, `/settings`, `/website`, `/company`, `/subscription`, `/audit`, `/branches/new`
- **manager+:** `/reports`, `/crm`, `/print/buying-list`, `/branches`
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
| **Base (12)** | Dashboard, Customers, Prescriptions, Appointments, POS & Orders, Workshop & Lab, Repairs, Inventory, Stock Transfers, Inbox & Alerts, Support, Setup checklist | **All 11 roles** |
| **Finance-gated** | Finance (5 submenu items), Purchase Invoices | finance_view → branch_manager, accountant, cashier |
| **Inventory-gated** | Purchase Orders, Stock Audit | purchases_manage / stock_audit → branch_manager, inventory_manager |
| **Orders-gated** | Website Orders | web_orders → branch_manager, sales_executive |
| **Manager-gated** | CRM Automation, **Branches**, **Reports** (2 children) | manager tier (+ `crm_manage` / `reports_view` where required) → branch_manager |
| **Admin-only (7)** | Staff, Subscription, Website (Studio + Coupons), Company, Settings, Store Domains, **Audit Log** | owner, admin |

> **Audit Log** is owner/admin-only: the `audit_read` RLS policy has always returned rows
> only to those roles, and the route rule now matches it (previously the menu appeared for
> everyone and opened an empty page).

### 2.5 Role sheets — what each person gets

#### 👑 Owner — *admin tier*
- **Sees:** all 27 sidebar items, all 50 tenant routes.
- **Quick actions:** New customer · New sale / POS · New prescription · Book eye test.
- **Owns:** subscription & billing, staff, settings, company profile, website, go-live checklist, branch comparison on the dashboard.
- Platform Super Admin pages are a **separate login** — never mixed in.

#### 🛡 Admin — *admin tier*
- **Sees:** identical to Owner (all 27 items).
- **Quick actions:** New customer · New sale / POS · Staff · Subscription.
- Ownership-transfer controls are owner-only wherever offered.

#### 🌿 Branch manager — *manager tier*
- **Sees:** 20 items — everything except Staff, Subscription, Website, Company, Settings, Store Domains, Audit Log.
- **Default permissions:** all 13 (including `crm_manage`, `discount_override`).
- **Quick actions:** New customer · New sale / POS · Stock audit · Branch reports (→ `/reports/branch-comparison`).
- Dashboard adds the branch comparison table (with **View all branches** link); header switcher shows all branches.

#### 📒 Accountant — *staff tier*
- **Sees:** 14 items — Base 12 + **Finance** + Purchase Invoices.
- **Default permissions:** `finance_view`, `expenses`, `day_closing`, `reports_view`.
- **Quick actions:** Finance · Cashbook · GSTR-1 · Accountant export.
- **Never:** `/reports` pages (manager-tier), CRM, admin surfaces.

#### 💵 Cashier — *staff tier*
- **Sees:** 14 items — Base 12 + **Finance** + Purchase Invoices.
- **Default permissions:** `finance_view`, `credit_notes.issue`.
- **Quick actions:** POS billing · Order lookup · Cashbook · Cash closing (→ `/finance?tab=Day Closing`).
- Day-closing and expense buttons appear only if those grants are added.

#### 📦 Inventory manager — *staff tier*
- **Sees:** 14 items — Base 12 + **Purchase Orders** + **Stock Audit**.
- **Default permissions:** `catalogue_edit`, `stock_adjust`, `stock_audit`, `transfers_approve`, `purchases_manage`.
- **Quick actions:** Inventory · Stock audit · Transfers · Purchase orders.
- **No `finance_view`** → Purchase Invoices hidden (by design: finance sees supplier money).

#### 🛒 Sales executive — *staff tier*
- **Sees:** 13 items — Base 12 + **Website Orders**.
- **Default permissions:** `web_orders`.
- **Quick actions:** New customer · New sale / POS · Appointments · Web orders.

#### 👓 Optometrist — *staff tier*
- **Sees:** Base 12.
- **Default permissions:** none (grant `catalogue_edit`/`reports_view` as needed).
- **Quick actions:** Patient queue · New prescription · Eye examination · Customer 360.

#### 🔧 Lab technician — *staff tier*
- **Sees:** Base 12.
- **Default permissions:** none.
- **Quick actions:** Workshop & lab · Repairs · Inventory · Appointments.

#### 💁 Receptionist — *staff tier*
- **Sees:** Base 12.
- **Default permissions:** none.
- **Quick actions:** New customer · Appointments · New sale / POS · Repairs.

#### 🧑‍💼 Staff (generic) — *staff tier*
- **Sees:** Base 12.
- **Default permissions:** **none** — every capability is granted per person on `/staff`.
- **Quick actions:** New customer · New sale / POS · Appointments · Inventory.

> All staff-tier roles are blocked (→ `/?denied=1`) from: `/staff`, `/settings`,
> `/website`, `/company`, `/subscription`, `/crm`, `/reports`, `/branches`, `/audit`.

---

## 3. Detailed navigation

### 3.1 App shell

```
┌──────────────┬──────────────────────────────────────────────┐
│  SIDEBAR     │  HEADER  [☰ mobile] Power Eyes Opticals      │
│  (role-      │           [Search ⌘K] [Branch switcher ▾]    │
│   filtered)  │           (A)name [role]  [← Website ↗]      │
│ 27 items     ├──────────────────────────────────────────────┤
│  + 3 sub-    │                                              │
│  menus       │  MAIN CONTENT (scoped to selected branch)    │
│              │                                              │
│  ────────    │                                              │
│  (A) avatar  │                                              │
│  Sign out    │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- **Sidebar** collapses to a slide-over on mobile (☰ / ✕).
- **Search button / Ctrl+K (⌘K on Mac)** opens the command palette from anywhere.
- **Branch switcher** (header): `All branches` or one branch — sets the scope for every page; managers/owners can pick any branch, staff are bound to their assigned branches.
- **User chip**: avatar initial, name, role badge; **Sign out** at the sidebar foot.
- **← Website** opens the customer storefront (`NEXT_PUBLIC_WEB_URL`) in a new tab.

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
| 15 | Audit Log | `/audit` | ✓ | — | — | — | — | — |
| 16 | **Finance ▸** | | ✓ | ✓ | ✓ | — | — | — |
| 16a | · Overview | `/finance` | ✓ | ✓ | ✓ | — | — | — |
| 16b | · Cashbook | `/finance?tab=Cashbook` | ✓ | ✓ | ✓ | — | — | — |
| 16c | · Sales Report | `/finance/reports` | ✓ | ✓ | ✓ | — | — | — |
| 16d | · GSTR-1 Export | `/finance/gstr1` | ✓ | ✓ | ✓ | — | — | — |
| 16e | · Accountant Export | `/accountant-export` | ✓ | ✓ | ✓ | — | — | — |
| 17 | **Reports ▸** | | ✓ | ✓ | — | — | — | — |
| 17a | · Company overview | `/reports/company-overview` | ✓ | ✓ | — | — | — | — |
| 17b | · Branch comparison | `/reports/branch-comparison` | ✓ | ✓ | — | — | — | — |
| 18 | CRM Automation | `/crm` | ✓ | ✓ | — | — | — | — |
| 19 | Branches | `/branches` | ✓ | ✓ | — | — | — | — |
| 20 | Staff | `/staff` | ✓ | — | — | — | — | — |
| 21 | Subscription | `/subscription` | ✓ | — | — | — | — | — |
| 22 | Support | `/support` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 23 | Setup checklist | `/setup` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 24 | **Website ▸** | | ✓ | — | — | — | — | — |
| 24a | · Website Studio | `/website` | ✓ | — | — | — | — | — |
| 24b | · Coupons | `/website/coupons` | ✓ | — | — | — | — | — |
| 25 | Company | `/company` | ✓ | — | — | — | — | — |
| 26 | Settings | `/settings` | ✓ | — | — | — | — | — |
| 27 | Store Domains | `/settings/domains` | ✓ | — | — | — | — | — |

Optometrist / lab / receptionist / staff all follow the last column; add a gated item
back by granting its permission on `/staff`. Sidebar counts: **owner/admin 27 ·
branch manager 20 · accountant & cashier 14 · inventory manager 14 · sales exec 13 ·
staff-tier base 12.**

### 3.3 Command palette — Ctrl/⌘+K (or the header Search button)

- **Jump to:** Dashboard · Customers · Prescriptions · Appointments · POS & Orders · Workshop & Lab · Repairs · Inventory · **Branches** · Finance · Staff & Users · Company · Settings — every entry filtered through `routeAllowed()` for the signed-in role, so a staff member never sees "Staff & Users" (no more `/?denied=1` bounce).
- **Do:** New customer · New prescription · New sale · New repair · Book appointment · Add product.
- **Search customers:** type a name → results open the customer drawer (`/customers?open=<id>`).
- Mounted once in the Shell; opens from any page via the keyboard or the header **Search ⌘K** button.

### 3.4 Dashboard quick actions per role

| Role | Tile 1 | Tile 2 | Tile 3 | Tile 4 |
|---|---|---|---|---|
| Owner | New customer | New sale / POS | New prescription | Book eye test |
| Admin | New customer | New sale / POS | Staff | Subscription |
| Branch manager | New customer | New sale / POS | Stock audit | Branch reports → `/reports/branch-comparison` |
| Optometrist | Patient queue | New prescription | Eye examination | Customer 360 |
| Cashier | POS billing | Order lookup | Cashbook | Cash closing → `/finance?tab=Day Closing` |
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
| `?open=<id>` | Opens a customer's detail drawer (used by the command palette's customer search). |
| `?stock=low` | Inventory pre-filtered to low stock. |
| `?exam=1` | Appointment book eye-exam shortcut. |
| `?denied=1` | Shown when middleware blocked a URL the role can't open. |
| `?e=…` | Error message (onboarding, branches, transfers). |
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
| Staff | Header: Attendance · Leave · Invite — Directory → Branch access matrix → Role-permissions matrix → Assignments; per-row Transfer |
| Branch detail | Performance · Finance · Cashbook · Compare branches |
| Company hub | 10 topic cards → real editors (docs/branding/policies) or forwarded to Settings |
| Settings | 10-section rail; Team & Access → Open Staff · Roles overview · Setup checklist |
| Subscription | Status → plan cards → usage bars → invoices → change/cancel |
| Website Studio | Pages & Guides button → `/website/pages`; Coupons in sidebar |
| Setup | 7-step rail with ✓/○ readiness |
| Transfers | List → `/transfers/approvals` ("All transfers") |
| Dashboard | Branch comparison card → **View all branches** → `/branches` |

### 3.7 Navigation gaps — all fixed

The eight gaps found during this audit are resolved in code (verified: `tsc` clean,
lint 0 errors, unit tests 47/47 including a new RBAC regression test, production build OK):

| # | Original gap | Fix shipped |
|---|---|---|
| **G1** | `/branches` had no inbound link — whole branches subtree URL-only | Sidebar item **Branches** (manager-tier via new `/branches` rule); dashboard comparison card got a **View all branches** link; command palette gained a Branches entry. `/branches/new` restricted to admin (route rule) and its buttons hidden for managers (mirrors `createBranch()`). |
| **G2** | `/staff/attendance`, `/staff/leave`, `/staff/[id]/transfer` unreachable | **Attendance** and **Leave** buttons in the `/staff` header; per-row **Transfer** action on each active staff member. |
| **G3** | `/settings/roles` orphaned | **Roles overview** link in Settings → Team & Access (the live matrix stays on `/staff`). |
| **G4** | `/reports/company-overview` orphaned; branch-comparison only via orphaned branch page | New sidebar group **Reports ▸** (Company overview · Branch comparison, manager-tier); dashboard "Branch reports" tile now targets `/reports/branch-comparison`. |
| **G5** | Cashier tile `?tab=Closing` didn't match the `Day Closing` tab key | href fixed to `?tab=Day Closing` (lands on the right tab). |
| **G6** | Command palette unmounted and unrole-filtered | Palette mounted in the Shell: **Ctrl/⌘+K** anywhere + header **Search** button; entries filtered through `routeAllowed()` using the signed-in role + permissions. |
| **G7** | Audit Log shown to every role, but RLS returns rows only to owner/admin | `/audit` added to the ADMIN rules in `rbac.ts` (menu hidden + URL denied for everyone else); locked by a new unit test. |
| **G8** | Header "← Website" pointed at the dashboard | Now anchors to `NEXT_PUBLIC_WEB_URL` (storefront) and opens in a new tab — same source the Website Studio "View website" button uses. |

---

## 4. Suggested 10-minute sales demo tour

1. **Owner signs in** → dashboard: KPIs, 14-day trend, branch comparison + **View all branches**, go-live checklist (`/setup` wizard).
2. **Front desk:** open a customer (drawer tabs), book an appointment, add a prescription (OCR flow).
3. **POS:** ring up an order, switch quotation mode, GST supply type, take payment, print receipt.
4. **After the sale:** workshop board → lab queue → repair tracker with WhatsApp updates.
5. **Stock:** low-stock KPI → inventory display sections → transfer between branches → approvals.
6. **Finance:** Cashbook, Day Closing, GSTR-1 export, accountant ZIP; **Reports ▸** company/branch reports.
7. **Team:** invite staff on `/staff`, show Attendance/Leave and the role-permissions matrix, then **log in as receptionist** — sidebar shrinks to 12 items and Ctrl+K only offers what that role can open.
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
| `/audit` | **ADMIN** (rows owner/admin via RLS) | #15 |
| `/branches` | **MANAGER** | #19 |
| `/branches/[id]` | MANAGER (via #19 or dashboard link) | — |
| `/branches/[id]/cashbook` | MANAGER | — |
| `/branches/[id]/finance` | MANAGER | — |
| `/branches/[id]/performance` | MANAGER | — |
| `/branches/new` | **ADMIN** (create) | header button on #19 |
| `/company` | ADMIN | #25 |
| `/company/[section]` | ADMIN | dispatcher → Settings |
| `/company/branding` | ADMIN | hub card |
| `/company/docs` | ADMIN | hub card |
| `/company/policies` | ADMIN | hub card |
| `/crm` | MANAGER + `crm_manage` | #18 |
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
| `/reports` | MANAGER + `reports_view` → redirects `/finance` | legacy URL |
| `/reports/branch-comparison` | MANAGER + `reports_view` | #17b (+ dashboard tile) |
| `/reports/company-overview` | MANAGER + `reports_view` | #17a |
| `/sales` | all | #5 |
| `/settings` | ADMIN | #26 |
| `/settings/domains` | ADMIN | #27 |
| `/settings/roles` | ADMIN | Settings → Team & Access |
| `/setup` | all (edit: owner/admin) | #23 |
| `/staff` | ADMIN | #20 (Attendance/Leave/Transfer live here) |
| `/staff/[id]/transfer` | ADMIN | per-row action on #20 |
| `/staff/attendance` | ADMIN | button on #20 |
| `/staff/leave` | ADMIN | button on #20 |
| `/stock-audits` | `stock_audit` | #12 |
| `/subscription` | ADMIN | #21 |
| `/subscription/invoices` | ADMIN | from `/subscription` |
| `/subscription/usage` | ADMIN | from `/subscription` |
| `/support` | all | #22 |
| `/transfers` | all | #9 |
| `/transfers/approvals` | all (approve: `transfers_approve`) | from `/transfers` |
| `/web-orders` | `web_orders` | #14 |
| `/website` | ADMIN | #24a |
| `/website/coupons` | ADMIN | #24b |
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
| Sidebar tree + role filtering (`visible()`), palette mount + Ctrl+K | `apps/erp/src/components/Shell.tsx` |
| Command palette entries + per-role filtering | `apps/erp/src/components/CommandPalette.tsx` |
| Middleware (auth, deactivation, denied redirect, platform bypass) | `apps/erp/src/middleware.ts` |
| Role dashboards / quick actions | `apps/erp/src/app/(app)/page.tsx` |
| Permission defaults seeding | `supabase/migrations/20261212000000_role_model_expansion.sql` |
| Per-person grants editor | `apps/erp/src/app/(app)/staff/permissions.tsx` + `staff/actions.ts` |
| RBAC regression tests (incl. audit/branches rules) | `apps/erp/tests/rbac.test.mjs` |
| Entitlement gate (write modules) | `apps/erp/src/lib/subscription-core.ts` |