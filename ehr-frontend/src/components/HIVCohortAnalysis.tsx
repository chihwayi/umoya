import React, { useState, useEffect } from 'react';
import { Users, Calendar, TrendingUp, BarChart3, Download, RefreshCw } from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface HIVCohortAnalysisProps {
  tenantSlug: string;
}

const HIVCohortAnalysis: React.FC<HIVCohortAnalysisProps> = ({ tenantSlug }) => {
  const { showSuccess, showError } = useNotification();
  const [cohortData, setCohortData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cohortType, setCohortType] = useState<'enrollment' | 'art_start'>('enrollment');
  const [timeRange, setTimeRange] = useState<'6months' | '12months' | '24months' | 'all'>('12months');

  useEffect(() => {
    loadCohortData();
  }, [cohortType, timeRange]);

  const loadCohortData = async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      if (!token) return;

      setLoading(true);
      const response = await ehrApi.getCohortAnalysis(cohortType, timeRange, token, tenantSlug);
      setCohortData(response.data);
    } catch (error) {
      console.error('Failed to load cohort data:', error);
      showError('Error', 'Failed to load cohort analysis');
    } finally {
      setLoading(false);
    }
  };

  const getCohortChartData = () => {
    if (!cohortData?.cohorts) return null;

    const cohorts = cohortData.cohorts;
    const labels = cohorts.map((c: any) => c.cohortPeriod);
    const retentionData = cohorts.map((c: any) => c.retentionRate || 0);
    const vlSuppressionData = cohorts.map((c: any) => c.vlSuppressionRate || 0);

    return {
      labels,
      datasets: [
        {
          label: 'Retention Rate (%)',
          data: retentionData,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'VL Suppression Rate (%)',
          data: vlSuppressionData,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    };
  };

  const getRetentionChartData = () => {
    if (!cohortData?.cohorts) return null;

    const cohorts = cohortData.cohorts;
    const labels = cohorts.map((c: any) => c.cohortPeriod);
    const data = cohorts.map((c: any) => ({
      enrolled: c.totalEnrolled || 0,
      retained: c.totalRetained || 0,
      lost: (c.totalEnrolled || 0) - (c.totalRetained || 0)
    }));

    return {
      labels,
      datasets: [
        {
          label: 'Enrolled',
          data: data.map((d: any) => d.enrolled),
          backgroundColor: 'rgba(16, 185, 129, 0.8)'
        },
        {
          label: 'Retained',
          data: data.map((d: any) => d.retained),
          backgroundColor: 'rgba(59, 130, 246, 0.8)'
        },
        {
          label: 'Lost',
          data: data.map((d: any) => d.lost),
          backgroundColor: 'rgba(239, 68, 68, 0.8)'
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
        text: 'Cohort Analysis Over Time'
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

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Cohort Enrollment & Retention'
      }
    },
    scales: {
      x: {
        stacked: false,
      },
      y: {
        stacked: false,
        beginAtZero: true
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-emerald-600" />
            Cohort Analysis
          </h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={cohortType}
              onChange={(e) => setCohortType(e.target.value as any)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
            >
              <option value="enrollment">Enrollment Cohort</option>
              <option value="art_start">ART Start Cohort</option>
            </select>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
            >
              <option value="6months">Last 6 Months</option>
              <option value="12months">Last 12 Months</option>
              <option value="24months">Last 24 Months</option>
              <option value="all">All Time</option>
            </select>
            <button
              onClick={loadCohortData}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading cohort analysis...</p>
        </div>
      ) : !cohortData ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No Cohort Data Available</h3>
          <p className="text-slate-500">Cohort analysis will be available once patient data is recorded</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Total Cohorts</span>
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{cohortData.totalCohorts || 0}</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Total Patients</span>
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{cohortData.totalPatients || 0}</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Avg Retention Rate</span>
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {cohortData.averageRetentionRate?.toFixed(1) || '0.0'}%
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Avg VL Suppression</span>
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {cohortData.averageVLSuppressionRate?.toFixed(1) || '0.0'}%
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Retention & VL Suppression Trends</h3>
              <div className="h-64">
                {getCohortChartData() && (
                  <Line data={getCohortChartData()!} options={chartOptions} />
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Enrollment & Retention by Cohort</h3>
              <div className="h-64">
                {getRetentionChartData() && (
                  <Bar data={getRetentionChartData()!} options={barChartOptions} />
                )}
              </div>
            </div>
          </div>

          {/* Cohort Details Table */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 overflow-x-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Cohort Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Cohort Period</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Enrolled</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Retained</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Retention Rate</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">VL Suppressed</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">VL Suppression Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {cohortData.cohorts?.map((cohort: any, index: number) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900">{cohort.cohortPeriod}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{cohort.totalEnrolled || 0}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{cohort.totalRetained || 0}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {cohort.retentionRate?.toFixed(1) || '0.0'}%
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{cohort.vlSuppressed || 0}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {cohort.vlSuppressionRate?.toFixed(1) || '0.0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HIVCohortAnalysis;

