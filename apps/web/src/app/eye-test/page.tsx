import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { notFound } from "next/navigation";
import { EyeTestBooking } from "./booking";
import { getPage } from "@/lib/pages";
import { supabasePublic } from "@/lib/supabase/server";
export const revalidate = 60;
export const metadata = { title: "Book an Eye Test – Power Eyes Opticals" };
export default async function Page() {
  const [cfg, { data: br }] = await Promise.all([getPage("eye-consultation"), supabasePublic().from("branches").select("name").eq("is_active", true).order("name")]);
  if (!cfg) notFound(); // switched off in Website Studio
  return <div className="min-h-screen bg-white"><Header/><EyeTestBooking cfg={{ title: cfg.title, subtitle: cfg.subtitle ?? "", ...cfg.body }} branches={(br ?? []).map((b: any) => b.name)}/><Footer/></div>;
}
