/**
 * Turns a raw Postgres/PostgREST error message into something a person can act
 * on, and passes anything already human-readable straight through.
 *
 * Why this exists: server actions and client components across both apps return
 * `error.message` straight to a toast. When a constraint, unique index or
 * numeric typmod rejects a write, that message is
 * `new row for relation "stock" violates check constraint "stock_qty_check"` —
 * correct, and useless at the counter. The database now raises readable text
 * for the cases it owns (see migrations 0028); this covers the rest, so a new
 * constraint can never leak its catalogue name into the UI.
 */
const RULES: [RegExp, string][] = [
  // Order matters: the specific, hand-written messages first.
  [/stock_qty_check/i, "Not enough stock for that change."],
  [/customers_gender_check/i, "Choose a gender: male, female or other."],
  [/(?:od|os)_axis_check/i, "Axis must be between 0 and 180."],
  [/customers_notes_check/i, "Notes must be 500 characters or fewer."],
  [/product_reviews_rating_check/i, "Rating must be between 1 and 5."],
  [/website_content_key_uniq/i, "That key is already used by another row in this section."],
  [/website_sections.*duplicate|duplicate key value/i, "That value is already in use."],

  // Classes of failure, where the specific column is not obvious from the text.
  [/numeric field overflow/i, "One of those numbers is too large for this field."],
  [/invalid input syntax for type/i, "One of those values is in the wrong format."],
  [/value too long for type/i, "One of those values is too long."],
  // Two wordings for the same thing: PostgreSQL names the relation, PostgREST
  // reports it against its schema cache. Both mean the code is sending a
  // column this table does not have.
  [/could not find the '[^']+' column of '[^']+' in the schema cache/i, "That field could not be saved — the app may be out of date. Reload the page and try again."],
  [/column "[^"]+" of relation/i, "That field could not be saved — the app may be out of date. Reload the page and try again."],
  [/row-level security/i, "You do not have permission to do that."],
  [/violates foreign-key constraint/i, "That selection is no longer available — refresh and try again."],
  [/violates not-null constraint/i, "A required field was left empty."],
  [/permission denied/i, "You do not have permission to do that."],
  [/duplicate key value/i, "That value is already in use."],
];

/** `new row for relation "sales" violates check constraint "sales_status_check"` →
 *  `That value is not allowed for sales.` — last-resort wording for a check we
 *  have no specific message for yet. */
function humaniseCheck(msg: string): string | null {
  const m = /relation "([a-z_]+)" violates check constraint "([a-z0-9_]+)"/i.exec(msg);
  if (!m) return null;
  const [, table, constraint] = m;
  // Auto-named checks are `<table>_<column>_check`; strip the table first so
  // `lab_orders_status_check` yields `status`, not `orders status`.
  const stem = constraint.startsWith(`${table}_`) ? constraint.slice(table.length + 1) : constraint;
  const column = stem.replace(/_check\d*$/, "").replace(/_/g, " ") || stem.replace(/_/g, " ");
  return `“${column}” is not an allowed value for ${table.replace(/_/g, " ")}.`;
}

/** Safe to call with `error.message` from any Supabase write. */
export function dbError(message?: string | null): string {
  if (!message) return "Something went wrong. Please try again.";
  // The rules are specific enough that a message already phrased for a human
  // (the triggers added by migration 0028, RPCs like place_sale) never matches
  // one, so it comes back exactly as written.
  for (const [re, text] of RULES) if (re.test(message)) return text;
  // Anything left that still names a relation/constraint gets plain wording;
  // anything else (network, auth, already-human text) is returned untouched.
  return humaniseCheck(message) ?? message;
}
