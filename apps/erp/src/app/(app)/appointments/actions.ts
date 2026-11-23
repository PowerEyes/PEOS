"use server";
import { subscriptionGate } from "@/lib/entitlements";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { dbError } from "@poweros/business-rules";

const input = z.object({ customer_id:z.string().uuid(), branch_id:z.string().uuid(), appt_type:z.enum(["Eye Test","Contact Lens Fitting","Follow Up","Consultation","Other"]), appt_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), appt_time:z.string().regex(/^\d{2}:\d{2}$/), duration_mins:z.number().int().min(10).max(240), optometrist:z.string().max(120).nullable(), notes:z.string().max(1000).nullable(), status:z.enum(["scheduled","confirmed","arrived","completed","cancelled","no_show"]) });
async function client() { const sb=supabaseServer(),{data:{user}}=await sb.auth.getUser(); return user?{sb,user}:{error:"Sign in to manage appointments."}; }
export async function createAppointment(value:unknown) {
  const gate = await subscriptionGate(); if (gate) return gate;
  const p=input.safeParse(value); if(!p.success)return{error:p.error.issues[0]?.message??"Invalid appointment."};
  const c=await client();if("error"in c)return c;
  const {data:can}=await c.sb.rpc("can_access_branch",{b:p.data.branch_id});if(!can)return{error:"You cannot book at that branch."};
  const {data,error}=await c.sb.from("appointments").insert(p.data).select("id").single();
  if(error)return{error:dbError(error.message)};revalidatePath("/appointments");return{id:data.id};
}
export async function editAppointment(id:string, value:unknown) {
  const gate = await subscriptionGate(); if (gate) return gate;
  if(!z.string().uuid().safeParse(id).success)return{error:"Invalid appointment."};
  const p=input.omit({customer_id:true,branch_id:true}).safeParse(value);if(!p.success)return{error:p.error.issues[0]?.message??"Invalid appointment."};
  const c=await client();if("error"in c)return c;
  const {data:old}=await c.sb.from("appointments").select("id,branch_id").eq("id",id).maybeSingle();if(!old)return{error:"Appointment not found."};
  const {data:can}=await c.sb.rpc("can_access_branch",{b:old.branch_id});if(!can)return{error:"You cannot edit appointments at that branch."};
  const {error}=await c.sb.from("appointments").update({...p.data,updated_at:new Date().toISOString()}).eq("id",id);
  if(error)return{error:dbError(error.message)};revalidatePath("/appointments");return{ok:true};
}
export async function setAppointmentStatus(id:string, status:string) {
  const gate = await subscriptionGate(); if (gate) return gate;
  if(!z.string().uuid().safeParse(id).success||!input.shape.status.safeParse(status).success)return{error:"Invalid appointment status."};
  const c=await client();if("error"in c)return c;
  const {data:old}=await c.sb.from("appointments").select("id,branch_id").eq("id",id).maybeSingle();if(!old)return{error:"Appointment not found."};
  const {data:can}=await c.sb.rpc("can_access_branch",{b:old.branch_id});if(!can)return{error:"You cannot change appointments at that branch."};
  const {error}=await c.sb.from("appointments").update({status,updated_at:new Date().toISOString()}).eq("id",id);
  if(error)return{error:dbError(error.message)};revalidatePath("/appointments");return{ok:true};
}
