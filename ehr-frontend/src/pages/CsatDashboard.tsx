import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Stats {
  total_surveys: number;
  avg_csat: number;
  avg_nps: number;
  nps_score: number;
  avg_wait: number;
  avg_clinician: number;
  avg_facility: number;
  avg_admin: number;
  promoters: number;
  detractors: number;
}

function Star({ filled }: { filled: boolean }) {
  return <span className={filled ? 'text-amber-400' : 'text-gray-200'}>★</span>;
}

function Stars({ value }: { value: number }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map((s) => <Star key={s} filled={s <= Math.round(value)} />)}
      <span className="text-xs text-gray-500 ml-1">{Number(value ?? 0).toFixed(1)}</span>
    </span>
  );
}

export default function CsatDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    api.get(`/csat/stats?days=${days}`).then((r: any) => setStats(r.data ?? r));
  }, [days]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Patient Satisfaction</h2>
        <select
          value={days}
          onChange={(e) => setDays(+e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-6">
          {/* Overall scores */}
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-bold text-gray-700 mb-4">Overall Scores ({stats.total_surveys} responses)</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Overall CSAT</span>
                <Stars value={stats.avg_csat} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Wait Time</span>
                <Stars value={stats.avg_wait} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Clinician</span>
                <Stars value={stats.avg_clinician} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Facility</span>
                <Stars value={stats.avg_facility} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Admin</span>
                <Stars value={stats.avg_admin} />
              </div>
            </div>
          </div>

          {/* NPS */}
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-bold text-gray-700 mb-4">Net Promoter Score</h3>
            <div className={`text-5xl font-bold mb-2 ${stats.nps_score >= 50 ? 'text-green-600' : stats.nps_score >= 0 ? 'text-amber-500' : 'text-red-600'}`}>
              {stats.nps_score}
            </div>
            <div className="text-xs text-gray-400">
              {stats.promoters} promoters · {stats.detractors} detractors
            </div>
            <div className="mt-3 text-xs text-gray-500">
              {stats.nps_score >= 50 ? '✓ Excellent' : stats.nps_score >= 0 ? '⚠ Needs improvement' : '✗ At risk'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
