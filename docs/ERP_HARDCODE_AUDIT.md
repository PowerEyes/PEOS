# ERP Hardcoded Data Audit

## apps\erp\src\app\(app)\appointments\examination-form.tsx
9: const VA_DIST_OPTIONS = ["6/60","6/36","6/24","6/18","6/12","6/9","6/6","6/5","CF","HM","PL","NPL"];
10: const VA_NEAR_OPTIONS = ["N36","N24","N18","N12","N9","N8","N6","N5"];
11: const COVER_TEST_OPTS = ["orthophoria","esophoria","exophoria","right esotropia","left esotropia","right exotropia","left exotropia"];
12: const RX_TYPES       = ["single_vision","progressive","bifocal","reading","nil"];
13: const INDEX_OPTS     = [1.56,1.59,1.60,1.67,1.74];
14: const MONTHS_OPTS    = [6,12,18,24,36];
85: const STEPS = ["Visual Acuity","Refraction","Clinical Findings","Fundus","Prescription"];

## apps\erp\src\app\(app)\appointments\page.tsx
22: const TYPES=["Eye Test","Contact Lens Fitting","Follow Up","Consultation","Other"];
23: const STATUSES=["scheduled","confirmed","arrived","completed","cancelled","no_show"];

## apps\erp\src\app\(app)\audit\page.tsx
14: const ids = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
17: const diff = (r: any) => { const o = r.old_data ?? {}, n = r.new_data ?? {}; const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])].filter(k => JSON.stringify(o[k]) !== JSON.stringify(n[k]) && !["updated_at"].includes(k));

## apps\erp\src\app\(app)\branches\page.tsx
13: const canCreate = ["owner", "admin"].includes(profile.role_key ?? "");

## apps\erp\src\app\(app)\branches\[id]\performance\page.tsx
74: const ranking = [...byPerson.entries()]

## apps\erp\src\app\(app)\company\page.tsx
15: const TOPICS = [
28: const SETTINGS_KEYS = [
53: const policies = [map.policy_returns, map.policy_warranty, map.policy_privacy]

## apps\erp\src\app\(app)\crm\view.tsx
25: const AUTOMATIONS = [

## apps\erp\src\app\(app)\customers\view.tsx
47: const TABS = ["Overview", "Profile", "Prescriptions", "Orders", "Repairs", "Notes"];

## apps\erp\src\app\(app)\finance\date-range-filter.tsx
22: const qtrStart = [0,3,6,9][qtr];

## apps\erp\src\app\(app)\finance\gstr1\actions.ts
131: const docs = [{ "Nature of Document":"Invoices for outward supply","Sr. No. From":sales[0]?.code ?? "","Sr. No. To":sales[sales.length-1]?.code ?? "","Total Number":sales.length,"Cancelled":0 }];

## apps\erp\src\app\(app)\finance\gstr1\page.tsx
35: const sections = [
47: const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

## apps\erp\src\app\(app)\finance\view.tsx
17: const TABS = ["Dashboard", "Cashbook", "GST Ledger", "Expenses", "Day Closing", "Credit Notes", "Reports"] as const;
18: const EXP_CATS = ["Rent","Electricity","Salaries","Marketing","Office Supplies","Repairs & Maintenance","Transport","Professional Fees","Other"];
19: const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
21: const CB_METHODS = ["cash", "upi", "card", "bank", "razorpay", "other"];
72: const asc = [...filtered].sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0));
85: const head = ["Date", "Time", "Direction", "Source", "Method", "Party", "Document", "Reference", "Amount", "Running balance"];
86: const lines = [head.join(",")];
245: const max = Math.max(...m.values(), 1); const arr = [];

## apps\erp\src\app\(app)\inventory\display.tsx
9: const SECTIONS = [["window", "Window"], ["counter", "Counter"], ["wall", "Wall"], ["shelf", "Shelf"], ["back_store", "Back store"]] as const;
45: const locs = [...new Set(products.map((p) => { const e = cur(p); const sh = slug(e.shelf_location); return `LOC-${SEC3[e.display_section] ?? "LOC"}${sh ? `-${sh}` : ""}`; }))];

## apps\erp\src\app\(app)\inventory\options.tsx
8: const DESIGNS = ["single_vision", "progressive", "bifocal", "reading", "non_prescription"];

## apps\erp\src\app\(app)\inventory\packages.tsx
10: const DESIGNS = ["single_vision", "progressive", "bifocal", "reading", "non_prescription"]; const IDX = ["1.50", "1.56", "1.60", "1.67", "1.74"]; const COAT = ["HC", "HMC", "Blue Cut", "Photochromic", "Polarized"];

## apps\erp\src\app\(app)\inventory\product-drawer.tsx
11: const TABS = ["Basic", "Details", "Pricing", "Stock", "Website", "Images", "Display"] as const;
12: const SECTIONS = [["window", "Window display"], ["counter", "Counter display"], ["wall", "Wall display"], ["shelf", "Shelf"], ["back_store", "Back store"]] as const;

## apps\erp\src\app\(app)\page.tsx
22: const isOwner = ['owner','admin'].includes(p?.role_key ?? '');
26: const isMgr = ["owner", "admin", "branch_manager"].includes(p?.role_key ?? "");

## apps\erp\src\app\(app)\purchase-invoices\view.tsx
9: const TAX_RATES = [0, 5, 12, 18, 28];
10: const STATES = ["Tamil Nadu","Andhra Pradesh","Karnataka","Kerala","Maharashtra","Delhi","Gujarat","Rajasthan","West Bengal","Punjab","Haryana","Other"];
11: const PAY_MODES = ["Cash","Bank Transfer","Cheque","UPI","NEFT/RTGS","Credit Card"];

## apps\erp\src\app\(app)\purchases\actions.ts
240: const got = [...byProduct.values()].reduce((a, b) => a + b, 0);

## apps\erp\src\app\(app)\purchases\view.tsx
10: const TAX_RATES = [0, 5, 12, 18, 28];

## apps\erp\src\app\(app)\repairs\view.tsx
19: const TYPES=["Spectacle Frame","Sunglasses","Contact Lens Pack","Accessory","Other"];
92: const paths=[...existing];
173: {["pending","in_progress","ready","delivered"].map((s,i)=>{const done=["pending","in_progress","ready","delivered"].indexOf(r.status)>=i; return(<><span key={s} className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium ${done?"bg-navy-800 text-white":"bg-white text-slate-500 border"}`}>{s.replace("_"," ")}</span>{i<3&&<span className="mx-1 text-slate-300">→</span>}</> );})}

## apps\erp\src\app\(app)\sales\pos.tsx
55: const FILTERS = [
82: const chosen = [idx, ...adds]
293: const allC = [...extraC, ...customers];

## apps\erp\src\app\(app)\sales\view.tsx
35: const status = eff(d); const bal = Number(d.grand_total) - Number(d.paid_total); const lines = [...d.sale_lines].sort((a: any, b: any) => a.line_no - b.line_no);

## apps\erp\src\app\(app)\settings\roles\page.tsx
33: const roleKeys = [...new Set([...Object.keys(ROLE_DESCRIPTIONS), ...(members ?? []).map((m: any) => m.role_key)])]

## apps\erp\src\app\(app)\settings\section-business.tsx
42: const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

## apps\erp\src\app\(app)\settings\section-profile.tsx
9: const MONTHS = [

## apps\erp\src\app\(app)\settings\section-tax.tsx
10: const INDIAN_STATES = [

## apps\erp\src\app\(app)\settings\section-templates.tsx
337: Preview — warm version (sample data)

## apps\erp\src\app\(app)\settings\view.tsx
28: const SECTIONS = [
111: const canEdit = ["owner", "admin"].includes(role);

## apps\erp\src\app\(app)\settings-actions.ts
486: const variables = [

## apps\erp\src\app\(app)\setup\actions.ts
7: const KINDS = ["frame", "sunglass", "contact_lens", "accessory"], GENDERS = ["men", "women", "unisex", "kids"];
23: const cols = ["kind","brand","model","sku","gender","mrp","selling_price","tax_pct","cost_price"] as const;
81: const add = [...brandNames].filter(n => !brandId.has(n.toLowerCase())).map(name => ({ name }));

## apps\erp\src\app\(app)\setup\wizard.tsx
13: const TITLES = [
44: const canEdit = ["owner", "admin"].includes(role);
53: const complete = [

## apps\erp\src\app\(app)\shell-actions.ts
34: const ids = [...new Set((pays ?? []).map((x: any) => x.sale_id))]; if (!ids.length) return 0;
46: const approvals = [{ label: "Stock transfers to approve", count: transfers, href: "/transfers/approvals" }, { label: "Stock counts to approve", count: audits, href: "/stock-audits" }].filter((a) => a.count > 0);

## apps\erp\src\app\(app)\staff\actions.ts
66: const allowedRoles = [...GRANTABLE_ROLES];
67: const allowedPermissions = ["finance_view", "expenses", "day_closing", "catalogue_edit", "reports_view", "crm_manage", "discount_override", "stock_adjust", "purchases_manage", "stock_audit", "transfers_approve", "web_orders", "credit_notes.issue"];

## apps\erp\src\app\(app)\staff\view.tsx
11: const ROLES = ["staff","branch_manager","optometrist","receptionist","sales_executive","cashier","inventory_manager","lab_technician","accountant","admin","owner"] as const;
16: const colors = ["bg-blue-600","bg-violet-600","bg-emerald-600","bg-rose-600","bg-amber-600","bg-navy-700"];

## apps\erp\src\app\(app)\stock-audits\actions.ts
21: const ids = [...new Set(p.data.product_ids)];

## apps\erp\src\app\(app)\subscription\change-plan.tsx
12: const restricted = ["expired", "suspended", "none", "inactive"].includes(status) || cancelled;

## apps\erp\src\app\(app)\subscription\page.tsx
99: const restricted = ["expired", "suspended", "none", "inactive"].includes(status)

## apps\erp\src\app\(app)\subscription\usage\page.tsx
6: const METRICS = [

## apps\erp\src\app\(app)\support\actions.ts
27: const p = ["normal", "high", "urgent"].includes(priority) ? priority : "normal";

## apps\erp\src\app\(app)\web-orders\page.tsx
8: const COLS = [["lab_pending", "New / lab pending", "in_workshop", "Start workshop"], ["in_workshop", "In workshop", "qc", "Send to QC"], ["qc", "Quality check", "ready", "Mark ready"], ["ready", "Ready for dispatch / pickup", "delivered", "Mark delivered"]] as const;
12: const ids = [...new Set((pays ?? []).map((x: any) => x.sale_id))];

## apps\erp\src\app\(app)\website\clinical\view.tsx
9: async function move(r:any,delta:number){const ordered=[...rows].sort((a,b)=>a.display_order-b.display_order);const i=ordered.findIndex(x=>x.id===r.id),j=i+delta;if(j<0||j>=ordered.length)return;const a=ordered[i],b=ordered[j];const {error}=await supabaseBrowser().from("clinical_services").update({display_order:b.display_order}).eq("id",a.id);if(!error)await supabaseBrowser().from("clinical_services").update({display_order:a.display_order}).eq("id",b.id);if(error)toast(error.message,"err");else router.refresh();}

## apps\erp\src\app\(app)\website\pages\view.tsx
12: const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
22: const move = (arr: string, i: number, d: number) => setEdit((e: any) => { const a = [...e[arr]]; const j = i + d; if (j < 0 || j >= a.length) return e; [a[i], a[j]] = [a[j], a[i]]; return { ...e, [arr]: a }; });

## apps\erp\src\app\(app)\website\view.tsx
14: const TABS = ["Homepage","Sections","Products","Reviews","Analytics"] as const;
18: const SECTION_FALLBACK = ["announcement","site_logo","nav","hero","category_card","frame_finder","shape_chip","best_seller","collection_banner","lens_type","lifestyle_chip","feature_card","stores","promo","top_sunglasses","ugc","whatsapp_cta","footer","lenses_guide"];
38: const sorted = [...rows].sort(
126: const extra = [...new Set(content.map((c: any) => c.section))].filter(s => !known.includes(s));

## apps\erp\src\app\(app)\workshop\view.tsx
12: const COLS = [["to_buy", "To buy", "bg-amber-400"], ["ordered", "Ordered", "bg-blue-400"], ["received", "Received", "bg-indigo-400"], ["edging", "Edging", "bg-violet-400"], ["fitting", "Fitting", "bg-fuchsia-400"], ["qc", "Quality check", "bg-orange-400"], ["ready", "Ready", "bg-emerald-500"]] as const;
14: const CHECKS = ["Power, axis and PD match the prescription", "Frame fit and alignment checked", "Lenses clean, no scratches or chips", "Cleaned, packed with case"];

## apps\erp\src\app\api\accountant-export\route.ts
65: const files = [

## apps\erp\src\app\api\ocr\route.ts
91: const flags = [...(result.field_warnings ?? []), ...(result.warnings ?? [])];

## apps\erp\src\app\platform\admin\users-panel.tsx
5: const ROLES = ["super_admin", "support", "billing", "read_only"] as const;

## apps\erp\src\app\platform\companies\[id]\usage\page.tsx
22: const cards = [

## apps\erp\src\app\platform\layout.tsx
7: const NAV = [

## apps\erp\src\app\platform\page.tsx
23: const kpis = [

## apps\erp\src\app\platform\plans\[id]\page.tsx
24: const LIVE = ["trialing", "active", "past_due", "payment_pending", "payment_failed"];

## apps\erp\src\app\platform\subscriptions\page.tsx
17: const groups = ["trialing", "active", "past_due", "grace", "expired", "suspended", "cancelled", "inactive"];

## apps\erp\src\app\print\labels\page.tsx
25: const line = [p.brands?.name, p.model, p.attrs?.color].filter(Boolean).join(" · ");
62: const uniqueProducts = [...new Map((data ?? []).map((p: any) => [p.id, p])).values()];
64: const kinds = [...new Set(labels.map((p: any) => sizeOf(p)))] as KindKey[];

## apps\erp\src\app\print\locations\page.tsx
18: const codes = [...new Set((searchParams.codes ?? "").split(",").map((c) => c.trim()).filter(Boolean))];

## apps\erp\src\app\print\sale\[id]\page.tsx
19: const lines = [...s.sale_lines].sort((a: any, z: any) => a.line_no - z.line_no);

## apps\erp\src\components\announcement-banner.tsx
23: const next = [...hidden, id].slice(-50);

## apps\erp\src\components\QuickCreate.tsx
7: const ITEMS = [

## apps\erp\src\components\QuickCustomer.tsx
43: const has = [od.sph, od.cyl, od.add, os.sph, os.cyl, os.add].some((x) => x.trim() !== "");

## apps\erp\src\lib\company-profile.ts
6: export const DOC_KINDS = ["license", "registration", "certification", "insurance", "other"] as const;

## apps\erp\src\lib\doc-render.ts
24: const lines = [...(s.sale_lines ?? [])].sort((a: any, z: any) => a.line_no - z.line_no);

## apps\erp\src\lib\rbac.ts
12: export const SPECIALIST_ROLES = [
52: export const PERMISSIONS = [
69: const COMMON = ["/", "/customers", "/inbox", "/support", "/print", "/staff/attendance", "/staff/leave"];

## apps\erp\src\lib\subscription-core.ts
19: export const LIVE_STATUSES = ["trialing", "active", "grace", "payment_pending", "payment_failed", "past_due"] as const;
22: export const RESTRICTED_STATUSES = ["expired", "suspended", "none", "inactive"] as const;

## apps\erp\src\lib\validators\staff.ts
8: const VALID_ROLES = ["owner", "admin", "branch_manager", "staff", "optometrist", "sales_executive", "cashier", "inventory_manager", "lab_technician", "accountant", "receptionist"];

