"use server";
import { revalidatePath } from "next/cache";
import { dbError } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";
type R = { error?: string; ok?: string };
// Top-level website routes that already exist (they win over a custom page with the same slug), plus internal prefixes.
const RESERVED = new Set(["about", "accessories", "api", "blog", "cart", "checkout", "clinic", "clinical-services", "collections", "compare", "computer-glasses", "contact", "contact-lenses", "eye-test", "eyeglasses", "faq", "forgot-password", "help-me-choose", "kids", "lab", "lenses", "login", "my", "offers", "print", "privacy", "product", "reset-password", "returns", "search", "store", "store-locator", "sunglasses", "terms", "track-order", "wishlist", "robots", "sitemap"]);
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// Row-level security (admin-only insert/update/delete, org-scoped) is the real gate; these actions add validation and revalidation.
export async function createPage(input: { title: string; slug?: string; subtitle?: string; show_in_nav?: boolean }): Promise<R & { id?: string }> {
  const title = input.title.trim(), slug = slugify(input.slug || title);
  if (title.length < 2) return { error: "Enter a page title." };
  if (!slug) return { error: "Enter a valid web address (letters, numbers and dashes)." };
  if (RESERVED.has(slug) || slug.startsWith("guide-") || slug.startsWith("hero-")) return { error: `"${slug}" is reserved. Choose a different web address.` };
  const sb = supabaseServer();
  const { count } = await sb.from("site_pages").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (count) return { error: `A page with the address /${slug} already exists.` };
  const { data: last } = await sb.from("site_pages").select("display_order").order("display_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await sb.from("site_pages").insert({ slug, kind: "page", title, subtitle: input.subtitle?.trim() || null, body: { sections: [] }, is_active: false, show_in_nav: !!input.show_in_nav, display_order: (last?.display_order ?? 0) + 10 }).select("id").single();
  if (error) return { error: dbError(error.message) };
  revalidatePath("/website/pages"); return { ok: `Page created as hidden. Add content, then turn it on to publish at /${slug}.`, id: data.id };
}

export async function renamePage(id: string, slug: string): Promise<R> {
  const next = slugify(slug);
  if (!next) return { error: "Enter a valid web address (letters, numbers and dashes)." };
  if (RESERVED.has(next) || next.startsWith("guide-") || next.startsWith("hero-")) return { error: `"${next}" is reserved. Use Edit for built-in pages instead.` };
  const sb = supabaseServer();
  const { data: p } = await sb.from("site_pages").select("slug,is_system").eq("id", id).maybeSingle();
  if (!p) return { error: "Page not found." };
  if (p.is_system) return { error: "Built-in page addresses cannot be changed. Edit the existing page instead." };
  if (next === p.slug) return { ok: "Web address unchanged." };
  const { count } = await sb.from("site_pages").select("id", { count: "exact", head: true }).eq("slug", next);
  if (count) return { error: `A page with the address /${next} already exists.` };
  const { error } = await sb.from("site_pages").update({ slug: next }).eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/website/pages"); return { ok: `Web address changed to /${next}.` };
}

export async function restorePages(): Promise<R> {
  const sb = supabaseServer();
  const { data, error } = await sb.rpc("admin_restore_site_pages");
  if (error) return { error: dbError(error.message) };
  const added = Number(data ?? 0);
  revalidatePath("/website/pages");
  return { ok: added > 0 ? `Restored ${added} built-in page${added === 1 ? "" : "s"}. Existing content was left untouched.` : "All built-in pages are already present." };
}

export async function deletePage(id: string): Promise<R> {
  const sb = supabaseServer();
  const { data: p } = await sb.from("site_pages").select("is_system,title").eq("id", id).maybeSingle();
  if (!p) return { error: "Page not found." };
  if (p.is_system) return { error: "Built-in pages cannot be deleted. Hide the page instead." };
  const { error } = await sb.from("site_pages").delete().eq("id", id);
  if (error) return { error: dbError(error.message) };
  revalidatePath("/website/pages"); return { ok: `Deleted "${p.title}".` };
}
