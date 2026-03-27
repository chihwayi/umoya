import React, { useState } from 'react';
import { LogOut, AlertTriangle, CheckCircle, Calendar, FileText, RefreshCw } from 'lucide-react';
import { cdssApi } from '../services/api';
import { AiOutputWrapper } from './AiOutputWrapper';

interface DischargeIntelligencePanelProps {
  admissionDiagnosis: string;
  diagnoses?: string[];
  lengthOfStayDays?: number;
  dischargeMedications?: string[];
  vitalsAtDischarge?: Record<string, any>;
  comorbidities?: string[];
  socialFactors?: string[];
  priorAdmissions30d?: number;
  patientAge?: number;
  specialtyReferrals?: string[];
  token: string;
  tenantSlug: string;
}

export const DischargeIntelligencePanel: React.FC<DischargeIntelligencePanelProps> = ({
  admissionDiagnosis, diagnoses = [], lengthOfStayDays = 1,
  dischargeMedications = [], vitalsAtDischarge = {}, comorbidities = [],
  socialFactors = [], priorAdmissions30d = 0, patientAge,
  specialtyReferrals = [], token, tenantSlug,
}) => {
  const [result, setResult] = useState<any>(null);
  const [followUp, setFollowUp] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    setFollowUp(null);
    try {
      const [dischRes, followRes] = await Promise.allSettled([
        cdssApi.getDischargeIntelligence({
          admission_diagnosis: admissionDiagnosis,
          diagnoses,
          length_of_stay_days: lengthOfStayDays,
          discharge_medications: dischargeMedications,
          vitals_at_discharge: vitalsAtDischarge,
          comorbidities,
          social_factors: socialFactors,
          prior_admissions_30d: priorAdmissions30d,
          patient_age: patientAge,
        }, token, tenantSlug),
        cdssApi.getFollowUpTiming({
          diagnoses,
          discharge_medications: dischargeMedications,
          length_of_stay_days: lengthOfStayDays,
          risk_level: 'medium',
          specialty_referrals: specialtyReferrals,
        }, token, tenantSlug),
      ]);
      if (dischRes.status === 'fulfilled') setResult((dischRes.value as any).data);
      if (followRes.status === 'fulfilled') setFollowUp((followRes.value as any).data);
    } finally { setLoading(false); }
  };

  const riskClass = result?.readmission_risk === 'high'
    ? 'text-red-400 border-red-700 bg-red-900/10'
    : result?.readmission_risk === 'moderate'
      ? 'text-amber-400 border-amber-700 bg-amber-900/10'
      : 'text-green-400 border-green-700 bg-green-900/10';

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogOut className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-semibold text-gray-200">Discharge Intelligence</span>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analyzing...' : 'Generate Discharge Plan'}
        </button>
      </div>

      {result && (
        <AiOutputWrapper
          label="Discharge Summary & Readmission Risk"
          confidence={result.confidence}
          abstained={result.abstained}
          abstain_reason={result.abstain_reason}
          model_id={result.model_id}
          citations={result.citations}
        >
          <div className="space-y-3 text-xs">
            {/* Readmission risk score */}
            <div className={`border rounded-lg p-3 ${riskClass}`}>
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm capitalize">
                  30-day Readmission Risk: {result.readmission_risk?.toUpperCase()}
                </span>
                <span className="font-mono">
                  {result.readmission_probability_30d != null
                    ? `${Math.round(result.readmission_probability_30d * 100)}%`
                    : ''}
                </span>
              </div>
              <span className="opacity-70">LACE+ Score: {result.lace_score}</span>
            </div>

            {/* Discharge summary */}
            {result.discharge_summary && (
              <div className="border border-gray-700 rounded-lg p-2.5 space-y-1.5">
                <p className="font-semibold text-gray-300 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> Discharge Summary
                </p>
                <p className="text-gray-400">{result.discharge_summary.hospital_course}</p>
                {(result.discharge_summary.return_precautions ?? []).length > 0 && (
                  <div>
                    <p className="font-medium text-amber-400 mt-1.5">Return Precautions:</p>
                    {result.discharge_summary.return_precautions.map((p: string, i: number) => (
                      <div key={i} className="flex items-start gap-1 text-gray-400">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />{p}
                      </div>
                    ))}
                  </div>
                )}
                {(result.discharge_summary.patient_education_topics ?? []).length > 0 && (
                  <div>
                    <p className="font-medium text-blue-400 mt-1.5">Patient Education:</p>
                    {result.discharge_summary.patient_education_topics.map((t: string, i: number) => (
                      <div key={i} className="flex items-start gap-1 text-gray-400">
                        <CheckCircle className="h-3 w-3 shrink-0 mt-0.5 text-blue-400" />{t}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Interventions */}
            {(result.interventions ?? []).length > 0 && (
              <div className="border border-purple-800 rounded-lg p-2.5 space-y-1">
                <p className="font-semibold text-purple-400">Interventions to Reduce Readmission</p>
                {result.interventions.map((iv: string, i: number) => (
                  <div key={i} className="flex items-start gap-1 text-purple-200">
                    <CheckCircle className="h-3 w-3 shrink-0 mt-0.5" />{iv}
                  </div>
                ))}
              </div>
            )}
          </div>
        </AiOutputWrapper>
      )}

      {/* Follow-up timing */}
      {(followUp?.follow_up_appointments ?? []).length > 0 && (
        <AiOutputWrapper
          label="Follow-up Schedule"
          confidence={followUp.confidence}
          model_id={followUp.model_id}
        >
          <div className="space-y-1.5 text-xs">
            {followUp.follow_up_appointments.map((apt: any, i: number) => (
              <div key={i} className="flex items-start gap-2 border border-gray-700 rounded p-2">
                <Calendar className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${apt.urgency === 'urgent' ? 'text-red-400' : 'text-blue-400'}`} />
                <div>
                  <span className="font-semibold text-gray-200">{apt.specialty}</span>
                  <span className={`ml-2 text-[10px] font-medium ${apt.urgency === 'urgent' ? 'text-red-400' : 'text-gray-400'}`}>
                    within {apt.timeframe}
                  </span>
                  <p className="text-gray-500">{apt.rationale}</p>
                </div>
              </div>
            ))}
            {(followUp.lab_follow_ups ?? []).map((lab: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-gray-400 px-2">
                <span className="text-green-400 font-mono text-[10px]">LAB</span>
                <span>{lab.test} — within {lab.timeframe}</span>
                <span className="text-gray-500">({lab.reason})</span>
              </div>
            ))}
          </div>
        </AiOutputWrapper>
      )}
    </div>
  );
};
