import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Pill, X, Save, Calendar, Clock, User, Plus, AlertTriangle, Search, Loader, CreditCard, Lock } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useNotification } from './GlobalNotification';
import { ehrApi, chartApi } from '../services/api';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface Appointment {
  id: string;
  patient: { id: string; firstName: string; lastName: string; patientNumber: string };
  appointmentDate: string;
  appointmentType: string;
  notes: string;
}

interface PrescriptionsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  appointment: Appointment;
  tenantSlug: string;
  token: string;
  paymentStatus?: string;
  financeTransactionId?: string | null;
  feeAmount?: number | null;
}

interface Allergy {
  id?: string;
  allergen: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe';
}

interface Drug {
  id: string;
  genericName: string;
  brandNames: string[];
  drugClass?: string;
  description?: string;
}

interface DrugInteraction {
  id: string;
  drug1: Drug;
  drug2: Drug;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: string;
  mechanism?: string;
  management?: string;
}

// Fuzzy matching utility for medication names
const fuzzyMatch = (medication: string, allergen: string): boolean => {
  if (!medication || !allergen) return false;
  
  const medLower = medication.toLowerCase().trim();
  const allergenLower = allergen.toLowerCase().trim();
  
  // Exact match
  if (medLower === allergenLower) return true;
  
  // Contains match
  if (medLower.includes(allergenLower) || allergenLower.includes(medLower)) return true;
  
  // Word boundary matching (e.g., "penicillin" matches "penicillin G")
  const medWords = medLower.split(/\s+/);
  const allergenWords = allergenLower.split(/\s+/);
  
  // If any significant word matches
  for (const medWord of medWords) {
    if (medWord.length > 3 && allergenWords.some(aw => aw.includes(medWord) || medWord.includes(aw))) {
      return true;
    }
  }
  
  return false;
};

const PrescriptionsModal: React.FC<PrescriptionsModalProps> = ({ open, onClose, onSaved, appointment, tenantSlug, token }) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [drugInteractions, setDrugInteractions] = useState<DrugInteraction[]>([]);
  const [searchingDrugs, setSearchingDrugs] = useState<Record<number, boolean>>({});
  const [drugSuggestions, setDrugSuggestions] = useState<Record<number, Drug[]>>({});
  const [showSuggestions, setShowSuggestions] = useState<Record<number, boolean>>({});
  const searchTimeouts = useRef<Record<number, NodeJS.Timeout>>({});
  
  type Rx = { 
    name: string; 
    dosage: string; 
    frequency: string; 
    duration: string; 
    instructions: string;
    drugId?: string;
    foundDrug?: Drug;
  };
  const [items, setItems] = useState<Rx[]>([{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
  const [loadingFood, setLoadingFood] = useState(false);
  const [foodInteractions, setFoodInteractions] = useState<any | null>(null);

  const awaitingPayment = appointment?.paymentStatus === 'awaiting_payment';
  const financeReference = appointment?.financeTransactionId || null;
  const feeEstimate =
    appointment?.feeAmount !== undefined && appointment?.feeAmount !== null
      ? Number(appointment.feeAmount)
      : null;

  // Load allergies from structured table
  useEffect(() => {
    if (!open || !appointment.patient.id) return;
    
    const loadAllergies = async () => {
      try {
        const response = await chartApi.getAllergies(appointment.patient.id, token, tenantSlug);
        setAllergies(response.data || []);
      } catch (error) {
        console.error('Failed to load allergies:', error);
        setAllergies([]);
      }
    };
    
    loadAllergies();
    setItems([{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
  }, [open, appointment.patient.id, token, tenantSlug]);

  // Drug search with debouncing
  const searchDrug = useCallback(async (searchTerm: string, itemIndex: number) => {
    if (!searchTerm || searchTerm.length < 2) {
      setDrugSuggestions(prev => ({ ...prev, [itemIndex]: [] }));
      setShowSuggestions(prev => ({ ...prev, [itemIndex]: false }));
      return;
    }

    setSearchingDrugs(prev => ({ ...prev, [itemIndex]: true }));
    try {
      const response = await ehrApi.searchDrugs(token, tenantSlug, searchTerm);
      const drugs = response.data || [];
      setDrugSuggestions(prev => ({ ...prev, [itemIndex]: drugs }));
      setShowSuggestions(prev => ({ ...prev, [itemIndex]: true }));
    } catch (error) {
      console.error('Failed to search drugs:', error);
      setDrugSuggestions(prev => ({ ...prev, [itemIndex]: [] }));
    } finally {
      setSearchingDrugs(prev => ({ ...prev, [itemIndex]: false }));
    }
  }, [token, tenantSlug]);

  // Handle drug selection
  const selectDrug = (itemIndex: number, drug: Drug) => {
    setItems(prev => prev.map((it, i) => 
      i === itemIndex 
        ? { ...it, name: drug.genericName, drugId: drug.id, foundDrug: drug }
        : it
    ));
    setShowSuggestions(prev => ({ ...prev, [itemIndex]: false }));
    checkInteractions();
  };

  // Check for drug-drug interactions
  const checkInteractions = useCallback(async () => {
    const drugIds = items
      .map(rx => rx.drugId)
      .filter((id): id is string => !!id);

    if (drugIds.length < 2) {
      setDrugInteractions([]);
      return;
    }

    try {
      const response = await ehrApi.checkDrugInteractions(drugIds, token, tenantSlug);
      setDrugInteractions(response.data || []);
    } catch (error) {
      console.error('Failed to check interactions:', error);
      setDrugInteractions([]);
    }
  }, [items, token, tenantSlug]);

  const runFoodInteractions = useCallback(async () => {
    try {
      setLoadingFood(true);
      // Build medications list for CDSS (name/genericName, class if available)
      const meds = items
        .filter(rx => rx.name)
        .map(rx => ({
          name: rx.name,
          genericName: rx.foundDrug?.genericName || rx.name,
          drugClass: rx.foundDrug?.drugClass
        }));
      const resp = await ehrApi.checkFoodInteractions(meds, token, tenantSlug);
      setFoodInteractions(resp.data || resp);
    } catch (err) {
      console.error('Failed to check food interactions:', err);
      setFoodInteractions({ interactions: [], summary: { major: 0, moderate: 0 }, recommendations: ['Failed to check interactions'] });
    } finally {
      setLoadingFood(false);
    }
  }, [items, token, tenantSlug]);

  // Real-time allergy checking for each medication
  const allergyWarnings = useMemo(() => {
    const warnings: Record<number, Allergy | null> = {};
    
    items.forEach((rx, idx) => {
      if (!rx.name) {
        warnings[idx] = null;
        return;
      }
      
      // Check against all allergies (use foundDrug if available, otherwise use name)
      const searchName = rx.foundDrug?.genericName || rx.name;
      const conflict = allergies.find(allergy => 
        fuzzyMatch(searchName, allergy.allergen) ||
        (rx.foundDrug?.brandNames || []).some(brand => fuzzyMatch(brand, allergy.allergen))
      );
      
      warnings[idx] = conflict || null;
    });
    
    return warnings;
  }, [items, allergies]);

  // Check interactions when items change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkInteractions();
    }, 500); // Debounce

    return () => clearTimeout(timeoutId);
  }, [items.map(rx => rx.drugId).join(',')]);

  const handleSave = async () => {
    try {
      setLoading(true);
      // Create as an order (medication) to match tenant schema reliably
      const userData = localStorage.getItem('ehr_user');
      const currentUser = userData ? JSON.parse(userData) : null;
      if (!currentUser) throw new Error('User not found');

      const valid = items.filter(i => i.name && i.dosage && i.frequency);
      
      // Enhanced allergy check using structured allergies
      const conflicts: Array<{ medication: string; allergy: Allergy }> = [];
      valid.forEach(rx => {
        const conflict = allergies.find(a => fuzzyMatch(rx.name, a.allergen));
        if (conflict) {
          conflicts.push({ medication: rx.name, allergy: conflict });
        }
      });
      
      // Block save if severe allergy conflicts found
      const severeConflicts = conflicts.filter(c => c.allergy.severity === 'severe');
      if (severeConflicts.length > 0) {
        const conflictMessages = severeConflicts.map(c => 
          `${c.medication} conflicts with ${c.allergy.allergen} allergy (${c.allergy.severity}${c.allergy.reaction ? ` - ${c.allergy.reaction}` : ''})`
        ).join(', ');
        throw { response: { data: { message: `⚠️ CRITICAL: Severe allergy conflict detected! ${conflictMessages}. Please select an alternative medication.` } } };
      }
      
      // Warn but allow for moderate/mild (doctor can override)
      if (conflicts.length > 0) {
        const conflictMessages = conflicts.map(c => 
          `${c.medication} vs ${c.allergy.allergen} (${c.allergy.severity || 'unknown'}${c.allergy.reaction ? ` - ${c.allergy.reaction}` : ''})`
        ).join(', ');
        showError('Allergy Warning', `Potential allergy conflicts detected: ${conflictMessages}. Please review before proceeding.`);
        // Allow override but show warning
      }
      if (valid.length === 0) throw new Error('Enter at least one prescription with name, dosage, and frequency');
      for (const rx of valid) {
        const created = await ehrApi.createOrder({
          patientId: appointment.patient.id,
          appointmentId: appointment.id,
          doctorId: currentUser.id,
          orderType: 'medication',
          orderName: rx.name,
          description: `Prescription for ${rx.name}`,
          instructions: rx.instructions || `Dosage: ${rx.dosage}, Frequency: ${rx.frequency}, Duration: ${rx.duration}`,
          priority: 'normal',
          dosage: rx.dosage,
          frequency: rx.frequency,
          duration: rx.duration
        }, token, tenantSlug);
        const orderId = created?.data?.order?.id;
        if (orderId) { await ehrApi.authorizeOrder(orderId, token, tenantSlug); }
      }

      // Merge into appointment notes JSON for historical context
      let payload: any = {};
      try { payload = appointment.notes ? JSON.parse(appointment.notes) : {}; } catch { payload = {}; }
      payload.prescriptions = payload.prescriptions || [];
      valid.forEach(rx => {
        payload.prescriptions.push({ ...rx, at: new Date().toISOString() });
      });
      await ehrApi.updateAppointment(appointment.id, { notes: JSON.stringify(payload) }, token, tenantSlug);

      showSuccess('Saved', 'Prescription created');
      onSaved();
    } catch (error: any) {
      const raw = error?.response?.data;
      const msg = (raw && (raw.message || raw.error || raw.errors)) ? (raw.message || raw.error || raw.errors) : raw;
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg || 'Failed to create prescription');
      showError('Error', text);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl"><Pill className="w-5 h-5 text-white" /></div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Prescribe Medication</h3>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1"><User className="w-3 h-3" />{appointment.patient.firstName} {appointment.patient.lastName}</div>
                  <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateToDDMMYYYY(appointment.appointmentDate)}</div>
                  <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(appointment.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {awaitingPayment ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium">
                  <Lock className="w-4 h-4" />
                  Awaiting payment confirmation
                </div>
              ) : (
                <>
                  <button
                    onClick={() =>
                      setItems((prev) => [
                        ...prev,
                        { name: '', dosage: '', frequency: '', duration: '', instructions: '' },
                      ])
                    }
                    className="p-2 rounded-lg hover:bg-pink-50 text-pink-600 border border-pink-200"
                    title="Add medication"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  {items.some((rx) => rx.name && rx.name.trim().length > 0) && (
                    <button
                      onClick={runFoodInteractions}
                      disabled={loadingFood}
                      className="px-3 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      title="Check drug-food interactions"
                    >
                      {loadingFood ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4" />
                          Food Interactions
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {awaitingPayment ? (
              <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  <h4 className="text-sm font-semibold">Finance confirmation required</h4>
                </div>
                <p className="text-sm">
                  Prescriptions for this encounter are locked until Accounts clears the payment. Please refresh once the
                  status changes to continue charting.
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-amber-700">
                  {feeEstimate !== null && !Number.isNaN(feeEstimate) && (
                    <span className="font-medium">Fee amount: ${feeEstimate.toFixed(2)}</span>
                  )}
                  {financeReference && (
                    <span>
                      Finance reference: <span className="font-mono">{financeReference}</span>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <>
            {/* Display patient allergies at top */}
            {allergies.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h4 className="font-semibold text-amber-900">Patient Allergies</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allergies.map((allergy, idx) => (
                    <span 
                      key={idx} 
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        allergy.severity === 'severe' 
                          ? 'bg-red-100 text-red-800 border border-red-300' 
                          : allergy.severity === 'moderate'
                          ? 'bg-orange-100 text-orange-800 border border-orange-300'
                          : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                      }`}
                    >
                      {allergy.allergen}
                      {allergy.severity && ` (${allergy.severity})`}
                      {allergy.reaction && ` - ${allergy.reaction}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Drug-Drug Interactions Alert (Overall) */}
            {drugInteractions.length > 0 && (
              <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <h4 className="font-semibold text-orange-900">Drug Interactions Detected</h4>
                </div>
                <div className="space-y-2">
                  {drugInteractions.map((interaction, idx) => {
                    const severityColors = {
                      contraindicated: 'bg-red-100 text-red-800 border-red-300',
                      major: 'bg-orange-100 text-orange-800 border-orange-300',
                      moderate: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                      minor: 'bg-blue-100 text-blue-800 border-blue-300'
                    };
                    return (
                      <div key={idx} className={`p-3 rounded-lg border ${severityColors[interaction.severity]}`}>
                        <p className="font-semibold text-sm">
                          {interaction.drug1.genericName} + {interaction.drug2.genericName}
                          <span className="ml-2 text-xs">({interaction.severity.toUpperCase()})</span>
                        </p>
                        <p className="text-xs mt-1">{interaction.description}</p>
                        {interaction.management && (
                          <p className="text-xs mt-2 italic">Management: {interaction.management}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Drug–Food Interactions */}
            {foodInteractions && (
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">Drug–Food Interactions</h4>
                  </div>
                  <div className="text-xs text-slate-600">
                    Major: <span className="font-semibold text-red-600">{foodInteractions.summary?.major || 0}</span>
                    <span className="mx-2">|</span>
                    Moderate: <span className="font-semibold text-orange-600">{foodInteractions.summary?.moderate || 0}</span>
                  </div>
                </div>
                {foodInteractions.interactions?.length > 0 ? (
                  <div className="space-y-2">
                    {foodInteractions.interactions.map((fx: any, idx: number) => (
                      <div key={idx} className={`p-3 rounded-lg border ${fx.severity === 'major' ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-300'}`}>
                        <p className={`font-semibold text-sm ${fx.severity === 'major' ? 'text-red-900' : 'text-orange-900'}`}>
                          {fx.medication} × {fx.food} <span className="ml-2 text-xs">({(fx.severity || 'moderate').toUpperCase()})</span>
                        </p>
                        {fx.mechanism && (
                          <p className="text-xs mt-1 text-slate-700">{fx.mechanism}</p>
                        )}
                        {fx.recommendation && (
                          <p className={`text-xs mt-2 italic ${fx.severity === 'major' ? 'text-red-700' : 'text-orange-700'}`}>Recommendation: {fx.recommendation}</p>
                        )}
                        {fx.examples && (
                          <p className="text-xs mt-1 text-slate-600">Examples: {Array.isArray(fx.examples) ? fx.examples.join(', ') : fx.examples}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No significant drug–food interactions detected.</p>
                )}
                {foodInteractions.recommendations && foodInteractions.recommendations.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-blue-200">
                    <h5 className="text-xs font-semibold text-slate-700 mb-1">General Recommendations</h5>
                    <ul className="text-xs text-slate-700 list-disc pl-5 space-y-1">
                      {foodInteractions.recommendations.slice(0,5).map((r: string, idx: number) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {items.map((rx, idx) => {
              const warning = allergyWarnings[idx];
              const isSevere = warning?.severity === 'severe';
              
              return (
                <div 
                  key={idx} 
                  className={`border rounded-xl p-4 space-y-3 ${
                    isSevere 
                      ? 'border-red-300 bg-red-50' 
                      : warning 
                      ? 'border-orange-300 bg-orange-50' 
                      : 'border-slate-200'
                  }`}
                >
                  <div className="relative">
                    <div className="relative">
                      <input 
                        className={`w-full border rounded-xl p-3 pr-10 ${
                          isSevere 
                            ? 'border-red-400 bg-white' 
                            : warning 
                            ? 'border-orange-400 bg-white' 
                            : 'border-slate-300'
                        }`} 
                        placeholder="Start typing medication name (e.g., warfarin, aspirin)..." 
                        value={rx.name} 
                        onChange={(e) => {
                          const value = e.target.value;
                          setItems(prev => prev.map((it, i) => i===idx ? { ...it, name: value, drugId: undefined, foundDrug: undefined } : it));
                          // Clear previous timeout
                          if (searchTimeouts.current[idx]) {
                            clearTimeout(searchTimeouts.current[idx]);
                          }
                          // Debounced search
                          searchTimeouts.current[idx] = setTimeout(() => {
                            searchDrug(value, idx);
                          }, 300);
                        }}
                        onFocus={() => {
                          if (rx.name.length >= 2) {
                            searchDrug(rx.name, idx);
                          }
                        }}
                        onBlur={() => {
                          // Delay to allow click on suggestion
                          setTimeout(() => setShowSuggestions(prev => ({ ...prev, [idx]: false })), 200);
                        }}
                      />
                      {searchingDrugs[idx] && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <Loader className="w-4 h-4 text-slate-400 animate-spin" />
                        </div>
                      )}
                      {!searchingDrugs[idx] && rx.name && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <Search className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                    </div>
                    
                    {/* Drug Suggestions Dropdown */}
                    {showSuggestions[idx] && drugSuggestions[idx]?.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {drugSuggestions[idx].map((drug) => (
                          <button
                            key={drug.id}
                            type="button"
                            onClick={() => selectDrug(idx, drug)}
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                          >
                            <div className="font-semibold text-slate-900">{drug.genericName}</div>
                            {drug.brandNames?.length > 0 && (
                              <div className="text-xs text-slate-600 mt-1">Brand: {drug.brandNames.join(', ')}</div>
                            )}
                            {drug.drugClass && (
                              <div className="text-xs text-slate-500 mt-1">Class: {drug.drugClass}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Drug Info Display */}
                    {rx.foundDrug && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-blue-900">{rx.foundDrug.genericName}</p>
                            {rx.foundDrug.brandNames?.length > 0 && (
                              <p className="text-xs text-blue-700 mt-1">Brand names: {rx.foundDrug.brandNames.join(', ')}</p>
                            )}
                            {rx.foundDrug.drugClass && (
                              <p className="text-xs text-blue-600 mt-1">Class: {rx.foundDrug.drugClass}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setItems(prev => prev.map((it, i) => i===idx ? { ...it, name: '', drugId: undefined, foundDrug: undefined } : it))}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Drug-Drug Interaction Warnings */}
                    {drugInteractions
                      .filter(i => 
                        (i.drug1.id === rx.drugId || i.drug2.id === rx.drugId) &&
                        (i.severity === 'major' || i.severity === 'contraindicated')
                      )
                      .map((interaction, iidx) => {
                        const otherDrug = interaction.drug1.id === rx.drugId ? interaction.drug2 : interaction.drug1;
                        const otherRx = items.find(r => r.drugId === otherDrug.id);
                        return (
                          <div key={iidx} className={`mt-2 p-3 rounded-lg border ${
                            interaction.severity === 'contraindicated'
                              ? 'bg-red-100 border-red-400'
                              : 'bg-orange-100 border-orange-400'
                          }`}>
                            <p className={`font-semibold text-sm ${
                              interaction.severity === 'contraindicated' ? 'text-red-900' : 'text-orange-900'
                            }`}>
                              ⚠️ {interaction.severity === 'contraindicated' ? 'CONTRAINDICATED' : 'MAJOR INTERACTION'}: {rx.foundDrug?.genericName} + {otherRx?.foundDrug?.genericName || otherDrug.genericName}
                            </p>
                            <p className={`text-xs mt-1 ${
                              interaction.severity === 'contraindicated' ? 'text-red-800' : 'text-orange-800'
                            }`}>
                              {interaction.description}
                            </p>
                            {interaction.management && (
                              <p className={`text-xs mt-2 italic ${
                                interaction.severity === 'contraindicated' ? 'text-red-700' : 'text-orange-700'
                              }`}>
                                Management: {interaction.management}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    {warning && (
                      <div className={`mt-2 p-3 rounded-lg flex items-start gap-2 ${
                        isSevere 
                          ? 'bg-red-100 border border-red-300' 
                          : 'bg-orange-100 border border-orange-300'
                      }`}>
                        <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                          isSevere ? 'text-red-600' : 'text-orange-600'
                        }`} />
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${
                            isSevere ? 'text-red-900' : 'text-orange-900'
                          }`}>
                            {isSevere ? '⚠️ CRITICAL ALLERGY CONFLICT' : '⚠️ Potential Allergy Conflict'}
                          </p>
                          <p className={`text-xs mt-1 ${
                            isSevere ? 'text-red-700' : 'text-orange-700'
                          }`}>
                            This medication may conflict with patient's allergy to <strong>{warning.allergen}</strong>
                            {warning.severity && ` (${warning.severity})`}
                            {warning.reaction && `. Reaction: ${warning.reaction}`}
                          </p>
                          {isSevere && (
                            <p className="text-xs mt-1 font-semibold text-red-800">
                              This prescription will be blocked. Please select an alternative medication.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input className="border border-slate-300 rounded-xl p-3" placeholder="Dosage/Strength" value={rx.dosage} onChange={(e) => setItems(prev => prev.map((it, i) => i===idx ? { ...it, dosage: e.target.value } : it))} />
                    <input className="border border-slate-300 rounded-xl p-3" placeholder="Frequency" value={rx.frequency} onChange={(e) => setItems(prev => prev.map((it, i) => i===idx ? { ...it, frequency: e.target.value } : it))} />
                    <input className="border border-slate-300 rounded-xl p-3" placeholder="Duration" value={rx.duration} onChange={(e) => setItems(prev => prev.map((it, i) => i===idx ? { ...it, duration: e.target.value } : it))} />
                  </div>
                  <textarea className="w-full border border-slate-300 rounded-xl p-3" placeholder="Instructions" value={rx.instructions} onChange={(e) => setItems(prev => prev.map((it, i) => i===idx ? { ...it, instructions: e.target.value } : it))} />
                  <div className="flex justify-end">
                    {items.length > 1 && (
                      <button onClick={() => setItems(prev => prev.filter((_, i) => i!==idx))} className="text-red-600 text-sm px-3 py-1 border border-red-200 rounded-lg">Remove</button>
                    )}
                  </div>
                </div>
              );
            })}
              </>
            )}
          </div>
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300">
              {awaitingPayment ? 'Close' : 'Cancel'}
            </button>
            {!awaitingPayment && (
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Prescription'}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default PrescriptionsModal;


