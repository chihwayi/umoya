import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Heart, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { hypertensionApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type TabKey = 'bp' | 'register' | 'reviews';

const classificationStyles: Record<string, string> = {
  normal: 'border-green-200 bg-green-50 text-green-800',
  elevated: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  stage1: 'border-amber-200 bg-amber-50 text-amber-800',
  stage2: 'border-red-200 bg-red-50 text-red-800',
  hypertensive_crisis: 'border-red-700 bg-red-100 text-red-900 font-bold',
};

const riskTierStyles: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  very_high: 'bg-red-100 text-red-800',
};

export default function HypertensionDashboard({ patientId }: { patientId: string }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';

  const [tab, setTab] = useState<TabKey>('bp');
  const [bpHistory, setBpHistory] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [registerEntry, setRegisterEntry] = useState<any | null>(null);
  const [cdssResult, setCdssResult] = useState<any | null>(null);
  const [cvdRisk, setCvdRisk] = useState<any | null>(null);

  const [bpForm, setBpForm] = useState({ sbp: '', dbp: '', pulse: '', arm: 'left', position: 'sitting', context: 'clinic', notes: '' });
  const [reviewForm, setReviewForm] = useState({
    penStep: '1', sbpAtReview: '', dbpAtReview: '', medications: '', actionTaken: 'maintain',
    adherence: 'good', sideEffects: '', referralReason: '', nextReviewDate: '', notes: '',
  });
  const [registerForm, setRegisterForm] = useState({
    htnStage: 'stage2', hasDiabetes: false, hasCkd: false, hasHeartFailure: false,
    hasPostMi: false, isPregnant: false, isSmoker: false, currentStep: '1',
    status: 'active', nextReviewDate: '', notes: '',
  });
  const [cvdForm, setCvdForm] = useState({
    ageYears: '', sex: 'male', totalCholesterolMmol: '', isSmoker: false,
    hasDiabetes: false, hasCkd: false, hasLvh: false, hasProteinuria: false, familyHistoryCvd: false,
  });

  const loadData = async () => {
    if (!tenantSlug || !token) return;
    try {
      const [bps, revs, reg] = await Promise.all([
        hypertensionApi.getBpHistory(patientId, token, tenantSlug),
        hypertensionApi.getReviews(patientId, token, tenantSlug),
        hypertensionApi.getRegisterEntry(patientId, token, tenantSlug).catch(() => null),
      ]);
      setBpHistory(Array.isArray(bps) ? bps : []);
      setReviews(Array.isArray(revs) ? revs : []);
      setRegisterEntry(reg ?? null);
    } catch {
      showError('Hypertension', 'Failed to load hypertension records.');
    }
  };

  useEffect(() => { void loadData(); }, [patientId, tenantSlug]);

  const saveBp = async () => {
    if (!tenantSlug || !token || !bpForm.sbp || !bpForm.dbp) return;
    try {
      const saved = await hypertensionApi.recordBp(patientId, {
        sbp: Number(bpForm.sbp),
        dbp: Number(bpForm.dbp),
        pulse: bpForm.pulse ? Number(bpForm.pulse) : null,
        arm: bpForm.arm,
        position: bpForm.position,
        context: bpForm.context,
        notes: bpForm.notes || null,
      }, token, tenantSlug);

      // Get step therapy recommendation if register entry exists
      if (registerEntry) {
        try {
          const therapy = await hypertensionApi.getStepTherapy({
            current_step: registerEntry.currentStep ?? 1,
            sbp: Number(bpForm.sbp),
            dbp: Number(bpForm.dbp),
            has_diabetes: registerEntry.hasDiabetes ?? false,
            has_ckd: registerEntry.hasCkd ?? false,
            has_heart_failure: registerEntry.hasHeartFailure ?? false,
            has_post_mi: registerEntry.hasPostMi ?? false,
            is_pregnant: registerEntry.isPregnant ?? false,
            is_smoker: registerEntry.isSmoker ?? false,
            cvd_risk_tier: registerEntry.cvdRiskTier ?? null,
          }, token, tenantSlug);
          setCdssResult(therapy);
        } catch { /* CDSS optional */ }
      }

      showSuccess('BP Reading', `Recorded: ${saved.classification?.replace('_', ' ')} (${bpForm.sbp}/${bpForm.dbp} mmHg)`);
      setBpForm({ sbp: '', dbp: '', pulse: '', arm: 'left', position: 'sitting', context: 'clinic', notes: '' });
      await loadData();
    } catch (error: any) {
      showError('BP Reading', error?.response?.data?.message || 'Failed to save BP reading.');
    }
  };

  const saveRegister = async () => {
    if (!tenantSlug || !token) return;
    try {
      if (registerEntry) {
        await hypertensionApi.updateRegisterEntry(registerEntry.id, {
          htnStage: registerForm.htnStage,
          hasDiabetes: registerForm.hasDiabetes,
          hasCkd: registerForm.hasCkd,
          hasHeartFailure: registerForm.hasHeartFailure,
          hasPostMi: registerForm.hasPostMi,
          isPregnant: registerForm.isPregnant,
          isSmoker: registerForm.isSmoker,
          currentStep: Number(registerForm.currentStep),
          status: registerForm.status,
          nextReviewDate: registerForm.nextReviewDate || null,
          notes: registerForm.notes || null,
        }, token, tenantSlug);
      } else {
        await hypertensionApi.enroll(patientId, {
          htnStage: registerForm.htnStage,
          hasDiabetes: registerForm.hasDiabetes,
          hasCkd: registerForm.hasCkd,
          hasHeartFailure: registerForm.hasHeartFailure,
          hasPostMi: registerForm.hasPostMi,
          isPregnant: registerForm.isPregnant,
          isSmoker: registerForm.isSmoker,
          currentStep: Number(registerForm.currentStep),
          status: registerForm.status,
          nextReviewDate: registerForm.nextReviewDate || null,
          notes: registerForm.notes || null,
        }, token, tenantSlug);
      }
      showSuccess('HTN Register', registerEntry ? 'Register entry updated.' : 'Patient enrolled in HTN register.');
      await loadData();
    } catch (error: any) {
      showError('HTN Register', error?.response?.data?.message || 'Failed to save register entry.');
    }
  };

  const saveReview = async () => {
    if (!tenantSlug || !token) return;
    try {
      await hypertensionApi.recordReview(patientId, {
        htnRegisterId: registerEntry?.id || null,
        penStep: Number(reviewForm.penStep),
        sbpAtReview: reviewForm.sbpAtReview ? Number(reviewForm.sbpAtReview) : null,
        dbpAtReview: reviewForm.dbpAtReview ? Number(reviewForm.dbpAtReview) : null,
        medications: reviewForm.medications || null,
        actionTaken: reviewForm.actionTaken,
        adherence: reviewForm.adherence,
        sideEffects: reviewForm.sideEffects || null,
        referralReason: reviewForm.actionTaken === 'referral' ? reviewForm.referralReason || null : null,
        nextReviewDate: reviewForm.nextReviewDate || null,
        notes: reviewForm.notes || null,
      }, token, tenantSlug);
      showSuccess('Treatment Review', 'Review saved.');
      setReviewForm({ penStep: '1', sbpAtReview: '', dbpAtReview: '', medications: '', actionTaken: 'maintain', adherence: 'good', sideEffects: '', referralReason: '', nextReviewDate: '', notes: '' });
      await loadData();
    } catch (error: any) {
      showError('Treatment Review', error?.response?.data?.message || 'Failed to save review.');
    }
  };

  const runCvdRisk = async () => {
    if (!tenantSlug || !token || !cvdForm.ageYears) return;
    try {
      const result = await hypertensionApi.getCvdRisk({
        age_years: Number(cvdForm.ageYears),
        sex: cvdForm.sex,
        sbp: bpHistory[0]?.sbp ?? 140,
        total_cholesterol_mmol: cvdForm.totalCholesterolMmol ? Number(cvdForm.totalCholesterolMmol) : null,
        is_smoker: cvdForm.isSmoker,
        has_diabetes: cvdForm.hasDiabetes,
        has_ckd: cvdForm.hasCkd,
        has_lvh: cvdForm.hasLvh,
        has_proteinuria: cvdForm.hasProteinuria,
        family_history_cvd: cvdForm.familyHistoryCvd,
      }, token, tenantSlug);
      setCvdRisk(result);
    } catch (error: any) {
      showError('CVD Risk', error?.response?.data?.message || 'Failed to calculate CVD risk.');
    }
  };

  const latestBp = bpHistory[0];

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      {latestBp && (
        <div className={`rounded-2xl border p-4 ${classificationStyles[latestBp.classification] || classificationStyles.stage1}`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5" />
              <div>
                <p className="text-sm font-bold">Latest BP: {latestBp.sbp}/{latestBp.dbp} mmHg</p>
                <p className="text-xs capitalize">{latestBp.classification?.replace(/_/g, ' ') || '—'}</p>
              </div>
            </div>
            {registerEntry && (
              <div className="flex items-center gap-2 text-sm">
                <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${riskTierStyles[registerEntry.cvdRiskTier] || 'bg-slate-100 text-slate-700'}`}>
                  CVD Risk: {registerEntry.cvdRiskTier?.replace('_', ' ') || 'not set'}
                </span>
                <span className="rounded-full bg-blue-100 text-blue-800 px-3 py-0.5 text-xs font-semibold">
                  Step {registerEntry.currentStep ?? 1}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'bp', label: 'BP Readings', icon: Activity },
          { key: 'register', label: 'HTN Register', icon: Heart },
          { key: 'reviews', label: 'Treatment Reviews', icon: ChevronRight },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as TabKey)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${tab === item.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {/* BP Tab */}
      {tab === 'bp' && (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900">Record BP</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <input type="number" placeholder="Systolic (mmHg)" value={bpForm.sbp} onChange={(e) => setBpForm((c) => ({ ...c, sbp: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input type="number" placeholder="Diastolic (mmHg)" value={bpForm.dbp} onChange={(e) => setBpForm((c) => ({ ...c, dbp: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input type="number" placeholder="Pulse (bpm)" value={bpForm.pulse} onChange={(e) => setBpForm((c) => ({ ...c, pulse: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={bpForm.arm} onChange={(e) => setBpForm((c) => ({ ...c, arm: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['left', 'right'].map((v) => <option key={v} value={v}>{v} arm</option>)}
              </select>
              <select value={bpForm.position} onChange={(e) => setBpForm((c) => ({ ...c, position: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['sitting', 'standing', 'supine'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={bpForm.context} onChange={(e) => setBpForm((c) => ({ ...c, context: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['clinic', 'home', 'ambulatory'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <textarea value={bpForm.notes} onChange={(e) => setBpForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Notes" className="md:col-span-3 min-h-[72px] rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <button type="button" onClick={() => void saveBp()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Save BP Reading
            </button>

            {/* WHO PEN Step Therapy result */}
            {cdssResult && (
              <div className={`rounded-2xl border p-4 ${classificationStyles[cdssResult.classification] || classificationStyles.stage1}`}>
                <div className="flex items-center gap-2 mb-2">
                  {cdssResult.action === 'referral' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  <p className="text-sm font-bold capitalize">{cdssResult.action?.replace(/_/g, ' ')} — Step {cdssResult.recommended_step}</p>
                </div>
                {cdssResult.warnings?.map((w: string, i: number) => (
                  <p key={i} className="text-xs font-semibold text-red-700 mb-1">{w}</p>
                ))}
                <ul className="mt-2 space-y-1">
                  {cdssResult.recommendations?.slice(0, 4).map((r: string, i: number) => (
                    <li key={i} className="text-xs flex items-start gap-1"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />{r}</li>
                  ))}
                </ul>
                {cdssResult.follow_up && (
                  <p className="mt-2 text-xs text-slate-600">Follow-up: {cdssResult.follow_up.label}</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">BP History</h3>
            <div className="space-y-2">
              {bpHistory.length === 0 ? (
                <p className="text-sm text-slate-500">No BP readings recorded yet.</p>
              ) : (
                bpHistory.map((item) => (
                  <div key={item.id} className={`rounded-xl border p-3 ${classificationStyles[item.classification] || 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">{item.sbp}/{item.dbp} mmHg {item.pulse ? `• ${item.pulse} bpm` : ''}</p>
                      <p className="text-xs opacity-70">{new Date(item.recordedAt || item.recorded_at).toLocaleDateString()}</p>
                    </div>
                    <p className="text-xs capitalize mt-0.5 opacity-80">{item.classification?.replace(/_/g, ' ') || ''} • {item.arm} arm • {item.position}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Register Tab */}
      {tab === 'register' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{registerEntry ? 'Update HTN Register' : 'Enrol in HTN Register'}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={registerForm.htnStage} onChange={(e) => setRegisterForm((c) => ({ ...c, htnStage: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['stage1', 'stage2', 'hypertensive_crisis'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={registerForm.status} onChange={(e) => setRegisterForm((c) => ({ ...c, status: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['active', 'controlled', 'lost_to_followup', 'transferred', 'deceased'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={registerForm.currentStep} onChange={(e) => setRegisterForm((c) => ({ ...c, currentStep: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['1', '2', '3', '4'].map((v) => <option key={v} value={v}>WHO PEN Step {v}</option>)}
              </select>
              <input type="date" value={registerForm.nextReviewDate} onChange={(e) => setRegisterForm((c) => ({ ...c, nextReviewDate: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([ ['hasDiabetes', 'Diabetes'], ['hasCkd', 'CKD'], ['hasHeartFailure', 'Heart Failure'], ['hasPostMi', 'Post-MI'], ['isPregnant', 'Pregnant'], ['isSmoker', 'Smoker'] ] as [keyof typeof registerForm, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={registerForm[key] as boolean} onChange={(e) => setRegisterForm((c) => ({ ...c, [key]: e.target.checked }))} className="rounded" />
                  {label}
                </label>
              ))}
            </div>
            <textarea value={registerForm.notes} onChange={(e) => setRegisterForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Notes" className="w-full min-h-[72px] rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void saveRegister()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              {registerEntry ? 'Update Register' : 'Enrol Patient'}
            </button>
          </div>

          {/* CVD Risk Calculator */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">WHO CVD Risk Assessment</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input type="number" placeholder="Age (years)" value={cvdForm.ageYears} onChange={(e) => setCvdForm((c) => ({ ...c, ageYears: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={cvdForm.sex} onChange={(e) => setCvdForm((c) => ({ ...c, sex: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <input type="number" step="0.1" placeholder="Total cholesterol (mmol/L)" value={cvdForm.totalCholesterolMmol} onChange={(e) => setCvdForm((c) => ({ ...c, totalCholesterolMmol: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([ ['isSmoker', 'Smoker'], ['hasDiabetes', 'Diabetes'], ['hasCkd', 'CKD'], ['hasLvh', 'LVH'], ['hasProteinuria', 'Proteinuria'], ['familyHistoryCvd', 'Family CVD Hx'] ] as [keyof typeof cvdForm, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={cvdForm[key] as boolean} onChange={(e) => setCvdForm((c) => ({ ...c, [key]: e.target.checked }))} className="rounded" />
                  {label}
                </label>
              ))}
            </div>
            <button type="button" onClick={() => void runCvdRisk()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Calculate CVD Risk
            </button>

            {cvdRisk && (
              <div className={`rounded-2xl border p-4 ${riskTierStyles[cvdRisk.cvd_risk_tier] ? `border-current ${riskTierStyles[cvdRisk.cvd_risk_tier]}` : 'border-slate-200 bg-slate-50'}`}>
                <p className="text-sm font-bold capitalize">{cvdRisk.cvd_risk_tier?.replace('_', ' ')} CVD Risk — ~{cvdRisk.estimated_10yr_risk_pct}% 10-year risk</p>
                <p className="mt-2 text-xs">{cvdRisk.action}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reviews Tab */}
      {tab === 'reviews' && (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Record Treatment Review</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={reviewForm.penStep} onChange={(e) => setReviewForm((c) => ({ ...c, penStep: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['1', '2', '3', '4'].map((v) => <option key={v} value={v}>WHO PEN Step {v}</option>)}
              </select>
              <select value={reviewForm.actionTaken} onChange={(e) => setReviewForm((c) => ({ ...c, actionTaken: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['maintain', 'step_up', 'step_down', 'add_statin', 'add_aspirin', 'referral', 'lifestyle_only'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
              </select>
              <input type="number" placeholder="SBP at review" value={reviewForm.sbpAtReview} onChange={(e) => setReviewForm((c) => ({ ...c, sbpAtReview: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input type="number" placeholder="DBP at review" value={reviewForm.dbpAtReview} onChange={(e) => setReviewForm((c) => ({ ...c, dbpAtReview: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={reviewForm.adherence} onChange={(e) => setReviewForm((c) => ({ ...c, adherence: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['good', 'partial', 'poor', 'unknown'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <input type="date" value={reviewForm.nextReviewDate} onChange={(e) => setReviewForm((c) => ({ ...c, nextReviewDate: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <textarea value={reviewForm.medications} onChange={(e) => setReviewForm((c) => ({ ...c, medications: e.target.value }))} placeholder="Current medications" className="md:col-span-2 min-h-[72px] rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              {reviewForm.actionTaken === 'referral' && (
                <input value={reviewForm.referralReason} onChange={(e) => setReviewForm((c) => ({ ...c, referralReason: e.target.value }))} placeholder="Referral reason" className="md:col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              )}
              <textarea value={reviewForm.sideEffects} onChange={(e) => setReviewForm((c) => ({ ...c, sideEffects: e.target.value }))} placeholder="Side effects reported" className="md:col-span-2 min-h-[56px] rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <textarea value={reviewForm.notes} onChange={(e) => setReviewForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Clinical notes" className="md:col-span-2 min-h-[72px] rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <button type="button" onClick={() => void saveReview()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Save Review
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Review History</h3>
            <div className="space-y-3">
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500">No treatment reviews yet.</p>
              ) : (
                reviews.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Step {item.penStep} • {item.actionTaken?.replace(/_/g, ' ') || 'maintain'}</p>
                      <p className="text-xs text-slate-500">{new Date(item.reviewedAt || item.reviewed_at).toLocaleDateString()}</p>
                    </div>
                    {item.sbpAtReview && (
                      <p className="text-xs text-slate-600 mt-0.5">{item.sbpAtReview}/{item.dbpAtReview} mmHg • adherence: {item.adherence}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-600">{item.medications || item.notes || 'No notes.'}</p>
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
