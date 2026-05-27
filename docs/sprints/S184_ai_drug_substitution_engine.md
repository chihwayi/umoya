# S184 — AI Drug Substitution Engine

**Phase:** 3 — Intelligence Layer  
**Effort:** S (3–4 days)  
**Depends on:** S171 (AbstentionLogService), S174 (lab context)  
**Blocks:** nothing  

---

## Problem

When a drug is out of stock or unavailable, clinicians must manually research therapeutic equivalents. This is slow, error-prone, and differs by clinician knowledge. The system has a `CdssService` and `PostVisitGroundedLlmService` that are never used for pharmacology lookups. Out-of-stock medications generate no AI-assisted substitution suggestion.

---

## Goal

When a medication is flagged out-of-stock (or a clinician requests an alternative), the system:
1. Looks up therapeutic equivalents using CDSS / LLM grounding
2. Returns a ranked list of substitutes with confidence scores and notes
3. Persists suggestions to the DB for audit
4. Exposes the suggestions in EHR and mobile
5. Logs abstentions when CDSS is unavailable

---

## Database Provisioning

Add to `getProvisioningBundles()` in  
`services/tenant-service/src/services/database-provisioning.service.ts`

```typescript
{
  id: 'drug_substitution_suggestions',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS drug_substitution_suggestions (
      id               SERIAL PRIMARY KEY,
      original_drug    TEXT        NOT NULL,
      original_dose    TEXT,
      patient_id       INTEGER,
      requested_by     INTEGER,
      suggestions      JSONB       NOT NULL DEFAULT '[]',
      selected_drug    TEXT,
      selected_at      TIMESTAMPTZ,
      selected_by      INTEGER,
      cdss_available   BOOLEAN     NOT NULL DEFAULT TRUE,
      abstention_reason TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_drug_sub_patient
       ON drug_substitution_suggestions(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_drug_sub_drug
       ON drug_substitution_suggestions(original_drug)`,
    `CREATE INDEX IF NOT EXISTS idx_drug_sub_created
       ON drug_substitution_suggestions(created_at DESC)`,
  ],
},
```

Each `suggestions` array element:
```json
{
  "drug": "Amoxicillin 500mg",
  "confidence": 0.87,
  "rationale": "Same class (aminopenicillin); bioequivalent dosing",
  "caveat": "Avoid if penicillin allergy",
  "sourceType": "cdss" | "llm" | "rule"
}
```

---

## Backend — DrugSubstitutionService

**File:** `services/ehr-service/src/services/drug-substitution.service.ts`

```typescript
import { Injectable, Optional } from '@nestjs/common';
import { CdssService } from './cdss.service';
import { PostVisitGroundedLlmService } from './post-visit-grounded-llm.service';
import { AbstentionLogService } from './abstention-log.service';
import { AlertDeliveryService } from './alert-delivery.service';

export interface SubstituteSuggestion {
  drug: string;
  confidence: number;
  rationale: string;
  caveat: string;
  sourceType: 'cdss' | 'llm' | 'rule';
}

export interface SubstitutionResult {
  id: number;
  originalDrug: string;
  suggestions: SubstituteSuggestion[];
  cdssAvailable: boolean;
}

@Injectable()
export class DrugSubstitutionService {
  constructor(
    @Optional() private readonly cdss: CdssService,
    @Optional() private readonly llm: PostVisitGroundedLlmService,
    @Optional() private readonly abstentionLog: AbstentionLogService,
    @Optional() private readonly alertDelivery: AlertDeliveryService,
  ) {}

  async getSuggestions(
    db: any,
    params: {
      originalDrug: string;
      originalDose?: string;
      patientId?: number;
      requestedBy: number;
      subdomain: string;
      diagnoses?: string[];
      allergies?: string[];
    },
  ): Promise<SubstitutionResult> {
    const {
      originalDrug, originalDose, patientId, requestedBy, subdomain,
      diagnoses = [], allergies = [],
    } = params;

    let suggestions: SubstituteSuggestion[] = [];
    let cdssAvailable = true;
    let abstentionReason: string | null = null;

    // 1. Try CDSS first
    if (this.cdss) {
      try {
        const cdssResult = await this.cdss.parseClinicalNarrative(
          `Drug substitution request: find therapeutic equivalents for ${originalDrug} ${originalDose ?? ''}. ` +
          `Patient diagnoses: ${diagnoses.join(', ') || 'unknown'}. ` +
          `Known allergies: ${allergies.join(', ') || 'none'}. ` +
          `Return JSON array of {drug, confidence, rationale, caveat}.`,
        );
        if (cdssResult?.entities?.length) {
          suggestions = cdssResult.entities.map((e: any) => ({
            drug: e.drug ?? e.text ?? e.name ?? '',
            confidence: parseFloat(e.confidence ?? '0.7'),
            rationale: e.rationale ?? 'CDSS equivalent',
            caveat: e.caveat ?? '',
            sourceType: 'cdss' as const,
          })).filter((s: SubstituteSuggestion) => s.drug);
        }
      } catch {
        cdssAvailable = false;
      }
    } else {
      cdssAvailable = false;
    }

    // 2. LLM fallback if CDSS gave nothing
    if (!suggestions.length && this.llm) {
      try {
        const context = [
          `Original medication: ${originalDrug} ${originalDose ?? ''}`,
          diagnoses.length ? `Diagnoses: ${diagnoses.join(', ')}` : '',
          allergies.length ? `Allergies: ${allergies.join(', ')}` : '',
        ].filter(Boolean).join('\n');

        const llmText = await this.llm.polishDoctorContent(
          `List 3 therapeutic substitutes for ${originalDrug}. ` +
          `Context:\n${context}\n` +
          `For each, provide: drug name with dose, confidence 0-1, rationale, caveat. ` +
          `Format as numbered list.`,
          'substitution_request',
        );

        suggestions = this.parseLlmSubstitutions(llmText ?? '');
      } catch {
        // LLM also failed — use rule-based fallback
      }
    }

    // 3. Rule-based fallback
    if (!suggestions.length) {
      suggestions = this.ruleBasedFallback(originalDrug);
      if (!suggestions.length) {
        abstentionReason = 'no_data';
        await this.abstentionLog?.log(db, 'drug_substitution', 'no_data', {
          entityId: originalDrug,
        });
      }
    }

    if (!cdssAvailable && !abstentionReason) {
      abstentionReason = 'cdss_error';
      await this.abstentionLog?.log(db, 'drug_substitution', 'cdss_error', {
        entityId: originalDrug,
      });
    }

    // 4. Persist
    const insertRes = await db.query(
      `INSERT INTO drug_substitution_suggestions
         (original_drug, original_dose, patient_id, requested_by, suggestions,
          cdss_available, abstention_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        originalDrug, originalDose ?? null, patientId ?? null, requestedBy,
        JSON.stringify(suggestions), cdssAvailable, abstentionReason,
      ],
    );

    return {
      id: insertRes[0].id,
      originalDrug,
      suggestions,
      cdssAvailable,
    };
  }

  async selectSubstitute(
    db: any,
    suggestionId: number,
    selectedDrug: string,
    selectedBy: number,
  ): Promise<void> {
    await db.query(
      `UPDATE drug_substitution_suggestions
         SET selected_drug = $1, selected_by = $2, selected_at = NOW(),
             updated_at = NOW()
       WHERE id = $3`,
      [selectedDrug, selectedBy, suggestionId],
    );
  }

  async getPatientHistory(db: any, patientId: number): Promise<any[]> {
    return db.query(
      `SELECT id, original_drug, original_dose, suggestions, selected_drug,
              selected_at, cdss_available, created_at
         FROM drug_substitution_suggestions
        WHERE patient_id = $1
        ORDER BY created_at DESC
        LIMIT 20`,
      [patientId],
    );
  }

  private parseLlmSubstitutions(text: string): SubstituteSuggestion[] {
    const results: SubstituteSuggestion[] = [];
    const lines = text.split('\n').filter(l => /^\d+\./.test(l.trim()));
    for (const line of lines.slice(0, 5)) {
      const drug = line.replace(/^\d+\.\s*/, '').split('—')[0].trim();
      if (drug.length > 3) {
        results.push({
          drug,
          confidence: 0.65,
          rationale: 'LLM-derived therapeutic equivalent',
          caveat: 'Verify with pharmacist before dispensing',
          sourceType: 'llm',
        });
      }
    }
    return results;
  }

  private ruleBasedFallback(drug: string): SubstituteSuggestion[] {
    const lower = drug.toLowerCase();
    const rules: Record<string, SubstituteSuggestion[]> = {
      amoxicillin: [{
        drug: 'Ampicillin 500mg', confidence: 0.80,
        rationale: 'Same aminopenicillin class',
        caveat: 'Avoid if penicillin allergy', sourceType: 'rule',
      }],
      metformin: [{
        drug: 'Glipizide 5mg', confidence: 0.70,
        rationale: 'Alternative first-line oral hypoglycaemic',
        caveat: 'Monitor for hypoglycaemia; avoid in renal impairment', sourceType: 'rule',
      }],
      atenolol: [{
        drug: 'Bisoprolol 5mg', confidence: 0.82,
        rationale: 'Beta-1 selective blocker equivalence',
        caveat: 'Titrate dose; avoid abrupt cessation', sourceType: 'rule',
      }],
      amlodipine: [{
        drug: 'Nifedipine LA 30mg', confidence: 0.75,
        rationale: 'Same dihydropyridine CCB class',
        caveat: 'Check heart rate and BP at initiation', sourceType: 'rule',
      }],
    };
    for (const [key, subs] of Object.entries(rules)) {
      if (lower.includes(key)) return subs;
    }
    return [];
  }
}
```

---

## Backend — DrugSubstitutionController

**File:** `services/ehr-service/src/controllers/drug-substitution.controller.ts`

```typescript
import {
  Controller, Post, Get, Patch, Body, Param, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DrugSubstitutionService } from '../services/drug-substitution.service';

@UseGuards(JwtAuthGuard)
@Controller('drug-substitution')
export class DrugSubstitutionController {
  constructor(private readonly svc: DrugSubstitutionService) {}

  @Post('suggest')
  async suggest(
    @Req() req: any,
    @Body()
    body: {
      originalDrug: string;
      originalDose?: string;
      patientId?: number;
      diagnoses?: string[];
      allergies?: string[];
    },
  ) {
    return this.svc.getSuggestions(req.tenantDb, {
      ...body,
      requestedBy: req.user.sub,
      subdomain: req.tenantSubdomain,
    });
  }

  @Patch(':id/select')
  async select(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { selectedDrug: string },
  ) {
    await this.svc.selectSubstitute(
      req.tenantDb,
      parseInt(id),
      body.selectedDrug,
      req.user.sub,
    );
    return { ok: true };
  }

  @Get('patient/:patientId/history')
  async history(@Req() req: any, @Param('patientId') patientId: string) {
    return this.svc.getPatientHistory(req.tenantDb, parseInt(patientId));
  }
}
```

---

## EHR React Component — DrugSubstitutionModal

**File:** `ehr-frontend/src/components/DrugSubstitutionModal.tsx`

```tsx
import React, { useState } from 'react';
import api from '../services/api';
import AiStatusBadge from './AiStatusBadge';

interface Suggestion {
  drug: string;
  confidence: number;
  rationale: string;
  caveat: string;
  sourceType: 'cdss' | 'llm' | 'rule';
}

interface Props {
  patientId: number;
  diagnoses: string[];
  allergies: string[];
  onClose: () => void;
  onSelected: (drug: string) => void;
}

export default function DrugSubstitutionModal({
  patientId, diagnoses, allergies, onClose, onSelected,
}: Props) {
  const [originalDrug, setOriginalDrug] = useState('');
  const [originalDose, setOriginalDose] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    id: number;
    suggestions: Suggestion[];
    cdssAvailable: boolean;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSearch() {
    if (!originalDrug.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await api.post('/drug-substitution/suggest', {
        originalDrug: originalDrug.trim(),
        originalDose: originalDose.trim() || undefined,
        patientId,
        diagnoses,
        allergies,
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!result || !selected) return;
    await api.patch(`/drug-substitution/${result.id}/select`, {
      selectedDrug: selected,
    });
    setConfirmed(true);
    onSelected(selected);
  }

  function confidenceColor(c: number) {
    if (c >= 0.8) return '#16a34a';
    if (c >= 0.6) return '#d97706';
    return '#dc2626';
  }

  function sourceLabel(s: string) {
    return { cdss: 'CDSS', llm: 'AI', rule: 'Rules' }[s] ?? s;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 560, maxWidth: '95vw',
        padding: 28, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            AI Drug Substitution
          </h3>
          <AiStatusBadge status={loading ? 'loading' : result?.cdssAvailable === false ? 'unavailable' : 'active'} />
        </div>

        {/* Search form */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            placeholder="Original drug name"
            value={originalDrug}
            onChange={e => setOriginalDrug(e.target.value)}
            style={{
              flex: 2, padding: '8px 12px', border: '1px solid #d1d5db',
              borderRadius: 8, fontSize: 14,
            }}
          />
          <input
            placeholder="Dose (optional)"
            value={originalDose}
            onChange={e => setOriginalDose(e.target.value)}
            style={{
              flex: 1, padding: '8px 12px', border: '1px solid #d1d5db',
              borderRadius: 8, fontSize: 14,
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading || !originalDrug.trim()}
            style={{
              padding: '8px 16px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
            }}
          >
            {loading ? 'Searching…' : 'Find Substitutes'}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div>
            {result.suggestions.length === 0 ? (
              <p style={{ color: '#6b7280', fontStyle: 'italic', fontSize: 14 }}>
                No substitutes found. Please consult your pharmacist.
              </p>
            ) : (
              result.suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => setSelected(s.drug)}
                  style={{
                    border: `2px solid ${selected === s.drug ? '#2563eb' : '#e5e7eb'}`,
                    borderRadius: 8, padding: '12px 14px', marginBottom: 8,
                    cursor: 'pointer', background: selected === s.drug ? '#eff6ff' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{s.drug}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{
                        fontSize: 11, background: '#f3f4f6', padding: '2px 7px',
                        borderRadius: 10, color: '#374151',
                      }}>
                        {sourceLabel(s.sourceType)}
                      </span>
                      <span style={{
                        fontWeight: 700, fontSize: 13,
                        color: confidenceColor(s.confidence),
                      }}>
                        {Math.round(s.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#374151' }}>
                    {s.rationale}
                  </p>
                  {s.caveat && (
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#b45309' }}>
                      ⚠ {s.caveat}
                    </p>
                  )}
                </div>
              ))
            )}

            {result.suggestions.length > 0 && !confirmed && (
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  onClick={handleConfirm}
                  disabled={!selected}
                  style={{
                    flex: 1, padding: '10px 0', background: selected ? '#16a34a' : '#9ca3af',
                    color: '#fff', border: 'none', borderRadius: 8,
                    cursor: selected ? 'pointer' : 'default', fontWeight: 700,
                  }}
                >
                  Confirm Substitution
                </button>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '10px 0', background: '#f3f4f6',
                    border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {confirmed && (
              <div style={{
                marginTop: 14, padding: '10px 14px', background: '#f0fdf4',
                borderRadius: 8, border: '1px solid #bbf7d0',
              }}>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>
                  ✓ Substitution recorded: {selected}
                </span>
              </div>
            )}
          </div>
        )}

        {!result && !loading && (
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <button onClick={onClose} style={{
              padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db',
              borderRadius: 8, cursor: 'pointer',
            }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Mobile Component — DrugSubstitutionSheet

**File:** `mobile/src/components/DrugSubstitutionSheet.tsx`

```tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { C, FONT, RADIUS, SHADOW, SPACING } from '../design-tokens';
import AiStatusChip from './AiStatusChip';
import api from '../services/api';

interface Suggestion {
  drug: string;
  confidence: number;
  rationale: string;
  caveat: string;
  sourceType: string;
}

interface Props {
  patientId: number;
  diagnoses: string[];
  allergies: string[];
  onClose: () => void;
  onSelected: (drug: string) => void;
}

export default function DrugSubstitutionSheet({
  patientId, diagnoses, allergies, onClose, onSelected,
}: Props) {
  const [drug, setDrug] = useState('');
  const [dose, setDose] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    id: number;
    suggestions: Suggestion[];
    cdssAvailable: boolean;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  async function search() {
    if (!drug.trim()) return;
    setLoading(true);
    try {
      const data = await api.post('/drug-substitution/suggest', {
        originalDrug: drug.trim(),
        originalDose: dose.trim() || undefined,
        patientId,
        diagnoses,
        allergies,
      });
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!result || !selected) return;
    await api.patch(`/drug-substitution/${result.id}/select`, { selectedDrug: selected });
    onSelected(selected);
  }

  function confColor(c: number) {
    if (c >= 0.8) return C.green;
    if (c >= 0.6) return C.amber;
    return C.red;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Drug Substitution</Text>
          <AiStatusChip
            status={loading ? 'loading' : result?.cdssAvailable === false ? 'unavailable' : 'active'}
          />
        </View>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="Drug name"
            value={drug}
            onChangeText={setDrug}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Dose"
            value={dose}
            onChangeText={setDose}
          />
        </View>

        <TouchableOpacity
          style={[styles.searchBtn, (!drug.trim() || loading) && styles.disabled]}
          onPress={search}
          disabled={!drug.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.searchBtnText}>Find Substitutes</Text>
          )}
        </TouchableOpacity>

        {result && (
          <ScrollView style={{ maxHeight: 280, marginTop: SPACING.md }}>
            {result.suggestions.length === 0 ? (
              <Text style={styles.empty}>
                No substitutes found. Consult pharmacist.
              </Text>
            ) : (
              result.suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelected(s.drug)}
                  style={[
                    styles.card,
                    selected === s.drug && styles.cardSelected,
                  ]}
                >
                  <View style={styles.cardRow}>
                    <Text style={styles.drugName}>{s.drug}</Text>
                    <Text style={[styles.conf, { color: confColor(s.confidence) }]}>
                      {Math.round(s.confidence * 100)}%
                    </Text>
                  </View>
                  <Text style={styles.rationale}>{s.rationale}</Text>
                  {s.caveat ? (
                    <Text style={styles.caveat}>⚠ {s.caveat}</Text>
                  ) : null}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}

        {result && result.suggestions.length > 0 && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.confirmBtn, !selected && styles.disabled]}
              onPress={confirm}
              disabled={!selected}
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {!result && !loading && (
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Close</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.bg, borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg, padding: SPACING.lg,
    ...SHADOW.md,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACING.md,
  },
  title: { fontFamily: FONT.uiBd, fontSize: 17, color: C.text },
  row: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm,
    padding: SPACING.sm, fontSize: 14, color: C.text,
  },
  searchBtn: {
    backgroundColor: C.blue, borderRadius: RADIUS.sm,
    padding: SPACING.sm, alignItems: 'center',
  },
  searchBtnText: { fontFamily: FONT.uiBd, color: '#fff', fontSize: 15 },
  disabled: { backgroundColor: C.muted },
  card: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: RADIUS.sm,
    padding: SPACING.sm, marginBottom: SPACING.sm,
  },
  cardSelected: { borderColor: C.blue, backgroundColor: '#eff6ff' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drugName: { fontFamily: FONT.uiBd, fontSize: 14, color: C.text, flex: 1 },
  conf: { fontFamily: FONT.uiBd, fontSize: 13 },
  rationale: { fontSize: 12, color: C.subtext, marginTop: 2 },
  caveat: { fontSize: 11, color: C.amber, marginTop: 2 },
  empty: { fontStyle: 'italic', color: C.muted, textAlign: 'center', marginTop: 8 },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  confirmBtn: {
    flex: 1, backgroundColor: C.green, borderRadius: RADIUS.sm,
    padding: SPACING.sm, alignItems: 'center',
  },
  confirmText: { fontFamily: FONT.uiBd, color: '#fff' },
  cancelBtn: {
    flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: RADIUS.sm, padding: SPACING.sm, alignItems: 'center',
  },
  cancelText: { color: C.text },
});
```

---

## i18n Keys

**File:** `ehr-frontend/src/i18n/en.json` (and equivalents for sn, nd, pt, fr, sw, zu, af)

```json
{
  "drug_sub": {
    "title": "AI Drug Substitution",
    "original_drug": "Original drug name",
    "dose": "Dose (optional)",
    "find": "Find Substitutes",
    "confirm": "Confirm Substitution",
    "cancel": "Cancel",
    "none_found": "No substitutes found. Please consult your pharmacist.",
    "confirmed": "Substitution recorded",
    "caveat": "Caveat"
  }
}
```

| Key | sn | nd | pt | fr | sw | zu | af |
|-----|----|----|----|----|----|----|-----|
| title | Kuchinja Mushonga neAI | Ukushintsha Umuthi nge-AI | Substituição de Medicamento IA | Substitution Médicament IA | Ubadilishaji wa Dawa na AI | Ukuguqulwa Kwemithi ne-AI | AI Dwelvervanging |
| find | Tsvaga Zvichinjira | Thola Izindlela | Encontrar Substitutos | Trouver des Substituts | Tafuta Mbadala | Thola Izinye | Vind Vervangings |
| confirm | Simbisa Kuchinja | Qinisekisa Ukushintsha | Confirmar Substituição | Confirmer la Substitution | Thibitisha Ubadilishaji | Qinisekisa Ukuguquliwe | Bevestig Vervanging |
| none_found | Hazvisangani. Taura nemutiriri wemishonga. | Akutholakali. Xoxa nomthi weziyobisi. | Nenhum substituto. Consulte o farmacêutico. | Aucun substitut. Consultez le pharmacien. | Hakuna mbadala. Wasiliana na daktari wa dawa. | Akukho okufanelekayo. Xhumana nomkhebi. | Geen vervangings. Raadpleeg die apteker. |

---

## Module Registration

**File:** `services/ehr-service/src/ehr.module.ts`

Add to providers and controllers:
```typescript
import { DrugSubstitutionService } from './services/drug-substitution.service';
import { DrugSubstitutionController } from './controllers/drug-substitution.controller';

// In @Module:
providers: [...existingProviders, DrugSubstitutionService],
controllers: [...existingControllers, DrugSubstitutionController],
```

---

## Jest Spec

**File:** `services/ehr-service/src/services/drug-substitution.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { DrugSubstitutionService } from './drug-substitution.service';

describe('DrugSubstitutionService', () => {
  let svc: DrugSubstitutionService;
  let db: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DrugSubstitutionService],
    }).compile();
    svc = module.get(DrugSubstitutionService);
    db = { query: jest.fn().mockResolvedValue([{ id: 1 }]) };
  });

  it('returns rule-based fallback for known drug', async () => {
    const res = await svc.getSuggestions(db, {
      originalDrug: 'Amoxicillin 500mg',
      patientId: 1,
      requestedBy: 99,
      subdomain: 'test',
    });
    expect(res.suggestions.length).toBeGreaterThan(0);
    expect(res.suggestions[0].sourceType).toBe('rule');
    expect(res.suggestions[0].confidence).toBeGreaterThan(0);
  });

  it('returns empty suggestions with abstention for unknown drug', async () => {
    const res = await svc.getSuggestions(db, {
      originalDrug: 'XYZ-Unknown-9999',
      patientId: 2,
      requestedBy: 99,
      subdomain: 'test',
    });
    expect(res.suggestions).toHaveLength(0);
  });

  it('persists suggestion row to DB', async () => {
    await svc.getSuggestions(db, {
      originalDrug: 'Metformin 500mg',
      requestedBy: 99,
      subdomain: 'test',
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO drug_substitution_suggestions'),
      expect.any(Array),
    );
  });

  it('selectSubstitute updates the record', async () => {
    await svc.selectSubstitute(db, 1, 'Ampicillin 500mg', 99);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE drug_substitution_suggestions'),
      expect.arrayContaining(['Ampicillin 500mg', 99, 1]),
    );
  });
});
```

---

## Acceptance Criteria

1. `POST /drug-substitution/suggest` with `{ originalDrug: "Amoxicillin 500mg", patientId: 1 }` returns `suggestions` array with at least one entry and `confidence > 0`.
2. Each suggestion has `drug`, `confidence` (0–1), `rationale`, `caveat`, `sourceType`.
3. When CDSS is unavailable, `cdssAvailable: false` is returned and an `ai_abstention_log` row is inserted.
4. `PATCH /drug-substitution/:id/select` updates `selected_drug`, `selected_at`, `selected_by` in the DB row.
5. `GET /drug-substitution/patient/:patientId/history` returns last 20 requests for that patient.
6. EHR modal opens with an input, shows ranked suggestions with confidence %, and records the clinician's selection.
7. Mobile sheet mirrors EHR modal with correct design tokens; tapping a card highlights it with `C.blue` border.
8. Rule-based fallback covers Amoxicillin, Metformin, Atenolol, Amlodipine.
9. `drug_substitution_suggestions` table is created by provisioning bundle `2026.05.27.1` using `CREATE TABLE IF NOT EXISTS`.
10. All 8 i18n files have `drug_sub.*` keys.

---

## Definition of Done

- [ ] DB provisioning bundle added and verified with `CREATE TABLE IF NOT EXISTS`
- [ ] `DrugSubstitutionService` injected with `@Optional()` on all AI dependencies
- [ ] CDSS path attempted first; LLM fallback second; rule-based fallback third
- [ ] `AbstentionLogService.log()` called on CDSS failure or no-data
- [ ] Controller guards: `@UseGuards(JwtAuthGuard)`, uses `req.tenantDb`, `req.user.sub`
- [ ] EHR modal renders confidence bars, caveat warnings, confirm/cancel flow
- [ ] Mobile sheet uses `C`, `FONT`, `RADIUS`, `SHADOW`, `SPACING` tokens throughout
- [ ] All 8 i18n locale files updated
- [ ] Module registration complete (providers + controllers)
- [ ] Jest spec: 4 tests passing, no stubs
- [ ] Reviewer certification signed off
