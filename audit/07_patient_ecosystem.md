# Sprint D — Patient App, Telemedicine, Wearables, Payments (Section 3.7)

Test fixtures: `AUD-A-001` (adult), `AUD-B-001` (adolescent), `AUD-C-001`
(phone-less). All synthetic. Payment tests touched no provider sandbox —
forgery is against the local callback surface only.

## 1. Pre-visit intake (code-read + live queue check)

- Token design is sound: 256-bit random, sha256-stored, 48h TTL for the
  send link, 3h for reminders, single-purpose links
  (`pre-visit-intake.service.ts:36-55`).
- **P-004a (S2, RUNTIME-PROVEN): resubmission overwrites without a completed
  guard.** `submitForm` matches on `token_hash + expiry` only. Demonstrated
  with zero authentication: submit 1 (`treatment_consent:true`,
  complaint `Headache x3 days`) → `{ok:true}`; submit 2 on the same token
  (`treatment_consent:false`, rewritten complaint, added Warfarin) →
  `{ok:true}`; DB confirms consent flipped true→false and clinical content
  replaced. Any "I already filled it" link is a live bearer credential
  for 48h that can alter the consent record post-signature.
- **P-004b (S2, code-read): `syncToEncounter` drops the clinical payload.**
  Only `chief_complaint` (+ address→patients) propagates; `currentSymptoms`,
  `currentMedications`, `knownAllergies`, consent flags do not. A
  pre-visit allergy disclosure never reaches the encounter record —
  staff must rekey, and the rekeying step is where it gets lost.
- Unguarded `GET :token` returns full PII (name/DOB/address/phone/email)
  to any bearer of the SMS'd link — documented design tradeoff (link as
  credential), but SMS is cleartext and forwardable; noted, not scored.

## 2. QR check-in (live)

- **P-001 (S1, RUNTIME-PROVEN): redeem always 500s.**
  `redeemCheckinToken` SELECTs `…, mrn, … FROM patients`, but the column
  is `patient_number` — `column "mrn" does not exist`. Every legitimate
  first scan fails. (The `used_at` mark commits *before* the failing
  SELECT, so the token is consumed by its own error.) Tampered tokens and
  replays fail closed (400) — positive, and it means the single-use
  mechanism works; there is just no successful path. Non-atomic
  check-then-set leaves a concurrent double-redeem race window (code-read,
  UNVERIFIED live — the `mrn` bug blocks the demonstration).
- Live queue (`GET /checkin/queue`, receptionist token): 200, empty census
  today. The query selects names + MRN + visit-type + wait minutes for all
  checked-in patients — no diagnosis/reason exposed (positive), visible to
  any authenticated role (S4 note, receptionist visibility is legitimate).

## 3. Household privacy (live — the abuser-linked scenario)

- **P-002 (S0, RUNTIME-PROVEN): HIV status leaks to household members by
  design.** `'hiv'` is in `INFECTIOUS_CONDITIONS`
  (`propagation-conditions.ts:1-4`); `propagateDiagnosis` writes a
  household-wide alert naming the condition; `GET
  /household/patients/:id/alerts` is `JwtAuthGuard`-only with a changed-ID
  parameter. Executed: assigned A+B to one household, propagated `HIV`
  from A, read as **receptionist** via B's id →
  `[{condition_name:'HIV', message:'Household contact of patient diagnosed
  with HIV. Screening recommended.', severity:'urgent'}]`.
  No consent check, no role check, no membership check on the reader, no
  disclosure-risk assessment. A patient who links an abusive partner as
  household/family gets their HIV status broadcast to that person through
  the alert feed. Any of TB/hepatitis-B/C in the same list has the same
  shape; HIV is the demonstrated case.
- **P-003 (S2, code + runtime): family panel intends to expose
  `latest_diagnosis`.** `getFamilyPanel` selects each linked member's most
  recent diagnosis description for display to whoever calls with the
  patient's id (any role, any tenant patient). Live it 500s —
  `relation "diagnoses" does not exist` (further bundle drift; the real
  table is `problems`) — so the leak is currently broken rather than
  guarded. Fixing the table name without adding scoping would *activate*
  the exposure.
- Ancillary (observed while testing): `POST /household/assign` with a
  missing `householdId` returns 201 while nulling nothing — absent-field
  validation gap (S4).

## 4. Telemedicine (code-read; no live call — no clients in harness)

- **Positive:** recording start is doctor-role-gated AND consent-gated
  (`startRecording` throws without `checkConsent`; `telemedicine.service.ts:
  740-755`). Guest links are single-room, expiring, revokable, and the
  guest-join path mints scoped LiveKit tokens (migration 059 documents the
  intent; controller enforces doctor-only minting).
- **P-007 (S2/S3, code-read): no end-to-end encryption.** Standard LiveKit
  SFU topology (server decrypts media by design) with no E2EE/key-exchange
  configuration anywhere in service, compose, or `livekit.yaml`; calls are
  additionally recorded via room-composite egress to MP4 in MinIO/S3
  (`telemedicine-video.service.ts:156-193`). Any "end-to-end encrypted
  consultations" claim is contradicted by the architecture — transport +
  server-side media access, not E2E. Recording bucket/region follows
  generic `STORAGE_S3_*` settings (default region `us-east-1`).
- Bandwidth degradation, mid-call latency/Rx timing: UNVERIFIED (needs two
  real clients; stated blocker).

## 5. Payments (live forgery + code-read)

- **P-005 = S-012 (S1, RUNTIME-PROVEN):** see `./audit/09_security.md §5`.
  Forged unattributed Daraja callback flipped a synthetic `pending`
  transaction to `success` with attacker-chosen receipt. Only Flutterwave
  verifies signatures; M-Pesa/MTN/EcoCash/Airtel accept unsigned bodies.
- Amount integrity (code-read): M-Pesa integer rounding is a Daraja API
  requirement (legitimate); all other providers pass exact decimals.
  **No ZiG/ZWL/FX conversion layer exists** (zero hits repo-wide) — amounts
  are assumed to be in the provider's currency. No double-credit on replay
  (positive: `status !== 'pending'` guard).

## 6. Wearables (live injection, bridge bypassed as scoped)

- Bridge STUB status from Sprint A stands and was not re-derived (JS calls
  `NativeModules.HealthKitModule/GoogleFitModule`; bare clone has no
  `ios/`/`android/` — gitignored per `mobile/.gitignore:40-41`; state it
  plainly, no native claim from this sandbox).
- Ingest/alert path works and was exercised directly: boundaries exact
  (140 normal / 141 flagged / 181 critical), absurd HR 9999 and negative
  weight correctly flagged, unknown type `ketones` stored unflagged with no
  allowlist rejection (S4 note), 3-in-24h trend alert fires with
  dedup-by-unacknowledged-alert (positive).
- **P-008 (S2, RUNTIME-PROVEN): critical trend alerts are systematically
  downgraded to `warning`.** `checkAndFireTrendAlerts` selects only
  `is_flagged` but grades on `flag_reason?.startsWith('Critical')` — always
  `undefined` → always `warning`. Demonstrated: glucose 14.2 mmol/L
  (> criticalHigh 13.9, stored reason `Critical high glucose: 14.2`) fired
  alert_level `warning`. Triage/escalation consumers keyed on `critical`
  will miss it. Patient-role scoping on wearable endpoints is correctly
  implemented (`scopedPatientId` throws on cross-patient access — positive
  contrast to §1 findings).

## 7. Language / back-translation (linguist-review method, stated)

Static locales carry UI chrome, not dosing prose (patient education is
LLM-generated per language at runtime — no static gold set exists to
back-translate; live LLM quality test blocked on model credentials,
UNVERIFIED). Compared 10 safety-critical mobile strings across
en/sn/nd/pt/sw/zu/fr/af (presence + identity + spot-review):

- **P-006a (S3): `drug_sub.dose` mistranslated in Ndebele and isiZulu as
  `Isango (esikhethekile)` — *isango* = gate/door, not dose (correct:
  *idozi/umthamo*). A dosing-field label reading "Gate (special)" is a
  patient-facing medication-language defect.** Shona `Dosi (isiyo
  yemhaka)` is suspicious (*mhaka* = fault/case/guilt; "optional" should be
  *zvisarudzo* variant) — flagged at lower confidence. Swahili `Kipimo
  (hiari)` and Portuguese `Dose (opcional)` correct.
- P-006b (S4): Shona `clinical_nlp.allergies` = `Allergy` — untranslated
  English (singular at that); Ndebele/Zulu `Ama-allergy`, Swahili `Mzio`
  present. French `Allergies` is a legitimate cognate, not a gap.
- 10/10 keys present in all 8 locales (no missing-key gaps in this set);
  Shona/Ndebele/Swahili/Zulu/Portuguese critical-value and adherence
  strings read as genuine localizations with correct noun-class morphology.
- Confidence statement: human linguist review by this auditor, not an MT
  round-trip — no BLEU-style scores claimed; the *isango* case is
  unambiguous (wrong lexical item), the Shona *mhaka* case is probable-MT
  phrasing flagged for a native-speaker check.

## 8. Rule-2 rechecks

IDOR/disclosure/household/QR/payment/wearable-level claims were each
verified against real call sites beyond the probe: REST + FHIR + search
for scoping; three non-clinical roles × read/write for disclosure;
middleware bypass list vs controller prefixes for callbacks (the bypass
path `/payments/mobile-money/callback/` matches the controller prefix —
my first 400 was my own wrong path, corrected and re-proven); trend-level
query vs insert for the `warning` downgrade; all 8 locales for the two
flagged strings.
