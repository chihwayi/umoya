import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Radar,
  ShieldAlert,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';

interface PatientIntelligenceWorkspaceProps {
  data: any;
  loading?: boolean;
  onRefresh?: () => void;
}

const TONE_STYLES: Record<string, string> = {
  critical: 'border-red-200 bg-gradient-to-br from-red-50 via-white to-rose-50 text-red-900',
  attention: 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 text-amber-900',
  stable: 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 text-emerald-900',
};

const PILL_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  attention: 'bg-amber-100 text-amber-700 border-amber-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  moderate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  routine: 'bg-slate-100 text-slate-700 border-slate-200',
  stable: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const formatPriority = (value?: string | null) =>
  String(value || 'routine')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());

const priorityClasses = (priority?: string | null) =>
  PILL_STYLES[String(priority || 'routine').toLowerCase()] || PILL_STYLES.routine;

const SOURCE_LABELS: Record<string, string> = {
  proactive_alert: 'Proactive AI alert',
  care_gap: 'Care gap engine',
  post_visit_followup: 'Post-visit follow-through',
  result_followup: 'Result follow-up',
  radiology_ai: 'Radiology AI',
  encounter_copilot: 'Encounter copilot',
  risk_tier: 'Risk tier engine',
};

const formatSourceLabel = (source?: string | null) =>
  SOURCE_LABELS[String(source || '').toLowerCase()] ||
  String(source || 'AI signal')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());

const formatShortLabel = (value?: string | null) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());

const SmallStat: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="rounded-xl border border-white/70 bg-white/70 px-4 py-3">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
  </div>
);

const EmptyState: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-5 text-center">
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
  </div>
);

const ExplainabilityMeta: React.FC<{
  aiMetadata?: any;
  confidence?: number | null;
  extra?: React.ReactNode;
}> = ({ aiMetadata, confidence, extra }) => {
  const modelVersion = aiMetadata?.provenance?.modelVersion || aiMetadata?.provenance?.modelId || null;
  const source = aiMetadata?.provenance?.source || null;
  const provider = aiMetadata?.provenance?.provider || null;

  if (!modelVersion && confidence === null && confidence === undefined && !extra && !source && !provider) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
      {modelVersion && <span>Model {modelVersion}</span>}
      {provider && <span>Provider {provider}</span>}
      {typeof confidence === 'number' && <span>{Math.round(confidence * 100)}% confidence</span>}
      {source && <span>Source {String(source).replace(/_/g, ' ')}</span>}
      {extra}
    </div>
  );
};

export const PatientIntelligenceWorkspace: React.FC<PatientIntelligenceWorkspaceProps> = ({
  data,
  loading = false,
  onRefresh,
}) => {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50 p-6 shadow-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-56 rounded bg-slate-200" />
          <div className="h-4 w-80 rounded bg-slate-100" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-20 rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-48 rounded-xl bg-slate-100" />
            <div className="h-48 rounded-xl bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tone = String(data?.summary?.tone || 'stable').toLowerCase();
  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.stable;
  const snapshot = data?.proactiveSnapshot;
  const riskTier = data?.riskTier;
  const nextActions = Array.isArray(data?.nextActions) ? data.nextActions : [];
  const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
  const careGaps = Array.isArray(data?.careGaps) ? data.careGaps : [];
  const postVisitFollowups = Array.isArray(data?.postVisitFollowups) ? data.postVisitFollowups : [];
  const encounterCopilot = data?.encounterCopilot || null;
  const radiology = data?.radiology || { findings: [], criticalFindingCount: 0, totalFindingCount: 0 };

  return (
    <div className={`rounded-2xl border p-6 shadow-lg ${toneStyle}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
            <Brain className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold text-slate-900">Patient Intelligence</h3>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${priorityClasses(tone)}`}>
                {tone === 'critical' ? 'Immediate Attention' : tone === 'attention' ? 'Needs Follow-Through' : 'Stable AI State'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-700">{data?.summary?.headline || 'Unified AI summary available.'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="w-3.5 h-3.5" />
                Last AI update {data?.summary?.lastUpdatedAt ? formatDateTimeToDDMMYYYYHHMM(data.summary.lastUpdatedAt) : 'unknown'}
              </span>
              {snapshot?.modelVersion && (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Snapshot model {snapshot.modelVersion}
                </span>
              )}
            </div>
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Radar className="w-4 h-4 text-indigo-500" />
            Refresh Intelligence
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SmallStat label="Active Alerts" value={data?.summary?.stats?.activeAlertCount ?? 0} />
        <SmallStat label="Open Care Gaps" value={data?.summary?.stats?.openCareGapCount ?? 0} />
        <SmallStat label="Radiology Flags" value={data?.summary?.stats?.criticalRadiologyCount ?? 0} />
        <SmallStat label="Next Actions" value={data?.summary?.stats?.nextActionCount ?? 0} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-indigo-500" />
            <h4 className="text-sm font-bold text-slate-900">What Matters Now</h4>
          </div>

          {nextActions.length === 0 ? (
            <EmptyState title="No urgent AI actions" subtitle="The system has no open high-signal follow-through items right now." />
          ) : (
            <div className="space-y-3">
              {nextActions.map((action: any) => (
                <div key={action.id} className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityClasses(action.priority)}`}>
                          {formatPriority(action.priority)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{action.summary}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Why: {formatSourceLabel(action.source)}
                      </p>
                      {action.recommendedAction && action.recommendedAction !== action.summary && (
                        <p className="mt-2 text-xs text-slate-500">
                          Recommended: {action.recommendedAction}
                        </p>
                      )}
                      {action.dueAt && (
                        <p className="mt-1 text-xs text-slate-500">
                          Next review: {formatDateTimeToDDMMYYYYHHMM(action.dueAt)}
                        </p>
                      )}
                      <ExplainabilityMeta
                        aiMetadata={action.aiMetadata}
                        confidence={action.confidenceScore}
                        extra={
                          <>
                            {action.backingType && <span>{formatShortLabel(action.backingType)}</span>}
                            {action.reviewState && <span>{formatShortLabel(action.reviewState)}</span>}
                            {action.evidenceLabel && <span>Evidence {action.evidenceLabel}</span>}
                          </>
                        }
                      />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="w-4 h-4 text-indigo-500" />
            <h4 className="text-sm font-bold text-slate-900">Confidence and Evidence</h4>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Risk Tier</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses(riskTier?.tier || 'routine')}`}>
                  {formatPriority(riskTier?.tier || 'unknown')}
                </span>
                {typeof riskTier?.compositeScore === 'number' && (
                  <span className="text-sm font-bold text-slate-900">{Math.round(riskTier.compositeScore * 100)}%</span>
                )}
              </div>
              {Array.isArray(riskTier?.contributingFactors) && riskTier.contributingFactors.length > 0 && (
                <p className="mt-2 text-xs text-slate-600">
                  Drivers: {riskTier.contributingFactors.slice(0, 3).join(', ')}
                </p>
              )}
              <ExplainabilityMeta
                aiMetadata={riskTier?.aiMetadata}
                confidence={typeof riskTier?.compositeScore === 'number' ? riskTier.compositeScore : null}
                extra={
                  <>
                    {Array.isArray(riskTier?.recommendedActions) && riskTier.recommendedActions.length > 0 && (
                      <span>{riskTier.recommendedActions.length} recommended actions</span>
                    )}
                    {riskTier?.validUntil && <span>Review by {formatDateTimeToDDMMYYYYHHMM(riskTier.validUntil)}</span>}
                  </>
                }
              />
            </div>

            <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Proactive Snapshot</p>
              <p className="mt-2 text-sm text-slate-700">
                {snapshot?.clinicalSummary || 'No proactive summary available yet.'}
              </p>
              {(snapshot?.news2Score !== null || snapshot?.qsofaScore !== null) && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                  {snapshot?.news2Score !== null && <span>NEWS2 {snapshot.news2Score}</span>}
                  {snapshot?.qsofaScore !== null && <span>qSOFA {snapshot.qsofaScore}</span>}
                </div>
              )}
              <ExplainabilityMeta
                aiMetadata={snapshot?.aiMetadata}
                extra={
                  Array.isArray(snapshot?.activeFlags) && snapshot.activeFlags.length > 0
                    ? <span>Why now: {snapshot.activeFlags.slice(0, 3).join(', ')}</span>
                    : undefined
                }
              />
            </div>

            <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Encounter Copilot</p>
              {encounterCopilot ? (
                <>
                  <p className="mt-2 text-sm text-slate-700">{encounterCopilot.summary || 'Encounter copilot session available.'}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span>{(encounterCopilot.suggestedOrders || []).length} suggested orders</span>
                    <span>{(encounterCopilot.resultFollowupTasks || []).length} result follow-ups</span>
                  </div>
                  <ExplainabilityMeta
                    aiMetadata={encounterCopilot?.aiMetadata}
                    confidence={encounterCopilot?.confidenceScore}
                    extra={
                      Array.isArray(encounterCopilot?.likelyCareGaps) && encounterCopilot.likelyCareGaps.length > 0
                        ? <span>Why now: {encounterCopilot.likelyCareGaps.slice(0, 2).map((gap: any) => gap?.title || gap?.gapType || 'care gap').join(', ')}</span>
                        : undefined
                    }
                  />
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No encounter copilot session found yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h4 className="text-sm font-bold text-slate-900">Active Alerts</h4>
          </div>
          {alerts.length === 0 ? (
            <EmptyState title="No active alerts" subtitle="Nothing new is actively escalated right now." />
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 3).map((alert: any) => (
                <div key={alert.id} className="rounded-xl border border-slate-100 bg-white px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityClasses(alert.severity)}`}>
                      {formatPriority(alert.severity)}
                    </span>
                    <p className="text-xs font-semibold text-slate-900">{alert.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{alert.message}</p>
                  {(alert.guidelineReference || typeof alert.confidenceScore === 'number') && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      {typeof alert.confidenceScore === 'number' && <span>{Math.round(alert.confidenceScore * 100)}% confidence</span>}
                      {alert.guidelineReference && <span>Evidence {alert.guidelineReference}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4 text-indigo-500" />
            <h4 className="text-sm font-bold text-slate-900">Care Gaps</h4>
          </div>
          {careGaps.length === 0 ? (
            <EmptyState title="No open gaps" subtitle="The nightly gap engine found nothing outstanding." />
          ) : (
            <div className="space-y-2">
              {careGaps.slice(0, 3).map((gap: any) => (
                <div key={gap.id} className="rounded-xl border border-slate-100 bg-white px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityClasses(gap.priority)}`}>
                      {formatPriority(gap.priority)}
                    </span>
                    <p className="text-xs font-semibold text-slate-900 capitalize">
                      {String(gap.gapType || 'care gap').replace(/_/g, ' ')}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{gap.gapDescription}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="w-4 h-4 text-rose-500" />
            <h4 className="text-sm font-bold text-slate-900">Radiology AI</h4>
          </div>
          {radiology?.findings?.length === 0 ? (
            <EmptyState title="No radiology AI findings" subtitle="No recent AI imaging findings were found for this patient." />
          ) : (
            <div className="space-y-2">
              {radiology.findings.map((finding: any) => (
                <div key={finding.id} className="rounded-xl border border-slate-100 bg-white px-3 py-3">
                  <div className="flex items-center gap-2">
                    {finding.critical ? (
                      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        Critical
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        Review
                      </span>
                    )}
                    <p className="text-xs font-semibold text-slate-900">{finding.topFinding}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {finding.modality} · {Math.round((finding.overallConfidence || 0) * 100)}% confidence
                  </p>
                  <ExplainabilityMeta
                    aiMetadata={finding?.aiMetadata || radiology?.aiMetadata}
                    extra={<span>{finding.radiologistReviewed ? 'Radiologist reviewed' : 'Pending radiologist review'}</span>}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <h4 className="text-sm font-bold text-slate-900">Follow-Through</h4>
          </div>
          {postVisitFollowups.length === 0 ? (
            <EmptyState title="No post-visit follow-ups" subtitle="There are no active post-visit AI follow-up tasks right now." />
          ) : (
            <div className="space-y-2">
              {postVisitFollowups.slice(0, 3).map((followup: any) => (
                <div key={followup.id} className="rounded-xl border border-slate-100 bg-white px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityClasses(followup.riskLevel)}`}>
                      {formatPriority(followup.riskLevel)}
                    </span>
                    <p className="text-xs font-semibold text-slate-900">Post-visit follow-up</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{followup.nextAction}</p>
                  {followup.unresolvedQuestion && (
                    <p className="mt-2 text-[11px] text-slate-500">
                      Open question: {followup.unresolvedQuestion}
                    </p>
                  )}
                  {followup.dueAt && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Next touch: {formatDateTimeToDDMMYYYYHHMM(followup.dueAt)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientIntelligenceWorkspace;
