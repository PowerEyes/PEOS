"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "₹999",
    period: "/month",
    description: "Perfect for single-store optical shops",
    features: ["1 branch", "Up to 500 customers", "POS & Sales", "Basic inventory", "Prescriptions", "Basic reports"],
    priceYearly: "₹9,990",
  },
  {
    id: "growth",
    name: "Growth",
    price: "₹2,499",
    period: "/month",
    description: "For growing multi-branch stores",
    features: ["Up to 3 branches", "Unlimited customers", "POS & Sales", "Multi-branch inventory", "Lab & Workshop", "QC & Delivery", "Advanced reports", "GST invoicing"],
    priceYearly: "₹24,990",
    isPopular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "₹7,499",
    period: "/month",
    description: "For large optical chains",
    features: ["Unlimited branches", "Unlimited customers", "Everything in Growth", "White-label website", "API access", "Priority support"],
    priceYearly: "₹74,990",
  },
] as const;

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Browser required"));
    if ((window as any).Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

export default function SubscribeForm({ initialPlan = "starter" }: { initialPlan?: string }) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string>(initialPlan);
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function subscribe() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: selectedPlan, period }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout");

      await loadRazorpay();
      const razorpay = new (window as any).Razorpay({
        key: data.order.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        name: "PowerOS",
        description: `${data.plan.name} plan`,
        order_id: data.order.id,
        theme: { color: "#b8860b" },
        handler: async (payment: any) => {
          const confirm = await fetch("/api/subscribe/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subscription_id: data.subscription.id,
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            }),
          });
          const result = await confirm.json();
          if (!confirm.ok) {
            setError(result.error || "Payment verification failed");
            return;
          }
          router.push("/dashboard?subscribed=1");
          router.refresh();
        },
      });
      razorpay.open();
      setLoading(false);
    } catch (e: any) {
      setError(e.message || "Could not start checkout");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-2">Simple, Transparent Pricing</h1>
          <p className="text-navy-200">Choose the plan that fits your optical store</p>
          <div className="mt-4 inline-flex rounded-lg border border-navy-700 overflow-hidden">
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-sm capitalize ${
                  period === p ? "bg-gold-500 text-white" : "bg-navy-800 text-navy-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative p-6 rounded-xl border ${
                  isSelected ? "border-gold-500 bg-navy-800" : "border-navy-700 bg-white text-slate-900"
                } transition-colors`}
              >
                {"isPopular" in plan && plan.isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gold-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="text-sm text-navy-400 mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-3xl font-bold">
                    {period === "yearly" ? plan.priceYearly : plan.price}
                  </span>
                  <span className="text-sm">{period === "yearly" ? "/year" : "/month"}</span>
                </div>
                <ul className="space-y-3 mb-6 text-sm">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    isSelected
                      ? "bg-gold-500 hover:bg-gold-600 text-white"
                      : "bg-navy-800 hover:bg-navy-700 text-white border border-navy-600"
                  }`}
                >
                  {isSelected ? "Selected" : "Select Plan"}
                </button>
              </div>
            );
          })}
        </div>

        {error && <p className="mt-6 text-center text-sm text-red-300">{error}</p>}

        <div className="mt-12 text-center">
          <p className="text-navy-400 text-sm mb-6">All prices include GST. Cancel anytime.</p>
          <button
            onClick={subscribe}
            disabled={loading}
            className="px-8 py-3 bg-gold-500 text-white hover:bg-gold-600 font-semibold rounded-lg disabled:opacity-50"
          >
            {loading ? "Starting checkout..." : `Continue with ${selectedPlan}`}
          </button>
          <div className="mt-4">
            <Link href="/dashboard" className="text-sm text-navy-300 underline">
              Skip for Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
