import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle, FileText, Printer, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';

type CdpaStatus = 'compliant' | 'partial' | 'non_compliant' | 'not_assessed' | 'not_applicable';

interface CdpaControl {
  id: string;
  control_id: string;
  category: string;
  control_name: string;
  requirement: string;
  status: CdpaStatus;
  evidence_url?: string | null;
  evidence_notes?: string | null;
  owner?: string | null;
  last_reviewed?: string | null;
  next_review?: string | null;
}

const statusLabel: Record<CdpaStatus, string> = {
  compliant: 'Compliant',
  partial: 'Partial',
  non_compliant: 'Non-compliant',
  not_assessed: 'Not assessed',
  not_applicable: 'N/A',
};

const statusClass: Record<CdpaStatus, string> = {
  compliant: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  non_compliant: 'bg-rose-50 text-rose-700 border-rose-200',
  not_assessed: 'bg-slate-100 text-slate-600 border-slate-200',
  not_applicable: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const toInputDate = (value?: string | null) => (value ? String(value).slice(0, 10) : '');

const CdpaCompliancePage: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';

  const [controls, setControls] = useState<CdpaControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadControls = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getCdpaControls(token, tenantSlug || '');
      setControls(response.data || []);
    } catch (err: any) {
      showError('Unable to load CDPA controls', err?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [showError, tenantSlug, token]);

  useEffect(() => {
    loadControls();
  }, [loadControls]);

  const grouped = useMemo(() => {
    return controls.reduce<Record<string, CdpaControl[]>>((acc, control) => {
      acc[control.category] = [...(acc[control.category] || []), control];
      return acc;
    }, {});
  }, [controls]);

  const compliant = controls.filter((control) => control.status === 'compliant').length;
  const score = controls.length ? Math.round((compliant / controls.length) * 100) : 0;

  const updateLocal = (id: string, patch: Partial<CdpaControl>) => {
    setControls((current) => current.map((control) => (control.id === id ? { ...control, ...patch } : control)));
  };

  const saveControl = async (control: CdpaControl) => {
    try {
      setSavingId(control.id);
      const response = await ehrApi.updateCdpaControl(token, tenantSlug || '', control.id, {
        status: control.status,
        evidenceUrl: control.evidence_url,
        evidenceNotes: control.evidence_notes,
        owner: control.owner,
        lastReviewed: toInputDate(control.last_reviewed) || null,
        nextReview: toInputDate(control.next_review) || null,
      });
      setControls((current) => current.map((item) => (item.id === control.id ? response.data : item)));
      showSuccess('CDPA control updated', control.control_id);
    } catch (err: any) {
      showError('Update failed', err?.message || 'Unable to update this control.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/ehr/${tenantSlug}/dashboard`)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-100" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Zimbabwe CDPA 2021</p>
              <h1 className="text-2xl font-bold text-slate-950">Compliance Controls</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={loadControls} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
              <Printer className="h-4 w-4" /> Export PDF
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold">Overall score</h2>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black text-slate-950">{score}%</span>
              <span className="pb-2 text-sm text-slate-500">{compliant} of {controls.length} controls compliant</span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${score}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['compliant', 'partial', 'non_compliant', 'not_assessed'] as CdpaStatus[]).map((status) => (
              <div key={status} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{statusLabel[status]}</p>
                <p className="mt-2 text-2xl font-black">{controls.filter((control) => control.status === status).length}</p>
              </div>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">Loading controls...</div>
        ) : (
          Object.entries(grouped).map(([category, categoryControls]) => {
            const categoryCompliant = categoryControls.filter((control) => control.status === 'compliant').length;
            const categoryScore = Math.round((categoryCompliant / categoryControls.length) * 100);
            return (
              <section key={category} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <h2 className="font-bold text-slate-950">{category}</h2>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <span>{categoryScore}% compliant</span>
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${categoryScore}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {categoryControls.map((control) => (
                    <div key={control.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{control.control_id}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass[control.status]}`}>
                            {statusLabel[control.status]}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-950">{control.control_name}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{control.requirement}</p>
                        {control.evidence_url && (
                          <a className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700" href={control.evidence_url} target="_blank" rel="noreferrer">
                            <FileText className="h-4 w-4" /> Evidence
                          </a>
                        )}
                      </div>
                      <div className="space-y-2">
                        <select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={control.status} onChange={(event) => updateLocal(control.id, { status: event.target.value as CdpaStatus })}>
                          {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Evidence URL" value={control.evidence_url || ''} onChange={(event) => updateLocal(control.id, { evidence_url: event.target.value })} />
                        <textarea className="min-h-[70px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Evidence notes" value={control.evidence_notes || ''} onChange={(event) => updateLocal(control.id, { evidence_notes: event.target.value })} />
                        <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Owner" value={control.owner || ''} onChange={(event) => updateLocal(control.id, { owner: event.target.value })} />
                        <div className="grid grid-cols-2 gap-2">
                          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="date" value={toInputDate(control.last_reviewed)} onChange={(event) => updateLocal(control.id, { last_reviewed: event.target.value })} />
                          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="date" value={toInputDate(control.next_review)} onChange={(event) => updateLocal(control.id, { next_review: event.target.value })} />
                        </div>
                        <button onClick={() => saveControl(control)} disabled={savingId === control.id} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                          {savingId === control.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : control.status === 'compliant' ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                          Save control
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CdpaCompliancePage;
