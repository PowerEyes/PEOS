import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export type AuditAction =
  | "create" | "update" | "delete" | "view" | "export" | "login" | "logout"
  | "approve" | "reject" | "invite" | "deactivate" | "reactivate"
  | "permission_change" | "subscription_change" | "settings_change";

export interface AuditEntry {
  tenant_id: string;
  user_id: string;
  action: AuditAction;
  entity_type: string;
  entity_id?: string;
  branch_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await sb.from("audit_logs").insert({
      tenant_id: entry.tenant_id,
      user_id: entry.user_id,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id || null,
      branch_id: entry.branch_id || null,
      details: entry.details || {},
      ip_address: entry.ip_address || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}

export async function getAuditLogs(tenantId: string, filters?: {
  entity_type?: string;
  user_id?: string;
  action?: AuditAction;
  from_date?: string;
  to_date?: string;
  limit?: number;
}) {
  let query = sb.from("audit_logs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });

  if (filters?.entity_type) query = query.eq("entity_type", filters.entity_type);
  if (filters?.user_id) query = query.eq("user_id", filters.user_id);
  if (filters?.action) query = query.eq("action", filters.action);
  if (filters?.from_date) query = query.gte("created_at", filters.from_date);
  if (filters?.to_date) query = query.lte("created_at", filters.to_date);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}