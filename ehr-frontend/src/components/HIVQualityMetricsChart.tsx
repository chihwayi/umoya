import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';
import { CheckCircle, AlertTriangle, Clock, Zap, TrendingUp, TrendingDown } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface QualityMetrics {
  vlSuppression?: {
    total: number;
    suppressed: number;
    suppressedRate: number;
    undetectable: number;
    undetectableRate: number;
  };
  patientsOnART?: {
    total: number;
    onART: number;
    onARTRate: number;
  };
  treatmentFailure?: {
    total: number;
    failures: number;
    failureRate: number;
  };
  ltfu?: {
    total: number;
    ltfu: number;
    ltfuRate: number;
  };
  timeToSuppression?: {
    averageDays: number;
    medianDays: number;
    sampleSize: number;
  };
}

interface HIVQualityMetricsChartProps {
  metrics: QualityMetrics;
}

const HIVQualityMetricsChart: React.FC<HIVQualityMetricsChartProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        <p className="text-slate-600">No quality metrics data available</p>
      </div>
    );
  }

  // Viral Load Suppression Chart (Doughnut)
  const vlSuppressionData = {
    labels: ['Suppressed (<1000)', 'Undetectable (<50)', 'Not Suppressed'],
    datasets: [{
      data: [
        (metrics.vlSuppression?.suppressed || 0) - (metrics.vlSuppression?.undetectable || 0),
        metrics.vlSuppression?.undetectable || 0,
        (metrics.vlSuppression?.total || 0) - (metrics.vlSuppression?.suppressed || 0)
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)', // Green for suppressed
        'rgba(16, 185, 129, 0.8)', // Emerald for undetectable
        'rgba(239, 68, 68, 0.8)'   // Red for not suppressed
      ],
      borderColor: [
        'rgba(34, 197, 94, 1)',
        'rgba(16, 185, 129, 1)',
        'rgba(239, 68, 68, 1)'
      ],
      borderWidth: 2
    }]
  };

  // Patients on ART Chart (Bar)
  const artData = {
    labels: ['On ART', 'Not on ART'],
    datasets: [{
      label: 'Patients',
      data: [
        metrics.patientsOnART?.onART || 0,
        (metrics.patientsOnART?.total || 0) - (metrics.patientsOnART?.onART || 0)
      ],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)', // Blue
        'rgba(148, 163, 184, 0.8)'  // Gray
      ],
      borderColor: [
        'rgba(59, 130, 246, 1)',
        'rgba(148, 163, 184, 1)'
      ],
      borderWidth: 2,
      borderRadius: 8
    }]
  };

  // Quality Indicators Bar Chart
  const qualityIndicatorsData = {
    labels: ['VL Suppression', 'On ART', 'Treatment Failure', 'LTFU'],
    datasets: [{
      label: 'Percentage (%)',
      data: [
        metrics.vlSuppression?.suppressedRate || 0,
        metrics.patientsOnART?.onARTRate || 0,
        metrics.treatmentFailure?.failureRate || 0,
        metrics.ltfu?.ltfuRate || 0
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',   // Green for suppression
        'rgba(59, 130, 246, 0.8)',   // Blue for ART
        'rgba(239, 68, 68, 0.8)',    // Red for failure
        'rgba(249, 115, 22, 0.8)'    // Orange for LTFU
      ],
      borderColor: [
        'rgba(34, 197, 94, 1)',
        'rgba(59, 130, 246, 1)',
        'rgba(239, 68, 68, 1)',
        'rgba(249, 115, 22, 1)'
      ],
      borderWidth: 2,
      borderRadius: 8
    }]
  };

  // Treatment Outcomes Comparison
  const outcomesData = {
    labels: ['Suppressed', 'Failures', 'LTFU'],
    datasets: [{
      label: 'Number of Patients',
      data: [
        metrics.vlSuppression?.suppressed || 0,
        metrics.treatmentFailure?.failures || 0,
        metrics.ltfu?.ltfu || 0
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(249, 115, 22, 0.8)'
      ],
      borderColor: [
        'rgba(34, 197, 94, 1)',
        'rgba(239, 68, 68, 1)',
        'rgba(249, 115, 22, 1)'
      ],
      borderWidth: 2,
      borderRadius: 8
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          font: {
            size: 12,
            weight: '500' as const
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold' as const
        },
        bodyFont: {
          size: 13
        },
        cornerRadius: 8
      }
    }
  };

  const barChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + '%';
          },
          font: {
            size: 11
          }
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11
          }
        }
      }
    }
  };

  const doughnutOptions = {
    ...chartOptions,
    cutout: '65%',
    plugins: {
      ...chartOptions.plugins,
      legend: {
        ...chartOptions.plugins.legend,
        position: 'bottom' as const
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Viral Load Suppression - Doughnut Chart */}
      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border border-emerald-200 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-900">Viral Load Suppression</h3>
              <p className="text-sm text-emerald-700">Suppression rate and undetectable status</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-emerald-700">
              {metrics.vlSuppression?.suppressedRate?.toFixed(1) || 0}%
            </p>
            <p className="text-sm text-emerald-600">Suppressed</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="h-64">
              <Doughnut data={vlSuppressionData} options={doughnutOptions} />
            </div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-md space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <p className="text-sm text-emerald-700 mb-1">Total Tested</p>
                <p className="text-3xl font-bold text-emerald-900">{metrics.vlSuppression?.total || 0}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-green-700 mb-1">Suppressed</p>
                <p className="text-3xl font-bold text-green-900">
                  {metrics.vlSuppression?.suppressed || 0}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {metrics.vlSuppression?.suppressedRate?.toFixed(1)}%
                </p>
              </div>
              <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                <p className="text-sm text-teal-700 mb-1">Undetectable</p>
                <p className="text-3xl font-bold text-teal-900">
                  {metrics.vlSuppression?.undetectable || 0}
                </p>
                <p className="text-xs text-teal-600 mt-1">
                  {metrics.vlSuppression?.undetectableRate?.toFixed(1)}%
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-sm text-red-700 mb-1">Not Suppressed</p>
                <p className="text-3xl font-bold text-red-900">
                  {(metrics.vlSuppression?.total || 0) - (metrics.vlSuppression?.suppressed || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quality Indicators - Bar Chart */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-slate-700 p-3 rounded-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Key Quality Indicators</h3>
            <p className="text-sm text-slate-600">Performance metrics at a glance</p>
          </div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="h-80">
            <Bar data={qualityIndicatorsData} options={barChartOptions} />
          </div>
        </div>
      </div>

      {/* Patients on ART & Treatment Outcomes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patients on ART */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-3 rounded-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-900">Patients on ART</h3>
                <p className="text-sm text-blue-700">
                  {metrics.patientsOnART?.onARTRate?.toFixed(1) || 0}% coverage
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="h-64 mb-4">
              <Bar 
                data={artData} 
                options={{
                  ...chartOptions,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        font: { size: 11 }
                      },
                      grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                      }
                    },
                    x: {
                      grid: { display: false },
                      ticks: {
                        font: { size: 11 }
                      }
                    }
                  }
                }} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div>
                <p className="text-sm text-slate-600">Total Enrollments</p>
                <p className="text-2xl font-bold text-slate-900">{metrics.patientsOnART?.total || 0}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">On ART</p>
                <p className="text-2xl font-bold text-blue-600">{metrics.patientsOnART?.onART || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Treatment Outcomes */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-600 p-3 rounded-lg">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-purple-900">Treatment Outcomes</h3>
                <p className="text-sm text-purple-700">Patient status comparison</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="h-64 mb-4">
              <Bar 
                data={outcomesData} 
                options={{
                  ...chartOptions,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        font: { size: 11 }
                      },
                      grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                      }
                    },
                    x: {
                      grid: { display: false },
                      ticks: {
                        font: { size: 11 }
                      }
                    }
                  }
                }} 
              />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-200">
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Suppressed</p>
                <p className="text-xl font-bold text-emerald-600">
                  {metrics.vlSuppression?.suppressed || 0}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">Failures</p>
                <p className="text-xl font-bold text-red-600">
                  {metrics.treatmentFailure?.failures || 0}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-600 mb-1">LTFU</p>
                <p className="text-xl font-bold text-orange-600">
                  {metrics.ltfu?.ltfu || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Treatment Failure Rate - Pie Chart */}
      <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-3 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-red-900">Treatment Failure Rate</h3>
              <p className="text-sm text-red-700">Patients experiencing treatment failure</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-red-700">
              {metrics.treatmentFailure?.failureRate?.toFixed(1) || 0}%
            </p>
            <p className="text-sm text-red-600">Failure Rate</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="h-80">
              <Pie 
                data={{
                  labels: ['Successful Treatment', 'Treatment Failures'],
                  datasets: [{
                    data: [
                      (metrics.treatmentFailure?.total || 0) - (metrics.treatmentFailure?.failures || 0),
                      metrics.treatmentFailure?.failures || 0
                    ],
                    backgroundColor: [
                      'rgba(34, 197, 94, 0.8)', // Green for success
                      'rgba(239, 68, 68, 0.8)'   // Red for failures
                    ],
                    borderColor: [
                      'rgba(34, 197, 94, 1)',
                      'rgba(239, 68, 68, 1)'
                    ],
                    borderWidth: 3,
                    hoverOffset: 10
                  }]
                }}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      ...chartOptions.plugins.legend,
                      position: 'bottom' as const
                    },
                    tooltip: {
                      ...chartOptions.plugins.tooltip,
                      callbacks: {
                        label: function(context: any) {
                          const label = context.label || '';
                          const value = context.parsed || 0;
                          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                          return `${label}: ${value} patients (${percentage}%)`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-md space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <p className="text-sm text-emerald-700 mb-1">Successful</p>
                <p className="text-3xl font-bold text-emerald-900">
                  {(metrics.treatmentFailure?.total || 0) - (metrics.treatmentFailure?.failures || 0)}
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  {metrics.treatmentFailure?.total ? 
                    (((metrics.treatmentFailure.total - (metrics.treatmentFailure.failures || 0)) / metrics.treatmentFailure.total) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-sm text-red-700 mb-1">Failures</p>
                <p className="text-3xl font-bold text-red-600">
                  {metrics.treatmentFailure?.failures || 0}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {metrics.treatmentFailure?.failureRate?.toFixed(1) || 0}%
                </p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-sm text-slate-600 mb-1">Total Patients on ART</p>
              <p className="text-2xl font-bold text-slate-900">
                {metrics.treatmentFailure?.total || 0}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <p className="text-xs text-amber-700 mb-2">⚠️ Treatment Failure Definition</p>
              <p className="text-sm text-amber-900">
                Patients with confirmed high viral load (&gt;1000 copies/mL) after 6+ months on ART, 
                or VL rebound after suppression, indicating need for regimen change.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* LTFU Rate - Line Chart & Pie Chart Combo */}
      <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-orange-900">Lost to Follow-Up Rate</h3>
              <p className="text-sm text-orange-700">Patients not seen in scheduled timeframes</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-orange-700">
              {metrics.ltfu?.ltfuRate?.toFixed(1) || 0}%
            </p>
            <p className="text-sm text-orange-600">LTFU Rate</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="h-80">
              <Pie 
                data={{
                  labels: ['Active in Care', 'Lost to Follow-Up'],
                  datasets: [{
                    data: [
                      (metrics.ltfu?.total || 0) - (metrics.ltfu?.ltfu || 0),
                      metrics.ltfu?.ltfu || 0
                    ],
                    backgroundColor: [
                      'rgba(59, 130, 246, 0.8)', // Blue for active
                      'rgba(249, 115, 22, 0.8)'   // Orange for LTFU
                    ],
                    borderColor: [
                      'rgba(59, 130, 246, 1)',
                      'rgba(249, 115, 22, 1)'
                    ],
                    borderWidth: 3,
                    hoverOffset: 10
                  }]
                }}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      ...chartOptions.plugins.legend,
                      position: 'bottom' as const
                    },
                    tooltip: {
                      ...chartOptions.plugins.tooltip,
                      callbacks: {
                        label: function(context: any) {
                          const label = context.label || '';
                          const value = context.parsed || 0;
                          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                          return `${label}: ${value} patients (${percentage}%)`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-md space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-700 mb-1">Active in Care</p>
                <p className="text-3xl font-bold text-blue-900">
                  {(metrics.ltfu?.total || 0) - (metrics.ltfu?.ltfu || 0)}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {metrics.ltfu?.total ? 
                    (((metrics.ltfu.total - (metrics.ltfu.ltfu || 0)) / metrics.ltfu.total) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <p className="text-sm text-orange-700 mb-1">Lost to Follow-Up</p>
                <p className="text-3xl font-bold text-orange-600">
                  {metrics.ltfu?.ltfu || 0}
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  {metrics.ltfu?.ltfuRate?.toFixed(1) || 0}%
                </p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-sm text-slate-600 mb-1">Total Enrollments</p>
              <p className="text-2xl font-bold text-slate-900">
                {metrics.ltfu?.total || 0}
              </p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <p className="text-xs text-red-700 mb-2">⚠️ LTFU Definition</p>
              <p className="text-sm text-red-900">
                Patients who have not returned for scheduled visits or have been lost to follow-up 
                for extended periods, requiring active tracking and outreach efforts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Time to Suppression */}
      {metrics.timeToSuppression && metrics.timeToSuppression.sampleSize > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-6 border border-indigo-200 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-600 p-3 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-indigo-900">Time to Viral Suppression</h3>
              <p className="text-sm text-indigo-700">Average days to achieve suppression</p>
            </div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-2">Average Days</p>
                <p className="text-4xl font-bold text-indigo-600">
                  {Math.round(metrics.timeToSuppression.averageDays)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Mean time</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-2">Median Days</p>
                <p className="text-4xl font-bold text-indigo-600">
                  {Math.round(metrics.timeToSuppression.medianDays)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Middle value</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-2">Sample Size</p>
                <p className="text-4xl font-bold text-indigo-600">
                  {metrics.timeToSuppression.sampleSize}
                </p>
                <p className="text-xs text-slate-500 mt-1">Patients analyzed</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HIVQualityMetricsChart;

