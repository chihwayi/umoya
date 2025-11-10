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
  coded_diagnoses: string[];
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

const parseCodedDiagnoses = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch (error) {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
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
}) => {
  const { showError, showSuccess } = useNotification();
  const [reportState, setReportState] = useState<ReportState>(defaultReportState);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [diagnosisDraft, setDiagnosisDraft] = useState('');

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

  const addDiagnosisCode = () => {
    if (readOnly) return;
    const code = diagnosisDraft.trim().toUpperCase();
    if (!code) return;

    setReportState((prev) => ({
      ...prev,
      coded_diagnoses: prev.coded_diagnoses.includes(code) ? prev.coded_diagnoses : [...prev.coded_diagnoses, code],
    }));
    setDiagnosisDraft('');
  };

  const removeDiagnosisCode = (code: string) => {
    if (readOnly) return;
    setReportState((prev) => ({
      ...prev,
      coded_diagnoses: prev.coded_diagnoses.filter((item) => item !== code),
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
    setDiagnosisDraft('');
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
        showError('Failed to load report templates');
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
    showSuccess('Template applied');
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
      showError('Missing study context. Please reload the study.');
      return false;
    }
    if (!isAssignedRadiologist) {
      showError('Only the assigned radiologist can modify this report.');
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

      const filteredDiagnoses = reportState.coded_diagnoses.map((code) => code.trim()).filter(Boolean);

      const payload = {
        imaging_study_id: study.id,
        imaging_order_id: study.imaging_order_id,
        patient_id: study.patient_id,
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
        showSuccess('Report updated');
      } else {
        await ehrApi.createImagingReport(tenantSlug, token, payload);
        showSuccess('Report drafted');
      }

      if (onRefresh) await onRefresh();
    } catch (error: any) {
      console.error('Failed to save report', error);
      const message = error?.response?.data?.message || 'Failed to save report';
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignReport = async () => {
    if (!ensureStudyContext()) return;
    if (!existingReport?.id) {
      showError('Save the report before signing.');
      return;
    }

    setSigning(true);
    try {
      await ehrApi.signImagingReport(tenantSlug, token, existingReport.id);
      showSuccess('Report signed and finalized');
      if (onRefresh) await onRefresh();
    } catch (error: any) {
      console.error('Failed to sign report', error);
      const message = error?.response?.data?.message || 'Failed to sign report';
      showError(message);
    } finally {
      setSigning(false);
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
              Coded Diagnoses / Flags
            </label>
            <div className="rounded-lg border border-slate-200 px-3 py-2 bg-slate-50">
              <div className="flex flex-wrap gap-2">
                {reportState.coded_diagnoses.length === 0 && (
                  <span className="text-xs text-slate-400">No coded diagnoses captured</span>
                )}
                {reportState.coded_diagnoses.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200"
                  >
                    {code}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeDiagnosisCode(code)}
                        className="text-indigo-500 hover:text-indigo-700 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {!readOnly && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={diagnosisDraft}
                    onChange={(e) => setDiagnosisDraft(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addDiagnosisCode();
                      }
                    }}
                    placeholder="Enter ICD / SNOMED code"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={addDiagnosisCode}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
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

        {existingReport?.report_status === 'final' && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
            This report has been signed. Further edits will require an amendment workflow (coming soon).
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
