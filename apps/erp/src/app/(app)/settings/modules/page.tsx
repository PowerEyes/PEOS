import { redirect } from "next/navigation";
import { MODULE_REGISTRY, moduleSettingKey, toPublicSettings } from "@poweros/settings";
import { getSettingsSnapshot } from "@/lib/settings-catalog";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function fmt(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value === "" ? '""' : value;
  return JSON.stringify(value);
}

export default async function Page() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb
    .from("profiles")
    .select("role_key")
    .eq("id", user.id)
    .maybeSingle();

  if (!["owner", "admin"].includes(profile?.role_key ?? "")) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="font-display text-3xl font-semibold">Settings catalog</h1>
        <div className="card p-4 text-sm text-slate-600">
          Effective values are restricted to owners and admins.
        </div>
        <a href="/settings" className="inline-block text-sm text-navy-700 underline">
          ← Back to Settings
        </a>
      </div>
    );
  }

  const snapshot = await getSettingsSnapshot();

  const publicCount = Object.keys(toPublicSettings(snapshot)).length;
  const secretCount = snapshot.definitions.filter((definition) => definition.isSecret).length;
  const moduleRows = MODULE_REGISTRY.map((module) => {
    const resolution = snapshot.resolutions[moduleSettingKey(module.key)];
    return {
      ...module,
      enabled: resolution ? resolution.value !== false : true,
      source: resolution?.source ?? "default",
      registered: Boolean(resolution),
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Settings catalog</h1>
        <p className="text-slate-500">
          Read-only effective-value inspector. Phase 1 does not change any behaviour.
        </p>
        <a href="/settings" className="mt-2 inline-block text-sm text-navy-700 underline">
          ← Back to Settings
        </a>
      </div>

      {!snapshot.catalogLoaded && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          The DB catalog is not applied yet. Showing the built-in catalog from{" "}
          <code>@poweros/settings</code>. Apply{" "}
          <code>20261229000000_settings_control_plane.sql</code> to activate the database catalog.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Definitions", snapshot.definitions.length],
          ["Public values", publicCount],
          ["Secrets (redacted)", secretCount],
          ["Malformed values", snapshot.diagnostics.length],
          ["Org context", snapshot.context.orgId ?? "none"],
          ["Branch context", snapshot.context.branchId ?? "all branches"],
          ["Role", profile?.role_key ?? "staff"],
          ["Catalog", snapshot.catalogLoaded ? "DB" : "built-in"],
        ].map(([label, value]) => (
          <div key={String(label)} className="card p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 break-all text-sm font-medium text-slate-800">{fmt(value)}</div>
          </div>
        ))}
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold">Effective values</h2>
          <p className="text-sm text-slate-500">
            Precedence: default → org → storage column → branch override → user preference. Invalid values
            fail closed to the catalog default.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Module / section</th>
                <th className="px-3 py-2">Effective value</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Flags</th>
                <th className="px-3 py-2">Authority</th>
                <th className="px-3 py-2">Validation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshot.definitions.map((definition) => {
                const resolution = snapshot.resolutions[definition.key];
                return (
                  <tr key={definition.key} className="align-top">
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs text-slate-800">{definition.key}</div>
                      {definition.legacyKey && (
                        <div className="text-xs text-slate-400">legacy: {definition.legacyKey}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      <div>{definition.module}</div>
                      <div className="text-slate-400">{definition.section}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-xs break-words font-mono text-xs">
                        {fmt(resolution?.value)}
                      </div>
                      {resolution && !resolution.isValid && (
                        <div className="mt-1 text-xs text-rose-600">
                          raw: {fmt(resolution.rawValue)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{resolution?.source ?? "default"}</td>
                    <td className="px-3 py-2 text-xs">{definition.scope}</td>
                    <td className="px-3 py-2 text-xs">
                      <div>{definition.isPublic ? "public" : "private"}</div>
                      <div>{definition.isSecret ? "secret" : "plain"}</div>
                      {definition.affectsTransactions && (
                        <div className="text-amber-700">transactional</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {definition.writeRole ?? (definition.writePermission ? "permission" : "read-only")}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {resolution?.isValid ? (
                        <span className="text-emerald-700">ok</span>
                      ) : (
                        <span className="text-rose-700">{resolution?.error ?? "invalid"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold">Module registry</h2>
          <p className="text-sm text-slate-500">
            Registered in the shared contract. Enforcement gates are Phase 3+; values below are display-only.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Module</th>
                <th className="px-3 py-2">Area</th>
                <th className="px-3 py-2">ERP route</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Enforcement phase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {moduleRows.map((module) => (
                <tr key={module.key}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{module.label}</div>
                    <div className="font-mono text-xs text-slate-400">{module.key}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{module.area}</td>
                  <td className="px-3 py-2 font-mono text-xs">{module.route ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {module.enabled ? (
                      <span className="text-emerald-700">true</span>
                    ) : (
                      <span className="text-rose-700">false</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{module.source}</td>
                  <td className="px-3 py-2 text-xs">Phase {module.enforcementPhase}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {snapshot.diagnostics.length > 0 && (
        <section className="card p-4">
          <h2 className="font-semibold text-rose-700">Malformed values</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-700">
            {snapshot.diagnostics.map((diagnostic) => (
              <li key={diagnostic.key}>
                <code>{diagnostic.key}</code>: {diagnostic.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
