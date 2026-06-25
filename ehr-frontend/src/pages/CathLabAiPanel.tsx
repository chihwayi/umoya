import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';

const TERRITORY_COLOR: Record<string, string> = {
  anterior:  '#E8614D',
  inferior:  '#F0954A',
  lateral:   '#F0954A',
  posterior: '#F0954A',
  rvmi:      '#E8614D',
  diffuse:   '#DC2626',
  none:      '#0AA98A',
};

const RISK_COLOR: Record<string, string> = {
  low:       '#0AA98A',
  moderate:  '#F0954A',
  high:      '#E8614D',
  very_high: '#DC2626',
};

const COMPLEXITY_COLOR: Record<string, string> = {
  low:          '#0AA98A',
  intermediate: '#F0954A',
  high:         '#E8614D',
};

function MetricCard({ title, children, borderColor }: { title: string; children: React.ReactNode; borderColor?: string }) {
  return (
    <div
      style={{ borderLeftColor: borderColor ?? '#334155', borderLeftWidth: 4, borderLeftStyle: 'solid' }}
      className="bg-slate-800 rounded-lg p-5 mb-4"
    >
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function CathLabAiPanel() {
  const { caseId } = useParams<{ tenantSlug: string; caseId: string }>();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    api
      .get(`/cathlab/ai/case/${caseId}/summary`)
      .then((r: any) => setSummary(r.data ?? r))
      .catch(() => setError('Failed to load AI summary'))
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-400">{error}</div>
    );
  }

  if (!summary) {
    return <div className="p-6 text-slate-400">No AI data available for this case.</div>;
  }

  const { ecg, contrast_risk, dapt, syntax } = summary;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-6">CathLab AI Summary</h1>

      {/* ECG Territory Banner */}
      {ecg && (
        <MetricCard title="ECG Interpretation" borderColor={TERRITORY_COLOR[ecg.territory ?? 'none']}>
          <div className="flex items-center gap-3 mb-2">
            <span
              className="text-lg font-bold"
              style={{ color: TERRITORY_COLOR[ecg.territory ?? 'none'] }}
            >
              {ecg.territory?.toUpperCase() ?? 'NORMAL'} TERRITORY
            </span>
            {ecg.territory && ecg.territory !== 'none' && (
              <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: TERRITORY_COLOR[ecg.territory] + '33', color: TERRITORY_COLOR[ecg.territory] }}>
                STEMI ALERT
              </span>
            )}
          </div>
          {ecg.max_st_elev_mm != null && (
            <p className="text-slate-300 text-sm">Max ST elevation: <strong>{ecg.max_st_elev_mm} mm</strong></p>
          )}
          {ecg.sgarbossa_score != null && (
            <p className="text-slate-300 text-sm">Sgarbossa score: <strong>{ecg.sgarbossa_score}</strong></p>
          )}
          {ecg.ai_impression && (
            <p className="text-slate-400 text-sm mt-2 italic">{ecg.ai_impression}</p>
          )}
          {ecg.ai_confidence != null && (
            <p className="text-slate-500 text-xs mt-1">AI confidence: {Math.round(ecg.ai_confidence * 100)}%</p>
          )}
        </MetricCard>
      )}

      {/* Mehran Contrast Risk Donut */}
      {contrast_risk && (
        <MetricCard title="Mehran Contrast Nephropathy Risk" borderColor={RISK_COLOR[contrast_risk.risk_level]}>
          <div className="flex items-start gap-6">
            <div className="text-center">
              <div
                className="text-4xl font-black"
                style={{ color: RISK_COLOR[contrast_risk.risk_level] ?? '#94a3b8' }}
              >
                {contrast_risk.mehran_score}
              </div>
              <div className="text-xs text-slate-400 mt-1">Mehran Score</div>
            </div>
            <div className="flex-1">
              <span
                className="inline-block text-sm font-bold px-3 py-1 rounded mb-2"
                style={{ backgroundColor: (RISK_COLOR[contrast_risk.risk_level] ?? '#94a3b8') + '33', color: RISK_COLOR[contrast_risk.risk_level] ?? '#94a3b8' }}
              >
                {contrast_risk.risk_level?.toUpperCase().replace('_', ' ')} RISK
              </span>
              <p className="text-slate-300 text-sm leading-relaxed">{contrast_risk.recommendation}</p>
            </div>
          </div>
        </MetricCard>
      )}

      {/* SYNTAX Score Card */}
      {syntax && (
        <MetricCard title="SYNTAX Score — Coronary Complexity" borderColor={COMPLEXITY_COLOR[syntax.complexity_tier]}>
          <div className="flex items-start gap-6">
            <div className="text-center">
              <div className="text-5xl font-black text-white">{syntax.syntax_score}</div>
              <div className="text-xs text-slate-400 mt-1">SYNTAX Score</div>
            </div>
            <div className="flex-1">
              <span
                className="inline-block text-sm font-bold px-3 py-1 rounded mb-2"
                style={{ backgroundColor: (COMPLEXITY_COLOR[syntax.complexity_tier] ?? '#94a3b8') + '33', color: COMPLEXITY_COLOR[syntax.complexity_tier] ?? '#94a3b8' }}
              >
                {syntax.complexity_tier?.toUpperCase()} COMPLEXITY
              </span>
              <p className="text-slate-300 text-sm italic">{syntax.recommended_strategy?.replace(/_/g, ' ')}</p>
              {syntax.syntax_ii_score != null && (
                <p className="text-slate-500 text-xs mt-2">SYNTAX II: {syntax.syntax_ii_score}</p>
              )}
            </div>
          </div>
        </MetricCard>
      )}

      {/* DAPT Recommendation Card */}
      {dapt && (
        <MetricCard title="DAPT Recommendation">
          <div className="mb-3">
            <span className="text-white font-semibold text-base">{dapt.recommended_agent?.replace(/_/g, ' ')}</span>
            <span className="text-slate-400 text-sm ml-2">for {dapt.recommended_duration_months} months</span>
          </div>
          <div className="flex gap-4 text-xs text-slate-400 mb-3">
            <span>Stent: {dapt.stent_type}</span>
            <span>Indication: {dapt.indication?.toUpperCase()}</span>
            {dapt.dapt_score != null && <span>DAPT Score: {dapt.dapt_score}</span>}
            {dapt.bleeding_risk_high && <span className="text-amber-400 font-semibold">HIGH BLEEDING RISK</span>}
          </div>
          {dapt.interaction_flags?.length > 0 && (
            <div className="bg-red-900/30 border border-red-700/40 rounded p-3 space-y-1">
              <p className="text-xs font-semibold text-red-400 mb-1">Drug Interactions</p>
              {dapt.interaction_flags.map((f: any, i: number) => (
                <p key={i} className="text-xs text-red-300">
                  <span className="font-bold text-red-400">[{f.severity?.toUpperCase()}]</span> {f.message}
                </p>
              ))}
            </div>
          )}
        </MetricCard>
      )}

      {!ecg && !contrast_risk && !dapt && !syntax && (
        <p className="text-slate-400 text-sm">No AI assessments recorded yet for this case.</p>
      )}
    </div>
  );
}
