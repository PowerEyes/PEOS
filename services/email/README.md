# PowerOS email service

A tiny internal HTTP service used by the SaaS apps for transactional email.

- `POST /send` with `{ to, subject, text?, html?, template?, context? }`
- `GET /messages` returns the in-memory dev outbox
- `GET /health` is unauthenticated
- All other routes require `Authorization: Bearer $EMAIL_SERVICE_TOKEN`

`EMAIL_TRANSPORT=console` logs messages locally. Set `EMAIL_TRANSPORT=webhook` and
`EMAIL_WEBHOOK_URL` to hand off to a real provider in production.
