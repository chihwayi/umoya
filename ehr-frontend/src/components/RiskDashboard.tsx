import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface RiskPatient {
  id: string;
  first_name: string;
  last_name: string;
  latest_risk_score: number;
  latest_risk_level: string;
  risk_updated_at: string;
}

interface OutreachTask {
  id: string;
  patient_name: string;
  risk_score: number;
  due_at: string;
}

const LEVEL_CLASSES: Record<string, string> = {
  low:      'bg-green-100 text-green-700',
  medium:   'bg-amber-100 text-amber-700',
  high:     'bg-red-100 text-red-700',
  critical: 'bg-purple-100 text-purple-800',
};

export function RiskDashboard() {
  const [highRisk, setHighRisk] = useState<RiskPatient[]>([]);
  const [tasks, setTasks] = useState<OutreachTask[]>([]);

  useEffect(() => {
    api.get('/risk/patients/high-risk').then((r: any) => setHighRisk(r.data ?? r));
    api.get('/risk/outreach-tasks').then((r: any) => setTasks(r.data ?? r));
  }, []);

  async function completeTask(id: string) {
    await api.patch(`/risk/outreach-tasks/${id}/complete`, {});
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="grid grid-cols-2 gap-6 p-4">
      {/* High-risk patients */}
      <div className="bg-white rounded-xl shadow p-4">
        <h4 className="font-bold text-gray-800 mb-3 text-sm">
          High-Risk Patients
          <span className="ml-2 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{highRisk.length}</span>
        </h4>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 border-b">
              <th className="pb-1">Patient</th>
              <th className="pb-1">Score</th>
              <th className="pb-1">Level</th>
              <th className="pb-1">Updated</th>
            </tr>
          </thead>
          <tbody>
            {highRisk.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-1.5">
                  <a href={`/patients/${p.id}`} className="text-blue-600 hover:underline">
                    {p.first_name} {p.last_name}
                  </a>
                </td>
                <td className="py-1.5 font-semibold">{p.latest_risk_score}</td>
                <td className="py-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_CLASSES[p.latest_risk_level] ?? 'bg-gray-100 text-gray-600'}`}>
                    {p.latest_risk_level}
                  </span>
                </td>
                <td className="py-1.5 text-gray-400">
                  {new Date(p.risk_updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {highRisk.length === 0 && (
              <tr><td colSpan={4} className="text-gray-400 py-4 text-center">No high-risk patients</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Outreach tasks */}
      <div className="bg-white rounded-xl shadow p-4">
        <h4 className="font-bold text-gray-800 mb-3 text-sm">
          Outreach Tasks
          <span className="ml-2 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{tasks.length}</span>
        </h4>
        <div className="flex flex-col gap-2">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
              <div>
                <div className="text-sm font-semibold text-gray-800">{t.patient_name}</div>
                <div className="text-xs text-gray-400">Risk score: {t.risk_score} · Due {new Date(t.due_at).toLocaleDateString()}</div>
              </div>
              <button
                onClick={() => completeTask(t.id)}
                className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Mark Done
              </button>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No open outreach tasks</p>
          )}
        </div>
      </div>
    </div>
  );
}
