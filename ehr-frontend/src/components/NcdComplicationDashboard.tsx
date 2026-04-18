import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, Droplets, Eye, Footprints, Plus, ShieldAlert } from 'lucide-react';

import { ncdComplicationApi } from '../services/api';
import { useNotification } from './GlobalNotification';

type TabKey = 'foot' | 'eye' | 'kidney' | 'register';

const footRiskStyles: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  moderate: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-green-100 text-green-800 border-green-200',
};

const ckdStageStyles: Record<string, string> = {
  G1: 'bg-green-100 text-green-800',
  G2: 'bg-lime-100 text-lime-800',
  G3a: 'bg-yellow-100 text-yellow-800',
  G3b: 'bg-amber-100 text-amber-800',
  G4: 'bg-orange-100 text-orange-800',
  G5: 'bg-red-100 text-red-800',
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
};

const computeFootRisk = (record: any): string => {
  const maxWagner = Math.max(Number(record.rightWagnerGrade ?? record.right_wagner_grade ?? 0), Number(record.leftWagnerGrade ?? record.left_wagner_grade ?? 0));
  const infectionCount = Array.isArray(record.infectionSigns ?? record.infection_signs) ? (record.infectionSigns ?? record.infection_signs).length : 0;
  if (maxWagner >= 4 || (maxWagner >= 3 && infectionCount >= 2)) return 'critical';
  if (maxWagner >= 2 || infectionCount >= 1) return 'high';
  if (maxWagner === 1 || record.ulcerPresent || record.ulcer_present) return 'moderate';
  return 'low';
};

const computeOverdue = (row: any): string[] => {
  const now = new Date();
  const overdue: string[] = [];
  const footDate = row.last_foot_assessment ? new Date(row.last_foot_assessment) : null;
  const eyeDate = row.last_eye_screening ? new Date(row.last_eye_screening) : null;
  const ckdDate = row.last_ckd_record ? new Date(row.last_ckd_record) : null;
  const monthsSince = (date: Date | null) => (date ? (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30) : Number.POSITIVE_INFINITY);

  if ((row.high_risk || Number(row.worst_wagner_grade ?? -1) >= 3) && monthsSince(footDate) > 3) {
    overdue.push('Foot review overdue');
  }
  if (monthsSince(eyeDate) > 12) {
    overdue.push('Eye screening overdue');
  }
  if (['G3b', 'G4', 'G5'].includes(row.current_ckd_stage) && monthsSince(ckdDate) > 6) {
    overdue.push('CKD review overdue');
  }
  return overdue;
};

export default function NcdComplicationDashboard({ patientId }: { patientId: string | null }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = localStorage.getItem('ehr_token') || '';
  const { showError, showSuccess } = useNotification();

  const [tab, setTab] = useState<TabKey>('register');
  const [focusedPatientId, setFocusedPatientId] = useState<string | null>(null);
  const resolvedPatientId = patientId ?? focusedPatientId;

  const [registerRows, setRegisterRows] = useState<any[]>([]);
  const [footHistory, setFootHistory] = useState<any[]>([]);
  const [eyeHistory, setEyeHistory] = useState<any[]>([]);
  const [ckdHistory, setCkdHistory] = useState<any[]>([]);
  const [footRiskAnalysis, setFootRiskAnalysis] = useState<any | null>(null);
  const [ckdManagement, setCkdManagement] = useState<any | null>(null);
  const [highRiskOnly, setHighRiskOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  const [footForm, setFootForm] = useState({
    rightFootSensation: 'intact',
    leftFootSensation: 'intact',
    rightFootPulses: 'present',
    leftFootPulses: 'present',
    rightFootDeformity: false,
    leftFootDeformity: false,
    deformityDescription: '',
    callusPresent: false,
    rightWagnerGrade: '0',
    leftWagnerGrade: '0',
    ulcerPresent: false,
    ulcerLocation: '',
    ulcerSizeCm2: '',
    ulcerDepth: 'superficial',
    woundBed: 'granulating',
    infectionSigns: [] as string[],
    rightAbi: '',
    leftAbi: '',
    referredToPodiatry: false,
    referredToSurgery: false,
    dressingType: '',
    offloadingDevice: 'none',
    antibioticPrescribed: '',
    reviewInDays: '',
    notes: '',
  });

  const [eyeForm, setEyeForm] = useState({
    method: 'ophthalmoscopy',
    rightEyeGrade: 'none',
    leftEyeGrade: 'none',
    rightEyeDme: false,
    leftEyeDme: false,
    hypertensiveRetinopathyGrade: '',
    referredToOphthalmology: false,
    urgency: 'routine',
    nextScreeningMonths: '12',
    notes: '',
  });

  const [ckdForm, setCkdForm] = useState({
    creatinineUmolL: '',
    egfrMlMin173m2: '',
    egfrEquation: 'CKD-EPI',
    uacrMgG: '',
    urineDipstickProtein: 'negative',
    primaryCause: 'diabetic_nephropathy',
    sbpMmhg: '',
    dbpMmhg: '',
    haemoglobinGDl: '',
    potassiumMmolL: '',
    bicarbonateMmolL: '',
    phosphateMmolL: '',
    aceInhibitorArb: false,
    metforminStopped: false,
    nsaidStopped: false,
    notes: '',
  });

  const loadRegister = useCallback(async () => {
    if (!tenantSlug || !token) return;
    try {
      const rows = await ncdComplicationApi.getRegister(token, tenantSlug, { highRiskOnly });
      setRegisterRows(Array.isArray(rows) ? rows : []);
    } catch {
      showError('NCD Complications', 'Failed to load complication register.');
    }
  }, [highRiskOnly, showError, tenantSlug, token]);

  const loadPatientData = useCallback(async (targetPatientId: string) => {
    if (!tenantSlug || !token || !targetPatientId) return;
    setLoading(true);
    try {
      const [foot, eye, ckd] = await Promise.all([
        ncdComplicationApi.getFootHistory(targetPatientId, token, tenantSlug),
        ncdComplicationApi.getRetinopathyHistory(targetPatientId, token, tenantSlug),
        ncdComplicationApi.getCkdHistory(targetPatientId, token, tenantSlug),
      ]);
      setFootHistory(Array.isArray(foot) ? foot : []);
      setEyeHistory(Array.isArray(eye) ? eye : []);
      setCkdHistory(Array.isArray(ckd) ? ckd : []);
    } catch {
      showError('NCD Complications', 'Failed to load patient complication history.');
    } finally {
      setLoading(false);
    }
  }, [showError, tenantSlug, token]);

  useEffect(() => {
    void loadRegister();
  }, [loadRegister]);

  useEffect(() => {
    if (resolvedPatientId) {
      void loadPatientData(resolvedPatientId);
    } else {
      setFootHistory([]);
      setEyeHistory([]);
      setCkdHistory([]);
    }
  }, [loadPatientData, resolvedPatientId]);

  useEffect(() => {
    if (patientId) {
      setFocusedPatientId(null);
    }
  }, [patientId]);

  const updateFootArrayField = (value: string, checked: boolean) => {
    setFootForm((current) => ({
      ...current,
      infectionSigns: checked
        ? [...current.infectionSigns, value]
        : current.infectionSigns.filter((item) => item !== value),
    }));
  };

  const submitFoot = async () => {
    if (!tenantSlug || !token || !resolvedPatientId) return;
    try {
      const response = await ncdComplicationApi.recordFootAssessment(
        resolvedPatientId,
        {
          rightFootSensation: footForm.rightFootSensation,
          leftFootSensation: footForm.leftFootSensation,
          rightFootPulses: footForm.rightFootPulses,
          leftFootPulses: footForm.leftFootPulses,
          rightFootDeformity: footForm.rightFootDeformity,
          leftFootDeformity: footForm.leftFootDeformity,
          deformityDescription: footForm.deformityDescription || null,
          callusPresent: footForm.callusPresent,
          rightWagnerGrade: Number(footForm.rightWagnerGrade),
          leftWagnerGrade: Number(footForm.leftWagnerGrade),
          ulcerPresent: footForm.ulcerPresent,
          ulcerLocation: footForm.ulcerLocation || null,
          ulcerSizeCm2: footForm.ulcerSizeCm2 ? Number(footForm.ulcerSizeCm2) : null,
          ulcerDepth: footForm.ulcerPresent ? footForm.ulcerDepth : null,
          woundBed: footForm.ulcerPresent ? footForm.woundBed : null,
          infectionSigns: footForm.infectionSigns,
          rightAbi: footForm.rightAbi ? Number(footForm.rightAbi) : null,
          leftAbi: footForm.leftAbi ? Number(footForm.leftAbi) : null,
          referredToPodiatry: footForm.referredToPodiatry,
          referredToSurgery: footForm.referredToSurgery,
          dressingType: footForm.dressingType || null,
          offloadingDevice: footForm.offloadingDevice,
          antibioticPrescribed: footForm.antibioticPrescribed || null,
          reviewInDays: footForm.reviewInDays ? Number(footForm.reviewInDays) : null,
          notes: footForm.notes || null,
        },
        token,
        tenantSlug,
      );
      setFootRiskAnalysis(response?.riskAnalysis ?? null);
      showSuccess('Diabetic Foot', 'Foot assessment recorded.');
      await loadPatientData(resolvedPatientId);
      await loadRegister();
    } catch (error: any) {
      showError('Diabetic Foot', error?.response?.data?.message || 'Failed to record foot assessment.');
    }
  };

  const submitEye = async () => {
    if (!tenantSlug || !token || !resolvedPatientId) return;
    try {
      await ncdComplicationApi.recordRetinopathy(
        resolvedPatientId,
        {
          method: eyeForm.method,
          rightEyeGrade: eyeForm.rightEyeGrade,
          leftEyeGrade: eyeForm.leftEyeGrade,
          rightEyeDme: eyeForm.rightEyeDme,
          leftEyeDme: eyeForm.leftEyeDme,
          hypertensiveRetinopathyGrade: eyeForm.hypertensiveRetinopathyGrade ? Number(eyeForm.hypertensiveRetinopathyGrade) : null,
          referredToOphthalmology: eyeForm.referredToOphthalmology,
          urgency: eyeForm.referredToOphthalmology ? eyeForm.urgency : null,
          nextScreeningMonths: Number(eyeForm.nextScreeningMonths),
          notes: eyeForm.notes || null,
        },
        token,
        tenantSlug,
      );
      showSuccess('Retinopathy', 'Screening recorded.');
      await loadPatientData(resolvedPatientId);
      await loadRegister();
    } catch (error: any) {
      showError('Retinopathy', error?.response?.data?.message || 'Failed to record retinopathy screening.');
    }
  };

  const submitCkd = async () => {
    if (!tenantSlug || !token || !resolvedPatientId) return;
    if (!ckdForm.egfrMlMin173m2 && ckdForm.creatinineUmolL) {
      showError('CKD Staging', 'Enter eGFR directly for now before submitting CKD staging.');
      return;
    }
    try {
      const response = await ncdComplicationApi.recordCkd(
        resolvedPatientId,
        {
          creatinineUmolL: ckdForm.creatinineUmolL ? Number(ckdForm.creatinineUmolL) : null,
          egfrMlMin173m2: ckdForm.egfrMlMin173m2 ? Number(ckdForm.egfrMlMin173m2) : null,
          egfrEquation: ckdForm.egfrEquation,
          uacrMgG: ckdForm.uacrMgG ? Number(ckdForm.uacrMgG) : null,
          urineDipstickProtein: ckdForm.urineDipstickProtein || null,
          primaryCause: ckdForm.primaryCause || null,
          sbpMmhg: ckdForm.sbpMmhg ? Number(ckdForm.sbpMmhg) : null,
          dbpMmhg: ckdForm.dbpMmhg ? Number(ckdForm.dbpMmhg) : null,
          haemoglobinGDl: ckdForm.haemoglobinGDl ? Number(ckdForm.haemoglobinGDl) : null,
          potassiumMmolL: ckdForm.potassiumMmolL ? Number(ckdForm.potassiumMmolL) : null,
          bicarbonateMmolL: ckdForm.bicarbonateMmolL ? Number(ckdForm.bicarbonateMmolL) : null,
          phosphateMmolL: ckdForm.phosphateMmolL ? Number(ckdForm.phosphateMmolL) : null,
          aceInhibitorArb: ckdForm.aceInhibitorArb,
          metforminStopped: ckdForm.metforminStopped,
          nsaidStopped: ckdForm.nsaidStopped,
          notes: ckdForm.notes || null,
        },
        token,
        tenantSlug,
      );
      setCkdManagement(response?.management ?? null);
      showSuccess('CKD Staging', 'CKD staging saved.');
      await loadPatientData(resolvedPatientId);
      await loadRegister();
    } catch (error: any) {
      showError('CKD Staging', error?.response?.data?.message || 'Failed to record CKD staging.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'register', label: 'Register', icon: Activity },
          { key: 'foot', label: 'Foot', icon: Footprints },
          { key: 'eye', label: 'Eye', icon: Eye },
          { key: 'kidney', label: 'Kidney', icon: Droplets },
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
        <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <input id="ncd-high-risk-only" type="checkbox" checked={highRiskOnly} onChange={(e) => setHighRiskOnly(e.target.checked)} />
          <label htmlFor="ncd-high-risk-only">High risk only</label>
        </div>
      </div>

      {resolvedPatientId && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Working patient context: <span className="font-semibold">{resolvedPatientId}</span>
          {!patientId && focusedPatientId && <span className="ml-2 text-blue-700">(selected from register)</span>}
        </div>
      )}

      {tab === 'register' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900">Complication Register</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Last Foot</th>
                  <th className="px-3 py-2">Wagner</th>
                  <th className="px-3 py-2">Last Eye</th>
                  <th className="px-3 py-2">Retinopathy</th>
                  <th className="px-3 py-2">Last CKD</th>
                  <th className="px-3 py-2">CKD Stage</th>
                  <th className="px-3 py-2">Flags</th>
                </tr>
              </thead>
              <tbody>
                {registerRows.map((row) => {
                  const overdue = computeOverdue(row);
                  return (
                    <tr
                      key={row.patient_id}
                      className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                      onClick={() => {
                        setFocusedPatientId(row.patient_id);
                        setTab(row.current_ckd_stage ? 'kidney' : row.worst_retinopathy_grade ? 'eye' : 'foot');
                      }}
                    >
                      <td className="px-3 py-3 font-medium text-slate-900">
                        {row.first_name} {row.last_name}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(row.last_foot_assessment)}</td>
                      <td className="px-3 py-3">{row.worst_wagner_grade ?? '—'}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(row.last_eye_screening)}</td>
                      <td className="px-3 py-3">{row.worst_retinopathy_grade ?? '—'}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(row.last_ckd_record)}</td>
                      <td className="px-3 py-3">
                        {row.current_ckd_stage ? <span className={`rounded-full px-2 py-1 text-xs font-semibold ${ckdStageStyles[row.current_ckd_stage] || 'bg-slate-100 text-slate-700'}`}>{row.current_ckd_stage}</span> : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {row.high_risk && <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">High risk</span>}
                          {overdue.map((flag) => (
                            <span key={flag} className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">{flag}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!registerRows.length && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-500">No complication records found yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab !== 'register' && !resolvedPatientId && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-600">
          Select a patient from the queue or open one from the complication register first.
        </div>
      )}

      {tab === 'foot' && resolvedPatientId && (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900">Diabetic Foot Assessment</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={footForm.rightFootSensation} onChange={(e) => setFootForm((c) => ({ ...c, rightFootSensation: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['intact', 'reduced', 'absent'].map((v) => <option key={v} value={v}>Right sensation: {v}</option>)}</select>
              <select value={footForm.leftFootSensation} onChange={(e) => setFootForm((c) => ({ ...c, leftFootSensation: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['intact', 'reduced', 'absent'].map((v) => <option key={v} value={v}>Left sensation: {v}</option>)}</select>
              <select value={footForm.rightFootPulses} onChange={(e) => setFootForm((c) => ({ ...c, rightFootPulses: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['present', 'diminished', 'absent'].map((v) => <option key={v} value={v}>Right pulses: {v}</option>)}</select>
              <select value={footForm.leftFootPulses} onChange={(e) => setFootForm((c) => ({ ...c, leftFootPulses: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['present', 'diminished', 'absent'].map((v) => <option key={v} value={v}>Left pulses: {v}</option>)}</select>
              <select value={footForm.rightWagnerGrade} onChange={(e) => setFootForm((c) => ({ ...c, rightWagnerGrade: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{[0, 1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>Right Wagner: {v}</option>)}</select>
              <select value={footForm.leftWagnerGrade} onChange={(e) => setFootForm((c) => ({ ...c, leftWagnerGrade: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{[0, 1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>Left Wagner: {v}</option>)}</select>
              <input value={footForm.rightAbi} onChange={(e) => setFootForm((c) => ({ ...c, rightAbi: e.target.value }))} placeholder="Right ABI" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={footForm.leftAbi} onChange={(e) => setFootForm((c) => ({ ...c, leftAbi: e.target.value }))} placeholder="Left ABI" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={footForm.ulcerLocation} onChange={(e) => setFootForm((c) => ({ ...c, ulcerLocation: e.target.value }))} placeholder="Ulcer location" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
              <input value={footForm.ulcerSizeCm2} onChange={(e) => setFootForm((c) => ({ ...c, ulcerSizeCm2: e.target.value }))} placeholder="Ulcer size cm²" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={footForm.ulcerDepth} onChange={(e) => setFootForm((c) => ({ ...c, ulcerDepth: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['superficial', 'deep_no_tendon', 'tendon_capsule', 'bone'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}</select>
              <select value={footForm.woundBed} onChange={(e) => setFootForm((c) => ({ ...c, woundBed: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['granulating', 'sloughy', 'necrotic', 'epithelialising'].map((v) => <option key={v} value={v}>{v}</option>)}</select>
              <select value={footForm.offloadingDevice} onChange={(e) => setFootForm((c) => ({ ...c, offloadingDevice: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['none', 'felted_foam', 'total_contact_cast', 'wheelchair'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}</select>
              <input value={footForm.dressingType} onChange={(e) => setFootForm((c) => ({ ...c, dressingType: e.target.value }))} placeholder="Dressing type" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={footForm.antibioticPrescribed} onChange={(e) => setFootForm((c) => ({ ...c, antibioticPrescribed: e.target.value }))} placeholder="Antibiotic prescribed" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={footForm.reviewInDays} onChange={(e) => setFootForm((c) => ({ ...c, reviewInDays: e.target.value }))} placeholder="Review in days" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={footForm.deformityDescription} onChange={(e) => setFootForm((c) => ({ ...c, deformityDescription: e.target.value }))} placeholder="Deformity description" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
            </div>
            <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-700">
              {[
                ['Right deformity', 'rightFootDeformity'],
                ['Left deformity', 'leftFootDeformity'],
                ['Callus present', 'callusPresent'],
                ['Ulcer present', 'ulcerPresent'],
                ['Refer podiatry', 'referredToPodiatry'],
                ['Refer surgery', 'referredToSurgery'],
              ].map(([label, key]) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" checked={(footForm as any)[key]} onChange={(e) => setFootForm((c) => ({ ...c, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Infection signs</p>
              <div className="flex flex-wrap gap-3 text-sm text-slate-700">
                {['erythema', 'warmth', 'purulence', 'odour', 'cellulitis'].map((item) => (
                  <label key={item} className="flex items-center gap-2">
                    <input type="checkbox" checked={footForm.infectionSigns.includes(item)} onChange={(e) => updateFootArrayField(item, e.target.checked)} />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <textarea value={footForm.notes} onChange={(e) => setFootForm((c) => ({ ...c, notes: e.target.value }))} rows={3} placeholder="Assessment notes" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void submitFoot()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              Save Foot Assessment
            </button>
          </div>
          <div className="space-y-4">
            {footRiskAnalysis && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Risk Analysis</h3>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${footRiskStyles[footRiskAnalysis.risk_level] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {footRiskAnalysis.risk_level ?? 'unknown'}
                  </span>
                </div>
                <p className="text-sm text-slate-800">{footRiskAnalysis.recommended_action}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Wagner {footRiskAnalysis.max_wagner_grade ?? 0}</span>
                  <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">Amputation risk: {footRiskAnalysis.amputation_risk}</span>
                </div>
                {Array.isArray(footRiskAnalysis.abi_flags) && footRiskAnalysis.abi_flags.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {footRiskAnalysis.abi_flags.map((flag: string) => (
                      <div key={flag} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{flag}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Foot History</h3>
              {loading && <p className="text-sm text-slate-500">Loading history...</p>}
              <div className="space-y-3">
                {footHistory.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-100 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{formatDate(item.assessmentDate ?? item.assessment_date)}</p>
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${footRiskStyles[computeFootRisk(item)] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {computeFootRisk(item)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Wagner R/L: {item.rightWagnerGrade ?? item.right_wagner_grade ?? '—'} / {item.leftWagnerGrade ?? item.left_wagner_grade ?? '—'}</p>
                    <p className="text-sm text-slate-600">Ulcer: {(item.ulcerPresent ?? item.ulcer_present) ? 'Yes' : 'No'}</p>
                  </div>
                ))}
                {!footHistory.length && <p className="text-sm text-slate-500">No foot assessments yet.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'eye' && resolvedPatientId && (
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900">Retinopathy Screening</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={eyeForm.method} onChange={(e) => setEyeForm((c) => ({ ...c, method: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['ophthalmoscopy', 'fundus_photo', 'slit_lamp'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}</select>
              <select value={eyeForm.hypertensiveRetinopathyGrade} onChange={(e) => setEyeForm((c) => ({ ...c, hypertensiveRetinopathyGrade: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">HTN retinopathy grade</option>{[0, 1, 2, 3, 4].map((v) => <option key={v} value={v}>{v}</option>)}</select>
              <select value={eyeForm.rightEyeGrade} onChange={(e) => setEyeForm((c) => ({ ...c, rightEyeGrade: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['none', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr', 'ungradable'].map((v) => <option key={v} value={v}>Right eye: {v.replace(/_/g, ' ')}</option>)}</select>
              <select value={eyeForm.leftEyeGrade} onChange={(e) => setEyeForm((c) => ({ ...c, leftEyeGrade: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['none', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr', 'ungradable'].map((v) => <option key={v} value={v}>Left eye: {v.replace(/_/g, ' ')}</option>)}</select>
              <select value={eyeForm.urgency} onChange={(e) => setEyeForm((c) => ({ ...c, urgency: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['routine', 'urgent_within_1_week', 'emergency_same_day'].map((v) => <option key={v} value={v}>Urgency: {v.replace(/_/g, ' ')}</option>)}</select>
              <input value={eyeForm.nextScreeningMonths} onChange={(e) => setEyeForm((c) => ({ ...c, nextScreeningMonths: e.target.value }))} placeholder="Next screening months" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={eyeForm.rightEyeDme} onChange={(e) => setEyeForm((c) => ({ ...c, rightEyeDme: e.target.checked }))} /> Right DME</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={eyeForm.leftEyeDme} onChange={(e) => setEyeForm((c) => ({ ...c, leftEyeDme: e.target.checked }))} /> Left DME</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={eyeForm.referredToOphthalmology} onChange={(e) => setEyeForm((c) => ({ ...c, referredToOphthalmology: e.target.checked }))} /> Refer to ophthalmology</label>
            </div>
            <textarea value={eyeForm.notes} onChange={(e) => setEyeForm((c) => ({ ...c, notes: e.target.value }))} rows={3} placeholder="Screening notes" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void submitEye()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              Save Eye Screening
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-slate-900">Eye Screening History</h3>
            <div className="space-y-3">
              {eyeHistory.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 px-3 py-3">
                  <p className="text-sm font-semibold text-slate-900">{formatDate(item.screeningDate ?? item.screening_date)}</p>
                  <p className="mt-1 text-sm text-slate-600">Right / Left: {(item.rightEyeGrade ?? item.right_eye_grade ?? '—').replace(/_/g, ' ')} / {(item.leftEyeGrade ?? item.left_eye_grade ?? '—').replace(/_/g, ' ')}</p>
                  <p className="text-sm text-slate-600">DME: {(item.rightEyeDme ?? item.right_eye_dme) ? 'Right ' : ''}{(item.leftEyeDme ?? item.left_eye_dme) ? 'Left' : (!item.rightEyeDme && !item.right_eye_dme ? 'No' : '')}</p>
                  <p className="text-sm text-slate-600">Referral: {(item.referredToOphthalmology ?? item.referred_to_ophthalmology) ? 'Yes' : 'No'}</p>
                </div>
              ))}
              {!eyeHistory.length && <p className="text-sm text-slate-500">No retinopathy screenings yet.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'kidney' && resolvedPatientId && (
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900">CKD Staging</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={ckdForm.creatinineUmolL} onChange={(e) => setCkdForm((c) => ({ ...c, creatinineUmolL: e.target.value }))} placeholder="Creatinine umol/L" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={ckdForm.egfrMlMin173m2} onChange={(e) => setCkdForm((c) => ({ ...c, egfrMlMin173m2: e.target.value }))} placeholder="eGFR mL/min/1.73m2" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={ckdForm.egfrEquation} onChange={(e) => setCkdForm((c) => ({ ...c, egfrEquation: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['CKD-EPI', 'MDRD'].map((v) => <option key={v} value={v}>{v}</option>)}</select>
              <input value={ckdForm.uacrMgG} onChange={(e) => setCkdForm((c) => ({ ...c, uacrMgG: e.target.value }))} placeholder="UACR mg/g" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={ckdForm.urineDipstickProtein} onChange={(e) => setCkdForm((c) => ({ ...c, urineDipstickProtein: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['negative', 'trace', '1+', '2+', '3+'].map((v) => <option key={v} value={v}>Dipstick: {v}</option>)}</select>
              <select value={ckdForm.primaryCause} onChange={(e) => setCkdForm((c) => ({ ...c, primaryCause: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{['diabetic_nephropathy', 'hypertensive_nephropathy', 'other', 'unknown'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}</select>
              <input value={ckdForm.sbpMmhg} onChange={(e) => setCkdForm((c) => ({ ...c, sbpMmhg: e.target.value }))} placeholder="SBP" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={ckdForm.dbpMmhg} onChange={(e) => setCkdForm((c) => ({ ...c, dbpMmhg: e.target.value }))} placeholder="DBP" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={ckdForm.haemoglobinGDl} onChange={(e) => setCkdForm((c) => ({ ...c, haemoglobinGDl: e.target.value }))} placeholder="Hb g/dL" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={ckdForm.potassiumMmolL} onChange={(e) => setCkdForm((c) => ({ ...c, potassiumMmolL: e.target.value }))} placeholder="K+ mmol/L" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={ckdForm.bicarbonateMmolL} onChange={(e) => setCkdForm((c) => ({ ...c, bicarbonateMmolL: e.target.value }))} placeholder="HCO3 mmol/L" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={ckdForm.phosphateMmolL} onChange={(e) => setCkdForm((c) => ({ ...c, phosphateMmolL: e.target.value }))} placeholder="Phosphate mmol/L" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={ckdForm.aceInhibitorArb} onChange={(e) => setCkdForm((c) => ({ ...c, aceInhibitorArb: e.target.checked }))} /> On ACE/ARB</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={ckdForm.metforminStopped} onChange={(e) => setCkdForm((c) => ({ ...c, metforminStopped: e.target.checked }))} /> Metformin stopped</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={ckdForm.nsaidStopped} onChange={(e) => setCkdForm((c) => ({ ...c, nsaidStopped: e.target.checked }))} /> NSAIDs stopped</label>
            </div>
            <textarea value={ckdForm.notes} onChange={(e) => setCkdForm((c) => ({ ...c, notes: e.target.value }))} rows={3} placeholder="CKD notes" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void submitCkd()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              Save CKD Staging
            </button>
          </div>
          <div className="space-y-4">
            {ckdManagement && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">CKD Guidance</h3>
                  {ckdManagement.ckd_stage && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ckdStageStyles[ckdManagement.ckd_stage] || 'bg-slate-100 text-slate-700'}`}>{ckdManagement.ckd_stage}</span>}
                </div>
                <p className="text-sm text-slate-800">{ckdManagement.stage_description || 'Guidance returned'}</p>
                {Array.isArray(ckdManagement.medication_flags) && ckdManagement.medication_flags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ckdManagement.medication_flags.map((flag: any, index: number) => (
                      <span key={`${flag.drug}-${index}`} className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                        {flag.flag}: {flag.drug}
                      </span>
                    ))}
                  </div>
                )}
                {Array.isArray(ckdManagement.recommendations) && (
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {ckdManagement.recommendations.map((item: string) => <li key={item}>• {item}</li>)}
                  </ul>
                )}
              </div>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">CKD History</h3>
              <div className="space-y-3">
                {ckdHistory.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-100 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{formatDate(item.recordDate ?? item.record_date)}</p>
                      {(item.ckdStage ?? item.ckd_stage) && <span className={`rounded-full px-2 py-1 text-xs font-semibold ${ckdStageStyles[item.ckdStage ?? item.ckd_stage] || 'bg-slate-100 text-slate-700'}`}>{item.ckdStage ?? item.ckd_stage}</span>}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">Creatinine: {item.creatinineUmolL ?? item.creatinine_umol_l ?? '—'} | eGFR: {item.egfrMlMin173m2 ?? item.egfr_ml_min_1_73m2 ?? '—'}</p>
                    <p className="text-sm text-slate-600">Albuminuria: {item.albuminuriaCategory ?? item.albuminuria_category ?? '—'} | BP: {item.sbpMmhg ?? item.sbp_mmhg ?? '—'}/{item.dbpMmhg ?? item.dbp_mmhg ?? '—'}</p>
                  </div>
                ))}
                {!ckdHistory.length && <p className="text-sm text-slate-500">No CKD records yet.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
