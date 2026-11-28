"use client";

import { useState } from "react";
import { supabaseServer } from "@/lib/supabase/server";

type PaymentMethod = {
  id: string;
  method: string;
  is_enabled: boolean;
  is_active: boolean;
};

export function PaymentMethodsSection({ canEdit }: { canEdit: boolean }) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  useState<boolean>(false);

  async function loadPaymentMethods() {
    const sb = supabaseServer();
    const { data, error } = await sb.from("payment_methods").select("*").order("method");
    if (!error) setPaymentMethods(data ?? []);
    setLoading(false);
  }

  async function togglePaymentMethod(id: string, current: boolean) {
    const sb = supabaseServer();
    const { error } = await sb
      .from("payment_methods")
      .update({ is_enabled: !current })
      .eq("id", id);
    if (error) {
      setMessage(error.message);
      setMessageType("error");
    } else {
      setMessage("Payment method updated successfully");
      setMessageType("success");
      setPaymentMethods(
        paymentMethods.map((m) =>
          m.id === id ? { ...m, is_enabled: !current } : m
        )
      );
    }
    setTimeout(() => setMessage(""), 3000);
  }

  useState(() => {
    loadPaymentMethods();
  });

  if (loading) return <div className="p-4 text-slate-500">Loading payment methods...</div>;

  return (
    <section className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-navy-900">Payment Methods</h2>
            <p className="text-slate-600 text-sm">Configure accepted payment methods</p>
          </div>
          {canEdit && (
            <button className="text-xs bg-navy-900 text-white px-3 py-1 rounded hover:bg-navy-800">
              Add Payment Method
            </button>
          )}
        </div>
        <div className="mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left pb-3 text-navy-700">Method</th>
                <th className="text-left pb-3 text-navy-700">Status</th>
                <th className="text-right pb-3 text-navy-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {paymentMethods.map((pm) => (
                <tr key={pm.id} className="border-b border-slate-100">
                  <td className="py-3 font-medium text-navy-900">
                    {pm.method.charAt(0).toUpperCase() + pm.method.slice(1)}
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      pm.is_enabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}>
                      {pm.is_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {canEdit && (
                      <button
                        onClick={() => togglePaymentMethod(pm.id, pm.is_enabled)}
                        className="text-xs text-navy-600 hover:text-navy-900 font-medium"
                      >
                        {pm.is_enabled ? "Disable" : "Enable"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${messageType === "success" ? "bg-green-50 border border-green-200 text-green-800" : "bg-rose-50 border border-rose-200 text-rose-800"}`}
        >
          {message}
        </div>
      )}
    </section>
  );
}