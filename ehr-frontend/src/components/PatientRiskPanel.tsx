import React, { useEffect, useState } from 'react';

interface RiskScores {
  deterioration?: number;
  readmission?: number;
  news2_raw?: number;
  qsofa?: number;
}

interface AiSnapshot {
  clinicalSummary: string;
  riskScores: RiskScores;
  activeFlags: string[];
  news2Score: number | null;
  qsofaScore: number | null;
  generatedAt: string;
}

const LEVEL_COLOR = {
  critical: 'text-red-400 bg-red-900/40',
  high: 'text-orange-400 bg-orange-900/40',
  medium: 'text-yellow-400 bg-yellow-900/40',
  low: 'text-green-400 bg-green-900/40',
  unknown: 'text-slate-400 bg-slate-800',
};

function RiskBadge({ label, value, level }: { label: string; value?: number; level?: string }) {
  const pct = value !== undefined ? Math.round(value * 100) : null;
  const color = LEVEL_COLOR[level as keyof typeof LEVEL_COLOR] || LEVEL_COLOR.unknown;
  return (
    <div className={`rounded-lg px-3 py-2 ${color} flex flex-col items-center min-w-[90px]`}>
      <span className="text-[10px] uppercase font-semibold opacity-70">{label}</span>
      <span className="text-lg font-bold">{pct !== null ? `${pct}%` : 'N/A'}</span>
      <span className="text-[10px] capitalize opacity-80">{level || '—'}</span>
    </div>
  );
}

export function PatientRiskPanel({ patientId, token, snapshot: initialSnapshot }: {
  patientId: string;
  token: string;
  snapshot?: AiSnapshot | null;
}) {
  const [snapshot, setSnapshot] = useState<AiSnapshot | null>(initialSnapshot || null);
  const [loading, setLoading] = useState(!initialSnapshot);

  useEffect(() => {
    if (initialSnapshot) { setSnapshot(initialSnapshot); return; }
    setLoading(true);
    fetch(`${process.env.REACT_APP_EHR_API_URL}/proactive/patient/${patientId}/snapshot`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => { setSnapshot(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [patientId]);

  if (loading) return <div className="text-slate-500 text-xs p-2">Analysing patient...</div>;
  if (!snapshot) return null;

  const analysis = snapshot as any;
  const riskLevels = analysis.analysisPayload?.risk_levels || {};

  return (
    <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
      {snapshot.clinicalSummary && (
        <p className="text-slate-300 text-xs mb-3 italic border-l-2 border-amber-500 pl-2">
          {snapshot.clinicalSummary}
        </p>
      )}

      <div className="flex gap-2 flex-wrap mb-3">
        {snapshot.news2Score !== null && (
          <div className={`rounded-lg px-3 py-2 flex flex-col items-center min-w-[80px] ${
            (snapshot.news2Score || 0) >= 7 ? LEVEL_COLOR.critical :
            (snapshot.news2Score || 0) >= 5 ? LEVEL_COLOR.high :
            (snapshot.news2Score || 0) >= 3 ? LEVEL_COLOR.medium : LEVEL_COLOR.low
          }`}>
            <span className="text-[10px] uppercase font-semibold opacity-70">NEWS2</span>
            <span className="text-xl font-bold">{snapshot.news2Score}</span>
            <span className="text-[10px] opacity-80">/20</span>
          </div>
        )}
        {snapshot.qsofaScore !== null && (
          <div className={`rounded-lg px-3 py-2 flex flex-col items-center min-w-[80px] ${
            (snapshot.qsofaScore || 0) >= 2 ? LEVEL_COLOR.critical : LEVEL_COLOR.low
          }`}>
            <span className="text-[10px] uppercase font-semibold opacity-70">qSOFA</span>
            <span className="text-xl font-bold">{snapshot.qsofaScore}</span>
            <span className="text-[10px] opacity-80">/3</span>
          </div>
        )}
        <RiskBadge label="Deterioration" value={snapshot.riskScores?.deterioration} level={riskLevels.deterioration} />
        <RiskBadge label="Readmission" value={snapshot.riskScores?.readmission} level={riskLevels.readmission} />
      </div>

      {snapshot.activeFlags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {snapshot.activeFlags.map(flag => (
            <span key={flag} className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 font-medium">
              {flag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      <p className="text-slate-600 text-[10px] mt-2">
        ⚠ AI-assisted — verify against official hospital protocols before acting.
        Last updated: {new Date(snapshot.generatedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}
