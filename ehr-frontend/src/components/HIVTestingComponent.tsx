import React, { useState, useEffect } from 'react';
import { TestTube, CheckCircle, X, AlertTriangle, Save, User, Calendar, Activity } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import HIVEnrollmentModal from './HIVEnrollmentModal';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface HIVTestingComponentProps {
  tenantSlug: string;
}

const HIVTestingComponent: React.FC<HIVTestingComponentProps> = ({ tenantSlug }) => {
  const { showSuccess, showError } = useNotification();
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [testForm, setTestForm] = useState({
    testKitName: 'Determine HIV-1/2',
    testResult: '',
    testKitLot: '',
    testKitExpiry: '',
    notes: ''
  });
  
  const [testHistory, setTestHistory] = useState<any[]>([]);
  const [algorithmResult, setAlgorithmResult] = useState<any>(null);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);

  const testKits = [
    'Determine HIV-1/2',
    'Unigold HIV',
    'First Response HIV 1-2',
    'Abbott Determine'
  ];

  useEffect(() => {
    if (selectedPatient) {
      loadTestHistory();
    }
  }, [selectedPatient]);

  const loadTestHistory = async () => {
    if (!selectedPatient) return;
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;
      
      const response = await ehrApi.getPatientHivTests(selectedPatient.id, token, tenantSlug);
      setTestHistory(response.data.tests || []);
      
      // Get latest algorithm result if available
      if (response.data.tests && response.data.tests.length > 0) {
        const latestTest = response.data.tests[0];
        if (latestTest.algorithm_result) {
          // Process algorithm result for display
          setAlgorithmResult({
            result: latestTest.algorithm_result,
            confidence: 'high',
            next_step: latestTest.algorithm_result === 'positive' 
              ? 'Offer enrollment in HIV care'
              : latestTest.algorithm_result === 'negative'
              ? 'Provide post-test counseling'
              : 'Continue testing algorithm'
          });
        }
      }
    } catch (error) {
      console.error('Failed to load test history:', error);
    }
  };

  const searchPatients = async () => {
    if (!searchTerm.trim()) {
      setPatients([]);
      return;
    }
    
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;
      
      setLoading(true);
      const response = await ehrApi.searchPatients(searchTerm, token, tenantSlug);
      setPatients(response.data || []);
    } catch (error) {
      console.error('Search failed:', error);
      showError('Error', 'Failed to search patients');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTest = async () => {
    if (!selectedPatient) {
      showError('Error', 'Please select a patient');
      return;
    }
    
    if (!testForm.testResult) {
      showError('Error', 'Please select a test result');
      return;
    }
    
    try {
      const token = localStorage.getItem('ehr_token');
      const currentUser = JSON.parse(localStorage.getItem('ehr_user') || '{}');
      
      if (!token) {
        showError('Error', 'Not authenticated');
        return;
      }
      
      setLoading(true);
      const response = await ehrApi.createHivTest({
        patientId: selectedPatient.id,
        testKitName: testForm.testKitName,
        testResult: testForm.testResult,
        testKitLot: testForm.testKitLot,
        testKitExpiry: testForm.testKitExpiry,
        notes: testForm.notes,
        testedBy: currentUser.id
      }, token, tenantSlug);
      
      showSuccess('Success', 'HIV test recorded successfully');
      
      // Clear form
      setTestForm({
        testKitName: testHistory.length === 0 ? 'Determine HIV-1/2' : 'Unigold HIV',
        testResult: '',
        testKitLot: '',
        testKitExpiry: '',
        notes: ''
      });
      
      // Reload history
      await loadTestHistory();
      
      // Show algorithm result
      if (response.data?.algorithm) {
        setAlgorithmResult(response.data.algorithm);
      }
    } catch (error: any) {
      console.error('Test submission failed:', error);
      showError('Error', error.response?.data?.message || 'Failed to record test');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollInCare = () => {
    if (selectedPatient) {
      setShowEnrollmentModal(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">HIV Testing</h2>
            <p className="text-emerald-100">Zimbabwe National HIV Testing Algorithm</p>
          </div>
          <TestTube className="w-12 h-12 opacity-80" />
        </div>
      </div>

      {/* Patient Search */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-600" />
          Select Patient
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search by name or patient number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchPatients()}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <button
            onClick={searchPatients}
            disabled={loading || !searchTerm.trim()}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {patients.length > 0 && (
          <div className="mt-4 space-y-2">
            {patients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => {
                  setSelectedPatient(patient);
                  setPatients([]);
                  setSearchTerm(`${patient.firstName} ${patient.lastName}`);
                }}
                className="w-full p-3 text-left border border-slate-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
              >
                <div className="font-semibold">{patient.firstName} {patient.lastName}</div>
                <div className="text-sm text-slate-600">ID: {patient.patientNumber}</div>
              </button>
            ))}
          </div>
        )}

        {selectedPatient && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-emerald-900">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </div>
                <div className="text-sm text-emerald-700">ID: {selectedPatient.patientNumber}</div>
              </div>
              <button
                onClick={() => {
                  setSelectedPatient(null);
                  setSearchTerm('');
                  setTestHistory([]);
                  setAlgorithmResult(null);
                }}
                className="text-emerald-600 hover:text-emerald-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test Form */}
      {selectedPatient && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TestTube className="w-5 h-5 text-emerald-600" />
            Record HIV Test
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Test Kit</label>
              <select
                value={testForm.testKitName}
                onChange={(e) => setTestForm({ ...testForm, testKitName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                {testKits.map((kit) => (
                  <option key={kit} value={kit}>{kit}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Test Result</label>
              <select
                value={testForm.testResult}
                onChange={(e) => setTestForm({ ...testForm, testResult: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select result...</option>
                <option value="reactive">Reactive</option>
                <option value="non_reactive">Non-Reactive</option>
                <option value="invalid">Invalid</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Test Kit Lot Number</label>
              <input
                type="text"
                value={testForm.testKitLot}
                onChange={(e) => setTestForm({ ...testForm, testKitLot: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter lot number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Test Kit Expiry Date</label>
              <input
                type="date"
                value={testForm.testKitExpiry}
                onChange={(e) => setTestForm({ ...testForm, testKitExpiry: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea
                value={testForm.notes}
                onChange={(e) => setTestForm({ ...testForm, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                rows={3}
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <button
            onClick={handleSubmitTest}
            disabled={loading}
            className="mt-6 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 font-semibold"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Recording Test...' : 'Record Test'}
          </button>
        </div>
      )}

      {/* Algorithm Result */}
      {algorithmResult && (
        <div className={`rounded-xl shadow-lg p-6 border-2 ${
          (algorithmResult.result || algorithmResult.algorithm_result) === 'positive' 
            ? 'bg-red-50 border-red-300'
            : (algorithmResult.result || algorithmResult.algorithm_result) === 'negative'
            ? 'bg-green-50 border-green-300'
            : (algorithmResult.result || algorithmResult.algorithm_result) === 'indeterminate'
            ? 'bg-yellow-50 border-yellow-300'
            : 'bg-blue-50 border-blue-300'
        }`}>
          <div className="flex items-start gap-4">
            {(algorithmResult.result || algorithmResult.algorithm_result) === 'positive' ? (
              <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
            ) : (algorithmResult.result || algorithmResult.algorithm_result) === 'negative' ? (
              <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
            ) : (
              <Activity className="w-8 h-8 text-yellow-600 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">
                Algorithm Result: {((algorithmResult.result || algorithmResult.algorithm_result) || 'Pending').toUpperCase()}
              </h3>
              {(algorithmResult.next_step || algorithmResult.recommendation) && (
                <p className="text-slate-700 mb-2">{algorithmResult.next_step || algorithmResult.recommendation}</p>
              )}
              {((algorithmResult.result || algorithmResult.algorithm_result) === 'positive') && (
                <button
                  onClick={handleEnrollInCare}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
                >
                  Enroll Patient in Care
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Test History */}
      {testHistory.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <h3 className="text-lg font-semibold mb-4">Test History</h3>
          <div className="space-y-3">
            {testHistory.map((test: any) => (
              <div key={test.id} className="p-4 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{test.test_kit_name}</div>
                    <div className="text-sm text-slate-600">
                      Result: <span className="font-medium">{test.test_result}</span> | 
                      Date: {formatDateToDDMMYYYY(test.test_date)}
                    </div>
                    {test.algorithm_result && (
                      <div className="mt-2 text-sm">
                        <span className={`px-2 py-1 rounded ${
                          test.algorithm_result === 'positive' ? 'bg-red-100 text-red-800' :
                          test.algorithm_result === 'negative' ? 'bg-green-100 text-green-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          Algorithm: {test.algorithm_result}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enrollment Modal */}
      {showEnrollmentModal && selectedPatient && (
        <HIVEnrollmentModal
          patientId={selectedPatient.id}
          patientName={`${selectedPatient.first_name || selectedPatient.firstName} ${selectedPatient.last_name || selectedPatient.lastName}`}
          patientAge={selectedPatient.date_of_birth || selectedPatient.dateOfBirth ? Math.floor((new Date().getTime() - new Date(selectedPatient.date_of_birth || selectedPatient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined}
          patientSex={selectedPatient.gender}
          onClose={() => setShowEnrollmentModal(false)}
          onSuccess={() => {
            setShowEnrollmentModal(false);
            loadTestHistory();
          }}
          tenantSlug={tenantSlug}
        />
      )}
    </div>
  );
};

export default HIVTestingComponent;

