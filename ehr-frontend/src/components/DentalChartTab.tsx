import React, { useState } from 'react';

type Condition = 'healthy' | 'caries' | 'filled' | 'missing' | 'crown' | 'rct' | 'extraction_needed' | 'watch';

const CONDITION_COLORS: Record<Condition, string> = {
  healthy: '#22c55e',
  caries: '#ef4444',
  filled: '#3b82f6',
  missing: '#9ca3af',
  crown: '#f59e0b',
  rct: '#8b5cf6',
  extraction_needed: '#dc2626',
  watch: '#eab308',
};

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

interface ToothState {
  condition: Condition;
}

interface PerioEntry {
  toothNumber: number;
  site: string;
  probingDepthMm: number;
  bleedingOnProbing: boolean;
}

interface TreatmentPlanItem {
  id: string;
  procedureCode: string;
  procedureDescription: string;
  status: string;
  plannedDate?: string;
}

interface DentalChartTabProps {
  patientId: string;
  token: string;
  tenantSlug: string;
  onSave?: (data: any) => void;
}

export const DentalChartTab: React.FC<DentalChartTabProps> = ({
  patientId,
  token,
  tenantSlug,
  onSave,
}) => {
  const [teeth, setTeeth] = useState<Record<number, ToothState>>({});
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'chart' | 'perio' | 'plan'>('chart');
  const [perioEntries, setPerioEntries] = useState<PerioEntry[]>([]);
  const [treatmentPlans, setTreatmentPlans] = useState<TreatmentPlanItem[]>([]);
  const [newProcedure, setNewProcedure] = useState({ code: '', description: '', date: '' });
  const [saving, setSaving] = useState(false);

  const handleToothClick = (tooth: number) => {
    setSelectedTooth(tooth === selectedTooth ? null : tooth);
  };

  const handleConditionChange = (condition: Condition) => {
    if (selectedTooth === null) return;
    setTeeth((prev) => ({ ...prev, [selectedTooth]: { condition } }));
  };

  const getToothColor = (tooth: number) => {
    const state = teeth[tooth];
    if (!state) return '#e5e7eb';
    return CONDITION_COLORS[state.condition] ?? '#e5e7eb';
  };

  const handleSaveChart = async () => {
    setSaving(true);
    try {
      const toothConditions = Object.entries(teeth).map(([num, state]) => ({
        toothNumber: parseInt(num),
        condition: state.condition,
        surface: null,
        notes: null,
      }));
      onSave?.({ patientId, teeth: toothConditions });
    } finally {
      setSaving(false);
    }
  };

  const handleAddPlan = () => {
    if (!newProcedure.code || !newProcedure.description) return;
    setTreatmentPlans((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        procedureCode: newProcedure.code,
        procedureDescription: newProcedure.description,
        status: 'planned',
        plannedDate: newProcedure.date || undefined,
      },
    ]);
    setNewProcedure({ code: '', description: '', date: '' });
  };

  const ToothRow = ({ teeth: row }: { teeth: number[] }) => (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', margin: '4px 0' }}>
      {row.map((tooth) => (
        <button
          key={tooth}
          onClick={() => handleToothClick(tooth)}
          title={`Tooth ${tooth}${teeth[tooth] ? ` — ${teeth[tooth].condition}` : ''}`}
          style={{
            width: 32,
            height: 36,
            background: getToothColor(tooth),
            border: selectedTooth === tooth ? '2px solid #1d4ed8' : '1px solid #d1d5db',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: 600,
            color: '#1f2937',
          }}
        >
          {tooth}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {(['chart', 'perio', 'plan'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 16px',
              background: activeTab === tab ? '#1d4ed8' : '#f3f4f6',
              color: activeTab === tab ? '#fff' : '#374151',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {tab === 'chart' ? 'Dental Chart' : tab === 'perio' ? 'Perio Chart' : 'Treatment Plan'}
          </button>
        ))}
      </div>

      {activeTab === 'chart' && (
        <div>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>Upper Teeth</p>
            <ToothRow teeth={UPPER_TEETH} />
            <hr style={{ margin: '12px 0', borderColor: '#e5e7eb' }} />
            <ToothRow teeth={LOWER_TEETH} />
            <p style={{ textAlign: 'center', fontSize: 12, color: '#6b7280', margin: '8px 0 0' }}>Lower Teeth</p>
          </div>

          {selectedTooth !== null && (
            <div style={{ marginTop: 16, padding: 12, background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
              <p style={{ fontWeight: 600, margin: '0 0 8px' }}>Tooth {selectedTooth}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(Object.keys(CONDITION_COLORS) as Condition[]).map((cond) => (
                  <button
                    key={cond}
                    onClick={() => handleConditionChange(cond)}
                    style={{
                      padding: '4px 10px',
                      background: teeth[selectedTooth]?.condition === cond ? CONDITION_COLORS[cond] : '#fff',
                      color: teeth[selectedTooth]?.condition === cond ? '#fff' : '#374151',
                      border: `1px solid ${CONDITION_COLORS[cond]}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    {cond.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {(Object.entries(CONDITION_COLORS) as [Condition, string][]).map(([cond, color]) => (
              <span key={cond} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 12, background: color, borderRadius: 2, display: 'inline-block' }} />
                {cond.replace('_', ' ')}
              </span>
            ))}
          </div>

          <button
            onClick={handleSaveChart}
            disabled={saving || Object.keys(teeth).length === 0}
            style={{ marginTop: 16, padding: '8px 20px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            {saving ? 'Saving...' : 'Save Chart'}
          </button>
        </div>
      )}

      {activeTab === 'perio' && (
        <div>
          <p style={{ color: '#6b7280', fontSize: 13 }}>
            Periodontal probing chart — 6 sites per tooth (MB, B, DB, ML, L, DL)
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ padding: 6, border: '1px solid #e5e7eb' }}>Tooth</th>
                {['MB', 'B', 'DB', 'ML', 'L', 'DL'].map((site) => (
                  <th key={site} style={{ padding: 6, border: '1px solid #e5e7eb' }}>{site}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...UPPER_TEETH, ...LOWER_TEETH].slice(0, 8).map((tooth) => (
                <tr key={tooth}>
                  <td style={{ padding: 6, border: '1px solid #e5e7eb', fontWeight: 600 }}>{tooth}</td>
                  {['MB', 'B', 'DB', 'ML', 'L', 'DL'].map((site) => {
                    const entry = perioEntries.find((e) => e.toothNumber === tooth && e.site === site);
                    return (
                      <td key={site} style={{ padding: 4, border: '1px solid #e5e7eb' }}>
                        <input
                          type="number"
                          min={0}
                          max={15}
                          defaultValue={entry?.probingDepthMm ?? ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              setPerioEntries((prev) => {
                                const filtered = prev.filter((p) => !(p.toothNumber === tooth && p.site === site));
                                return [...filtered, { toothNumber: tooth, site, probingDepthMm: val, bleedingOnProbing: false }];
                              });
                            }
                          }}
                          style={{ width: 40, padding: 2, border: '1px solid #d1d5db', borderRadius: 3 }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'plan' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              placeholder="Procedure code"
              value={newProcedure.code}
              onChange={(e) => setNewProcedure((p) => ({ ...p, code: e.target.value }))}
              style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, flex: '0 0 120px' }}
            />
            <input
              placeholder="Description"
              value={newProcedure.description}
              onChange={(e) => setNewProcedure((p) => ({ ...p, description: e.target.value }))}
              style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, flex: 1 }}
            />
            <input
              type="date"
              value={newProcedure.date}
              onChange={(e) => setNewProcedure((p) => ({ ...p, date: e.target.value }))}
              style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            <button
              onClick={handleAddPlan}
              style={{ padding: '6px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Add
            </button>
          </div>

          {treatmentPlans.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>No treatment plans recorded.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'left' }}>Code</th>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'left' }}>Procedure</th>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>Planned Date</th>
                  <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {treatmentPlans.map((plan) => (
                  <tr key={plan.id}>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb' }}>{plan.procedureCode}</td>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb' }}>{plan.procedureDescription}</td>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>{plan.plannedDate ?? '—'}</td>
                    <td style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <span style={{
                        background: plan.status === 'completed' ? '#dcfce7' : '#fef9c3',
                        color: plan.status === 'completed' ? '#166534' : '#713f12',
                        padding: '2px 8px',
                        borderRadius: 8,
                        fontSize: 11,
                      }}>
                        {plan.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
