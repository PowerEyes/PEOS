"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImagePlus, Wrench, X } from "lucide-react";
import { dbError } from "@poweros/business-rules";
import { supabaseBrowser } from "@/lib/supabase/client";
import { shrink } from "@/lib/image";

const TYPES = ["Spectacle Frame", "Sunglasses", "Contact Lens Pack", "Accessory", "Other"];
type Shot = { blob: Blob; url: string };

const L = ({ t, children, req }: { t: string; children: React.ReactNode; req?: boolean }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-medium text-slate-500">{t}{req && " *"}</span>
    {children}
  </label>
);

export function RegisterRepairForm({ customerId, orgId, branches }: { customerId: string; orgId: string; branches: any[] }) {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [f, setF] = useState({
    problem: "", item_type: TYPES[0], item_brand: "", item_model: "", item_color: "",
    frame_no: "", branch_id: branches[0]?.id ?? "", due_date: "",
  });
  const [shots, setShots] = useState<Shot[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ code: string; id: string } | null>(null);

  useEffect(() => () => shots.forEach((s) => URL.revokeObjectURL(s.url)), [shots]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = 3 - shots.length;
    if (room <= 0) return;
    const added: Shot[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const blob = await shrink(file, 1400);
        added.push({ blob, url: URL.createObjectURL(blob) });
      } catch { setErr("Could not read one of those images — please try another photo."); }
    }
    if (added.length) { setErr(""); setShots((x) => [...x, ...added]); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (f.problem.trim().length < 3) return setErr("Describe the problem you're facing.");
    if (!f.branch_id) return setErr("Choose a branch to drop the item at.");
    if (shots.length === 0 && !consent) return setErr("Tick the consent box, or attach at least one photo.");
    setBusy(true);

    // 1) Upload photos to <org>/<customer>/<uuid>.jpg (private bucket).
    const paths: string[] = [];
    for (const s of shots) {
      const path = `${orgId}/${customerId}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from("repair-images").upload(path, s.blob, { contentType: "image/jpeg" });
      if (error) { setBusy(false); return setErr(`Photo upload failed: ${dbError(error.message)}`); }
      paths.push(path);
    }

    // 2) Insert into the same `repairs` table the ERP uses (trigger assigns REP-xxx).
    const { data, error } = await sb.from("repairs").insert({
      org_id: orgId,
      branch_id: f.branch_id,
      customer_id: customerId,
      item_type: f.item_type,
      item_brand: f.item_brand.trim() || null,
      item_model: f.item_model.trim() || null,
      item_color: f.item_color.trim() || null,
      frame_no: f.frame_no.trim() || null,
      problem: f.problem.trim(),
      due_date: f.due_date || null,
      images: paths,
      photo_consent: paths.length === 0,
      photo_consent_at: paths.length === 0 ? new Date().toISOString() : null,
      paid: false,
      status: "pending",
    }).select("id, code").single();

    setBusy(false);
    if (error) return setErr(error.message.includes("row-level security")
      ? "Could not save — your session may have expired. Please log in again."
      : dbError(error.message));
    setDone({ code: data.code ?? "", id: data.id });
    router.refresh();
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 size={28} />
        </div>
        <h2 className="mt-4 text-xl font-extrabold text-navy-900">Repair registered!</h2>
        <p className="mt-2 text-sm text-slate-500">Your service ticket number is</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-wider text-gold-600">{done.code || "—"}</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">
          Bring your eyewear to {branches.find((b) => b.id === f.branch_id)?.name ?? "the selected branch"} and quote
          this number. You can track progress live from your repairs page.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={`/my/repairs/${done.id}`} className="rounded-xl bg-navy-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-700 transition">
            Track this repair
          </Link>
          <Link href="/my/repairs" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold hover:bg-slate-50 transition">
            All my repairs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="grid gap-4">
        <L t="What's wrong?" req>
          <textarea
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-navy-700 focus:outline-none"
            rows={3}
            placeholder="e.g. Frame arm is loose / lens scratched near the edge"
            value={f.problem}
            onChange={(e) => setF({ ...f, problem: e.target.value })}
          />
        </L>

        <div className="grid gap-4 sm:grid-cols-2">
          <L t="Item type" req>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-navy-700 focus:outline-none"
              value={f.item_type} onChange={(e) => setF({ ...f, item_type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </L>
          <L t="Drop-off branch" req>
            <select className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-navy-700 focus:outline-none"
              value={f.branch_id} onChange={(e) => setF({ ...f, branch_id: e.target.value })}>
              {branches.length === 0 && <option value="">No branches available</option>}
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.address ? ` — ${b.address}` : ""}</option>)}
            </select>
          </L>
          <L t="Brand"><input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-navy-700 focus:outline-none"
            placeholder="e.g. Titan" value={f.item_brand} onChange={(e) => setF({ ...f, item_brand: e.target.value })} /></L>
          <L t="Model"><input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-navy-700 focus:outline-none"
            placeholder="e.g. Fastrack 1009" value={f.item_model} onChange={(e) => setF({ ...f, item_model: e.target.value })} /></L>
          <L t="Colour"><input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-navy-700 focus:outline-none"
            placeholder="e.g. Matte black" value={f.item_color} onChange={(e) => setF({ ...f, item_color: e.target.value })} /></L>
          <L t="Frame no. (if any)"><input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-navy-700 focus:outline-none"
            placeholder="Printed on the arm" value={f.frame_no} onChange={(e) => setF({ ...f, frame_no: e.target.value })} /></L>
          <L t="Preferred due date"><input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-navy-700 focus:outline-none"
            value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></L>
        </div>

        {/* Photos — max 3, consent instead if none */}
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-500">Photos of the item (max 3)</span>
          <div className="grid grid-cols-3 gap-3">
            {shots.map((s, i) => (
              <div key={s.url} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                <img src={s.url} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Remove photo"
                  onClick={() => setShots((x) => x.filter((_, j) => j !== i))}
                  className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-rose-600 shadow transition hover:bg-white">
                  <X size={13} />
                </button>
              </div>
            ))}
            {shots.length < 3 && (
              <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 text-center text-xs text-slate-500 transition hover:border-navy-700 hover:bg-slate-50">
                <span><ImagePlus size={20} className="mx-auto mb-1" />Add photo ({3 - shots.length} left)</span>
                <input hidden type="file" accept="image/*" multiple onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Clear photos help our technicians diagnose the issue faster.</p>
        </div>

        {shots.length === 0 && (
          <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${consent ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-600" />
            <span className="text-xs leading-relaxed text-slate-600">
              I'm not attaching photos, and I <b>consent</b> to Power Eyes Opticals recording this repair without a photo
              of the item. <span className="text-slate-400">Your consent is stored with the ticket for reference.</span>
            </span>
          </label>
        )}

        {err && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="flex items-center gap-1.5 text-xs text-slate-400"><Wrench size={14} />A ticket number (REP-…) is issued on submit.</p>
          <button type="submit" disabled={busy}
            className="rounded-xl bg-navy-800 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-navy-700 disabled:opacity-50">
            {busy ? "Submitting…" : "Register repair"}
          </button>
        </div>
      </div>
    </form>
  );
}
