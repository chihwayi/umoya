import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, HeartHandshake, Loader2 } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type OncologyFinancialToxicityProps = {
  tenantSlug: string;
  token: string;
  caseId?: string | null;
};

const defaultFormState = {
  assessmentDate: '',
  totalCostToDate: '',
  insuranceCoverageTotal: '',
  outOfPocketTotal: '',
  financialAssistanceTotal: '',
  financialStressScore: '5',
  notes: '',
};

const OncologyFinancialToxicity: React.FC<OncologyFinancialToxicityProps> = ({ tenantSlug, token, caseId }) => {
  const { showError, showSuccess } = useNotification();
  const [summary, setSummary] = useState<any>(null);
  const [assistance, setAssistance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState(defaultFormState);

  const hasCase = useMemo(() => Boolean(caseId && tenantSlug && token), [caseId, tenantSlug, token]);

  const loadFinancials = useCallback(async () => {
    if (!hasCase) return;
    setLoading(true);
    try {
      const [summaryResp, assistanceResp] = await Promise.all([
        ehrApi.getOncologyFinancialSummary(tenantSlug, token, caseId!),
        ehrApi.getOncologyFinancialAssistance(tenantSlug, token, caseId!),
      ]);
      setSummary(summaryResp.data);
      setAssistance(assistanceResp.data);
    } catch (error) {
      console.error('Failed to load financial toxicity summary', error);
      showError('Unable to load financial snapshot', 'Please retry shortly.');
    } finally {
      setLoading(false);
    }
  }, [caseId, hasCase, showError, tenantSlug, token]);

  useEffect(() => {
    loadFinancials();
  }, [loadFinancials]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasCase) return;
    setSubmitting(true);
    try {
      const payload = {
        assessmentDate: formState.assessmentDate || new Date().toISOString().slice(0, 10),
        totalCostToDate: formState.totalCostToDate ? Number(formState.totalCostToDate) : undefined,
        insuranceCoverageTotal: formState.insuranceCoverageTotal
          ? Number(formState.insuranceCoverageTotal)
          : undefined,
        outOfPocketTotal: formState.outOfPocketTotal ? Number(formState.outOfPocketTotal) : undefined,
        financialAssistanceTotal: formState.financialAssistanceTotal
          ? Number(formState.financialAssistanceTotal)
          : undefined,
        financialStressScore: formState.financialStressScore ? Number(formState.financialStressScore) : undefined,
        notes: formState.notes || undefined,
      };
      await ehrApi.recordOncologyFinancialToxicity(tenantSlug, token, caseId!, payload);
      showSuccess('Financial toxicity captured', 'Finance + navigation teams can take action.');
      setFormState(defaultFormState);
      await loadFinancials();
    } catch (error) {
      console.error('Failed to record financial toxicity', error);
      showError('Unable to save financial entry', 'Please review the values and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 text-slate-100 shadow-xl shadow-rose-900/10">
      <div className="flex items-center justify-between border-b border-slate-800/80 px-4 p-4">
        <div className="flex items-center gap-3">
          <CreditCard className="text-rose-300" size={20} />
          <div>
            <p className="text-lg font-semibold">Financial Toxicity Dashboard</p>
            <p className="text-xs text-slate-400">
              Track patient cost exposure and route to assistance programs.
            </p>
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800/70 p-4 bg-slate-900/60">
            <p className="text-sm text-slate-400 uppercase tracking-wide mb-2">Latest Snapshot</p>
            {summary?.latestAssessment ? (
              <div className="space-y-2 text-sm">
                <p className="text-slate-200">
                  Assessment Date:{' '}
                  <span className="font-semibold text-white">
                    {new Date(summary.latestAssessment.assessment_date).toLocaleDateString()}
                  </span>
                </p>
                <p className="text-slate-200">
                  Total Cost:{' '}
                  <span className="font-semibold">
                    {summary.latestAssessment.total_cost_to_date
                      ? `$${Number(summary.latestAssessment.total_cost_to_date).toLocaleString()}`
                      : 'N/A'}
                  </span>
                </p>
                <p className="text-slate-200">
                  Out-of-pocket:{' '}
                  <span className="font-semibold">
                    {summary.latestAssessment.out_of_pocket_total
                      ? `$${Number(summary.latestAssessment.out_of_pocket_total).toLocaleString()}`
                      : 'N/A'}
                  </span>
                </p>
                <p className="text-slate-200">
                  Stress Score:{' '}
                  <span
                    className={`font-semibold ${
                      summary.stressFlag ? 'text-rose-300' : 'text-emerald-300'
                    }`}
                  >
                    {summary.latestAssessment.financial_stress_score ?? 'N/A'}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No financial assessments captured yet.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800/70 p-4 bg-slate-900/60">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-200">
              <HeartHandshake size={16} className="text-emerald-300" />
              Assistance Programs
            </div>
            <div className="space-y-2 text-sm">
              {Array.isArray(assistance?.activePrograms) && assistance.activePrograms.length > 0 ? (
                assistance.activePrograms.map((program: string) => (
                  <div key={program} className="flex items-center justify-between">
                    <span className="text-slate-300">{program}</span>
                    <span className="text-emerald-300 text-xs">Active</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-sm">No active programs recorded.</p>
              )}
            </div>
            <div className="mt-4 space-y-2 text-xs text-slate-400">
              {Array.isArray(assistance?.suggestedPrograms) &&
                assistance.suggestedPrograms.map((program: any) => (
                  <div key={program.program} className="border border-slate-800 rounded-xl p-2">
                    <p className="text-slate-200 font-semibold">{program.program}</p>
                    <p>{program.description}</p>
                    <a
                      className="text-emerald-300 hover:text-emerald-100"
                      href={program.contact}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Details
                    </a>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800/70 p-4 bg-slate-900/70 space-y-3">
          <p className="text-sm text-slate-400 uppercase tracking-wide">Add Assessment</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-xs text-slate-400 gap-1">
              Assessment Date
              <input
                type="date"
                name="assessmentDate"
                value={formState.assessmentDate}
                onChange={handleChange}
                className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring focus:ring-emerald-500/40"
              />
            </label>
            <label className="flex flex-col text-xs text-slate-400 gap-1">
              Stress Score (1-10)
              <input
                type="number"
                min={1}
                max={10}
                name="financialStressScore"
                value={formState.financialStressScore}
                onChange={handleChange}
                className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring focus:ring-emerald-500/40"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-xs text-slate-400 gap-1">
              Total Cost to Date
              <input
                type="number"
                name="totalCostToDate"
                value={formState.totalCostToDate}
                onChange={handleChange}
                className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring focus:ring-emerald-500/40"
                placeholder="12000"
              />
            </label>
            <label className="flex flex-col text-xs text-slate-400 gap-1">
              Insurance Covered
              <input
                type="number"
                name="insuranceCoverageTotal"
                value={formState.insuranceCoverageTotal}
                onChange={handleChange}
                className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring focus:ring-emerald-500/40"
                placeholder="8000"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-xs text-slate-400 gap-1">
              Out of Pocket
              <input
                type="number"
                name="outOfPocketTotal"
                value={formState.outOfPocketTotal}
                onChange={handleChange}
                className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring focus:ring-emerald-500/40"
                placeholder="2400"
              />
            </label>
            <label className="flex flex-col text-xs text-slate-400 gap-1">
              Assistance Received
              <input
                type="number"
                name="financialAssistanceTotal"
                value={formState.financialAssistanceTotal}
                onChange={handleChange}
                className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring focus:ring-emerald-500/40"
                placeholder="450"
              />
            </label>
          </div>
          <label className="flex flex-col text-xs text-slate-400 gap-1">
            Notes
            <textarea
              name="notes"
              value={formState.notes}
              onChange={handleChange}
              rows={3}
              className="rounded-2xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring focus:ring-emerald-500/40 resize-none"
              placeholder="Co-pay assistance pending approval..."
            />
          </label>
          <button
            type="submit"
            disabled={!hasCase || submitting}
            className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-amber-400 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Record Assessment'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OncologyFinancialToxicity;

