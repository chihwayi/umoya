import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Star, X } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { prescriptionTemplateApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { PrescriptionTemplate } from './PrescriptionTemplateLibrary';

const TEMPLATE_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'antibiotic', label: 'Antibiotic' },
  { value: 'pain_management', label: 'Pain Management' },
  { value: 'hypertension', label: 'Hypertension' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'respiratory', label: 'Respiratory' },
  { value: 'gastrointestinal', label: 'Gastrointestinal' },
  { value: 'cardiac', label: 'Cardiac' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'pediatric', label: 'Pediatric' },
  { value: 'other', label: 'Other' },
];

const ROUTES = ['oral', 'injection', 'topical', 'inhalation', 'intravenous', 'sublingual', 'rectal', 'other'];

interface PrescriptionTemplateEditorProps {
  open: boolean;
  token: string;
  tenantSlug: string;
  onClose: () => void;
  onSaved: (template?: PrescriptionTemplate) => void;
  template?: PrescriptionTemplate | null;
}

interface FormState {
  name: string;
  category: string;
  medicationName: string;
  genericName: string;
  dosage: string;
  dosageUnit: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  indications: string;
  contraindications: string;
  sideEffects: string;
  specialty: string;
  isDefault: boolean;
  isActive: boolean;
}

const defaultFormState: FormState = {
  name: '',
  category: 'other',
  medicationName: '',
  genericName: '',
  dosage: '',
  dosageUnit: '',
  frequency: '',
  route: 'oral',
  duration: '',
  instructions: '',
  indications: '',
  contraindications: '',
  sideEffects: '',
  specialty: '',
  isDefault: false,
  isActive: true,
};

const PrescriptionTemplateEditor: React.FC<PrescriptionTemplateEditorProps> = ({
  open,
  token,
  tenantSlug,
  onClose,
  onSaved,
  template,
}) => {
  const { showError, showSuccess } = useNotification();
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template && open) {
      setForm({
        name: template.name,
        category: template.category,
        medicationName: template.medicationName,
        genericName: template.genericName || '',
        dosage: template.dosage,
        dosageUnit: template.dosageUnit || '',
        frequency: template.frequency,
        route: template.route || 'oral',
        duration: template.duration || '',
        instructions: template.instructions || '',
        indications: template.indications || '',
        contraindications: template.contraindications || '',
        sideEffects: template.sideEffects || '',
        specialty: template.specialty || '',
        isDefault: Boolean(template.isDefault),
        isActive: template.isActive !== false,
      });
    } else if (open) {
      setForm(defaultFormState);
    }
  }, [template, open]);

  const canSave = useMemo(() => {
    return (
      form.name.trim().length > 2 &&
      form.medicationName.trim().length > 2 &&
      form.dosage.trim().length > 0 &&
      form.frequency.trim().length > 0
    );
  }, [form]);

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!canSave) return;
    try {
      setSaving(true);
      let response;
      if (template?.id) {
        response = await prescriptionTemplateApi.updateTemplate(template.id, form, token, tenantSlug);
        showSuccess('Template updated', `${form.name} updated successfully`);
      } else {
        response = await prescriptionTemplateApi.createTemplate(form, token, tenantSlug);
        showSuccess('Template created', `${form.name} is now available`);
      }
      onSaved(response?.data);
    } catch (error: any) {
      console.error('Failed to save template', error);
      const message =
        error?.response?.data?.message || error?.message || 'Failed to save template. Please try again.';
      showError('Templates', message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100002] bg-slate-900/80 backdrop-blur flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col border border-slate-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {template?.id ? 'Update Template' : 'Create Template'}
              </p>
              <h2 className="text-2xl font-semibold text-slate-900">
                {template?.id ? `Edit ${template.name}` : 'New Prescription Template'}
              </h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50">
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Template Name
                  </label>
                  <input
                    className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-pink-200"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="e.g., Pediatric Amoxicillin (Otitis Media)"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Category
                    </label>
                    <select
                      className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-2xl text-sm"
                      value={form.category}
                      onChange={(e) => handleChange('category', e.target.value)}
                    >
                      {TEMPLATE_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Specialty (optional)
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-2xl"
                      value={form.specialty}
                      onChange={(e) => handleChange('specialty', e.target.value)}
                      placeholder="e.g., Pediatrics, Cardiology"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Medication Name
                  </label>
                  <input
                    className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-2xl"
                    value={form.medicationName}
                    onChange={(e) => handleChange('medicationName', e.target.value)}
                    placeholder="Medication as prescribed"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Use brand or combination name as clinicians will search for it
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Generic Name
                  </label>
                  <input
                    className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-2xl"
                    value={form.genericName}
                    onChange={(e) => handleChange('genericName', e.target.value)}
                    placeholder="e.g., amoxicillin"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Dosage / Strength
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-2xl"
                      value={form.dosage}
                      onChange={(e) => handleChange('dosage', e.target.value)}
                      placeholder="e.g., 500 mg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Dosage Unit
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-2xl"
                      value={form.dosageUnit}
                      onChange={(e) => handleChange('dosageUnit', e.target.value)}
                      placeholder="mg, ml, drops, etc."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Frequency
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-2xl"
                      value={form.frequency}
                      onChange={(e) => handleChange('frequency', e.target.value)}
                      placeholder="e.g., Twice daily"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Duration
                    </label>
                    <input
                      className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-2xl"
                      value={form.duration}
                      onChange={(e) => handleChange('duration', e.target.value)}
                      placeholder="e.g., 7 days"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Route
                  </label>
                  <select
                    className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-2xl text-sm"
                    value={form.route}
                    onChange={(e) => handleChange('route', e.target.value)}
                  >
                    {ROUTES.map((route) => (
                      <option key={route} value={route}>
                        {route.charAt(0).toUpperCase() + route.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Detailed Instructions
                  </label>
                  <textarea
                    className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-2xl min-h-[110px]"
                    value={form.instructions}
                    onChange={(e) => handleChange('instructions', e.target.value)}
                    placeholder="Provide specific administration instructions, timing, refills, etc."
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Indications
                  </label>
                  <textarea
                    className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-2xl min-h-[80px]"
                    value={form.indications}
                    onChange={(e) => handleChange('indications', e.target.value)}
                    placeholder="Which diagnoses/conditions this template covers"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide text-orange-600">
                    Contraindications
                  </label>
                  <textarea
                    className="w-full mt-1 px-4 py-2.5 border border-orange-200 rounded-2xl min-h-[80px] bg-orange-50"
                    value={form.contraindications}
                    onChange={(e) => handleChange('contraindications', e.target.value)}
                    placeholder="List clinical red flags to prevent unsafe prescribing"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Common Side Effects
                  </label>
                  <textarea
                    className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-2xl min-h-[80px]"
                    value={form.sideEffects}
                    onChange={(e) => handleChange('sideEffects', e.target.value)}
                    placeholder="e.g., Nausea, dizziness, GI upset..."
                  />
                </div>

                <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                      checked={form.isDefault}
                      onChange={(e) => handleChange('isDefault', e.target.checked)}
                    />
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-pink-500" />
                      Mark as organization default
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                      checked={form.isActive}
                      onChange={(e) => handleChange('isActive', e.target.checked)}
                    />
                    Keep template active
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-white">
            <p className="text-xs text-slate-500">
              Templates pre-fill the prescribing form. Clinicians can still personalize each order
            </p>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSave || saving}
                className="px-5 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-pink-600 to-fuchsia-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {template?.id ? 'Update Template' : 'Save Template'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default PrescriptionTemplateEditor;

