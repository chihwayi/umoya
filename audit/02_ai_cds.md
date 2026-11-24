# 3.2 AI / Clinical Decision Support

Read-only; no source edited. Every numbered result below was EXECUTED unless
explicitly marked code-read. Full feature inventory (39 rows) fed this report;
per-feature classification lives in `AI_REALITY_TABLE.md`.

## 1. Feature census → honesty summary

- **Real ML (fitted weights, executed here or in-repo):** no-show logistic
  regression + TF-IDF coding (`ml-models.service.ts`), federated-learning
  orchestration, CDSS sklearn/statsmodels trend estimators, Whisper STT path,
  diagnostic-assistant MedBERT/ClinicalBERT + fusion (download-gated).
- **Rule-based (mislabeled "AI" in brochure or filenames):** appointment-ai
  scoring/briefs, registration-ai phonetic match, supply-chain velocity,
  triage/ESI, sepsis NEWS2/qSOFA/SOFA composite, early-warning/MEWS,
  Framingham ×2, dosing, interactions, PDMP-check proxy, encounter-copilot
  orchestration, PRO score tables, plain-language lab/imaging narratives.
- **LLM (real, governed):** post-visit grounded generation (referral/note/
  polish/patient-answer/escalation), clinical-NLP extract, clinical-summary
  upgrade, follow-up recommendation upgrade, patient-AI chat, CDSS diagnostic
  merge + one-liner, encounter-coding extract tier.
- **Stub (proxy ids, no local inference):** radiology-AI EHR side
  (`radiology_analysis_proxy`), claims-AI EHR side, inbox-triage EHR side,
  ICU/cathlab/education/formulary alerting shells, voice-transcription helper,
  wearable bridges (see R-006).

"AI-first" as a brochure line is **MISLEADING** in the strict sense: the
safety-critical gates (interactions, dosing, triage, scores) are hand rules;
the LLMs are confined to drafting/summarizing behind review gates — which is
clinically the *safer* architecture, but it is not what "AI-first" implies.
Severity S1 for the claim wording (not for the engineering choice).

## 2. Drug–drug hard-stops (C-011): EXECUTED — sensitivity 0.301

Harness: `/tmp/sprintB_drug_gold.py` vs
`DrugInteractionAnalyzer.analyze_interactions` (dict-in `genericName/name`
schema), `.venv` python, 2026-11-24.

**Result: n=153, TP=37, FN=86, TN=30, FP=0 → sensitivity 0.301,
specificity 1.000.** (First pass at n=112 gave 0.387; expansion added harder
SADC-relevant pairs.) Full miss list is in the harness output; headline misses:

- Entire classes invisible: nitrates+sildenafil, linezolid+SSRI/SNRI/triptan/TCA
  (serotonin syndrome — zero coverage), QT-prolonging pairs (haloperidol,
  amiodarone, ondansetron, citalopram, quinine, moxi-, chloroquine,
  halofantrine + erythromycin), rifamycin inductions (dolutegravir,
  carbamazepine, phenytoin, contraceptives — **the SADC-critical TB/HIV set**),
  chelation (DTG+antacids), nephro/ototoxic aminoglycoside pairs,
  gemfibrozil+statin/repaglinide, carbapenem+valproate, azathioprine+allopurinol,
  methotrexate+TMP-SMX/NSAID, lithium+NSAID/diuretic, clopidogrel+PPI,
  tamoxifen+paroxetine, codeine/tramadol activation blocks, DOAC-relevant pairs.
- Name handling is `lower().strip()` only: `Coumadin`, `warfarin sodium`,
  `WARFARIN`+`IBUPROFEN`, `acetylsalicylic acid`, `cotrimoxazole`/`Bactrim`,
  `rifampicin` (vs `rifampin` in tables) all MISS. A clinician typing a brand,
  salt, or the INN spelling used across SADC gets no stop.
- Substring class inference (`any(x in drug_lower …)`) cuts both ways: zero
  false positives on look-alikes here, but e.g. `losartan`+`fluconazole`
  (CYP2C9 reduced activation — loss of effect) missed while the table knows
  CYP2C9.

What DOES work: the CYP450 substrate/inhibitor core (warfarin+fluconazole/
amiodarone/cipro, simvastatin+clarithromycin/keto/erythro, theophylline+cipro/
fluvoxamine, codeine/metoprolol+paroxetine, cyclosporine+clarithro) and the
handful of `CRITICAL_INTERACTIONS` (warfarin+aspirin major 9.5, K-sparing
hyperkalemia pairs) — all `major`/`moderate`, correctly graded.

Bypass analysis (code-read, UNVERIFIED as behavior): the analyzer returns
advisory objects; nothing in `drug_interactions.py` enforces a stop, and the
EHR order pipeline's approval gate (`approveSuggestion/rejectSuggestion`) is a
human click. **No evidence of an un-bypassable hard stop with mandatory
override reason + audit + role check was found**; the "hard-stop" wording is
unsupported at code level. Endpoint/API bypass, bulk-order, offline-then-sync
paths need a booted stack (blocker). **Verdict on C-011: BROKEN as a
"hard-stop" claim (sensitivity 0.301 on contraindicated pairs incl. TB/HIV
cornerstones; no enforcement primitive). Severity S0** — a missed
rifampicin+DTG or linezolid+SSRI pair can kill, and the badge says "hard-stop".

## 3. Dosing alerts: EXECUTED — three S0/S1-class defects

`dosing_calculator.py` + `recommend_dosing` tail, executed 2026-11-24:

1. **Creatinine unit trap (S0).** `calculate_creatinine_crcl` implements
   Cockcroft-Gault (mg/dL) with no unit guard. The EHR stores creatinine in
   **µmol/L** (`creatinine_umol_l`, `creatinineUmol`, `ckd-assessment`,
   `ckd-staging-record`, `sofa-score` entities). Passing 88.4 (µmol/L, = 1.0
   mg/dL) yields **CrCl 1.1 mL/min** (executed) instead of ~97 — i.e. a normal
   patient reads as dialysis-range. The TS boundary layers
   (`nephrology.renalDrugDosing`, `pediatrics.pediatricDosing`,
   `cdss.controller:164`, `governed.controller:182`) forward
   `serum_creatinine` **unconverted**; `cdss.service.ts:4749` passes it straight
   to `/dosing/recommend`. If any caller feeds the stored µmol/L value,
   aminoglycosides return "avoid" and renally-cleared drugs get cut 75% —
   systematic underdosing (or, reversed, overdose). Whether a live path does
   this needs a booted-stack trace (blocker, Sprint D/E). Code-read of every
   layer shows **no conversion anywhere** — `grep -rn '88.4\|0.0113'` finds no
   µmol/L→mg/dL conversion in either service.
2. **Fail-open on missing renal function (S1).** `renal_function None/≤0` →
   returns the **standard dose unchanged** with only a warning string. A caller
   that treats the response as an approved dose (rather than surfacing the
   warning) overdoses renal failure. `getDosingRecommendation`'s own error path
   correctly returns `recommended_dose: null` — the renal-unknown path should
   do the same.
3. **No plausibility caps (S1).** Weight 700 kg → 4200 mg gentamicin accepted,
   no error; `adjust_for_age` applies flat 25/50/75%/100% adult-fraction steps
   (12–18 y = full adult dose, no warning); hepatic impairment only matches
   exact strings (`severe|cirrhosis|hepatic failure`) — "moderate" or
   Child-Pugh B passes silently at full dose. Neonate (2 kg) CG 8.26 returned
   with no age-validity warning (Cockcroft-Gault unvalidated in neonates).
- Correct behavior verified: metformin eGFR<30 → contraindicated/DO-NOT-GIVE;
  gentamicin CrCl 5 → avoid; unknown drug → unchanged + no spurious warning.

## 4. 30-day mortality badge (C-012/C-020): made-up formula — S0

`mortality-risk.service.ts:14-96` (code-read + formula trace, DB layer not
executed — needs tenant DB; blocker stated):

```
score = age(≥80:25 … <50:3) + min(NEWS2×3.5,35) + min(comorb×4,16)
      + min(criticalLabs×6,12) + (any medical_records row in 7d ? 10 : 0)
      + min(severeCodeCount×3,9); band critical≥75/high≥50/moderate≥20/low
message: "30-day mortality risk score: {score}/100 … immediate review recommended"
```

- **Not a validated score.** No LACE/NEWS2-as-mortality/qSOFA/MEWS derivation,
  no training data, no AUROC/calibration/Brier anywhere in repo
  (`grep -rn 'AUROC\|c-statistic\|Brier\|calibration'` left to Sprint E, but the
  formula's hand-picked weights are self-evidently unvalidated). Labeling a
  weighted sum a "30-day mortality risk score /100" is **MISLEADING** and the
  badge wording ("immediate review recommended" at ≥75) confers false precision.
- **Missing data reads as healthy (S0).** No NEWS2 → 0; no labs → 0; a patient
  with no data scores age-only (e.g. 30 y/o → 3 = "low"). There is no
  "insufficient data" state — the exact failure mode the master prompt names.
  A deteriorating patient with no recent vitals wears a reassuring "low" badge.
- **Mislabeled inputs.** `icuStatus` counts *any* `medical_records` row in 7
  days (`:58-64`), not ICU stay; "diagnosis severity" is ICD-10 first-letter
  sniffing (`C/I/J`, :66-72).
- **CDSS `risk_scoring.py` is a different, also-unvalidated animal**
  (simplified-Framingham point sums + readmission point sums), executed for
  structure only. The two CVD implementations disagree numerically (see §3.5:
  EHR 20% vs CDSS 40% on the identical high-risk man — EHR map cap bug).

**Verdict: MISLEADING as "AI"/validated score; the missing-data→"low"
behavior is S0.** Downgrade path: show "insufficient data" below a
completeness floor and rename to "unvalidated composite — not a mortality
probability" (fix förslag, not implemented — report only).

## 5. Nightly composite scoring / nurse alerts: UNVERIFIED (code-read only)

`scheduler + alert-delivery + appointment-reminder-cron` files exist (recon);
missed/double-run, DST (Africa/Harare UTC+2, no DST — low risk), clock skew,
10k-patient runtime, dedupe, escalation-on-unacknowledged all need a live
scheduler + seeded ward roster (blocker). The mortality alert path does have a
6-hour dedupe (`mortality-risk.service.ts:99-104`, code-read).

## 6. Care-gap flags: UNVERIFIED (needs seeded cohort + independent recompute)

Engine + scheduler + `care-gap-detection` entity exist; precision/recall vs
hand-written SQL on seeded gaps+decoys is Sprint E-shaped work on a booted
stack (blocker). Note: cohort-builder spec failure in Sprint A
(`p.sex` vs `p.gender`) sits in this area — test/code drift, not validation.

## 7. AI drug substitution: PARTIAL (code-read, small surface)

`drug-substitution.service.ts:225-258`: **4-drug hardcoded map**
(amoxicillin→ampicillin, metformin→glipizide, atenolol→bisoprolol,
amlodipine→nifedipine LA). Adversarial review: metformin→glipizide crosses
classes (hypoglycemia in elderly/renal — caveat present but the swap is still
suggested); amlodipine→nifedipine LA changes PK (caveat present). Everything
else → `[]` → abstention `no_data` (safe default). The LLM layer
(`enrichWithLlm`, :75-94) can only reword rationales for the fixed candidate
set, not invent substitutes — good containment. No NTI-drug entries, no ART
backbone logic: an ART stock-out abstains rather than suggesting a
resistance-safe swap. Verdict PARTIAL: safe fallback, tiny coverage, class-hop
caveats rely on the reader. Needs execution against stock-out scenarios
(blocker: booted stack).

## 8. LLM safety battery: mixed — guards EXECUTED, model behavior UNVERIFIED

Live-model tests (hallucination/omission/injection end-to-end) were NOT run:
no booted stack, and governed calls require DB-backed use-case policies +
tenant context (`llm_provider.py:118-138`) — the precise blocker. What WAS
executed (`.venv` python, synthetic injection text, 2026-11-24):

- `privacy_guard`: `contains_phi` true on the injection sample; `redact_text`
  masks DOB/phone but **leaves the name "John Doe" in clear**; with block
  enabled (default), `assert_no_outbound_phi` RAISED (fail-closed). So the
  backstop works when enabled — but it is env-overridable
  (`CDSS_PHI_REDACTION_ENABLED=false`, `CDSS_BLOCK_OUTBOUND_PHI` default true),
  and name-redaction has a recall gap.
- Prompt inventory (code-read, exact locations in AI_REALITY_TABLE):
  grounded post-visit prompts carry do-not-invent/abstain instructions +
  `validateCitationIds` + `draft_ready→doctor_reviewed` gate (strongest design
  in repo); clinical-NLP interpolates raw note slices (2000 chars, temp 0.1);
  Whisper `options.prompt` passthrough is a second-order injection surface if
  any caller forwards user text (default fixed string is safe).
- Determinism/versioning: template versions pinned (`postvisit-*-v1/v2`,
  `sprint111_moas11_v1`…); **model weights are env-floating**
  (`OLLAMA_MODEL`, `ANTHROPIC_MODEL`, …) — same template can run different
  weights after an env change with no code diff. Reproducibility gap (S3).
- Human-in-the-loop: order pipeline, post-visit artifacts, radiology findings,
  auto-coding, inbox down-path, FL promotion all gate on review (code-read,
  needs execution to confirm the gates can't be skipped via API — Sprint D).
  **Weakest gate: discharge bundle PDFs** (`signed_by` recorded at generation +
  "valid without handwritten signature" footer) — a discharge can exist with no
  separate clinician sign-off step. S1 (legal-record integrity).
- Failure modes: LLM null → deterministic fallbacks + abstention log in the
  governed paths (code-read); offline behavior of AI features untested
  (blocker: airplane-mode device lab, Sprint D).
- "Dual AI interpretation" (C-023): plain-language imaging is score-band
  lookup tables (`pro-interpretation.service.ts`), not a second model reading
  the image — MISLEADING wording; consistency between the two outputs
  untested. DICOM heatmap producer: EHR side is register/track/review plumbing
  (`radiology_analysis_proxy`); inference, if any, is CDSS-side and was not
  executed (blocker).

## 9. "Claims honesty" rollup → `AI_REALITY_TABLE.md`

Bottom line: ~6 LLM paths (all governed, all behind review/abstention), ~3
fitted-ML artifacts, ~25 rule engines wearing `ai-` names, and a stub tail.
The honest brochure line would be "rules-based CDS with governed LLM drafting
behind clinician review" — not "AI-first".
