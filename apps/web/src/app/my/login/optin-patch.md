
# WhatsApp Opt-In Patch for Login Page

Add these changes to `apps/web/src/app/my/login/page.tsx`:

## 1. Add state variable (after existing useState declarations)
```tsx
const [waOptIn, setWaOptIn] = useState(true);
```

## 2. Update the signup function to save opt-in
```tsx
async function signup(e: React.FormEvent) {
  e.preventDefault(); setBusy(true); setErr("");
  const { data, error } = await sb.auth.signUp({
    email: sEmail,
    password: sPwd,
    options: { data: { full_name: sName } }
  });
  setBusy(false);
  if (error) return setErr(error.message);

  // Save WhatsApp opt-in to customer record
  if (data?.user) {
    await sb.from("customers").update({
      whatsapp_opt_in: waOptIn,
      whatsapp_opt_in_at: waOptIn ? new Date().toISOString() : null,
    }).eq("auth_user_id", data.user.id);
  }

  setOk("Account created! You can now sign in."); setSignupMode(false);
}
```

## 3. Add checkbox to signup form (before the submit button)
```tsx
<label className="flex items-start gap-2.5 cursor-pointer">
  <input
    type="checkbox"
    checked={waOptIn}
    onChange={e => setWaOptIn(e.target.checked)}
    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-navy-700"
  />
  <span className="text-xs text-slate-600 leading-relaxed">
    Send me order updates, prescription reminders and exclusive offers on WhatsApp.
    <span className="text-slate-400"> (Recommended — you can opt out anytime)</span>
  </span>
</label>
```

## 4. Also update the customer-link API route
In `apps/web/src/app/api/customer-link/route.ts`, pass the opt-in preference
when creating the customer record. The trigger creates the customer automatically
but doesn't know the opt-in preference — update it after the trigger runs:

```ts
// After the trigger creates the customer, update opt-in
await sb.from("customers")
  .update({ whatsapp_opt_in: true, whatsapp_opt_in_at: new Date().toISOString() })
  .eq("auth_user_id", user.id)
  .is("whatsapp_opt_in_at", null); // only set if not already set
```
