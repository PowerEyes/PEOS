import Link from "next/link";
import { cookies } from "next/headers";
import { Eye } from "lucide-react";
import { RECOVERY_COOKIE, verifyRecoveryProof } from "@/lib/password-reset";
import ResetPasswordForm from "./form";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { title: string; body: string }> = {
  invalid: {
    title: "Invalid reset link",
    body: "This link isn’t valid. Request a fresh one and use the newest email.",
  },
  expired: {
    title: "Reset link expired",
    body: "This link has expired or was already used. Request a new reset email.",
  },
  error: {
    title: "We couldn’t verify that link",
    body: "Something went wrong while verifying the link. Request a fresh one.",
  },
};

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const valid = verifyRecoveryProof(cookies().get(RECOVERY_COOKIE)?.value);
  const state = searchParams.error ? MESSAGES[searchParams.error] : undefined;

  return (
    <main className="grid min-h-screen place-items-center bg-navy-900 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-2">
          <Eye className="text-gold-500" />
          <span className="font-display text-2xl font-semibold">PowerOS</span>
        </div>
        {state ? (
          <>
            <h1 className="text-xl font-semibold text-navy-900">{state.title}</h1>
            <p className="text-sm text-slate-500">{state.body}</p>
            <Link href="/forgot-password" className="btn btn-primary block text-center">
              Request a new link
            </Link>
          </>
        ) : !valid ? (
          <>
            <h1 className="text-xl font-semibold text-navy-900">Link required</h1>
            <p className="text-sm text-slate-500">
              Open the reset link from your email, or request a new one below.
            </p>
            <Link href="/forgot-password" className="btn btn-primary block text-center">
              Request a reset link
            </Link>
          </>
        ) : (
          <ResetPasswordForm />
        )}
        <Link href="/login" className="block text-center text-sm text-navy-700 underline">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
