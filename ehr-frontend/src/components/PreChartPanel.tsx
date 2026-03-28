import React, { useEffect, useState, useCallback } from 'react';
import {
  Brain, RefreshCw, CheckCircle, AlertTriangle, Pill,
  Stethoscope, ClipboardList, ChevronDown, ChevronUp, Loader,
} from 'lucide-react';
import { cdssApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { AiOutputWrapper } from './AiOutputWrapper';

interface RiskFlag {
  type: string;
  description: string;
}

interface CareGap {
  gap_type?: string;
  description?: string;
  recommended_action?: string;
  priority?: string;
}

interface Prechart {
  id: string;
  appointmentId: string;
  generatedAt: string;
  clinicalSummary?: string;
  activeProblems: Array<{ code?: string; description: string }>;
  currentMedications: Array<{ name?: string; dose?: string; route?: string } | string>;
  allergies: Array<{ allergen?: string; reaction?: string } | string>;
  outstandingCareGaps: CareGap[];
  suggestedAgenda: string[];
  riskFlags: RiskFlag[];
  lastLabAbnormalities: Array<{ test?: string; result?: string; flag?: string } | string>;
  lastImagingFindings: Array<{ study?: string; finding?: string } | string>;
  providerReviewed: boolean;
  providerReviewedAt?: string;
}

interface PreChartPanelProps {
  appointmentId: string;
  token: string;
  tenantSlug: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 border-red-300 text-red-800',
  high:   'bg-orange-100 border-orange-300 text-orange-800',
  medium: 'bg-amber-50 border-amber-300 text-amber-800',
  low:    'bg-blue-50 border-blue-200 text-blue-700',
};

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
      {icon}
      {label}
    </p>
  );
}

function ItemText(item: any): string {
  if (typeof item === 'string') return item;
  return item.description || item.name || item.allergen || item.test || item.study || JSON.stringify(item);
}

const PreChartPanel: React.FC<PreChartPanelProps> = ({ appointmentId, token, tenantSlug }) => {
  const [prechart, setPrechart]     = useState<Prechart | null>(null);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reviewed, setReviewed]     = useState(false);
  const [expanded, setExpanded]     = useState(true);
  const { showError } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cdssApi.getPrechart(appointmentId, token, tenantSlug);
      if (res.data) {
        setPrechart(res.data);
        setReviewed(res.data.providerReviewed);
      }
    } catch {
      // no prechart yet — that's fine
    } finally {
      setLoading(false);
    }
  }, [appointmentId, token, tenantSlug]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await cdssApi.generatePrechart(appointmentId, token, tenantSlug);
      setPrechart(res.data);
      setReviewed(res.data.providerReviewed);
    } catch {
      showError('Pre-chart failed', 'AI pre-chart generation failed. Please retry or proceed manually.');
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkReviewed = async () => {
    try {
      await cdssApi.markPrechartReviewed(appointmentId, token, tenantSlug);
      setReviewed(true);
    } catch {
      showError('Error', 'Failed to mark pre-chart as reviewed.');
    }
  };

  const hasRisk = prechart && (prechart.riskFlags?.length ?? 0) > 0;

  return (
    <div className={`rounded-xl border shadow-sm transition-all ${
      hasRisk ? 'border-orange-300 bg-orange-50' : 'border-purple-200 bg-gradient-to-r from-purple-50 to-slate-50'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Brain className={`w-5 h-5 ${prechart ? 'text-purple-600' : 'text-slate-400'}`} />
          <span className="text-sm font-semibold text-slate-700">
            AI Pre-Chart
            {prechart && !reviewed && (
              <span className="ml-2 text-xs text-purple-500 font-normal">● Ready for review</span>
            )}
            {reviewed && (
              <span className="ml-2 text-xs text-green-600 font-normal">✓ Reviewed</span>
            )}
          </span>
          {hasRisk && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-200 border border-orange-300 text-orange-800 rounded-full text-xs font-semibold">
              <AlertTriangle className="w-3 h-3" />
              {prechart!.riskFlags.length} risk flag{prechart!.riskFlags.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!prechart && !loading && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-60 transition-colors"
            >
              {generating ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              {generating ? 'Generating…' : 'Generate Pre-Chart'}
            </button>
          )}
          {prechart && !reviewed && (
            <button
              onClick={handleMarkReviewed}
              className="flex items-center gap-1 px-2.5 py-1 bg-green-100 border border-green-300 text-green-700 rounded-lg text-xs hover:bg-green-200"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Mark Reviewed
            </button>
          )}
          {prechart && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="p-1 text-slate-400 hover:text-purple-600 disabled:opacity-40"
              title="Regenerate"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            </button>
          )}
          {prechart && (
            <button onClick={() => setExpanded(!expanded)} className="p-1 text-slate-400 hover:text-slate-600">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="px-4 pb-4 pt-1 border-t border-purple-100">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader className="w-3.5 h-3.5 animate-spin" /> Loading pre-chart…
          </div>
        </div>
      )}

      {/* No prechart yet */}
      {!loading && !prechart && (
        <div className="px-4 pb-4 pt-1 border-t border-purple-100">
          <p className="text-xs text-slate-400">
            No pre-chart generated yet. The system will auto-generate 30 min before the appointment,
            or click <em>Generate Pre-Chart</em> now.
          </p>
        </div>
      )}

      {/* Main content */}
      {prechart && expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-purple-100">
          {/* Generated timestamp */}
          <p className="text-[10px] text-slate-400">
            Generated {new Date(prechart.generatedAt).toLocaleString()}
          </p>

          {/* Clinical summary */}
          {prechart.clinicalSummary && (
            <div className="bg-white/70 rounded-lg px-3 py-2 text-xs text-slate-700 border border-slate-100">
              {prechart.clinicalSummary}
            </div>
          )}

          {/* Risk flags */}
          {prechart.riskFlags.length > 0 && (
            <div className="space-y-1">
              <SectionHeader icon={<AlertTriangle className="w-3.5 h-3.5 text-orange-500" />} label="Risk Flags" />
              {prechart.riskFlags.map((f, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-1.5 bg-orange-100 border border-orange-200 rounded-lg text-xs text-orange-800">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span><strong>{f.type}</strong> — {f.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Suggested agenda */}
          {prechart.suggestedAgenda.length > 0 && (
            <div>
              <SectionHeader icon={<ClipboardList className="w-3.5 h-3.5 text-purple-500" />} label="Suggested Agenda" />
              <ul className="space-y-1">
                {prechart.suggestedAgenda.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="text-purple-400 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Outstanding care gaps */}
          {prechart.outstandingCareGaps.length > 0 && (
            <div>
              <SectionHeader icon={<Stethoscope className="w-3.5 h-3.5 text-indigo-500" />} label="Outstanding Care Gaps" />
              <div className="flex flex-wrap gap-1.5">
                {prechart.outstandingCareGaps.map((g, i) => {
                  const p = (g.priority || 'medium').toLowerCase();
                  return (
                    <div key={i} className={`px-2.5 py-1 rounded-full border text-xs font-medium ${PRIORITY_COLORS[p] ?? PRIORITY_COLORS.medium}`}>
                      {g.description || g.gap_type}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active problems */}
          {prechart.activeProblems.length > 0 && (
            <div>
              <SectionHeader icon={<Stethoscope className="w-3.5 h-3.5 text-slate-400" />} label="Active Problems" />
              <div className="flex flex-wrap gap-1.5">
                {prechart.activeProblems.map((p, i) => (
                  <span key={i} className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-full text-xs">
                    {p.code ? <span className="font-mono text-slate-500 mr-1">{p.code}</span> : null}
                    {p.description}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Current medications */}
          {prechart.currentMedications.length > 0 && (
            <div>
              <SectionHeader icon={<Pill className="w-3.5 h-3.5 text-purple-400" />} label="Current Medications" />
              <div className="flex flex-wrap gap-1.5">
                {prechart.currentMedications.map((m, i) => (
                  <span key={i} className="px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-800 rounded-full text-xs">
                    {ItemText(m)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Lab abnormalities */}
          {prechart.lastLabAbnormalities.length > 0 && (
            <div>
              <SectionHeader icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />} label="Recent Lab Abnormalities" />
              <div className="flex flex-wrap gap-1.5">
                {prechart.lastLabAbnormalities.map((l, i) => (
                  <span key={i} className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs">
                    {ItemText(l)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PreChartPanel;
