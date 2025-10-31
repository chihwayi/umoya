import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  TestTube, Clock, CheckCircle, AlertCircle, FileText, Upload,
  Search, RefreshCw, User, LogOut, Calendar, Activity, Filter,
  Eye, Play, FileCheck, Send, Download, X, Plus
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from '../components/GlobalNotification';
import ModalPortal from '../components/ModalPortal';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';

interface LabOrder {
  id: string;
  orderNumber: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientNumber: string;
    dateOfBirth: string;
  };
  orderingProvider: {
    id: string;
    firstName: string;
    lastName: string;
  };
  tests: Array<{
    testCode: string;
    testName: string;
    category: string;
    specimenType: string;
    instructions?: string;
  }>;
  priority: 'routine' | 'urgent' | 'stat';
  status: 'ordered' | 'collected' | 'in_progress' | 'completed' | 'cancelled';
  clinicalInfo?: string;
  specialInstructions?: string;
  scheduledDateTime?: string;
  collectedAt?: string;
  collectedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  results?: Array<{
    testCode: string;
    testName: string;
    value: string;
    unit: string;
    referenceRange: string;
    flag: 'normal' | 'high' | 'low' | 'critical';
    resultDate: string;
    performedBy: string;
  }>;
  interpretation?: string;
  attachments?: Array<{
    filename: string;
    url: string;
    type: string;
    uploadedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface LabResult {
  testCode: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: 'normal' | 'high' | 'low' | 'critical';
}

const LabDashboard: React.FC = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'in-progress' | 'completed'>('pending');
  const [pendingOrders, setPendingOrders] = useState<LabOrder[]>([]);
  const [inProgressOrders, setInProgressOrders] = useState<LabOrder[]>([]);
  const [completedOrders, setCompletedOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Results form state
  const [results, setResults] = useState<LabResult[]>([]);
  const [interpretation, setInterpretation] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  useEffect(() => {
    const userStr = localStorage.getItem('ehr_user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const fetchPendingOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      const response = await ehrApi.getPendingLabOrders(token, tenantSlug);
      setPendingOrders(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch pending orders:', error);
    }
  }, [tenantSlug]);

  const fetchInProgressOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      const response = await ehrApi.getInProgressLabOrders(token, tenantSlug);
      setInProgressOrders(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch in-progress orders:', error);
    }
  }, [tenantSlug]);

  const fetchCompletedOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      const response = await ehrApi.getLabOrders({ status: 'completed' }, token, tenantSlug);
      setCompletedOrders(response.data?.labOrders || []);
    } catch (error: any) {
      console.error('Failed to fetch completed orders:', error);
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingOrders();
    } else if (activeTab === 'in-progress') {
      fetchInProgressOrders();
    } else {
      fetchCompletedOrders();
    }
  }, [activeTab, fetchPendingOrders, fetchInProgressOrders, fetchCompletedOrders]);

  const handleCollectSample = async (orderId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      await ehrApi.collectLabSample(orderId, token, tenantSlug);
      showSuccess('Success', 'Sample collected');
      
      // Refresh both tabs and switch to in-progress since order moved there
      await Promise.all([
        fetchPendingOrders(),
        fetchInProgressOrders()
      ]);
      
      // Switch to in-progress tab so user sees the collected order
      setActiveTab('in-progress');
    } catch (error: any) {
      showError('Error', 'Failed to collect sample');
    } finally {
      setLoading(false);
    }
  };

  const handleStartProcessing = async (orderId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      await ehrApi.startProcessingLabOrder(orderId, token, tenantSlug);
      showSuccess('Success', 'Processing started');
      
      // Refresh both pending and in-progress orders
      await Promise.all([
        fetchPendingOrders(),
        fetchInProgressOrders()
      ]);
    } catch (error: any) {
      showError('Error', 'Failed to start processing');
    } finally {
      setLoading(false);
    }
  };

  const openResultsModal = (order: LabOrder) => {
    setSelectedOrder(order);
    // Initialize results form with test names from order
    const initialResults: LabResult[] = order.tests.map(test => ({
      testCode: test.testCode,
      testName: test.testName,
      value: '',
      unit: '',
      referenceRange: '',
      flag: 'normal'
    }));
    setResults(initialResults);
    setInterpretation(order.interpretation || '');
    setUploadedFiles([]);
    setShowResultsModal(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles([...uploadedFiles, ...files]);
  };

  const handleSubmitResults = async () => {
    if (!selectedOrder) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('ehr_token');
      if (!token || !tenantSlug) return;

      // Convert uploaded files to attachments format
      const attachments = uploadedFiles.map(file => ({
        filename: file.name,
        url: URL.createObjectURL(file), // In production, upload to server first
        type: file.type,
        uploadedAt: new Date().toISOString()
      }));

      // Convert results to the format expected by backend
      const resultsData = results.map(result => ({
        ...result,
        resultDate: new Date().toISOString(),
        performedBy: currentUser?.id || ''
      }));

      await ehrApi.submitLabResults(selectedOrder.id, {
        results: resultsData,
        interpretation,
        attachments
      }, token, tenantSlug);

      showSuccess('Success', 'Results submitted successfully');
      setShowResultsModal(false);
      setSelectedOrder(null);
      fetchInProgressOrders();
      fetchCompletedOrders();
    } catch (error: any) {
      showError('Error', 'Failed to submit results');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    localStorage.removeItem('ehr_tenant_slug');
    navigate(`/ehr/${tenantSlug}`);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      ordered: 'bg-blue-100 text-blue-800',
      collected: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: string) => {
    const badges = {
      routine: 'bg-gray-100 text-gray-800',
      urgent: 'bg-orange-100 text-orange-800',
      stat: 'bg-red-100 text-red-800'
    };
    return badges[priority as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getFlagBadge = (flag: string) => {
    const badges = {
      normal: 'bg-green-100 text-green-800',
      high: 'bg-orange-100 text-orange-800',
      low: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800'
    };
    return badges[flag as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const currentOrders = activeTab === 'pending' ? pendingOrders : 
                        activeTab === 'in-progress' ? inProgressOrders : 
                        completedOrders;

  const filteredOrders = currentOrders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(searchLower) ||
      order.patient.firstName.toLowerCase().includes(searchLower) ||
      order.patient.lastName.toLowerCase().includes(searchLower) ||
      order.patient.patientNumber.toLowerCase().includes(searchLower) ||
      order.tests.some(test => test.testName.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl">
                <TestTube className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Laboratory Dashboard</h1>
                <p className="text-sm text-slate-500">Manage lab orders and results</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (activeTab === 'pending') fetchPendingOrders();
                  else if (activeTab === 'in-progress') fetchInProgressOrders();
                  else fetchCompletedOrders();
                }}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-100 text-slate-700"
                >
                  <User className="w-5 h-5" />
                  <span>{currentUser?.firstName} {currentUser?.lastName}</span>
                </button>
                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'pending'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-5 h-5" />
                <span>Pending Orders ({pendingOrders.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('in-progress')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'in-progress'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Activity className="w-5 h-5" />
                <span>In Progress ({inProgressOrders.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'completed'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span>Completed ({completedOrders.length})</span>
              </div>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by order number, patient name, or test..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <TestTube className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No {activeTab} orders found</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-slate-900">{order.orderNumber}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(order.status)}`}>
                          {order.status.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityBadge(order.priority)}`}>
                          {order.priority.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                        <div>
                          <span className="font-semibold">Patient:</span> {order.patient.firstName} {order.patient.lastName} ({order.patient.patientNumber})
                        </div>
                        <div>
                          <span className="font-semibold">Ordered by:</span> Dr. {order.orderingProvider.firstName} {order.orderingProvider.lastName}
                        </div>
                        <div>
                          <span className="font-semibold">Created:</span> {formatDateTimeToDDMMYYYYHHMM(order.createdAt)}
                        </div>
                        {order.collectedAt && (
                          <div>
                            <span className="font-semibold">Collected:</span> {formatDateTimeToDDMMYYYYHHMM(order.collectedAt)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold text-slate-700 mb-2">Tests Ordered:</h4>
                    <div className="flex flex-wrap gap-2">
                      {order.tests.map((test, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm"
                        >
                          {test.testName}
                        </span>
                      ))}
                    </div>
                  </div>

                  {order.clinicalInfo && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800"><span className="font-semibold">Clinical Info:</span> {order.clinicalInfo}</p>
                    </div>
                  )}

                  {order.specialInstructions && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800"><span className="font-semibold">Special Instructions:</span> {order.specialInstructions}</p>
                    </div>
                  )}

                  {activeTab === 'completed' && order.results && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-slate-700 mb-2">Results:</h4>
                      <div className="space-y-2">
                        {order.results.map((result, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                            <span className="text-sm">{result.testName}: {result.value} {result.unit}</span>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${getFlagBadge(result.flag)}`}>
                              {result.flag.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                    {activeTab === 'pending' && (
                      <>
                        <button
                          onClick={() => handleCollectSample(order.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Collect Sample
                        </button>
                        <button
                          onClick={() => handleStartProcessing(order.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Start Processing
                        </button>
                      </>
                    )}
                    {activeTab === 'in-progress' && (
                      <button
                        onClick={() => openResultsModal(order)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                      >
                        <FileCheck className="w-4 h-4" />
                        Submit Results
                      </button>
                    )}
                    {activeTab === 'completed' && (
                      <button
                        onClick={() => openResultsModal(order)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Results Modal */}
      {showResultsModal && selectedOrder && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-2xl">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Submit Lab Results - {selectedOrder.orderNumber}</h2>
                <button
                  onClick={() => setShowResultsModal(false)}
                  className="p-2 rounded-lg hover:bg-white/20 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
                <div className="mb-6">
                  <h3 className="font-semibold text-slate-700 mb-3">Test Results</h3>
                  <div className="space-y-4">
                    {results.map((result, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <h4 className="font-semibold text-slate-700 mb-3">{result.testName}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Value</label>
                            <input
                              type="text"
                              value={result.value}
                              onChange={(e) => {
                                const newResults = [...results];
                                newResults[idx].value = e.target.value;
                                setResults(newResults);
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter value"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Unit</label>
                            <input
                              type="text"
                              value={result.unit}
                              onChange={(e) => {
                                const newResults = [...results];
                                newResults[idx].unit = e.target.value;
                                setResults(newResults);
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., mg/dL"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Reference Range</label>
                            <input
                              type="text"
                              value={result.referenceRange}
                              onChange={(e) => {
                                const newResults = [...results];
                                newResults[idx].referenceRange = e.target.value;
                                setResults(newResults);
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., 70-100"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Flag</label>
                            <select
                              value={result.flag}
                              onChange={(e) => {
                                const newResults = [...results];
                                newResults[idx].flag = e.target.value as any;
                                setResults(newResults);
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="normal">Normal</option>
                              <option value="high">High</option>
                              <option value="low">Low</option>
                              <option value="critical">Critical</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-600 mb-2">Clinical Interpretation</label>
                  <textarea
                    value={interpretation}
                    onChange={(e) => setInterpretation(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter clinical interpretation..."
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-600 mb-2">Upload Documents (PDF, Images, etc.)</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
                    >
                      Choose Files
                    </label>
                    {uploadedFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {uploadedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                            <span className="text-sm text-slate-600">{file.name}</span>
                            <button
                              onClick={() => setUploadedFiles(uploadedFiles.filter((_, i) => i !== idx))}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowResultsModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitResults}
                  disabled={loading || results.some(r => !r.value)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Submit Results
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default LabDashboard;

