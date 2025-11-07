import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ArrowRight, Calendar, FileText } from 'lucide-react';
import { ehrApi } from '../services/api';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface LabResult {
  id: string;
  order_number: string;
  test_code: string;
  test_name: string;
  component_name: string;
  component_code: string;
  value: string;
  unit: string;
  reference_range: string;
  flag: string;
  result_date: string;
  created_at: string;
}

interface ComponentHistory {
  component_name: string;
  component_code: string;
  unit: string;
  reference_range_min?: number;
  reference_range_max?: number;
  results: Array<{
    date: string;
    value: number;
    flag: string;
    reference_range: string;
  }>;
  trend?: 'up' | 'down' | 'stable';
  change_percent?: number;
  latest_value?: number;
  previous_value?: number;
}

interface AdvancedResultComparisonProps {
  patientId: string;
  tenantSlug: string;
  token: string;
}

export default function AdvancedResultComparison({
  patientId,
  tenantSlug,
  token,
}: AdvancedResultComparisonProps) {
  const [results, setResults] = useState<LabResult[]>([]);
  const [componentHistory, setComponentHistory] = useState<Record<string, ComponentHistory>>({});
  const [loading, setLoading] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'30' | '90' | '180' | '365' | 'all'>('90');

  useEffect(() => {
    loadResults();
  }, [patientId, dateRange]);

  const loadResults = async () => {
    try {
      setLoading(true);
      const response = await ehrApi.getPatientLabResults(patientId, token, tenantSlug);
      const allResults = response.data.results || [];

      // Filter by date range
      const cutoffDate = new Date();
      if (dateRange !== 'all') {
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));
      }

      const filteredResults = allResults.filter((result: LabResult) => {
        if (dateRange === 'all') return true;
        return new Date(result.result_date || result.created_at) >= cutoffDate;
      });

      setResults(filteredResults);

      // Group by component
      const history: Record<string, ComponentHistory> = {};

      filteredResults.forEach((result: LabResult) => {
        const key = result.component_code || result.component_name;
        
        if (!history[key]) {
          history[key] = {
            component_name: result.component_name,
            component_code: result.component_code,
            unit: result.unit,
            results: [],
          };

          // Parse reference range if available
          if (result.reference_range) {
            const match = result.reference_range.match(/([\d.]+)\s*-\s*([\d.]+)/);
            if (match) {
              history[key].reference_range_min = parseFloat(match[1]);
              history[key].reference_range_max = parseFloat(match[2]);
            }
          }
        }

        const numericValue = parseFloat(result.value);
        if (!isNaN(numericValue)) {
          history[key].results.push({
            date: result.result_date || result.created_at,
            value: numericValue,
            flag: result.flag || 'normal',
            reference_range: result.reference_range,
          });
        }
      });

      // Sort results by date and calculate trends
      Object.keys(history).forEach((key) => {
        history[key].results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (history[key].results.length >= 2) {
          const latest = history[key].results[history[key].results.length - 1];
          const previous = history[key].results[history[key].results.length - 2];

          history[key].latest_value = latest.value;
          history[key].previous_value = previous.value;

          const diff = latest.value - previous.value;
          const percentChange = (diff / previous.value) * 100;
          history[key].change_percent = percentChange;

          if (Math.abs(percentChange) < 5) {
            history[key].trend = 'stable';
          } else if (percentChange > 0) {
            history[key].trend = 'up';
          } else {
            history[key].trend = 'down';
          }
        }
      });

      setComponentHistory(history);

      // Auto-select first component if none selected
      if (!selectedComponent && Object.keys(history).length > 0) {
        setSelectedComponent(Object.keys(history)[0]);
      }
    } catch (error) {
      console.error('Failed to load lab results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-red-600" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-blue-600" />;
    return <Minus className="w-4 h-4 text-gray-600" />;
  };

  const getTrendColor = (trend?: string) => {
    if (trend === 'up') return 'text-red-600';
    if (trend === 'down') return 'text-blue-600';
    return 'text-gray-600';
  };

  const getFlagBadge = (flag: string) => {
    const styles = {
      low: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
      normal: 'bg-green-100 text-green-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[flag as keyof typeof styles] || styles.normal}`}>
        {flag}
      </span>
    );
  };

  const selectedHistory = selectedComponent ? componentHistory[selectedComponent] : null;

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Lab Result Trends & Comparison</h3>
        
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-gray-600" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last year</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      )}

      {!loading && Object.keys(componentHistory).length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No lab results found for this patient</p>
        </div>
      )}

      {!loading && Object.keys(componentHistory).length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Component List */}
          <div className="lg:col-span-1">
            <h4 className="font-semibold text-gray-900 mb-3">Test Components</h4>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {Object.entries(componentHistory).map(([key, component]) => (
                <button
                  key={key}
                  onClick={() => setSelectedComponent(key)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedComponent === key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{component.component_name}</span>
                    {component.trend && getTrendIcon(component.trend)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {component.results.length} result(s)
                  </div>
                  {component.change_percent !== undefined && (
                    <div className={`text-xs font-medium mt-1 ${getTrendColor(component.trend)}`}>
                      {component.change_percent > 0 ? '+' : ''}
                      {component.change_percent.toFixed(1)}% change
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Trend Chart & Comparison */}
          {selectedHistory && (
            <div className="lg:col-span-2 space-y-6">
              {/* Current vs Previous Comparison */}
              {selectedHistory.latest_value !== undefined && selectedHistory.previous_value !== undefined && (
                <div className="bg-white rounded-lg shadow-md p-6 border-2 border-blue-200">
                  <h4 className="font-semibold text-gray-900 mb-4">Latest Comparison</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Previous</p>
                      <p className="text-3xl font-bold text-gray-700">
                        {selectedHistory.previous_value.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">{selectedHistory.unit}</p>
                    </div>

                    <div className="text-center p-4 bg-blue-50 rounded-lg border-2 border-blue-500">
                      <p className="text-sm text-blue-600 mb-1">Latest</p>
                      <p className="text-3xl font-bold text-blue-700">
                        {selectedHistory.latest_value.toFixed(2)}
                      </p>
                      <p className="text-sm text-blue-600 mt-1">{selectedHistory.unit}</p>
                    </div>
                  </div>

                  {/* Delta Indicator */}
                  <div className="mt-4 flex items-center justify-center space-x-3">
                    <div className={`flex items-center space-x-2 ${getTrendColor(selectedHistory.trend)}`}>
                      {getTrendIcon(selectedHistory.trend)}
                      <span className="font-bold text-lg">
                        {selectedHistory.change_percent && selectedHistory.change_percent > 0 ? '+' : ''}
                        {selectedHistory.change_percent?.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Clinical Significance */}
                  {selectedHistory.change_percent && Math.abs(selectedHistory.change_percent) > 20 && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-900">Significant Change Detected</p>
                        <p className="text-sm text-yellow-800">
                          Result changed by {Math.abs(selectedHistory.change_percent).toFixed(1)}% - Consider clinical correlation
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trend Graph */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h4 className="font-semibold text-gray-900 mb-4">
                  {selectedHistory.component_name} Trend
                </h4>

                {selectedHistory.results.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={selectedHistory.results.map((r) => ({
                        date: formatDateToDDMMYYYY(r.date),
                        value: r.value,
                        flag: r.flag,
                      }))}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={['auto', 'auto']} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
                                <p className="font-medium">{payload[0].payload.date}</p>
                                <p className="text-lg font-bold text-blue-600">
                                  {payload[0].value} {selectedHistory.unit}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {getFlagBadge(payload[0].payload.flag)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />

                      {/* Reference Range Lines */}
                      {selectedHistory.reference_range_min !== undefined && (
                        <ReferenceLine
                          y={selectedHistory.reference_range_min}
                          stroke="#10b981"
                          strokeDasharray="5 5"
                          label={{ value: 'Min', position: 'right' }}
                        />
                      )}
                      {selectedHistory.reference_range_max !== undefined && (
                        <ReferenceLine
                          y={selectedHistory.reference_range_max}
                          stroke="#10b981"
                          strokeDasharray="5 5"
                          label={{ value: 'Max', position: 'right' }}
                        />
                      )}

                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          let fill = '#3b82f6';
                          if (payload.flag === 'critical') fill = '#dc2626';
                          else if (payload.flag === 'high' || payload.flag === 'low') fill = '#f59e0b';
                          else if (payload.flag === 'normal') fill = '#10b981';

                          return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#fff" strokeWidth={2} />;
                        }}
                        name={`${selectedHistory.component_name} (${selectedHistory.unit})`}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>Need at least 2 results to show trend</p>
                  </div>
                )}
              </div>

              {/* Historical Results Table */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Historical Results</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-2 px-3">Date</th>
                        <th className="text-right py-2 px-3">Value</th>
                        <th className="text-left py-2 px-3">Unit</th>
                        <th className="text-left py-2 px-3">Reference Range</th>
                        <th className="text-center py-2 px-3">Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedHistory.results.slice().reverse().map((result, index) => (
                        <tr
                          key={index}
                          className={`border-b border-gray-100 ${
                            index === 0 ? 'bg-blue-50 font-medium' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="py-3 px-3">
                            {formatDateToDDMMYYYY(result.date)}
                            {index === 0 && (
                              <span className="ml-2 text-xs text-blue-600 font-bold">LATEST</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-lg">
                            {result.value.toFixed(2)}
                          </td>
                          <td className="py-3 px-3">{selectedHistory.unit}</td>
                          <td className="py-3 px-3 text-gray-600">{result.reference_range || 'N/A'}</td>
                          <td className="py-3 px-3 text-center">
                            {getFlagBadge(result.flag)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reference Range Info */}
              {(selectedHistory.reference_range_min || selectedHistory.reference_range_max) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-900">Normal Reference Range</p>
                  <p className="text-lg font-bold text-green-700">
                    {selectedHistory.reference_range_min?.toFixed(2)} - {selectedHistory.reference_range_max?.toFixed(2)}{' '}
                    {selectedHistory.unit}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

