import React, { useState, useEffect, useMemo } from 'react';
import {
  TestTube, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Calendar, User, CheckCircle, XCircle, ArrowUp, ArrowDown, Brain, RefreshCw
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { formatDateTimeToDDMMYYYYHHMM } from '../utils/dateFormatting';

interface LabResult {
  testCode: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: 'normal' | 'high' | 'low' | 'critical';
  resultDate: Date;
  performedBy: string;
}

interface LabOrder {
  id: string;
  orderNumber: string;
  tests: Array<{
    testCode: string;
    testName: string;
    category: string;
  }>;
  results: LabResult[];
  interpretation?: string;
  reviewedAt?: Date;
  reviewedBy?: {
    firstName: string;
    lastName: string;
  };
  orderingProvider?: {
    firstName: string;
    lastName: string;
  };
}

interface LabResultsViewerProps {
  patientId: string;
  tenantSlug: string;
  token: string;
  onClose?: () => void;
}

const LabResultsViewer: React.FC<LabResultsViewerProps> = ({ patientId, tenantSlug, token, onClose }) => {
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cdssAnalysis, setCdssAnalysis] = useState<any>(null);
  const [loadingCdss, setLoadingCdss] = useState(false);

  useEffect(() => {
    const loadResults = async () => {
      try {
        setLoading(true);
        const response = await ehrApi.getPatientLabResults(patientId, token, tenantSlug);
        setLabOrders(response.data || []);
      } catch (error) {
        console.error('Failed to load lab results:', error);
        setLabOrders([]);
      } finally {
        setLoading(false);
      }
    };

    if (patientId) {
      loadResults();
    }
  }, [patientId, token, tenantSlug]);

  // Extract all unique test codes for trending
  const allTestCodes = useMemo(() => {
    const codes = new Set<string>();
    labOrders.forEach(order => {
      order.results?.forEach(result => {
        codes.add(result.testCode || result.testName);
      });
    });
    return Array.from(codes);
  }, [labOrders]);

  // Group results by test for trending
  const resultsByTest = useMemo(() => {
    const grouped: Record<string, Array<{ value: number; date: Date; flag: string; orderId: string }>> = {};
    
    labOrders.forEach(order => {
      order.results?.forEach(result => {
        const testKey = result.testCode || result.testName;
        if (!grouped[testKey]) {
          grouped[testKey] = [];
        }
        
        // Try to parse numeric value
        const numericValue = parseFloat(result.value);
        if (!isNaN(numericValue)) {
          grouped[testKey].push({
            value: numericValue,
            date: new Date(result.resultDate || order.reviewedAt || order.id),
            flag: result.flag,
            orderId: order.id
          });
        }
      });
    });

    // Sort by date
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => a.date.getTime() - b.date.getTime());
    });

    return grouped;
  }, [labOrders]);

  // Get categories from tests
  const categories = useMemo(() => {
    const cats = new Set<string>();
    labOrders.forEach(order => {
      order.tests?.forEach(test => {
        if (test.category) cats.add(test.category);
      });
    });
    return Array.from(cats);
  }, [labOrders]);

  // Filter orders by category
  const filteredOrders = useMemo(() => {
    if (!selectedCategory) return labOrders;
    return labOrders.filter(order => 
      order.tests?.some(test => test.category === selectedCategory)
    );
  }, [labOrders, selectedCategory]);

  const getFlagColor = (flag: string) => {
    switch (flag) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'low': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const getFlagIcon = (flag: string) => {
    switch (flag) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'high': return <ArrowUp className="w-4 h-4 text-orange-600" />;
      case 'low': return <ArrowDown className="w-4 h-4 text-yellow-600" />;
      default: return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
  };

  // Calculate trend for a test
  const getTrend = (testKey: string) => {
    const values = resultsByTest[testKey];
    if (!values || values.length < 2) return null;

    const recent = values.slice(-2);
    const diff = recent[1].value - recent[0].value;
    const percentChange = ((diff / recent[0].value) * 100).toFixed(1);

    return {
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable',
      percent: Math.abs(parseFloat(percentChange)),
      recent: recent
    };
  };

  const runCdssAnalysis = async () => {
    if (labOrders.length === 0 || !labOrders[0]?.results) return;
    
    setLoadingCdss(true);
    try {
      // Get current lab results
      const currentResults: Record<string, number> = {};
      const historicalLabs: any[] = [];
      
      labOrders.forEach((order, orderIdx) => {
        order.results?.forEach(result => {
          const testName = result.testName;
          const numericValue = parseFloat(result.value);
          
          if (!isNaN(numericValue)) {
            if (orderIdx === 0) {
              // Current results
              currentResults[testName] = numericValue;
            } else {
              // Historical results
              if (!historicalLabs[orderIdx - 1]) {
                historicalLabs[orderIdx - 1] = {};
              }
              historicalLabs[orderIdx - 1][testName] = numericValue;
            }
          }
        });
      });

      const response = await ehrApi.interpretLabResults(
        currentResults,
        historicalLabs.length > 0 ? historicalLabs : [],
        token,
        tenantSlug
      );
      setCdssAnalysis(response.data);
    } catch (error) {
      console.error('Failed to get CDSS analysis:', error);
    } finally {
      setLoadingCdss(false);
    }
  };

  // Simple trend chart component
  const TrendChart: React.FC<{ testKey: string }> = ({ testKey }) => {
    const values = resultsByTest[testKey];
    if (!values || values.length === 0) return null;

    const min = Math.min(...values.map(v => v.value));
    const max = Math.max(...values.map(v => v.value));
    const range = max - min || 1;
    const width = 200;
    const height = 60;

    return (
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} className="absolute">
          <polyline
            points={values.map((v, i) => 
              `${(i / (values.length - 1 || 1)) * width},${height - ((v.value - min) / range) * (height - 10) - 5}`
            ).join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={values[values.length - 1].flag === 'critical' ? 'text-red-500' : 
                     values[values.length - 1].flag === 'high' ? 'text-orange-500' :
                     values[values.length - 1].flag === 'low' ? 'text-yellow-500' : 'text-blue-500'}
          />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 text-xs text-slate-500 flex justify-between">
          <span>{values.length > 0 ? new Date(values[0].date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) : ''}</span>
          <span>{values.length > 0 ? new Date(values[values.length - 1].date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) : ''}</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (labOrders.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-8 text-center">
        <TestTube className="w-16 h-16 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Lab Results</h3>
        <p className="text-slate-600">No completed lab results found for this patient.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl">
              <TestTube className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Lab Results</h2>
              <p className="text-sm text-slate-600">{labOrders.length} completed order{labOrders.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-700">Filter:</span>
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                !selectedCategory
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors capitalize ${
                  selectedCategory === cat
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lab Orders */}
      <div className="space-y-4">
        {filteredOrders.map(order => (
          <div
            key={order.id}
            className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 p-6"
          >
            {/* Order Header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-900">Order #{order.orderNumber}</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    Completed
                  </span>
                </div>
                {order.tests && order.tests.length > 0 && (
                  <div className="text-sm text-slate-600">
                    {order.tests.map(t => t.testName).join(', ')}
                  </div>
                )}
              </div>
              <div className="text-right text-sm text-slate-600">
                {order.reviewedAt && (
                  <>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDateTimeToDDMMYYYYHHMM(order.reviewedAt.toString())}
                    </div>
                    {order.reviewedBy && (
                      <div className="text-xs mt-1">
                        Reviewed by: {order.reviewedBy.firstName} {order.reviewedBy.lastName}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Results */}
            {order.results && order.results.length > 0 && (
              <div className="space-y-3">
                {order.results.map((result, idx) => {
                  const testKey = result.testCode || result.testName;
                  const trend = getTrend(testKey);
                  const hasTrend = resultsByTest[testKey] && resultsByTest[testKey].length > 1;

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border-2 ${getFlagColor(result.flag)}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getFlagIcon(result.flag)}
                            <span className="font-semibold text-slate-900">{result.testName}</span>
                            {result.testCode && (
                              <span className="text-xs text-slate-500">({result.testCode})</span>
                            )}
                            {trend && (
                              <span className={`flex items-center gap-1 text-xs ${
                                trend.direction === 'up' ? 'text-orange-600' :
                                trend.direction === 'down' ? 'text-blue-600' : 'text-slate-600'
                              }`}>
                                {trend.direction === 'up' ? <TrendingUp className="w-3 h-3" /> :
                                 trend.direction === 'down' ? <TrendingDown className="w-3 h-3" /> :
                                 <Minus className="w-3 h-3" />}
                                {trend.percent}%
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                            <div>
                              <div className="text-xs text-slate-600 mb-1">Result</div>
                              <div className="font-bold text-lg">{result.value} {result.unit}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-600 mb-1">Reference Range</div>
                              <div className="font-medium">{result.referenceRange || '—'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-600 mb-1">Status</div>
                              <div className="font-medium capitalize">{result.flag}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-600 mb-1">Date</div>
                              <div className="font-medium">
                                {new Date(result.resultDate).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Trend Chart */}
                      {hasTrend && (
                        <div className="mt-3 pt-3 border-t border-slate-300">
                          <div className="text-xs text-slate-600 mb-2">Trend Over Time</div>
                          <TrendChart testKey={testKey} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Interpretation */}
            {order.interpretation && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-sm font-medium text-slate-700 mb-1">Clinical Interpretation</div>
                <div className="text-sm text-slate-600">{order.interpretation}</div>
              </div>
            )}

            {/* CDSS Analysis Section */}
            {labOrders.indexOf(order) === 0 && (
              <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-600" />
                    <h3 className="text-base font-bold text-slate-900">CDSS Lab Analysis</h3>
                  </div>
                  <button
                    onClick={runCdssAnalysis}
                    disabled={loadingCdss}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingCdss ? 'animate-spin' : ''}`} />
                    {loadingCdss ? 'Analyzing...' : 'Run CDSS Analysis'}
                  </button>
                </div>

                {cdssAnalysis && (
                  <div className="space-y-4 mt-4">
                    {/* Summary */}
                    {cdssAnalysis.summary && (
                      <div className="bg-white rounded-lg p-3 border border-blue-200">
                        <div className="grid grid-cols-4 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-slate-600">Total Tests</div>
                            <div className="font-bold text-lg">{cdssAnalysis.summary.total_tests}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-600">Normal</div>
                            <div className="font-bold text-lg text-green-600">{cdssAnalysis.summary.normal}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-600">Abnormal</div>
                            <div className="font-bold text-lg text-orange-600">{cdssAnalysis.summary.abnormal}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-600">Critical</div>
                            <div className="font-bold text-lg text-red-600">{cdssAnalysis.summary.critical}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Critical Alerts */}
                    {cdssAnalysis.critical_alerts && cdssAnalysis.critical_alerts.length > 0 && (
                      <div className="bg-red-50 rounded-lg p-3 border-2 border-red-300">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          <h4 className="font-bold text-red-900">CRITICAL ALERTS</h4>
                        </div>
                        <ul className="space-y-2">
                          {cdssAnalysis.critical_alerts.map((alert: any, idx: number) => (
                            <li key={idx} className="text-sm text-red-800">
                              <div className="font-semibold">{alert.message}</div>
                              {alert.action && (
                                <div className="text-xs text-red-700 mt-1 pl-4">{alert.action}</div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Warnings */}
                    {cdssAnalysis.warnings && cdssAnalysis.warnings.length > 0 && (
                      <div className="bg-orange-50 rounded-lg p-3 border border-orange-300">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                          <h4 className="font-semibold text-orange-900">Warnings</h4>
                        </div>
                        <ul className="space-y-1">
                          {cdssAnalysis.warnings.slice(0, 5).map((warning: any, idx: number) => (
                            <li key={idx} className="text-sm text-orange-800">
                              <div>{warning.message}</div>
                              {warning.action && (
                                <div className="text-xs text-orange-700 mt-1 pl-4">{warning.action}</div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {cdssAnalysis.recommendations && cdssAnalysis.recommendations.length > 0 && (
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-300">
                        <h4 className="font-semibold text-blue-900 mb-2">Recommendations</h4>
                        <ul className="space-y-1">
                          {cdssAnalysis.recommendations.map((rec: string, idx: number) => (
                            <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                              <span className="text-blue-600 mt-0.5">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Trend Analysis */}
                    {cdssAnalysis.trends && Object.keys(cdssAnalysis.trends).length > 0 && (
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-300">
                        <h4 className="font-semibold text-purple-900 mb-2">Trend Analysis</h4>
                        <div className="space-y-2">
                          {Object.entries(cdssAnalysis.trends).slice(0, 5).map(([testName, trend]: [string, any]) => (
                            <div key={testName} className="text-sm">
                              <div className="font-medium text-purple-900 capitalize">{testName.replace(/([A-Z])/g, ' $1').trim()}</div>
                              <div className="text-xs text-purple-700 mt-1">
                                Trend: <span className="font-semibold">{trend.trend}</span>
                                {trend.change_percent !== undefined && (
                                  <span className="ml-2">
                                    ({trend.change_percent > 0 ? '+' : ''}{trend.change_percent}% change)
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!cdssAnalysis && !loadingCdss && (
                  <p className="text-sm text-slate-600">Click "Run CDSS Analysis" to get intelligent interpretation of lab results</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LabResultsViewer;

