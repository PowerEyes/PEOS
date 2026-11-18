
# WhatsApp Business Template Submission Guide
## Power Eyes Opticals — 8 Templates to Submit

Before your CRM automations can send messages, every template must be approved by Meta.
This takes **3–7 business days**. Submit all templates at once to minimise wait time.

---

## How to Submit

1. Go to [Meta Business Manager](https://business.facebook.com)
2. Navigate to **WhatsApp Accounts → Manage → Message Templates**
3. Click **Create Template**
4. Fill in the details for each template below
5. Submit for review

---

## Template 1: Order Confirmed
**Name:** `power_eyes_order_confirmed`
**Category:** UTILITY
**Language:** English

**Header:** None

**Body:**
```
Hi {{1}}! 🎉 Your order *#{{2}}* has been placed at Power Eyes Opticals. 

We'll notify you as soon as your glasses are ready. For queries, reply here or call 9840496404.

Thank you for choosing Power Eyes!
```
**Parameters:** {{1}} = Customer name, {{2}} = Order code

---

## Template 2: Order Ready for Pickup
**Name:** `power_eyes_order_ready`
**Category:** UTILITY
**Language:** English

**Body:**
```
Hi {{1}}! 🥳 Great news — your order *#{{2}}* is ready for pickup at our *{{3}}* store.

🕐 Store hours: Mon–Sun, 10:00 AM – 9:00 PM
📍 Get directions: https://powereyes.in/store-locator

Please bring this message when you collect your glasses.
```
**Parameters:** {{1}} = Customer name, {{2}} = Order code, {{3}} = Store name

---

## Template 3: Order Delivered
**Name:** `power_eyes_order_delivered`
**Category:** UTILITY
**Language:** English

**Body:**
```
Hi {{1}}! 👓 Your order *#{{2}}* has been delivered. We hope you love your new eyewear!

Need an adjustment? Visit any Power Eyes store — adjustments are free for life.

Rate your experience: https://powereyes.in/my/orders/{{2}}
```
**Parameters:** {{1}} = Customer name, {{2}} = Order code

---

## Template 4: Order Cancelled
**Name:** `power_eyes_order_cancelled`
**Category:** UTILITY
**Language:** English

**Body:**
```
Hi {{1}}, your order *#{{2}}* has been cancelled.

{{3}}

If you paid online, your refund will be processed within 5–7 business days. Need help? Call 9840496404 or reply here.
```
**Parameters:** {{1}} = Customer name, {{2}} = Order code, {{3}} = Cancellation reason

---

## Template 5: Prescription Expiry Reminder
**Name:** `power_eyes_rx_expiry`
**Category:** UTILITY
**Language:** English

**Body:**
```
Hi {{1}}, your Power Eyes prescription expires in *{{2}} days* (on {{3}}).

An up-to-date prescription gives you sharper vision and helps detect any changes early.

📅 Book your free eye test: {{4}}

Mogappair East | Mon–Sun 10:00 AM – 9:00 PM | 9840496404
```
**Parameters:** {{1}} = Name, {{2}} = Days remaining, {{3}} = Expiry date, {{4}} = Booking link

---

## Template 6: Birthday Offer
**Name:** `power_eyes_birthday_offer`
**Category:** MARKETING
**Language:** English

**Body:**
```
Happy Birthday {{1}}! 🎂🎉

Celebrate with *{{2}} off* your next purchase at Power Eyes Opticals.

Use code: *{{3}}*
Valid until: {{4}}

Shop now: https://powereyes.in/eyeglasses
Or visit us at Mogappair East, Chennai.
```
**Parameters:** {{1}} = Name, {{2}} = Discount (e.g. "10%"), {{3}} = Coupon code, {{4}} = Expiry date

**⚠️ Note:** Marketing templates require customer opt-in. Only send to customers with `whatsapp_opt_in = true`.

---

## Template 7: Abandoned Cart Recovery
**Name:** `power_eyes_cart_recovery`
**Category:** MARKETING
**Language:** English

**Body:**
```
Hi {{1}}! 👋

You left *{{2}}* in your bag at Power Eyes Opticals.

Your selection is saved — complete your order before it goes out of stock:
{{3}}

Need help choosing lenses or frames? Reply here or call 9840496404.
```
**Parameters:** {{1}} = Name, {{2}} = Item name, {{3}} = Cart link (https://powereyes.in/cart)

**⚠️ Note:** Marketing template — requires opt-in.

---

## Template 8: Eye Test Appointment Confirmation
**Name:** `power_eyes_appt_confirmed`
**Category:** UTILITY
**Language:** English

**Body:**
```
Hi {{1}}! ✅ Your eye test at Power Eyes Opticals is confirmed.

📅 Date: *{{2}}*
🕐 Time: *{{3}}*
📍 Store: *{{4}}*

Please arrive 5 minutes early. The test takes 20–30 minutes and is completely free.

Need to reschedule? Call 9840496404.
```
**Parameters:** {{1}} = Name, {{2}} = Date, {{3}} = Time, {{4}} = Store name

---

## After Approval

1. Set `WA_PROVIDER=meta` in Supabase Edge Function secrets
2. Set `WA_PHONE_NUMBER_ID` from your Meta Business Manager → WhatsApp → Phone Numbers
3. Set `WA_ACCESS_TOKEN` — generate a permanent token from System Users in Meta Business Manager
4. Test each template using the "Test Run Now" button in PowerOS → CRM

## Important: Marketing Template Opt-In

Meta requires explicit consent before sending marketing messages (birthday offers, cart recovery).
The WhatsApp opt-in checkbox on the signup form satisfies this requirement.

**Before sending marketing templates:** Always check `customers.whatsapp_opt_in = true`
The CRM Edge Functions already check this via `crm_settings.birthday_enabled` and
`crm_settings.cart_recovery_enabled` — make sure these are set to `true` only after
you have collected opt-ins from your existing customer base (send a re-opt-in campaign first).

## Re-Opt-In Campaign for Existing Customers

For customers already in your database before the opt-in checkbox was added, send a WhatsApp
message manually asking them to reply "YES" to receive updates. This satisfies Meta's requirements
and can be done in bulk via the Interakt or WATI broadcast feature.
