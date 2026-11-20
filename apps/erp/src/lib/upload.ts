import { supabaseBrowser } from "@/lib/supabase/client";
import { dbError } from "@poweros/business-rules";

/**
 * The caller's organisation folder inside a storage bucket. Every image this
 * app uploads lives under `<org_id>/<uuid>.jpg` so RLS on the bucket can be
 * written as "your own folder, and only if you're an admin" (0023).
 *
 * Throws rather than returning null: callers are upload paths, and silently
 * writing to a guessed folder would be worse than failing.
 */
export async function orgFolder(): Promise<string> {
  const { data, error } = await supabaseBrowser().from("profiles").select("org_id").single();
  const org = data?.org_id;
  if (!org) throw new Error(error?.message ?? "No organisation on your profile — can't choose a folder.");
  return org;
}

/**
 * Upload a prepared JPEG to Supabase Storage and return its storage path.
 *
 * Takes an already-encoded blob rather than a File so both callers work: the
 * single-image field passes `await shrink(file)` (client-side resize), and the
 * crop step passes a canvas blob that is already the target shape. Content type
 * is always JPEG because both encoders emit JPEG.
 */
export async function putImage(blob: Blob, bucket = "site-images"): Promise<string> {
  const org = await orgFolder();
  const path = `${org}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabaseBrowser().storage.from(bucket).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error(dbError(error.message));
  return path;
}
