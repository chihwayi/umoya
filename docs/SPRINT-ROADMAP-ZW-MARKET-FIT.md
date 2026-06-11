# Umoya — Zimbabwe Market-Fit Sprint Roadmap (S216–S223)

Created 2026-06-11. Drivers: (a) the Gemini market analysis points we agreed with,
(b) gaps found validating Umoya against a ZW competitor (Murapi), (c) additions of
our own. **Every sprint that changes the database MUST ship a provisioning bundle**
— see `docs/PROVISIONING_GUIDE.md`. The standard DB checklist for each sprint:

> **DB → Provisioning checklist (run for every schema change):**
> 1. Add an idempotent bundle at the end of `getProvisioningBundles()` in
>    `services/tenant-service/src/services/database-provisioning.service.ts`
>    (`CREATE TABLE IF NOT EXISTS`, `gen_random_uuid()`, no inline expression
>    constraints, `ON CONFLICT DO NOTHING` for seeds, guarded cross-bundle `ALTER`).
> 2. Add the new entities to the tenant entity registry, then regenerate both
>    `tenant-entity-alignment.statements.ts` and `tenant-entity-structure-alignment.statements.ts`
>    (`node scripts/generate-tenant-provisioning-alignment.mjs` / `...structure-alignment.mjs`)
>    and bump their `BUNDLE_VERSION` to today's date.
> 3. FK columns referencing UUID PKs must be `@Column({ type: 'uuid' })` (avoids the
>    text↔uuid FK class — see `project_uuid_text_fk_mismatch`).
> 4. Run `npm run test:smoke` in `services/tenant-service` — must stay 5/5.

---

## Where Umoya already wins (validated, no work needed)
- **Cyber & Data Protection Act [Ch 11:12]**: `cdpa.controller.ts` + `potraz-notification.service.ts` run the real 72-hour POTRAZ breach-notification workflow + DPO escalation. (Gemini wrongly listed this as a TODO.)
- **Printable prescriptions**: `prescription-pdf.service.ts` emits a QR-verified PDF script.
- **Claims AI**: denial prediction, claim risk scoring, auto status-polling, resubmission, pre-auth linkage — ahead of the competitor.
- **Lite / low-bandwidth + USSD** path exists (`lite/` module).
- **Module-based entitlement** (full_ehr / claims_only presets, demo→active→grace→suspended lifecycle).

---

## S216 — ZW Medical-Aid Claim Depth: AHFoZ tariffs + itemised claim lines
**Why:** Competitor itemises claims with AHFoZ tariff codes, dependant code, plan name;
our claim is a single-amount record (member_number + ICD-10 only). This is the #1 ZW
billing-parity gap.
**Scope**
- Reference catalog of **AHFoZ tariff codes** (GP + dental schedules) as seeded master data.
- New `medical_aid_claim_lines` (claim_id, tariff_code, description, qty, unit_amount,
  line_amount, tooth/quadrant for dental, optional ICD-10 link).
- Add `dependant_code` + `plan_name` to `medical_aid_claims`; capture member/dependant/plan
  on the patient medical-aid profile.
- Claim form UI: provider, plan, member #, dependant code, service date, **tariff-code
  typeahead** (catalog), ICD-10 typeahead, amount auto-summed from lines.
**DB → Provisioning:** new tables `medical_aid_tariff_codes`, `medical_aid_claim_lines`;
new columns on `medical_aid_claims`; seed AHFoZ codes via bundle (`ON CONFLICT DO NOTHING`).
Run full DB checklist.
**Acceptance:** create an itemised, tariff-coded claim; total auto-sums; smoke 5/5.

## S217 — Claims Revenue-Cycle Ops: Remittance import, Aged Claims, CSV export
**Why:** Competitor has Import Remittance, Aged Claims, Export CSV — the back-office loop
that practice managers live in. We have a `medical_aid_remittance` entity but no import/aging UI.
**Scope**
- **Remittance import** (CSV/ERA): parse → match to claims by claim_number/external_claim_id →
  post approved/short-paid/rejected → update claim status + shortfall.
- **Aged Claims** report: aging buckets (0–30 / 31–60 / 61–90 / 90+) per provider; pairs with Aged Debtors.
- **Export claims CSV**.
- Claim-status-change → patient SMS (wires into S221).
**DB → Provisioning:** `medical_aid_remittance_lines` table. Run full DB checklist.
**Acceptance:** import a sample remittance → claims reconcile + aging populates; CSV downloads.

## S218 — Real Medical-Aid Integration: de-stub eligibility + live submission  *(Gemini #1)*
**Why:** `medical-aid-integration.service.ts` eligibility returns `'Stub eligibility response'`
and the adapter defaults to a demo service. Real-time "is this patient covered?" is the
make-or-break for ZW private clinics.
**Scope**
- Per-tenant provider config (endpoint, auth type, credentials) — secure storage.
- Route `MedicalAidIntegrationService` eligibility through the real `MedicalAidApiService`
  (CIMAS first), graceful fallback when unconfigured.
- Real-time clearance at registration/appointment; claim submission to provider endpoint
  (status polling already exists).
**DB → Provisioning:** per-tenant provider-config table/columns. Run full DB checklist.
**Acceptance:** configure a sandbox provider → live eligibility (not the stub) + claim submit/poll.

## S219 — MCAZ Pharmacy Compliance  *(Gemini)*
**Why:** No MCAZ (Medicines Control Authority of Zimbabwe) alignment anywhere — the one
genuine regulatory gap Gemini correctly identified.
**Scope**
- MCAZ facility licence + dispensing-pharmacist registration fields.
- Controlled-substance register aligned to MCAZ schedules; MCAZ dispensing/returns export.
**DB → Provisioning:** `mcaz_*` columns/tables. Run full DB checklist.

## S220 — Prescription Legal Validity & Print Hardening  *(Gemini)*
**Why:** PDF script exists; confirm it satisfies local "valid prescription" rules.
**Scope**
- Prescriber registration numbers (MDPCZ etc.), e-signature, MCAZ-compliant Rx layout,
  controlled-substance handling on the printed script, explicit "print physical script" affordance.
**DB → Provisioning:** prescriber-registration fields on practitioner/user. Run full DB checklist.

## S221 — Automated Notification Center + Manual Reminder  *(competitor Image 1)*
**Why:** Competitor has one clean configurable hub (Appointment Booked, 24h Reminder,
Payment Received, Claim Status Updated, Staff Invitation — each SMS/Email) + a manual
composer. We have the plumbing (`at-messaging`, `notification-template`, `sms.service`,
`patient-notifications`) but it's scattered with no config surface.
**Scope**
- Per-tenant configurable triggers (toggle SMS/Email each).
- Manual Reminder composer (patient, type, channel, message + 160-char SMS counter).
- Notification audit log.
**DB → Provisioning:** `notification_trigger_configs`, `notification_log`. Run full DB checklist.

## S222 — Self-Serve Tiered Subscription & Usage Metering  *(competitor Image 3 + Gemini tiering)*
**Why:** Competitor sells clean SME tiers (Solo $35 / Clinic $85 / Multi-Branch $180) with
live usage meters (staff, patients, SMS, branches). Ours is enterprise module-entitlement
with no self-serve tiers or usage caps.
**Scope**
- Plans mapped onto existing module presets + limits (staff accounts, active patients,
  SMS/month, branches), reusing the `billingSummary` lifecycle.
- Usage meters + in-app pricing/upgrade page + soft enforcement (warn → block at limit).
**DB → Provisioning:** `subscription_plans` + tenant usage counters. **Note:** tenant/billing
metadata lives in the **master** DB, not the per-tenant DB — provision there accordingly.
Run full DB checklist where tenant-scoped.
**Acceptance:** usage bars reflect real counts; upgrade path visible; limits enforced.

## S223 — Offline / Load-Shedding Resilience Hardening  *(our add — the moat)*
**Why:** Offline-through-load-shedding is the strongest local differentiator and is what a
demo will be judged on. Make it provably robust.
**Scope**
- Stress-test `conflict-resolver.service` + `offline-sync-queue` under intermittent
  power/network: idempotent replay, conflict UX, queue durability, Lite-mode low-bandwidth path.
- Primarily hardening + tests; minimal/no DB change.

---

## Suggested sequencing
1. **S216 → S217 → S218** (claims is the commercial critical path; do it as a block).
2. **S221** (notifications) and **S222** (subscription tiers) — high demo/marketing impact, independent.
3. **S219 / S220** (MCAZ + Rx legal) — regulatory, can run in parallel.
4. **S223** (offline hardening) — continuous; validate before any on-site demo.
