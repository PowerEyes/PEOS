
"use client";
import { useState } from "react";
import { getTenantOrg } from "@/lib/tenant-client";
import { Star, X, Check, Camera } from "lucide-react";
import { useToast } from "@poweros/ui";
import { dbError } from "@poweros/business-rules";
import { supabaseBrowser } from "@/lib/supabase/client";

export function ReviewForm({ productId, productName, onClose }: {
  productId: string; productName: string; onClose: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const toast = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return setErr("Please select a star rating.");
    if (body.trim().length < 10) return setErr("Review must be at least 10 characters.");
    setBusy(true); setErr("");
    const sb = supabaseBrowser();
    // Check if logged in to link verified purchase
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("product_reviews").insert({
      product_id: productId,
      org_id: await getTenantOrg(),
      reviewer_name: name.trim() || (user?.user_metadata?.full_name ?? "Customer"),
      reviewer_email: email.trim() || user?.email || null,
      customer_id: null,
      rating,
      title: title.trim() || null,
      body: body.trim(),
      verified_purchase: false,
      status: "pending",
    });
    setBusy(false);
    if (error) return setErr(dbError(error.message));
    setDone(true);
    toast("Review submitted for approval");
  }

  if (done) return (
    <div className="text-center py-10 px-4">
      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-50">
        <Check size={32} className="text-emerald-500"/>
      </div>
      <h3 className="font-bold text-navy-900 text-xl">Thank you for your review!</h3>
      <p className="text-slate-500 text-sm mt-2">Your review has been submitted and will appear after approval (usually within 24 hours).</p>
      <button onClick={onClose} className="mt-5 rounded-lg bg-navy-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 transition">Done</button>
    </div>);

  return (
    <div className="p-5 space-y-4">
      {/* Product name */}
      <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm font-medium text-navy-900">
        Reviewing: <span className="font-bold">{productName}</span>
      </div>

      {/* Star rating */}
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">Your Rating *</p>
        <div className="flex gap-1">
          {[1,2,3,4,5].map(n => (
            <button key={n} type="button"
              onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="transition-transform hover:scale-110">
              <Star size={32} className={`transition ${n <= (hover || rating) ? "fill-gold-500 text-gold-500" : "text-slate-200"}`}/>
            </button>))}
        </div>
        {rating > 0 && (
          <p className="text-xs text-slate-500 mt-1">
            {["","Poor","Fair","Good","Very good","Excellent"][rating]}
          </p>)}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">Your name *</span>
            <input value={name} onChange={e=>setName(e.target.value)} required placeholder="First name or initials"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">Email (not shown publicly)</span>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/>
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-600 mb-1 block">Review title</span>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Great quality and perfect fit"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"/>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600 mb-1 block">Your review *</span>
          <textarea value={body} onChange={e=>setBody(e.target.value)} required rows={4}
            placeholder="Tell others about the quality, fit, and your overall experience..."
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700 resize-none"/>
          <p className="text-xs text-slate-400 mt-1">{body.length}/500 characters</p>
        </label>
        {err && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{err}</div>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button disabled={busy || rating === 0} className="flex-1 rounded-xl bg-navy-800 py-3 text-sm font-bold text-white hover:bg-navy-700 transition disabled:opacity-50">
            {busy ? "Submitting…" : "Submit Review"}
          </button>
        </div>
        <p className="text-xs text-slate-400 text-center">Reviews are moderated and typically approved within 24 hours.</p>
      </form>
    </div>);
}
