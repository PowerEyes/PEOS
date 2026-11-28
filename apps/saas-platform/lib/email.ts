export async function sendEmail(payload: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  context?: Record<string, unknown>;
}) {
  const base = process.env.EMAIL_SERVICE_URL;
  if (!base) throw new Error("EMAIL_SERVICE_URL is not configured");

  const response = await fetch(`${base.replace(/\/$/, "")}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.EMAIL_SERVICE_TOKEN || ""}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Email service returned ${response.status}`);
  }
  return response.json();
}
