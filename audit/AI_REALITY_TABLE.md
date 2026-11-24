# AI Reality Table (Sprint B, §3.2.9)

Full 39-row inventory with file paths, providers, prompts, and gates fed this
table (recon working papers, read-only). "Executed" = ran in Sprint B with
synthetic input; otherwise code-read (stated).

| # | Feature | Class | Validation / evidence | Guardrails | Failure behavior |
|---|---|---|---|---|---|
| 0 | Central clinical LLM gateway | **LLM** | Dispatcher; no training. Code-read | Prompt-hash audit; per-caller gates | Returns null → caller fallback |
| 0b | CDSS LLM gateway | **LLM** | Multi-vendor + allowlists. Code-read; redaction **executed** | Use-case policies, redaction, egress allowlist (env-overridable) | Raises → rule fallback |
| 1 | Ambient orchestration | **Stub** | Proxy to CDSS transcription. Code-read | Retry queue (3×, then drop+warn); provider accept/dismiss | Drop with warn |
| 2 | Whisper STT | **Real ML** | Neural transcription (cloud or local). Code-read; no test audio run | Fixed medical prompt; local-Whisper env | Throws without key; normalizeLanguage→en |
| 3 | Radiology AI pipeline | **Stub** | `radiology_analysis_proxy`; no model in EHR. Code-read | Radiologist review flow | Fire-and-forget, status stuck `pending` |
| 4 | Plain-language imaging | **Rule-based** | Score-band tables. Code-read | None (lookup) | n/a |
| 5 | Registration phonetic match | **Rule-based** | pg_trgm+SOUNDEX SQL. Code-read | Suggestions only | `[]` without pg_trgm |
| 7–8 | Appointment scoring/briefs | **Rule-based** | Hand arithmetic + SQL assembly. Code-read | Score only | n/a |
| 9 | Grounded generation (referral/note/polish/answers/escalation) | **LLM** | Governed prompts + citation validation. Code-read (live calls NOT run — blocker: DB-backed use-case policy + tenant ctx) | Abstain-on-thin-context, `validateCitationIds`, `draft_ready→doctor_reviewed`, patient answers from approved content only | Deterministic fallback + abstention log |
| 10 | Discharge bundle | **Rule-based** | Template assembly. Code-read | **WEAK: signed_at-generation + no-hand-signature footer (S1)** | n/a |
| 11–12 | Clinical summary / pre-auth | **LLM w/ rules fallback / Rule-based** | Inline prompts; state machine. Code-read | Rules always computed; PA terminal states | LLM fail → rules |
| 13 | Lab narratives | **Rule-based** | Reference-range/trend engine (CDSS). Code-read | Abstention default on CDSS fail; critical alerts | "Interpretation pending" message |
| 14 | PRO score tables | **Rule-based** | Static lookups. Code-read | None | n/a |
| 15 | Demand forecasting | **Rule-based** | Velocity arithmetic. Code-read | Human acknowledge | Skip on zero velocity |
| 16 | Deterioration/glucose forecast | **Real ML (CDSS) + Rule-based (EHR)** | sklearn/statsmodels; MEWS/LACE+ labels are honest math. Code-read | Advisory; ≥3-reading floor | No lookahead on thin data |
| 17–18 | Federated learning / model registry | **Real ML** | Logistic/TF-IDF snapshots, AUC gates, promotion review. Code-read | `ModelPromotionReview`, shadow eval, fairness | Blocked promotion + reason |
| 19–22 | Triage/ESI, sepsis, NEWS2, mortality, risk stratification | **Rule-based** | Published-score arithmetic + hand weights. **Mortality + Framingham executed** | Advisory scores; triage mismatch rationale | n/a |
| 23 | Encounter coding | **Real ML + LLM + Rule-based (tiered)** | TF-IDF → LLM → keyword. Code-read | `pending` + reviewer | Falls down tiers |
| 24 | Encounter copilot/orders | **Stub** | Orchestration, `*_proxy` ids. Code-read | approve/reject + audit wrap | n/a |
| 25–26 | Clinical NLP / allergy NLP | **LLM w/ fallback / Rule-based** | JSON-schema prompt + dictionaries. Code-read | ruleBasedFallback; miss→skip | Parse-fail → fallback |
| 27 | Claims AI / PDMP | **Stub** | Proxy + `'pharmacy_pdmp_check_proxy'` literal. Code-read | Advisory | n/a |
| 28 | Patient AI chat/symptoms | **LLM + Rule-based** | CDSS chat + `symptom_check_rules_v1`. Code-read | Canned escalation; no per-message sign-off | Static safe replies |
| 31 | Diagnostic assistant | **Real ML + LLM + Rule-based** | MedBERT/ClinicalBERT/fusion/RAG/rules merge. Code-read | Redaction, citations, availability gates | Rules-only fallback |
| 32–34 | Framingham/readmission, dosing, interactions | **Rule-based** | **ALL EXECUTED**: interaction sens 0.301 (S0); dosing unit trap (S0), fail-open (S1), no caps (S1); simplified scores, unvalidated (S0 mortality) | Warnings strings (caller-dependent) | See 02_ai_cds §§2–4 |
| 35 | Lab interpreter/trends | **Rule-based + Real ML (forecast)** | Range checks + regression. Code-read | Critical alerts; abstention | Pending message |
| 36 | Vision/voice/domain endpoints | **Real ML when loaded, else Stub** | Download-gated loader. Code-read | Graceful degradation | Lightweight fallback |
| subst | Drug substitution | **Rule-based (+LLM rationale reword)** | 4-drug map; LLM can't add candidates. Code-read | Abstain `no_data`; allergy NLP enrich | Abstention log |

**One-line honesty rollup:** the product is a rules-based CDS with governed LLM
drafting behind clinician review — "AI-first" overstates it (S1 wording).
The two executed S0s (interaction sensitivity 0.301 incl. TB/HIV cornerstones;
missing-data→"low" mortality badge) and the executed dosing unit trap are the
report's load-bearing findings.
