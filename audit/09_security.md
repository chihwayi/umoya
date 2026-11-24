# Sprint D — Security, Privacy & Compliance (Section 3.9)

Booted stack: ehr-service `dist` rebuilt from this commit, live at
`127.0.0.1:3013/api` against throwaway PG `audit-D-pg:55440`
(db `medicore` + `tenant_audit_clinic` via `repairTenants.ts` 308-bundle
set) and redis `audit-D-redis:56379`. Synthetic users only
(admin/doctor/receptionist/pharmacist/nurse, `AuditPass123!`, bcrypt).
Tokens: real logins verified first (then login rate-limit tripped at
10/15 min — itself a finding-positive, S-015); the matrix below ran with
HMAC-equivalent harness-signed JWTs (server secret
`audit-test-secret-0123456789`, same claims `{sub,email,role,tenantId}`,
8h). `JwtStrategy.validate` is pure claim-mapping with no DB/session
lookup (`strategies/jwt.strategy.ts:19-36`), so harness tokens exercise
exactly the production authorization path; authentication itself was
proven separately by real logins.

Scratch-only schema shims (NOT product changes, documented so the runtime
results read correctly): added `deceased_at`, `confidentiality_tier`,
`vip_flag` to the scratch `patients` table. Every one of these is a
provisioning-bundle-vs-entity drift (S-003); without the shims no patient
read executes at all.

## 1. RBAC matrix (built from code, tested live)

Guards in play: `JwtAuthGuard` (class-level on `PatientController`,
`PsychosocialController`, `FhirController`, `HouseholdRiskController`,
`WearableController`); `RolesGuard` with `ADMIN_OVERRIDE` + `nurse_accounts`
expansion on select routes only (`markDeceased`, `deactivatePatient`,
telemedicine recording/guest-link, wearable patient-scoping is inline).

| Role | Read any patient (REST) | Read any patient (FHIR) | FHIR search census | Disclosure GET (adol.) | Disclosure POST (adol.) | Create user | List patients |
|---|---|---|---|---|---|---|---|
| admin | 200 | 200 | 200 (total=2) | 200 | 201 | 200 | 200 |
| doctor | 200 | 200 | — | 200 | 201 | — | — |
| receptionist | **200** | **200** | **200** | **200** | **201** | 403 | 200 |
| pharmacist | **200** | **200** | — | **200** | **201** | — | — |
| nurse | **200** | **200** | — | **200** | — | — | — |
| no token | 401 | 401 | — | 401 | — | — | — |
| bogus token | 401/403 | — | — | — | — | — | — |

Bold = privilege the role should not have under least-privilege / Zimmerman
adolescent-confidentiality expectations. Full harness logs are reproducible
with the payload shapes in this file; patient fixtures `AUD-A-001` (adult),
`AUD-B-001` (adolescent, DOB 2012), `AUD-C-001` (phone-less conflict probe).

Correction during self-audit: `GET /fhir/Patient/:id/everything` (and
`?_everything=true`) **does** exist (`fhir.controller.ts:97-135`) — an
earlier draft wrongly said no such routes exist. Tested live as
receptionist: reachable with no role check (same IDOR class as S-001) but
currently 500s on `column "patientId" does not exist` (further
camelCase-vs-snake_case drift in `getPatientEverything`). Exposure without
scoping is proven by reachability; data return is blocked only by the bug.

- **S-001 (S0, RUNTIME-PROVEN, resolves Sprint C I-017): horizontal IDOR.**
  `GET /patients/:id` and `GET /fhir/Patient/:id` perform zero
  patient-level scoping (`patient.service:getPatientById` =
  `findOne({where:{id,isActive}})`; FHIR mapper likewise). Any valid tenant
  token reads any patient; `GET /fhir/Patient` returns the full census to a
  receptionist (`total=2`). Changed-ID reads of nonexistent uuids 404
  cleanly (no leak). `GET /documents?patientId=` as receptionist → 200
  (same class). No `_revinclude`/`$history` routes exist; `$everything`
  exists and is covered in the correction note above.
- **S-002 (S0, RUNTIME-PROVEN, resolves Sprint B disclosure blocker):**
  `PsychosocialController` is `JwtAuthGuard`-only — no `@Roles`, no age
  check. Receptionist `GET` adolescent disclosure history: 200 with rows.
  Pharmacist `POST` adolescent disclosure with a clinically-shaped body:
  **201**, row persisted with `assessed_by` = pharmacist's own id.
  Receptionist `POST`: **201**. The in-file reference pattern that proves
  per-role scoping was known and feasible is the counsellor-sessions
  endpoint (`getSessions`: non-counsellors get `null` user scope) — the
  disclosure endpoints simply don't use it.
- Vertical escalation holds: receptionist `POST /users` → 403
  (`You do not have access to this resource`). Unknown-tenant header → 400
  `Invalid tenant` (fail-closed). Missing tenant header → 400.
  Unauthenticated → 401 consistently. Login brute force → 429 after 10
  attempts/15 min/IP (`main.ts:114-121`, tripped live).

## 2. Schema drift with security consequences

- **S-003 (S1, RUNTIME-PROVEN): tenant bundles are behind the entities.**
  `deceased_at`, `vip_flag`, `confidentiality_tier`
  (`patient.entity.ts:158-165`, migration
  `database/migrations/057-patient-deceased-vip-confidentiality.sql`) exist
  in no provisioning bundle (`grep` over
  `database-provisioning.service.ts` = zero hits) and were never applied to
  the scratch tenant by `repairTenants`. Result: **every** patient read on a
  freshly provisioned tenant 500s (`column Patient.deceased_at does not
  exist`). The sanctioned repair path (`scripts/migrate.sh TARGET_DB=…`
  replays `database/migrations/*.sql`) is manual per-clinic-DB and is not
  invoked by tenant-service provisioning/repair flows (`migrate.sh:114`
  says clinic schemas come from tenant-service). Any deployment that relies
  on provisioning alone ships a tenant where core clinical reads are down.
  Residual error text leaks internal column names (minor).
- **S-004 (S1, RUNTIME-PROVEN): encryption transformer vs `VARCHAR(50)`.**
  `nationalId`/`phone`/`email` carry `encryptionTransformer`
  (AES-256-GCM, `iv:tag:ciphertext` hex ≈ 2× plaintext + 64 chars), but the
  sanctioned bundle defines `id_number VARCHAR(50)`, `phone VARCHAR(50)`.
  Any registration including a national ID or phone 500s
  (`value too long for type character varying(50)` — server log shows the
  scrypt/GCM-format hashes bound for those columns). The DTO effectively
  requires both fields, so this is a near-total registration outage on any
  tenant with a valid 32-byte `ENCRYPTION_KEY`. Converse branch (stated,
  single-source): if the key is missing/malformed, `encrypt()` returns the
  plaintext unchanged — silent plaintext-PHI storage. Either branch is a
  finding; the 500 branch was executed, the passthrough branch is
  code-read (`encryption.transformer.ts:14-17`).
- **S-005 (S2, RUNTIME-PROVEN): MFA requirement can never engage.**
  `getTenantSecurityPolicy` reads `tenants.mfaRequired` (+
  `sessionTimeoutMinutes`, `allowEmergencyBypass`). That column exists only
  in the TypeORM entity (`tenant-service/.../entities/tenant.entity.ts:130`);
  **no** file under `database/` defines it, and `synchronize:false`
  everywhere means nothing creates it. The query throws, the catch returns
  `null` (live log: `Failed to load tenant security policy … column
  "mfaRequired" does not exist` on every request), and both consumers fail
  open: `auth.service` defaults `mfaVerified = !undefined = true`;
  `MfaGuard` computes `Boolean(undefined) = false` and returns true. A
  tenant that believes it mandates MFA gets password-only logins with zero
  warning. Session timeout silently falls back to 60 min.

## 3. Injection / XSS / deserialization / traversal (live)

- **S-006 (S2, RUNTIME-PROVEN): stored-XSS payload persists unmodified.**
  `POST /nursing-notes` (`@Body() body: any`, no validation, no
  sanitization) accepted `<script>alert(document.domain)</script><img
  src=x onerror=alert(2)>` into the INSERT (proven by the DB error detail
  echoing the payload; the 500 itself is the unrelated `recorded_by`
  drift). Retrieval path is `application/json`. Current web frontends render
  note-adjacent HTML only through `DOMPurify.sanitize` (4 call sites, all
  consent content), and no `dangerouslySetInnerHTML` note renderer was
  found — so exploitability today depends on every current and future
  consumer escaping correctly. Server-side: zero neutralization. CSP ships
  `script-src 'self' 'unsafe-inline'` (observed live), which weakens the
  backstop. No `hsts` observed on the test boot (expected locally; verify
  in prod).
- SQLi: `' OR '1'='1` in `:id` → 500 via uuid cast, **nothing leaked**
  (fail-closed); in `?search=` → 200 with normal result shape. Error text
  echoes the input (minor reflection, S4).
- **S-007 (S2, RUNTIME-PROVEN): the audit trail drops exactly the requests
  it most needs to keep.** `HipaaAuditInterceptor` is global, but its catch
  (`Never fail the request`) plus strict uuid/FK columns mean hostile or
  malformed input silently escapes auditing — 11 dropped writes observed:
  `uuid: "undefined"`, `uuid: "profile"`, `uuid: "' OR '1'='1"`
  (the SQLi probe's audit entry died with the request), and an FK violation
  on a disclosure write. Correction to the naive reading: disclosure and
  FHIR accesses **are** logged (as generic `patient_view`/`patient_create`
  with correct user attribution — 42 rows from this battery), so coverage
  exists; the gap is the fail-open-and-silent drop on non-conforming input.
- **S-008 (S2, RUNTIME-PROVEN): `POST /fhir/$batch` and `$transaction`
  are dead routes** — 404 on literal and `%24`-encoded variants while
  `/fhir/metadata` 200s. Any integration built against batch/transaction
  semantics cannot function; Sprint C's atomicity question is moot until
  the routes resolve. `$validate` shares the pattern (code-read).
- Path traversal: `..%2F..%2Fetc%2Fpasswd` in `:id`/template params →
  404/500 via uuid cast, no file access. No upload/download-by-path
  endpoint found (report-builder streams generated buffers with fixed
  extensions). SSRF: no server-side fetch of user-supplied URLs found in
  the callback/webhook surface (callbacks are inbound); outbound calls use
  configured base URLs. Both noted as bounded negative results, not proofs.

## 4. Auth-adjacent controls

- **S-009 (S3, code-read + header evidence):** `main.ts:94-95` —
  `origin: corsOrigins.length ? corsOrigins : true` reflects any origin when
  `CORS_ORIGINS` is unset, combined with observed
  `access-control-allow-credentials: true`. Reflection not executed live;
  verify `CORS_ORIGINS` in prod.
- **S-010 (S2, code-read, broad grep): no consent-enforcement layer.**
  No `ConsentGuard`/`RequireConsent`/consent-check exists outside
  procedure-specific (aesthetic/blood-bank/surgery) flows.
  `digital-consent.service` is request/token workflow only; teleconsult
  recording is the one path that calls `checkConsent` (positive, §5).
  DHIS2 push has no consent gate (Sprint C I-018, not duplicated).
- **S-011 (S2/S3, code-read + config): data-residency.**
  `clinical-llm.service.ts` posts prompts carrying age/sex/diagnoses/meds/
  labs to `ANTHROPIC_BASE_URL` (`https://api.anthropic.com`, US) or Bedrock
  (`AWS_REGION=us-east-1`, US) with no consent check and no redaction gate
  in ehr-service; `CDSS_BLOCK_OUTBOUND_PHI=true` is honored only inside
  cdss-service (`main.py:585`), which the ehr-service LLM path bypasses.
  Audit stores only a 64-bit-truncated prompt hash (fine). `@sentry/nestjs`
  is a dependency with `tracesSampleRate: 1.0`, no `beforeSend` scrub; the
  observed `QueryFailedError` details demonstrably contain PHI-shaped row
  values, so enabling `SENTRY_DSN` (empty in this env) would exfiltrate PHI
  to sentry.io — latent, flag for prod config. No product-analytics SDKs
  found (the only `segment` hits are audio-segment in transcription).

## 5. Payments (live forgery)

- **S-012 (S1, RUNTIME-PROVEN end-to-end): unauthenticated payment
  confirmation.** `callback/*` for mpesa/mtn/ecocash/airtel take `any` body
  with no auth and no signature check (`verifyWebhookSignature` returns
  `true` for every non-Flutterwave provider — documented as "relies on URL
  secrecy + IP allowlisting", neither enforced in code). Executed: seeded a
  `pending` M-Pesa tx (`checkout_request_id=ws_CO_FORGED123`), POSTed a
  fabricated Daraja `stkCallback` with **no token, no tenant header** to
  `/api/payments/mobile-money/callback/mpesa` → HTTP 200, row flipped
  `pending → success` with attacker-chosen receipt `FORGEDRCPT001`
  (downstream `addPayment` then failed only on my fake invoice id —
  `Bill not found` — the confirmation-state corruption is the finding).
  Replay/double-credit is guarded (`status !== 'pending'` skip — positive).
  Scope notes: forgery needs a valid `checkoutRequestId` (or invoice id via
  the `AccountReference` path); exploitation is targeted, not blind mass
  forgery. `SINGLE_TENANT_ID` scoping means multi-tenant deployments
  without it silently ignore callbacks (availability note). Flutterwave is
  the only signed provider (positive).
- Amount handling (code-read): only the M-Pesa path rounds
  (`Math.round`, Daraja integer-API requirement — legitimate); MTN/EcoCash/
  Airtel pass exact decimals. **No ZiG/ZWL/FX layer exists** in
  mobile-money code (zero hits) — amounts are assumed to be in the
  provider's currency; any "ZiG conversion" claim would be UNVERIFIED.

## 6. Supply chain & secrets

- **S-013: `npm audit` (ehr-service): 80 vulns — 5 critical, 28 high, 45
  moderate, 2 low** (Sprint A repo-wide figure was 162; this is the
  service-scoped recount). Critical advisories touch `@aws-sdk/xml-builder`,
  `fast-xml-parser`, `handlebars`, `proxy-addr`, `tar`; highs include
  `axios`, `body-parser`, `multer`, `nodemailer`, `@nestjs/*`,
  `africastalking` (SMS/OTP path), `fhir-kit-client`, `ws`, `zod`.
  Installed-version reachability not traced per-advisory — treat as
  exposure inventory, patch-priority input, not exploited claims.
- **S-014: secrets.** `.env` is gitignored and untracked (only
  `.env.example` + `.npmrc` tracked — positive); targeted grep of tracked
  files for private-key / `sk-live` / AWS-key patterns: clean. Full-history
  `gitleaks`/`trufflehog` scan: **UNVERIFIED** — no scanner binary on this
  box, none installed (report-only constraint + time). One hygiene note: the
  working `.env` holds a real-format third-party LLM key (value deliberately
  not recorded anywhere in `./audit/`); confirm it is a sandbox key and
  rotate if it ever saw production.

## 7. HIPAA §164.312 technical-safeguards gap table

| Safeguard | Status (this sprint's evidence) |
|---|---|
| Access control / unique IDs / emergency access (§164.312(a)(1),(a)(2)(i),(a)(2)(ii)) | Unique IDs + login throttle present; **no patient-level scoping** (S-001, S-002); `allowEmergencyBypass` column missing so the policy is unreadable (S-005) |
| Audit controls (§164.312(b)) | Interceptor global and logging (positive) but **drops hostile/malformed requests silently** (S-007); disclosure/FHIR logged only under generic actions |
| Integrity (§164.312(c)(1)) | No version/precondition on clinical writes — silent LWW demonstrated (O-001, `./audit/08_offline_sync.md`) |
| Transmission security (§164.312(e)) | TLS is deployment-territory (not tested here); **PHI-equivalent payloads leave the region to US LLM endpoints** without consent/redaction gate (S-011) |
| Device/media (local storage) | Mobile PHI cache is AES-encrypted w/ SecureStore-held key (positive, O-006) |
| Breach notification readiness | Audit gaps in S-007 bound forensic completeness for hostile-input incidents |

## Verdicts and rule-2 rechecks

Every S0/S1 above was re-checked against real call sites (generalization
rule): IDOR against REST + FHIR + search + nonexistent-ID; disclosure with
three non-clinical roles + correct/incorrect payloads; drift against bundle
source, entity, migration dir, and `migrate.sh`; MFA against entity, SQL
dir, `synchronize` flags, and live log; forgery against controller,
service, middleware bypass list, and live DB state. Downgrades applied
where the evidence narrowed (S-007 coverage correction, S-009 reflection
untested, S-014 history scan).
