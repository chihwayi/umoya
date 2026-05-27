# MediCore — "AI First, Human Last" Sprint Series
## Sprint Index S166–S185

**Goal:** Close all wiring gaps identified in the May 2026 system audit and add intelligent AI layers across every clinical touchpoint. Upon completion of S185, every patient card shows risk, every encounter is AI-briefed, every alert is delivered, and every document can be AI-generated.

**Reviewer:** Claude (Sonnet 4.6). Each sprint must pass the REVIEWER_CHECKLIST.md before being marked DONE.

---

## Phase 1 — Fix the 7 Broken Wires (S166–S172)

These are **blocking** — AI generates output but nothing consumes it. Do these first.

| Sprint | Title | Key Wire Fixed | Effort |
|--------|-------|----------------|--------|
| [S166](./S166_alert_delivery_wiring.md) | Clinical Alert Delivery Wiring | OI + NEWS2 alerts → push notifications delivered to on-call staff | M |
| [S167](./S167_postvisit_escalation_routing.md) | Post-Visit Escalation Routing | Escalation classifier → nurse task + push alert | M |
| [S168](./S168_ai_order_creation_pipeline.md) | AI Order Creation Pipeline | Copilot suggestedOrders → OrderService (pending approval) | L |
| [S169](./S169_telemedicine_postcall_bridge.md) | Telemedicine Post-Call AI Bridge | Call end → post-visit AI pipeline auto-trigger | M |
| [S170](./S170_radiology_ai_review.md) | Radiology AI Review Controller | CDSS radiologyAnalysis → report UI | M |
| [S171](./S171_cdss_abstention_transparency.md) | CDSS Abstention Transparency | AI abstention → visible "AI Unavailable" badge in UI | S |
| [S172](./S172_education_personalization.md) | Education Personalization Engine | Diagnoses → personalised course list | M |

## Phase 2 — AI Intelligence Amplification (S173–S180)

Proactive AI that acts before a human asks.

| Sprint | Title | New Capability | Effort |
|--------|-------|----------------|--------|
| [S173](./S173_proactive_risk_alerts.md) | Proactive Patient Risk Alert Engine | Daily risk scoring + proactive push to nurses | L |
| [S174](./S174_ai_lab_interpretation.md) | AI Lab Interpretation Narratives | AI narrative on every lab result (patient + clinician view) | M |
| [S175](./S175_intelligent_appointment_ai.md) | Intelligent Appointment AI | No-show prediction + pre-appointment AI brief | M |
| [S176](./S176_ambient_voice_mobile.md) | Ambient Voice AI for Mobile | Voice → structured clinical data on mobile | L |
| [S177](./S177_ai_communication_hub.md) | AI Patient Communication Hub | Smart reply suggestions + auto-translation | M |
| [S178](./S178_predictive_adherence.md) | Predictive Medication Adherence Engine | Daily adherence risk + proactive SMS nudge | M |
| [S179](./S179_clinical_timeline_ai.md) | AI Clinical Timeline & Pattern Detection | Longitudinal AI narrative + pattern detection | L |
| [S180](./S180_mortality_risk_score.md) | AI Mortality Risk Score on Patient Cards | Composite risk badge on every patient card | M |

## Phase 3 — System-Wide AI-First UX (S181–S185)

Makes the system *feel* AI-first on every screen.

| Sprint | Title | New Capability | Effort |
|--------|-------|----------------|--------|
| [S181](./S181_ai_clinical_summary_panel.md) | AI Clinical Summary Panel | Auto-generated 5-sentence summary on every patient load | M |
| [S182](./S182_treatment_gap_engine.md) | AI Treatment Gap & Care Opportunity Engine | Detected care gaps with AI-recommended actions | M |
| [S183](./S183_ai_generated_documents.md) | AI-Generated Clinical Documents | One-click referral letters, discharge summaries, pre-auth | L |
| [S184](./S184_drug_substitution_engine.md) | AI Drug Substitution Engine | Out-of-stock → AI equivalent suggestion with confidence | S |
| [S185](./S185_ai_followup_scheduler.md) | AI Follow-up Scheduler & Care Continuity | Post-encounter AI suggests optimal follow-up timing + modality | M |

---

## Development Rules (apply to every sprint)

1. **Every new DB table** → add provisioning bundle to `services/tenant-service/src/services/database-provisioning.service.ts` with `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
2. **Every new controller** → register in `services/ehr-service/src/ehr.module.ts` in `controllers: []` and `providers: []`.
3. **Every new service** → register in `providers: []` in `ehr.module.ts`.
4. **DB queries** → `db.query(sql, params)` returns plain array. Single row: `rows[0] ?? null`.
5. **Patient portal controllers** → `@UseGuards(PatientJwtAuthGuard)`. Patient ID at `req.patientId`.
6. **Staff controllers** → `@UseGuards(JwtAuthGuard)`. Tenant DB at `req.tenantDb`.
7. **Mobile** → use existing `api` client from `mobile/src/services/api.ts`. Add i18n keys to all 8 locale files: `en, sn, nd, pt, fr, sw, zu, af`.
8. **No Bull queue** in ehr-service. Use cron (`@nestjs/schedule`) or direct call.
9. **AlertDeliveryService.broadcastCriticalAlert(subdomain, AlertPayload)** is the canonical alert delivery method.
10. **OrderService.createOrder(data: CreateOrderDto, doctorId, tenantId)** with `status: OrderStatus.PENDING` for AI-suggested orders.
11. `AlertPayload` = `{ alertType, sourceEntityId, patientId, severity, message, payload? }`.

---

## Completion Order

Complete sprints in this order — later sprints depend on earlier ones:

```
S166 → S167 → S168 → S169 → S170 → S171 → S172
              ↓               ↓
            S173 → S174 → S175 → S178 → S180
                    ↓
                  S179 → S181 → S182 → S183 → S184 → S185
                          ↓
                        S176 → S177
```

---

## Reviewer Sign-Off

Each sprint doc ends with a **Reviewer Checklist** that I (Claude) will verify line by line. A sprint is only DONE when:
- All DB tables have provisioning bundles
- `tsc --noEmit` passes
- `eslint` passes
- All test specs pass
- Manual walkthrough screenshot or log provided
- Mobile build passes (`npx expo export --platform all`)
