import Link from "next/link";
import { cookies } from "next/headers";
import { Glasses } from "lucide-react";
import { RECOVERY_COOKIE, verifyRecoveryProof } from "@/lib/password-reset";
import ResetPasswordForm from "./form";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { title: string; body: string }> = {
  invalid: { title: "Invalid reset link", body: "This link isn’t valid. Request a fresh one and use the newest email." },
  expired: { title: "Reset link expired", body: "This link has expired or was already used. Request a new reset email." },
  error: { title: "We couldn’t verify that link", body: "Something went wrong while verifying the link. Request a fresh one." },
};

export default function ResetPasswordPage({ searchParams }: { searchParams: { error?: string } }) {
  const valid = verifyRecoveryProof(cookies().get(RECOVERY_COOKIE)?.value);
  const state = searchParams.error ? MESSAGES[searchParams.error] : undefined;

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-2 mb-3"><Glasses className="h-8 w-8 text-navy-900"/><span className="font-display text-2xl font-bold text-navy-900">My account</span></div>
          <h1 className="font-display text-2xl font-bold text-navy-900">{state?.title || (valid ? "Choose a new password" : "Link required")}</h1>
        </div>
        <div className="card p-6 space-y-4">
          {state ? (
            <>
              <p className="text-sm text-slate-600">{state.body}</p>
              <Link href="/forgot-password" className="btn-gold block py-3 text-center">Request a new link</Link>
            </>
          ) : !valid ? (
            <>
              <p className="text-sm text-slate-600">Open the reset link from your email, or request a new one below.</p>
              <Link href="/forgot-password" className="btn-gold block py-3 text-center">Request a reset link</Link>
            </>
          ) : (
            <ResetPasswordForm />
          )}
        </div>
        <p className="text-center text-sm text-slate-500 mt-4">
          <Link href="/login" className="font-semibold text-navy-700 underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
