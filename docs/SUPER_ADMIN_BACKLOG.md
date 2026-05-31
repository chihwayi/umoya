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

### 3. Impersonation / "Login as" — ✅ DONE
- `POST /tenants/:id/impersonate` (super-admin only; **reason required**; active
  tenant only). Resolves the target tenant user (specified `userId` or the tenant
  admin), mints a **15-minute** EHR-compatible staff JWT (same `JWT_SECRET`,
  same claim shape, `tenantId = subdomain` to satisfy the EHR cross-tenant guard)
  carrying `impersonation: true` + `impersonatedBy` claims. Heavily audited.
- Returns a **browser-reachable** deep link (`PUBLIC_EHR_FRONTEND_URL`); token is
  passed in the URL **fragment** (never hits server logs).
- EHR frontend: new `/ehr/:tenantSlug/impersonate` landing page consumes the
  fragment token, establishes the staff session, sets an `ehr_impersonation` flag,
  and routes to the role dashboard. Expiry-checked.
- web-app: per-user **"Log in as"** action in the tenant users table (reason prompt
  → opens session in a new tab).
- Verified: reason enforced, super-admin gated, and the minted token successfully
  authenticates against the EHR service (`/api/auth/profile` returns the
  impersonated user with the correct tenant).

### 4. Multi-admin RBAC — ✅ DONE
- Admin-user management endpoints (super-admin gated): `GET/POST /auth/admins`,
  `PUT /auth/admins/:id/role`, `PUT /auth/admins/:id/status`,
  `POST /auth/admins/:id/reset-password`, `DELETE /auth/admins/:id`.
- `AuthService`: `listAdmins`, `provisionAdmin` (returns one-time temp password),
  `setAdminRole`, `setAdminStatus`, `resetAdminPassword`, `deleteAdmin`.
- Safety guards: cannot demote/disable/delete the **last active super admin**;
  cannot disable or delete **your own** account. All actions audited.
- Roles: `super_admin` (full), `admin` (view team, tenant ops), `support` (read-only).
- UI: new **Team** panel (`AdminTeamPanel.tsx`) — list, create (temp-password modal),
  inline role select, enable/disable, reset password, delete; role-aware (non-super
  admins see a read-only view). Wired into the Dashboard nav.
- Verified end-to-end incl. the last-super-admin guard.

### 5. API-key management — ⬜
- **To build:** per-tenant programmatic API keys: `api_keys` table (hashed key,
  scopes, last_used, revoked_at), generate/revoke endpoints, a keys panel.
  Show the secret once on creation only.
- Effort: M.

### 6. GDPR / CDPA right-to-erasure (soft-delete + grace) — ✅ DONE
- `tenants` gains `deletionRequestedAt`, `deletionRequestedBy`, `deletionReason`,
  `purgeScheduledAt`, `deletionPriorStatus` (live ALTER + entity).
- `DELETE /tenants/:id` is now a **soft-delete**: suspends the tenant and schedules
  a hard purge `TENANT_DELETION_GRACE_DAYS` (default **30**) out. `?force=true`
  performs an immediate irreversible purge. `POST /tenants/:id/cancel-deletion`
  cancels within the window and restores the prior status.
- The hourly lifecycle cron hard-purges once `purgeScheduledAt` passes; pending-
  deletion tenants are frozen from other lifecycle transitions. Whole flow audited.
- UI: TenantCard shows a "Pending deletion · purge {date}" banner with a
  **Cancel deletion** button; delete toast explains the grace window.
- Verified: request → suspended + DB preserved → cancel → restored; force → purged.

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
