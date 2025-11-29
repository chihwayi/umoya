import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Beaker,
  Calendar,
  ClipboardList,
  Crosshair,
  Droplet,
  FlaskConical,
  HeartPulse,
  Layers,
  LineChart,
  Stethoscope,
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  description?: string;
  category: TimelineCategory;
  context?: Record<string, any>;
};

type TimelineCategory =
  | 'diagnosis'
  | 'staging'
  | 'regimen'
  | 'infusion'
  | 'response'
  | 'survivorship'
  | 'trial'
  | 'pro'
  | 'adverse'
  | 'tumor';

type OncologyTimelineProps = {
  tenantSlug: string;
  token: string;
  caseId: string;
  caseDetail?: {
    case: Record<string, any>;
    stagingEntries: any[];
    regimens: any[];
    infusionSessions: any[];
    adverseEvents: any[];
    tumorBoardRecommendations: any[];
  } | null;
};

type ResponseHistoryRecord = {
  id: string;
  assessment_date: string;
  assessment_type: string;
  recist_response?: string;
  best_overall_response?: string;
  target_lesions_size_cm?: number;
};

const CATEGORY_META: Record<
  TimelineCategory,
  { label: string; color: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  diagnosis: { label: 'Diagnosis', color: 'from-rose-500 to-rose-600', icon: Stethoscope },
  staging: { label: 'Staging', color: 'from-fuchsia-500 to-purple-500', icon: Layers },
  regimen: { label: 'Regimen', color: 'from-emerald-500 to-emerald-600', icon: FlaskConical },
  infusion: { label: 'Infusion', color: 'from-sky-500 to-cyan-500', icon: Droplet },
  response: { label: 'Response', color: 'from-indigo-500 to-blue-600', icon: LineChart },
  survivorship: { label: 'Survivorship', color: 'from-amber-500 to-orange-500', icon: HeartPulse },
  trial: { label: 'Clinical Trial', color: 'from-pink-500 to-rose-500', icon: Beaker },
  pro: { label: 'Patient Reported Outcome', color: 'from-lime-500 to-emerald-500', icon: Activity },
  adverse: { label: 'Adverse Event', color: 'from-red-500 to-rose-600', icon: AlertTriangle },
  tumor: { label: 'Tumor Board', color: 'from-slate-500 to-slate-600', icon: ClipboardList },
};

const OncologyTimeline: React.FC<OncologyTimelineProps> = ({ tenantSlug, token, caseId, caseDetail }) => {
  const { showError } = useNotification();
  const [responseHistory, setResponseHistory] = useState<ResponseHistoryRecord[]>([]);
  const [survivorshipPlan, setSurvivorshipPlan] = useState<any | null>(null);
  const [clinicalTrials, setClinicalTrials] = useState<any[]>([]);
  const [pros, setPros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Record<TimelineCategory, boolean>>({
    diagnosis: true,
    staging: true,
    regimen: true,
    infusion: true,
    response: true,
    survivorship: true,
    trial: true,
    pro: true,
    adverse: true,
    tumor: true,
  });

  const ensureAuth = tenantSlug && token && caseId;

  const loadTimelineData = useCallback(async () => {
    if (!ensureAuth) {
      return;
    }
    setLoading(true);
    try {
      const [responseResp, survivorshipResp, trialsResp, prosResp] = await Promise.all([
        ehrApi.getOncologyResponseAssessments(tenantSlug, token, caseId),
        ehrApi.getOncologySurvivorshipPlan(tenantSlug, token, caseId).catch(() => ({ data: null })),
        ehrApi.getOncologyClinicalTrials(tenantSlug, token, caseId),
        ehrApi.getOncologyPROHistory(tenantSlug, token, caseId),
      ]);
      setResponseHistory(Array.isArray(responseResp.data) ? responseResp.data : []);
      setSurvivorshipPlan(survivorshipResp.data ?? null);
      setClinicalTrials(Array.isArray(trialsResp.data) ? trialsResp.data : []);
      setPros(Array.isArray(prosResp.data) ? prosResp.data : []);
    } catch (error) {
      console.error('Failed to load timeline data', error);
      showError('Unable to load oncology timeline', 'Please try again shortly.');
    } finally {
      setLoading(false);
    }
  }, [caseId, ensureAuth, showError, tenantSlug, token]);

  useEffect(() => {
    loadTimelineData();
  }, [loadTimelineData]);

  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];
    if (caseDetail?.case?.diagnosis_date) {
      events.push({
        id: `${caseId}-diagnosis`,
        date: caseDetail.case.diagnosis_date,
        title: `Diagnosis: ${caseDetail.case.primary_diagnosis ?? 'Primary cancer'}`,
        description: `Overall stage: ${caseDetail.case.overall_stage ?? '—'}`,
        category: 'diagnosis',
      });
    }

    (caseDetail?.stagingEntries ?? []).forEach((entry) => {
      if (!entry.stage_date) return;
      events.push({
        id: entry.id,
        date: entry.stage_date,
        title: `Staging (${entry.staging_system ?? 'TNM'})`,
        description: `T${entry.t_stage ?? '—'} N${entry.n_stage ?? '—'} M${entry.m_stage ?? '—'} • Overall ${entry.overall_stage ?? '—'}`,
        category: 'staging',
      });
    });

    (caseDetail?.regimens ?? []).forEach((regimen) => {
      if (regimen.start_date) {
        events.push({
          id: `${regimen.id}-start`,
          date: regimen.start_date,
          title: `Started regimen: ${regimen.regimen_name}`,
          description: `${regimen.intent ?? 'Therapy'} • ${regimen.line_of_therapy ?? 'Line ?'}`,
          category: 'regimen',
        });
      }
      if (regimen.end_date) {
        events.push({
          id: `${regimen.id}-end`,
          date: regimen.end_date,
          title: `Completed regimen: ${regimen.regimen_name}`,
          description: `${regimen.completed_sessions ?? 0} sessions completed`,
          category: 'regimen',
        });
      }
    });

    (caseDetail?.infusionSessions ?? []).forEach((session) => {
      if (!session.session_date) return;
      events.push({
        id: session.id,
        date: session.session_date,
        title: `Infusion Cycle ${session.cycle_number ?? '—'}`,
        description: `${session.location ?? 'Infusion center'} • Status ${String(session.status ?? 'scheduled').replace(/_/g, ' ')}`,
        category: 'infusion',
      });
    });

    responseHistory.forEach((assessment) => {
      if (!assessment.assessment_date) return;
      events.push({
        id: assessment.id,
        date: assessment.assessment_date,
        title: `Response (${assessment.assessment_type})`,
        description: `RECIST: ${assessment.recist_response ?? 'NE'} • Sum diameters ${assessment.target_lesions_size_cm ?? '—'} cm`,
        category: 'response',
        context: assessment,
      });
    });

    if (survivorshipPlan?.follow_up_schedule?.visits?.length) {
      const planStart = survivorshipPlan.treatment_completion_date || caseDetail?.case?.diagnosis_date;
      if (planStart) {
        survivorshipPlan.follow_up_schedule.visits.forEach((visit: any, index: number) => {
          const dueDate = visit.initial_date ?? survivorshipPlan.treatment_completion_date;
          if (!dueDate) {
            return;
          }
          events.push({
            id: `${survivorshipPlan.id}-visit-${index}`,
            date: dueDate,
            title: 'Follow-up milestone',
            description: `Tests: ${(visit.tests ?? []).join(', ') || 'Review plan'} • Interval ${visit.interval_months ?? '?'} mo`,
            category: 'survivorship',
          });
        });
      }
    }

    clinicalTrials.forEach((trial) => {
      if (trial.enrollment_date) {
        events.push({
          id: trial.id,
          date: trial.enrollment_date,
          title: `Trial enrollment: ${trial.trial_name}`,
          description: `Status ${trial.enrollment_status} • Phase ${trial.trial_phase ?? '—'}`,
          category: 'trial',
        });
      }
    });

    pros.forEach((record) => {
      if (!record.assessment_date) return;
      events.push({
        id: record.id,
        date: record.assessment_date,
        title: `PRO: ${record.assessment_type}`,
        description: `Total score ${record.total_score ?? 'pending'}`,
        category: 'pro',
      });
    });

    (caseDetail?.adverseEvents ?? []).forEach((event) => {
      if (!event.event_date) return;
      events.push({
        id: event.id,
        date: event.event_date,
        title: `Adverse event: ${event.event_type}`,
        description: `Grade ${event.grade ?? '—'} • Outcome ${event.outcome ?? '—'}`,
        category: 'adverse',
      });
    });

    (caseDetail?.tumorBoardRecommendations ?? []).forEach((rec) => {
      if (!rec.meeting_date) return;
      events.push({
        id: rec.id,
        date: rec.meeting_date,
        title: `Tumor board: ${rec.recommendation}`,
        description: rec.status ? `Status ${rec.status}` : undefined,
        category: 'tumor',
      });
    });

    return events
      .filter((event) => event.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [caseDetail, caseId, clinicalTrials, pros, responseHistory, survivorshipPlan]);

  const filteredEvents = timelineEvents.filter((event) => filters[event.category]);

  const handleToggleFilter = (category: TimelineCategory) => {
    setFilters((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-500" />
            Precision Care Timeline
          </p>
          <p className="text-xs text-slate-500">
            Diagnosis through survivorship milestones with RECIST, trials, and toxicity signals.
          </p>
        </div>
        <button
          onClick={loadTimelineData}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh data'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-3">
        {(Object.keys(CATEGORY_META) as TimelineCategory[]).map((category) => {
          const meta = CATEGORY_META[category];
          const Icon = meta.icon;
          const active = filters[category];
          return (
            <button
              key={category}
              onClick={() => handleToggleFilter(category)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                active
                  ? 'border-transparent bg-slate-900 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={14} />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="relative px-4 pb-6">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-200 via-slate-200 to-slate-50" />
        <div className="space-y-4">
          {filteredEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-slate-500">
              <Crosshair className="h-6 w-6 mb-2 text-slate-400" />
              No events for the current filters.
            </div>
          )}
          {filteredEvents.map((event) => {
            const meta = CATEGORY_META[event.category];
            const Icon = meta.icon;
            const date = new Date(event.date);
            const dateLabel = Number.isNaN(date.getTime())
              ? event.date
              : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            return (
              <div key={`${event.category}-${event.id}`} className="relative flex items-start gap-4 pl-6">
                <div className="absolute left-3 mt-2 h-3 w-3 rounded-full border-4 border-white bg-gradient-to-br from-indigo-400 to-indigo-600 shadow" />
                <div
                  className={`rounded-2xl border border-slate-100 bg-gradient-to-br ${meta.color} text-white shadow-sm shadow-slate-300/30 w-32 text-center py-2 text-xs font-semibold`}
                >
                  {dateLabel}
                </div>
                <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/5 text-slate-700">
                      <Icon size={18} />
                    </span>
                    {event.title}
                  </div>
                  {event.description && <p className="mt-1 text-sm text-slate-500">{event.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OncologyTimeline;



