import React, { useState } from 'react';

interface WeightBandDose {
  weightMin: number;
  weightMax: number;
  abcLtcFdc?: string;
  efv?: string;
  lpvR?: string;
  nvp?: string;
  note?: string;
}

const WEIGHT_BANDS: WeightBandDose[] = [
  { weightMin: 3, weightMax: 5.9, abcLtcFdc: '30/15 mg BID', lpvR: '16/4 mg/kg BID (liquid)', nvp: '5 mg/kg OD×2w then BID', note: 'EFV not recommended <3y' },
  { weightMin: 6, weightMax: 9.9, abcLtcFdc: '60/30 mg BID', lpvR: '13/3.25 mg/kg BID (liquid)', nvp: '5 mg/kg OD×2w then BID' },
  { weightMin: 10, weightMax: 13.9, abcLtcFdc: 'ABC/3TC 1 tab OD', efv: '200 mg OD', lpvR: '200/50 mg BID' },
  { weightMin: 14, weightMax: 19.9, abcLtcFdc: 'ABC/3TC 1.5 tabs OD', efv: '200 mg OD', lpvR: '200/50 mg BID' },
  { weightMin: 20, weightMax: 24.9, abcLtcFdc: 'ABC/3TC 2 tabs OD', efv: '300 mg OD', lpvR: '300/75 mg BID' },
  { weightMin: 25, weightMax: 999, abcLtcFdc: 'Adult: TDF/3TC/DTG 1 tab OD', efv: 'Adult: EFV 600 mg OD', lpvR: 'Adult: LPV/r 400/100 mg BID', note: '≥25 kg — adult formulations' },
];

function getDoseForWeight(kg: number): WeightBandDose | null {
  return WEIGHT_BANDS.find((b) => kg >= b.weightMin && kg <= b.weightMax) ?? null;
}

function isNearBoundary(kg: number): boolean {
  const band = getDoseForWeight(kg);
  return band !== null && band.weightMax < 999 && kg >= band.weightMax - 1;
}

export const PaediatricDosingPanel: React.FC = () => {
  const [weight, setWeight] = useState('');
  const [showTable, setShowTable] = useState(false);

  const weightNum = parseFloat(weight);
  const dose = !isNaN(weightNum) && weightNum > 0 ? getDoseForWeight(weightNum) : null;
  const nearBoundary = !isNaN(weightNum) && isNearBoundary(weightNum);

  return (
    <div style={{ padding: 16, maxWidth: 640 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Paediatric ART Dosing</h3>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <label style={{ fontWeight: 500 }}>Weight (kg):</label>
        <input
          type="number"
          min={0}
          step={0.1}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="e.g. 8.5"
          style={{ width: 90, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4 }}
        />
      </div>

      {dose ? (
        <div style={{
          padding: 16,
          background: nearBoundary ? '#fffbeb' : '#f0fdf4',
          border: `1px solid ${nearBoundary ? '#fcd34d' : '#86efac'}`,
          borderRadius: 8,
          marginBottom: 16,
        }}>
          {nearBoundary && (
            <p style={{ color: '#92400e', fontWeight: 600, margin: '0 0 8px', fontSize: 13 }}>
              Near weight band boundary — reassess dosing at next visit
            </p>
          )}
          <p style={{ margin: '0 0 4px', fontSize: 13 }}>
            <strong>Band:</strong> {dose.weightMin}–{dose.weightMax === 999 ? '≥25' : dose.weightMax} kg
          </p>
          {dose.abcLtcFdc && <p style={{ margin: '0 0 4px', fontSize: 13 }}><strong>ABC/3TC:</strong> {dose.abcLtcFdc}</p>}
          {dose.efv && <p style={{ margin: '0 0 4px', fontSize: 13 }}><strong>EFV:</strong> {dose.efv}</p>}
          {dose.lpvR && <p style={{ margin: '0 0 4px', fontSize: 13 }}><strong>LPV/r:</strong> {dose.lpvR}</p>}
          {dose.nvp && <p style={{ margin: '0 0 4px', fontSize: 13 }}><strong>NVP:</strong> {dose.nvp}</p>}
          {dose.note && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280' }}>{dose.note}</p>}
        </div>
      ) : !isNaN(weightNum) && weightNum > 0 ? (
        <p style={{ color: '#ef4444', fontSize: 13 }}>No dosing band found for {weightNum} kg.</p>
      ) : null}

      <button
        onClick={() => setShowTable(!showTable)}
        style={{ fontSize: 13, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        {showTable ? 'Hide' : 'Show'} full weight band table
      </button>

      {showTable && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 12 }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'left' }}>Band</th>
              <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>ABC/3TC</th>
              <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>EFV</th>
              <th style={{ padding: 8, border: '1px solid #e5e7eb' }}>LPV/r</th>
            </tr>
          </thead>
          <tbody>
            {WEIGHT_BANDS.map((band) => (
              <tr
                key={band.weightMin}
                style={{
                  background: !isNaN(weightNum) && weightNum >= band.weightMin && weightNum <= band.weightMax
                    ? '#dbeafe'
                    : 'transparent',
                }}
              >
                <td style={{ padding: 8, border: '1px solid #e5e7eb', fontWeight: 600 }}>
                  {band.weightMin}–{band.weightMax === 999 ? '≥25' : band.weightMax} kg
                </td>
                <td style={{ padding: 8, border: '1px solid #e5e7eb' }}>{band.abcLtcFdc ?? '—'}</td>
                <td style={{ padding: 8, border: '1px solid #e5e7eb' }}>{band.efv ?? '—'}</td>
                <td style={{ padding: 8, border: '1px solid #e5e7eb' }}>{band.lpvR ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
