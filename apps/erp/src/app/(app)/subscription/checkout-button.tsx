"use client";
import { useState, useTransition } from "react";
import { createCheckoutOrder, verifyCheckoutPayment } from "./actions";

declare global {
  interface Window { Razorpay?: any; }
}

/** Razorpay Checkout is a third-party script — load it on demand, once. */
function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function CheckoutButton({
  planId, planName, priceLabel, disabled,
}: { planId: string; planName: string; priceLabel?: string; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  const pay = () => {
    setMsg({});
    startTransition(async () => {
      const started = await createCheckoutOrder(planId);
      if (started.error || !started.orderId || !started.keyId) {
        setMsg({ error: started.error || "Checkout is unavailable right now." });
        return;
      }
      if (!(await loadCheckoutScript()) || !window.Razorpay) {
        setMsg({ error: "Could not load the payment window. Check your connection and try again." });
        return;
      }

      const rzp = new window.Razorpay({
        key: started.keyId,
        amount: started.amountMinor,
        currency: started.currency,
        name: "PowerOS",
        description: `${started.planName} plan${priceLabel ? ` — ${priceLabel}` : ""}`,
        order_id: started.orderId,
        theme: { color: "#0f172a" },
        handler: async (res: {
          razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string;
        }) => {
          const done = await verifyCheckoutPayment({
            orderId: res.razorpay_order_id || started.orderId,
            paymentId: res.razorpay_payment_id,
            signature: res.razorpay_signature,
          });
          setMsg(done.error ? { error: done.error } : { ok: done.ok });
        },
        modal: {
          ondismiss: () => setMsg({ error: "Payment window closed before the payment completed." }),
        },
      });
      rzp.open();
    });
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" disabled={pending || disabled} onClick={pay}
        className="btn bg-navy-800 text-white disabled:opacity-50">
        {pending ? "Starting checkout…" : `Subscribe${priceLabel ? ` · ${priceLabel}` : ""}`}
      </button>
      {msg.error && <span className="text-xs text-rose-600">{msg.error}</span>}
      {msg.ok && <span className="text-xs text-emerald-600">{msg.ok}</span>}
    </span>
  );
}
