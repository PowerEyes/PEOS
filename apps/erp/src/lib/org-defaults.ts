"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
// Organisation defaults (city / state / pincode) come from org_settings, never from code.
export function useOrgDefaults() {
  const [d, setD] = useState({ city: "", state: "", pincode: "" });
  useEffect(() => {
    supabaseBrowser().from("org_settings").select("key,value").in("key", ["default_city", "default_state", "default_pincode"])
      .then(({ data }) => { const m: Record<string, string> = {}; (data ?? []).forEach((r: any) => { m[r.key] = String(r.value ?? ""); });
        setD({ city: m.default_city ?? "", state: m.default_state ?? "", pincode: m.default_pincode ?? "" }); });
  }, []);
  return d;
}
