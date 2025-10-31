import React, { useMemo } from 'react';
import { Activity, Heart, Droplets, Thermometer, ListTree, ShieldAlert, TestTube, Pill } from 'lucide-react';

interface ChartSidebarProps {
  appointment: any;
  vitals: any[];
  labOrders: any[];
}

const ChartSidebar: React.FC<ChartSidebarProps> = ({ appointment, vitals, labOrders }) => {
  let problems: Array<{ description: string; status?: string }> = [];
  let allergies: Array<{ allergen: string; reaction?: string; severity?: string }> = [];
  try {
    if (appointment?.notes) {
      const parsed = JSON.parse(appointment.notes);
      problems = parsed.problems || [];
      allergies = parsed.allergies || [];
    }
  } catch {}

  const latestVitals = useMemo(() => (vitals || []).slice(0,1)[0], [vitals]);

  return (
    <aside className="hidden xl:block w-80">
      <div className="space-y-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-4">
          <div className="flex items-center gap-2 mb-3"><ListTree className="w-4 h-4 text-indigo-600" /><h3 className="font-semibold text-slate-900">Problem List</h3></div>
          {problems.length === 0 ? <p className="text-sm text-slate-500">No problems recorded</p> : (
            <ul className="space-y-2 text-sm">
              {problems.slice(0,6).map((p, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-slate-700">{p.description}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${p.status === 'resolved' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>{p.status || 'active'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-4">
          <div className="flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-emerald-600" /><h3 className="font-semibold text-slate-900">Latest Vitals</h3></div>
          {latestVitals ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center gap-2"><Heart className="w-3 h-3 text-red-600" />BP <span className="ml-auto text-slate-900">{latestVitals.bloodPressure || '—'}</span></div>
              <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center gap-2"><Activity className="w-3 h-3 text-red-600" />HR <span className="ml-auto text-slate-900">{latestVitals.heartRate ?? '—'}</span></div>
              <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center gap-2"><Thermometer className="w-3 h-3 text-orange-600" />Temp <span className="ml-auto text-slate-900">{latestVitals.temperature ?? '—'}°C</span></div>
              <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center gap-2"><Droplets className="w-3 h-3 text-blue-600" />SpO2 <span className="ml-auto text-slate-900">{latestVitals.oxygenSaturation ?? '—'}%</span></div>
            </div>
          ) : <p className="text-sm text-slate-500">No vitals today</p>}
        </div>
      </div>
    </aside>
  );
};

export default ChartSidebar;


