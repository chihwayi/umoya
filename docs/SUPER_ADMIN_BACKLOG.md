# Super Admin Panel (3011) — Feature Backlog

Tracks the "modern admin" capabilities identified in the May 2026 audit that are
**not yet built** (they are not bugs — the panel works; these are enhancements).

Status legend: ✅ done · 🟡 in progress · ⬜ not started

---

## Auth hardening (done this cycle)
- ✅ Reduced admin JWT expiry 24h → configurable **8h** (`ADMIN_JWT_EXPIRES_IN`)
- ✅ Client session guard: proactive expiry redirect, 30-min idle logout, cross-tab logout (`web-app/src/utils/sessionGuard.ts`)
- ✅ Login page shows why the session ended (`?session=expired|idle`)
- ⬜ **Server-side token revocation** — logout currently only clears client storage;
  the stateless JWT stays valid until `exp`. To truly revoke on logout, add a
  Redis denylist of `jti` values checked in `JwtStrategy.validate`. (Medium)

---

## Feature gaps

### 1. Per-tenant usage analytics UI — 🟡 (backend exists)
- Backend `analyticsAPI.getTenantMetrics(tenantId, days)` already returns metrics.
- **To build:** a "Usage" section in `TenantDetailsModal` rendering API calls,
  active users, storage, and a small trend. Endpoint exists → UI only.
- Effort: S.

### 2. Tenant audit trail UI — ✅ DONE
- Tenant lifecycle events (create / update / activate / suspend / delete) and
  tenant-user events (create / delete / status change / password reset) are now
  audit-logged with `resourceId = tenant.id` and the acting admin + IP/UA.
- `AuditService.getResourceAuditLogs()` + `safeLog()` (auditing never breaks the
  operation it records). New endpoint `GET /tenants/:id/audit`.
- UI: "Audit Trail" timeline in `TenantDetailsModal` (actor, action, values, time, IP).
- Verified end-to-end: create + suspend + delete events captured correctly.

### 3. Impersonation / "Login as" — ⬜
- **To build:** `POST /tenants/:id/impersonate` (super-admin only) that mints a
  short-lived (≤15 min) tenant-user JWT signed for the EHR service, returns a
  deep link to the EHR frontend. Must be heavily audited (who impersonated whom,
  when, why). Add a confirmation modal + reason field.
- Security: never reuse the admin token; scope the minted token; log every use.
- Effort: M. **Security-sensitive — review before shipping.**

### 4. Multi-admin RBAC — ⬜
- Today: single super admin; `AdminRole` enum exists (`super_admin|admin|support`)
  but there's no UI to manage admin users or enforce granular permissions.
- **To build:** admin-user CRUD (create/disable/role-change/reset), enforce role
  on every admin endpoint (guard already supports roles), and a "Team" panel.
  `support` = read-only, `admin` = tenant ops, `super_admin` = everything incl.
  managing other admins.
- Effort: L.

### 5. API-key management — ⬜
- **To build:** per-tenant programmatic API keys: `api_keys` table (hashed key,
  scopes, last_used, revoked_at), generate/revoke endpoints, a keys panel.
  Show the secret once on creation only.
- Effort: M.

### 6. GDPR / CDPA right-to-erasure (soft-delete + grace) — ⬜
- Today: `deleteTenant` hard-deletes immediately.
- **To build:** soft-delete with a configurable grace window (default 30 days):
  mark `deletion_requested_at`, stop access, schedule purge via the existing
  lifecycle cron, allow cancel within the window, audit the whole flow. Emit a
  confirmation + final purge record for compliance.
- Effort: M-L.

### 7. White-labeling / tenant branding — ⬜
- Today: `logoUrl` upload works.
- **To build:** theme colors + email-template branding + (optional) custom domain
  CNAME, stored per tenant and applied in the EHR frontend + patient portal.
- Effort: L (touches ehr-frontend + patient-portal).

### 8. Rate-limit configuration UI — ⬜
- CDSS already rate-limits admin endpoints (`ADMIN_RATE_LIMIT_PER_MIN`); no UI to
  view/tune per-tenant or global limits.
- **To build:** a settings panel + persisted per-tenant override read by the limiter.
- Effort: M.

### 9. Subscription upgrade/downgrade with proration — ⬜
- Today: tier/module changes replace dates with no prorated credit/charge.
- **To build:** compute prorated delta on mid-cycle change, surface it in the
  payment flow, and record it on the subscription ledger.
- Effort: M.

---

## Recommended order
1. Usage analytics UI (S, backend ready)
2. Tenant audit trail (M, high operational value)
3. Multi-admin RBAC (L, unblocks safe delegation)
4. GDPR soft-delete (M-L, compliance)
5. Impersonation (M, debugging — ship behind a flag + heavy audit)
6. API keys (M)
7. Rate-limit UI (M)
8. Subscription proration (M)
9. White-labeling (L, cross-app)

Each should ship with: backend endpoint + guard, UI, audit logging, and a line in
the provisioning smoke test where it touches tenant schema.
