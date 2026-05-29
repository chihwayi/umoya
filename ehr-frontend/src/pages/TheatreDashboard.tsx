import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface TheatreCase {
  id: string;
  room_name: string;
  patient_name: string;
  surgeon_name: string;
  procedure_name: string;
  planned_start: string;
  planned_end: string;
  actual_start?: string;
  actual_end?: string;
  status: string;
  cancellation_reason?: string;
}

interface Metrics {
  utilization_pct: number;
  on_time_start_pct: number;
  avg_turnover_mins: number;
  cancellation_rate_pct: number;
  total_cases: number;
  cancelled_cases: number;
  completed_cases: number;
}

const STATUS_CLASSES: Record<string, string> = {
  scheduled:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
};

function fmt(ts?: string) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function TheatreDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const [cases, setCases] = useState<TheatreCase[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    api.get(`/theatre/cases?date=${today}`).then((r: any) => setCases(r.data ?? r));
    api.get(`/theatre/metrics?date=${today}`).then((r: any) => setMetrics(r.data ?? r));
  }, [today]);

  const rooms = [...new Set(cases.map((c) => c.room_name))].sort();

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Theatre Dashboard — {today}</h2>

      {/* KPI row */}
      {metrics && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Utilisation', value: `${metrics.utilization_pct}%` },
            { label: 'On-Time Starts', value: `${metrics.on_time_start_pct}%` },
            { label: 'Avg Turnover', value: `${metrics.avg_turnover_mins}m` },
            { label: 'Cancellations', value: `${metrics.cancelled_cases} / ${metrics.total_cases}` },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl shadow p-4 text-center">
              <div className="text-2xl font-bold text-gray-800">{kpi.value}</div>
              <div className="text-xs text-gray-400 mt-1">{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Gantt-style room grid */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left py-2 px-4 text-gray-500 font-medium w-28">Room</th>
              <th className="text-left py-2 px-4 text-gray-500 font-medium">Patient</th>
              <th className="text-left py-2 px-4 text-gray-500 font-medium">Procedure</th>
              <th className="text-left py-2 px-4 text-gray-500 font-medium">Surgeon</th>
              <th className="text-left py-2 px-4 text-gray-500 font-medium">Planned</th>
              <th className="text-left py-2 px-4 text-gray-500 font-medium">Actual</th>
              <th className="text-left py-2 px-4 text-gray-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) =>
              cases
                .filter((c) => c.room_name === room)
                .map((c, i) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    {i === 0 && (
                      <td
                        rowSpan={cases.filter((x) => x.room_name === room).length}
                        className="py-2 px-4 font-semibold text-gray-700 border-r align-top"
                      >
                        {room}
                      </td>
                    )}
                    <td className="py-2 px-4">{c.patient_name}</td>
                    <td className="py-2 px-4 max-w-xs truncate">{c.procedure_name}</td>
                    <td className="py-2 px-4">{c.surgeon_name}</td>
                    <td className="py-2 px-4 text-gray-500">{fmt(c.planned_start)} – {fmt(c.planned_end)}</td>
                    <td className="py-2 px-4 text-gray-500">{fmt(c.actual_start)} – {fmt(c.actual_end)}</td>
                    <td className="py-2 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                )),
            )}
            {cases.length === 0 && (
              <tr><td colSpan={7} className="text-center text-gray-400 py-6">No cases scheduled today</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
