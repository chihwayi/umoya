import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import api from '../services/api';

interface OverdueItem {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string;
  surveillance_type: string;
  due_date: string;
  days_overdue: number;
}

interface RtwPlan {
  id: string;
  injury_illness: string;
  company_name: string;
  status: string;
  target_rtw_date: string | null;
  employer_signed: boolean;
  plan_date: string;
}

const RTW_STATUS_COLUMNS = ['pending', 'active', 'modified', 'completed'];
const RTW_COLORS: Record<string, string> = {
  pending: '#F0954A',
  active: '#0AA98A',
  modified: '#3B9EFF',
  completed: '#1B6B3A',
  withdrawn: '#7A9CBC',
};

export default function OemSurveillanceDashboard() {
  const [overdue, setOverdue] = useState<OverdueItem[]>([]);
  const [rtwPlans, setRtwPlans] = useState<RtwPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/oem/surveillance/overdue'),
    ]).then(([o]) => {
      setOverdue(o.data ?? o);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-[#7A9CBC]">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#080E1A] text-[#E2EDF8] p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans', letterSpacing: '-0.02em' }}>
          OEM Surveillance & RTW
        </h1>
        <p className="text-[#7A9CBC] text-sm mt-1">Exposure surveillance, biological monitoring & return-to-work coordination</p>
      </div>

      {/* Overdue Surveillance */}
      <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-[#E8614D]" />
          <h2 className="text-base font-semibold">Overdue Surveillance</h2>
          {overdue.length > 0 && (
            <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E8614D22] text-[#E8614D]">
              {overdue.length} overdue
            </span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#7A9CBC] text-xs border-b border-[#162440]">
              <th className="text-left py-2">Patient</th>
              <th className="text-left py-2">Employer</th>
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Due Date</th>
              <th className="text-left py-2">Days Overdue</th>
            </tr>
          </thead>
          <tbody>
            {overdue.map(item => (
              <tr key={item.id} className="border-b border-[#162440] hover:bg-[#0C1528]">
                <td className="py-3 font-medium">{item.first_name} {item.last_name}</td>
                <td className="py-3 text-[#7A9CBC]">{item.company_name}</td>
                <td className="py-3 capitalize">{item.surveillance_type.replace(/_/g, ' ')}</td>
                <td className="py-3 text-[#7A9CBC]">{item.due_date}</td>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      background: item.days_overdue > 30 ? '#E8614D22' : '#F0954A22',
                      color: item.days_overdue > 30 ? '#E8614D' : '#F0954A',
                    }}>
                    {item.days_overdue}d
                  </span>
                </td>
              </tr>
            ))}
            {overdue.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#7A9CBC]">
                  <CheckCircle size={20} className="inline mr-2 text-[#0AA98A]" />
                  No overdue surveillance items.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* RTW Board */}
      <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-[#3B9EFF]" />
          <h2 className="text-base font-semibold">Return-to-Work Board</h2>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {RTW_STATUS_COLUMNS.map(status => (
            <div key={status} className="bg-[#0C1528] rounded-[10px] p-3">
              <div className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: RTW_COLORS[status] }}>
                {status}
              </div>
              {rtwPlans.filter(p => p.status === status).map(plan => (
                <div key={plan.id} className="bg-[#111E35] rounded-[8px] p-3 mb-2 border border-[#162440]">
                  <div className="font-medium text-sm mb-1">{plan.injury_illness}</div>
                  <div className="text-xs text-[#7A9CBC]">{plan.company_name}</div>
                  {plan.target_rtw_date && (
                    <div className="text-xs text-[#7A9CBC] mt-1">Target: {plan.target_rtw_date}</div>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    {plan.employer_signed
                      ? <CheckCircle size={12} className="text-[#22C55E]" />
                      : <Clock size={12} className="text-[#7A9CBC]" />
                    }
                    <span className="text-xs" style={{ color: plan.employer_signed ? '#22C55E' : '#7A9CBC' }}>
                      {plan.employer_signed ? 'Signed' : 'Awaiting sign-off'}
                    </span>
                  </div>
                </div>
              ))}
              {rtwPlans.filter(p => p.status === status).length === 0 && (
                <div className="text-xs text-[#7A9CBC] text-center py-4">None</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
