"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type") || "signup";
    const token = params.get("token");
    const email = params.get("email");

    if (!tokenHash && (!token || !email)) {
      setStatus("error");
      setMessage("Verification token and email are required.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token_hash: tokenHash, type, token, email }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully!");
          setTimeout(() => {
            router.push("/onboarding");
            router.refresh();
          }, 2000);
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong during verification.");
      });
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-xl p-8 shadow-lg">
          <div className="flex justify-center mb-6">
            {status === "success" ? (
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-xl">✓</span>
              </div>
            ) : status === "error" ? (
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-xl">✕</span>
              </div>
            ) : (
              <div className="w-12 h-12 bg-navy-100 rounded-full flex items-center justify-center animate-spin">
                <span className="text-navy-600 text-xl">⟳</span>
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-navy-900 mb-2">
            {status === "success"
              ? "Email Verified"
              : status === "error"
              ? "Verification Failed"
              : "Verifying Email..."}
          </h1>
          <p className="text-slate-600 mb-6">{message}</p>
          {status === "success" && (
            <button
              onClick={() => {
                router.push("/onboarding");
                router.refresh();
              }}
              className="w-full py-3 bg-navy-900 hover:bg-navy-800 text-white font-semibold rounded-lg"
            >
              Set up your business
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
