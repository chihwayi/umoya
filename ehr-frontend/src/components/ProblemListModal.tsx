import React, { useEffect, useMemo, useState } from 'react';
import ModalPortal from './ModalPortal';
import { useNotification } from './GlobalNotification';
import { chartApi } from '../services/api';
import { ListTree, X, Plus, Loader2, AlertTriangle } from 'lucide-react';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';

interface ProblemListModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  appointment: any;
  tenantSlug: string;
  token: string;
}

type ProblemEntry = {
  concept: SnomedConcept | null;
  status: 'active' | 'resolved';
  onsetDate?: string;
  resolvedDate?: string;
  notes?: string;
};

const ProblemListModal: React.FC<ProblemListModalProps> = ({ open, onClose, onSaved, appointment, tenantSlug, token }) => {
  const { showError, showSuccess } = useNotification();
  const [problems, setProblems] = useState<ProblemEntry[]>([{ concept: null, status: 'active' }]);
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const patientId = appointment?.patient?.id;

  useEffect(() => {
    if (!open || !patientId) {
      return;
    }

    const loadProblems = async () => {
      setLoadingList(true);
      try {
        const response = await chartApi.getProblems(patientId, token, tenantSlug);
        const payload = Array.isArray(response.data) ? response.data : [];

        if (payload.length === 0) {
          setProblems([{ concept: null, status: 'active' }]);
          return;
        }

        setProblems(
          payload.map((item: any) => ({
            concept: item.snomedConceptId || item.code
              ? {
                  conceptId: String(item.snomedConceptId || item.code),
                  term: item.snomedTerm || item.description || '',
                  preferredTerm: item.snomedTerm || item.description,
                  fullySpecifiedName: item.fullySpecifiedName,
                  moduleId: item.snomedModuleId,
                  definitionStatus: item.snomedDefinitionStatus,
                }
              : null,
            status: (item.status as 'active' | 'resolved') ?? 'active',
            onsetDate: item.onsetDate ? item.onsetDate.slice(0, 10) : '',
            resolvedDate: item.resolvedDate ? item.resolvedDate.slice(0, 10) : '',
            notes: item.notes || '',
          })),
        );
      } catch (error: any) {
        console.error('Failed to load problems', error);
        setProblems([{ concept: null, status: 'active' }]);
        const raw = error?.response?.data;
        const msg = raw?.message || raw?.error || raw || 'Unable to load problem list';
        showError('Problem List', typeof msg === 'string' ? msg : JSON.stringify(msg));
      } finally {
        setLoadingList(false);
      }
    };

    loadProblems();
  }, [open, patientId, tenantSlug, token, showError]);

  const emptyRow: ProblemEntry = useMemo(() => ({ concept: null, status: 'active' }), []);

  const handleSave = async () => {
    if (!patientId) {
      showError('Problem List', 'Missing patient information.');
      return;
    }

    try {
      setSaving(true);
      const formatted = problems
        .filter((entry) => entry.concept && entry.concept.conceptId)
        .map((entry) => ({
          conceptId: entry.concept!.conceptId,
          term: entry.concept!.preferredTerm || entry.concept!.term,
          status: entry.status,
          onsetDate: entry.onsetDate || null,
          resolvedDate: entry.resolvedDate || null,
          notes: entry.notes || null,
        }));

      if (formatted.length === 0 && problems.some(p => p.concept)) {
        throw new Error('Please ensure all entries have a valid SNOMED problem selected, or remove incomplete entries.');
      }

      await chartApi.replaceProblems(patientId, formatted, token, tenantSlug);
      showSuccess('Problem List Saved', 'SNOMED-coded problems updated successfully.');
      onSaved();
    } catch (e: any) {
      const raw = e?.response?.data;
      const msg = raw?.message || raw?.error || raw || e?.message || 'Failed to save problems';
      showError('Problem List', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
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
            {loadingList ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/60 bg-slate-50 py-10">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <p className="text-sm text-slate-600">Loading patient problems…</p>
              </div>
            ) : (
              <>
                {problems.map((entry, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 space-y-4">
                    <SnomedConceptPicker
                      value={entry.concept}
                      onChange={(concept) =>
                        setProblems((prev) =>
                          prev.map((item, itemIdx) =>
                            itemIdx === idx ? { ...item, concept } : item,
                          ),
                        )
                      }
                      token={token}
                      tenantSlug={tenantSlug}
                      label="SNOMED CT Problem"
                      placeholder="Search SNOMED CT (e.g., Type 2 diabetes mellitus)"
                      helperText="Use SNOMED CT for structured diagnoses"
                      required
                      context="condition"
                    />
                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Onset Date</label>
                        <input
                          className="rounded-xl border border-slate-300 p-2"
                          type="date"
                          value={entry.onsetDate || ''}
                          onChange={(event) =>
                            setProblems((prev) =>
                              prev.map((item, itemIdx) =>
                                itemIdx === idx ? { ...item, onsetDate: event.target.value || undefined } : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Resolved Date</label>
                        <input
                          className="rounded-xl border border-slate-300 p-2"
                          type="date"
                          value={entry.resolvedDate || ''}
                          onChange={(event) =>
                            setProblems((prev) =>
                              prev.map((item, itemIdx) =>
                                itemIdx === idx ? { ...item, resolvedDate: event.target.value || undefined } : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-600">Status</label>
                        <select
                          className="rounded-xl border border-slate-300 p-2"
                          value={entry.status}
                          onChange={(event) =>
                            setProblems((prev) =>
                              prev.map((item, itemIdx) =>
                                itemIdx === idx ? { ...item, status: event.target.value as 'active' | 'resolved' } : item,
                              ),
                            )
                          }
                        >
                          <option value="active">Active</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-xs font-semibold text-slate-600">Notes (optional)</label>
                      <textarea
                        className="min-h-[70px] rounded-xl border border-slate-300 p-2"
                        placeholder="Clinical context, course, or relevant details"
                        value={entry.notes || ''}
                        onChange={(event) =>
                          setProblems((prev) =>
                            prev.map((item, itemIdx) =>
                              itemIdx === idx ? { ...item, notes: event.target.value || undefined } : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() =>
                          setProblems((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                        }
                        className="text-xs text-rose-600 border border-rose-200 px-3 py-1 rounded-lg"
                      >
                        Remove Problem
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setProblems((prev) => [...prev, { ...emptyRow }])}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700"
                >
                  <Plus className="h-4 w-4" /> Add Problem
                </button>
              </>
            )}
            <div className="flex items-start gap-3 rounded-2xl bg-indigo-50/80 px-4 py-3 text-sm text-indigo-900">
              <AlertTriangle className="h-5 w-5 text-indigo-600" />
              <div>
                SNOMED concepts ensure clean problem lists, drive analytics, and power CDS. Select the closest
                concept, then optionally add notes for clinical nuance.
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || loadingList}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                'Save Problems'
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ProblemListModal;

