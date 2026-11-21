
"use server";
import { revalidatePath } from "next/cache";
import { dbError, fixAxis, rxRangeError, type RxValues } from "@poweros/business-rules";
import { supabaseServer } from "@/lib/supabase/server";


export async function saveExamination(fd: FormData) {
  const sb = supabaseServer();
  const { data:{ user } } = await sb.auth.getUser();
  if (!user) return { error:"Not logged in" };

  const { data: profile } = await sb.from("profiles").select("full_name,branch_id").eq("id",user.id).single();

  const get  = (k:string) => fd.get(k)?.toString()?.trim() || null;
  const getN = (k:string) => { const v=fd.get(k)?.toString(); return v && v!=="" ? Number(v) : null; };
  const appointmentId = get("appointment_id");
  const customerId    = get("customer_id")!;

  // Build the examination record
  const rec = {
    branch_id:     profile?.branch_id ?? null,
    customer_id:   customerId,
    appointment_id:appointmentId,
    examiner_name: profile?.full_name ?? "Staff",
    // Unaided VA
    va_od_dist_ua: get("va_od_dist_ua"), va_os_dist_ua: get("va_os_dist_ua"),
    va_od_near_ua: get("va_od_near_ua"), va_os_near_ua: get("va_os_near_ua"),
    // Aided VA
    va_od_dist_a:  get("va_od_dist_a"),  va_os_dist_a:  get("va_os_dist_a"),
    va_od_near_a:  get("va_od_near_a"),  va_os_near_a:  get("va_os_near_a"),
    // Auto-refractor
    ar_od_sph: getN("ar_od_sph"), ar_od_cyl: getN("ar_od_cyl"), ar_od_axis: getN("ar_od_axis"),
    ar_os_sph: getN("ar_os_sph"), ar_os_cyl: getN("ar_os_cyl"), ar_os_axis: getN("ar_os_axis"),
    // Final Rx
    od_sph: getN("od_sph"), od_cyl: getN("od_cyl"), od_axis: getN("od_axis"), od_add: getN("od_add"), od_va: get("od_va"),
    os_sph: getN("os_sph"), os_cyl: getN("os_cyl"), os_axis: getN("os_axis"), os_add: getN("os_add"), os_va: get("os_va"),
    pd_far:  getN("pd_far"), pd_near: getN("pd_near"),
    // Clinical
    cover_test: get("cover_test") ?? "orthophoria",
    iop_od: getN("iop_od"), iop_os: getN("iop_os"),
    colour_vision: get("colour_vision") ?? "normal",
    confrontation: get("confrontation") ?? "full",
    anterior_od:   get("anterior_od")   ?? "clear",
    anterior_os:   get("anterior_os")   ?? "clear",
    fundus_od:     get("fundus_od"),     fundus_os:     get("fundus_os"),
    disc_od:       get("disc_od"),       disc_os:       get("disc_os"),
    cup_disc_od:   get("cup_disc_od"),   cup_disc_os:   get("cup_disc_os"),
    macula_od:     get("macula_od"),     macula_os:     get("macula_os"),
    vessels_od:    get("vessels_od"),    vessels_os:    get("vessels_os"),
    rx_type:                get("rx_type"),
    recommended_index:      getN("recommended_index"),
    lens_recommendation:    get("lens_recommendation"),
    notes:                  get("notes"),
    next_review_months:     getN("next_review_months") ?? 24,
  };

  // Axis is an `int` in both tables: 90.5 fails the cast and 185 fails the
  // 0..180 check, and this form's inputs are free text. Round and bound before
  // anything is written, and say which value is wrong rather than letting
  // Postgres phrase it.
  // Validate the ORIGINAL values (before fixAxis clamps them) so out-of-range
  // axes are rejected rather than silently rewritten to 180.
  const rawOdAxis = rec.od_axis; const rawOsAxis = rec.os_axis;
  const rangeErr = rxRangeError({
    od: { sph: rec.od_sph, cyl: rec.od_cyl, axis: rawOdAxis, add: rec.od_add, va_dist: rec.od_va ?? "", va_near: "" },
    os: { sph: rec.os_sph, cyl: rec.os_cyl, axis: rawOsAxis, add: rec.os_add, va_dist: rec.os_va ?? "", va_near: "" },
    pd_far: rec.pd_far, pd_near: rec.pd_near,
  } satisfies RxValues);
  if (rangeErr) return { error: rangeErr };
  rec.od_axis = fixAxis(rec.od_axis);
  rec.os_axis = fixAxis(rec.os_axis);

  // The prescription is written BEFORE the examination. It used to be written
  // second with its error swallowed, so a rejected row left an examination
  // behind while the confirmation screen claimed a prescription existed.
  // Writing it first means a bad value aborts before anything is saved, and a
  // retry cannot leave a duplicate examination.
  const hasRx = rec.od_sph !== null || rec.os_sph !== null;
  let prescriptionId: string | null = null;
  if (hasRx) {
    const reviewMonths = rec.next_review_months ?? 24;
    const validTill = new Date(); validTill.setMonth(validTill.getMonth() + reviewMonths);
    const { data: rx, error: rxErr } = await sb.from("prescriptions").insert({
      customer_id: customerId,
      rx_type:     rec.rx_type ?? "single_vision",
      od_sph: rec.od_sph, od_cyl: rec.od_cyl, od_axis: rec.od_axis, od_add: rec.od_add,
      os_sph: rec.os_sph, os_cyl: rec.os_cyl, os_axis: rec.os_axis, os_add: rec.os_add,
      pd_far:  rec.pd_far, pd_near: rec.pd_near,
      rx_date: new Date().toISOString().slice(0,10),
      valid_till: validTill.toISOString().slice(0,10),
      examined_by: rec.examiner_name,
      // prescriptions stores this as `remarks` — there is no `notes` column, so
      // this failed on every examination and the error was discarded.
      remarks: rec.notes,
    }).select("id").single();
    if (rxErr) return { error: dbError(rxErr.message) };
    prescriptionId = rx?.id ?? null;
  }

  const { data: exam, error } = await sb.from("eye_examinations").insert({ ...rec, prescription_id: prescriptionId }).select("id").single();
  if (error) return { error: dbError(error.message) };

  if (hasRx && appointmentId) {
    await sb.from("appointments").update({ status:"completed" }).eq("id", appointmentId);
  }

  revalidatePath("/appointments");
  return { ok: true, examId: exam.id };
}

export async function getExamination(appointmentId: string) {
  const { data } = await supabaseServer().from("eye_examinations")
    .select("*").eq("appointment_id", appointmentId).maybeSingle();
  return data;
}
