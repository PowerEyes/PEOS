import { createBrowserClient } from "@supabase/ssr";

// Keep the browser's anon reads on the same tenant as the server render.
// request_org() reads x-site-host; without this, a mapped host could render
// server HTML from org B while client-side queries still hit org A.
export const supabaseBrowser = () => {
  const host = typeof window === "undefined" ? "" : window.location.host.replace(/:\d+$/, "");
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: host ? { "x-site-host": host } : {} },
  });
};
