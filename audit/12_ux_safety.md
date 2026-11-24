# Sprint E — UX, Accessibility & Clinical-Safety Human Factors (3.12)

Method: live API where reachable; static traces of the React/React-Native
UI (no emulator/browser harness in sandbox — automated WCAG and
instrumented tap-counts are UNVERIFIED with that stated blocker; static
signals are reported as such, not as WCAG verdicts).

## 1. Wrong-patient risk (executed where the backend decides it)

- **UX-001 (S0, RUNTIME-PROVEN): BCMA "five rights" verification always
  passes.** `verify5Rights` checks that the wristband barcode exists and
  the medication barcode exists, then returns `verified: failures.length
  === 0` — but **nothing ever appends to `failures`** ("would need
  prescription service / For now, basic verification" is in the code).
  Demonstrated live: patient A's wristband + Warfarin barcode with (a) a
  prescription ID belonging to patient B, (b) a nil UUID, (c) a non-UUID
  string → all three return **201 `verified:true`** with only the
  high-alert informational flag. Dose, route, time, and patient↔order
  matching are entirely unchecked. A wrong-patient or wrong-drug scan
  passes the gate as long as both barcodes are valid. (`bcma.service.ts:
  128-180`; `POST /bcma/verify-5-rights`.)
- Ordering context (code-read): order/prescription creation takes
  `patientId` from the ambient chart context, not from a re-entered
  identifier — no 2-identifier confirmation step was found in the
  prescribe/order flows traced (`DoctorRoundsScreen`, `HivCareScreen`).
  Combined with UX-001, neither the ordering nor the administration end
  re-verifies patient identity.
- Patient banner: `DoctorDashboard` carries the current appointment/patient
  context per tab, but no repo-wide persistent banner component was found
  (single `PatientHeader`-like match); multi-tab same-name confusion
  mitigation is UNVERIFIED (needs browser session test).

## 2. Alert-fatigue census (code-read, folding confirmed breaks)

Alert producers found: `abnormal_value`, `hypertensive_crisis`,
`early_warning_deterioration`, `tachycardia`, `bradycardia`,
`low_oxygen_saturation`, `hypo/hyperglycemia`, `vitals_deviation`,
`treatment_failure`, `regimen_change_needed`, `toxo_risk`,
`severe_pain_signal`, `cardiorespiratory_emergency_signal`,
`high_alert_drug`, `interaction`, wearable `3-consecutive` trend alerts,
lab critical/panic tiers, plus CDSS AI suggestions. Severity vocabulary is
free text (`critical/high/moderate/warning/info/urgent`) with no central
tier policy.

- **Compounding with Sprint B (flagged, not re-proven):** the interaction
  engine has 0.301 sensitivity with whole classes invisible (B-001) while
  presenting as "hard-stops" — prescribers get silence, not alerts, on
  lethal pairs; and the mortality badge cries `low` on missing data
  (B-005). The fatigue picture is inverted in the two highest-stakes
  channels: **under-alerting where it matters, unranked alerting
  everywhere else.** No override-reason capture, no duplicate-alert
  suppression, and no per-cause throttle was found in the paths read
  (override UX: UNVERIFIED — needs frontend instrumentation).
- **UX-002 (S1, RUNTIME-PROVEN): any role can acknowledge any critical
  result — demonstrated on hyperkalemia.** Seeded `lab_critical_alerts`
  row (K+ 6.8, `alerted_to` = doctor); `PATCH
  /lab/critical-alerts/:id/acknowledge` as **receptionist** → 200,
  `alert_status=acknowledged`, `acknowledged_by=receptionist`.
- **UX-003 (S2, code-read across call sites): escalation is manual-only.**
  `escalateAlert` requires the caller to supply `escalate_to` (a human
  picks); the sole non-controller reference is event logging. No
  time-based auto-escalation for unacknowledged criticals, no off-shift
  routing rule found. An unacknowledged 2am critical waits for whoever
  opens the queue.
- Positive: lab critical tiers exist (`critical`/`panic`, overdue and
  ack-time stats tracked); the dashboard has a pulsing critical banner.

## 3. LASA / units / defaults (code-read)

- **UX-004 (S3, code-read): LASA data model with no consumer.**
  `medication-barcode-master.look_alike_sound_alike` (jsonb) exists and is
  indexed-adjacent, but repo-wide grep finds **zero readers** — no
  tall-man rendering, no dispense-time confusion warning, no pair list
  shipped. The safeguard is a column, not a behavior. (Tall-man grep:
  zero hits.)
- Unit defaults: the creatinine µmol/L→mg/dL trap (B-002) is the live
  instance of this class; no unit selector was found on the renal dosing
  path to mitigate it. Copy-forward/default-value traps: not traced
  (UNVERIFIED, needs chart-level UI test).

## 4. Accessibility (static signals only)

- No axe/playwright/cypress/jest-axe anywhere in the three package.jsons;
  no a11y test infra. Automated WCAG 2.2 AA: UNVERIFIED (blocker: no
  browser harness; booting ehr-frontend was out of budget).
- Static signals worth a real audit: 73 `<button>`s / **0 `aria-label`s**
  on `DoctorDashboard.tsx`; 11px secondary text in several mobile screens
  (small for low-vision/bright-clinic use); a pulsing `animate-pulse`
  critical banner with no reduced-motion alternative found. None of these
  is a WCAG verdict — they are scoping notes for the audit that must run.

## 5. Task click-counts (static trace, minimum-tap happy path)

Method: screen/modal/submit sequence read from navigation + components;
taps counted, API round-trips noted. Confidence medium; error states and
scroll/typing excluded.

| # | Task | Path (static) | Taps (min) |
|---|---|---|---|
| 1 | Register patient | Search → New → demographics form → emergency contact → save | ~8 + typing |
| 2 | Prescribe (doctor) | DRounds → patient → MedRec modal → drug → dose/freq → interaction check (auto) → confirm | ~7 |
| 3 | Order lab | DRounds → patient → imaging/orders modal → test → confirm | ~5 |
| 4 | Record vitals (nurse) | NVitals → patient → vitals form → save | ~5 + entry |
| 5 | Acknowledge critical alert | Critical banner → alert → acknowledge + note → confirm | ~4 |
| 6 | Check-in (QR) | CheckIn → scan → confirm | ~3 (currently 500s — P-001) |
| 7 | Dispense (pharmacy) | Worklist → prescription → FEFO pick → confirm | ~5 |
| 8 | Referral | Patient → referral → facility → reason → send | ~6 |
| 9 | Book appointment | Calendar → slot → patient → type → confirm | ~6 |
| 10 | Review results | Patient → labs → result → (plain-language tab) | ~4 |

No task exceeds ~8 taps on its happy path (positive for the "two sessions"
usability narrative, with the caveat that error recovery, offline
conflict, and consent-resubmit loops were not measured and P-004 shows one
such loop corrupts data).

## Rule-2 rechecks

BCMA: three prescription-ID variants (cross-patient, nil, garbage) against
the real endpoint. Critical ack: seeded real alert, cross-role PATCH, DB
verification. LASA: entity → zero-consumer grep across all three clients.
Alert census: type-string grep, not hand-waving. WCAG/clicks explicitly
bounded as static-trace, no verdicts claimed beyond method.
