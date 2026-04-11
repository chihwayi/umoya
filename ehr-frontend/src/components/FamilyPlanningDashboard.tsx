import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Pill, RefreshCw } from 'lucide-react';
import { familyPlanningApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type TabKey = 'current' | 'visit' | 'history';

const mecBadge: Record<number, string> = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-yellow-100 text-yellow-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700',
};

const sideEffectOptions = ['spotting', 'amenorrhoea', 'weight_gain', 'headache', 'nausea', 'pelvic_pain'];

export default function FamilyPlanningDashboard({ patientId }: { patientId: string }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';

  const [tab, setTab] = useState<TabKey>('current');
  const [methods, setMethods] = useState<any[]>([]);
  const [activeEnrollment, setActiveEnrollment] = useState<any | null>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [mecResult, setMecResult] = useState<any | null>(null);
  const [enrollmentForm, setEnrollmentForm] = useState({
    method: 'implant',
    methodDetail: '',
    enrolledAt: new Date().toISOString().slice(0, 10),
    insertionDate: '',
    expiryDate: '',
    nextVisitDate: '',
    notes: '',
  });
  const [eligibilityForm, setEligibilityForm] = useState({
    age: '',
    parity: '',
    breastfeedingWeeksPostpartum: '',
    bmi: '',
    smoking: false,
    hypertension: false,
    systolicBp: '',
    diabetes: false,
    hivPositive: false,
    arvRegimen: 'none',
    priorDvtOrPe: false,
    migraineWithAura: false,
    liverDisease: false,
    breastCancerHistory: false,
  });
  const [followupForm, setFollowupForm] = useState({
    enrollmentId: '',
    visitDate: new Date().toISOString().slice(0, 10),
    continuing: true,
    sideEffects: [] as string[],
    sideEffectSeverity: 'mild',
    methodChange: false,
    newMethod: '',
    counsellingGiven: true,
    notes: '',
    nextVisitDate: '',
  });

  const activeEnrollmentId = useMemo(
    () => followupForm.enrollmentId || activeEnrollment?.id || '',
    [followupForm.enrollmentId, activeEnrollment],
  );

  const loadData = async () => {
    if (!tenantSlug || !token) return;
    try {
      const [methodCatalog, currentEnrollment, history, visits] = await Promise.all([
        familyPlanningApi.getMethods(token, tenantSlug),
        familyPlanningApi.getActiveEnrollment(patientId, token, tenantSlug),
        familyPlanningApi.getEnrollments(patientId, token, tenantSlug),
        familyPlanningApi.getFollowups(patientId, token, tenantSlug),
      ]);
      setMethods(Array.isArray(methodCatalog?.methods) ? methodCatalog.methods : []);
      setActiveEnrollment(currentEnrollment || null);
      setEnrollments(Array.isArray(history) ? history : []);
      setFollowups(Array.isArray(visits) ? visits : []);
      setFollowupForm((current) => ({
        ...current,
        enrollmentId: current.enrollmentId || currentEnrollment?.id || '',
      }));
    } catch {
      showError('Family planning', 'Failed to load family planning records.');
    }
  };

  useEffect(() => {
    void loadData();
  }, [patientId, tenantSlug]);

  const runEligibility = async () => {
    if (!tenantSlug || !token) return;
    try {
      const result = await familyPlanningApi.getMethodEligibility(
        {
          age: eligibilityForm.age ? Number(eligibilityForm.age) : null,
          parity: eligibilityForm.parity ? Number(eligibilityForm.parity) : null,
          breastfeeding_weeks_postpartum: eligibilityForm.breastfeedingWeeksPostpartum ? Number(eligibilityForm.breastfeedingWeeksPostpartum) : null,
          bmi: eligibilityForm.bmi ? Number(eligibilityForm.bmi) : null,
          smoking: eligibilityForm.smoking,
          hypertension: eligibilityForm.hypertension,
          systolic_bp: eligibilityForm.systolicBp ? Number(eligibilityForm.systolicBp) : null,
          diabetes: eligibilityForm.diabetes,
          hiv_positive: eligibilityForm.hivPositive,
          arv_regimen: eligibilityForm.arvRegimen,
          prior_dvt_or_pe: eligibilityForm.priorDvtOrPe,
          migraine_with_aura: eligibilityForm.migraineWithAura,
          liver_disease: eligibilityForm.liverDisease,
          breast_cancer_history: eligibilityForm.breastCancerHistory,
        },
        token,
        tenantSlug,
      );
      setMecResult(result);
      showSuccess('MEC eligibility', 'Eligibility assessment generated.');
    } catch (error: any) {
      showError('MEC eligibility', error?.response?.data?.message || 'Failed to calculate eligibility.');
    }
  };

  const saveEnrollment = async () => {
    if (!tenantSlug || !token) return;
    try {
      const chosenMethod = mecResult?.methods?.find((item: any) => item.method === enrollmentForm.method);
      await familyPlanningApi.enroll(
        patientId,
        {
          method: enrollmentForm.method,
          methodDetail: enrollmentForm.methodDetail || null,
          enrolledAt: enrollmentForm.enrolledAt,
          mecCategory: chosenMethod?.mec_category ?? null,
          insertionDate: enrollmentForm.insertionDate || null,
          expiryDate: enrollmentForm.expiryDate || null,
          nextVisitDate: enrollmentForm.nextVisitDate || null,
          notes: enrollmentForm.notes || null,
        },
        token,
        tenantSlug,
      );
      showSuccess('Family planning', 'Enrollment saved.');
      setEnrollmentForm((current) => ({
        ...current,
        methodDetail: '',
        insertionDate: '',
        expiryDate: '',
        nextVisitDate: '',
        notes: '',
      }));
      await loadData();
    } catch (error: any) {
      showError('Family planning', error?.response?.data?.message || 'Failed to save enrollment.');
    }
  };

  const saveFollowup = async () => {
    if (!tenantSlug || !token) return;
    try {
      await familyPlanningApi.recordFollowup(
        patientId,
        {
          enrollmentId: activeEnrollmentId || null,
          visitDate: followupForm.visitDate,
          continuing: followupForm.continuing,
          sideEffects: followupForm.sideEffects,
          sideEffectSeverity: followupForm.sideEffects.length ? followupForm.sideEffectSeverity : null,
          methodChange: followupForm.methodChange,
          newMethod: followupForm.methodChange ? followupForm.newMethod || null : null,
          counsellingGiven: followupForm.counsellingGiven,
          notes: followupForm.notes || null,
          nextVisitDate: followupForm.nextVisitDate || null,
        },
        token,
        tenantSlug,
      );
      showSuccess('Family planning', 'Follow-up recorded.');
      setFollowupForm({
        enrollmentId: activeEnrollmentId || '',
        visitDate: new Date().toISOString().slice(0, 10),
        continuing: true,
        sideEffects: [],
        sideEffectSeverity: 'mild',
        methodChange: false,
        newMethod: '',
        counsellingGiven: true,
        notes: '',
        nextVisitDate: '',
      });
      await loadData();
    } catch (error: any) {
      showError('Family planning', error?.response?.data?.message || 'Failed to record follow-up.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'current', label: 'Current Method', icon: Pill },
          { key: 'visit', label: 'Record Visit', icon: ClipboardList },
          { key: 'history', label: 'History', icon: RefreshCw },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as TabKey)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === item.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'current' && (
        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Active Enrollment</h3>
            {activeEnrollment ? (
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <p><span className="font-semibold">Method:</span> {activeEnrollment.method}</p>
                <p><span className="font-semibold">Enrolled:</span> {activeEnrollment.enrolledAt || activeEnrollment.enrolled_at}</p>
                <p><span className="font-semibold">Expiry:</span> {activeEnrollment.expiryDate || activeEnrollment.expiry_date || 'N/A'}</p>
                <p><span className="font-semibold">Next visit:</span> {activeEnrollment.nextVisitDate || activeEnrollment.next_visit_date || 'N/A'}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No active method recorded.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Enrol / Switch Method</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select value={enrollmentForm.method} onChange={(e) => setEnrollmentForm((c) => ({ ...c, method: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {methods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <input value={enrollmentForm.methodDetail} onChange={(e) => setEnrollmentForm((c) => ({ ...c, methodDetail: e.target.value }))} placeholder="Method detail / brand" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input type="date" value={enrollmentForm.enrolledAt} onChange={(e) => setEnrollmentForm((c) => ({ ...c, enrolledAt: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input type="date" value={enrollmentForm.insertionDate} onChange={(e) => setEnrollmentForm((c) => ({ ...c, insertionDate: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Insertion date" />
              <input type="date" value={enrollmentForm.expiryDate} onChange={(e) => setEnrollmentForm((c) => ({ ...c, expiryDate: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input type="date" value={enrollmentForm.nextVisitDate} onChange={(e) => setEnrollmentForm((c) => ({ ...c, nextVisitDate: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={eligibilityForm.age} onChange={(e) => setEligibilityForm((c) => ({ ...c, age: e.target.value }))} placeholder="Age" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={eligibilityForm.systolicBp} onChange={(e) => setEligibilityForm((c) => ({ ...c, systolicBp: e.target.value }))} placeholder="Systolic BP" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={eligibilityForm.arvRegimen} onChange={(e) => setEligibilityForm((c) => ({ ...c, arvRegimen: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['none', 'efv_nvp', 'pi_based', 'dtg'].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2 md:col-span-2 text-sm text-slate-700">
                {[
                  ['smoking', 'Smoking'],
                  ['hypertension', 'Hypertension'],
                  ['diabetes', 'Diabetes'],
                  ['hivPositive', 'HIV positive'],
                  ['priorDvtOrPe', 'Prior DVT/PE'],
                  ['migraineWithAura', 'Migraine with aura'],
                  ['liverDisease', 'Liver disease'],
                  ['breastCancerHistory', 'Breast cancer history'],
                ].map(([key, label]) => (
                  <label key={key} className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={(eligibilityForm as any)[key]} onChange={(e) => setEligibilityForm((c) => ({ ...c, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
              <textarea value={enrollmentForm.notes} onChange={(e) => setEnrollmentForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Notes" className="md:col-span-2 min-h-[96px] rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => void runEligibility()} className="rounded-xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-200">
                Run MEC check
              </button>
              <button type="button" onClick={() => void saveEnrollment()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Save enrollment
              </button>
            </div>

            {mecResult && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-semibold text-slate-900">WHO MEC eligibility</p>
                </div>
                <div className="mt-3 space-y-2">
                  {mecResult.methods?.map((item: any) => (
                    <div key={item.method} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.method}</p>
                        <p className="mt-1 text-xs text-slate-600">{item.notes}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${mecBadge[item.mec_category] || mecBadge[1]}`}>
                        Category {item.mec_category}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-600">Recommended: {(mecResult.recommended || []).join(', ') || 'None'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'visit' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Record Follow-up Visit</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <select value={followupForm.enrollmentId} onChange={(e) => setFollowupForm((c) => ({ ...c, enrollmentId: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select enrollment</option>
              {enrollments.map((item) => <option key={item.id} value={item.id}>{item.method} • {item.status}</option>)}
            </select>
            <input type="date" value={followupForm.visitDate} onChange={(e) => setFollowupForm((c) => ({ ...c, visitDate: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={followupForm.continuing} onChange={(e) => setFollowupForm((c) => ({ ...c, continuing: e.target.checked }))} />
              Continuing current method
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={followupForm.counsellingGiven} onChange={(e) => setFollowupForm((c) => ({ ...c, counsellingGiven: e.target.checked }))} />
              Counselling given
            </label>
            <div className="md:col-span-2">
              <p className="mb-2 text-sm font-medium text-slate-700">Side effects</p>
              <div className="grid grid-cols-2 gap-2">
                {sideEffectOptions.map((item) => (
                  <label key={item} className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={followupForm.sideEffects.includes(item)}
                      onChange={(e) => setFollowupForm((current) => ({
                        ...current,
                        sideEffects: e.target.checked
                          ? [...current.sideEffects, item]
                          : current.sideEffects.filter((entry) => entry !== item),
                      }))}
                    />
                    {item.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
            <select value={followupForm.sideEffectSeverity} onChange={(e) => setFollowupForm((c) => ({ ...c, sideEffectSeverity: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {['mild', 'moderate', 'severe'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={followupForm.methodChange} onChange={(e) => setFollowupForm((c) => ({ ...c, methodChange: e.target.checked }))} />
              Method changed
            </label>
            {followupForm.methodChange && (
              <select value={followupForm.newMethod} onChange={(e) => setFollowupForm((c) => ({ ...c, newMethod: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select new method</option>
                {methods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            )}
            <input type="date" value={followupForm.nextVisitDate} onChange={(e) => setFollowupForm((c) => ({ ...c, nextVisitDate: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <textarea value={followupForm.notes} onChange={(e) => setFollowupForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Notes" className="md:col-span-2 min-h-[96px] rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <button type="button" onClick={() => void saveFollowup()} className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Save follow-up
          </button>
        </div>
      )}

      {tab === 'history' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Enrollment History</h3>
            <div className="space-y-3">
              {enrollments.length === 0 ? (
                <p className="text-sm text-slate-500">No enrollments recorded yet.</p>
              ) : (
                enrollments.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.method}</p>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">Enrolled {item.enrolledAt || item.enrolled_at}</p>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Visit History</h3>
            <div className="space-y-3">
              {followups.length === 0 ? (
                <p className="text-sm text-slate-500">No follow-up visits recorded yet.</p>
              ) : (
                followups.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.continuing ? 'Continuing' : 'Stopped'} • {item.sideEffectSeverity || 'no side effects'}</p>
                      <p className="text-xs text-slate-500">{item.visitDate || item.visit_date}</p>
                    </div>
                    {!!item.sideEffects?.length && (
                      <p className="mt-1 text-xs text-slate-600">Side effects: {item.sideEffects.join(', ')}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
