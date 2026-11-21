import { serviceDb } from "./tenant";

// DB-backed fixed-window limiter (works across serverless instances). Fails OPEN if the limiter itself errors,
// so an outage of the limiter never takes the storefront down (errors are logged).
export async function rateLimited(req: Request, name: string, limit: number, windowSecs: number, extra = ""): Promise<boolean> {
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
    const { data, error } = await serviceDb().rpc("rate_limit_hit", { p_key: `${name}:${extra || ip}`, p_limit: limit, p_window_secs: windowSecs });
    if (error) { console.error("[ratelimit]", error.message); return false; }
    return data === false;
  } catch (e: any) { console.error("[ratelimit]", e?.message); return false; }
}
export const tooMany = () => new Response(JSON.stringify({ error: "Too many requests. Please wait a few minutes and try again." }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "300" } });
