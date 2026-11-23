import { NextResponse } from "next/server";
import { supabasePublic } from "@/lib/supabase/server";

export const dynamic="force-dynamic";
export async function GET(){
  const {data,error}=await supabasePublic().from("branches").select("id,name,is_default_pickup").eq("is_active",true).order("name");
  if(error)return NextResponse.json({error:"Store locations are unavailable."},{status:503,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({branches:data??[]},{headers:{"Cache-Control":"public, max-age=60, stale-while-revalidate=300"}});
}
