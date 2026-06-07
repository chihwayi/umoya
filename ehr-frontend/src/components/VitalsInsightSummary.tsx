import React from 'react';

/**
 * Compact, read-only rendering of the CDSS copilot insight that was persisted
 * with a vitals record. Used in the Vitals History timeline so the copilot
 * interpretation for each reading remains accessible after the pane is closed.
 *
 * Expects the persisted `cdssInsights` object (the shape returned by the vitals
 * CDSS hook: `{ risk: {...} }`).
 */
export const VitalsInsightSummary: React.FC<{ insights: any }> = ({ insights }) => {
  const risk = insights?.risk;
  if (!risk) {
    return (
      <p className="text-xs text-slate-400 italic">
        No copilot interpretation was captured for this reading.
      </p>
    );
  }

  const acute = risk.acute_safety?.acute_deterioration;
  const syndromeAlerts: any[] = Array.isArray(risk.acute_safety?.syndrome_alerts)
    ? risk.acute_safety.syndrome_alerts
    : [];
  const recommendations: any[] = Array.isArray(risk.recommendations) ? risk.recommendations : [];

  return (
    <div className="space-y-3">
      {/* Copilot summary — the one-paragraph gestalt */}
      {risk.acute_safety?.copilot_summary && (
        <div className={`rounded-lg border p-3 ${acute ? 'border-red-200 bg-red-50/70' : 'border-slate-200 bg-slate-50'}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Clinical Copilot Summary
          </p>
          <p className="text-sm leading-relaxed text-slate-800">{risk.acute_safety.copilot_summary}</p>
        </div>
      )}

      {/* Governor banner */}
      {risk.governor_banner && (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 p-2.5">
          <p className="text-xs font-bold text-red-800">⛔ {risk.governor_banner}</p>
        </div>
      )}

      {/* Syndrome alerts */}
      {syndromeAlerts.length > 0 && (
        <div className="space-y-1.5">
          {syndromeAlerts.map((a, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-2 ${a.severity === 'critical' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}
            >
              <p className={`text-[11px] font-bold uppercase tracking-wide ${a.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>
                {String(a.type || '').replace(/_/g, ' ')} · {a.severity}
              </p>
              <p className="text-xs text-slate-800">{a.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Risk level — readmission score hidden during acute deterioration (it is suppressed) */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">Risk</span>
        <span className="text-sm font-bold capitalize text-slate-900">{risk.risk_level || 'unknown'}</span>
        {!acute && typeof risk.overall_score === 'number' && (
          <span className="text-xs text-slate-400">· score {risk.overall_score.toFixed(1)}</span>
        )}
      </div>

      {/* Top recommendations */}
      {recommendations.length > 0 && (
        <ul className="space-y-1">
          {recommendations.slice(0, 3).map((rec, idx) => {
            const text = typeof rec === 'string' ? rec : rec?.recommendation || '';
            if (!text) return null;
            return (
              <li key={idx} className="text-xs text-slate-700 flex items-start gap-1">
                <span className="text-indigo-500 mt-0.5">•</span>
                <span>{text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default VitalsInsightSummary;
