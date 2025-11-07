import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSignature, Loader2, NotebookPen, PenSquare, ShieldAlert, Sparkles } from 'lucide-react';
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

const defaultReportState = {
  clinical_history: '',
  technique: '',
  findings: '',
  impression: '',
  recommendations: '',
  comparison_studies: '',
  critical_findings: '',
  is_critical: false,
};

const ImagingReportComposer: React.FC<ImagingReportComposerProps> = ({
  tenantSlug,
  token,
  study,
  currentUser,
  onRefresh,
}) => {
  const { showError, showSuccess } = useNotification();
  const [reportState, setReportState] = useState(defaultReportState);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);

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

  useEffect(() => {
    setReportState((prev) => {
      if (existingReport) {
        return {
          clinical_history: existingReport.clinical_history || study?.clinical_history || '',
          technique: existingReport.technique || '',
          findings: existingReport.findings || '',
          impression: existingReport.impression || '',
          recommendations: existingReport.recommendations || '',
          comparison_studies: existingReport.comparison_studies || '',
          critical_findings: existingReport.critical_findings || '',
          is_critical: Boolean(existingReport.is_critical),
        };
      }

      return {
        clinical_history: study?.clinical_history || '',
        technique: study?.technique || '',
        findings: '',
        impression: '',
        recommendations: '',
        comparison_studies: '',
        critical_findings: '',
        is_critical: false,
      };
    });
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

  const handleChange = (field: keyof typeof defaultReportState, value: any) => {
    setReportState((prev) => ({ ...prev, [field]: value }));
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

  const readOnly = !isAssignedRadiologist || existingReport?.report_status === 'final';

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
