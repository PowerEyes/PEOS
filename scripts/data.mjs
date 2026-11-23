// Test data for the PO / Inventory / Finance / Website verification run.
// Everything here is deterministic so re-runs produce the same catalogue.

export const ORG_ID = "00000000-0000-0000-0000-000000000001";
export const BRANCH = {
  east: { id: "c1e79328-6a5e-4598-918f-3005f123e23c", name: "Mogappair East", code: "MOG-E" },
  west: { id: "f41906f4-9d95-48aa-80c1-bef031469632", name: "Mogappair West", code: "MOG-W" },
};

/* ── 15 suppliers ─────────────────────────────────────────────────────────── */
export const SUPPLIERS = [
  { name: "Chennai Optical Distributors Pvt Ltd", gstin: "33AABCO1234F1Z5", state: "Tamil Nadu", address: "14/3 2nd Avenue, Anna Nagar, Chennai - 600040", phone: "98400 11223", email: "sales@chennaioptical.example.in", contact_person: "Ravi Kumar" },
  { name: "Sunrise Lens House", gstin: "33AAECS4567G1Z2", state: "Tamil Nadu", address: "22 GST Road, Tambaram, Chennai - 600045", phone: "98400 22334", email: "orders@sunriselens.example.in", contact_person: "Kavitha Menon" },
  { name: "Kavery Frames & Lenses", gstin: "33AABCK7890H1Z8", state: "Tamil Nadu", address: "8 Institutional Area, Guindy, Chennai - 600032", phone: "98400 33445", email: "kavery@frames.example.in", contact_person: "Suresh Babu" },
  { name: "Metro Eyewear Company", gstin: "33AADFM1112K1Z4", state: "Tamil Nadu", address: "106 T High Road, T. Nagar, Chennai - 600017", phone: "98400 44556", email: "support@metroeyewear.example.in", contact_person: "Pradeep Rao" },
  { name: "Sri Balaji Opticals Wholesale", gstin: "33AABFS2223L1Z9", state: "Tamil Nadu", address: "3/1 Arcot Road, Vadapalani, Chennai - 600026", phone: "98400 55667", email: "wholesale@balajioptical.example.in", contact_person: "Anitha Suresh" },
  { name: "River Contact Lens Company", gstin: "33AAECR3334M1Z3", state: "Tamil Nadu", address: "41 Cenotaph Road, Adyar, Chennai - 600020", phone: "98400 66778", email: "lenses@rivercontact.example.in", contact_person: "Joseph Thomas" },
  { name: "Erode Frame Mart", gstin: "33AAECE4445N1Z7", state: "Tamil Nadu", address: "19 Perundurai Road, Erode - 638001", phone: "98433 77889", email: "info@erodeframemart.example.in", contact_person: "Muthu Kumar" },
  { name: "National Spectacle Supplies", gstin: "33AABCN5556P1Z1", state: "Tamil Nadu", address: "7 Poonamallee High Road, Ambattur, Chennai - 600058", phone: "98400 77990", email: "desk@nationalspectacle.example.in", contact_person: "Farooq Ahmed" },
  { name: "Guardian Eye Care Products", gstin: "33AACCG6667Q1Z5", state: "Tamil Nadu", address: "55 Porur High Road, Porur, Chennai - 600116", phone: "98400 88001", email: "orders@guardianeye.example.in", contact_person: "Divya Prakash" },
  { name: "Polaroid Eyewear Distributors", gstin: "33AAFCP7778R1Z2", state: "Tamil Nadu", address: "210 Anna Salai, Mount Road, Chennai - 600002", phone: "98400 99112", email: "dist@polaroideyewear.example.in", contact_person: "Vikram Shah" },
  { name: "Vaigai Vision Traders", gstin: "33AABCV8889S1Z6", state: "Tamil Nadu", address: "12 KK Nagar, Madurai - 625020", phone: "98431 10123", email: "vaigaivision@traders.example.in", contact_person: "Karthik Iyer" },
  { name: "Coromandel Optical Agencies", gstin: "33AACCO9990T1Z4", state: "Tamil Nadu", address: "9 Gandhi Road, Kanchipuram - 631502", phone: "98412 21234", email: "agency@coromandeloptical.example.in", contact_person: "Lakshmi Venkat" },
  { name: "Thendral Lens Importers", gstin: "33AAECT1011U1Z8", state: "Tamil Nadu", address: "28 GST Road, Tambaram Sanatorium, Chennai - 600047", phone: "98400 12135", email: "import@thendrallens.example.in", contact_person: "Arun Prasad" },
  { name: "Marina Eyewear Traders", gstin: "33AABCM2122V1Z3", state: "Tamil Nadu", address: "68 Egmore High Road, Egmore, Chennai - 600008", phone: "98400 23246", email: "marina@eyewear.example.in", contact_person: "Nandini Rao" },
  { name: "Zenn Optical Supplies India", gstin: "33AAECZ3233W1Z9", state: "Tamil Nadu", address: "17 Sholinganallur Main Road, Chennai - 600119", phone: "98400 34357", email: "supply@zennoptical.example.in", contact_person: "Michael Fernandes" },
];

/* ── Brands (existing ones are reused, missing ones are created) ──────────── */
export const BRANDS = {
  frame: ["Ray-Ban", "Vogue", "Oakley", "Titan", "Persol", "Polaroid", "London Horse", "ROCKERS", "HIREN", "Fastrack", "Vincent Chase", "Idol Eyewear", "Bosch & lam", "Scott Eyewear"],
  sunglass: ["Ray-Ban", "Oakley", "Polaroid", "Vogue", "Persol", "Titan", "ROCKERS", "Vincent Chase", "Scott Eyewear", "Idol Eyewear"],
  contact_lens: ["Alcon", "Johnson & Johnson", "Bausch & Lomb", "CooperVision", "Aqualens"],
  accessory: ["Power Eyes", "Zeiss", "Essilor", "HIREN", "Vogue"],
};

const SHAPES = ["Round", "Square", "Rectangular", "Aviator", "Cat Eye", "Hexagonal", "Oval", "Wayfarer"];
const COLORS = ["Matte Black", "Tortoise", "Gunmetal", "Crystal Clear", "Navy Blue", "Rose Gold", "Silver", "Olive", "Burgundy", "Charcoal"];
const MATERIALS = ["Acetate", "Stainless Steel", "Titanium", "TR90", "Mixed Metal"];
const GENDERS = ["men", "women", "unisex", "kids"];
const FRAME_SIZE = ["Small", "Medium", "Large"];
const WORDS = ["Classic", "Aero", "Bold", "Slim", "Urban", "Elite", "Prime", "Swift", "Nova", "Aura", "Edge", "Flux", "Zen", "Onyx", "Vivid"];

// Deterministic pseudo-random (mulberry32)
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round10 = (n) => Math.round(n / 10) * 10;
const pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];

function frameRow(kind, rx, i, r, brand) {
  const shape = SHAPES[i % SHAPES.length];
  const word = WORDS[i % WORDS.length];
  const gender = rx ? GENDERS[i % 4] : GENDERS[(i + 1) % 4];
  const baseCost = kind === "frame" ? 520 : 850;
  const cost = round10((baseCost + i * (kind === "frame" ? 38 : 55)) * (rx ? 1.12 : 1));
  const selling = round10(cost * 1.6);
  const mrp = round10(cost * 2.05);
  return {
    kind, brand, model: `${shape} ${word} ${String(i + 1).padStart(2, "0")}`,
    collection: rx ? "Rx Series" : "Fashion Series",
    gender, cost_price: cost, mrp, selling_price: selling, tax_pct: 18,
    power_eligible: rx, hsn: kind === "sunglass" ? "900411" : "900319",
    short_desc: rx ? "Prescription-ready frame — choose your lenses" : "Ready to wear, non-prescription",
    description: `${brand} ${shape.toLowerCase()} ${kind} in ${pick(MATERIALS, r).toLowerCase()} with a ${pick(COLORS, r).toLowerCase()} finish. ${rx ? "Fits single vision, progressive and bifocal lenses." : "Zero-power style for everyday wear."}`,
    attrs: {
      shape, color: pick(COLORS, r), material: pick(MATERIALS, r), size: FRAME_SIZE[i % 3],
      lens_width: 48 + (i % 12), bridge: 16 + (i % 6), temple: 135 + (i % 16),
      lens_height: 34 + (i % 10), frame_width: 132 + (i % 20),
      ...(kind === "sunglass" ? { polarized: i % 2 ? "Yes" : "No", uv_protection: "UV400" } : {}),
    },
  };
}

function accessoryRow(i, r, brand) {
  const items = [
    ["Lens Cleaning Kit", "Microfibre cloth, spray and case in one kit"],
    ["Anti-Fog Spray", "Keeps lenses clear in humid weather"],
    ["Hard Shell Case", "Crush-proof case with soft lining"],
    ["Spectacle Chain", "Lightweight chain with silicone tips"],
    ["Nose Pad Pack", "Self-adhesive silicone nose pads (6 pcs)"],
    ["Ultrasonic Cleaner", "Portable cleaner for frames and jewellery"],
    ["Lens Wipes", "Individually wrapped alcohol-free wipes"],
    ["Kids Strap", "Adjustable strap for children's frames"],
    ["Frame Repair Kit", "Screwdriver, spare screws and nose pads"],
    ["Contact Lens Case", "Daily labelled case with mirror"],
  ];
  const [name, blurb] = items[i % items.length];
  const cost = round10(90 + (i % 20) * 45);
  const selling = round10(cost * 1.75);
  return {
    kind: "accessory", brand, model: `${name} ${String(Math.floor(i / items.length) + 1).padStart(2, "0")}`,
    collection: "Care & Accessories", gender: "unisex",
    cost_price: cost, mrp: round10(cost * 2.1), selling_price: selling, tax_pct: 18,
    power_eligible: false, hsn: "900319",
    short_desc: blurb, description: `${blurb}. Brand new, sealed retail pack.`,
    attrs: { item_type: name, color: pick(COLORS, r), size: "One Size" },
  };
}

function lensRow(type, i, r, brand) {
  const base = { monthly: 340, daily: 430, yearly: 880, toric: 720, colour: 520 }[type];
  const step = { monthly: 22, daily: 27, yearly: 44, toric: 33, colour: 24 }[type];
  const cost = round10(base + i * step);
  const label = { monthly: "Monthly", daily: "Daily", yearly: "Yearly", toric: "Toric", colour: "Colour" }[type];
  const designs = { monthly: "Monthly Disposable", daily: "Daily Disposable", yearly: "Yearly Replacement", toric: "Toric for Astigmatism", colour: "Colour Change" };
  return {
    kind: "contact_lens", brand,
    model: `${label} Comfort ${String(i + 1).padStart(2, "0")}`,
    collection: `${label} Lenses`, gender: "unisex",
    cost_price: cost, mrp: round10(cost * 1.9), selling_price: round10(cost * 1.65), tax_pct: 18,
    power_eligible: false, hsn: "900161",
    short_desc: `${designs[type]} — box of 2 lenses`,
    description: `${brand} ${designs[type].toLowerCase()} contact lens. ${type === "toric" ? "Cylinder correction for astigmatic eyes." : type === "colour" ? "Natural looking tint with UV blocking." : "Comfortable silicone hydrogel material."} Base curve 8.6, diameter 14.2 mm.`,
    attrs: {
      lens_type: type, design: designs[type], pack_size: "2 lenses",
      base_curve: "8.6", diameter: "14.2",
      sph_range: type === "toric" ? "-8.00 to +6.00" : "-10.00 to +6.00",
      ...(type === "toric" ? { cyl_range: "-0.75 to -2.25" } : {}),
      ...(type === "colour" ? { tint: "Natural" } : {}),
      replacement: { monthly: "30 days", daily: "1 day", yearly: "365 days", toric: "30 days", colour: "90 days" }[type],
    },
  };
}

/** The 375 products: 50+50 frames, 50+50 sunglasses, 50 accessories, 5×25 lenses. */
export function buildCatalog() {
  const r = rng(20261121);
  const rows = [];
  for (let i = 0; i < 50; i++) rows.push(frameRow("frame", true, i, r, BRANDS.frame[i % BRANDS.frame.length]));
  for (let i = 0; i < 50; i++) rows.push(frameRow("frame", false, i, r, BRANDS.frame[(i + 3) % BRANDS.frame.length]));
  for (let i = 0; i < 50; i++) rows.push(frameRow("sunglass", true, i, r, BRANDS.sunglass[i % BRANDS.sunglass.length]));
  for (let i = 0; i < 50; i++) rows.push(frameRow("sunglass", false, i, r, BRANDS.sunglass[(i + 4) % BRANDS.sunglass.length]));
  for (let i = 0; i < 50; i++) rows.push(accessoryRow(i, r, BRANDS.accessory[i % BRANDS.accessory.length]));
  for (const type of ["monthly", "daily", "yearly", "toric", "colour"])
    for (let i = 0; i < 25; i++) rows.push(lensRow(type, i, r, BRANDS.contact_lens[i % BRANDS.contact_lens.length]));
  return rows.map((row, idx) => ({
    ...row,
    status: "active", visible_on_website: true,
    featured: idx % 11 === 0, bestseller: idx % 7 === 0, new_arrival: idx % 13 === 0,
    price_mode: "inclusive",
    images: [],
  }));
}

/** 375 products spread round-robin across the 15 suppliers → 25 each. */
export function supplierChunks(rows) {
  const chunks = SUPPLIERS.map(() => []);
  rows.forEach((row, i) => chunks[i % SUPPLIERS.length].push(row));
  return chunks;
}

export const QTY = 10; // units of every line on every seeded PO
