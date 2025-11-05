import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Download, RefreshCw, Calendar } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface HIVComparisonReportsProps {
  tenantSlug: string;
}

const HIVComparisonReports: React.FC<HIVComparisonReportsProps> = ({ tenantSlug }) => {
  const { showSuccess, showError } = useNotification();
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [comparisonType, setComparisonType] = useState<'time_period' | 'facility'>('time_period');
  const [period1, setPeriod1] = useState({ start: '', end: '' });
  const [period2, setPeriod2] = useState({ start: '', end: '' });

  useEffect(() => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);

    setPeriod1({
      start: threeMonthsAgo.toISOString().split('T')[0],
      end: twoMonthsAgo.toISOString().split('T')[0]
    });
    setPeriod2({
      start: twoMonthsAgo.toISOString().split('T')[0],
      end: lastMonth.toISOString().split('T')[0]
    });
  }, []);

  const loadComparisonData = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      setLoading(true);
      const params: any = {
        type: comparisonType,
        period1Start: period1.start,
        period1End: period1.end,
        period2Start: period2.start,
        period2End: period2.end
      };

      const response = await ehrApi.getComparisonReport(params, token, tenantSlug);
      setComparisonData(response.data);
    } catch (error) {
      console.error('Failed to load comparison data:', error);
      showError('Error', 'Failed to load comparison report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period1.start && period1.end && period2.start && period2.end) {
      loadComparisonData();
    }
  }, [comparisonType]);

  const getComparisonChartData = () => {
    if (!comparisonData) return null;

    const metrics = ['vlSuppressionRate', 'retentionRate', 'artCoverage', 'ltfuRate'];
    const labels = metrics.map(m => m.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()));

    return {
      labels,
      datasets: [
        {
          label: comparisonData.period1Label || 'Period 1',
          data: [
            comparisonData.period1?.vlSuppressionRate || 0,
            comparisonData.period1?.retentionRate || 0,
            comparisonData.period1?.artCoverage || 0,
            comparisonData.period1?.ltfuRate || 0
          ],
          backgroundColor: 'rgba(16, 185, 129, 0.8)'
        },
        {
          label: comparisonData.period2Label || 'Period 2',
          data: [
            comparisonData.period2?.vlSuppressionRate || 0,
            comparisonData.period2?.retentionRate || 0,
            comparisonData.period2?.artCoverage || 0,
            comparisonData.period2?.ltfuRate || 0
          ],
          backgroundColor: 'rgba(59, 130, 246, 0.8)'
        }
      ]
    };
  };

  const getTrendChartData = () => {
    if (!comparisonData?.trends) return null;

    const trends = comparisonData.trends;
    const labels = trends.map((t: any) => t.period);
    const period1Data = trends.map((t: any) => t.period1Value || 0);
    const period2Data = trends.map((t: any) => t.period2Value || 0);

    return {
      labels,
      datasets: [
        {
          label: comparisonData.period1Label || 'Period 1',
          data: period1Data,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: comparisonData.period2Label || 'Period 2',
          data: period2Data,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Performance Comparison'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + '%';
          }
        }
      }
    }
  };

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Trend Comparison Over Time'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return value + '%';
          }
        }
      }
    }
  };

  const calculateChange = (val1: number, val2: number) => {
    if (!val1 || val1 === 0) return { value: 0, isPositive: val2 > 0 };
    const change = ((val2 - val1) / val1) * 100;
    return { value: Math.abs(change), isPositive: change > 0 };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-emerald-600" />
            Comparison Reports
          </h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={comparisonType}
              onChange={(e) => setComparisonType(e.target.value as any)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
            >
              <option value="time_period">Time Period Comparison</option>
              <option value="facility">Facility Comparison</option>
            </select>
            <button
              onClick={loadComparisonData}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Period Selection */}
        {comparisonType === 'time_period' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Period 1</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={period1.start}
                  onChange={(e) => setPeriod1({ ...period1, start: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={period1.end}
                  onChange={(e) => setPeriod1({ ...period1, end: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Period 2</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={period2.start}
                  onChange={(e) => setPeriod2({ ...period2, start: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={period2.end}
                  onChange={(e) => setPeriod2({ ...period2, end: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading comparison data...</p>
        </div>
      ) : !comparisonData ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No Comparison Data Available</h3>
          <p className="text-slate-500">Select periods and click refresh to generate comparison report</p>
        </div>
      ) : (
        <>
          {/* Key Metrics Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'vlSuppressionRate', label: 'VL Suppression Rate', icon: TrendingUp },
              { key: 'retentionRate', label: 'Retention Rate', icon: TrendingUp },
              { key: 'artCoverage', label: 'ART Coverage', icon: BarChart3 },
              { key: 'ltfuRate', label: 'LTFU Rate', icon: TrendingDown }
            ].map((metric) => {
              const period1Value = comparisonData.period1?.[metric.key] || 0;
              const period2Value = comparisonData.period2?.[metric.key] || 0;
              const change = calculateChange(period1Value, period2Value);
              const Icon = metric.icon;
              
              return (
                <div key={metric.key} className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">{metric.label}</span>
                    <Icon className={`w-5 h-5 ${change.isPositive ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <p className="text-2xl font-bold text-slate-900">{period2Value.toFixed(1)}%</p>
                    <span className={`text-sm font-semibold ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {change.isPositive ? '+' : '-'}{change.value.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Previous: {period1Value.toFixed(1)}%</p>
                </div>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Performance Comparison</h3>
              <div className="h-64">
                {getComparisonChartData() && (
                  <Bar data={getComparisonChartData()!} options={chartOptions} />
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Trend Comparison</h3>
              <div className="h-64">
                {getTrendChartData() && (
                  <Line data={getTrendChartData()!} options={trendChartOptions} />
                )}
              </div>
            </div>
          </div>

          {/* Detailed Comparison Table */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 overflow-x-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Detailed Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Metric</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                      {comparisonData.period1Label || 'Period 1'}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                      {comparisonData.period2Label || 'Period 2'}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Change</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">% Change</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'vlSuppressionRate', label: 'VL Suppression Rate' },
                    { key: 'retentionRate', label: 'Retention Rate' },
                    { key: 'artCoverage', label: 'ART Coverage' },
                    { key: 'ltfuRate', label: 'LTFU Rate' },
                    { key: 'totalPatients', label: 'Total Patients' },
                    { key: 'onART', label: 'Patients on ART' }
                  ].map((metric) => {
                    const period1Value = comparisonData.period1?.[metric.key] || 0;
                    const period2Value = comparisonData.period2?.[metric.key] || 0;
                    const change = period2Value - period1Value;
                    const percentChange = period1Value !== 0 ? ((change / period1Value) * 100) : 0;

                    return (
                      <tr key={metric.key} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{metric.label}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {typeof period1Value === 'number' && metric.key.includes('Rate') 
                            ? period1Value.toFixed(1) + '%' 
                            : period1Value}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {typeof period2Value === 'number' && metric.key.includes('Rate') 
                            ? period2Value.toFixed(1) + '%' 
                            : period2Value}
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold ${
                          change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          {change > 0 ? '+' : ''}{change.toFixed(1)}
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold ${
                          percentChange > 0 ? 'text-green-600' : percentChange < 0 ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          {percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HIVComparisonReports;

