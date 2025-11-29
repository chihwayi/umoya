import React from 'react';
import { Activity, LineChart, Loader2, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type Props = {
  tenantSlug: string;
  token: string;
  caseId: string;
};

const PRO_TYPES = [
  { value: 'EORTC_QLQ_C30', label: 'EORTC QLQ-C30' },
  { value: 'FACT_G', label: 'FACT-G' },
  { value: 'symptom_tracking', label: 'Symptom tracking' },
  { value: 'functional_status', label: 'Functional status' },
  { value: 'satisfaction', label: 'Satisfaction' },
];

const formatDateSafe = (value?: string | null) => {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch {
    return value;
  }
};

const OncologyPROs: React.FC<Props> = ({ tenantSlug, token, caseId }) => {
  const { showError, showSuccess } = useNotification();
  const [records, setRecords] = React.useState<any[]>([]);
  const [trends, setTrends] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    assessmentType: 'EORTC_QLQ_C30',
    assessmentDate: '',
    totalScore: '',
    assessmentDataText: '',
  });

  const loadData = React.useCallback(async () => {
    if (!tenantSlug || !token || !caseId) return;
    setLoading(true);
    try {
      const [historyResp, trendsResp] = await Promise.all([
        ehrApi.getOncologyPROHistory(tenantSlug, token, caseId),
        ehrApi.getOncologyPROTrends(tenantSlug, token, caseId),
      ]);
      setRecords(Array.isArray(historyResp.data) ? historyResp.data : []);
      setTrends(Array.isArray(trendsResp.data) ? trendsResp.data : []);
    } catch (error) {
      console.error('Failed to load PRO data', error);
      showError('Unable to load PROs', 'Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [caseId, showError, tenantSlug, token]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug || !token) return;
    let assessmentData: Record<string, any> = {};
    try {
      assessmentData = form.assessmentDataText ? JSON.parse(form.assessmentDataText) : {};
    } catch (error) {
      showError('Invalid assessment JSON', 'Please provide valid JSON payload.');
      return;
    }

    const payload: Record<string, any> = {
      assessmentType: form.assessmentType,
      assessmentDate: form.assessmentDate,
      assessmentData,
    };
    if (form.totalScore) payload.totalScore = Number(form.totalScore);

    setSaving(true);
    try {
      await ehrApi.recordOncologyPRO(tenantSlug, token, caseId, payload);
      showSuccess('PRO captured', 'Quality-of-life data updated.');
      setForm({
        assessmentType: form.assessmentType,
        assessmentDate: '',
        totalScore: '',
        assessmentDataText: '',
      });
      setFormOpen(false);
      await loadData();
    } catch (error) {
      console.error('Failed to record PRO', error);
      showError('Unable to save PRO', 'Check the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Patient-Reported Outcomes</h3>
          <p className="text-xs text-slate-500">Quality of life, symptom burden, and functional assessments.</p>
        </div>
        <button
          onClick={() => setFormOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
        >
          {formOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {formOpen ? 'Close' : 'New PRO'}
        </button>
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs text-slate-600">
              Assessment type
              <select
                name="assessmentType"
                value={form.assessmentType}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {PRO_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Assessment date
              <input
                type="date"
                name="assessmentDate"
                value={form.assessmentDate}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Total score
              <input
                type="number"
                name="totalScore"
                value={form.totalScore}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Calculated or leave blank"
              />
            </label>
          </div>
          <label className="text-xs text-slate-600 block">
            Assessment data (JSON)
            <textarea
              name="assessmentDataText"
              value={form.assessmentDataText}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
              rows={5}
              placeholder='{"fatigue": 60, "nausea": 20, "pain": 45}'
            />
          </label>
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
              className="px-4 py-2 text-sm rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Record PRO'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading patient-reported outcomes...
        </div>
      ) : records.length ? (
        <div className="space-y-3">
          {records.map((record) => (
            <div key={record.id} className="border border-slate-200 rounded-xl bg-white p-4 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-900">
                  {PRO_TYPES.find((type) => type.value === record.assessment_type)?.label ?? record.assessment_type}
                </span>
                <span className="text-xs text-slate-500">
                  {format(new Date(record.assessment_date), 'dd MMM yyyy')}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                Score: {record.total_score ?? 'Pending'}
              </p>
              <pre className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2 whitespace-pre-wrap">
                {JSON.stringify(record.assessment_data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl p-4 text-center">
          No patient-reported outcomes documented yet. Capture assessments to trend quality-of-life.
        </div>
      )}

      {trends.length ? (
        <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
          <div className="flex items-center gap-2">
            <LineChart className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-800">Trend summary</p>
          </div>
          <div className="grid gap-2 text-xs text-slate-500">
            {trends.slice(-5).map((entry, idx) => (
              <div key={`${entry.assessment_date}-${idx}`} className="flex items-center justify-between">
                <span>{formatDateSafe(entry.assessment_date)}</span>
                <span className="font-semibold text-slate-700">{entry.assessment_type}</span>
                <span>Score: {entry.total_score ?? 'n/a'}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default OncologyPROs;

