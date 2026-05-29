import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface FamilyMember {
  id: string;
  first_name: string;
  last_name: string;
  relationship: string;
  latest_risk_level: string;
  latest_diagnosis?: string;
}

interface HouseholdAlert {
  id: string;
  alert_type: string;
  condition_name: string;
  message: string;
  severity: string;
  created_at: string;
}

const RISK_CLASSES: Record<string, string> = {
  low:      'text-green-700 bg-green-100',
  medium:   'text-amber-700 bg-amber-100',
  high:     'text-red-700 bg-red-100',
  critical: 'text-purple-700 bg-purple-100',
};

export function FamilyHouseholdPanel({ patientId }: { patientId: string }) {
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [alerts, setAlerts] = useState<HouseholdAlert[]>([]);

  useEffect(() => {
    api.get(`/household/patients/${patientId}/family`).then((r: any) => setFamily(r.data ?? r)).catch(() => {});
    api.get(`/household/patients/${patientId}/alerts`).then((r: any) => setAlerts(r.data ?? r)).catch(() => {});
  }, [patientId]);

  async function resolveAlert(id: string) {
    await api.patch(`/household/alerts/${id}/resolve`, {});
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  if (family.length === 0 && alerts.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow p-4 mb-4">
      <h4 className="font-bold text-gray-800 text-sm mb-3">Family & Household</h4>

      {alerts.length > 0 && (
        <div className="mb-3">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`flex items-start justify-between text-xs px-3 py-2 rounded-lg mb-1 ${
                a.severity === 'urgent' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
              }`}
            >
              <span className={a.severity === 'urgent' ? 'text-red-700' : 'text-amber-700'}>
                ⚠ {a.message}
              </span>
              <button
                onClick={() => resolveAlert(a.id)}
                className="ml-2 underline opacity-60 hover:opacity-100 shrink-0"
              >
                Resolve
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="divide-y">
        {family.map((m) => (
          <div key={m.id} className="py-2 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-800">
                {m.first_name} {m.last_name}
              </span>
              <span className="text-xs text-gray-400 ml-2 capitalize">({m.relationship})</span>
              {m.latest_diagnosis && (
                <div className="text-xs text-gray-400">{m.latest_diagnosis}</div>
              )}
            </div>
            {m.latest_risk_level && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_CLASSES[m.latest_risk_level] ?? 'bg-gray-100 text-gray-600'}`}>
                {m.latest_risk_level}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
