import React from 'react';
import { CalendarDays, ClipboardList, HeartPulse, LifeBuoy, Plus, Stethoscope, X } from 'lucide-react';
import { format } from 'date-fns';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type Props = {
  tenantSlug: string;
  token: string;
  caseId: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch {
    return value;
  }
};

const OncologySurvivorshipPlan: React.FC<Props> = ({ tenantSlug, token, caseId }) => {
  const { showError, showSuccess } = useNotification();
  const [plan, setPlan] = React.useState<any | null>(null);
  const [upcoming, setUpcoming] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    treatmentCompletionDate: '',
    recurrenceRisk: '',
    lifestyleRecommendations: '',
    longTermSideEffectsText: '',
    followUpScheduleText: '',
    imagingScheduleText: '',
  });

  const initializeForm = React.useCallback((incoming?: any | null) => {
    setForm({
      treatmentCompletionDate: incoming?.treatment_completion_date ?? '',
      recurrenceRisk: incoming?.recurrence_risk ?? '',
      lifestyleRecommendations: incoming?.lifestyle_recommendations ?? '',
      longTermSideEffectsText: Array.isArray(incoming?.long_term_side_effects)
        ? incoming.long_term_side_effects.join(', ')
        : '',
      followUpScheduleText: incoming?.follow_up_schedule
        ? JSON.stringify(incoming.follow_up_schedule, null, 2)
        : '',
      imagingScheduleText: incoming?.surveillance_imaging_schedule
        ? JSON.stringify(incoming.surveillance_imaging_schedule, null, 2)
        : '',
    });
  }, []);

  const loadData = React.useCallback(async () => {
    if (!tenantSlug || !token || !caseId) return;
    setLoading(true);
    try {
      const [planResp, upcomingResp] = await Promise.all([
        ehrApi.getOncologySurvivorshipPlan(tenantSlug, token, caseId),
        ehrApi.getOncologyUpcomingFollowUps(tenantSlug, token, caseId),
      ]);
      const fetchedPlan = planResp?.data ?? null;
      setPlan(fetchedPlan);
      initializeForm(fetchedPlan);
      setUpcoming(Array.isArray(upcomingResp?.data) ? upcomingResp.data : []);
    } catch (error) {
      console.error('Failed to load survivorship data', error);
      showError('Unable to load survivorship plan', 'Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [caseId, initializeForm, showError, tenantSlug, token]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug || !token) return;
    let followUpSchedule: any | undefined;
    let imagingSchedule: any | undefined;
    try {
      followUpSchedule = form.followUpScheduleText ? JSON.parse(form.followUpScheduleText) : undefined;
    } catch (error) {
      showError('Invalid follow-up JSON', 'Please provide valid JSON for follow-up schedule.');
      return;
    }
    try {
      imagingSchedule = form.imagingScheduleText ? JSON.parse(form.imagingScheduleText) : undefined;
    } catch (error) {
      showError('Invalid imaging JSON', 'Please provide valid JSON for imaging schedule.');
      return;
    }

    const payload: Record<string, any> = {
      treatmentCompletionDate: form.treatmentCompletionDate || null,
      recurrenceRisk: form.recurrenceRisk || null,
      lifestyleRecommendations: form.lifestyleRecommendations || null,
      longTermSideEffects: form.longTermSideEffectsText
        ? form.longTermSideEffectsText.split(',').map((item) => item.trim()).filter(Boolean)
        : [],
      followUpSchedule,
      surveillanceImagingSchedule: imagingSchedule,
    };

    setSaving(true);
    try {
      if (plan?.id) {
        await ehrApi.updateOncologySurvivorshipPlan(tenantSlug, token, plan.id, payload);
        showSuccess('Plan updated', 'Survivorship plan has been refreshed.');
      } else {
        await ehrApi.createOncologySurvivorshipPlan(tenantSlug, token, caseId, payload);
        showSuccess('Plan created', 'Survivorship plan is now active.');
      }
      setEditing(false);
      await loadData();
    } catch (error) {
      console.error('Failed to save survivorship plan', error);
      showError('Unable to save survivorship plan', 'Review the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 border border-slate-200 rounded-2xl bg-white text-sm text-slate-500">
        Loading survivorship plan...
      </div>
    );
  }

  const nextDue = upcoming?.[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Survivorship Care Plan</h3>
          <p className="text-xs text-slate-500">
            Follow-up cadence, surveillance imaging, and lifestyle guidance for post-treatment care.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing((prev) => !prev);
            initializeForm(plan);
          }}
          className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
        >
          {editing ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {editing ? 'Cancel' : plan ? 'Edit Plan' : 'Create Plan'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <Stethoscope className="w-3.5 h-3.5 text-indigo-500" />
            Treatment completion
          </p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {formatDate(plan?.treatment_completion_date)}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
            Recurrence risk
          </p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {plan?.recurrence_risk ? plan.recurrence_risk : 'Not provided'}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
            Next follow-up
          </p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {nextDue ? formatDate(nextDue.dueDate) : 'No events scheduled'}
          </p>
          {nextDue?.tests?.length ? (
            <p className="text-xs text-slate-500 mt-1">Tests: {nextDue.tests.join(', ')}</p>
          ) : null}
        </div>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="border border-slate-200 rounded-2xl p-4 bg-white space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-slate-600">
              Treatment completion date
              <input
                type="date"
                name="treatmentCompletionDate"
                value={form.treatmentCompletionDate}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              Recurrence risk
              <select
                name="recurrenceRisk"
                value={form.recurrenceRisk}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Not specified</option>
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <label className="text-xs text-slate-600 block">
            Long-term side effects (comma separated)
            <input
              type="text"
              name="longTermSideEffectsText"
              value={form.longTermSideEffectsText}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Neuropathy, cardiotoxicity, endocrine changes..."
            />
          </label>

          <label className="text-xs text-slate-600 block">
            Lifestyle recommendations
            <textarea
              name="lifestyleRecommendations"
              value={form.lifestyleRecommendations}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              placeholder="Nutrition, exercise, psychosocial support, survivorship navigation..."
            />
          </label>

          <label className="text-xs text-slate-600 block">
            Follow-up schedule JSON
            <textarea
              name="followUpScheduleText"
              value={form.followUpScheduleText}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
              rows={6}
              placeholder={`{
  "visits": [
    { "interval_months": 3, "duration_months": 24, "tests": ["CBC"], "imaging": ["CT chest"] }
  ]
}`}
            />
          </label>

          <label className="text-xs text-slate-600 block">
            Surveillance imaging schedule JSON
            <textarea
              name="imagingScheduleText"
              value={form.imagingScheduleText}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
              rows={4}
              placeholder={`{
  "modality": "CT chest/abdomen/pelvis",
  "frequency_months": 12
}`}
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                initializeForm(plan);
              }}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      )}

      {!editing && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-indigo-500" />
              <p className="text-sm font-semibold text-slate-800">Follow-up schedule</p>
            </div>
            {plan?.follow_up_schedule?.visits?.length ? (
              <ul className="space-y-2 text-sm text-slate-600">
                {plan.follow_up_schedule.visits.map((visit: any, index: number) => (
                  <li key={`visit-${index}`} className="border border-slate-100 rounded-lg p-3 bg-slate-50">
                    Every {visit.interval_months ?? '?'} months • Duration {visit.duration_months ?? '?'} months
                    {visit.tests?.length ? <p className="text-xs text-slate-500 mt-1">Tests: {visit.tests.join(', ')}</p> : null}
                    {visit.imaging?.length ? (
                      <p className="text-xs text-slate-500 mt-1">Imaging: {visit.imaging.join(', ')}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No follow-up cadence documented.</p>
            )}
          </div>

          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <div className="flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-800">Supportive care & lifestyle</p>
            </div>
            {plan?.long_term_side_effects?.length ? (
              <div className="flex flex-wrap gap-2">
                {plan.long_term_side_effects.map((effect: string) => (
                  <span
                    key={effect}
                    className="px-2 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100"
                  >
                    {effect}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No side effects documented.</p>
            )}
            <p className="text-sm text-slate-600 whitespace-pre-wrap">
              {plan?.lifestyle_recommendations ??
                'Provide nutrition, exercise, mental health, and survivorship navigation guidance.'}
            </p>
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-sky-500" />
          <p className="text-sm font-semibold text-slate-800">Upcoming follow-ups (next 6 months)</p>
        </div>
        {upcoming.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {upcoming.map((event, idx) => (
              <div key={`${event.dueDate}-${idx}`} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                <p className="text-sm font-semibold text-slate-800">{formatDate(event.dueDate)}</p>
                <p className="text-xs text-slate-500">Interval: every {event.intervalMonths} months</p>
                {event.tests?.length ? (
                  <p className="text-xs text-slate-500 mt-1">Tests: {event.tests.join(', ')}</p>
                ) : null}
                {event.imaging?.length ? (
                  <p className="text-xs text-slate-500 mt-1">Imaging: {event.imaging.join(', ')}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No upcoming visits within the next six months.</p>
        )}
      </div>
    </div>
  );
};

export default OncologySurvivorshipPlan;