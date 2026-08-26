import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSignature,
  Loader2,
  NotebookPen,
  PenSquare,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';

interface ImagingReportComposerProps {
  tenantSlug: string;
  token: string;
  study: any;
  currentUser?: { id: string; role: string } | null;
  onRefresh?: () => Promise<void> | void;
}

interface ReportTemplate {
  id: string;
  template_name: string;
  template_code: string;
  technique_template?: string;
  findings_template?: string;
  impression_template?: string;
}

interface ReportDraftArtifact {
  id: string;
  draftFindings: string;
  draftImpression: string;
  draftRecommendations?: string | null;
  structuredDraft?: {
    structured_findings?: StructuredFinding[];
  };
  supportingEvidence?: Array<{ type?: string; message?: string; label?: string; region?: string }>;
}

interface ReportDiscrepancyReview {
  id: string;
  discrepancyStatus: string;
  reviewStatus?: string;
  resolutionNotes?: string | null;
  rationale: string;
  discrepancySummary?: {
    matchedAiLabels?: string[];
    unmatchedAiLabels?: string[];
  };
}

interface IncidentalFindingFollowupArtifact {
  id: string;
  status: string;
  severity: string;
  title: string;
  summary: string;
  resolutionNotes?: string | null;
  recommendedAction?: string | null;
}

type ReportSeverity = 'benign' | 'minor' | 'moderate' | 'significant' | 'critical';

interface StructuredFinding {
  id: string;
  region: string;
  finding: string;
  significance: ReportSeverity;
  recommendation?: string;
}

type ReportState = {
  clinical_history: string;
  technique: string;
  findings: string;
  impression: string;
  recommendations: string;
  comparison_studies: string;
  critical_findings: string;
  is_critical: boolean;
  severity: ReportSeverity | '';
  follow_up_recommended: boolean;
  follow_up_interval: string;
  coded_diagnoses: SnomedConcept[];
  structured_findings: StructuredFinding[];
};

const SEVERITY_META: Record<ReportSeverity, { label: string; className: string }> = {
  benign: { label: 'Benign / Normal', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  minor: { label: 'Minor Finding', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  moderate: { label: 'Moderate Concern', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  significant: { label: 'Significant Finding', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  critical: { label: 'Critical / Emergent', className: 'bg-red-100 text-red-700 border-red-200 animate-pulse' },
};

const SEVERITY_OPTIONS: { value: ReportSeverity; label: string }[] = [
  { value: 'benign', label: 'Benign / Normal' },
  { value: 'minor', label: 'Minor Finding' },
  { value: 'moderate', label: 'Moderate Concern' },
  { value: 'significant', label: 'Significant Finding' },
  { value: 'critical', label: 'Critical / Emergent' },
];

const generateFindingId = () => `sf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const parseStructuredFindings = (value: any): StructuredFinding[] => {
  if (!value) return [];

  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      return [];
    }
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item) => ({
      id: item?.id || generateFindingId(),
      region: item?.region || '',
      finding: item?.finding || '',
      significance: (item?.significance as ReportSeverity) || 'moderate',
      recommendation: item?.recommendation || '',
    }));
  }

  if (parsed && typeof parsed === 'object') {
    return Object.keys(parsed).map((key) => ({
      id: generateFindingId(),
      region: key,
      finding: parsed[key]?.finding || '',
      significance: (parsed[key]?.significance as ReportSeverity) || 'moderate',
      recommendation: parsed[key]?.recommendation || '',
    }));
  }

  return [];
};

const parseCodedDiagnoses = (value: any): SnomedConcept[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'object' && item.conceptId) {
        return item as SnomedConcept;
      }
      if (typeof item === 'string') {
        return { conceptId: item, term: item, preferredTerm: item } as SnomedConcept;
      }
      return null;
    }).filter((item): item is SnomedConcept => item !== null);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => {
          if (typeof item === 'object' && item.conceptId) {
            return item as SnomedConcept;
          }
          if (typeof item === 'string') {
            return { conceptId: item, term: item, preferredTerm: item } as SnomedConcept;
          }
          return null;
        }).filter((item): item is SnomedConcept => item !== null);
      }
    } catch (error) {
      // Legacy format: comma-separated codes
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((code) => ({ conceptId: code, term: code, preferredTerm: code } as SnomedConcept));
    }
  }
  return [];
};

const defaultReportState: ReportState = {
  clinical_history: '',
  technique: '',
  findings: '',
  impression: '',
  recommendations: '',
  comparison_studies: '',
  critical_findings: '',
  is_critical: false,
  severity: '',
  follow_up_recommended: false,
  follow_up_interval: '',
  coded_diagnoses: [],
  structured_findings: [],
};

const ImagingReportComposer: React.FC<ImagingReportComposerProps> = ({
  tenantSlug,
  token,
  study,
  currentUser,
  onRefresh,
}: ImagingReportComposerProps) => {
  const { showError, showSuccess } = useNotification();
  const [reportState, setReportState] = useState<ReportState>(defaultReportState);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [showAmendForm, setShowAmendForm] = useState(false);
  const [amending, setAmending] = useState(false);
  const [amendReason, setAmendReason] = useState('');
  const [amendFindings, setAmendFindings] = useState('');
  const [amendImpression, setAmendImpression] = useState('');
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [currentDiagnosisConcept, setCurrentDiagnosisConcept] = useState<SnomedConcept | null>(null);
  const [aiDraft, setAiDraft] = useState<ReportDraftArtifact | null>(study?.reportDraft || null);
  const [discrepancyReviews, setDiscrepancyReviews] = useState<ReportDiscrepancyReview[]>(
    Array.isArray(study?.discrepancyReviews) ? study.discrepancyReviews : [],
  );
  const [incidentalFollowups, setIncidentalFollowups] = useState<IncidentalFindingFollowupArtifact[]>(
    Array.isArray(study?.incidentalFollowups) ? study.incidentalFollowups : [],
  );

  const existingReport = study?.report || null;
  const isAssignedRadiologist = useMemo(() => {
    if (!currentUser || !study) return false;
    if (currentUser.role !== 'radiologist') return false;
    if (!study.radiologist_assigned && !study.radiologist_assigned_id) {
      // allow if unassigned for now
      return true;
    }
    const assignedId = study.radiologist_assigned_id || study.radiologist_assigned;
    return assignedId === currentUser.id;
  }, [currentUser, study]);
  const readOnly = !isAssignedRadiologist || existingReport?.report_status === 'final';
  const currentSeverity = reportState.severity;

  const renderSeverityBadge = (severity: ReportSeverity | '') => {
    if (!severity || !SEVERITY_META[severity]) return null;
    const meta = SEVERITY_META[severity];
    return (
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${meta.className}`}
      >
        <ShieldAlert className="w-3 h-3" />
        {meta.label}
      </span>
    );
  };

  const handleChange = <K extends keyof ReportState>(field: K, value: ReportState[K]) => {
    setReportState((prev) => ({ ...prev, [field]: value }));
  };

  const handleStructuredFindingChange = <K extends keyof Omit<StructuredFinding, 'id'>>(
    id: string,
    field: K,
    value: StructuredFinding[K],
  ) => {
    setReportState((prev) => ({
      ...prev,
      structured_findings: prev.structured_findings.map((finding) =>
        finding.id === id ? { ...finding, [field]: value } : finding,
      ),
    }));
  };

  const addStructuredFinding = () => {
    if (readOnly) return;
    setReportState((prev) => ({
      ...prev,
      structured_findings: [
        ...prev.structured_findings,
        { id: generateFindingId(), region: '', finding: '', significance: 'moderate', recommendation: '' },
      ],
    }));
  };

  const removeStructuredFinding = (id: string) => {
    if (readOnly) return;
    setReportState((prev) => ({
      ...prev,
      structured_findings: prev.structured_findings.filter((finding) => finding.id !== id),
    }));
  };

  const handleDiagnosisAdd = (concept: SnomedConcept | null) => {
    if (readOnly || !concept) return;
    const exists = reportState.coded_diagnoses.some((d) => d.conceptId === concept.conceptId);
    if (!exists) {
      setReportState((prev) => ({
        ...prev,
        coded_diagnoses: [...prev.coded_diagnoses, concept],
      }));
    }
    setCurrentDiagnosisConcept(null);
  };

  const removeDiagnosisCode = (conceptId: string) => {
    if (readOnly) return;
    setReportState((prev) => ({
      ...prev,
      coded_diagnoses: prev.coded_diagnoses.filter((item) => item.conceptId !== conceptId),
    }));
  };

  useEffect(() => {
    if (existingReport) {
      const structuredFindings = parseStructuredFindings(existingReport.structured_findings);
      const codedDiagnoses = parseCodedDiagnoses(existingReport.coded_diagnoses);
      setReportState({
        clinical_history: existingReport.clinical_history || study?.clinical_history || '',
        technique: existingReport.technique || '',
        findings: existingReport.findings || '',
        impression: existingReport.impression || '',
        recommendations: existingReport.recommendations || '',
        comparison_studies: existingReport.comparison_studies || '',
        critical_findings: existingReport.critical_findings || '',
        is_critical: Boolean(existingReport.is_critical),
        severity: (existingReport.severity as ReportSeverity) || '',
        follow_up_recommended: Boolean(existingReport.follow_up_recommended),
        follow_up_interval: existingReport.follow_up_interval || '',
        coded_diagnoses: codedDiagnoses,
        structured_findings: structuredFindings,
      });
    } else {
      setReportState({
        ...defaultReportState,
        clinical_history: study?.clinical_history || '',
        technique: study?.technique || '',
      });
    }
    setCurrentDiagnosisConcept(null);
    setAiDraft(study?.reportDraft || null);
    setDiscrepancyReviews(Array.isArray(study?.discrepancyReviews) ? study.discrepancyReviews : []);
    setIncidentalFollowups(Array.isArray(study?.incidentalFollowups) ? study.incidentalFollowups : []);
  }, [existingReport, study]);

  useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const params: { modality?: string; study_type?: string } = {};
        if (study?.modality_id) {
          params.modality = study.modality_id;
        }
        if (study?.study_type_id) {
          params.study_type = study.study_type_id;
        }
        const { data } = await ehrApi.getImagingReportTemplates(tenantSlug, token, params);
        setTemplates(data.templates || []);
      } catch (error) {
        console.error('Failed to load report templates', error);
        showError('Failed to load report templates', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoadingTemplates(false);
      }
    };

    if (tenantSlug && token && study) {
      loadTemplates();
    }
  }, [tenantSlug, token, study, showError]);

  const applyTemplate = (template: ReportTemplate) => {
    setReportState((prev) => ({
      ...prev,
      technique: template.technique_template || prev.technique,
      findings: template.findings_template || prev.findings,
      impression: template.impression_template || prev.impression,
    }));
    showSuccess('Template applied', 'sucess');
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      applyTemplate(template);
    }
  };

  const ensureStudyContext = () => {
    if (!study?.id || !study?.imaging_order_id || !study?.patient_id) {
      showError('Missing study context. Please reload the study.', 'Missing study context');
      return false;
    }
    if (!isAssignedRadiologist) {
      showError('Only the assigned radiologist can modify this report.', 'Not assigned radiologist');
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!ensureStudyContext()) return;

    setSaving(true);
    try {
      const filteredFindings = reportState.structured_findings
        .filter((finding) => finding.region.trim() || finding.finding.trim())
        .map(({ id, region, finding, significance, recommendation }) => ({
          region: region.trim(),
          finding: finding.trim(),
          significance,
          recommendation: recommendation?.trim() || undefined,
        }));

      const filteredDiagnoses = reportState.coded_diagnoses.map((concept) => ({
        conceptId: concept.conceptId,
        term: concept.term || concept.preferredTerm || concept.conceptId,
        preferredTerm: concept.preferredTerm || concept.term,
        moduleId: concept.moduleId,
        definitionStatus: concept.definitionStatus,
      }));

      const payload = {
        imaging_study_id: study.id,
        imaging_order_id: study.imaging_order_id,
        patient_id: study.patient_id,
        report_draft_id: aiDraft?.id || null,
        clinical_history: reportState.clinical_history,
        technique: reportState.technique,
        findings: reportState.findings,
        impression: reportState.impression,
        recommendations: reportState.recommendations,
        comparison_studies: reportState.comparison_studies,
        critical_findings: reportState.critical_findings,
        is_critical: reportState.is_critical,
        structured_findings: filteredFindings,
        severity: reportState.severity || null,
        follow_up_recommended: reportState.follow_up_recommended,
        follow_up_interval:
          reportState.follow_up_recommended && reportState.follow_up_interval
            ? reportState.follow_up_interval
            : null,
        coded_diagnoses: filteredDiagnoses,
      };

      if (existingReport?.id) {
        await ehrApi.updateImagingReport(tenantSlug, token, existingReport.id, payload);
        showSuccess('Report updated', 'success');
      } else {
        await ehrApi.createImagingReport(tenantSlug, token, payload);
        showSuccess('Report drafted', 'success');
      }

      if (onRefresh) await onRefresh();
    } catch (error: any) {
      console.error('Failed to save report', error);
      const message = error?.response?.data?.message || 'Failed to save report';
      showError(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const applyAIDraft = (draft: ReportDraftArtifact) => {
    setReportState((prev) => ({
      ...prev,
      findings: draft.draftFindings || prev.findings,
      impression: draft.draftImpression || prev.impression,
      recommendations: draft.draftRecommendations || prev.recommendations,
      structured_findings:
        Array.isArray(draft.structuredDraft?.structured_findings) &&
        (draft.structuredDraft?.structured_findings?.length ?? 0) > 0
          ? draft.structuredDraft!.structured_findings!.map((finding) => ({
              id: finding.id || generateFindingId(),
              region: finding.region || '',
              finding: finding.finding || '',
              significance: (finding.significance as ReportSeverity) || 'moderate',
              recommendation: finding.recommendation || '',
            }))
          : prev.structured_findings,
    }));
  };

  const handleGenerateAIDraft = async () => {
    if (!study?.id || readOnly) return;
    try {
      setGeneratingDraft(true);
      const { data } = await ehrApi.generateImagingReportDraft(tenantSlug, token, study.id);
      setAiDraft(data || null);
      showSuccess('AI draft prepared', 'success');
    } catch (error: any) {
      console.error('Failed to generate AI report draft', error);
      showError(error?.response?.data?.message || 'Failed to generate AI draft', 'error');
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleSignReport = async () => {
    if (!ensureStudyContext()) return;
    if (!existingReport?.id) {
      showError('Save the report before signing.', 'error');
      return;
    }

    setSigning(true);
    try {
      await ehrApi.signImagingReport(tenantSlug, token, existingReport.id);
      showSuccess('Report signed and finalized', 'success');
      if (onRefresh) await onRefresh();
    } catch (error: any) {
      console.error('Failed to sign report', error);
      const message = error?.response?.data?.message || 'Failed to sign report';
      showError(message, 'error');
    } finally {
      setSigning(false);
    }
  };

  const openAmendForm = () => {
    setAmendReason('');
    setAmendFindings(existingReport?.findings || '');
    setAmendImpression(existingReport?.impression || '');
    setShowAmendForm(true);
  };

  const handleAmendReport = async () => {
    if (!ensureStudyContext()) return;
    if (!existingReport?.id) return;
    if (!amendReason.trim()) {
      showError('An amendment reason is required.', 'error');
      return;
    }

    setAmending(true);
    try {
      await ehrApi.amendImagingReport(tenantSlug, token, existingReport.id, {
        amendment_reason: amendReason.trim(),
        findings: amendFindings,
        impression: amendImpression,
      });
      showSuccess('Report amended', 'success');
      setShowAmendForm(false);
      if (onRefresh) await onRefresh();
    } catch (error: any) {
      console.error('Failed to amend report', error);
      const message = error?.response?.data?.message || 'Failed to amend report';
      showError(message, 'error');
    } finally {
      setAmending(false);
    }
  };

  const handleResolveDiscrepancyReview = async (reviewId: string, reviewStatus: 'resolved' | 'dismissed' | 'escalated') => {
    if (!ensureStudyContext()) return;

    try {
      const { data } = await ehrApi.resolveImagingDiscrepancyReview(tenantSlug, token, reviewId, {
        review_status: reviewStatus,
      });
      setDiscrepancyReviews((prev) =>
        prev.map((review) => (review.id === reviewId ? { ...review, ...data } : review)),
      );
      showSuccess('Discrepancy review updated', 'success');

      if (reviewStatus === 'escalated' && existingReport?.id) {
        const followupResponse = await ehrApi.getImagingReportIncidentalFollowups(tenantSlug, token, existingReport.id);
        setIncidentalFollowups(Array.isArray(followupResponse.data) ? followupResponse.data : []);
      }
    } catch (error: any) {
      console.error('Failed to resolve discrepancy review', error);
      showError(error?.response?.data?.message || 'Failed to update discrepancy review', 'error');
    }
  };

  const handleAcknowledgeFollowup = async (followupId: string) => {
    try {
      const { data } = await ehrApi.acknowledgeImagingIncidentalFollowup(tenantSlug, token, followupId);
      setIncidentalFollowups((prev) =>
        prev.map((followup) => (followup.id === followupId ? { ...followup, ...data } : followup)),
      );
      showSuccess('Follow-up acknowledged', 'success');
    } catch (error: any) {
      console.error('Failed to acknowledge incidental follow-up', error);
      showError(error?.response?.data?.message || 'Failed to acknowledge follow-up', 'error');
    }
  };

  const handleCompleteFollowup = async (followupId: string) => {
    try {
      const { data } = await ehrApi.completeImagingIncidentalFollowup(tenantSlug, token, followupId);
      setIncidentalFollowups((prev) =>
        prev.map((followup) => (followup.id === followupId ? { ...followup, ...data } : followup)),
      );
      showSuccess('Follow-up completed', 'success');
    } catch (error: any) {
      console.error('Failed to complete incidental follow-up', error);
      showError(error?.response?.data?.message || 'Failed to complete follow-up', 'error');
    }
  };

  const reportStatusBadge = () => {
    if (!existingReport) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <PenSquare className="w-3 h-3" /> Draft not started
        </span>
      );
    }

    const status = (existingReport.report_status || 'draft').toLowerCase();
    const statusMap: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      draft: {
        label: 'Draft',
        className: 'bg-amber-100 text-amber-700',
        icon: <PenSquare className="w-3 h-3" />,
      },
      preliminary: {
        label: 'Preliminary',
        className: 'bg-blue-100 text-blue-700',
        icon: <Sparkles className="w-3 h-3" />,
      },
      final: {
        label: 'Signed',
        className: 'bg-emerald-100 text-emerald-700',
        icon: <CheckCircle2 className="w-3 h-3" />,
      },
      amended: {
        label: 'Amended',
        className: 'bg-purple-100 text-purple-700',
        icon: <FileSignature className="w-3 h-3" />,
      },
    };

    const meta = statusMap[status] || statusMap.draft;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${meta.className}`}>
        {meta.icon}
        {meta.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-indigo-500" />
            Report Authoring
          </h3>
          <p className="text-xs text-slate-500">Compose diagnostic findings, apply templates, and finalize the report.</p>
        </div>
        <div className="flex items-center gap-2">
          {reportStatusBadge()}
          {reportState.is_critical && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              <ShieldAlert className="w-3 h-3" /> Critical Finding
            </span>
          )}
          {renderSeverityBadge(currentSeverity)}
          {reportState.follow_up_recommended && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border bg-orange-50 text-orange-700 border-orange-200">
              <Clock className="w-3 h-3" />
              Follow-up {reportState.follow_up_interval ? `in ${reportState.follow_up_interval}` : 'required'}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Clinical History</label>
            <textarea
              value={reportState.clinical_history}
              onChange={(e) => handleChange('clinical_history', e.target.value)}
              rows={3}
              disabled={readOnly}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
              placeholder="Summarize pertinent history..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Template</label>
            <div className="relative">
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                disabled={readOnly || loadingTemplates}
                className="w-full appearance-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
              >
                <option value="">{loadingTemplates ? 'Loading templates...' : 'Select template (optional)'}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.template_name}</option>
                ))}
              </select>
              <NotebookPen className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Technique</label>
            <textarea
              value={reportState.technique}
              onChange={(e) => handleChange('technique', e.target.value)}
              rows={3}
              disabled={readOnly}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
              placeholder="Document acquisition technique..."
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Comparison Studies</label>
            <textarea
              value={reportState.comparison_studies}
              onChange={(e) => handleChange('comparison_studies', e.target.value)}
              rows={3}
              disabled={readOnly}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
              placeholder="Reference prior studies, if any"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Findings</label>
          <textarea
            value={reportState.findings}
            onChange={(e) => handleChange('findings', e.target.value)}
            rows={6}
            disabled={readOnly}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
            placeholder="Describe observations systematically"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Impression</label>
          <textarea
            value={reportState.impression}
            onChange={(e) => handleChange('impression', e.target.value)}
            rows={4}
            disabled={readOnly}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
            placeholder="Summarize key findings and differential diagnoses"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Recommendations</label>
            <textarea
              value={reportState.recommendations}
              onChange={(e) => handleChange('recommendations', e.target.value)}
              rows={3}
              disabled={readOnly}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
              placeholder="Suggested follow-up or additional imaging"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Critical Findings & Notifications</label>
            <textarea
              value={reportState.critical_findings}
              onChange={(e) => handleChange('critical_findings', e.target.value)}
              rows={3}
              disabled={readOnly}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 disabled:bg-slate-50"
              placeholder="Document STAT / life-threatening findings and notifications"
            />
            <label className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-red-600">
              <input
                type="checkbox"
                checked={reportState.is_critical}
                onChange={(e) => handleChange('is_critical', e.target.checked)}
                disabled={readOnly}
                className="h-4 w-4 rounded border border-red-300 text-red-500 focus:ring-red-500"
              />
              Flag report as critical and alert ordering clinician
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Overall Severity
            </label>
            <select
              value={reportState.severity}
              onChange={(e) => handleChange('severity', e.target.value as ReportSeverity | '')}
              disabled={readOnly}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
            >
              <option value="">Select severity</option>
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="mt-2">{renderSeverityBadge(reportState.severity)}</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Follow-up
            </label>
            <div className="rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={reportState.follow_up_recommended}
                  onChange={(e) => handleChange('follow_up_recommended', e.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4 rounded border border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Follow-up action required
              </label>
              <input
                type="text"
                value={reportState.follow_up_interval}
                onChange={(e) => handleChange('follow_up_interval', e.target.value)}
                disabled={readOnly || !reportState.follow_up_recommended}
                placeholder="e.g. within 2 weeks"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              SNOMED CT Coded Diagnoses
            </label>
            <div className="rounded-lg border border-slate-200 px-3 py-2 bg-slate-50">
              <div className="flex flex-wrap gap-2 mb-2">
                {reportState.coded_diagnoses.length === 0 && (
                  <span className="text-xs text-slate-400">No coded diagnoses captured</span>
                )}
                {reportState.coded_diagnoses.map((concept) => (
                  <span
                    key={concept.conceptId}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200"
                  >
                    {concept.preferredTerm || concept.term || concept.conceptId}
                    <span className="text-indigo-500">({concept.conceptId})</span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeDiagnosisCode(concept.conceptId)}
                        className="text-indigo-500 hover:text-indigo-700 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {!readOnly && (
                <SnomedConceptPicker
                  value={currentDiagnosisConcept}
                  onChange={(concept) => {
                    if (concept) {
                      handleDiagnosisAdd(concept);
                    } else {
                      setCurrentDiagnosisConcept(null);
                    }
                  }}
                  token={token}
                  tenantSlug={tenantSlug}
                  label=""
                  placeholder="Search SNOMED CT diagnosis (e.g., Pneumonia, Fracture)"
                  helperText="Add SNOMED CT coded diagnoses from the imaging findings"
                  context="condition"
                />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Structured Findings</p>
              <p className="text-xs text-slate-500">
                Capture discrete findings to support downstream analytics and care coordination.
              </p>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={addStructuredFinding}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Plus className="w-3 h-3" />
                Add Finding
              </button>
            )}
          </div>

          {reportState.structured_findings.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No structured findings captured yet.
            </div>
          ) : (
            <div className="space-y-3">
              {reportState.structured_findings.map((finding) => (
                <div
                  key={finding.id}
                  className="rounded-xl border border-indigo-100 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                        Region / Anatomy
                      </label>
                      <input
                        type="text"
                        value={finding.region}
                        onChange={(e) => handleStructuredFindingChange(finding.id, 'region', e.target.value)}
                        disabled={readOnly}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
                        placeholder="e.g. Right lower lobe"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                        Finding
                      </label>
                      <textarea
                        value={finding.finding}
                        onChange={(e) => handleStructuredFindingChange(finding.id, 'finding', e.target.value)}
                        disabled={readOnly}
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
                        placeholder="Describe the observation..."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                        Significance
                      </label>
                      <select
                        value={finding.significance}
                        onChange={(e) =>
                          handleStructuredFindingChange(finding.id, 'significance', e.target.value as ReportSeverity)
                        }
                        disabled={readOnly}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
                      >
                        {SEVERITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2">{renderSeverityBadge(finding.significance)}</div>
                    </div>
                    <div className="md:col-span-4">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                        Recommended Action (optional)
                      </label>
                      <textarea
                        value={finding.recommendation || ''}
                        onChange={(e) => handleStructuredFindingChange(finding.id, 'recommendation', e.target.value)}
                        disabled={readOnly}
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50"
                        placeholder="e.g. Initiate antibiotics, schedule CT chest..."
                      />
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
                      <span>Structured finding entry</span>
                      <button
                        type="button"
                        onClick={() => removeStructuredFinding(finding.id)}
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!isAssignedRadiologist && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="w-5 h-5" />
            Only the assigned radiologist can edit this report. Assign yourself from the worklist to enable editing.
          </div>
        )}

        {existingReport?.report_status === 'final' && !showAmendForm && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5" />
              This report has been signed. Further edits require a documented amendment.
            </div>
            {isAssignedRadiologist && (
              <button
                type="button"
                onClick={openAmendForm}
                className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                Amend report
              </button>
            )}
          </div>
        )}

        {existingReport?.report_status === 'amended' && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="w-5 h-5" />
            This report was amended{existingReport?.amended_at ? ` on ${new Date(existingReport.amended_at).toLocaleString()}` : ''}
            {existingReport?.amendment_reason ? `: ${existingReport.amendment_reason}` : ''}
          </div>
        )}

        {showAmendForm && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Amend signed report</p>
            <div>
              <label className="mb-1 block text-xs font-medium text-amber-800">Amendment reason (required)</label>
              <textarea
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm"
                placeholder="Why is this report being amended?"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-amber-800">Findings</label>
              <textarea
                value={amendFindings}
                onChange={(e) => setAmendFindings(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-amber-800">Impression</label>
              <textarea
                value={amendImpression}
                onChange={(e) => setAmendImpression(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAmendReport}
                disabled={amending}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {amending ? 'Submitting amendment...' : 'Submit amendment'}
              </button>
              <button
                type="button"
                onClick={() => setShowAmendForm(false)}
                disabled={amending}
                className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {aiDraft && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-violet-800">
                <Sparkles className="w-4 h-4" />
                <p className="text-sm font-semibold">Governed AI Report Draft</p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => applyAIDraft(aiDraft)}
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                >
                  <NotebookPen className="w-3 h-3" />
                  Apply AI Draft
                </button>
              )}
            </div>
            {/* Confidence Badge (Sprint 113) */}
            {(aiDraft as any).confidence !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">AI Draft Quality:</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  (aiDraft as any).confidence >= 0.8 ? 'bg-green-100 text-green-700' :
                  (aiDraft as any).confidence >= 0.6 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {((aiDraft as any).confidence * 100).toFixed(0)}% confidence
                </span>
                {(aiDraft as any).confidence < 0.6 && (
                  <span className="text-xs text-red-600">⚠ Low confidence — review carefully</span>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 text-xs text-slate-700">
              <div className="rounded-lg bg-white px-3 py-3 border border-violet-100">
                <p className="font-semibold text-slate-900 mb-1">Draft Findings</p>
                <p>{aiDraft.draftFindings}</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-3 border border-violet-100">
                <p className="font-semibold text-slate-900 mb-1">Draft Impression</p>
                <p>{aiDraft.draftImpression}</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-3 border border-violet-100">
                <p className="font-semibold text-slate-900 mb-1">Draft Recommendations</p>
                <p>{aiDraft.draftRecommendations || 'No explicit AI recommendation captured.'}</p>
              </div>
            </div>
          </div>
        )}

        {discrepancyReviews.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-sm font-semibold">AI vs Radiologist Discrepancy Review</p>
            </div>
            {discrepancyReviews.slice(0, 1).map((review) => (
              <div key={review.id} className="rounded-lg border border-amber-100 bg-white px-3 py-3 text-xs text-slate-700 space-y-2">
                <p className="font-semibold text-slate-900">
                  Status: {review.discrepancyStatus.replace(/_/g, ' ')}
                </p>
                {review.reviewStatus && (
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Workflow: {review.reviewStatus.replace(/_/g, ' ')}
                  </p>
                )}
                <p>{review.rationale}</p>
                {Array.isArray(review.discrepancySummary?.unmatchedAiLabels) &&
                  review.discrepancySummary!.unmatchedAiLabels!.length > 0 && (
                    <p>
                      Unmatched AI labels: {review.discrepancySummary!.unmatchedAiLabels!.join(', ')}
                    </p>
                  )}
                {review.resolutionNotes && <p>Resolution: {review.resolutionNotes}</p>}
                {!readOnly && review.reviewStatus !== 'resolved' && review.reviewStatus !== 'dismissed' && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleResolveDiscrepancyReview(review.id, 'resolved')}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Resolve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveDiscrepancyReview(review.id, 'escalated')}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      <ShieldAlert className="h-3 w-3" />
                      Escalate
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {incidentalFollowups.length > 0 && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-4 space-y-3">
            <div className="flex items-center gap-2 text-orange-800">
              <Clock className="w-4 h-4" />
              <p className="text-sm font-semibold">Incidental Finding Follow-up</p>
            </div>
            {incidentalFollowups.slice(0, 2).map((followup) => (
              <div key={followup.id} className="rounded-lg border border-orange-100 bg-white px-3 py-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">{followup.title}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                  Status: {followup.status.replace(/_/g, ' ')}
                </p>
                {(followup as any).followupDueDate && (
                  <p className={`mt-0.5 text-xs font-medium ${
                    Math.ceil((new Date((followup as any).followupDueDate).getTime() - Date.now()) / 86400000) <= 7
                      ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {Math.ceil((new Date((followup as any).followupDueDate).getTime() - Date.now()) / 86400000) <= 0
                      ? 'OVERDUE'
                      : `Due in ${Math.ceil((new Date((followup as any).followupDueDate).getTime() - Date.now()) / 86400000)}d`}
                  </p>
                )}
                <p className="mt-1">{followup.summary}</p>
                {followup.recommendedAction && <p className="mt-1">Action: {followup.recommendedAction}</p>}
                {followup.resolutionNotes && <p className="mt-1">Resolution: {followup.resolutionNotes}</p>}
                {followup.status !== 'completed' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {followup.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => handleAcknowledgeFollowup(followup.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-orange-700 hover:bg-orange-50"
                      >
                        <Clock className="h-3 w-3" />
                        Acknowledge
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCompleteFollowup(followup.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Complete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Study:</span>
            <span className="font-medium text-slate-700">{study?.study_name}</span>
            <span>• Modality: {study?.modality_code}</span>
            <span>• Accession: <span className="font-mono">{study?.accession_number}</span></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateAIDraft}
              disabled={readOnly || generatingDraft}
              className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generatingDraft ? 'Generating...' : aiDraft ? 'Refresh AI Draft' : 'Generate AI Draft'}
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={readOnly || saving}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenSquare className="w-4 h-4" />}
              {saving ? 'Saving...' : existingReport ? 'Update Draft' : 'Save Draft'}
            </button>

            <button
              type="button"
              onClick={handleSignReport}
              disabled={readOnly || signing || !existingReport?.id || existingReport?.report_status === 'final'}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:from-emerald-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}
              {signing ? 'Signing...' : 'Sign & Finalize'}
            </button>
          </div>
        </div>
      </div>

      {existingReport?.critical_findings && existingReport?.report_status === 'final' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-semibold">Critical findings documented</p>
            <p>{existingReport.critical_findings}</p>
          </div>
        </div>
      )}

      {!existingReport && !readOnly && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 flex items-start gap-2">
          <Sparkles className="w-4 h-4 mt-0.5" />
          <p>Select a template to prefill standard technique/findings/impression. You can edit all fields afterwards.</p>
        </div>
      )}
    </div>
  );
};

export default ImagingReportComposer;
