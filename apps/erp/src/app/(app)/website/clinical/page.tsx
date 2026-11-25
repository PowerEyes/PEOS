import {supabaseServer} from "@/lib/supabase/server";import {ClinicalServicesStudio} from "./view";
export default async function ClinicalControllerPage(){const {data,error}=await supabaseServer().from("clinical_services").select("*").order("display_order");return <ClinicalServicesStudio rows={data||[]} loadError={error?.message||null}/>}
