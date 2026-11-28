"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          business_name: businessName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      setSuccess("Account created! Please check your email to verify your account.");
      setLoading(false);
      setTimeout(
        () => router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`),
        2000
      );
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-navy-50 mb-2">PowerOS</h1>
          <p className="text-navy-200 text-sm">Create your optical store account</p>
        </div>

        <div className="bg-white rounded-xl p-8 shadow-lg text-slate-900">
          {success ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-green-800">
              <p className="font-semibold mb-2">Account Created!</p>
              <p className="text-sm">
                We've sent a verification email to <strong>{email}</strong>. Please verify your email to continue.
              </p>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-1">Business Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Nish Optics"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="you@opticalshop.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:outline-none"
                  />
                </div>
                {error && (
                  <div className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-navy-900 hover:bg-navy-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? "Creating account..." : "Create Account"}
                </button>
              </form>
            </>
          )}
          <div className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-gold-600 hover:text-gold-700 font-medium"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}