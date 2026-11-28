// Google Drive helpers (OAuth 2.0 web-server flow, scope drive.file = only files this app creates).
// Refresh tokens live in integration_secrets, which only the service role can read.
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file openid email";
export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export function redirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_ERP_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  return `${base}/api/google/callback`;
}
export function authUrl(state: string): string {
  const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(), response_type: "code", scope: DRIVE_SCOPE, access_type: "offline", prompt: "consent", state, include_granted_scopes: "true" });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}
async function tokenCall(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...params }), signal: AbortSignal.timeout(15000) });
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) throw new Error(`Google token error: ${j?.error_description || j?.error || res.status}`);
  return j as { access_token: string; refresh_token?: string; id_token?: string };
}
export const exchangeCode = (code: string) => tokenCall({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
export const accessTokenFrom = async (refresh: string) => (await tokenCall({ refresh_token: refresh, grant_type: "refresh_token" })).access_token;
/** Email from the (Google-issued, direct-from-token-endpoint) id_token payload — display only. */
export function emailFromIdToken(idToken?: string): string | null {
  try { return JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString()).email ?? null; } catch { return null; }
}
const api = async (token: string, url: string, init: RequestInit = {}) => {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) }, signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`Google Drive error ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return res;
};
export async function ensureFolder(token: string, name: string, knownId?: string): Promise<string> {
  if (knownId) { const r = await fetch(`https://www.googleapis.com/drive/v3/files/${knownId}?fields=id,trashed`, { headers: { Authorization: `Bearer ${token}` } }); if (r.ok && !(await r.json()).trashed) return knownId; }
  const res = await api(token, "https://www.googleapis.com/drive/v3/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }) });
  return (await res.json()).id;
}
export async function uploadFile(token: string, folderId: string, name: string, data: Buffer, mime: string): Promise<{ id: string; size: number }> {
  const b = "peos" + Math.random().toString(36).slice(2);
  const head = Buffer.from(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId] })}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`);
  const body = Buffer.concat([head, data, Buffer.from(`\r\n--${b}--`)]);
  const res = await api(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,size", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${b}` }, body });
  const j = await res.json(); return { id: j.id, size: Number(j.size ?? data.length) };
}
export async function deleteFile(token: string, id: string) { await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => null); }
