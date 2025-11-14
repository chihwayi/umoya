import React, { useState, useEffect } from 'react';
import { TestTube, X, Search, Plus, Trash2, Calendar, Clock, User, Package } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useNotification } from './GlobalNotification';
import { ehrApi } from '../services/api';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';

interface Appointment {
  id: string;
  patient: { id: string; firstName: string; lastName: string; patientNumber: string };
  appointmentDate: string;
  notes: string;
}

interface LabTest {
  id: string;
  testName: string;
  testCode: string;
  loincCode?: string;
  category: string;
  specimenType: string;
  unit?: string;
  referenceRangeGeneral?: string;
  referenceRangeMale?: string;
  referenceRangeFemale?: string;
}

interface LabOrderSet {
  id: string;
  setName: string;
  setCode: string;
  description?: string;
  testIds: string[];
}

interface SelectedTest {
  testId: string;
  testName: string;
  testCode: string;
  category: string;
  specimenType: string;
  instructions?: string;
  loincCode?: string;
  cost?: number;
}

interface LabOrdersModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  appointment: Appointment;
  tenantSlug: string;
  token: string;
}

const LabOrdersModal: React.FC<LabOrdersModalProps> = ({ open, onClose, onSaved, appointment, tenantSlug, token }) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [orderSets, setOrderSets] = useState<LabOrderSet[]>([]);
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showTestSearch, setShowTestSearch] = useState(false);
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [clinicalInfo, setClinicalInfo] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [loadingTests, setLoadingTests] = useState(false);
  const [orderConcept, setOrderConcept] = useState<SnomedConcept | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedTests([]);
      setSearchTerm('');
      setSelectedCategory('all');
      setShowTestSearch(false);
      setPriority('routine');
      setClinicalInfo('');
      setSpecialInstructions('');
      setOrderConcept(null);
      return;
    }
    loadTests();
    loadOrderSets();
  }, [open]);

  const loadTests = async () => {
    try {
      setLoadingTests(true);
      const response = await ehrApi.getLabTests(selectedCategory === 'all' ? undefined : selectedCategory, undefined, token, tenantSlug);
      setTests(response.data || []);
    } catch (error) {
      console.error('Failed to load tests:', error);
      setTests([]);
    } finally {
      setLoadingTests(false);
    }
  };

  const loadOrderSets = async () => {
    try {
      const response = await ehrApi.getLabOrderSets(undefined, token, tenantSlug);
      setOrderSets(response.data || []);
    } catch (error) {
      console.error('Failed to load order sets:', error);
      setOrderSets([]);
    }
  };

  const searchTests = async () => {
    try {
      setLoadingTests(true);
      const response = await ehrApi.getLabTests(selectedCategory === 'all' ? undefined : selectedCategory, searchTerm, token, tenantSlug);
      setTests(response.data || []);
    } catch (error) {
      console.error('Failed to search tests:', error);
    } finally {
      setLoadingTests(false);
    }
  };

  useEffect(() => {
    if (searchTerm) {
      const debounce = setTimeout(() => {
        searchTests();
      }, 300);
      return () => clearTimeout(debounce);
    } else {
      loadTests();
    }
  }, [searchTerm, selectedCategory]);

  const handleAddOrderSet = async (orderSet: LabOrderSet) => {
    try {
      const response = await ehrApi.getLabOrderSetById(orderSet.id, token, tenantSlug);
      const { tests: setTests } = response.data;
      
      const newTests: SelectedTest[] = setTests.map((test: LabTest) => ({
        testId: test.id,
        testName: test.testName,
        testCode: test.testCode || '',
        category: test.category,
        specimenType: test.specimenType,
        instructions: `Part of ${orderSet.setName} panel`,
        loincCode: test.loincCode,
        cost: (test as any).cost,
      }));

      // Merge with existing, avoiding duplicates
      setSelectedTests(prev => {
        const existing = new Set(prev.map(t => t.testId));
        const toAdd = newTests.filter(t => !existing.has(t.testId));
        return [...prev, ...toAdd];
      });

      showSuccess('Added', `${orderSet.setName} panel added`);
    } catch (error) {
      showError('Error', 'Failed to load order set');
    }
  };

  const handleAddTest = (test: LabTest) => {
    const alreadyAdded = selectedTests.some(t => t.testId === test.id);
    if (alreadyAdded) {
      showError('Already Added', 'This test is already in the order');
      return;
    }

    setSelectedTests(prev => [...prev, {
      testId: test.id,
      testName: test.testName,
      testCode: test.testCode || '',
      category: test.category,
      specimenType: test.specimenType,
      loincCode: test.loincCode,
      cost: (test as any).cost,
    }]);
    setShowTestSearch(false);
    setSearchTerm('');
  };

  const handleRemoveTest = (testId: string) => {
    setSelectedTests(prev => prev.filter(t => t.testId !== testId));
  };

  const handleSave = async () => {
    if (selectedTests.length === 0) {
      showError('No Tests', 'Please add at least one test to the order');
      return;
    }

    if (!orderConcept) {
      showError('SNOMED Required', 'Please select the SNOMED CT concept for this lab order.');
      return;
    }

    try {
      setLoading(true);
      const userData = localStorage.getItem('ehr_user');
      const currentUser = userData ? JSON.parse(userData) : null;
      if (!currentUser) throw new Error('User not found');

      const totalCost = selectedTests.reduce((sum, test) => sum + (test.cost || 0), 0);
      const representativeTest = selectedTests[0];

      const labOrderData = {
        patientId: appointment.patient.id,
        medicalRecordId: null,
        tests: selectedTests.map(t => ({
          testCode: t.testCode,
          testName: t.testName,
          category: t.category,
          specimenType: t.specimenType,
          instructions: t.instructions,
          loincCode: t.loincCode,
        })),
        priority: priority,
        clinicalInfo: clinicalInfo || null,
        specialInstructions: specialInstructions || null,
        scheduledDateTime: new Date().toISOString(),
        snomedConceptId: orderConcept.conceptId,
        snomedTerm: orderConcept.preferredTerm || orderConcept.term,
        snomedModuleId: orderConcept.moduleId,
        snomedDefinitionStatus: orderConcept.definitionStatus,
        loincCode:
          selectedTests.length === 1 ? representativeTest.loincCode : undefined,
      };

      await ehrApi.createLabOrder(labOrderData, token, tenantSlug);

      const paymentNote =
        totalCost > 0
          ? ` Please route the patient through Accounts to confirm payment of $${totalCost.toFixed(2)} before the lab proceeds.`
          : ' Please route the patient through Accounts to confirm payment before the lab proceeds.';
      showSuccess('Success', `Lab order created with ${selectedTests.length} test(s).${paymentNote}`);
      onSaved();
      onClose();
    } catch (error: any) {
      const raw = error?.response?.data;
      const msg = (raw && (raw.message || raw.error || raw.errors)) ? (raw.message || raw.error || raw.errors) : raw;
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg || 'Failed to create lab order');
      showError('Error', text);
    } finally {
      setLoading(false);
    }
  };

  const filteredTests = tests.filter(test => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      test.testName.toLowerCase().includes(search) ||
      test.testCode?.toLowerCase().includes(search) ||
      test.loincCode?.toLowerCase().includes(search)
    );
  });

  const categories = Array.from(new Set(tests.map(t => t.category)));

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/50 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl">
                <TestTube className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Lab Order</h3>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {appointment.patient.firstName} {appointment.patient.lastName}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDateToDDMMYYYY(appointment.appointmentDate)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(appointment.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <SnomedConceptPicker
                value={orderConcept}
                onChange={setOrderConcept}
                token={token}
                tenantSlug={tenantSlug}
                label="SNOMED CT Order Concept"
                placeholder="Search SNOMED CT (e.g., Complete blood count)"
                helperText="Select the standardized SNOMED CT concept for this laboratory order."
                required
              />
            </div>
            {/* Order Sets Section */}
            {orderSets.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-violet-600" />
                  <h4 className="font-semibold text-slate-900">Quick Order Sets</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {orderSets.map(set => (
                    <button
                      key={set.id}
                      onClick={() => handleAddOrderSet(set)}
                      className="px-3 py-2 text-sm border border-violet-200 rounded-lg hover:bg-violet-50 hover:border-violet-300 transition-colors text-left"
                    >
                      <div className="font-medium text-slate-900">{set.setName}</div>
                      {set.description && (
                        <div className="text-xs text-slate-500 mt-1">{set.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Tests */}
            {selectedTests.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">
                  Selected Tests ({selectedTests.length})
                </h4>
                <div className="space-y-2">
                  {selectedTests.map((test, index) => (
                    <div
                      key={test.testId}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{test.testName}</div>
                        <div className="text-xs text-slate-600">
                          {test.testCode} • {test.category} • {test.specimenType}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveTest(test.testId)}
                        className="p-1 hover:bg-red-100 rounded text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Test Search Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-900">Add Tests</h4>
                <button
                  onClick={() => setShowTestSearch(!showTestSearch)}
                  className="px-3 py-1 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  {showTestSearch ? 'Hide' : 'Search Tests'}
                </button>
              </div>

              {showTestSearch && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by test name, code, or LOINC..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    </div>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="all">All Categories</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {loadingTests ? (
                    <div className="text-center py-4 text-slate-500">Loading tests...</div>
                  ) : filteredTests.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                      {filteredTests.map(test => (
                        <button
                          key={test.id}
                          onClick={() => handleAddTest(test)}
                          className="w-full p-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                        >
                          <div className="font-medium text-slate-900">{test.testName}</div>
                          <div className="text-xs text-slate-600">
                            {test.testCode} {test.loincCode && `• LOINC: ${test.loincCode}`} • {test.category} • {test.specimenType}
                          </div>
                          {test.referenceRangeGeneral && (
                            <div className="text-xs text-slate-500 mt-1">
                              Ref Range: {test.referenceRangeGeneral}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-slate-500">
                      {searchTerm ? 'No tests found' : 'Start typing to search tests'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Order Details */}
            {selectedTests.length > 0 && (
              <div className="space-y-4 border-t border-slate-200 pt-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="stat">STAT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Clinical Information (Optional)</label>
                  <textarea
                    value={clinicalInfo}
                    onChange={(e) => setClinicalInfo(e.target.value)}
                    placeholder="Clinical context, diagnosis, or reason for testing..."
                    rows={2}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-violet-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Special Instructions (Optional)</label>
                  <textarea
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="Special collection instructions, timing requirements, etc..."
                    rows={2}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-violet-500 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || selectedTests.length === 0}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : `Create Order (${selectedTests.length} test${selectedTests.length !== 1 ? 's' : ''})`}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default LabOrdersModal;
