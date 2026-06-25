# Sprint 233 — CathLab AI: STEMI ECG Interpretation, Contrast Risk & DAPT

**Module key:** `cath_lab` (extends S232)
**Bundle ID:** `sprint233_cathlab_ai`
**Version:** `2026.06.23.0`
**Depends on:** `sprint232_cathlab_core`
**Followed by:** S235 (ICU AI & Quality)

---

## Sprint Goal

Extend the CathLab module with AI-powered clinical decision support:
1. **STEMI ECG interpretation** — ST elevation rule detection by lead pattern (anterior, inferior, lateral), Sgarbossa criteria for LBBB
2. **Mehran contrast nephropathy risk score** — 8-factor score predicting post-contrast AKI
3. **DAPT (Dual Antiplatelet Therapy) duration recommendation** — DAPT Score calculation, P2Y12 agent choice with drug interaction check
4. **SYNTAX Score complexity store** — lesion complexity documentation and revascularisation pathway recommendation
5. **Procedure quality dashboard** — radiation dose, contrast volume, fluoroscopy time trending

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint233_cathlab_ai',
  label: 'Sprint 233 — CathLab AI: ECG STEMI alerts, contrast risk, DAPT scoring, SYNTAX complexity',
  version: '2026.06.23.0',
  description: 'cathlab_ecg_interpretations, cathlab_dapt_recommendations, cathlab_syntax_scores, cathlab_quality_metrics',
  statements: () => [
    // ── ECG Interpretation Log ───────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS cathlab_ecg_interpretations (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id         UUID NOT NULL REFERENCES cathlab_cases(id) ON DELETE CASCADE,
      patient_id      UUID NOT NULL REFERENCES patients(id),
      ecg_timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      leads_affected  JSONB NOT NULL DEFAULT '[]'::jsonb,
      max_st_elev_mm  NUMERIC(4,2),
      territory       TEXT CHECK (territory IN ('anterior','inferior','lateral','posterior','rvmi','diffuse','none')),
      sgarbossa_score SMALLINT,
      ai_impression   TEXT,
      ai_confidence   NUMERIC(4,2),
      clinician_confirmed BOOLEAN,
      reviewed_by     UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ecg_case ON cathlab_ecg_interpretations(case_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ecg_patient ON cathlab_ecg_interpretations(patient_id)`,

    // ── Mehran Score (Contrast Nephropathy Risk) ─────────────────────────
    `CREATE TABLE IF NOT EXISTS cathlab_contrast_risk (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id         UUID NOT NULL REFERENCES cathlab_cases(id) ON DELETE CASCADE,
      patient_id      UUID NOT NULL REFERENCES patients(id),
      hypotension     BOOLEAN NOT NULL DEFAULT FALSE,
      iabp_use        BOOLEAN NOT NULL DEFAULT FALSE,
      chf_present     BOOLEAN NOT NULL DEFAULT FALSE,
      age_gt_75       BOOLEAN NOT NULL DEFAULT FALSE,
      anaemia         BOOLEAN NOT NULL DEFAULT FALSE,
      diabetes        BOOLEAN NOT NULL DEFAULT FALSE,
      contrast_volume_ml  NUMERIC(6,1),
      creatinine_umol_l   NUMERIC(7,2),
      egfr_ml_min         NUMERIC(6,2),
      mehran_score    SMALLINT GENERATED ALWAYS AS (
                        (CASE WHEN hypotension THEN 5 ELSE 0 END)
                        + (CASE WHEN iabp_use THEN 5 ELSE 0 END)
                        + (CASE WHEN chf_present THEN 5 ELSE 0 END)
                        + (CASE WHEN age_gt_75 THEN 4 ELSE 0 END)
                        + (CASE WHEN anaemia THEN 3 ELSE 0 END)
                        + (CASE WHEN diabetes THEN 3 ELSE 0 END)
                      ) STORED,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_contrast_risk_case ON cathlab_contrast_risk(case_id)`,

    // ── DAPT Recommendations ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS cathlab_dapt_recommendations (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id           UUID NOT NULL REFERENCES cathlab_cases(id) ON DELETE CASCADE,
      patient_id        UUID NOT NULL REFERENCES patients(id),
      stent_type        TEXT NOT NULL CHECK (stent_type IN ('des','bms','balloon_only','cabg')),
      indication        TEXT NOT NULL CHECK (indication IN ('acs','stable_cad')),
      dapt_score        SMALLINT,
      bleeding_risk_high BOOLEAN NOT NULL DEFAULT FALSE,
      recommended_agent TEXT,
      recommended_duration_months SMALLINT,
      interaction_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_by        UUID REFERENCES users(id),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_dapt_case ON cathlab_dapt_recommendations(case_id)`,

    // ── SYNTAX Scores ─────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS cathlab_syntax_scores (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id         UUID NOT NULL REFERENCES cathlab_cases(id) ON DELETE CASCADE,
      syntax_score    NUMERIC(5,1) NOT NULL,
      syntax_ii_score NUMERIC(5,1),
      complexity_tier TEXT GENERATED ALWAYS AS (
                        CASE WHEN syntax_score <= 22 THEN 'low'
                             WHEN syntax_score <= 32 THEN 'intermediate'
                             ELSE 'high' END
                      ) STORED,
      recommended_strategy TEXT GENERATED ALWAYS AS (
                        CASE WHEN syntax_score <= 22 THEN 'pci_preferred'
                             WHEN syntax_score <= 32 THEN 'heart_team_discussion'
                             ELSE 'cabg_preferred' END
                      ) STORED,
      assessed_by     UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_syntax_case ON cathlab_syntax_scores(case_id)`,

    // ── Quality Metrics View ─────────────────────────────────────────────
    `CREATE OR REPLACE VIEW cathlab_quality_metrics AS
      SELECT
        DATE_TRUNC('month', cc.procedure_date)::date AS month,
        COUNT(*)                         AS total_cases,
        AVG(cl.contrast_volume_ml)       AS avg_contrast_ml,
        COUNT(cs.id)                     AS syntax_documented,
        AVG(cs.syntax_score)             AS avg_syntax_score,
        COUNT(CASE WHEN cs.complexity_tier='high' THEN 1 END) AS high_complexity_cases
      FROM cathlab_cases cc
      LEFT JOIN cathlab_contrast_risk cl ON cl.case_id = cc.id
      LEFT JOIN cathlab_syntax_scores cs ON cs.case_id = cc.id
      GROUP BY DATE_TRUNC('month', cc.procedure_date)
      ORDER BY month DESC`,
  ],
},
```

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/cathlab-ai.controller.ts`

```typescript
import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CathLabAiService } from '../services/cathlab-ai.service';

@UseGuards(JwtAuthGuard)
@Controller('cathlab/ai')
export class CathLabAiController {
  constructor(private readonly svc: CathLabAiService) {}

  @Post('ecg-interpretation')
  recordEcgInterpretation(
    @Req() req: any,
    @Body() body: {
      caseId: string; patientId: string; leadsAffected: string[];
      maxStElevMm: number; territory?: string; sgarbossaScore?: number;
      aiImpression?: string; aiConfidence?: number;
    },
  ) {
    return this.svc.recordEcgInterpretation(req.tenantDb, req.user.id, body);
  }

  @Post('contrast-risk')
  computeContrastRisk(
    @Req() req: any,
    @Body() body: {
      caseId: string; patientId: string;
      hypotension: boolean; iabpUse: boolean; chfPresent: boolean; ageGt75: boolean;
      anaemia: boolean; diabetes: boolean;
      contrastVolumeMl?: number; creatinineUmolL?: number; egfrMlMin?: number;
    },
  ) {
    return this.svc.computeContrastRisk(req.tenantDb, body);
  }

  @Post('dapt-recommendation')
  createDaptRecommendation(
    @Req() req: any,
    @Body() body: {
      caseId: string; patientId: string; stentType: string; indication: string;
      daptScore?: number; bleedingRiskHigh?: boolean;
      currentMedications?: string[];
    },
  ) {
    return this.svc.createDaptRecommendation(req.tenantDb, req.user.id, body);
  }

  @Post('syntax-score')
  recordSyntaxScore(
    @Req() req: any,
    @Body() body: { caseId: string; syntaxScore: number; syntaxIiScore?: number },
  ) {
    return this.svc.recordSyntaxScore(req.tenantDb, req.user.id, body);
  }

  @Get('quality-metrics')
  getQualityMetrics(@Req() req: any) {
    return this.svc.getQualityMetrics(req.tenantDb);
  }

  @Get('case/:caseId/summary')
  getCaseSummary(@Req() req: any, @Param('caseId') caseId: string) {
    return this.svc.getCaseAiSummary(req.tenantDb, caseId);
  }
}
```

**Create file:** `services/ehr-service/src/services/cathlab-ai.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// DAPT Score components — positive score items favor longer DAPT, negative favor shorter
const DAPT_FACTORS: Record<string, number> = {
  age_lt_65: 2,
  age_65_75: -1,
  age_gt_75: -2,
  current_smoker: 1,
  diabetes: 1,
  prior_pci: 1,
  prior_mi: 1,
  paclitaxel_stent: 1,
  stent_diameter_lt3mm: 1,
  chf_lvef_lt30: 2,
  saphenous_vein_graft: 2,
};

// P2Y12 agent recommendations by indication and bleeding risk
function selectP2Y12Agent(indication: string, bleedingRisk: boolean, stentType: string): string {
  if (stentType === 'cabg') return 'aspirin_only';
  if (indication === 'acs' && !bleedingRisk) return 'ticagrelor_90mg_bd';
  if (indication === 'acs' && bleedingRisk) return 'clopidogrel_75mg_od';
  return 'clopidogrel_75mg_od';
}

function selectDuration(daptScore: number, bleedingRisk: boolean, stentType: string): number {
  if (stentType === 'bms') return 1;
  if (bleedingRisk) return 6;
  if (daptScore >= 2) return 30; // extended 30 months
  return 12;
}

@Injectable()
export class CathLabAiService {
  constructor(private readonly http: HttpService) {}

  async recordEcgInterpretation(db: any, reviewedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_ecg_interpretations (case_id, patient_id, leads_affected, max_st_elev_mm, territory, sgarbossa_score, ai_impression, ai_confidence, reviewed_by)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.caseId, body.patientId, JSON.stringify(body.leadsAffected ?? []), body.maxStElevMm ?? null, body.territory ?? null, body.sgarbossaScore ?? null, body.aiImpression ?? null, body.aiConfidence ?? null, reviewedBy],
    );
    return rows[0] ?? null;
  }

  async computeContrastRisk(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_contrast_risk (case_id, patient_id, hypotension, iabp_use, chf_present, age_gt_75, anaemia, diabetes, contrast_volume_ml, creatinine_umol_l, egfr_ml_min)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *, mehran_score`,
      [body.caseId, body.patientId, body.hypotension, body.iabpUse, body.chfPresent, body.ageGt75, body.anaemia, body.diabetes, body.contrastVolumeMl ?? null, body.creatinineUmolL ?? null, body.egfrMlMin ?? null],
    );
    const result = rows[0];
    const score = result?.mehran_score ?? 0;

    let risk: string;
    let advice: string;
    if (score < 6)       { risk = 'low';      advice = 'Standard hydration. Routine post-procedure creatinine at 48h.'; }
    else if (score < 11) { risk = 'moderate'; advice = 'IV normal saline 1 ml/kg/h for 12h pre/post. Consider iso-osmolar contrast. Avoid NSAIDs.'; }
    else if (score < 16) { risk = 'high';     advice = 'Aggressive IV hydration. Minimum contrast volume. N-acetylcysteine 600 mg BD ×4 doses. Nephrology alert.'; }
    else                 { risk = 'very_high'; advice = 'Risk of dialysis >10%. Pre-procedure nephrology consult mandatory. Consider deferring if non-emergent.'; }

    return { ...result, risk_level: risk, recommendation: advice };
  }

  async createDaptRecommendation(db: any, createdBy: string, body: any): Promise<any> {
    const daptScore = body.daptScore ?? 0;
    const agent = selectP2Y12Agent(body.indication, body.bleedingRiskHigh ?? false, body.stentType);
    const duration = selectDuration(daptScore, body.bleedingRiskHigh ?? false, body.stentType);

    // Check for drug interactions via CDSS
    let interactionFlags: any[] = [];
    if (body.currentMedications?.length) {
      try {
        const resp = await firstValueFrom(
          this.http.post('http://localhost:8000/cathlab/cdss/drug-interaction', {
            p2y12_agent: agent, current_medications: body.currentMedications,
          }),
        );
        interactionFlags = resp.data?.flags ?? [];
      } catch {}
    }

    const rows = await db.query(
      `INSERT INTO cathlab_dapt_recommendations (case_id, patient_id, stent_type, indication, dapt_score, bleeding_risk_high, recommended_agent, recommended_duration_months, interaction_flags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) RETURNING *`,
      [body.caseId, body.patientId, body.stentType, body.indication, daptScore, body.bleedingRiskHigh ?? false, agent, duration, JSON.stringify(interactionFlags), createdBy],
    );
    return rows[0] ?? null;
  }

  async recordSyntaxScore(db: any, assessedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cathlab_syntax_scores (case_id, syntax_score, syntax_ii_score, assessed_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING
       RETURNING *, complexity_tier, recommended_strategy`,
      [body.caseId, body.syntaxScore, body.syntaxIiScore ?? null, assessedBy],
    );
    return rows[0] ?? null;
  }

  async getQualityMetrics(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM cathlab_quality_metrics LIMIT 24`);
  }

  async getCaseAiSummary(db: any, caseId: string): Promise<any> {
    const [ecg, risk, dapt, syntax] = await Promise.all([
      db.query(`SELECT * FROM cathlab_ecg_interpretations WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`, [caseId]),
      db.query(`SELECT *, mehran_score FROM cathlab_contrast_risk WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`, [caseId]),
      db.query(`SELECT * FROM cathlab_dapt_recommendations WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`, [caseId]),
      db.query(`SELECT *, complexity_tier, recommended_strategy FROM cathlab_syntax_scores WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1`, [caseId]),
    ]);
    return {
      ecg: ecg[0] ?? null,
      contrast_risk: risk[0] ?? null,
      dapt: dapt[0] ?? null,
      syntax: syntax[0] ?? null,
    };
  }
}
```

---

## Cornerstone 3: Frontend Web UI

**Create file:** `ehr-frontend/src/pages/CathLabAiPanel.tsx`

Key UI elements:
- **ECG Territory Banner** — dynamic colour: anterior = coral `#E8614D`, inferior = amber `#F0954A`, all clear = teal `#0AA98A`
- **Mehran Risk Donut** — 4-tier ring (low/moderate/high/very_high) with recommendation text below
- **SYNTAX Score Card** — score number in large font, `complexity_tier` tag (green/amber/coral), strategy recommendation in italic
- **DAPT Recommendation Card** — agent name, duration in months, any interaction flags listed in coral

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/CathLabAiScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { AlertTriangle, Activity, Zap, Shield } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

const TERRITORY_COLOR: Record<string, string> = {
  anterior:  C.coral,
  inferior:  C.amber,
  lateral:   C.amber,
  posterior: C.amber,
  rvmi:      C.coral,
  diffuse:   C.red,
  none:      C.teal,
};

const RISK_COLOR: Record<string, string> = {
  low: C.green, moderate: C.amber, high: C.coral, very_high: C.red,
};

export default function CathLabAiScreen({ route }: { route: any }) {
  const { caseId } = route.params;
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/cathlab/ai/case/${caseId}/summary`)
      .then((r: any) => setSummary(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;
  if (!summary) return <View style={s.center}><Text style={s.empty}>No AI data for this case.</Text></View>;

  const { ecg, contrast_risk, dapt, syntax } = summary;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.heading}>CathLab AI Summary</Text>

      {/* ECG Interpretation */}
      {ecg && (
        <View style={[s.card, { borderLeftColor: TERRITORY_COLOR[ecg.territory ?? 'none'], borderLeftWidth: 4 }]}>
          <View style={s.row}><Activity size={16} color={TERRITORY_COLOR[ecg.territory ?? 'none']} /><Text style={s.cardTitle}> ECG Interpretation</Text></View>
          <Text style={s.value}>{ecg.territory?.toUpperCase() ?? 'Normal'}</Text>
          <Text style={s.sub}>Max ST elevation: {ecg.max_st_elev_mm ?? '—'} mm</Text>
          {ecg.ai_impression && <Text style={s.impression}>{ecg.ai_impression}</Text>}
        </View>
      )}

      {/* Contrast Risk */}
      {contrast_risk && (
        <View style={[s.card, { borderLeftColor: RISK_COLOR[contrast_risk.risk_level] ?? C.textMuted, borderLeftWidth: 4 }]}>
          <View style={s.row}><Shield size={16} color={RISK_COLOR[contrast_risk.risk_level]} /><Text style={s.cardTitle}> Mehran Contrast Risk</Text></View>
          <Text style={[s.value, { color: RISK_COLOR[contrast_risk.risk_level] }]}>
            Score: {contrast_risk.mehran_score} — {contrast_risk.risk_level?.toUpperCase().replace('_', ' ')}
          </Text>
          <Text style={s.impression}>{contrast_risk.recommendation}</Text>
        </View>
      )}

      {/* SYNTAX Score */}
      {syntax && (
        <View style={s.card}>
          <View style={s.row}><Zap size={16} color={C.teal} /><Text style={s.cardTitle}> SYNTAX Score</Text></View>
          <Text style={s.bigNumber}>{syntax.syntax_score}</Text>
          <Text style={[s.badge, { color: syntax.complexity_tier === 'high' ? C.coral : syntax.complexity_tier === 'intermediate' ? C.amber : C.green }]}>
            {syntax.complexity_tier?.toUpperCase()} COMPLEXITY
          </Text>
          <Text style={s.impression}>{syntax.recommended_strategy?.replace(/_/g, ' ')}</Text>
        </View>
      )}

      {/* DAPT */}
      {dapt && (
        <View style={s.card}>
          <View style={s.row}><AlertTriangle size={16} color={C.amber} /><Text style={s.cardTitle}> DAPT Recommendation</Text></View>
          <Text style={s.value}>{dapt.recommended_agent?.replace(/_/g, ' ')}</Text>
          <Text style={s.sub}>{dapt.recommended_duration_months} months</Text>
          {dapt.interaction_flags?.length > 0 && (
            <View style={s.flagBox}>
              {dapt.interaction_flags.map((f: any, i: number) => (
                <Text key={i} style={s.flagText}>⚠ {f.message}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  empty:       { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text, marginBottom: 16 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:         { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardTitle:   { fontFamily: FONT.uiSb, fontSize: 13, color: C.textSecondary },
  value:       { fontFamily: FONT.uiSb, fontSize: 15, color: C.text },
  bigNumber:   { fontFamily: FONT.uiBd, fontSize: 36, color: C.text, marginVertical: 4 },
  badge:       { fontFamily: FONT.uiSb, fontSize: 12 },
  sub:         { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  impression:  { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted, marginTop: 6, lineHeight: 18 },
  flagBox:     { backgroundColor: C.coral + '22', borderRadius: RADIUS.sm, padding: 10, marginTop: 8 },
  flagText:    { fontFamily: FONT.ui, fontSize: 12, color: C.coral },
});
```

**Register:** `<Stack.Screen name="CathLabAi" component={CathLabAiScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
# ── CathLab AI CDSS endpoints ──────────────────────────────────────────────

@app.post("/cathlab/cdss/stemi-ecg")
async def interpret_stemi_ecg(body: dict):
    """
    Detect STEMI territory from ECG lead ST values.
    body: { leads: { I: float, II: float, III: float, aVR: float, aVF: float, aVL: float, V1..V6: float } }
    Returns territory, flag, and if Sgarbossa criteria met (for LBBB).
    """
    leads = body.get("leads", {})
    threshold = 1.0  # mm

    territory = "none"
    max_st = max((abs(v) for v in leads.values()), default=0)

    ant = [leads.get(f"V{i}", 0) for i in range(1, 5)]
    inf = [leads.get("II", 0), leads.get("III", 0), leads.get("aVF", 0)]
    lat = [leads.get("I", 0), leads.get("aVL", 0), leads.get("V5", 0), leads.get("V6", 0)]

    if any(v >= threshold for v in ant[:2]):  # V1-V2 also check V3
        territory = "anterior"
    elif all(v >= threshold for v in inf):
        territory = "inferior"
    elif any(v >= threshold for v in lat):
        territory = "lateral"
    elif leads.get("V1", 0) >= threshold and leads.get("V2", 0) >= threshold:
        territory = "posterior"

    # Sgarbossa criteria for LBBB
    sgarbossa = 0
    if leads.get("I", 0) >= 1 or leads.get("aVL", 0) >= 1:
        sgarbossa += 5
    if leads.get("V5", 0) >= 1 or leads.get("V6", 0) >= 1:
        sgarbossa += 5
    if leads.get("V1", 0) <= -1 or leads.get("V2", 0) <= -1:
        sgarbossa += 2

    stemi_equivalent = territory != "none" or sgarbossa >= 3
    return {
        "territory": territory,
        "max_st_mm": round(max_st, 2),
        "sgarbossa_score": sgarbossa,
        "stemi_equivalent": stemi_equivalent,
        "recommendation": "ACTIVATE STEMI PROTOCOL — cathlab notification NOW" if stemi_equivalent else "No acute STEMI pattern detected. Serial ECGs if clinical suspicion.",
    }

@app.post("/cathlab/cdss/drug-interaction")
async def check_dapt_interactions(body: dict):
    """
    Check for major interactions between P2Y12 agent and current medications.
    body: { p2y12_agent: str, current_medications: list[str] }
    """
    agent = body.get("p2y12_agent", "")
    meds = [m.lower() for m in body.get("current_medications", [])]
    flags = []

    # Ticagrelor interactions
    if "ticagrelor" in agent:
        if any("simvastatin" in m or "lovastatin" in m for m in meds):
            flags.append({"severity": "major", "message": "Ticagrelor + simvastatin: increased statin myopathy risk. Dose-cap simvastatin 40mg."})
        if any("ketoconazole" in m or "itraconazole" in m or "clarithromycin" in m for m in meds):
            flags.append({"severity": "contraindicated", "message": "Strong CYP3A4 inhibitor + ticagrelor: markedly elevated ticagrelor levels. Contraindicated."})
        if any("rifampicin" in m or "carbamazepine" in m or "phenytoin" in m for m in meds):
            flags.append({"severity": "major", "message": "Strong CYP3A4 inducer + ticagrelor: reduced antiplatelet effect. Consider clopidogrel."})

    # Clopidogrel interactions
    if "clopidogrel" in agent:
        if any("omeprazole" in m or "esomeprazole" in m for m in meds):
            flags.append({"severity": "moderate", "message": "Omeprazole/esomeprazole reduces clopidogrel efficacy via CYP2C19. Prefer pantoprazole if PPI needed."})
        if any("fluoxetine" in m or "fluvoxamine" in m for m in meds):
            flags.append({"severity": "moderate", "message": "CYP2C19 inhibitor may reduce clopidogrel activation. Monitor clinical response."})

    return {"flags": flags, "interaction_count": len(flags)}
```

---

## Acceptance Criteria

- [ ] `cathlab_contrast_risk.mehran_score` is a generated column summing all 8 Mehran factors
- [ ] `cathlab_syntax_scores.complexity_tier` and `recommended_strategy` are generated columns
- [ ] `POST /cathlab/ai/contrast-risk` returns `risk_level` and `recommendation` based on Mehran score
- [ ] `POST /cathlab/ai/dapt-recommendation` selects correct P2Y12 agent and calls CDSS for interactions
- [ ] `POST /cathlab/cdss/stemi-ecg` correctly identifies anterior, inferior, and lateral territories
- [ ] `POST /cathlab/cdss/drug-interaction` flags omeprazole + clopidogrel interaction
- [ ] `CathLabAiScreen.tsx` shows ECG territory colour, Mehran risk colour, and SYNTAX score
- [ ] Smoke test passes
