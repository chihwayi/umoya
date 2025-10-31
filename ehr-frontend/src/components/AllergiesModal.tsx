import React, { useEffect, useState } from 'react';
import ModalPortal from './ModalPortal';
import { useNotification } from './GlobalNotification';
import { chartApi } from '../services/api';
import { ShieldAlert, X, Save, Plus } from 'lucide-react';

interface AllergiesModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  appointment?: any; // Optional - can work with just patientId
  patientId?: string; // Allow direct patient ID for nurses
  tenantSlug: string;
  token: string;
}

type Allergy = { allergen: string; reaction?: string; severity?: 'mild'|'moderate'|'severe' };

const AllergiesModal: React.FC<AllergiesModalProps> = ({ open, onClose, onSaved, appointment, patientId, tenantSlug, token }) => {
  const { showError, showSuccess } = useNotification();
  const [allergies, setAllergies] = useState<Allergy[]>([{ allergen: '', reaction: '', severity: 'mild' }]);
  const [loading, setLoading] = useState(false);

  // Get patient ID from either appointment or direct prop
  const actualPatientId = patientId || appointment?.patient?.id;

  useEffect(() => {
    if (!open || !actualPatientId) return;
    
    // Load allergies from structured table
    const loadAllergies = async () => {
      try {
        const response = await chartApi.getAllergies(actualPatientId, token, tenantSlug);
        const existingAllergies = response.data || [];
        
        if (existingAllergies.length > 0) {
          setAllergies(existingAllergies.map((a: any) => ({
            allergen: a.allergen || '',
            reaction: a.reaction || '',
            severity: a.severity || 'mild'
          })));
        } else {
          setAllergies([{ allergen: '', reaction: '', severity: 'mild' }]);
        }
      } catch (e) {
        console.error('Failed to load allergies:', e);
        setAllergies([{ allergen: '', reaction: '', severity: 'mild' }]);
      }
    };

    loadAllergies();
  }, [open, actualPatientId, token, tenantSlug]);

  const handleSave = async () => {
    if (!actualPatientId) {
      showError('Error', 'Patient ID is required');
      return;
    }
    try {
      setLoading(true);
      const valid = allergies.filter(a => a.allergen.trim());
      await chartApi.replaceAllergies(actualPatientId, valid, token, tenantSlug);
      showSuccess('Saved', 'Allergies updated');
      onSaved();
      onClose();
    } catch (e: any) {
      const raw = e?.response?.data; const msg = raw?.message || raw?.error || raw || 'Failed to save allergies';
      showError('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/60 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-r from-rose-600 to-red-600 rounded-xl"><ShieldAlert className="w-5 h-5 text-white" /></div>
              <h3 className="text-lg font-bold text-slate-900">Allergies</h3>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-600" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {allergies.map((a, idx) => (
              <div key={idx} className="p-4 bg-white/70 rounded-xl border border-slate-200/60 space-y-3">
                <input className="w-full border border-slate-300 rounded-xl p-3" placeholder="Allergen (e.g., Penicillin)" value={a.allergen} onChange={(e)=>setAllergies(prev=>prev.map((it,i)=>i===idx?{...it,allergen:e.target.value}:it))} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <input className="border border-slate-300 rounded-xl p-2" placeholder="Reaction" value={a.reaction||''} onChange={(e)=>setAllergies(prev=>prev.map((it,i)=>i===idx?{...it,reaction:e.target.value}:it))} />
                  <select className="border border-slate-300 rounded-xl p-2" value={a.severity||'mild'} onChange={(e)=>setAllergies(prev=>prev.map((it,i)=>i===idx?{...it,severity:e.target.value as any}:it))}>
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </div>
                <div className="flex justify-end">
                  {allergies.length>1 && (
                    <button onClick={()=>setAllergies(prev=>prev.filter((_,i)=>i!==idx))} className="text-red-600 text-xs px-3 py-1 border border-red-200 rounded-lg">Remove</button>
                  )}
                </div>
              </div>
            ))}
            <button onClick={()=>setAllergies(prev=>[...prev,{ allergen:'', reaction:'', severity:'mild' }])} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 flex items-center gap-2 w-full justify-center">
              <Plus className="w-4 h-4" /> Add Allergy
            </button>
          </div>
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300">Cancel</button>
            <button onClick={handleSave} disabled={loading} className="px-4 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 text-white">{loading?'Saving...':'Save Allergies'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default AllergiesModal;


