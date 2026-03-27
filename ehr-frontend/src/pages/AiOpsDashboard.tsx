import React, { useEffect, useState } from 'react';
import { Brain, Activity, ShieldCheck, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ehrAxios } from '../services/api';

interface OpsMetric {
  surface: string;
  metric_date: string;
  total_calls: number;
  abstention_count: number;
  avg_latency_ms: number | null;
  accuracy: number | null;
  fairness_age_parity: number | null;
  fairness_gender_parity: number | null;
  fairness_sdoh_parity: number | null;
}

const SURFACE_LABELS: Record<string, string> = {
  vitals_interpretation: 'Vitals Interpretation',
  denial_prediction: 'Denial Prediction',
  risk_stratification: 'Risk Stratification',
  guidelines_search: 'Guideline Search (RAG)',
  pharmacy_intelligence: 'Pharmacy Intelligence',
  imaging_review: 'Radiology AI Review',
  pdmp_check: 'PDMP Check',
  post_visit_summary: 'Post-Visit Summary',
};

export const AiOpsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<OpsMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ehrAxios.get('/model-monitoring/ai-ops/metrics')
      .then((res: any) => setMetrics(res.data.metrics ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const latestBySurface: Record<string, OpsMetric> = {};
  metrics.forEach((m) => {
    if (!latestBySurface[m.surface] || m.metric_date > latestBySurface[m.surface].metric_date) {
      latestBySurface[m.surface] = m;
    }
  });

  const chartData = Array.from(new Set(metrics.map((m) => m.metric_date))).sort().slice(-30).map((date) => {
    const entry: Record<string, string | number | null> = { date };
    Object.keys(latestBySurface).slice(0, 4).forEach((surface) => {
      const m = metrics.find((x) => x.surface === surface && x.metric_date === date);
      entry[surface] = m?.accuracy != null ? Math.round(m.accuracy * 100) : null;
    });
    return entry;
  });

  const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
  const topSurfaces = Object.keys(latestBySurface).slice(0, 4);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <Brain className="h-6 w-6 animate-pulse mr-2" />
        Loading AI Ops metrics...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Brain className="h-7 w-7 text-purple-600" />
        <h1 className="text-2xl font-bold text-gray-900">AI Ops Dashboard</h1>
        <span className="ml-auto text-sm text-gray-400">Last 30 days</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(latestBySurface).map(([surface, m]) => {
          const abstentionRate = m.total_calls > 0
            ? Math.round((m.abstention_count / m.total_calls) * 100) : 0;
          const accuracy = m.accuracy != null ? Math.round(m.accuracy * 100) : null;
          const fair = [m.fairness_age_parity, m.fairness_gender_parity, m.fairness_sdoh_parity]
            .filter(Boolean) as number[];
          const minFairness = fair.length > 0 ? Math.min(...fair) : null;

          return (
            <div key={surface} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold text-gray-800 text-sm">
                  {SURFACE_LABELS[surface] ?? surface}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Total calls (7d)</p>
                  <p className="font-bold text-gray-900">{m.total_calls.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Abstention rate</p>
                  <p className={`font-bold ${abstentionRate > 20 ? 'text-amber-600' : 'text-gray-900'}`}>
                    {abstentionRate}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Accuracy (30d)</p>
                  <p className={`font-bold ${accuracy === null ? 'text-gray-400' : accuracy >= 80 ? 'text-green-600' : accuracy >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {accuracy !== null ? `${accuracy}%` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Avg latency</p>
                  <p className="font-bold text-gray-900">
                    {m.avg_latency_ms != null ? `${Math.round(m.avg_latency_ms)}ms` : 'N/A'}
                  </p>
                </div>
                {minFairness !== null && (
                  <div className="col-span-2">
                    <p className="text-gray-400 text-xs">Fairness (min parity)</p>
                    <div className="flex items-center gap-1">
                      {minFairness >= 0.80 ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      <span className={`font-bold text-sm ${minFairness >= 0.80 ? 'text-green-600' : 'text-amber-600'}`}>
                        {Math.round(minFairness * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {chartData.length > 0 && (
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Accuracy Trend (Top Surfaces)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend />
              {topSurfaces.map((surface, i) => (
                <Line
                  key={surface}
                  type="monotone"
                  dataKey={surface}
                  name={SURFACE_LABELS[surface] ?? surface}
                  stroke={CHART_COLORS[i]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
