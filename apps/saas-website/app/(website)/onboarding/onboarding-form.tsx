"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  { key: "business", label: "Business Profile", desc: "Name, logo, address & contact" },
  { key: "tax", label: "Tax & Registration", desc: "GSTIN, PAN & tax configuration" },
  { key: "branches", label: "Branches", desc: "Add your first store location" },
  { key: "team", label: "Team & Roles", desc: "Invite staff from the ERP after launch" },
  { key: "catalogue", label: "Catalogue", desc: "Frames, lenses & accessories" },
  { key: "settings", label: "Business Settings", desc: "Currency, GST, invoice terms" },
  { key: "website", label: "Website Setup", desc: "Store name & online preferences" },
];

type FormState = {
  businessName: string;
  legalName: string;
  businessEmail: string;
  businessPhone: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  pan: string;
  gstApplicable: boolean;
  branchName: string;
  branchCode: string;
  branchPhone: string;
  branchAddress: string;
  currency: string;
  financialYearStartMonth: string;
  storeName: string;
  storeTagline: string;
  enableWebsite: boolean;
};

export default function OnboardingForm({ initial }: { initial: Partial<FormState> }) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>({
    businessName: initial.businessName || "",
    legalName: initial.legalName || "",
    businessEmail: initial.businessEmail || "",
    businessPhone: initial.businessPhone || "",
    addressLine1: "",
    city: "",
    state: "",
    pincode: "",
    gstin: "",
    pan: "",
    gstApplicable: true,
    branchName: initial.businessName ? `${initial.businessName} Main` : "",
    branchCode: "MAIN",
    branchPhone: "",
    branchAddress: "",
    currency: "INR",
    financialYearStartMonth: "4",
    storeName: initial.businessName || "",
    storeTagline: "",
    enableWebsite: false,
  });

  const update = (key: keyof FormState, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const field = (
    key: keyof FormState,
    label: string,
    placeholder: string,
    type = "text"
  ) => (
    <div key={key}>
      <label className="block text-sm font-medium text-navy-700 mb-1">{label}</label>
      <input
        type={type}
        value={String(form[key])}
        onChange={(e) => update(key, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:outline-none"
      />
    </div>
  );

  async function finish() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save onboarding");
      router.push("/dashboard?onboarding=complete");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  async function next() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      return;
    }
    await finish();
  }

  const step = STEPS[currentStep];

  return (
    <div className="min-h-screen bg-navy-900 text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between mb-2 gap-2">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex flex-col items-center gap-2 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    i < currentStep
                      ? "bg-gold-500 text-white"
                      : i === currentStep
                      ? "bg-navy-500 text-white"
                      : "bg-navy-700 text-navy-300"
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-[10px] truncate max-w-[80px] ${
                    i < currentStep ? "text-gold-500 font-bold" : "text-navy-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
          <div className="h-1 bg-navy-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold-500 transition-all duration-500"
              style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl text-slate-900">
          <h2 className="text-2xl font-bold mb-2">{step.label}</h2>
          <p className="text-navy-600 text-sm mb-6">{step.desc}</p>

          {currentStep === 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              {field("businessName", "Business Name *", "e.g., Nish Optics")}
              {field("legalName", "Legal Name", "Full legal business name")}
              {field("businessEmail", "Business Email *", "business@opticalshop.com", "email")}
              {field("businessPhone", "Business Phone *", "+91 98765 43210", "tel")}
              {field("addressLine1", "Address Line 1", "Street address")}
              {field("city", "City *", "Mumbai")}
              {field("state", "State *", "Maharashtra")}
              {field("pincode", "Pincode *", "400001", "tel")}
            </div>
          )}

          {currentStep === 1 && (
            <div className="grid md:grid-cols-2 gap-6">
              {field("gstin", "GSTIN", "27AABCV1234C1Z5")}
              {field("pan", "PAN", "ABCDE1234F")}
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.gstApplicable}
                  onChange={(e) => update("gstApplicable", e.target.checked)}
                  className="mt-1 rounded border-slate-300"
                />
                <span className="text-sm text-navy-700">GST applicable</span>
              </label>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              {field("branchName", "Branch Name *", "Nish Optics Main")}
              <div className="grid md:grid-cols-2 gap-6">
                {field("branchCode", "Branch Code *", "MAIN")}
                {field("branchPhone", "Phone", "+91 98765 43210", "tel")}
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Address</label>
                <textarea
                  rows={3}
                  value={form.branchAddress}
                  onChange={(e) => update("branchAddress", e.target.value)}
                  placeholder="Full address"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <p className="text-sm text-slate-600">
              Your account owner is already set up. You can invite more staff and assign roles from
              the ERP after launch.
            </p>
          )}

          {currentStep === 4 && (
            <p className="text-sm text-slate-600">
              Catalogue import is available in the ERP. You can add frames, lenses and accessories
              once onboarding is complete.
            </p>
          )}

          {currentStep === 5 && (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => update("currency", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="INR">INR - Indian Rupee</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">
                  Financial Year Start Month
                </label>
                <select
                  value={form.financialYearStartMonth}
                  onChange={(e) => update("financialYearStartMonth", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="4">April</option>
                  <option value="1">January</option>
                </select>
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-6">
              {field("storeName", "Store Name *", "Nish Optics")}
              {field("storeTagline", "Store Tagline", "Your trusted optical partner")}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enableWebsite}
                  onChange={(e) => update("enableWebsite", e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-navy-700">Enable Online Store</span>
              </label>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-6 py-2 text-navy-600 font-medium border border-navy-300 rounded-lg hover:bg-navy-50"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              disabled={loading}
              className={`px-8 py-3 font-semibold rounded-lg transition-colors ${
                currentStep === STEPS.length - 1
                  ? "bg-gold-500 hover:bg-gold-600 text-white"
                  : "bg-navy-900 hover:bg-navy-800 text-white"
              }`}
            >
              {loading
                ? "Saving..."
                : currentStep === STEPS.length - 1
                ? "Launch Business"
                : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
