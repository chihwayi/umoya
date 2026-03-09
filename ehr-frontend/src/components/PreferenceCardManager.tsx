import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Loader2 } from 'lucide-react';
import { useNotification } from './GlobalNotification';
import { ehrAxios } from '../services/api';

interface PreferenceCardManagerProps {
  tenantSlug: string;
  token: string;
  onClose: () => void;
}

const PreferenceCardManager: React.FC<PreferenceCardManagerProps> = ({
  tenantSlug,
  token,
  onClose,
}) => {
  const { showError, showSuccess } = useNotification();
  const [cards, setCards] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    surgeonId: '',
    procedureName: '',
    procedureCodeCpt: '',
    preferredOrType: '',
    preferredPosition: '',
    preferredAnesthesia: '',
    specialInstructions: '',
  });

  const headers = { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` };

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [cardsRes, usersRes] = await Promise.all([
        ehrAxios.get('/operating-room/preference-cards', { headers }),
        ehrAxios.get('/users', { headers }).catch(() => ({ data: [] })),
      ]);
      setCards(cardsRes.data || []);
      setUsers(usersRes.data?.users || usersRes.data || []);
    } catch (e) {
      showError('Error', 'Failed to load preference cards');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.surgeonId || !form.procedureName.trim()) {
      showError('Error', 'Surgeon and procedure name required');
      return;
    }
    try {
      await ehrAxios.post('/operating-room/preference-cards', form, { headers });
      showSuccess('Success', 'Preference card created');
      setForm({ surgeonId: '', procedureName: '', procedureCodeCpt: '', preferredOrType: '', preferredPosition: '', preferredAnesthesia: '', specialInstructions: '' });
      load();
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed to create');
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      await ehrAxios.put(`/operating-room/preference-cards/${editingId}`, form, { headers });
      showSuccess('Success', 'Preference card updated');
      setEditingId(null);
      setForm({ surgeonId: '', procedureName: '', procedureCodeCpt: '', preferredOrType: '', preferredPosition: '', preferredAnesthesia: '', specialInstructions: '' });
      load();
    } catch (e: any) {
      showError('Error', e.response?.data?.message || 'Failed to update');
    }
  };

  const startEdit = (card: any) => {
    setEditingId(card.id);
    setForm({
      surgeonId: card.surgeon_id || card.surgeonId || '',
      procedureName: card.procedure_name || card.procedureName || '',
      procedureCodeCpt: card.procedure_code_cpt || card.procedureCodeCpt || '',
      preferredOrType: card.preferred_or_type || card.preferredOrType || '',
      preferredPosition: card.preferred_position || card.preferredPosition || '',
      preferredAnesthesia: card.preferred_anesthesia || card.preferredAnesthesia || '',
      specialInstructions: card.special_instructions || card.specialInstructions || '',
    });
  };

  const surgeonName = (id: string) => {
    const u = users.find((x: any) => (x.id || x.userId) === id);
    return u ? `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`.trim() || id : id;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-indigo-600 text-white p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Preference Cards</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
          ) : (
            <>
              <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h3 className="font-semibold text-slate-900">{editingId ? 'Edit card' : 'New card'}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <label className="block text-slate-600 mb-0.5">Surgeon</label>
                    <select
                      value={form.surgeonId}
                      onChange={(e) => setForm((f) => ({ ...f, surgeonId: e.target.value }))}
                      className="w-full px-2 py-1.5 border rounded"
                      disabled={!!editingId}
                    >
                      <option value="">Select...</option>
                      {users.filter((u: any) => u.role === 'doctor' || !u.role).map((u: any) => (
                        <option key={u.id || u.userId} value={u.id || u.userId}>
                          {u.firstName || u.first_name} {u.lastName || u.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Procedure</label>
                    <input
                      value={form.procedureName}
                      onChange={(e) => setForm((f) => ({ ...f, procedureName: e.target.value }))}
                      className="w-full px-2 py-1.5 border rounded"
                      placeholder="Procedure name"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">CPT</label>
                    <input
                      value={form.procedureCodeCpt}
                      onChange={(e) => setForm((f) => ({ ...f, procedureCodeCpt: e.target.value }))}
                      className="w-full px-2 py-1.5 border rounded"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Position</label>
                    <input
                      value={form.preferredPosition}
                      onChange={(e) => setForm((f) => ({ ...f, preferredPosition: e.target.value }))}
                      className="w-full px-2 py-1.5 border rounded"
                      placeholder="e.g. Supine"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-slate-600 mb-0.5">Special instructions</label>
                    <textarea
                      value={form.specialInstructions}
                      onChange={(e) => setForm((f) => ({ ...f, specialInstructions: e.target.value }))}
                      className="w-full px-2 py-1.5 border rounded"
                      rows={2}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {editingId ? (
                    <>
                      <button type="button" onClick={handleUpdate} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium">Save</button>
                      <button type="button" onClick={() => { setEditingId(null); setForm({ surgeonId: '', procedureName: '', procedureCodeCpt: '', preferredOrType: '', preferredPosition: '', preferredAnesthesia: '', specialInstructions: '' }); }} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded text-sm">Cancel</button>
                    </>
                  ) : (
                    <button type="button" onClick={handleCreate} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
                  )}
                </div>
              </div>
              <ul className="space-y-2">
                {cards.map((card) => (
                  <li key={card.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <span className="font-semibold text-slate-900">{card.procedure_name || card.procedureName}</span>
                      <span className="text-slate-500 text-sm ml-2">— {surgeonName(card.surgeon_id || card.surgeonId)}</span>
                      {(card.preferred_position || card.preferredPosition) && (
                        <span className="text-slate-600 text-sm block mt-0.5">Position: {card.preferred_position || card.preferredPosition}</span>
                      )}
                    </div>
                    <button type="button" onClick={() => startEdit(card)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
              {cards.length === 0 && !loading && <p className="text-slate-500 text-sm text-center py-4">No preference cards yet. Add one above.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreferenceCardManager;
