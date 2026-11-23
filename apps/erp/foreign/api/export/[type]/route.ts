import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const EXPORTABLE_TABLES = ["customers", "products", "sales", "prescriptions", "inventory"] as const;
type ExportType = (typeof EXPORTABLE_TABLES)[number];

function toCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export async function GET(
  request: Request,
  { params }: { params: { type: string } }
) {
  const type = params.type as ExportType;

  if (!EXPORTABLE_TABLES.includes(type)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: `Invalid export type: ${type}`, recovery: `Use one of: ${EXPORTABLE_TABLES.join(", ")}` } },
      { status: 400 }
    );
  }

  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: { code: "AUTH_REQUIRED", message: "Authentication required", recovery: "Log in to export data" } },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // In production, extract tenant_id from the auth token
    // For now, use a query param
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenant_id");

    if (!tenantId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "tenant_id is required", recovery: "Provide tenant_id as query param" } },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from(type)
      .select("*")
      .eq("tenant_id", tenantId);

    if (error) {
      return NextResponse.json(
        { error: { code: "UNKNOWN", message: error.message, recovery: "Try again or contact support" } },
        { status: 500 }
      );
    }

    const format = url.searchParams.get("format") || "csv";

    if (format === "json") {
      return NextResponse.json({ data, count: data?.length || 0 });
    }

    const csv = toCSV(data || []);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${type}-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: "Export failed", recovery: "Try again or contact support" } },
      { status: 500 }
    );
  }
}