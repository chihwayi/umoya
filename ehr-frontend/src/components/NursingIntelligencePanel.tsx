import React, { useState } from 'react';
import { Heart, Shield, FileText, AlertTriangle, CheckCircle, Brain } from 'lucide-react';
import { cdssApi } from '../services/api';
import { AiOutputWrapper } from './AiOutputWrapper';

interface NursingIntelligencePanelProps {
  patientId: string;
  diagnoses: string[];
  patientAge?: number;
  mobilityStatus?: string;
  cognitiveStatus?: string;
  currentVitals?: Record<string, any>;
  activeMedications?: string[];
  admissionReason?: string;
  token: string;
  tenantSlug: string;
}

type ActiveTool = 'care-plan' | 'sbar' | 'fall-risk' | 'wound' | null;

export const NursingIntelligencePanel: React.FC<NursingIntelligencePanelProps> = ({
  patientId, diagnoses, patientAge, mobilityStatus = 'ambulatory',
  cognitiveStatus = 'intact', currentVitals = {}, activeMedications = [],
  admissionReason = '', token, tenantSlug,
}) => {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Wound form state
  const [woundForm, setWoundForm] = useState({
    wound_type: 'pressure_ulcer', description: '', location: '', depth: 'superficial',
    exudate: 'minimal', patient_has_diabetes: false, patient_has_pvd: false,
  });

  const runTool = async (tool: ActiveTool) => {
    if (activeTool === tool) { setActiveTool(null); setResult(null); return; }
    setActiveTool(tool);
    setResult(null);
    setLoading(true);
    try {
      let res: any;
      if (tool === 'care-plan') {
        res = await cdssApi.generateNursingCarePlan({ diagnoses, patient_age: patientAge, mobility_status: mobilityStatus, cognitive_status: cognitiveStatus, admission_reason: admissionReason }, token, tenantSlug);
      } else if (tool === 'sbar') {
        res = await cdssApi.generateSBAR({ admission_diagnosis: admissionReason || diagnoses[0] || '', current_vitals: currentVitals, current_medications: activeMedications, patient_age: patientAge, active_concerns: [] }, token, tenantSlug);
      } else if (tool === 'fall-risk') {
        res = await cdssApi.assessFallRisk({ age: patientAge, diagnoses, medications: activeMedications, gait: mobilityStatus === 'bedbound' ? 'impaired' : mobilityStatus === 'limited' ? 'weak' : 'normal', mental_status: cognitiveStatus === 'confused' ? 'confused' : cognitiveStatus === 'impaired' ? 'forgetful' : 'oriented' }, token, tenantSlug);
      }
      setResult(res?.data ?? res);
    } catch { setResult(null); }
    finally { setLoading(false); }
  };

  const runWoundStaging = async () => {
    setLoading(true);
    try {
      const res = await cdssApi.stageWound({ ...woundForm, patient_age: patientAge }, token, tenantSlug);
      setResult(res?.data ?? res);
    } catch { setResult(null); }
    finally { setLoading(false); }
  };

  const tools = [
    { id: 'care-plan' as ActiveTool, label: 'Care Plan', icon: Heart, color: 'text-rose-600' },
    { id: 'sbar' as ActiveTool, label: 'SBAR Handoff', icon: FileText, color: 'text-blue-600' },
    { id: 'fall-risk' as ActiveTool, label: 'Fall Risk', icon: Shield, color: 'text-amber-600' },
    { id: 'wound' as ActiveTool, label: 'Wound Staging', icon: AlertTriangle, color: 'text-orange-600' },
  ];

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Brain className="h-4 w-4 text-purple-400" />
        <span className="text-sm font-semibold text-gray-200">Nursing AI Tools</span>
        <span className="ml-auto text-[10px] text-gray-500">AI-generated · clinician review required</span>
      </div>

      {/* Tool buttons */}
      <div className="grid grid-cols-2 gap-2">
        {tools.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => { if (id === 'wound') { setActiveTool(activeTool === 'wound' ? null : 'wound'); setResult(null); } else runTool(id); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
              activeTool === id ? 'bg-purple-900/30 border-purple-600 text-purple-300' : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:border-purple-500'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${color}`} />
            {label}
          </button>
        ))}
      </div>

      {/* Wound form */}
      {activeTool === 'wound' && (
        <div className="space-y-2 border border-gray-700 rounded-lg p-3 bg-gray-900/30">
          <div className="grid grid-cols-2 gap-2">
            <select value={woundForm.wound_type} onChange={e => setWoundForm(p => ({...p, wound_type: e.target.value}))} className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-gray-200">
              <option value="pressure_ulcer">Pressure Ulcer</option>
              <option value="surgical">Surgical Wound</option>
              <option value="diabetic_foot">Diabetic Foot</option>
              <option value="venous">Venous Ulcer</option>
              <option value="arterial">Arterial Ulcer</option>
              <option value="traumatic">Traumatic</option>
            </select>
            <select value={woundForm.depth} onChange={e => setWoundForm(p => ({...p, depth: e.target.value}))} className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-gray-200">
              <option value="superficial">Superficial</option>
              <option value="partial_thickness">Partial Thickness</option>
              <option value="full_thickness">Full Thickness</option>
              <option value="eschar">Eschar/Slough</option>
            </select>
          </div>
          <textarea value={woundForm.description} onChange={e => setWoundForm(p => ({...p, description: e.target.value}))} placeholder="Wound description (e.g. 2cm x 3cm, red base, no slough...)" className="w-full text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-gray-200 resize-none" rows={2} />
          <div className="grid grid-cols-2 gap-2">
            <select value={woundForm.exudate} onChange={e => setWoundForm(p => ({...p, exudate: e.target.value}))} className="text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-gray-200">
              <option value="none">No Exudate</option>
              <option value="minimal">Minimal</option>
              <option value="moderate">Moderate</option>
              <option value="heavy">Heavy</option>
            </select>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <label className="flex items-center gap-1"><input type="checkbox" checked={woundForm.patient_has_diabetes} onChange={e => setWoundForm(p => ({...p, patient_has_diabetes: e.target.checked}))} className="rounded" /> DM</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={woundForm.patient_has_pvd} onChange={e => setWoundForm(p => ({...p, patient_has_pvd: e.target.checked}))} className="rounded" /> PVD</label>
            </div>
          </div>
          <button onClick={runWoundStaging} disabled={loading || !woundForm.description} className="w-full py-1.5 bg-orange-600 text-white rounded text-xs font-semibold disabled:opacity-50">
            {loading ? 'Staging...' : 'Stage Wound'}
          </button>
        </div>
      )}

      {/* Results */}
      {loading && activeTool !== 'wound' && <div className="text-xs text-gray-400 py-2">Generating...</div>}

      {result && (
        <AiOutputWrapper
          label={activeTool === 'care-plan' ? 'Nursing Care Plan' : activeTool === 'sbar' ? 'SBAR Handoff' : activeTool === 'fall-risk' ? 'Fall Risk Assessment' : 'Wound Staging'}
          confidence={result.confidence}
          abstained={result.abstained}
          abstain_reason={result.abstain_reason}
          model_id={result.model_id}
        >
          <div className="text-xs text-gray-200 space-y-2">

            {/* Care Plan results */}
            {activeTool === 'care-plan' && result.care_plan?.map((item: any, i: number) => (
              <div key={i} className="border border-gray-700 rounded-lg p-2.5 space-y-1.5">
                <div className="font-semibold text-rose-400">{item.problem}</div>
                <div className="text-gray-400"><span className="text-gray-300">Goal:</span> {item.goal}</div>
                <div className="font-medium text-gray-300 mt-1">Interventions:</div>
                <ul className="space-y-0.5 pl-3">
                  {item.interventions.map((iv: string, j: number) => (
                    <li key={j} className="text-gray-400 list-disc">{iv}</li>
                  ))}
                </ul>
                <div className="text-gray-500 mt-1">{item.nanda} · {item.nic}</div>
              </div>
            ))}

            {/* SBAR results */}
            {activeTool === 'sbar' && result.sbar && (
              <div className="space-y-1.5 font-mono text-[11px]">
                {['situation', 'background', 'assessment', 'recommendation'].map(key => (
                  <div key={key} className="border-l-2 border-blue-600 pl-2">
                    <span className="font-bold text-blue-400 uppercase">{key[0]}:</span>
                    <span className="text-gray-300 ml-1">{result.sbar[key]}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Fall Risk results */}
            {activeTool === 'fall-risk' && result.risk_level && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-base font-bold ${result.risk_level === 'high' ? 'text-red-400' : result.risk_level === 'moderate' ? 'text-amber-400' : 'text-green-400'}`}>
                    Score: {result.total_score} — {result.risk_level.toUpperCase()} RISK
                  </span>
                </div>
                {result.contributing_factors?.map((f: any, i: number) => (
                  <div key={i} className="flex justify-between text-gray-400">
                    <span>{f.factor}</span><span className="text-amber-400">+{f.score}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Wound Staging results */}
            {(activeTool === 'wound' || result.stage) && result.stage && (
              <div className="space-y-1.5">
                <div className="font-bold text-orange-400 text-sm">{result.stage}</div>
                {result.staging_basis?.map((b: string, i: number) => (
                  <p key={i} className="text-gray-400">{b}</p>
                ))}
                <div className="font-medium text-gray-300">Care Recommendations:</div>
                {result.care_recommendations?.map((r: string, i: number) => (
                  <div key={i} className="text-gray-400 flex items-start gap-1">
                    <CheckCircle className="h-3 w-3 shrink-0 mt-0.5 text-green-500" />{r}
                  </div>
                ))}
                {result.escalation_required && (
                  <div className="flex items-center gap-1 text-red-400 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5" /> Escalation required — specialist consult needed
                  </div>
                )}
              </div>
            )}
          </div>
        </AiOutputWrapper>
      )}
    </div>
  );
};
