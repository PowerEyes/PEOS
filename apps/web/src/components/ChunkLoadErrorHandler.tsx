"use client";

import { useEffect } from "react";

/**
 * Recovers from transient `ChunkLoadError`s (e.g. "Loading chunk app/layout
 * failed") that happen when the dev server restarts or a stale chunk is
 * served after a deploy. The browser can't retry a failed dynamic import on
 * its own, so one guarded reload clears the stale manifest. sessionStorage
 * throttles the reload so a genuinely broken build can't loop forever.
 */
export function ChunkLoadErrorHandler() {
  useEffect(() => {
    const THROTTLE_MS = 30_000;
    const CHUNK_RE = /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

    const recover = (message: string) => {
      if (!CHUNK_RE.test(message)) return;
      try {
        const last = Number(sessionStorage.getItem("chunk-reload-at") || 0);
        if (Date.now() - last < THROTTLE_MS) return;
        sessionStorage.setItem("chunk-reload-at", String(Date.now()));
      } catch {
        // sessionStorage unavailable (private mode) — still try one reload.
      }
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => recover(e.message || "");
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason: any = e.reason;
      recover(reason?.message || String(reason ?? ""));
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
