# NC-S02 — Mandatory MFA + Session Security + Encryption Hardening

**Sprint ID:** NC-S02  
**Priority:** P1 — Must complete before production go-live  
**Effort:** 1.5 weeks  
**Dependencies:** NC-S01 (CDPA context)  
**Covers gaps:** 4.11 (MFA enforcement), 4.3 (encryption at rest scope), 4.4 (encryption in transit), 4.12 (session timeout hardening)

---

## 1. Codebase Context — What Already Exists

| File | What it has |
|---|---|
| `services/tenant-service/src/services/database-provisioning.service.ts` | Bundle `sprint_e3_2fa` — adds `two_factor_secret VARCHAR(255)` and `two_factor_enabled BOOLEAN DEFAULT false` to `users` table |
| `services/ehr-service/src/transformers/encryption.transformer.ts` | `encryptionTransformer` — AES-256-GCM, reads `ENCRYPTION_KEY` env var, applied per-column via TypeORM |
| `services/ehr-service/src/services/hipaa-audit.service.ts` | Audit logging for access events |
| `patient-portal/src/contexts/PatientAuthContext.tsx` | JWT expiry enforcement, 60s interval check, `patient-auth-expired` event |
| `mobile/src/services/api.ts` | 401 interceptor clears stored JWT |

**What's missing:**
- TOTP 2FA exists in DB schema but no enforcement policy (optional not mandatory)
- No MFA enforcement gate — users can bypass 2FA
- `encryptionTransformer` exists but no inventory of which columns actually use it
- No TLS enforcement middleware
- No idle session timeout on EHR frontend
- No MFA exemption management (e.g., emergency access)

---

## 2. What This Sprint Builds

1. **Mandatory MFA policy** — tenant-level flag `mfaRequired: boolean`; when enabled, all staff logins must complete TOTP before receiving a JWT.
2. **MFA enforcement middleware** — `MfaGuard` that validates the `mfa_verified` claim in JWT.
3. **EHR frontend idle timeout** — 15-minute inactivity auto-logout for staff EHR.
4. **Encryption column audit** — apply `encryptionTransformer` to all PHI columns that currently store plain text: `national_id`, `phone_number`, `email` in patient entity.
5. **TLS enforcement** — middleware that redirects HTTP to HTTPS and sets security headers.
6. **Session management UI** — staff can see active sessions and revoke them.

---

## 3. Database Changes

### 3.1 System Tenants Table — `mfaRequired` column

Add to `ensureSubscriptionSchema()` in `services/tenant-service/src/services/tenant.service.ts`:

```typescript
await this.tenantRepository.query(`
  ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
    ADD COLUMN IF NOT EXISTS "allowEmergencyBypass" BOOLEAN NOT NULL DEFAULT false
`);
```

Also add these fields to `TenantEntity`:

```typescript
// In services/tenant-service/src/entities/tenant.entity.ts
@Column({ name: 'mfaRequired', default: false })
mfaRequired: boolean;

@Column({ name: 'sessionTimeoutMinutes', default: 60 })
sessionTimeoutMinutes: number;

@Column({ name: 'allowEmergencyBypass', default: false })
allowEmergencyBypass: boolean;
```

Add to `CreateTenantDto` and `UpdateTenantDto`:

```typescript
@IsOptional()
@IsBoolean()
mfaRequired?: boolean;

@IsOptional()
@IsInt()
@Min(5)
@Max(1440)
sessionTimeoutMinutes?: number;

@IsOptional()
@IsBoolean()
allowEmergencyBypass?: boolean;
```

### 3.2 Per-Tenant Tables — Active Sessions + Emergency Access Log

Add bundle to `getProvisioningBundles()` in `services/tenant-service/src/services/database-provisioning.service.ts`:

```typescript
{
  id: 'nc_session_management',
  label: 'Staff Session Management + Emergency Access Log',
  version: '2026.05.17.1',
  description: 'Active session registry and emergency MFA bypass audit log',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS active_staff_sessions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID         NOT NULL,
      jwt_jti         VARCHAR(64)  NOT NULL UNIQUE,
      ip_address      VARCHAR(45),
      user_agent      TEXT,
      mfa_verified    BOOLEAN      NOT NULL DEFAULT false,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
      last_activity   TIMESTAMPTZ  NOT NULL DEFAULT now(),
      expires_at      TIMESTAMPTZ  NOT NULL,
      revoked         BOOLEAN      NOT NULL DEFAULT false,
      revoked_at      TIMESTAMPTZ,
      revoked_reason  VARCHAR(200)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user_id  ON active_staff_sessions (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_jti      ON active_staff_sessions (jwt_jti)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_active   ON active_staff_sessions (user_id) WHERE NOT revoked`,
    `CREATE TABLE IF NOT EXISTS emergency_access_log (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID         NOT NULL,
      reason          TEXT         NOT NULL,
      approved_by     UUID,
      accessed_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
      audit_reviewed  BOOLEAN      NOT NULL DEFAULT false,
      audit_notes     TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_emergency_log_user ON emergency_access_log (user_id)`,
  ],
},
```

Run `POST /api/admin/tenants/repair-all` after adding.

---

## 4. Backend Implementation

### 4.1 MFA Guard

**File to create:** `services/ehr-service/src/guards/mfa.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const SKIP_MFA_KEY = 'skipMfa';
export const SkipMfa = () => import('@nestjs/common').then(m => m.SetMetadata(SKIP_MFA_KEY, true));

@Injectable()
export class MfaGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MFA_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (skip) return true;

    const req = ctx.switchToHttp().getRequest();
    const tenant = req.tenant;          // set by TenantMiddleware
    const user   = req.user;            // set by JwtAuthGuard

    if (!tenant?.mfaRequired) return true;           // MFA not required for this tenant

    if (!user?.mfaVerified) {
      throw new UnauthorizedException('MFA verification required. Complete TOTP setup at /auth/mfa/setup.');
    }
    return true;
  }
}
```

**Apply globally** in `services/ehr-service/src/ehr.module.ts`:

```typescript
// In providers array:
{
  provide: APP_GUARD,
  useClass: MfaGuard,
},
```

### 4.2 JWT MFA Claim

When issuing JWTs in `auth.service.ts`, include `mfaVerified` claim:

```typescript
// In signJwt() or equivalent:
const payload = {
  sub:         user.id,
  role:        user.role,
  tenantId:    tenantId,
  mfaVerified: user.twoFactorEnabled ? mfaVerifiedInThisSession : !tenant.mfaRequired,
  jti:         uuidv4(),   // unique per session — stored in active_staff_sessions
};
```

### 4.3 TOTP Verification Endpoint

Add to `services/ehr-service/src/controllers/auth.controller.ts` (modify existing file):

```typescript
// POST /auth/mfa/verify
@Post('mfa/verify')
@UseGuards(JwtAuthGuard)
@SkipMfa()
async verifyMfa(
  @Body() body: { totpCode: string },
  @Req() req: any,
) {
  const user = await this.authService.findUserById(req.user.sub, req.tenantDb);
  if (!user?.twoFactorSecret) {
    throw new BadRequestException('TOTP not set up. Call POST /auth/mfa/setup first.');
  }
  const isValid = this.totpService.verify(body.totpCode, user.twoFactorSecret);
  if (!isValid) throw new UnauthorizedException('Invalid TOTP code.');

  // Re-issue JWT with mfaVerified: true
  const newToken = this.authService.signJwt({ ...req.user, mfaVerified: true });
  // Update session record
  await req.tenantDb.query(
    `UPDATE active_staff_sessions SET mfa_verified = true WHERE jwt_jti = $1`,
    [req.user.jti],
  );
  return { accessToken: newToken };
}

// POST /auth/mfa/setup — generates TOTP secret + QR code URI
@Post('mfa/setup')
@UseGuards(JwtAuthGuard)
@SkipMfa()
async setupMfa(@Req() req: any) {
  const secret = this.totpService.generateSecret();
  const otpauthUrl = this.totpService.getOtpauthUrl(req.user.sub, secret);
  await req.tenantDb.query(
    `UPDATE users SET two_factor_secret = $1 WHERE id = $2`,
    [secret, req.user.sub],
  );
  return { secret, otpauthUrl };  // frontend renders QR from otpauthUrl
}

// POST /auth/mfa/enable — marks 2FA as enabled after first successful verification
@Post('mfa/enable')
@UseGuards(JwtAuthGuard)
@SkipMfa()
async enableMfa(@Body() body: { totpCode: string }, @Req() req: any) {
  const user = await this.authService.findUserById(req.user.sub, req.tenantDb);
  if (!this.totpService.verify(body.totpCode, user.twoFactorSecret)) {
    throw new UnauthorizedException('Invalid TOTP code.');
  }
  await req.tenantDb.query(
    `UPDATE users SET two_factor_enabled = true WHERE id = $1`,
    [req.user.sub],
  );
  return { message: 'MFA enabled successfully.' };
}
```

**File to create:** `services/ehr-service/src/services/totp.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import * as speakeasy from 'speakeasy';   // npm install speakeasy @types/speakeasy

@Injectable()
export class TotpService {
  generateSecret(): string {
    return speakeasy.generateSecret({ length: 20 }).base32;
  }

  getOtpauthUrl(userId: string, secret: string): string {
    return speakeasy.otpauthURL({
      secret,
      label:   userId,
      issuer:  'MediCore EHR',
      encoding: 'base32',
    });
  }

  verify(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,   // allow ±30s drift
    });
  }
}
```

Register `TotpService` in `ehr.module.ts` providers.

### 4.4 TLS + Security Headers Middleware

**File to create:** `services/ehr-service/src/middleware/security-headers.middleware.ts`

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Redirect HTTP to HTTPS in production
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }

    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
    );

    next();
  }
}
```

Apply in `services/ehr-service/src/ehr.module.ts`:

```typescript
// In configure(consumer: MiddlewareConsumer):
consumer.apply(SecurityHeadersMiddleware).forRoutes('*');
```

### 4.5 Encryption Column Audit — Apply to PHI Fields

In `services/ehr-service/src/entities/patient.entity.ts`, find the `nationalId`, `phoneNumber`, `email` columns and add the transformer:

```typescript
import { encryptionTransformer } from '../transformers/encryption.transformer';

// Existing column — ADD transformer:
@Column({ name: 'national_id', nullable: true, transformer: encryptionTransformer })
nationalId: string | null;

@Column({ name: 'phone_number', nullable: true, transformer: encryptionTransformer })
phoneNumber: string | null;

@Column({ name: 'email', nullable: true, transformer: encryptionTransformer })
email: string | null;
```

**Note:** After deploying, run a one-time migration script that reads all existing plain-text values and re-saves them through the entity (triggering encryption). This must be done during a maintenance window.

---

## 5. EHR Frontend — Idle Session Timeout

**File to modify:** `ehr-frontend/src/contexts/AuthContext.tsx` (or equivalent auth context)

```typescript
// Add inside the AuthProvider component:
const IDLE_TIMEOUT_MS = (tenant?.sessionTimeoutMinutes ?? 60) * 60 * 1000;
const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const resetIdleTimer = useCallback(() => {
  if (idleTimer.current) clearTimeout(idleTimer.current);
  idleTimer.current = setTimeout(() => {
    logout();
    window.location.href = '/login?reason=idle_timeout';
  }, IDLE_TIMEOUT_MS);
}, [IDLE_TIMEOUT_MS, logout]);

useEffect(() => {
  const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  events.forEach(e => window.addEventListener(e, resetIdleTimer));
  resetIdleTimer(); // start on mount
  return () => {
    events.forEach(e => window.removeEventListener(e, resetIdleTimer));
    if (idleTimer.current) clearTimeout(idleTimer.current);
  };
}, [resetIdleTimer]);
```

**MFA Setup Flow** — Add to `ehr-frontend/src/pages/MfaSetupPage.tsx`:
- Display QR code from `otpauthUrl` using `qrcode.react`
- Input field for TOTP verification code
- On successful verify: calls `POST /auth/mfa/enable`
- On success: redirect to EHR dashboard

**MFA Enforcement** — In the main login flow, after successful password auth:
1. Check `token.mfaVerified` claim
2. If `false` and tenant `mfaRequired`: redirect to `/mfa/verify` instead of dashboard
3. `/mfa/verify` page calls `POST /auth/mfa/verify` and re-issues token

---

## 6. Tests Required

### 6.1 MFA Guard Test

**File:** `services/ehr-service/src/guards/mfa.guard.spec.ts`

```typescript
describe('MfaGuard', () => {
  it('passes when tenant does not require MFA', () => { ... });
  it('throws UnauthorizedException when tenant requires MFA and user.mfaVerified is false', () => { ... });
  it('passes when tenant requires MFA and user.mfaVerified is true', () => { ... });
  it('passes when handler has @SkipMfa decorator', () => { ... });
});
```

### 6.2 TotpService Test

**File:** `services/ehr-service/src/services/totp.service.spec.ts`

```typescript
describe('TotpService', () => {
  it('generateSecret returns a 32-char base32 string', () => {
    const svc = new TotpService();
    expect(svc.generateSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });
  it('verify returns true for correct current TOTP code', () => { ... });
  it('verify returns false for wrong code', () => { ... });
});
```

### 6.3 Security Headers Middleware Test

```typescript
describe('SecurityHeadersMiddleware', () => {
  it('sets HSTS header', () => { ... });
  it('sets X-Frame-Options: DENY', () => { ... });
  it('redirects HTTP to HTTPS in production', () => { ... });
});
```

---

## 7. Sign-off Criteria

- [ ] `mfaRequired`, `sessionTimeoutMinutes`, `allowEmergencyBypass` columns added to `tenants` system table
- [ ] `active_staff_sessions` and `emergency_access_log` tables provisioned in all tenant DBs
- [ ] `POST /auth/mfa/setup` returns secret + otpauthUrl
- [ ] `POST /auth/mfa/enable` marks `two_factor_enabled = true` after valid TOTP
- [ ] `POST /auth/mfa/verify` re-issues JWT with `mfaVerified: true`
- [ ] `MfaGuard` blocks requests when `tenant.mfaRequired=true` and `user.mfaVerified=false`
- [ ] `@SkipMfa()` decorator allows MFA setup endpoints to be called without MFA
- [ ] EHR frontend idles out after configured timeout with redirect to login with `?reason=idle_timeout`
- [ ] `STRICT-TRANSPORT-SECURITY`, `X-Frame-Options`, `X-Content-Type-Options` headers present on all EHR responses
- [ ] `nationalId`, `phoneNumber`, `email` columns in patient entity use `encryptionTransformer`
- [ ] `npm run lint` passes zero errors
- [ ] `npm test` passes zero failures in `ehr-service`
- [ ] CI `build-and-test` job passes green
