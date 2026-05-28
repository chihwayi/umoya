import React, { useState, useRef } from 'react';
import { ehrAxios } from '../services/api';
import { AiStatusBadge } from './AiStatusBadge';
import { AiSourceTag } from './AiSourceTag';

interface ClinicalEntities {
  diagnoses: Array<{ text: string; icd10Hint?: string; confidence: number }>;
  medications: Array<{ name: string; dose?: string; confidence: number }>;
  allergies: Array<{ substance: string; reaction?: string; confidence: number }>;
  symptoms: Array<{ text: string; confidence: number }>;
  procedures: Array<{ text: string; confidence: number }>;
  aiSource: string;
}

interface Props {
  patientId: number;
  encounterId?: number;
  onEntitiesExtracted?: (entities: ClinicalEntities) => void;
}

export default function NarrativeExtractorPanel({
  patientId, encounterId, onEntitiesExtracted,
}: Props) {
  const [text, setText] = useState('');
  const [entities, setEntities] = useState<ClinicalEntities | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setText(val);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 20) { setEntities(null); return; }
    debounceRef.current = setTimeout(() => extractEntities(val), 800);
  }

  async function extractEntities(noteText: string) {
    setLoading(true);
    try {
      const resp = await ehrAxios.post<ClinicalEntities>('/cdss/nlp/extract', {
        text: noteText, patientId, encounterId, context: 'ehr_realtime',
      });
      setEntities(resp.data);
      onEntitiesExtracted?.(resp.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <label style={{ fontWeight: 700, fontSize: 14 }}>Clinical Note</label>
        {entities && <AiSourceTag aiSource={entities.aiSource} />}
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        rows={6}
        placeholder="Type or dictate the clinical note…"
        style={{
          width: '100%', border: '1px solid #d1d5db', borderRadius: 8,
          padding: '10px 12px', fontSize: 14, resize: 'vertical',
          fontFamily: 'monospace',
        }}
      />
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <AiStatusBadge status="loading" />
          <span style={{ fontSize: 12, color: '#6b7280' }}>Extracting entities…</span>
        </div>
      )}
      {entities && !loading && (
        <div style={{
          marginTop: 8, padding: 12, background: '#f0f9ff',
          border: '1px solid #bae6fd', borderRadius: 8,
        }}>
          <EntitySection
            title="Diagnoses"
            items={entities.diagnoses.map(d => `${d.text}${d.icd10Hint ? ` (${d.icd10Hint})` : ''}`)}
            color="#1d4ed8"
          />
          <EntitySection
            title="Medications"
            items={entities.medications.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}`)}
            color="#0369a1"
          />
          <EntitySection
            title="Allergies"
            items={entities.allergies.map(a => `${a.substance}${a.reaction ? ` → ${a.reaction}` : ''}`)}
            color="#dc2626"
          />
          <EntitySection title="Symptoms" items={entities.symptoms.map(s => s.text)} color="#7c3aed" />
          <EntitySection title="Procedures" items={entities.procedures.map(p => p.text)} color="#065f46" />
        </div>
      )}
    </div>
  );
}

function EntitySection({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color, marginRight: 6 }}>{title}:</span>
      <span style={{ fontSize: 13 }}>{items.join(' · ')}</span>
    </div>
  );
}
