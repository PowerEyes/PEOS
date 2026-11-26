export async function shrink(file: File, max = 1600): Promise<Blob> {
  const img = await createImageBitmap(file); const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = img.width * s; c.height = img.height * s;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.85));
}
export const imgUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;

/**
 * Tailwind aspect class → numeric width/height ratio, so the crop step can open
 * at exactly the shape the site will render. Understands the classes this code
 *base actually uses: `aspect-square`, `aspect-video`, `aspect-[4/3]`.
 */
export function parseAspect(cls: string): number {
  if (/\baspect-square\b/.test(cls)) return 1;
  if (/\baspect-video\b/.test(cls)) return 16 / 9;
  const frac = cls.match(/aspect-\[\s*([\d.]+)\s*\/\s*([\d.]+)\s*\]/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const bare = cls.match(/\baspect-([\d.]+)/); // e.g. aspect-21
  if (bare) return Number(bare[1]);
  return 4 / 3;
}
/** Public URL for a CMS image in the `site-images` bucket (0023). Null/empty → null so callers can fall back. */
export const siteImgUrl = (path?: string | null) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-images/${path}` : null;
