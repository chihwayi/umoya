import React from 'react';
import { Activity, Clock3, Plus, TrendingUp, X } from 'lucide-react';
import { format } from 'date-fns';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type Props = {
  tenantSlug: string;
  token: string;
  caseId: string;
  regimens?: Array<{ id: string; regimen_name: string }>;
};

const RECIST_COLORS: Record<string, string> = {
  CR: 'bg-emerald-100 text-emerald-700',
  PR: 'bg-sky-100 text-sky-700',
  SD: 'bg-amber-100 text-amber-700',
  PD: 'bg-rose-100 text-rose-700',
  NE: 'bg-slate-100 text-slate-600',
};

const OncologyResponseAssessment: React.FC<Props> = ({ tenantSlug, token, caseId, regimens = [] }) => {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = React.useState(false);
  const [history, setHistory] = React.useState<any[]>([]);
  const [bestSummary, setBestSummary] = React.useState<any | null>(null);
  const [survival, setSurvival] = React.useState<any | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    regimenId: '',
    assessmentDate: '',
    assessmentType: 'interim',
    recistResponse: '',
    targetLesionsCount: '',
    targetLesionsSizeCm: '',
    newLesions: 'false',
    notes: '',
  });

  const loadData = React.useCallback(async () => {
    if (!tenantSlug || !token || !caseId) {
      return;
    }
    setLoading(true);
    try {
      const [historyResp, bestResp, survivalResp] = await Promise.all([
        ehrApi.getOncologyResponseAssessments(tenantSlug, token, caseId),
        ehrApi.getOncologyBestResponse(tenantSlug, token, caseId),
        ehrApi.getOncologySurvivalMetrics(tenantSlug, token, caseId),
      ]);
      setHistory(Array.isArray(historyResp.data) ? historyResp.data : []);
      setBestSummary(bestResp?.data ?? null);
      setSurvival(survivalResp?.data ?? null);
    } catch (error) {
      console.error('Failed to load response assessments', error);
      showError('Unable to load response assessments', 'Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [caseId, showError, tenantSlug, token]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug || !token) return;
    setSaving(true);
    try {
      const payload: any = {
        assessmentDate: form.assessmentDate,
        assessmentType: form.assessmentType,
        notes: form.notes || null,
      };
      if (form.regimenId) payload.regimenId = form.regimenId;
      if (form.recistResponse) payload.recistResponse = form.recistResponse;
      if (form.targetLesionsCount) payload.targetLesionsCount = Number(form.targetLesionsCount);
      if (form.targetLesionsSizeCm) payload.targetLesionsSizeCm = Number(form.targetLesionsSizeCm);
      if (form.newLesions) payload.newLesions = form.newLesions === 'true';

      await ehrApi.createOncologyResponseAssessment(tenantSlug, token, caseId, payload);
      showSuccess('Response assessment added', 'RECIST tracking updated.');
      setForm({
        regimenId: '',
        assessmentDate: '',
        assessmentType: form.assessmentType,
        recistResponse: '',
        targetLesionsCount: '',
        targetLesionsSizeCm: '',
        newLesions: 'false',
        notes: '',
      });
      setFormOpen(false);
      await loadData();
    } catch (error) {
      console.error('Failed to save response assessment', error);
      showError('Unable to save assessment', 'Double-check the inputs and try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    try {
      return format(new Date(value), 'dd MMM yyyy');
    } catch {
      return value;
    }
  };

  const renderMetric = (title: string, value: string | number | null | undefined, subtitle?: string, icon?: React.ReactNode) => (
    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
      <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
        {icon}
        {title}
      </p>
      <p className="text-lg font-semibold text-slate-900 mt-1">{value ?? '—'}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  );

  const pfsMonths =
    survival?.progressionFreeSurvivalDays && Number.isFinite(survival.progressionFreeSurvivalDays)
      ? (survival.progressionFreeSurvivalDays / 30.4).toFixed(1)
      : null;
  const osMonths =
    survival?.overallSurvivalDays && Number.isFinite(survival.overallSurvivalDays)
      ? (survival.overallSurvivalDays / 30.4).toFixed(1)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Response Assessments</h3>
          <p className="text-xs text-slate-500">RECIST tracking, PFS/OS estimates, and longitudinal summaries.</p>
        </div>
        <button
          onClick={() => setFormOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
        >
          {formOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {formOpen ? 'Close' : 'Add Assessment'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {renderMetric(
          'Best Overall',
          bestSummary?.latest?.best_overall_response ?? bestSummary?.latest?.recist_response ?? '—',
          bestSummary?.latest?.assessment_date ? `as of ${formatDate(bestSummary.latest.assessment_date)}` : undefined,
          <Activity className="w-3.5 h-3.5 text-emerald-500" />,
        )}
        {renderMetric(
          'PFS (months)',
          pfsMonths ?? '—',
          survival?.progressionDate ? `Progressed ${formatDate(survival.progressionDate)}` : 'No progression recorded',
          <TrendingUp className="w-3.5 h-3.5 text-sky-500" />,
        )}
        {renderMetric(
          'OS (months)',
          osMonths ?? '—',
          survival?.isDeceased ? 'Patient deceased' : 'Ongoing follow-up',
          <Clock3 className="w-3.5 h-3.5 text-amber-500" />,
        )}
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs text-slate-600">
              Assessment Date
              <input
                type="date"
                name="assessmentDate"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.assessmentDate}
                onChange={handleInputChange}
                required
              />
            </label>
            <label className="text-xs text-slate-600">
              Assessment Type
              <select
                name="assessmentType"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.assessmentType}
                onChange={handleInputChange}
              >
                <option value="baseline">Baseline</option>
                <option value="interim">Interim</option>
                <option value="end_of_treatment">End of treatment</option>
                <option value="follow_up">Follow up</option>
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Regimen
              <select
                name="regimenId"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.regimenId}
                onChange={handleInputChange}
              >
                <option value="">Not specified</option>
                {regimens.map((regimen) => (
                  <option key={regimen.id} value={regimen.id}>
                    {regimen.regimen_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs text-slate-600">
              RECIST Response
              <select
                name="recistResponse"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.recistResponse}
                onChange={handleInputChange}
              >
                <option value="">Pending</option>
                <option value="CR">Complete Response (CR)</option>
                <option value="PR">Partial Response (PR)</option>
                <option value="SD">Stable Disease (SD)</option>
                <option value="PD">Progressive Disease (PD)</option>
                <option value="NE">Not Evaluable (NE)</option>
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Target Lesions (#)
              <input
                type="number"
                name="targetLesionsCount"
                min={0}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.targetLesionsCount}
                onChange={handleInputChange}
              />
            </label>
            <label className="text-xs text-slate-600">
              Sum Diameter (cm)
              <input
                type="number"
                name="targetLesionsSizeCm"
                step="0.1"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.targetLesionsSizeCm}
                onChange={handleInputChange}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-slate-600">
              New Lesions
              <select
                name="newLesions"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.newLesions}
                onChange={handleInputChange}
              >
                <option value="false">No new lesions</option>
                <option value="true">New lesions present</option>
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Notes
              <textarea
                name="notes"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={2}
                value={form.notes}
                onChange={handleInputChange}
                placeholder="Therapy response, interpretation, biomarker context..."
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Assessment'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-slate-500">Loading response history...</div>
        ) : history.length ? (
          history.map((item) => {
            const badge =
              item.recist_response && RECIST_COLORS[item.recist_response]
                ? RECIST_COLORS[item.recist_response]
                : 'bg-slate-100 text-slate-600';
            return (
              <div key={item.id} className="p-3 border border-slate-200 rounded-xl bg-white flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium text-slate-800">
                    {formatDate(item.assessment_date)} • {String(item.assessment_type).replace(/_/g, ' ')}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badge}`}>
                    {item.recist_response ?? 'Pending'}
                  </span>
                </div>
                {item.target_lesions_size_cm && (
                  <p className="text-xs text-slate-500">
                    Target lesion sum: {item.target_lesions_size_cm} cm • Lesions:{' '}
                    {item.target_lesions_count ?? '—'} {item.new_lesions ? '• New lesions present' : ''}
                  </p>
                )}
                {item.notes && <p className="text-xs text-slate-500">{item.notes}</p>}
                <p className="text-[11px] text-slate-400">
                  {item.regimen_name ? `${item.regimen_name} • ` : ''}
                  {item.assessed_by_name ? `Assessed by ${item.assessed_by_name}` : 'No assessor recorded'}
                </p>
              </div>
            );
          })
        ) : (
          <div className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl p-4 text-center">
            No response assessments documented yet. Capture baseline and interim RECIST measurements to unlock analytics.
          </div>
        )}
      </div>
    </div>
  );
};

export default OncologyResponseAssessment;



