import React, { useEffect, useState } from 'react';
import ModalPortal from './ModalPortal';
import { useNotification } from './GlobalNotification';
import { chartApi } from '../services/api';
import { ListTree, X, Save, Plus, Check, AlertTriangle } from 'lucide-react';

interface ProblemListModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  appointment: any;
  tenantSlug: string;
  token: string;
}

type Problem = { description: string; status?: 'active' | 'resolved'; code?: string; onsetDate?: string; resolvedDate?: string };

const ProblemListModal: React.FC<ProblemListModalProps> = ({ open, onClose, onSaved, appointment, tenantSlug, token }) => {
  const { showError, showSuccess } = useNotification();
  const [problems, setProblems] = useState<Problem[]>([{ description: '', status: 'active' }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    try {
      if (appointment?.notes) {
        const parsed = JSON.parse(appointment.notes);
        setProblems(parsed.problems && Array.isArray(parsed.problems) && parsed.problems.length > 0 ? parsed.problems : [{ description: '', status: 'active' }]);
      } else {
        setProblems([{ description: '', status: 'active' }]);
      }
    } catch {
      setProblems([{ description: '', status: 'active' }]);
    }
  }, [open, appointment?.id]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const valid = problems.filter(p => p.description.trim());
      await chartApi.replaceProblems(appointment.patient.id, valid, token, tenantSlug);
      showSuccess('Saved', 'Problem list updated');
      onSaved();
    } catch (e: any) {
      const raw = e?.response?.data; const msg = raw?.message || raw?.error || raw || 'Failed to save problems';
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
              <div className="p-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl"><ListTree className="w-5 h-5 text-white" /></div>
              <h3 className="text-lg font-bold text-slate-900">Problem List</h3>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-600" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {problems.map((p, idx) => (
              <div key={idx} className="p-4 bg-white/70 rounded-xl border border-slate-200/60 space-y-3">
                <input className="w-full border border-slate-300 rounded-xl p-3" placeholder="Description (e.g., Type 2 Diabetes)" value={p.description} onChange={(e)=>setProblems(prev=>prev.map((it,i)=>i===idx?{...it,description:e.target.value}:it))} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <input className="border border-slate-300 rounded-xl p-2" placeholder="Code (ICD-10/SNOMED)" value={p.code||''} onChange={(e)=>setProblems(prev=>prev.map((it,i)=>i===idx?{...it,code:e.target.value}:it))} />
                  <input className="border border-slate-300 rounded-xl p-2" type="date" placeholder="Onset" value={p.onsetDate||''} onChange={(e)=>setProblems(prev=>prev.map((it,i)=>i===idx?{...it,onsetDate:e.target.value}:it))} />
                  <select className="border border-slate-300 rounded-xl p-2" value={p.status||'active'} onChange={(e)=>setProblems(prev=>prev.map((it,i)=>i===idx?{...it,status:e.target.value as any}:it))}>
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <div className="flex justify-end">
                  {problems.length>1 && (
                    <button onClick={()=>setProblems(prev=>prev.filter((_,i)=>i!==idx))} className="text-red-600 text-xs px-3 py-1 border border-red-200 rounded-lg">Remove</button>
                  )}
                </div>
              </div>
            ))}
            <button onClick={()=>setProblems(prev=>[...prev,{ description:'', status:'active' }])} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 flex items-center gap-2 w-full justify-center">
              <Plus className="w-4 h-4" /> Add Problem
            </button>
          </div>
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300">Cancel</button>
            <button onClick={handleSave} disabled={loading} className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white">{loading?'Saving...':'Save Problems'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ProblemListModal;


