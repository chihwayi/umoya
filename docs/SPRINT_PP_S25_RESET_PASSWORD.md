# Sprint PP-S25 — Patient Portal: Reset Password + Hardcoded Route Fixes

## Objective
Two fixes bundled together because they are both small and affect the same files:

1. **Reset Password page** — currently `<div>Reset Password</div>`, a stub. The backend already has `POST /patient-portal/forgot-password` and `POST /patient-portal/reset-password`. This sprint wires a real UI.

2. **Hardcoded `/demo-clinic/` fallback routes** — `App.tsx` has 8 `Navigate` to `/demo-clinic/...` routes at the bottom. These break every real tenant. Replace them with a redirect to `/select-tenant` or use `TenantSelectorPage` to let the user find their tenant.

3. **Dashboard unreadMessages TODO** — `PatientDashboard.tsx` line 44 has `unreadMessages: 0 // TODO: Implement messaging`. Wire it to the real messages API.

## Database Changes
None — no new tables. No repair-all required.

---

## Part 1 — Reset Password UI

### Backend endpoints (already exist, verify they work)
- `POST /patient-portal/forgot-password` — body: `{ email: string }` — sends reset email
- `POST /patient-portal/reset-password` — body: `{ token: string; newPassword: string }` — resets password

### `patient-portal/src/pages/ResetPasswordPage.tsx` (CREATE)

The reset password flow has **two modes** determined by whether a `?token=...` query param is present in the URL:

**Mode A — Request Reset** (no token in URL)
URL: `/:tenantSlug/reset-password`

Page shell: `min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50`
Card: `max-w-md mx-auto px-4 py-20 bg-white rounded-3xl shadow-xl border border-gray-200 p-8`

Header:
- Icon: `w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-6`
  Inside: `<KeyRound className="w-8 h-8 text-white" />`
- Title: "Reset Password" (text-2xl font-bold text-gray-900 text-center)
- Subtitle: "Enter your email and we'll send you a reset link" (text-sm text-gray-500 text-center)

Form:
- Email input (with `Mail` icon prefix): `type="email"` — `w-full border border-gray-200 rounded-xl px-4 py-3 pl-10 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`
- Submit button: `w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl`
  Label: "Send reset link" / loading: "Sending..."

On submit: call `POST /patient-portal/forgot-password` with `{ email }` and `X-Tenant-ID` header.
On success: show green success banner: `bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3` — "Check your email. If an account exists, you'll receive a reset link shortly."
On error: red banner.

Back link: "← Back to login" → `/${tenantSlug}/login`

**Mode B — Set New Password** (token present in URL `?token=...`)
URL: `/:tenantSlug/reset-password?token=XXXXXX`
Use `useSearchParams()` to read `token`.

Header:
- Same icon (KeyRound)
- Title: "Set New Password"
- Subtitle: "Choose a strong password for your account"

Form:
- New Password input (`Lock` icon, `type="password"`) with show/hide toggle
- Confirm Password input (`Lock` icon, `type="password"`) with show/hide toggle
- Password strength meter (3 bars): weak (red) if < 8 chars, medium (yellow) if ≥ 8 and has mixed case, strong (green) if ≥ 10 chars + number + special char
- Submit button: "Set new password" / loading: "Saving..."

Validation before submit:
- Passwords match — show "Passwords do not match" error inline if they don't
- Min 8 characters — show "Password must be at least 8 characters" if not

On submit: call `POST /patient-portal/reset-password` with `{ token, newPassword }` and `X-Tenant-ID`.
On success: show green banner, then redirect to `/${tenantSlug}/login` after 2 seconds.
On error: red banner "This reset link has expired or is invalid. Please request a new one." with link → Mode A.

### `patient-portal/src/App.tsx`
Replace:
```tsx
<Route path="/:tenantSlug/reset-password" element={<div>Reset Password</div>} />
```
With:
```tsx
<Route path="/:tenantSlug/reset-password" element={<ResetPasswordPage />} />
```
Import `ResetPasswordPage` at top.

### `patient-portal/src/pages/LoginPage.tsx`
Find the "Forgot password?" link. If it navigates to `/${tenantSlug}/reset-password` it is correct. If it is a stub or missing, add it below the password field:
```tsx
<div className="text-right">
  <Link
    to={`/${tenantSlug}/reset-password`}
    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
  >
    Forgot password?
  </Link>
</div>
```

### `patient-portal/src/services/api.ts`
Add:
```typescript
forgotPassword: async (email: string, tenantSlug: string) => {
  const response = await fetch(`${API_BASE_URL}/patient-portal/forgot-password`, {
    method: 'POST',
    headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug }),
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to send reset email');
  }
  return response.json();
},

resetPassword: async (token: string, newPassword: string, tenantSlug: string) => {
  const response = await fetch(`${API_BASE_URL}/patient-portal/reset-password`, {
    method: 'POST',
    headers: _withRid({ 'Content-Type': 'application/json', 'X-Tenant-ID': tenantSlug }),
    body: JSON.stringify({ token, newPassword }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to reset password');
  }
  return response.json();
},
```

---

## Part 2 — Remove Hardcoded `/demo-clinic/` Fallback Routes

### `patient-portal/src/App.tsx`
At the bottom of the `<Routes>` block there are 8 static `<Navigate to="/demo-clinic/...">` routes. Replace ALL of them with a single catch-all that redirects to `/select-tenant`:

**Remove** these 8 lines:
```tsx
<Route path="/register" element={<Navigate to="/demo-clinic/register" replace />} />
<Route path="/login" element={<Navigate to="/demo-clinic/login" replace />} />
<Route path="/verify-email" element={<Navigate to="/demo-clinic/verify-email" replace />} />
<Route path="/reset-password" element={<Navigate to="/demo-clinic/reset-password" replace />} />
<Route path="/link-account" element={<Navigate to="/demo-clinic/link-account" replace />} />
<Route path="/dashboard" element={<Navigate to="/demo-clinic/dashboard" replace />} />
<Route path="/appointments" element={<Navigate to="/demo-clinic/appointments" replace />} />
<Route path="/records" element={<Navigate to="/demo-clinic/records" replace />} />
<Route path="/prescriptions" element={<Navigate to="/demo-clinic/prescriptions" replace />} />
<Route path="/bills" element={<Navigate to="/demo-clinic/bills" replace />} />
<Route path="/vitals" element={<Navigate to="/demo-clinic/vitals" replace />} />
<Route path="/messages" element={<Navigate to="/demo-clinic/messages" replace />} />
```

**Replace with one route** at the very end of `<Routes>` (catch-all for non-tenant paths):
```tsx
<Route path="*" element={<Navigate to="/select-tenant" replace />} />
```

Also update the root redirect:
```tsx
<Route path="/" element={<Navigate to="/select-tenant" replace />} />
```
(was `<Navigate to="/demo-clinic/dashboard" replace />` — change to `/select-tenant`)

---

## Part 3 — Wire Dashboard Unread Messages Count

### `patient-portal/src/pages/PatientDashboard.tsx`
Inside `loadStats()`, replace:
```typescript
unreadMessages: 0, // TODO: Implement messaging
```
With a real call:
```typescript
const unreadMessages = await patientPortalApi.getMessages(token!, tenantSlug, { read: false, limit: 1 })
  .then((data: any) => {
    const arr = Array.isArray(data) ? data : (data.messages || data.data || []);
    return data.total ?? arr.length;
  })
  .catch(() => 0);
```
Then use `unreadMessages` in the stats object:
```typescript
unreadMessages,
```
And in the stats display card (the messages count card), show the live count with a "New" badge if > 0.

## Acceptance Criteria
- [ ] `/:tenantSlug/reset-password` renders the email request form (Mode A)
- [ ] `/:tenantSlug/reset-password?token=XXX` renders the new-password form (Mode B)
- [ ] Forgot-password form calls backend and shows success banner
- [ ] Reset-password form validates password match and length before submit
- [ ] Successful reset redirects to login after 2 seconds
- [ ] "Forgot password?" link on LoginPage navigates to reset-password route
- [ ] All `/demo-clinic/...` hardcoded fallback routes replaced with `/select-tenant` redirect
- [ ] Root `/` redirects to `/select-tenant`
- [ ] Dashboard unreadMessages count is live from API
- [ ] No hardcoded tenant slugs anywhere in new files
- [ ] Password strength meter shows weak/medium/strong with correct colors
