"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Hero Section */}
      <section className="relative bg-navy-900 text-white py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              PowerOS ERP for<br />
              <span className="text-gold-400">Optical Shops</span>
            </h1>
            <p className="text-lg sm:text-xl text-navy-100 mb-8 max-w-2xl mx-auto">
              Complete ERP for optical stores. Manage prescriptions, frames, lenses,
              lab workshop, GST invoicing, and customers - all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/signup"
                className="bg-gold-500 hover:bg-gold-600 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors"
              >
                Start Free Trial
              </Link>
              <Link
                href="/subscribe"
                className="bg-navy-800 hover:bg-navy-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors border border-gold-400"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-navy-900 mb-4">Built for Optical Shops</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Everything you need to run your optical store efficiently
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon="👓"
              title="Prescription Management"
              desc="Create, store, and track prescriptions with power ranges, expiry dates, and status tracking."
            />
            <FeatureCard
              icon="🏪"
              title="POS & Sales"
              desc="Complete point-of-sale with lens packages, coatings, GST invoicing, and payment tracking."
            />
            <FeatureCard
              icon="🔬"
              title="Lab & Workshop"
              desc="Track lab orders from to-buy to QC, workshop fitting, and delivery workflow."
            />
            <FeatureCard
              icon="📦"
              title="Inventory Management"
              desc="Track stock across branches with 1,000+ units per category and reorder alerts."
            />
            <FeatureCard
              icon="🧾"
              title="GST Invoicing"
              desc="CGST/SGST/IGST calculation, HSN codes, and GST-compliant invoices for Indian optical shops."
            />
            <FeatureCard
              icon="👥"
              title="Customer 360"
              desc="Complete customer history with prescriptions, orders, repairs, and warranty tracking."
            />
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-navy-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-navy-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Choose the plan that fits your optical store size
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <PricingCard
              id="starter"
              name="Starter"
              price="₹999"
              period="/month"
              features={[
                "1 branch",
                "Up to 500 customers",
                "POS & Sales",
                "Basic inventory",
                "Prescriptions",
                "Basic reports",
              ]}
              isPopular={false}
            />
            <PricingCard
              id="growth"
              name="Growth"
              price="₹2,499"
              period="/month"
              features={[
                "Up to 3 branches",
                "Unlimited customers",
                "POS & Sales",
                "Multi-branch inventory",
                "Lab & Workshop",
                "QC & Delivery",
                "Advanced reports",
                "GST invoicing",
              ]}
              isPopular={true}
            />
            <PricingCard
              id="enterprise"
              name="Enterprise"
              price="₹7,499"
              period="/month"
              features={[
                "Unlimited branches",
                "Unlimited customers",
                "Everything in Growth",
                "White-label website",
                "API access",
                "Priority support",
              ]}
              isPopular={false}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-navy-900 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to power your optical shop?</h2>
          <p className="text-navy-200 mb-8">Join hundreds of opticians using PowerOS</p>
          <Link
            href="/auth/signup"
            className="bg-gold-500 hover:bg-gold-600 text-white px-8 py-4 rounded-lg font-semibold text-lg inline-block transition-colors"
          >
            Start Free Trial - No Credit Card Required
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="p-6 rounded-xl border border-slate-200 hover:border-navy-300 transition-colors">
      <div className="text-2xl mb-4">{icon}</div>
      <h3 className="text-lg font-bold text-navy-900 mb-2">{title}</h3>
      <p className="text-slate-600 text-sm">{desc}</p>
    </div>
  );
}

function PricingCard({
  id,
  name,
  price,
  period,
  features,
  isPopular,
}: {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  isPopular: boolean;
}) {
  return (
    <div className={`p-6 rounded-xl border border-slate-200 ${isPopular ? "border-gold-500 bg-gold-50" : "bg-white"}`}>
      <div className="flex items-baseline gap-2 mb-6">
        <span className="text-3xl font-bold text-navy-900">{price}</span>
        <span className="text-slate-600 text-sm">{period}</span>
      </div>
      <h3 className="text-lg font-bold text-navy-900 mb-4">{name}</h3>
      <ul className="space-y-3 mb-6 text-sm text-slate-600">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-green-600">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={`/subscribe?plan=${id}`}
        className={`block w-full py-3 rounded-lg font-semibold text-center transition-colors ${
          isPopular
            ? "bg-navy-900 text-white hover:bg-navy-800 border border-gold-400"
            : "bg-white text-navy-900 hover:bg-slate-50 border border-slate-200"
        }`}
      >
        {isPopular ? "Choose Growth" : `Choose ${name}`}
      </Link>
    </div>
  );
}