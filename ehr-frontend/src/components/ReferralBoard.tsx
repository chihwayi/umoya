import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Referral {
  id: string;
  patient_first_name: string;
  patient_last_name: string;
  specialty: string;
  referred_to_facility_name: string;
  urgency: string;
  status: string;
  appointment_scheduled_date?: string;
  created_at: string;
}

const COLUMNS = [
  { key: 'draft',        label: 'Draft' },
  { key: 'sent',         label: 'Sent' },
  { key: 'acknowledged', label: 'Received' },
  { key: 'scheduled',    label: 'Scheduled' },
  { key: 'completed',    label: 'Completed' },
  { key: 'cancelled',    label: 'Cancelled' },
] as const;

const URGENCY_CLASSES: Record<string, string> = {
  routine:  'text-gray-500',
  urgent:   'text-orange-600',
  emergent: 'text-red-600 font-bold',
};

export function ReferralBoard() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/referrals')
      .then((r: any) => setReferrals(r.data ?? r))
      .finally(() => setLoading(false));
  }, []);

  const byStatus = (s: string) => referrals.filter((r) => r.status === s);

  if (loading) {
    return <div className="text-sm text-gray-400 p-4">Loading referrals…</div>;
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">Referral Tracker</h3>
        <span className="text-xs text-gray-400">{referrals.length} total referrals</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const cards = byStatus(col.key);
          return (
            <div key={col.key} className="flex-shrink-0 w-52">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {col.label}
                </span>
                <span className="bg-gray-100 text-gray-600 text-xs font-medium rounded-full px-2 py-0.5">
                  {cards.length}
                </span>
              </div>

              <div className="flex flex-col gap-2 min-h-16">
                {cards.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
                    onClick={() => window.open(`/referrals/${r.id}`, '_blank')}
                  >
                    <div className="text-sm font-semibold text-gray-800 truncate">
                      {r.patient_first_name} {r.patient_last_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{r.specialty}</div>
                    <div className="text-xs text-gray-400 truncate mt-0.5" title={r.referred_to_facility_name}>
                      → {r.referred_to_facility_name}
                    </div>
                    <div className={`text-xs mt-1 capitalize ${URGENCY_CLASSES[r.urgency] ?? 'text-gray-500'}`}>
                      {r.urgency}
                    </div>
                    {r.appointment_scheduled_date && (
                      <div className="text-xs text-green-600 mt-1">
                        Appt: {new Date(r.appointment_scheduled_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
                {cards.length === 0 && (
                  <div className="text-xs text-gray-300 text-center py-4 border border-dashed border-gray-200 rounded-lg">
                    No referrals
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
