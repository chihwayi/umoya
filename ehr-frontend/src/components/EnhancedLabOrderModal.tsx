import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Trash2, Package, Clock, TestTube2, CreditCard, Brain } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import SnomedConceptPicker, { SnomedConcept } from './SnomedConceptPicker';

interface Test {
  id: string;
  test_code: string;
  test_name: string;
  category: string;
  specimen_type: string;
  container_type?: string;
  cost?: number;
  component_count?: number;
}

interface OrderSet {
  id: string;
  set_name: string;
  set_code: string;
  category: string;
  description?: string;
  test_count: number;
}

interface SelectedTest extends Test {
  concept?: SnomedConcept | null;
}

interface EnhancedLabOrderModalProps {
  patientId: string;
  patientName: string;
  tenantSlug: string;
  token: string;
  onClose: () => void;
  onSuccess?: () => void;
  orderingProviderId: string;
}

export default function EnhancedLabOrderModal({
  patientId,
  patientName,
  tenantSlug,
  token,
  onClose,
  onSuccess,
  orderingProviderId,
}: EnhancedLabOrderModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Test[]>([]);
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [orderSets, setOrderSets] = useState<OrderSet[]>([]);
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'order-sets'>('order-sets');
  const [cdssInsights, setCdssInsights] = useState<Array<{ testName: string; insights: any }>>([]);
  const { showSuccess, showError } = useNotification();

  const totalEstimatedCost = selectedTests.reduce((sum, test) => sum + (test.cost || 0), 0);

  useEffect(() => {
    loadOrderSets();
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const delaySearch = setTimeout(() => {
        searchTests();
      }, 300);
      return () => clearTimeout(delaySearch);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadOrderSets = async () => {
    try {
      const response = await ehrApi.getEnhancedOrderSets(tenantSlug, token, undefined, true);
      setOrderSets(response.data.orderSets || []);
    } catch (error) {
      console.error('Failed to load order sets:', error);
    }
  };

  const searchTests = async () => {
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      const response = await ehrApi.searchLabTests(tenantSlug, token, searchQuery);
      setSearchResults(response.data.tests || []);
    } catch (error) {
      console.error('Failed to search tests:', error);
      showError('Failed to search tests');
    } finally {
      setSearching(false);
    }
  };

  const addTest = (test: Test) => {
    if (!selectedTests.find((t) => t.id === test.id)) {
      setSelectedTests([...selectedTests, { ...test, concept: null }]);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const removeTest = (testId: string) => {
    setSelectedTests(selectedTests.filter((t) => t.id !== testId));
  };

  const orderFromSet = async (orderSet: OrderSet) => {
    try {
      setLoading(true);
      await ehrApi.createOrdersFromSet(tenantSlug, token, {
        order_set_id: orderSet.id,
        patient_id: patientId,
        ordering_provider_id: orderingProviderId,
        priority,
        clinical_indication: clinicalIndication || `Ordered via ${orderSet.set_name}`,
      });

      showSuccess(
        `Ordered ${orderSet.set_name} successfully (${orderSet.test_count} tests). Please route the patient through Accounts to confirm any outstanding laboratory fees.`,
      );
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to order from set:', error);
      showError('Failed to create orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedTests.length === 0) {
      showError('Please select at least one test');
      return;
    }

    const missingConcept = selectedTests.find((test) => !test.concept);
    if (missingConcept) {
      showError('SNOMED Required', `Please select a SNOMED CT concept for ${missingConcept.test_name}.`);
      return;
    }

    try {
      setLoading(true);
      setCdssInsights([]);

      const insightSummary: Array<{ testName: string; insights: any }> = [];

      // Create separate order for each test
      for (const test of selectedTests) {
        const response = await ehrApi.createLabOrder(
          {
            patientId,
            orderingProviderId,
            tests: [
              {
                testCode: test.test_code,
                testName: test.test_name,
                category: test.category,
                loincCode: (test as any).loinc_code,
              },
            ],
            priority,
            clinicalInfo: clinicalIndication,
            testCatalogId: test.id,
            snomedConceptId: test.concept?.conceptId,
            snomedTerm: test.concept?.preferredTerm || test.concept?.term,
            snomedModuleId: test.concept?.moduleId,
            snomedDefinitionStatus: test.concept?.definitionStatus,
          },
          token,
          tenantSlug,
        );
        const insights =
          response.data?.cdssInsights ??
          response.data?.cdss_insights ??
          null;
        if (insights) {
          insightSummary.push({ testName: test.test_name, insights });
        }
      }

      const paymentNote =
        totalEstimatedCost > 0
          ? ` Please direct the patient to Accounts to confirm payment of $${totalEstimatedCost.toFixed(2)}.`
          : '';
      showSuccess(`Ordered ${selectedTests.length} test(s) successfully.${paymentNote}`);
      onSuccess?.();
      setSelectedTests([]);
      setClinicalIndication('');

      if (insightSummary.length > 0) {
        setCdssInsights(insightSummary);
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Failed to create lab orders:', error);
      showError('Failed to create lab orders');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Hematology: 'bg-red-100 text-red-800',
      Chemistry: 'bg-blue-100 text-blue-800',
      Microbiology: 'bg-green-100 text-green-800',
      Serology: 'bg-purple-100 text-purple-800',
      Urinalysis: 'bg-yellow-100 text-yellow-800',
      Immunology: 'bg-pink-100 text-pink-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Order Laboratory Tests</h2>
              <p className="text-blue-100 mt-1">Patient: {patientName}</p>
            </div>
            <button onClick={onClose} className="text-white hover:bg-blue-800 rounded-lg p-2">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {cdssInsights.length > 0 && (
            <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">CDSS Insights</p>
                  <p className="text-xs text-slate-600">
                    Review guideline hints before closing this modal.
                  </p>
                </div>
              </div>
              {cdssInsights.map(({ testName, insights }, idx) => (
                <div key={`${testName}-${idx}`} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{testName}</p>
                    {insights?.guidelines?.matched_condition && (
                      <span className="text-xs text-slate-500">
                        Matched: {insights.guidelines.matched_condition}
                      </span>
                    )}
                  </div>
                  {Array.isArray(insights?.guidelines?.recommendations) && insights.guidelines.recommendations.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-1">Guideline Recommendations</p>
                      <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                        {insights.guidelines.recommendations.slice(0, 3).map((rec: string, recIdx: number) => (
                          <li key={`rec-${idx}-${recIdx}`}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(insights?.careGaps?.gaps) && insights.careGaps.gaps.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 mb-1">Potential Care Gaps</p>
                      <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                        {insights.careGaps.gaps.slice(0, 3).map((gap: any, gapIdx: number) => (
                          <li key={`gap-${idx}-${gapIdx}`}>{gap?.description || gap}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex space-x-2 mb-6 border-b">
            <button
              onClick={() => setActiveTab('order-sets')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'order-sets'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-blue-600'
              }`}
            >
              <Package className="w-4 h-4 inline mr-2" />
              Order Sets
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'search'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-blue-600'
              }`}
            >
              <Search className="w-4 h-4 inline mr-2" />
              Search Tests
            </button>
          </div>

          {/* Priority Selection (Shared) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <div className="flex space-x-3">
              {[
                { value: 'routine', label: 'Routine', color: 'bg-green-100 text-green-800 hover:bg-green-200' },
                { value: 'urgent', label: 'Urgent', color: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' },
                { value: 'stat', label: 'STAT', color: 'bg-red-100 text-red-800 hover:bg-red-200' },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value as any)}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                    priority === p.value
                      ? `${p.color} border-current font-bold`
                      : 'bg-gray-50 text-gray-600 border-gray-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clinical Indication (Shared) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clinical Indication
            </label>
            <textarea
              value={clinicalIndication}
              onChange={(e) => setClinicalIndication(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="Reason for ordering (e.g., 'Annual checkup', 'Follow-up diabetes', 'Pre-operative clearance')"
            />
          </div>

          {/* Tab Content */}
          {activeTab === 'order-sets' && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Order Panels</h3>
              
              {orderSets.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No order sets available</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {orderSets.map((orderSet) => (
                  <div
                    key={orderSet.id}
                    className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-all hover:shadow-md cursor-pointer group"
                    onClick={() => orderFromSet(orderSet)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 group-hover:text-blue-600">
                          {orderSet.set_name}
                        </h4>
                        <p className="text-sm text-gray-600">{orderSet.set_code}</p>
                      </div>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                        {orderSet.test_count} tests
                      </span>
                    </div>
                    {orderSet.description && (
                      <p className="text-sm text-gray-600 mb-2">{orderSet.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{orderSet.category}</span>
                      <span className="text-blue-600 group-hover:underline">Click to order →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Search tests by name or code (e.g., CBC, Glucose, Lipid)..."
                  autoFocus
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                  {searchResults.map((test) => (
                    <div
                      key={test.id}
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors"
                      onClick={() => addTest(test)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-gray-900">{test.test_name}</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${getCategoryColor(test.category)}`}>
                              {test.category}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">{test.test_code}</span> • {test.specimen_type}
                            {test.cost && ` • $${test.cost.toFixed(2)}`}
                            {test.component_count && ` • ${test.component_count} components`}
                          </div>
                        </div>
                        <Plus className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Tests */}
              {selectedTests.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900">Selected Tests ({selectedTests.length})</h4>
                  <div className="border border-gray-200 rounded-lg divide-y">
                    {selectedTests.map((test, index) => (
                      <div key={test.id} className="p-4 bg-blue-50 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <TestTube2 className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="font-medium text-gray-900">{test.test_name}</p>
                              <p className="text-sm text-gray-600">
                                {test.test_code} • {test.specimen_type}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeTest(test.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        <SnomedConceptPicker
                          value={test.concept || null}
                          onChange={(concept) =>
                            setSelectedTests((prev) =>
                              prev.map((item, itemIdx) =>
                                itemIdx === index ? { ...item, concept } : item,
                              ),
                            )
                          }
                          token={token}
                          tenantSlug={tenantSlug}
                          label="SNOMED CT Concept"
                          placeholder={`Search SNOMED CT (e.g., ${test.test_name})`}
                          helperText="Select the appropriate SNOMED CT concept for this test order."
                          required
                          context="procedure"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Estimated Cost */}
                  <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Estimated Total Cost</span>
                    <span className="text-lg font-bold text-gray-900">
                      ${totalEstimatedCost.toFixed(2)}
                    </span>
                  </div>

                  {totalEstimatedCost > 0 && (
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm flex gap-2">
                      <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">Payment required before processing</p>
                        <p>
                          Submitting this order will place it in an awaiting payment state. Accounts must confirm payment before the lab can collect the specimen.
                        </p>
                        <p className="mt-1">
                          Estimated lab fee:{' '}
                          <span className="font-semibold">${totalEstimatedCost.toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {activeTab === 'search' && selectedTests.length > 0 && (
                <span>{selectedTests.length} test(s) selected</span>
              )}
              {activeTab === 'order-sets' && (
                <span>{orderSets.length} quick order panel(s) available</span>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                disabled={loading}
              >
                Cancel
              </button>
              {activeTab === 'search' && (
                <button
                  onClick={handleSubmit}
                  disabled={selectedTests.length === 0 || loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Ordering...</span>
                    </>
                  ) : (
                    <>
                      <TestTube2 className="w-5 h-5" />
                      <span>Create {selectedTests.length} Order(s)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

