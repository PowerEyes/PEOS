import type { LensUsage } from "./lens-usage.ts";
import { shouldShowAdd } from "./lens-usage.ts";

/** Flat prescription snapshot used by lab orders (place_sale.rx_snapshot). */
export type RxSnapshot = {
  rx_code: string | null;
  od_sph: number | null;
  od_cyl: number | null;
  od_axis: number | null;
  od_add: number | null;
  os_sph: number | null;
  os_cyl: number | null;
  os_axis: number | null;
  os_add: number | null;
  pd_far: number | null;
  pd_near: number | null;
  usage: string | null;
  requires_add: boolean;
  captured_at: string;
};

const num = (value: unknown): number | null => {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const clean = (value: unknown, n: number) => typeof value === "string" ? value.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n) : "";

/** Convert the configurator's nested Rx form value into the flat lab shape. */
export function toRxSnapshot(rx: any, usage?: LensUsage | null): RxSnapshot {
  const od = rx?.od ?? {};
  const os = rx?.os ?? {};
  const addAllowed = shouldShowAdd(usage);
  return {
    rx_code: clean(rx?.rx_code ?? rx?.code, 40) || null,
    od_sph: num(od.sph),
    od_cyl: num(od.cyl),
    od_axis: num(od.axis),
    od_add: addAllowed ? num(od.add) : null,
    os_sph: num(os.sph),
    os_cyl: num(os.cyl),
    os_axis: num(os.axis),
    os_add: addAllowed ? num(os.add) : null,
    pd_far: num(rx?.pd_far),
    pd_near: num(rx?.pd_near),
    usage: usage?.code ?? null,
    requires_add: Boolean(usage?.requires_add),
    captured_at: new Date().toISOString(),
  };
}

export function needsPrescription(usage?: LensUsage | null): boolean {
  if (!usage) return true;
  return usage.requires_rx !== false && usage.code !== "non_rx";
}

export function prescriptionIsComplete(usage: LensUsage | undefined, rx: any): boolean {
  if (!needsPrescription(usage)) return true;
  const snap = toRxSnapshot(rx, usage);
  if (snap.od_sph == null || snap.os_sph == null) return false;
  if ((snap.od_cyl != null && Math.abs(snap.od_cyl) > 0 && snap.od_axis == null) ||
      (snap.os_cyl != null && Math.abs(snap.os_cyl) > 0 && snap.os_axis == null)) return false;
  if (usage?.requires_add || ADD_REQUIRED.has(usage?.code ?? "")) {
    if (snap.od_add == null || snap.os_add == null || snap.od_add <= 0 || snap.os_add <= 0) return false;
  }
  return true;
}

const ADD_REQUIRED = new Set(["progressive", "reading", "bifocal"]);

export function rxSummary(snapshot: RxSnapshot | null | undefined): string {
  if (!snapshot) return "";
  const bits = [
    `OD ${snapshot.od_sph ?? "—"}/${snapshot.od_cyl ?? "—"}`,
    `OS ${snapshot.os_sph ?? "—"}/${snapshot.os_cyl ?? "—"}`,
  ];
  if (snapshot.od_add != null || snapshot.os_add != null) {
    bits.push(`ADD ${snapshot.od_add ?? "—"}/${snapshot.os_add ?? "—"}`);
  }
  return bits.join(" | ");
}
