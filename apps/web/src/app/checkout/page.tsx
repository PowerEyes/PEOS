"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useCart } from "@/lib/cart";
import { inr } from "@/lib/types";
import { CartSkeleton } from "@/components/Skeletons";
import {
  Check,
  CreditCard,
  Smartphone,
  Building2,
  MapPin,
  Package,
} from "lucide-react";
import { useSite } from "@/lib/site-context";
import { waHref } from "@/lib/wa";

declare const Razorpay: any;

const STATES = [
  "Tamil Nadu",
  "Andhra Pradesh",
  "Karnataka",
  "Kerala",
  "Maharashtra",
  "Delhi",
  "Gujarat",
  "Rajasthan",
  "West Bengal",
  "Other",
];

/** 4-step tracker on the success screen, fed live by /api/track-order. */
const TRACK_STEPS = ["Order Placed", "Preparing", "Ready", "Delivered"];
function trackIndex(status?: string) {
  switch (status) {
    case "lab_pending":
    case "in_workshop":
    case "qc":
      return 1;
    case "ready":
      return 2;
    case "delivered":
      return 3;
    default:
      return 0; // draft / sent / converted (and unknown → step 1)
  }
}

export default function CheckoutPage() {
  const { state, total, subtotal, clear, count, loaded } = useCart();
  const { whatsappNumber, storeName } = useSite();
  const router = useRouter();
  const [step, setStep] = useState<"details" | "payment" | "success">(
    "details",
  );
  const [delivery, setDelivery] = useState<"pickup" | "delivery">("pickup");
  const [branches, setBranches] = useState<
    { id: string; name: string; is_default_pickup: boolean }[]
  >([]);
  const [branchId, setBranchId] = useState("");
  const [addr, setAddr] = useState({
    name: "",
    phone: "",
    email: "",
    line1: "",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "",
  });
  const [payMethod, setPayMethod] = useState<"razorpay" | "cod">("razorpay");
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [hadRx, setHadRx] = useState(false);
  const [track, setTrack] = useState<any>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/store-branches", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!live || !Array.isArray(j?.branches)) return;
        setBranches(j.branches);
        setBranchId(
          (old: string) =>
            old ||
            j.branches.find((b: any) => b.is_default_pickup)?.id ||
            j.branches[0]?.id ||
            "",
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // Exit guard: address started but payment not done → browser confirmation.
  // (Browsers display their own wording; returnValue carries ours.)
  useEffect(() => {
    if (step === "success") return;
    if (!addr.name.trim() && !addr.phone.trim()) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue =
        "You have items in your checkout. Are you sure you want to leave?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [step, addr.name, addr.phone]);

  // Live order status on the success screen — order code + phone are the
  // knowledge factors; refreshes every 30s (LiveRefresh cadence).
  useEffect(() => {
    if (step !== "success" || !orderId) return;
    let alive = true;
    const load = async () => {
      try {
        const phone = addr.phone.replace(/\D/g, "");
        const r = await fetch(
          `/api/track-order?code=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(phone)}`,
        );
        if (!r.ok) return;
        const d = await r.json();
        if (alive && d?.code && !d.error) setTrack(d);
      } catch {}
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, orderId]);

  // The cart hydrates from localStorage after first paint — don't flash
  // "No items to checkout" while it loads.
  if (!loaded && step !== "success")
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <CartSkeleton />
        <Footer />
      </div>
    );

  if (count === 0 && step !== "success")
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="mx-auto max-w-lg px-4 py-32 text-center">
          <h1 className="font-display text-3xl font-bold text-navy-900">
            No items to checkout
          </h1>
          <Link href="/eyeglasses" className="btn-gold mt-6 inline-flex">
            Shop Eyewear
          </Link>
        </div>
        <Footer />
      </div>
    );

  async function placeOrder() {
    setBusy(true);
    setHadRx(state.items.some((i) => !!i.lensPackageId));
    if (payMethod === "razorpay") {
      // Load Razorpay SDK
      if (!document.getElementById("rp-sdk")) {
        const s = document.createElement("script");
        s.id = "rp-sdk";
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        document.head.appendChild(s);
        const okSdk = await new Promise<boolean>((r) => {
          s.onload = () => r(true);
          s.onerror = () => r(false);
        });
        if (!okSdk) {
          s.remove();
          alert(
            "Could not load the payment window. Check your connection and try again.",
          );
          setBusy(false);
          return;
        }
      }
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: state.items,
          coupon: state.coupon,
          delivery,
          branch_id: branchId,
          address: addr,
          notes: { name: addr.name, phone: addr.phone, email: addr.email },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Payment failed. Try again.");
        setBusy(false);
        return;
      }
      new Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: data.currency,
        name: storeName || "Power Eyes Opticals",
        description: "Eyewear Purchase",
        prefill: { name: addr.name, email: addr.email, contact: addr.phone },
        theme: { color: "#C48A3F" },
        handler: async (resp: any) => {
          const confirm = await fetch("/api/order-confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...resp, quoteId: data.quoteId, addr }),
          });
          const cd = await confirm.json();
          if (cd.code) {
            setOrderId(cd.code);
            clear();
            setStep("success");
          } else
            alert("Order confirmation failed. Please contact us via WhatsApp.");
        },
        modal: { ondismiss: () => setBusy(false) },
      }).open();
    } else {
      // Cash on delivery / pay in store
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: state.items,
          coupon: state.coupon,
          delivery,
          branch_id: branchId,
          address: addr,
          payMethod: "cash",
          notes: { name: addr.name, phone: addr.phone, email: addr.email },
        }),
      });
      const quote = await res.json();
      if (!res.ok) {
        alert(quote.error || "Could not verify your order total.");
        setBusy(false);
        return;
      }
      const confirm = await fetch("/api/order-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          razorpay_order_id: "COD",
          addr,
          payMethod: "cash",
        }),
      });
      const cd = await confirm.json();
      if (cd.code) {
        setOrderId(cd.code);
        clear();
        setStep("success");
      } else alert("Failed to place order. Contact us on WhatsApp.");
    }
    setBusy(false);
  }

  if (step === "success") {
    const idx = trackIndex(track?.status);
    const cancelled =
      track?.status === "cancelled" || track?.status === "rejected";
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-emerald-50">
            <Check size={48} className="text-emerald-500" />
          </div>
          <h1 className="font-display text-4xl font-bold text-navy-900">
            Order Placed!
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Thank you for shopping with Power Eyes Opticals.
          </p>

          {/* Live status tracker — Order Placed → Preparing → Ready → Delivered */}
          <div className="mt-7 rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-navy-900">Order status</p>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {track ? "live · updates every 30s" : "updating…"}
              </span>
            </div>
            <div className="grid grid-cols-4">
              {TRACK_STEPS.map((s, i) => {
                const done = idx >= i;
                const cur = idx === i;
                return (
                  <div
                    key={s}
                    className="relative flex flex-col items-center gap-1.5"
                  >
                    {i > 0 && (
                      <span
                        className={`absolute right-1/2 top-[15px] h-0.5 w-full ${idx >= i ? "bg-navy-800" : "bg-slate-200"}`}
                      />
                    )}
                    <div
                      className={`relative grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${done ? "bg-navy-800 text-white" : "bg-slate-100 text-slate-400"}`}
                    >
                      {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                    </div>
                    <p
                      className={`text-center text-[10px] leading-tight ${cur ? "font-bold text-navy-900" : done ? "text-navy-700" : "text-slate-400"}`}
                    >
                      {s}
                    </p>
                  </div>
                );
              })}
            </div>
            {cancelled ? (
              <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                This order was cancelled — please contact us on WhatsApp for
                help.
              </p>
            ) : (
              <p className="mt-4 text-xs text-slate-500">
                {track?.status === "ready"
                  ? "Your order is ready — collect it from the store."
                  : track?.status === "delivered"
                    ? "Delivered. Thank you for shopping with Power Eyes!"
                    : "We'll notify you on WhatsApp at every step."}
              </p>
            )}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-left space-y-2 text-sm">
            <p>
              <span className="text-slate-500">Order number:</span>{" "}
              <b>{orderId}</b>
            </p>
            <p>
              <span className="text-slate-500">Fulfilment:</span>{" "}
              {delivery === "pickup"
                ? `Pickup from ${branches.find((b) => b.id === branchId)?.name ?? "selected store"}`
                : `Delivery to ${addr.city}`}
            </p>
            {hadRx && (
              <p className="text-blue-600">
                Your prescription has been noted. Lenses will be prepared.
              </p>
            )}
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/my/orders" className="btn-gold">
              Track my order
            </Link>
            <a
              href={waHref(whatsappNumber, `I placed order ${orderId}`)}
              target="_blank"
              className="btn-navy"
            >
              💬 WhatsApp us
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Order without an account?{" "}
            <Link href="/track-order" className="text-navy-700 underline">
              Track it here →
            </Link>
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-navy-900 mb-6">
          Checkout
        </h1>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {/* Delivery method */}
            <div className="card p-4 sm:p-5">
              <p className="font-semibold mb-3 text-sm sm:text-base">
                How do you want to receive your order?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    [
                      "pickup",
                      "Store Pickup",
                      MapPin,
                      "Free, ready in 3–5 days",
                    ],
                    ["delivery", "Home Delivery", Package, "₹99, 5–7 days"],
                  ] as const
                ).map(([v, l, I, sub]) => (
                  <button
                    key={v}
                    onClick={() => setDelivery(v)}
                    className={`flex items-start gap-3 rounded-2xl border-2 p-3.5 sm:p-4 text-left transition ${delivery === v ? "border-gold-500 bg-amber-50" : "border-slate-100 hover:border-slate-300"}`}
                  >
                    <I
                      size={20}
                      className={
                        delivery === v ? "text-gold-600" : "text-slate-400"
                      }
                    />
                    <div>
                      <p className="font-semibold text-sm">{l}</p>
                      <p className="text-xs text-slate-500">{sub}</p>
                    </div>
                  </button>
                ))}
              </div>
              {delivery === "pickup" && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBranchId(b.id)}
                      className={`rounded-xl border-2 py-2.5 px-3 text-sm font-medium transition ${branchId === b.id ? "border-navy-800 bg-navy-50 text-navy-900 font-semibold" : "border-slate-100 text-slate-600 hover:border-slate-300"}`}
                    >
                      {b.name}
                      {b.is_default_pickup && (
                        <span className="ml-1 text-[10px] text-slate-400">
                          Default
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Customer details */}
            <div className="card p-4 sm:p-5">
              <p className="font-semibold mb-4 text-sm sm:text-base">
                Your details
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Name *", "name", "text", "Full name"],
                  ["Phone *", "phone", "tel", "10-digit mobile"],
                  ["Email", "email", "email", "you@example.com"],
                ].map(([l, k, t, ph]) => (
                  <label
                    key={k}
                    className={k === "email" ? "sm:col-span-2" : ""}
                  >
                    <span className="mb-1 block text-xs text-slate-500">
                      {l}
                    </span>
                    <input
                      type={t as any}
                      value={(addr as any)[k]}
                      onChange={(e) =>
                        setAddr({ ...addr, [k]: e.target.value })
                      }
                      placeholder={ph as string}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"
                    />
                  </label>
                ))}
              </div>
              {delivery === "delivery" && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-700">
                    Delivery address
                  </p>
                  <input
                    value={addr.line1}
                    onChange={(e) =>
                      setAddr({ ...addr, line1: e.target.value })
                    }
                    placeholder="Street address, area"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      value={addr.city}
                      onChange={(e) =>
                        setAddr({ ...addr, city: e.target.value })
                      }
                      placeholder="City"
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"
                    />
                    <select
                      value={addr.state}
                      onChange={(e) =>
                        setAddr({ ...addr, state: e.target.value })
                      }
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"
                    >
                      {STATES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <input
                      value={addr.pincode}
                      onChange={(e) =>
                        setAddr({ ...addr, pincode: e.target.value })
                      }
                      placeholder="Pincode"
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-navy-700"
                    />
                  </div>
                </div>
              )}
            </div>
            {/* Payment */}
            <div className="card p-5">
              <p className="font-semibold mb-3">Payment method</p>
              <div className="space-y-2">
                {(
                  [
                    [
                      "razorpay",
                      "Pay online (UPI / Card / NetBanking)",
                      CreditCard,
                    ],
                    ["cod", "Pay in store / Cash on Delivery", Building2],
                  ] as const
                ).map(([v, l, I]) => (
                  <button
                    key={v}
                    onClick={() => setPayMethod(v)}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${payMethod === v ? "border-gold-500 bg-amber-50" : "border-slate-100 hover:border-slate-300"}`}
                  >
                    <I
                      size={18}
                      className={
                        payMethod === v ? "text-gold-600" : "text-slate-400"
                      }
                    />
                    <span className="text-sm font-medium">{l}</span>
                    {payMethod === v && (
                      <Check size={16} className="ml-auto text-gold-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Order summary sidebar */}
          <div className="space-y-4">
            <div className="card p-5 space-y-3">
              <p className="font-bold text-navy-900">Order Summary</p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {state.items.map((i) => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-slate-600 truncate mr-2">
                      {i.qty}× {i.productName}
                    </span>
                    <span className="font-medium shrink-0">{inr(i.total)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span>{inr(subtotal)}</span>
                </div>
                {state.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>-{inr(state.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Shipping</span>
                  <span>{delivery === "pickup" ? "Free" : "₹99"}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-100">
                  <span>Total</span>
                  <span>
                    {inr(delivery === "delivery" ? total + 99 : total)}
                  </span>
                </div>
              </div>
              <button
                onClick={placeOrder}
                disabled={busy || !addr.name || !addr.phone}
                className="btn-gold w-full py-4 text-base disabled:opacity-50"
              >
                {busy
                  ? "Processing…"
                  : payMethod === "razorpay"
                    ? `Pay ${inr(delivery === "delivery" ? total + 99 : total)} →`
                    : "Place Order →"}
              </button>
              <p className="text-center text-xs text-slate-400">
                🔒 Secured by 256-bit SSL encryption
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 p-4 text-xs text-slate-500 space-y-1">
              <p>✓ 1 year warranty on frames</p>
              <p>✓ Free adjustments at any store</p>
              <p>✓ Easy exchange within 7 days</p>
              <p>✓ Expert support via WhatsApp</p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
