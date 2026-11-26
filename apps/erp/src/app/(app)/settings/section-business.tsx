"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@poweros/ui";
import { Building2, Pencil, Plus, Store } from "lucide-react";
import {
  addBranch,
  saveBranch,
  saveOrgName,
  setBranchActive,
  setDefaultPickupBranch,
} from "@/app/(app)/settings-actions";
import { ImageField } from "@/components/ImageField";
import { isSafeMapEmbed, normalizeMapEmbed } from "@/lib/branch-map";
import { L, SectionCard } from "./ui";
import { BusinessProfileSection } from "./section-profile";

type Branch = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string | null;
  udyam_no: string | null;
  code?: string;
  is_active?: boolean;
  is_default_pickup?: boolean;
  legal_name?: string | null;
  gstin?: string | null;
  timezone?: string;
  opening_hours?: Record<
    string,
    { open: string; close: string; closed: boolean }
  >;
  invoice_terms?: string | null;
  image_path?: string | null;
  image_alt?: string | null;
  map_embed?: string | null;
  /** raw map input in the edit form — normalised to `map_embed` on save */
  map?: string;
};
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_NAMES: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
const DEFAULT_HOURS = Object.fromEntries(
  DAY_KEYS.map((d, i) => [
    d,
    {
      open: i === 6 ? "10:00" : "09:30",
      close: i === 6 ? "19:00" : "20:30",
      closed: false,
    },
  ]),
);
const EMPTY = {
  code: "",
  name: "",
  address: "",
  phone: "",
  email: "",
  udyam_no: "",
  legal_name: "",
  gstin: "",
  timezone: "Asia/Kolkata",
  opening_hours: DEFAULT_HOURS,
  invoice_terms: "",
  image_path: null as string | null,
  image_alt: "",
  map: "",
};

const branchImgUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-images/${path}`;

function BranchFields({
  v,
  set,
  showCode = false,
}: {
  v: any;
  set: (patch: any) => void;
  showCode?: boolean;
}) {
  const [preview, setPreview] = useState<{ url: string; error?: string }>({
    url: "",
  });
  // Debounced so typing an address doesn't reload the preview iframe per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setPreview(normalizeMapEmbed(v.map ?? "")), 500);
    return () => clearTimeout(t);
  }, [v.map]);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {showCode && (
        <L
          t="Branch code"
          hint="Permanent short code used in staff and operational records."
        >
          <input
            className="field uppercase"
            maxLength={12}
            value={v.code ?? ""}
            onChange={(e) => set({ ...v, code: e.target.value.toUpperCase() })}
            placeholder="EAST"
          />
        </L>
      )}
      <L t="Branch name">
        <input
          className="field"
          value={v.name}
          onChange={(e) => set({ ...v, name: e.target.value })}
        />
      </L>
      <L t="Phone">
        <input
          className="field"
          value={v.phone}
          onChange={(e) => set({ ...v, phone: e.target.value })}
        />
      </L>
      <div className="sm:col-span-2">
        <L t="Address">
          <textarea
            className="field"
            rows={2}
            value={v.address}
            onChange={(e) => set({ ...v, address: e.target.value })}
          />
        </L>
      </div>
      <L t="Email">
        <input
          className="field"
          value={v.email ?? ""}
          onChange={(e) => set({ ...v, email: e.target.value })}
        />
      </L>
      <L t="UDYAM number">
        <input
          className="field"
          value={v.udyam_no ?? ""}
          onChange={(e) => set({ ...v, udyam_no: e.target.value })}
        />
      </L>
      <L t="Branch legal name">
        <input
          className="field"
          value={v.legal_name ?? ""}
          onChange={(e) => set({ ...v, legal_name: e.target.value })}
        />
      </L>
      <L t="Branch GSTIN">
        <input
          className="field uppercase"
          maxLength={15}
          value={v.gstin ?? ""}
          onChange={(e) => set({ ...v, gstin: e.target.value.toUpperCase() })}
          placeholder="Optional; overrides business GSTIN"
        />
      </L>
      <L t="Branch timezone">
        <input
          className="field"
          value={v.timezone ?? "Asia/Kolkata"}
          onChange={(e) => set({ ...v, timezone: e.target.value })}
        />
      </L>
      <L t="Invoice terms">
        <input
          className="field"
          maxLength={250}
          value={v.invoice_terms ?? ""}
          onChange={(e) => set({ ...v, invoice_terms: e.target.value })}
          placeholder="Optional payment / return terms"
        />
      </L>
      <div className="sm:col-span-2 rounded-xl border border-slate-100 p-3">
        <p className="mb-2 text-sm font-medium">Opening hours</p>
        <div className="space-y-2">
          {DAY_KEYS.map((day) => {
            const h = v.opening_hours?.[day] ?? DEFAULT_HOURS[day];
            return (
              <div
                key={day}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 text-xs"
              >
                <span>{DAY_NAMES[day]}</span>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={h.closed}
                    onChange={(e) =>
                      set({
                        ...v,
                        opening_hours: {
                          ...(v.opening_hours ?? DEFAULT_HOURS),
                          [day]: { ...h, closed: e.target.checked },
                        },
                      })
                    }
                  />
                  Closed
                </label>
                <input
                  aria-label={`${DAY_NAMES[day]} opens`}
                  type="time"
                  className="field py-1"
                  disabled={h.closed}
                  value={h.open}
                  onChange={(e) =>
                    set({
                      ...v,
                      opening_hours: {
                        ...(v.opening_hours ?? DEFAULT_HOURS),
                        [day]: { ...h, open: e.target.value },
                      },
                    })
                  }
                />
                <input
                  aria-label={`${DAY_NAMES[day]} closes`}
                  type="time"
                  className="field py-1"
                  disabled={h.closed}
                  value={h.close}
                  onChange={(e) =>
                    set({
                      ...v,
                      opening_hours: {
                        ...(v.opening_hours ?? DEFAULT_HOURS),
                        [day]: { ...h, close: e.target.value },
                      },
                    })
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="sm:col-span-2">
        <ImageField
          value={v.image_path}
          onChange={(p) => set({ ...v, image_path: p })}
          alt={v.image_alt ?? ""}
          onAltChange={(x) => set({ ...v, image_alt: x })}
          bucket="site-images"
          aspect="aspect-[16/6]"
          label="Branch photo"
          fallbackIcon="🏪"
          hint="Shown on the website homepage and store locator."
          crop
        />
      </div>
      <div className="sm:col-span-2">
        <L
          t="Google Map"
          hint="Paste the embed HTML from Google Maps (Share → Embed a map), any Google Maps link, or just the address — it is converted to a safe embed on save."
        >
          <div className="flex gap-2">
            <input
              className="field"
              value={v.map ?? ""}
              placeholder={"<iframe …> or a Google Maps link or address"}
              onChange={(e) => set({ ...v, map: e.target.value })}
            />
            <button
              type="button"
              disabled={!v.address?.trim()}
              onClick={() => set({ ...v, map: v.address })}
              className="btn btn-ghost shrink-0 whitespace-nowrap text-xs"
            >
              Use address
            </button>
          </div>
        </L>
        {preview.error && (
          <p className="mt-1 text-[11px] leading-snug text-rose-600">
            {preview.error}
          </p>
        )}
        {preview.url && (
          <iframe
            src={preview.url}
            title="Map preview"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="mt-2 h-44 w-full rounded-xl border border-slate-200"
          />
        )}
      </div>
    </div>
  );
}

export function BusinessSection({
  orgName,
  organization,
  branches,
  canEdit,
}: {
  orgName: string;
  organization: any;
  branches: Branch[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(orgName);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Branch | null>(null);
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);

  async function run(
    fn: () => Promise<{ error?: string; ok?: string }>,
    after?: () => void,
  ) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.error) return toast(r.error, "err");
    toast(r.ok!);
    after?.();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Business profile"
        icon={Building2}
        footer={
          canEdit ? (
            <button
              disabled={busy}
              onClick={() => run(() => saveOrgName(name))}
              className="btn btn-gold"
            >
              {busy ? "Saving…" : "Save business name"}
            </button>
          ) : null
        }
      >
        <L
          t="Business name"
          hint="Shown on invoices, the website and customer messages."
        >
          <input
            className="field"
            value={name}
            disabled={!canEdit}
            onChange={(e) => setName(e.target.value)}
          />
        </L>
      </SectionCard>
      <BusinessProfileSection value={organization} canEdit={canEdit} />

      <SectionCard
        title="Branches"
        icon={Store}
        footer={
          canEdit && !adding ? (
            <button onClick={() => setAdding(true)} className="btn btn-ghost">
              <Plus size={15} />
              Add branch
            </button>
          ) : null
        }
      >
        {adding && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">New branch</p>
            <BranchFields v={nf} set={setNf} showCode />
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() =>
                  run(
                    () => addBranch(nf),
                    () => {
                      setAdding(false);
                      setNf({ ...EMPTY });
                    },
                  )
                }
                className="btn btn-gold text-sm"
              >
                {busy ? "Adding…" : "Add branch"}
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setNf({ ...EMPTY });
                }}
                className="btn btn-ghost text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {branches.length === 0 && (
          <p className="text-sm text-slate-500">No branches yet.</p>
        )}
        {branches.map((b) =>
          editId === b.id && form ? (
            <div
              key={b.id}
              className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <BranchFields v={form} set={setForm} />
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => saveBranch(form),
                      () => {
                        setEditId(null);
                        setForm(null);
                      },
                    )
                  }
                  className="btn btn-gold text-sm"
                >
                  {busy ? "Saving…" : "Save branch"}
                </button>
                <button
                  onClick={() => {
                    setEditId(null);
                    setForm(null);
                  }}
                  className="btn btn-ghost text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={b.id}
              className="space-y-1 rounded-xl border border-slate-100 p-4 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {b.name}{" "}
                    {b.code && (
                      <span className="text-slate-400">({b.code})</span>
                    )}
                  </p>
                  <div className="mt-1 flex gap-2 text-[11px]">
                    <span
                      className={
                        b.is_active ? "text-emerald-700" : "text-slate-500"
                      }
                    >
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                    {b.is_default_pickup && (
                      <span className="text-blue-700">Default pickup</span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    {!b.is_default_pickup && b.is_active && (
                      <button
                        disabled={busy}
                        onClick={() => run(() => setDefaultPickupBranch(b.id))}
                        className="btn btn-ghost px-2 py-1 text-xs"
                      >
                        Make pickup default
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (
                          b.is_active &&
                          !window.confirm(
                            `Deactivate ${b.name}? It will no longer be offered for pickup; existing records will remain.`,
                          )
                        )
                          return;
                        void run(
                          () => setBranchActive(b.id, !b.is_active),
                          () => {
                            if (editId === b.id) {
                              setEditId(null);
                              setForm(null);
                            }
                          },
                        );
                      }}
                      className="btn btn-ghost px-2 py-1 text-xs"
                    >
                      {b.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                    <button
                      onClick={() => {
                        setEditId(b.id);
                        setForm({
                          ...b,
                          image_alt: b.image_alt ?? "",
                          map: b.map_embed ?? "",
                          timezone: b.timezone ?? "Asia/Kolkata",
                          opening_hours: Object.keys(b.opening_hours ?? {})
                            .length
                            ? b.opening_hours
                            : DEFAULT_HOURS,
                        });
                      }}
                      className="btn btn-ghost px-2 py-1 text-xs"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                  </div>
                )}
              </div>
              {b.image_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branchImgUrl(b.image_path)}
                  alt={b.image_alt || b.name}
                  loading="lazy"
                  className="mt-2 h-36 w-full rounded-xl object-cover"
                />
              )}
              <p className="text-slate-600">{b.address}</p>
              <p className="text-slate-600">
                {b.phone}
                {b.email ? ` | ${b.email}` : ""}
              </p>
              {b.gstin && (
                <p className="font-mono text-xs text-slate-500">
                  GSTIN: {b.gstin}
                </p>
              )}
              {b.invoice_terms && (
                <p className="text-xs text-slate-500">
                  Invoice terms: {b.invoice_terms}
                </p>
              )}
              {b.udyam_no && (
                <p className="text-slate-500">UDYAM: {b.udyam_no}</p>
              )}
              {isSafeMapEmbed(b.map_embed) && (
                <iframe
                  src={b.map_embed as string}
                  title={`Map — ${b.name}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="mt-2 h-44 w-full rounded-xl border border-slate-200"
                />
              )}
            </div>
          ),
        )}
      </SectionCard>
    </div>
  );
}
