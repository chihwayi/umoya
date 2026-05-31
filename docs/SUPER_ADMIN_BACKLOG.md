# Super Admin Panel (3011) — Feature Backlog

Tracks the "modern admin" capabilities identified in the May 2026 audit that are
**not yet built** (they are not bugs — the panel works; these are enhancements).

Status legend: ✅ done · 🟡 in progress · ⬜ not started

---

## Auth hardening (done this cycle)
- ✅ Reduced admin JWT expiry 24h → configurable **8h** (`ADMIN_JWT_EXPIRES_IN`)
- ✅ Client session guard: proactive expiry redirect, 30-min idle logout, cross-tab logout (`web-app/src/utils/sessionGuard.ts`)
- ✅ Login page shows why the session ended (`?session=expired|idle`)
- ✅ **Server-side token revocation** — admin login tokens now carry a `jti`;
  `POST /auth/logout` adds it to a **Redis denylist** (`revoked:jwt:<jti>`, TTL =
  the token's remaining lifetime so it self-expires) and `AuthService.validateUser`
  rejects any denylisted `jti` with 401. Falls back to a per-process in-memory set
  if Redis is down (`TokenDenylistService`). Web-app `authAPI.logout()` now calls
  the endpoint (best-effort) before clearing local storage. Verified: same token
  → 200 before logout, 401 after; revocation **survives a service restart**; TTL
  observed = 28800s (the 8h token lifetime); fresh logins unaffected.

---

## Feature gaps

### 1. Per-tenant usage analytics UI — ✅ DONE
- The pre-existing `getTenantMetrics` read from `tenant_analytics`, but **nothing
  writes to that table** (it's empty) — so a new real aggregator was built instead
  of shipping a hollow UI.
- New `GET /analytics/tenants/:id/usage?days=N` (`TenantAnalyticsService.getTenantUsage`)
  aggregates **live from the master DB, no synthetic data**:
  - **users**: total, active (status), recentlyActive (`lastLogin` in period),
    newInPeriod (`createdAt` in period), byRole.
  - **apiKeys**: total, active (not revoked/expired), lastUsedAt, configured rate limit.
  - **activity**: per-day audit-event counts for the tenant over `days` + total.
- UI: "Usage" section in `TenantDetailsModal` — 7/30/90-day selector, KPI cards,
  per-role chips, API-key/rate-limit/last-use cards, and an audit-activity bar trend.
- Verified: user counts (active excludes suspended), role breakdown, API-key count,
  rate limit, and the 4 audit events land on the correct day; 401 without a token.

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

### 5. API-key management — ✅ DONE
- `tenant_api_keys` table + `TenantApiKey` entity: SHA-256 **hash only** (never the
  secret), display `keyPrefix`, `scopes`, `lastUsedAt`, `expiresAt`, `revokedAt`.
- `ApiKeyService`: create (full secret `umoya_<prefix>_<secret>` returned once),
  list (masked), revoke, and **verify** (hash lookup + active/expiry check +
  last-used update) — so keys genuinely authenticate, not decorative.
- Endpoints (super-admin gated, audited): `GET/POST /tenants/:id/api-keys`,
  `DELETE /tenants/:id/api-keys/:keyId`, plus open `POST /tenants/api-keys/verify`.
- UI: "API Keys" section in `TenantDetailsModal` — create with one-time reveal +
  copy, status chips, last-used, revoke.
- Verified: create → list (no secret leaked) → verify (valid, correct tenant) →
  revoke → verify now 401.

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

### 7. White-labeling / tenant branding — ✅ DONE
- Per-tenant `brandPrimaryColor` (VARCHAR(7) column on `tenants`, hex-validated in
  `UpdateTenantDto` via `@Matches(/^#[0-9a-fA-F]{6}$/)`), exposed on the public
  `toPublicTenant` payload (incl. `/tenants/subdomain/:slug`).
- Super-admin UI: "Branding" section in `TenantDetailsModal` (colour picker + hex
  input + live preview swatch) persisted via `updateTenant`.
- EHR frontend: `tenantBranding.applyTenantTheme()` sets `--ehr-accent` /
  `--ehr-accent-hover` (derived lighten) from the tenant's brand colour; applied on
  EHR login (`EHRLogin`) and re-applied per EHR route (`RouteThemeManager` in App.tsx).
  Falls back to the default accent when no colour is set or hex is invalid.
- Verified: PUT `#FF6B35` round-trips through the public endpoint + DB; invalid hex
  (`red`) rejected with a friendly message.

### 8. Rate-limit configuration UI — ✅ DONE
- Per-tenant `apiRateLimitPerMin` (column on `tenants`, default 120, 0 = unlimited).
- Enforced in `ApiKeyService.verify` via a **Redis-backed** fixed-window counter
  (atomic INCR+EXPIRE) → returns 429 when exceeded (and `rateLimit: {limit, remaining}`
  when OK). Survives restarts and works across multiple instances; falls back to
  per-process in-memory if Redis is unreachable so verification never hard-fails.
- Endpoints (super-admin gated, audited): `GET/PUT /tenants/:id/rate-limit`.
- UI: editable "Rate limit … /min" control in the API Keys section header.
- Verified: set 3/min → 3 requests 201, 4th/5th → 429.

### 9. Subscription upgrade/downgrade with proration — ✅ DONE
- `TenantService.getMonthlyRate(tier)` is the single pricing source (env-tunable
  $49/$99/$199); `computeProration(tenant, newTier)` returns credit-for-unused +
  charge-for-remaining over the days left in the cycle → net `proratedAmount` +
  `direction` (charge on upgrade / credit on downgrade).
- `GET /tenants/:id/proration-preview?tier=X` (no side effects). On `PUT /tenants/:id`
  a tier change records the proration in the audit trail.
- UI: live proration banner under the tier selector in the package form
  (e.g. "Upgrade — additional USD 150 now"; downgrade shows a credit).
- Verified: basic→enterprise (30 days left) = $150 charge; reverse = $150 credit;
  recorded in audit.

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
