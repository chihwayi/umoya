import React from 'react';
import { Beaker, ClipboardCheck, Loader2, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type Props = {
  tenantSlug: string;
  token: string;
  caseId: string;
};

const STATUS_BADGES: Record<string, string> = {
  screening: 'bg-amber-100 text-amber-700',
  enrolled: 'bg-blue-100 text-blue-700',
  on_treatment: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  withdrawn: 'bg-rose-100 text-rose-700',
};

const OncologyClinicalTrials: React.FC<Props> = ({ tenantSlug, token, caseId }) => {
  const { showError, showSuccess } = useNotification();
  const [trials, setTrials] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    trialName: '',
    trialId: '',
    trialPhase: '',
    enrollmentDate: '',
    enrollmentStatus: 'screening',
    protocolCompliancePercentage: '',
    notes: '',
  });

  const loadTrials = React.useCallback(async () => {
    if (!tenantSlug || !token || !caseId) return;
    setLoading(true);
    try {
      const response = await ehrApi.getOncologyClinicalTrials(tenantSlug, token, caseId);
      setTrials(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load clinical trials', error);
      showError('Unable to load clinical trials', 'Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [caseId, showError, tenantSlug, token]);

  React.useEffect(() => {
    loadTrials();
  }, [loadTrials]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug || !token) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        trialName: form.trialName,
        trialPhase: form.trialPhase || null,
        enrollmentStatus: form.enrollmentStatus,
        notes: form.notes || null,
      };
      if (form.trialId) payload.trialId = form.trialId;
      if (form.enrollmentDate) payload.enrollmentDate = form.enrollmentDate;
      if (form.protocolCompliancePercentage) {
        payload.protocolCompliancePercentage = Number(form.protocolCompliancePercentage);
      }

      await ehrApi.enrollOncologyClinicalTrial(tenantSlug, token, caseId, payload);
      showSuccess('Trial enrollment recorded', 'Patient has been linked to the trial.');
      setForm({
        trialName: '',
        trialId: '',
        trialPhase: '',
        enrollmentDate: '',
        enrollmentStatus: 'screening',
        protocolCompliancePercentage: '',
        notes: '',
      });
      setFormOpen(false);
      await loadTrials();
    } catch (error) {
      console.error('Failed to enroll trial', error);
      showError('Unable to enroll patient in trial', 'Verify fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Clinical Trials</h3>
          <p className="text-xs text-slate-500">Protocol enrollment, compliance and status tracking.</p>
        </div>
        <button
          onClick={() => setFormOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
        >
          {formOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {formOpen ? 'Close' : 'Enroll Trial'}
        </button>
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-slate-600">
              Trial name
              <input
                type="text"
                name="trialName"
                value={form.trialName}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Trial ID / NCT
              <input
                type="text"
                name="trialId"
                value={form.trialId}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs text-slate-600">
              Phase
              <input
                type="text"
                name="trialPhase"
                value={form.trialPhase}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Phase II"
              />
            </label>
            <label className="text-xs text-slate-600">
              Enrollment date
              <input
                type="date"
                name="enrollmentDate"
                value={form.enrollmentDate}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Status
              <select
                name="enrollmentStatus"
                value={form.enrollmentStatus}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="screening">Screening</option>
                <option value="enrolled">Enrolled</option>
                <option value="on_treatment">On treatment</option>
                <option value="completed">Completed</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>
          </div>
          <label className="text-xs text-slate-600">
            Protocol compliance (%)
            <input
              type="number"
              min={0}
              max={100}
              name="protocolCompliancePercentage"
              value={form.protocolCompliancePercentage}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="e.g. 92"
            />
          </label>
          <label className="text-xs text-slate-600">
            Notes
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Eligibility criteria, biomarkers, bridging therapy, etc."
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
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Enroll Trial'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading clinical trials...
          </div>
        ) : trials.length ? (
          trials.map((trial) => {
            const badge = STATUS_BADGES[trial.enrollment_status] ?? 'bg-slate-100 text-slate-600';
            return (
              <div key={trial.id} className="border border-slate-200 rounded-xl bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{trial.trial_name}</p>
                    <p className="text-xs text-slate-500">
                      {trial.trial_phase ? `Phase ${trial.trial_phase}` : 'Phase n/a'} •{' '}
                      {trial.trial_id || 'ID n/a'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${badge}`}>
                    {String(trial.enrollment_status || '').replace(/_/g, ' ') || 'Screening'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Beaker className="w-3.5 h-3.5 text-indigo-500" />
                    {trial.enrollment_date ? format(new Date(trial.enrollment_date), 'dd MMM yyyy') : 'No date'}
                  </span>
                  {trial.protocol_compliance_percentage !== null && trial.protocol_compliance_percentage !== undefined && (
                    <span className="inline-flex items-center gap-1">
                      <ClipboardCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Compliance {trial.protocol_compliance_percentage}%
                    </span>
                  )}
                </div>
                {trial.notes && <p className="text-xs text-slate-600">{trial.notes}</p>}
              </div>
            );
          })
        ) : (
          <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl p-4 text-center">
            No clinical trials recorded yet. Enroll the patient to begin tracking protocol activity.
          </div>
        )}
      </div>
    </div>
  );
};

export default OncologyClinicalTrials;

