"use client";
import { ErrorReporter } from "@/components/ErrorReporter";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en"><body style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ padding: 48, textAlign: "center" }}>
        <ErrorReporter error={error} />
        <h2>Something went wrong</h2>
        <p>Please reload the page. If it keeps happening, contact support.</p>
        <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px" }}>Try again</button>
      </div>
    </body></html>
  );
}
