import React, { useEffect, useState } from 'react';
import { Users, Building2, FileCheck, AlertTriangle } from 'lucide-react';
import api from '../services/api';

interface Employer { id: string; name: string; industry_sector: string; is_active: boolean; }
interface DashSummary { employers: { total: string; active: string }; recentEncounters: any[]; activeCertificates: any[]; }

export default function OccupationalMedicineDashboard() {
  const [summary, setSummary] = useState<DashSummary | null>(null);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/oem/dashboard'),
      api.get('/oem/employers'),
    ]).then(([d, e]) => {
      setSummary(d.data ?? d);
      setEmployers(e.data ?? e);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-[#7A9CBC]">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#080E1A] text-[#E2EDF8] p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans', letterSpacing: '-0.02em' }}>
          Occupational Medicine
        </h1>
        <p className="text-[#7A9CBC] text-sm mt-1">Workplace health, fitness-for-duty & employer surveillance</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
        <StatCard icon={<Building2 size={20} />} label="Employers" value={summary?.employers?.active ?? '—'} sub="active" color="#0AA98A" />
        <StatCard icon={<Users size={20} />} label="Encounters (30d)" value={summary?.recentEncounters?.reduce((a, r) => a + Number(r.cnt), 0) ?? 0} color="#3B9EFF" />
        <StatCard icon={<FileCheck size={20} />} label="Fit Certificates" value={summary?.activeCertificates?.find(c => c.fitness_category === 'fit')?.cnt ?? 0} color="#1B6B3A" />
        <StatCard icon={<AlertTriangle size={20} />} label="Unfit / Restricted" value={summary?.activeCertificates?.filter(c => c.fitness_category !== 'fit').reduce((a, r) => a + Number(r.cnt), 0) ?? 0} color="#E8614D" />
      </div>

      <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5">
        <h2 className="text-base font-semibold mb-4">Corporate Clients</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#7A9CBC] text-xs border-b border-[#162440]">
              <th className="text-left py-2">Employer</th>
              <th className="text-left py-2">Industry</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {employers.map(e => (
              <tr key={e.id} className="border-b border-[#162440] hover:bg-[#0C1528] cursor-pointer">
                <td className="py-3 font-medium">{e.name}</td>
                <td className="py-3 text-[#7A9CBC]">{e.industry_sector ?? '—'}</td>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: e.is_active ? '#1B6B3A22' : '#3D607F22', color: e.is_active ? '#22C55E' : '#7A9CBC' }}>
                    {e.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
            {employers.length === 0 && (
              <tr><td colSpan={3} className="py-8 text-center text-[#7A9CBC]">No employers registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: any; sub?: string; color: string }) {
  return (
    <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-4">
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <span className="text-xs text-[#7A9CBC] font-medium uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>{value}</div>
      {sub && <div className="text-xs text-[#7A9CBC] mt-0.5">{sub}</div>}
    </div>
  );
}
