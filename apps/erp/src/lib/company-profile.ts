// Company profile data kept in org_settings (key → jsonb): documents, branding
// and policy texts. Pure normalisers — every write goes through the same
// validation the unit tests pin down, and an invalid shape returns null so the
// server action can refuse instead of storing junk.

export const DOC_KINDS = ["license", "registration", "certification", "insurance", "other"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export type CompanyDoc = {
  title: string;
  kind: DocKind;
  number: string;
  issued_on: string;
  expires_on: string;
  notes: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_DOCS = 50;

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const cap = (s: string, n: number) => s.slice(0, n);

/** Rows → CompanyDoc[]. Invalid row shape, empty/oversized title or a bad date
 *  returns null (refuse the whole save — partial writes hide mistakes). */
export function normalizeDocuments(input: unknown): CompanyDoc[] | null {
  if (!Array.isArray(input) || input.length > MAX_DOCS) return null;
  const out: CompanyDoc[] = [];
  for (const row of input) {
    if (typeof row !== "object" || row === null) return null;
    const r = row as Record<string, unknown>;
    const title = trim(r.title);
    if (!title || title.length > 120) return null;
    const issued = trim(r.issued_on);
    const expires = trim(r.expires_on);
    if ((issued && !DATE.test(issued)) || (expires && !DATE.test(expires))) return null;
    if (issued && expires && expires < issued) return null;
    const kind = trim(r.kind);
    out.push({
      title: cap(title, 120),
      kind: (DOC_KINDS as readonly string[]).includes(kind) ? (kind as DocKind) : "other",
      number: cap(trim(r.number), 60),
      issued_on: issued,
      expires_on: expires,
      notes: cap(trim(r.notes), 500),
    });
  }
  return out;
}

export type Branding = { logo_url: string; primary: string; accent: string };

/** Logo must be an absolute http(s) URL or a site-root path; colours must be
 *  6-digit hex — a colour picker round-trip can never store garbage. */
export function normalizeBranding(input: unknown): Branding | null {
  if (typeof input !== "object" || input === null) return null;
  const r = input as Record<string, unknown>;
  const logo = trim(r.logo_url);
  if (logo && !/^(https?:\/\/|\/)/i.test(logo)) return null;
  const primary = trim(r.primary);
  const accent = trim(r.accent);
  if (!HEX.test(primary) || !HEX.test(accent)) return null;
  return { logo_url: cap(logo, 300), primary, accent };
}

export type Policies = { returns: string; warranty: string; privacy: string };

export function normalizePolicies(input: unknown): Policies | null {
  if (typeof input !== "object" || input === null) return null;
  const r = input as Record<string, unknown>;
  const get = (k: string) => {
    const v = trim(r[k]);
    return v.length > 4000 ? null : v;
  };
  const returns = get("returns");
  const warranty = get("warranty");
  const privacy = get("privacy");
  if (returns === null || warranty === null || privacy === null) return null;
  return { returns, warranty, privacy };
}

/** Whole days from today (UTC) until a YYYY-MM-DD date: negative = past.
 *  Drives the "expires in N days" badge on the documents page. */
export function daysUntil(date: string): number | null {
  if (!DATE.test(date)) return null;
  const t = Date.parse(date + "T00:00:00Z");
  if (Number.isNaN(t)) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((t - today) / 86400000);
}
