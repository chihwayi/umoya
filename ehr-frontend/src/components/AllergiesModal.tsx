import React, { useEffect, useState } from 'react';
import ModalPortal from './ModalPortal';
import { useNotification } from './GlobalNotification';
import { chartApi } from '../services/api';
import { ShieldAlert, X, Plus, Loader2, Info } from 'lucide-react';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';

interface AllergiesModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  appointment?: any; // Optional - can work with just patientId
  patientId?: string; // Allow direct patient ID for nurses
  tenantSlug: string;
  token: string;
}

type AllergyEntry = {
  allergen: SnomedConcept | null;
  reaction: SnomedConcept | null;
  severity: 'mild' | 'moderate' | 'severe';
};

const AllergiesModal: React.FC<AllergiesModalProps> = ({ open, onClose, onSaved, appointment, patientId, tenantSlug, token }) => {
  const { showError, showSuccess } = useNotification();
  const [allergies, setAllergies] = useState<AllergyEntry[]>([{ allergen: null, reaction: null, severity: 'mild' }]);
  const [saving, setSaving] = useState(false);
  const [loadingAllergies, setLoadingAllergies] = useState(false);

  // Get patient ID from either appointment or direct prop
  const actualPatientId = patientId || appointment?.patient?.id;

  useEffect(() => {
    if (!open || !actualPatientId) return;
    
    // Load allergies from structured table
    const loadAllergies = async () => {
      setLoadingAllergies(true);
      try {
        const response = await chartApi.getAllergies(actualPatientId, token, tenantSlug);
        const existingAllergies = response.data || [];
        
        if (existingAllergies.length > 0) {
          setAllergies(existingAllergies.map((a: any) => ({
            allergen: a.allergenSnomedCode || a.code || a.allergen
              ? {
                  conceptId: String(a.allergenSnomedCode || a.snomedConceptId || a.code || ''),
                  term: a.allergenSnomedTerm || a.allergen || '',
                  preferredTerm: a.allergenSnomedTerm || a.allergen || '',
                  moduleId: a.allergenSnomedModuleId,
                }
              : null,
            reaction: a.reactionSnomedCode
              ? {
                  conceptId: String(a.reactionSnomedCode),
                  term: a.reactionSnomedTerm || a.reaction || '',
                  preferredTerm: a.reactionSnomedTerm || a.reaction || '',
                }
              : null,
            severity: (a.severity as 'mild' | 'moderate' | 'severe') || 'mild'
          })));
        } else {
          setAllergies([{ allergen: null, reaction: null, severity: 'mild' }]);
        }
      } catch (e) {
        console.error('Failed to load allergies:', e);
        setAllergies([{ allergen: null, reaction: null, severity: 'mild' }]);
        const raw = (e as any)?.response?.data;
        const msg = raw?.message || raw?.error || raw || 'Unable to load allergies';
        showError('Allergies', typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      setLoadingAllergies(false);
    };

    loadAllergies();
  }, [open, actualPatientId, token, tenantSlug, showError]);

  const handleSave = async () => {
    if (!actualPatientId) {
      showError('Error', 'Patient ID is required');
      return;
    }
    try {
      setSaving(true);
      const valid = allergies
        .filter((entry) => entry.allergen && entry.allergen.conceptId)
        .map((entry) => ({
          allergenSnomedConceptId: entry.allergen!.conceptId,
          allergenTerm: entry.allergen!.preferredTerm || entry.allergen!.term,
          reactionSnomedConceptId: entry.reaction?.conceptId || null,
          reactionTerm: entry.reaction?.preferredTerm || entry.reaction?.term || null,
          severity: entry.severity,
        }));

      if (valid.length === 0 && allergies.some(a => a.allergen || a.reaction)) {
        throw new Error('Please ensure all entries have a valid SNOMED allergen selected, or remove incomplete entries.');
      }

      await chartApi.replaceAllergies(actualPatientId, valid, token, tenantSlug);
      showSuccess('Allergies Saved', 'Structured allergies updated successfully');
      onSaved();
      onClose();
    } catch (e: any) {
      const raw = e?.response?.data; const msg = raw?.message || raw?.error || raw || 'Failed to save allergies';
      showError('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
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
              <div className="p-2 bg-gradient-to-r from-rose-600 to-red-600 rounded-xl"><ShieldAlert className="w-5 h-5 text-white" /></div>
              <h3 className="text-lg font-bold text-slate-900">Allergies</h3>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-600" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loadingAllergies ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/60 bg-slate-50 py-10">
                <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
                <p className="text-sm text-slate-600">Loading allergy profile…</p>
              </div>
            ) : (
              <>
                {allergies.map((entry, idx) => (
                  <div key={idx} className="space-y-4 rounded-2xl border border-slate-200/60 bg-white/70 p-4">
                    <SnomedConceptPicker
                      value={entry.allergen}
                      onChange={(concept) =>
                        setAllergies((prev) =>
                          prev.map((item, itemIdx) =>
                            itemIdx === idx ? { ...item, allergen: concept } : item,
                          ),
                        )
                      }
                      token={token}
                      tenantSlug={tenantSlug}
                      label="Allergen"
                      placeholder="Search SNOMED CT (e.g., Penicillin)"
                      helperText="Use SNOMED CT agent/allergen concepts"
                      required
                      context="substance"
                    />
                    <SnomedConceptPicker
                      value={entry.reaction}
                      onChange={(concept) =>
                        setAllergies((prev) =>
                          prev.map((item, itemIdx) =>
                            itemIdx === idx ? { ...item, reaction: concept } : item,
                          ),
                        )
                      }
                      token={token}
                      tenantSlug={tenantSlug}
                      label="Reaction (optional)"
                      placeholder="Search reaction (e.g., Anaphylaxis)"
                      helperText="Optional: capture SNOMED-coded reaction outcome"
                      required={false}
                      context="condition"
                    />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-600">Severity</label>
                      <select
                        className="rounded-xl border border-slate-300 p-2 text-sm"
                        value={entry.severity}
                        onChange={(event) =>
                          setAllergies((prev) =>
                            prev.map((item, itemIdx) =>
                              itemIdx === idx ? { ...item, severity: event.target.value as 'mild' | 'moderate' | 'severe' } : item,
                            ),
                          )
                        }
                      >
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                      </select>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() =>
                          setAllergies((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                        }
                        className="text-xs text-rose-600 border border-rose-200 px-3 py-1 rounded-lg"
                      >
                        Remove Allergy
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setAllergies((prev) => [...prev, { allergen: null, reaction: null, severity: 'mild' }])}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700"
                >
                  <Plus className="h-4 w-4" /> Add Allergy
                </button>
              </>
            )}
            <div className="flex items-start gap-3 rounded-2xl bg-rose-50/80 px-4 py-3 text-sm text-rose-900">
              <Info className="h-5 w-5 text-rose-500" />
              <div>
                Coding allergens with SNOMED improves interaction checking and keeps the allergy list interoperable.
                Reactions are optional but useful for CDS and clinical summaries.
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || loadingAllergies}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save Allergies'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default AllergiesModal;


