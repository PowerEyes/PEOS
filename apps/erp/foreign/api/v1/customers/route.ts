import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function getTenantFromApiKey(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // In production, validate against api_keys table
  // For now, use a simple env-based key
  if (apiKey !== process.env.ERP_API_KEY) return null;

  // Return a default tenant for demo; in production, look up from api_keys
  return { tenant_id: request.headers.get("x-tenant-id") || "", supabase };
}

export async function GET(request: Request) {
  const ctx = await getTenantFromApiKey(request);
  if (!ctx) {
    return NextResponse.json(
      { error: { code: "AUTH_REQUIRED", message: "Invalid or missing API key", recovery: "Provide a valid API key in Authorization header" } },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = (page - 1) * limit;

  const { data, error, count } = await ctx.supabase
    .from("customers")
    .select("id, name, phone, email, created_at", { count: "exact" })
    .eq("tenant_id", ctx.tenant_id)
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: error.message, recovery: "Try again" } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data,
    pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
  });
}