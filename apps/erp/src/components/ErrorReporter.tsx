"use client";
import { useEffect } from "react";
/** Sends a caught render error to the error log once, then shows the fallback UI. */
export function ErrorReporter({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    fetch("/api/log-error", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, path: location.pathname }) }).catch(() => {});
  }, [error]);
  return null;
}
