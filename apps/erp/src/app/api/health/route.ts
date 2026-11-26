import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const checks: Record<string, string> = {};

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      checks.database = "missing_env";
    } else {
      const supabase = createClient(url, key);
      const { error } = await supabase.from("branches").select("id").limit(1);
      checks.database = error ? "error" : "ok";
    }
  } catch {
    checks.database = "error";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");

  return Response.json(
    {
      status: healthy ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "unknown",
    },
    { status: healthy ? 200 : 503 }
  );
}