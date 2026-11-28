const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');

const envFile = require('node:path').join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const PORT = Number(process.env.PORT || 4000);
const TOKEN = process.env.EMAIL_SERVICE_TOKEN || '';
const FROM = process.env.EMAIL_FROM || 'PowerOS <no-reply@poweros.local>';
const TRANSPORT = process.env.EMAIL_TRANSPORT || 'console';
const messages = [];

function authorized(req) {
  if (!TOKEN) return true; // local-only dev default
  const supplied = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(TOKEN), b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (url.pathname === '/health') return json(res, 200, { ok: true, transport: TRANSPORT });

  if (!authorized(req)) return json(res, 401, { error: 'Unauthorized' });

  if (req.method === 'POST' && url.pathname === '/send') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body;
    try { body = JSON.parse(raw); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
    const { to, subject, text, html, template, context } = body;
    if (!to || !subject) return json(res, 400, { error: 'to and subject are required' });
    const message = {
      id: crypto.randomUUID(),
      to,
      from: FROM,
      subject,
      text: text || (template ? `template:${template} ${JSON.stringify(context || {})}` : ''),
      html: html || '',
      template: template || null,
      context: context || null,
      createdAt: new Date().toISOString(),
    };
    messages.push(message);
    if (messages.length > 200) messages.shift();
    console.log(`[email:${TRANSPORT}] to=${to} subject=${subject}${template ? ` template=${template}` : ''}`);
    if (TRANSPORT === 'webhook') {
      const target = process.env.EMAIL_WEBHOOK_URL;
      if (!target) return json(res, 503, { error: 'EMAIL_WEBHOOK_URL is not configured' });
      try {
        const r = await fetch(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
          body: JSON.stringify(message),
        });
        if (!r.ok) return json(res, 502, { error: `email provider returned ${r.status}` });
      } catch (e) {
        return json(res, 502, { error: String(e && e.message ? e.message : e) });
      }
    } else if (TRANSPORT === 'console' || TRANSPORT === 'memory') {
      console.log(message.text);
    }
    return json(res, 200, { ok: true, id: message.id });
  }

  if (req.method === 'GET' && url.pathname === '/messages') {
    return json(res, 200, { messages });
  }

  return json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => console.log(`PowerOS email service listening on http://localhost:${PORT}`));
