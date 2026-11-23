import { supabasePublic } from "@/lib/supabase/server";
import { getPage } from "@/lib/pages";
import { siteImgUrl } from "@/lib/types";
import { ContactView } from "./view";
export const revalidate = 60;
export const metadata = { title: "Contact Us – Power Eyes Opticals" };
export default async function Page() {
  const [{ data: br }, p] = await Promise.all([supabasePublic().from("branches").select("id,name,address,phone,email,image_path").eq("is_active", true).order("name"), getPage("contact")]);
  const stores = (br ?? []).map((b: any) => ({ id: b.id, name: b.name, address: b.address, phone: b.phone, email: b.email, image: siteImgUrl(b.image_path) }));
  return <ContactView stores={stores} faqs={(p?.body.faqs as any) ?? []} hours={(p?.body.hours as string) ?? ""} title={p?.title ?? "Contact Us"} subtitle={p?.subtitle ?? ""} />;
}
