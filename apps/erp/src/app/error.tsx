"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <h2>Something went wrong</h2>
      <p>Please try again. If it keeps happening, contact support.</p>
      <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px" }}>Try again</button>
    </div>
  );
}
