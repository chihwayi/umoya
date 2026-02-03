import React, { useState } from 'react';
import { X, LogOut, ArrowRight, Home, Ambulance, FileText } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';
import ICD10Picker from './ICD10Picker';
import axios from 'axios';

const ehrAxios = axios.create({ baseURL: 'http://localhost:3013/api' });

interface EDDispositionModalProps {
  visit: any;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

const EDDispositionModal: React.FC<EDDispositionModalProps> = ({
  visit,
  tenantSlug,
  token,
  onClose,
  onSuccess,
}) => {
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  
  const [dispositionData, setDispositionData] = useState({
    disposition: 'discharge_home',
    dischargeDiagnosis: '',
    dischargeDiagnosisICD10: '',
    dischargeDiagnosisICD10Term: '',
    dischargeDiagnosisSNOMED: null as SnomedConcept | null,
    dischargeInstructions: '',
    followUpInstructions: '',
    prescriptionsGiven: '',
    referrals: '',
  });
  
  const handleICD10Change = (code: string, description: string) => {
    setDispositionData({
      ...dispositionData,
      dischargeDiagnosisICD10: code,
      dischargeDiagnosisICD10Term: description,
      // Auto-fill diagnosis text if empty
      dischargeDiagnosis: dispositionData.dischargeDiagnosis || description,
    });
  };

  const [procedures, setProcedures] = useState<Array<{
    procedure: string;
    cptCode: string;
    snomedCode: string;
    snomedConcept?: SnomedConcept | null;
  }>>([]);

  const handleAddProcedure = () => {
    setProcedures([...procedures, { procedure: '', cptCode: '', snomedCode: '', snomedConcept: null }]);
  };

  const handleRemoveProcedure = (index: number) => {
    setProcedures(procedures.filter((_, i) => i !== index));
  };

  const handleProcedureChange = (index: number, field: string, value: any) => {
    const updated = [...procedures];
    updated[index] = { ...updated[index], [field]: value };
    setProcedures(updated);
  };

  const handleSnomedSelect = (index: number, concept: SnomedConcept | null) => {
    const updated = [...procedures];
    updated[index] = {
      ...updated[index],
      snomedConcept: concept,
      snomedCode: concept?.conceptId || '',
      procedure: concept?.term || updated[index].procedure // Auto-fill name if empty or overwrite? Let's overwrite to ensure match
    };
    setProcedures(updated);
  };

  const handleDisposition = async () => {
    if (!dispositionData.dischargeDiagnosis) {
      showError('Error', 'Discharge diagnosis is required');
      return;
    }
    if (!dispositionData.dischargeDiagnosisICD10) {
      showError('Error', 'ICD-10 code is REQUIRED for ED billing');
      return;
    }

    try {
      setLoading(true);
      
      await ehrAxios.post(`/ed/visits/${visit.id}/disposition`, {
        disposition: dispositionData.disposition,
        dischargeDiagnosis: dispositionData.dischargeDiagnosis,
        dischargeDiagnosisIcd10: dispositionData.dischargeDiagnosisICD10,
        dischargeDiagnosisSnomed: dispositionData.dischargeDiagnosisSNOMED?.conceptId || null,
        dischargeDiagnosisTerm: dispositionData.dischargeDiagnosisSNOMED?.term || null,
        dischargeInstructions: dispositionData.dischargeInstructions,
        followUpInstructions: dispositionData.followUpInstructions,
        prescriptionsGiven: dispositionData.prescriptionsGiven,
        referrals: dispositionData.referrals,
        proceduresPerformed: procedures,
      }, {
        headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` },
      });

      showSuccess('Success', `Patient ${dispositionData.disposition === 'admit' ? 'admitted' : 'discharged'}`);
      onSuccess();
      onClose();
    } catch (error) {
      showError('Error', 'Failed to complete disposition');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-red-600 to-orange-600 text-white p-6 rounded-t-xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <LogOut className="w-6 h-6" />
                ED Disposition
              </h3>
              <p className="text-red-100 mt-1">
                {visit.patient?.firstName} {visit.patient?.lastName} • {visit.edVisitNumber}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Disposition Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Disposition *</label>
            <select
              value={dispositionData.disposition}
              onChange={(e) => setDispositionData({ ...dispositionData, disposition: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="discharge_home">Discharge Home</option>
              <option value="admit">Admit to Hospital</option>
              <option value="transfer">Transfer to Another Facility</option>
              <option value="ama">Left AMA (Against Medical Advice)</option>
              <option value="deceased">Deceased</option>
              <option value="observation">Observation Unit</option>
            </select>
          </div>

          {/* Discharge Diagnosis - FREE TEXT */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Discharge Diagnosis (Free Text) *
            </label>
            <input
              type="text"
              value={dispositionData.dischargeDiagnosis}
              onChange={(e) => setDispositionData({ ...dispositionData, dischargeDiagnosis: e.target.value })}
              placeholder="e.g., Acute Myocardial Infarction"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* ICD-10 Code - REQUIRED FOR BILLING - SEARCHABLE */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
            <ICD10Picker
              value={dispositionData.dischargeDiagnosisICD10}
              onChange={handleICD10Change}
              token={token}
              tenantSlug={tenantSlug}
              label="🚨 ICD-10 Code (REQUIRED FOR BILLING)"
              placeholder="Search: chest pain, stroke, pneumonia..."
              helperText="⚠️ Without ICD-10, this ED visit CANNOT be billed to insurance!"
              required={true}
            />
            {dispositionData.dischargeDiagnosisICD10 && (
              <div className="mt-2 bg-green-50 border border-green-300 rounded-lg p-2">
                <div className="text-xs text-green-700">
                  ✓ Selected: <strong className="font-mono">{dispositionData.dischargeDiagnosisICD10}</strong> - {dispositionData.dischargeDiagnosisICD10Term}
                </div>
              </div>
            )}
          </div>

          {/* SNOMED Code - For Clinical Documentation */}
          <div>
            <SnomedConceptPicker
              value={dispositionData.dischargeDiagnosisSNOMED}
              onChange={(concept) => setDispositionData({ ...dispositionData, dischargeDiagnosisSNOMED: concept })}
              token={token}
              tenantSlug={tenantSlug}
              label="Discharge Diagnosis SNOMED Code (Recommended)"
              placeholder="Search SNOMED for diagnosis..."
              helperText="For clinical documentation and interoperability"
              context="condition"
            />
          </div>

          {/* Procedures Performed */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">
                Procedures Performed (for billing)
              </label>
              <button
                onClick={handleAddProcedure}
                className="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition"
              >
                + Add Procedure
              </button>
            </div>
            
            {procedures.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-sm text-slate-500">
                No procedures recorded. Click "+ Add Procedure" if any were performed.
              </div>
            ) : (
              <div className="space-y-3">
                {procedures.map((proc, index) => (
                  <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-xs font-bold text-slate-500">Procedure #{index + 1}</span>
                      <button
                        onClick={() => handleRemoveProcedure(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2">
                         <label className="text-xs font-medium text-slate-700">Procedure (SNOMED) *</label>
                         <SnomedConceptPicker
                            value={proc.snomedConcept || (proc.snomedCode ? { conceptId: proc.snomedCode, term: proc.procedure } : null)}
                            onChange={(concept) => handleSnomedSelect(index, concept)}
                            token={token}
                            tenantSlug={tenantSlug}
                            ecl="<< 71388002 |Procedure (procedure)|"
                            placeholder="Search procedure (e.g. Suturing, X-ray)..."
                         />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-medium text-slate-700">Procedure Name (Override)</label>
                            <input
                              type="text"
                              value={proc.procedure}
                              onChange={(e) => handleProcedureChange(index, 'procedure', e.target.value)}
                              placeholder="Procedure name"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-700">CPT Code (Billing)</label>
                            <input
                              type="text"
                              value={proc.cptCode}
                              onChange={(e) => handleProcedureChange(index, 'cptCode', e.target.value.toUpperCase())}
                              placeholder="e.g. 12001"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                            />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2">
              💡 CPT codes are required for billing procedures (sutures, X-rays, etc.)
            </p>
          </div>

          {/* Discharge Instructions */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Discharge Instructions</label>
            <textarea
              value={dispositionData.dischargeInstructions}
              onChange={(e) => setDispositionData({ ...dispositionData, dischargeInstructions: e.target.value })}
              rows={3}
              placeholder="Home care instructions, activity restrictions, warning signs..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Follow-up Instructions */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Follow-up Instructions</label>
            <textarea
              value={dispositionData.followUpInstructions}
              onChange={(e) => setDispositionData({ ...dispositionData, followUpInstructions: e.target.value })}
              rows={2}
              placeholder="Follow up with PCP in 3 days, return if symptoms worsen..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Prescriptions Given */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Prescriptions Given</label>
            <textarea
              value={dispositionData.prescriptionsGiven}
              onChange={(e) => setDispositionData({ ...dispositionData, prescriptionsGiven: e.target.value })}
              rows={2}
              placeholder="List medications prescribed at discharge..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end p-6 bg-slate-50 rounded-b-xl border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDisposition}
            disabled={loading}
            className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:shadow-lg transition font-medium disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Complete Disposition'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EDDispositionModal;

