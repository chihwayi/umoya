import React, { useState } from 'react';
import { api } from '../services/api';

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

function confidenceColor(c: number) {
  if (c >= 0.8) return '#16a34a';
  if (c >= 0.6) return '#d97706';
  return '#dc2626';
}

function sourceLabel(s: string) {
  return ({ cdss: 'CDSS', llm: 'AI', rule: 'Rules' } as Record<string, string>)[s] ?? s;
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
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!originalDrug.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const response = await api.post('/drug-substitution/suggest', {
        originalDrug: originalDrug.trim(),
        originalDose: originalDose.trim() || undefined,
        patientId,
        diagnoses,
        allergies,
      });
      setResult(response.data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to fetch suggestions');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!result || !selected) return;
    try {
      await api.patch(`/drug-substitution/${result.id}/select`, { selectedDrug: selected });
      setConfirmed(true);
      onSelected(selected);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to confirm selection');
    }
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
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>AI Drug Substitution</h3>
          <span style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 10,
            background: result?.cdssAvailable === false ? '#fef3c7' : '#f0fdf4',
            color: result?.cdssAvailable === false ? '#92400e' : '#15803d',
            fontWeight: 600,
          }}>
            {loading ? 'Searching…' : result?.cdssAvailable === false ? 'Rule-based' : 'Ready'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            placeholder="Original drug name"
            value={originalDrug}
            onChange={e => setOriginalDrug(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
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
              opacity: loading || !originalDrug.trim() ? 0.5 : 1,
            }}
          >
            {loading ? 'Searching…' : 'Find Substitutes'}
          </button>
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

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
                    cursor: 'pointer',
                    background: selected === s.drug ? '#eff6ff' : '#fff',
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
                      <span style={{ fontWeight: 700, fontSize: 13, color: confidenceColor(s.confidence) }}>
                        {Math.round(s.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#374151' }}>{s.rationale}</p>
                  {s.caveat && (
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#b45309' }}>⚠ {s.caveat}</p>
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
                    flex: 1, padding: '10px 0',
                    background: selected ? '#16a34a' : '#9ca3af',
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
              padding: '8px 16px', background: '#f3f4f6',
              border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer',
            }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
