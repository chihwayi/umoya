import React, { useState, useEffect } from 'react';
import { usePatientAuth } from '../contexts/PatientAuthContext';
import { patientPortalApi } from '../services/api';
import { FlaskConical, Calendar, ArrowLeft, AlertCircle, CheckCircle, XCircle, TrendingUp, FileDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const LabResultsPage: React.FC = () => {
  const { token } = usePatientAuth();
  const tenantSlug = localStorage.getItem('patient_tenant') || 'bulawayo-general';
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      setLoading(true);
      const data = await patientPortalApi.getLabResults(token!, tenantSlug);
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load lab results');
    } finally {
      setLoading(false);
    }
  };

  const getFlagIcon = (flag: string) => {
    switch (flag) {
      case 'normal':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'high':
      case 'low':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getFlagColor = (flag: string) => {
    switch (flag) {
      case 'normal':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'high':
      case 'low':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your lab results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Lab Results</h1>
          <p className="text-gray-600">View your laboratory test results</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {results.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-white/20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-6 shadow-lg">
              <FlaskConical className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Lab Results</h3>
            <p className="text-gray-600">You don't have any completed lab results yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {results.map((order) => (
              <div
                key={order.id}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-white/20 hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <FlaskConical className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        Order #{order.orderNumber}
                      </h3>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">
                          {format(new Date(order.orderDate), 'MMMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors flex items-center gap-2 border border-indigo-200">
                    <FileDown className="w-4 h-4" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                </div>

                {order.interpretation && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-4">
                    <p className="text-sm font-semibold text-blue-900 mb-1">Interpretation:</p>
                    <p className="text-sm text-blue-800">{order.interpretation}</p>
                  </div>
                )}

                {order.results && order.results.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 mb-3">Test Results:</h4>
                    {order.results.map((result: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h5 className="font-semibold text-gray-900 mb-1">{result.testName}</h5>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>
                                <strong>Result:</strong> {result.value} {result.unit}
                              </span>
                              {result.referenceRange && (
                                <span>
                                  <strong>Normal Range:</strong> {result.referenceRange}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getFlagIcon(result.flag)}
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getFlagColor(result.flag)}`}>
                              {result.flag?.toUpperCase() || 'NORMAL'}
                            </span>
                          </div>
                        </div>
                        {result.resultDate && (
                          <p className="text-xs text-gray-500 mt-2">
                            Result Date: {format(new Date(result.resultDate), 'MMM d, yyyy')}
                            {result.performedBy && ` • Performed by: ${result.performedBy}`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No test results available for this order.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LabResultsPage;

