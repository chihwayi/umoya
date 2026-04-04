import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  ListFilter,
  Loader2,
  ShieldAlert,
  Tag,
  BookOpen,
  CheckCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import { ehrApi, cdssApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { GuidelineSearchPanel } from './GuidelineSearchPanel';
import {
  formatDateTimeToDDMMYYYYHHMM,
  formatDateToDDMMYYYY,
} from '../utils/dateFormatting';

type ReportSeverity = 'benign' | 'minor' | 'moderate' | 'significant' | 'critical';

const REPORT_SEVERITY_META: Record<ReportSeverity, { label: string; className: string }> = {
  benign: { label: 'Benign / Normal', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  minor: { label: 'Minor Finding', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  moderate: { label: 'Moderate Concern', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  significant: { label: 'Significant Finding', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  critical: { label: 'Critical / Emergent', className: 'bg-red-100 text-red-700 border-red-200 animate-pulse' },
};

interface StructuredFindingSummary {
  region?: string;
  finding?: string;
  significance?: string;
  recommendation?: string;
}

type WorkflowStatus =
  | 'awaiting_payment'
  | 'awaiting_study'
  | 'scheduled'
  | 'in_progress'
  | 'awaiting_report'
  | 'reporting'
  | 'awaiting_acknowledgement'
  | 'acknowledged'
  | 'cancelled';

interface DoctorImagingResult {
  order: {
    id: string;
    number: string;
    priority: string;
    status: string;
    payment_status?: string;
    finance_transaction_id?: string | null;
    fee_amount?: number | null;
    ordered_at: string;
    clinical_indication?: string;
    clinical_history?: string;
    suspected_diagnosis?: string;
    study_type_id: string;
    study_name: string;
    study_code?: string;
    body_part?: string;
    modality_name?: string;
    modality_code?: string;
  };
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    patient_number?: string;
    date_of_birth?: string;
    gender?: string;
  };
  study: {
    id: string;
    status: string;
    study_date?: string;
    study_time?: string;
    created_at?: string;
    updated_at?: string;
    radiologist_assigned?: string;
    technologist?: string;
  } | null;
  report: {
    id: string;
    status: string;
    is_critical: boolean;
    signed_at?: string;
    created_at?: string;
    updated_at?: string;
    drafted_by?: string;
    signed_by?: string;
    severity?: ReportSeverity;
    follow_up_recommended?: boolean;
    follow_up_interval?: string;
    coded_diagnoses?: string[];
    structured_findings?: StructuredFindingSummary[] | Record<string, any>;
  } | null;
  acknowledgement: {
    id: string;
    acknowledged_at: string;
    notes?: string;
  } | null;
  workflow_status: WorkflowStatus;
  is_action_required: boolean;
}

interface DoctorImagingResultsResponse {
  results: DoctorImagingResult[];
  counts: {
    total: number;
    awaiting_payment: number;
    pending: number;
    awaiting_ack: number;
    completed: number;
    critical: number;
    cancelled: number;
  };
}

type FilterValue = 'pending' | 'awaiting_payment' | 'awaiting_ack' | 'completed' | 'critical' | 'all' | 'recent';

interface DoctorImagingResultsPanelProps {
  tenantSlug: string;
  token: string;
  patientId?: string;
  statusFilter?: FilterValue;
  onOpenStudy?: (studyId: string) => void;
  hideTabs?: boolean;
  compact?: boolean;
  title?: string;
}

const STATUS_META: Record<
  WorkflowStatus,
  { label: string; className: string }
> = {
  awaiting_payment: {
    label: 'Awaiting Payment',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  awaiting_study: {
    label: 'Awaiting Study',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  awaiting_report: {
    label: 'Awaiting Report',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  reporting: {
    label: 'Reporting',
    className: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  awaiting_acknowledgement: {
    label: 'Action Required',
    className: 'bg-red-100 text-red-700 border-red-200 animate-pulse',
  },
  acknowledged: {
    label: 'Acknowledged',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-slate-200 text-slate-600 border-slate-300',
  },
};

const PRIORITY_META: Record<
  string,
  { label: string; className: string }
> = {
  stat: {
    label: 'STAT',
    className: 'bg-red-100 text-red-700 border-red-200 animate-pulse',
  },
  urgent: {
    label: 'Urgent',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  routine: {
    label: 'Routine',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
};

const FILTER_OPTIONS: { key: FilterValue; label: string }[] = [
  { key: 'awaiting_payment', label: 'Awaiting Payment' },
  { key: 'pending', label: 'In Progress' },
  { key: 'awaiting_ack', label: 'Needs Acknowledgement' },
  { key: 'critical', label: 'Critical' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
];

const DoctorImagingResultsPanel: React.FC<DoctorImagingResultsPanelProps> = ({
  tenantSlug,
  token,
  patientId,
  statusFilter,
  onOpenStudy,
  hideTabs = false,
  compact = false,
  title,
}) => {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DoctorImagingResult[]>([]);
  const [counts, setCounts] = useState<DoctorImagingResultsResponse['counts']>({
    total: 0,
    awaiting_payment: 0,
    pending: 0,
    awaiting_ack: 0,
    completed: 0,
    critical: 0,
    cancelled: 0,
  });
  const [internalFilter, setInternalFilter] = useState<FilterValue>('pending');
  const appliedFilter = statusFilter ?? internalFilter;
  const [ackTarget, setAckTarget] = useState<DoctorImagingResult | null>(null);
  const [ackNotes, setAckNotes] = useState('');
  const [ackSubmitting, setAckSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // CDSS Guideline Search State
  const [showGuidelineSearch, setShowGuidelineSearch] = useState(false);

  const renderSeverityBadge = (severity?: string | null) => {
    if (!severity) return null;
    const key = severity.toLowerCase() as ReportSeverity;
    const meta = REPORT_SEVERITY_META[key];
    if (!meta) return null;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full border ${meta.className}`}
      >
        <ShieldAlert className="w-3 h-3" />
        {meta.label}
      </span>
    );
  };

  const normalizeStructuredFindings = (raw: any): StructuredFindingSummary[] => {
    if (!raw) return [];
    let parsed = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        return [];
      }
    }
    if (Array.isArray(parsed)) {
      return parsed as StructuredFindingSummary[];
    }
    if (parsed && typeof parsed === 'object') {
      return Object.keys(parsed).map((key) => ({
        region: key,
        finding: parsed[key]?.finding || '',
        significance: parsed[key]?.significance || '',
        recommendation: parsed[key]?.recommendation || '',
      }));
    }
    return [];
  };

  useEffect(() => {
    if (statusFilter) {
      setInternalFilter(statusFilter);
    }
  }, [statusFilter]);

  const loadResults = async () => {
    if (!tenantSlug || !token) return;

    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (appliedFilter && appliedFilter !== 'all') {
        params.status = appliedFilter;
      }
      if (patientId) {
        params.patient_id = patientId;
      }

      const { data } = await ehrApi.getDoctorImagingResults(
        tenantSlug,
        token,
        params,
      );

      setResults((data?.results as DoctorImagingResult[]) || []);
      setCounts(
        data?.counts || {
          total: 0,
          awaiting_payment: 0,
          pending: 0,
          awaiting_ack: 0,
          completed: 0,
          critical: 0,
          cancelled: 0,
        },
      );
    } catch (error) {
      console.error('Failed to load doctor imaging results', error);
      showError('Failed to load imaging results', error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, token, appliedFilter, patientId]);

  const handleAcknowledge = async () => {
    if (!ackTarget?.report?.id) return;
    try {
      setAckSubmitting(true);
      await ehrApi.acknowledgeImagingReport(tenantSlug, token, ackTarget.report.id, {
        acknowledgment_notes: ackNotes || undefined,
      });
      showSuccess('Report acknowledged', 'The imaging report has been acknowledged successfully');
      setAckTarget(null);
      setAckNotes('');
      await loadResults();
    } catch (error) {
      console.error('Failed to acknowledge imaging report', error);
      showError('Failed to acknowledge imaging report', error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setAckSubmitting(false);
    }
  };

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total Orders',
        value: counts.total,
        icon: Camera,
        color: 'text-slate-700',
        border: 'border-slate-300',
      },
      {
        label: 'Awaiting Payment',
        value: counts.awaiting_payment,
        icon: CreditCard,
        color: 'text-amber-600',
        border: 'border-amber-300',
      },
      {
        label: 'In Progress',
        value: counts.pending,
        icon: Clock,
        color: 'text-blue-600',
        border: 'border-blue-300',
      },
      {
        label: 'Needs Ack',
        value: counts.awaiting_ack,
        icon: AlertTriangle,
        color: 'text-red-600',
        border: 'border-red-300',
      },
      {
        label: 'Completed',
        value: counts.completed,
        icon: CheckCircle2,
        color: 'text-emerald-600',
        border: 'border-emerald-300',
      },
    ],
    [counts],
  );

  const renderPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    const meta =
      PRIORITY_META[priority.toLowerCase()] ??
      PRIORITY_META.routine;
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full border ${meta.className}`}
      >
        {meta.label}
      </span>
    );
  };

  const renderStatusBadge = (status: WorkflowStatus) => {
    const meta = STATUS_META[status];
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full border ${meta.className}`}
      >
        {meta.label}
      </span>
    );
  };

  const renderReportBadge = (result: DoctorImagingResult) => {
    if (!result.report) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          No Report Yet
        </span>
      );
    }

    if (result.report.is_critical && !result.acknowledgement) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700 border border-red-200">
          <Sparkles className="w-3 h-3" />
          Critical Finding
        </span>
      );
    }

    if (result.acknowledgement) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Acknowledged
        </span>
      );
    }

    if (result.report.status === 'final') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-sky-100 text-sky-700 border border-sky-200">
          <FileText className="w-3 h-3" />
          Final Report
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200">
        <FileText className="w-3 h-3" />
        Drafting
      </span>
    );
  };


  const getFilterCount = (key: FilterValue) => {
    switch (key) {
      case 'awaiting_payment':
        return counts.awaiting_payment;
      case 'pending':
        return counts.pending;
      case 'awaiting_ack':
        return counts.awaiting_ack;
      case 'completed':
        return counts.completed;
      case 'critical':
        return counts.critical;
      case 'all':
      default:
        return counts.total;
    }
  };

  const filteredResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return results;
    return results.filter((result) => {
      const haystack = [
        result.patient.full_name,
        result.patient.patient_number,
        result.order.study_name,
        result.order.modality_code,
        result.order.body_part,
        result.order.clinical_indication,
        result.order.suspected_diagnosis,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return haystack.includes(term);
    });
  }, [results, searchTerm]);

  const toggleCardExpansion = (cardKey: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [cardKey]: !prev[cardKey],
    }));
  };

  return (
    <div
      className={`bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl ${
        compact ? 'p-4' : 'p-6'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 rounded-2xl px-5 py-3 border border-violet-200/50">
          <h3 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
            <Camera className="w-6 h-6 text-violet-600" />
            <span>{title || 'Imaging Results'}</span>
          </h3>
          <p className="text-sm text-purple-700 font-medium mt-1 ml-8">
            Track imaging orders, reports, and acknowledgements
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGuidelineSearch(!showGuidelineSearch)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              showGuidelineSearch 
                ? 'bg-violet-500/20 text-violet-700 border-violet-500/30' 
                : 'bg-white text-slate-500 border-slate-200 hover:text-violet-600 hover:border-violet-200'
            }`}
          >
            <Search size={14} />
            {showGuidelineSearch ? 'Hide Guidelines' : 'Imaging Guidelines'}
          </button>

          {!hideTabs && (
            <div className="flex flex-wrap items-center gap-2">
              {FILTER_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setInternalFilter(key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    appliedFilter === key
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  disabled={!!statusFilter}
                >
                  <span>{label}</span>
                  <span className="ml-1.5 opacity-80">({getFilterCount(key)})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search patient, study, modality, or indication…"
            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600">
          <ListFilter className="w-3.5 h-3.5" />
          {filteredResults.length} match{filteredResults.length === 1 ? '' : 'es'}
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
          {summaryCards.map((card, index) => (
            <div
              key={index}
              className={`p-4 rounded-xl border ${card.border} bg-white/70 flex items-center justify-between`}
            >
              <div>
                <p className="text-xs uppercase text-slate-500">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {card.value}
                </p>
              </div>
              <card.icon className={`w-8 h-8 ${card.color}`} />
            </div>
          ))}
        </div>
      )}

      {showGuidelineSearch && (
        <div className="mb-6 bg-violet-50/50 rounded-xl p-4 border border-violet-100">
          <GuidelineSearchPanel
            searchFn={(q) => cdssApi.searchGuidelines(q, token!, tenantSlug!)}
            contextLabel="Imaging"
          />
        </div>
      )}


      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl border border-slate-200">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
            <p className="text-sm text-slate-600">Loading imaging results…</p>
          </div>
        )}

        <div className="space-y-3">
          {!loading && filteredResults.length === 0 && (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
              <Camera className="w-10 h-10 mx-auto mb-3 text-slate-400" />
              <p className="font-medium">No imaging results to display</p>
              <p className="text-sm">
                {searchTerm.trim()
                  ? 'No records match your search. Try a broader keyword.'
                  : 'Orders will appear here as soon as imaging is requested.'}
              </p>
            </div>
          )}

          {!loading &&
            filteredResults.map((result) => {
              const structuredFindings = normalizeStructuredFindings(result.report?.structured_findings);
              const codedDiagnoses = Array.isArray(result.report?.coded_diagnoses)
                ? (result.report?.coded_diagnoses as string[])
                : [];
              const followUpRecommended = Boolean(result.report?.follow_up_recommended);
              const cardKey = `${result.order.id}-${result.study?.id || 'no-study'}`;
              const isExpanded = Boolean(expandedCards[cardKey]);
              return (
              <div
                key={cardKey}
                className="border border-slate-200 rounded-xl p-4 bg-white/90 shadow-sm hover:shadow transition-shadow"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold text-slate-900">
                        {result.patient.full_name || 'Unnamed Patient'}
                      </h4>
                      {result.patient.patient_number && (
                        <span className="text-xs text-slate-500 font-mono">
                          #{result.patient.patient_number}
                        </span>
                      )}
                      {renderPriorityBadge(result.order.priority)}
                      {renderStatusBadge(result.workflow_status)}
                      {renderReportBadge(result)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <span className="font-medium">
                        {result.order.study_name}
                      </span>
                      {result.order.modality_code && (
                        <>
                          <span>•</span>
                          <span>{result.order.modality_code}</span>
                        </>
                      )}
                      {result.order.body_part && (
                        <>
                          <span>•</span>
                          <span>{result.order.body_part}</span>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      Ordered {formatDateTimeToDDMMYYYYHHMM(result.order.ordered_at)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {result.report?.status === 'final' &&
                      !result.acknowledgement && (
                        <button
                          onClick={() => {
                            setAckTarget(result);
                            setAckNotes('');
                          }}
                          className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}

                    {result.study?.id && (
                      <button
                        onClick={() => onOpenStudy?.(result.study!.id)}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        View Study
                      </button>
                    )}
                    <button
                      onClick={() => toggleCardExpansion(cardKey)}
                      className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          Show Details
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {result.workflow_status === 'awaiting_payment' && (
                  <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm flex gap-2">
                    <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Awaiting payment confirmation</p>
                      <p>
                        Please direct the patient to Accounts to settle this imaging order before it can be scheduled or performed.
                      </p>
                      {typeof result.order.fee_amount === 'number' && result.order.fee_amount > 0 && (
                        <p className="mt-1">
                          Estimated charge:{' '}
                          <span className="font-semibold">
                            ${result.order.fee_amount.toFixed(2)}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-sm text-slate-600 mb-3">
                  <span className="font-semibold text-slate-700 mr-2">Indication:</span>
                  <span>{result.order.clinical_indication || 'N/A'}</span>
                </div>

                {isExpanded && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-700">
                      Clinical Indication
                    </p>
                    <p className="bg-slate-100 rounded-lg p-2 border border-slate-200">
                      {result.order.clinical_indication || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-700">
                      Suspected Diagnosis
                    </p>
                    <p className="bg-slate-100 rounded-lg p-2 border border-slate-200">
                      {result.order.suspected_diagnosis || 'N/A'}
                    </p>
                  </div>

                  {result.report?.status === 'final' && (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-700">
                        Report Signed
                      </p>
                      <p>
                        {result.report.signed_at
                          ? formatDateTimeToDDMMYYYYHHMM(result.report.signed_at)
                          : 'Awaiting signature'}
                      </p>
                    </div>
                  )}

                  {result.study?.study_date && (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-700">
                        Study Performed
                      </p>
                      <p>
                        {formatDateToDDMMYYYY(result.study.study_date)}{' '}
                        {result.study.study_time?.slice(0, 5)}
                      </p>
                    </div>
                  )}

                  {result.acknowledgement && (
                    <div className="space-y-1 md:col-span-2">
                      <p className="font-semibold text-slate-700">
                        Acknowledged
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <span>
                          {formatDateTimeToDDMMYYYYHHMM(
                            result.acknowledgement.acknowledged_at,
                          )}
                        </span>
                        {result.acknowledgement.notes && (
                          <span className="px-2 py-1 text-xs rounded bg-slate-100 border border-slate-200">
                            Notes: {result.acknowledgement.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {result.report?.severity && (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-700">Radiologist Severity</p>
                      {renderSeverityBadge(result.report.severity)}
                    </div>
                  )}

                  {codedDiagnoses.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-700">Coded Diagnoses</p>
                      <div className="flex flex-wrap gap-2">
                        {codedDiagnoses.map((code) => (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200"
                          >
                            <Tag className="w-3 h-3" />
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {followUpRecommended && (
                    <div className="space-y-1 md:col-span-2">
                      <p className="font-semibold text-slate-700">Follow-up Plan</p>
                      <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
                        <Clock className="w-4 h-4" />
                        <div>
                          <p>Follow-up required</p>
                          {result.report?.follow_up_interval && (
                            <p className="text-xs text-orange-600">
                              Suggested interval: {result.report.follow_up_interval}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {structuredFindings.length > 0 && (
                    <div className="space-y-1 md:col-span-2">
                      <p className="font-semibold text-slate-700">Structured Findings</p>
                      <div className="space-y-2">
                        {structuredFindings.map((finding, index) => (
                          <div
                            key={`${finding.region || 'finding'}-${index}`}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                              <span className="font-semibold">
                                {finding.region || 'Unspecified region'}
                              </span>
                              {renderSeverityBadge(finding.significance)}
                            </div>
                            <p>{finding.finding || 'No narrative provided.'}</p>
                            {finding.recommendation && (
                              <p className="mt-1 text-xs text-slate-500">
                                Recommendation: {finding.recommendation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {ackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-xl font-semibold text-slate-900">
                  Acknowledge Imaging Report
                </h4>
                <p className="text-sm text-slate-600">
                  Confirm that you have reviewed the radiologist&apos;s final
                  report for{' '}
                  <span className="font-semibold">
                    {ackTarget.patient.full_name}
                  </span>
                  .
                </p>
              </div>
              <button
                onClick={() => {
                  if (!ackSubmitting) {
                    setAckTarget(null);
                    setAckNotes('');
                  }
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm text-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold">
                  {ackTarget.order.study_name}
                </span>
              </div>
              <div className="text-slate-600">
                Signed:{' '}
                {ackTarget.report?.signed_at
                  ? formatDateTimeToDDMMYYYYHHMM(ackTarget.report.signed_at)
                  : 'Awaiting signature'}
              </div>
              {ackTarget.report?.is_critical && (
                <div className="inline-flex items-center gap-2 text-red-600 font-semibold">
                  <Sparkles className="w-4 h-4" />
                  Critical finding flagged by radiology
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Optional acknowledgement notes
              </label>
              <textarea
                value={ackNotes}
                onChange={(event) => setAckNotes(event.target.value)}
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="Document any follow-up actions or communication…"
                disabled={ackSubmitting}
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  if (!ackSubmitting) {
                    setAckTarget(null);
                    setAckNotes('');
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                disabled={ackSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledge}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={ackSubmitting}
              >
                {ackSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm Reviewed
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorImagingResultsPanel;

