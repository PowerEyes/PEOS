# PowerOSC API Reference

## Overview

PowerOSC is a monorepo with two Next.js apps:

- **apps/web** — Customer-facing storefront (port 3000)
- **apps/erp** — Staff ERP/admin (port 3001)

Both share a Supabase backend. Internal API routes are Next.js Route Handlers.

## Public API Routes (apps/web)

### `GET /api/track-order`

Track an order by order number and phone/email.

**Query params:**
- `order` (string, required) — order number (e.g., `ORD-0001`)
- `phone` (string, required) — customer phone number

**Response (200):**
```json
{
  "order": {
    "id": "uuid",
    "order_number": "ORD-0001",
    "status": "confirmed",
    "items": [...],
    "total": 1234.00
  }
}
```

**Errors:**
- `404` — order not found
- `400` — missing required params

### `POST /api/checkout`

Create a checkout session for cart items.

**Body:**
```json
{
  "items": [{ "product_id": "uuid", "qty": 1, "lens_options": {...} }],
  "customer": { "name": "...", "phone": "...", "email": "..." },
  "branch_id": "uuid",
  "payment_method": "cash|card|upi"
}
```

**Response (200):**
```json
{
  "order_id": "uuid",
  "order_number": "ORD-0001",
  "total": 1234.00,
  "payment_status": "pending"
}
```

### `GET /api/store-branches`

List available store branches for the customer-facing site.

**Response (200):**
```json
{
  "branches": [
    { "id": "uuid", "name": "Mogappair East", "address": "...", "phone": "..." }
  ]
}
```

### `POST /api/order-confirm`

Confirm an order after payment.

**Body:**
```json
{
  "order_id": "uuid",
  "payment_reference": "string"
}
```

### `POST /api/logout`

Clear the customer session.

**Response (200):** `{ "ok": true }`

### `POST /api/ocr`

Proxy to the OCR service for prescription extraction.

**Body:** multipart/form-data with image file

**Response (200):**
```json
{
  "prescription": {
    "sphere_r": -2.00,
    "cylinder_r": -0.50,
    "axis_r": 180,
    "sphere_l": -1.75,
    "cylinder_l": -0.25,
    "axis_l": 175,
    "add_r": 1.00,
    "add_l": 1.00,
    "pd": 62
  }
}
```

### `GET /api/guide`

Serve the help-me-choose wizard data.

### `POST /api/internal/*`

Internal routes used by the storefront for data fetching. Not for external consumption.

## ERP API Routes (apps/erp)

ERP routes are server actions (not REST). They are invoked via Next.js server actions from the UI.

### Key Server Action Modules

| Module | File | Purpose |
|--------|------|---------|
| Sales | `sales/actions.ts` | Place sale, apply discount, process payment |
| Inventory | `inventory/actions.ts` | CRUD products, stock adjustments, lens options |
| Customers | `customers/actions.ts` | CRUD customers, vision profiles |
| Finance | `finance/actions.ts` | GST ledger, credit notes, period close |
| Prescriptions | `prescriptions/actions.ts` | CRUD prescriptions, OCR confirm |
| Settings | `settings-actions.ts` | Business profile, GST, branch management |
| CRM | `crm/actions.ts` | Leads, follow-ups, reminders |
| Staff | `staff/actions.ts` | Staff management, branch access |

## Authentication

- **Web:** Supabase Auth (email/password + OTP). Session stored in cookies.
- **ERP:** Supabase Auth with role-based access (owner, admin, staff, accountant). RLS enforced at DB level.

## Error Format

All API errors follow this shape:

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "No order found with number ORD-9999",
    "recovery": "Check the order number and try again, or contact support"
  }
}
```

## Rate Limiting

API routes are rate-limited via Supabase edge functions. Default: 100 requests/minute per IP.

## Webhooks

### Incoming
- `POST /api/webhooks/payment` — Payment gateway callback (Razorpay/Stripe)

### Outgoing
- WhatsApp notifications via template messages (see `docs/whatsapp-templates.md`)