import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Flame, Plus } from 'lucide-react';
import { cervicalCancerApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type TabKey = 'screenings' | 'treatments';

const urgencyStyles: Record<string, string> = {
  routine: 'border-green-200 bg-green-50 text-green-800',
  within_4_weeks: 'border-amber-200 bg-amber-50 text-amber-800',
  same_day: 'border-red-200 bg-red-50 text-red-800',
  urgent: 'border-red-200 bg-red-50 text-red-800',
};

export default function CervicalCancerDashboard({ patientId }: { patientId: string }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { showError, showSuccess } = useNotification();
  const token = localStorage.getItem('ehr_token') || '';

  const [tab, setTab] = useState<TabKey>('screenings');
  const [screenings, setScreenings] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState<any | null>(null);
  const [screeningForm, setScreeningForm] = useState({
    method: 'VIA',
    result: 'negative',
    acetowhiteAreaPct: '',
    lesionLocation: 'ectocervix',
    hpvGenotype: 'negative',
    notes: '',
    nextScreeningDate: '',
    languageCode: 'en',
  });
  const [treatmentForm, setTreatmentForm] = useState({
    screeningId: '',
    method: 'cryotherapy',
    outcome: 'successful',
    referralReason: '',
    followUpDate: '',
    notes: '',
  });

  const loadData = async () => {
    if (!tenantSlug || !token) return;
    try {
      const [screeningHistory, treatmentHistory] = await Promise.all([
        cervicalCancerApi.getScreenings(patientId, token, tenantSlug),
        cervicalCancerApi.getTreatments(patientId, token, tenantSlug),
      ]);
      setScreenings(Array.isArray(screeningHistory) ? screeningHistory : []);
      setTreatments(Array.isArray(treatmentHistory) ? treatmentHistory : []);
    } catch {
      showError('Cervical screening', 'Failed to load cervical cancer history.');
    }
  };

  useEffect(() => {
    void loadData();
  }, [patientId, tenantSlug]);

  const saveScreening = async () => {
    if (!tenantSlug || !token) return;
    try {
      const dto = {
        method: screeningForm.method,
        result: screeningForm.result,
        acetowhiteAreaPct: screeningForm.method === 'VIA' || screeningForm.method === 'VILI'
          ? (screeningForm.acetowhiteAreaPct ? Number(screeningForm.acetowhiteAreaPct) : null)
          : null,
        lesionLocation: screeningForm.method === 'VIA' || screeningForm.method === 'VILI'
          ? screeningForm.lesionLocation
          : null,
        hpvGenotype: screeningForm.method === 'HPV' ? screeningForm.hpvGenotype : null,
        notes: screeningForm.notes || null,
        nextScreeningDate: screeningForm.nextScreeningDate || null,
        languageCode: screeningForm.languageCode,
      };

      await cervicalCancerApi.recordScreening(patientId, dto, token, tenantSlug);
      const recommend = await cervicalCancerApi.getScreenRecommend(
        {
          method: dto.method,
          result: dto.result,
          acetowhite_area_pct: dto.acetowhiteAreaPct,
          lesion_location: dto.lesionLocation,
          hpv_genotype: dto.hpvGenotype,
        },
        token,
        tenantSlug,
      );
      setRecommendation(recommend);
      showSuccess('Cervical screening', 'Screening saved and WHO recommendation generated.');
      setScreeningForm((current) => ({
        ...current,
        notes: '',
        nextScreeningDate: '',
        acetowhiteAreaPct: '',
      }));
      await loadData();
    } catch (error: any) {
      showError('Cervical screening', error?.response?.data?.message || 'Failed to save screening.');
    }
  };

  const saveTreatment = async () => {
    if (!tenantSlug || !token) return;
    try {
      await cervicalCancerApi.recordTreatment(
        patientId,
        {
          screeningId: treatmentForm.screeningId || null,
          method: treatmentForm.method,
          outcome: treatmentForm.outcome || null,
          referralReason: treatmentForm.outcome === 'referred' ? treatmentForm.referralReason || null : null,
          followUpDate: treatmentForm.followUpDate || null,
          notes: treatmentForm.notes || null,
        },
        token,
        tenantSlug,
      );
      showSuccess('Cervical treatment', 'Treatment record saved.');
      setTreatmentForm({
        screeningId: '',
        method: 'cryotherapy',
        outcome: 'successful',
        referralReason: '',
        followUpDate: '',
        notes: '',
      });
      await loadData();
    } catch (error: any) {
      showError('Cervical treatment', error?.response?.data?.message || 'Failed to save treatment.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'screenings', label: 'Screenings', icon: ClipboardList },
          { key: 'treatments', label: 'Treatments', icon: Flame },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as TabKey)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === item.key ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'screenings' && (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-rose-600" />
              <h3 className="text-lg font-semibold text-slate-900">Add Screening</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={screeningForm.method} onChange={(e) => setScreeningForm((c) => ({ ...c, method: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['VIA', 'VILI', 'HPV', 'PAP'].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={screeningForm.result} onChange={(e) => setScreeningForm((c) => ({ ...c, result: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['negative', 'positive', 'suspicious_cancer', 'unsatisfactory'].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              {(screeningForm.method === 'VIA' || screeningForm.method === 'VILI') && (
                <>
                  <input type="number" placeholder="Acetowhite area %" value={screeningForm.acetowhiteAreaPct} onChange={(e) => setScreeningForm((c) => ({ ...c, acetowhiteAreaPct: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <select value={screeningForm.lesionLocation} onChange={(e) => setScreeningForm((c) => ({ ...c, lesionLocation: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    {['ectocervix', 'squamocolumnar_junction', 'endocervix'].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </>
              )}
              {screeningForm.method === 'HPV' && (
                <select value={screeningForm.hpvGenotype} onChange={(e) => setScreeningForm((c) => ({ ...c, hpvGenotype: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  {['negative', '16_18', 'other_high_risk'].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              )}
              <input type="date" value={screeningForm.nextScreeningDate} onChange={(e) => setScreeningForm((c) => ({ ...c, nextScreeningDate: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <textarea value={screeningForm.notes} onChange={(e) => setScreeningForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Notes" className="md:col-span-2 min-h-[96px] rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <button type="button" onClick={() => void saveScreening()} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
              Save Screening
            </button>

            {recommendation && (
              <div className={`mt-4 rounded-2xl border p-4 ${urgencyStyles[recommendation.urgency] || urgencyStyles.routine}`}>
                <div className="flex items-center gap-2">
                  {recommendation.urgency === 'urgent' || recommendation.urgency === 'same_day' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <p className="text-sm font-semibold">{recommendation.recommendation}</p>
                </div>
                <p className="mt-2 text-sm">{recommendation.action}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Past Screenings</h3>
            <div className="space-y-3">
              {screenings.length === 0 ? (
                <p className="text-sm text-slate-500">No screening history yet.</p>
              ) : (
                screenings.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.method} • {item.result}</p>
                      <p className="text-xs text-slate-500">{new Date(item.screenedAt || item.screened_at).toLocaleDateString()}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{item.notes || 'No notes recorded.'}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'treatments' && (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Record Treatment</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={treatmentForm.screeningId} onChange={(e) => setTreatmentForm((c) => ({ ...c, screeningId: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Link screening (optional)</option>
                {screenings.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.method} • {item.result} • {new Date(item.screenedAt || item.screened_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <select value={treatmentForm.method} onChange={(e) => setTreatmentForm((c) => ({ ...c, method: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['cryotherapy', 'thermocoagulation', 'leep', 'lletz', 'referral_cancer'].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={treatmentForm.outcome} onChange={(e) => setTreatmentForm((c) => ({ ...c, outcome: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {['successful', 'incomplete', 'referred', 'deferred'].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <input type="date" value={treatmentForm.followUpDate} onChange={(e) => setTreatmentForm((c) => ({ ...c, followUpDate: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              {treatmentForm.outcome === 'referred' && (
                <input value={treatmentForm.referralReason} onChange={(e) => setTreatmentForm((c) => ({ ...c, referralReason: e.target.value }))} placeholder="Referral reason" className="md:col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              )}
              <textarea value={treatmentForm.notes} onChange={(e) => setTreatmentForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Notes" className="md:col-span-2 min-h-[96px] rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <button type="button" onClick={() => void saveTreatment()} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
              Save Treatment
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Past Treatments</h3>
            <div className="space-y-3">
              {treatments.length === 0 ? (
                <p className="text-sm text-slate-500">No treatment history yet.</p>
              ) : (
                treatments.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.method} • {item.outcome || 'pending'}</p>
                      <p className="text-xs text-slate-500">{new Date(item.treatedAt || item.treated_at).toLocaleDateString()}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{item.referralReason || item.notes || 'No notes recorded.'}</p>
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
