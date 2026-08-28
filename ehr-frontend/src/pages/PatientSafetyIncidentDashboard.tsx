import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle, Plus, X } from 'lucide-react';
import { api } from '../services/api';

interface Incident {
  id: string;
  incident_type: string;
  harm_level: string;
  location: string | null;
  incident_date: string;
  description: string;
  status: string;
  requires_rca: boolean;
}

interface DashboardData {
  since: string;
  byType: { incidentType: string; count: number }[];
  byLocation: { location: string; count: number }[];
  bySeverity: { harmLevel: string; count: number }[];
  overdueActions: any[];
}

const HARM_LEVELS = ['near_miss', 'no_harm', 'mild_harm', 'moderate_harm', 'severe_harm', 'death'];
const HARM_COLORS: Record<string, string> = {
  near_miss: '#7A9CBC',
  no_harm: '#3B9EFF',
  mild_harm: '#F0954A',
  moderate_harm: '#E8964D',
  severe_harm: '#E8614D',
  death: '#B91C1C',
};
const STATUS_COLORS: Record<string, string> = {
  reported: '#F0954A',
  under_review: '#3B9EFF',
  rca_in_progress: '#8B5CF6',
  closed: '#0AA98A',
};

function ReportIncidentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    incidentType: '', harmLevel: 'near_miss', location: '',
    incidentDate: new Date().toISOString().slice(0, 16), description: '', immediateActionsTaken: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/patient-safety/incidents', form);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#E2EDF8]">Report Patient Safety Incident</h2>
          <button onClick={onClose} className="text-[#7A9CBC] hover:text-[#E2EDF8]"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input
            className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Incident type (e.g. fall, medication_error, wrong_site)"
            value={form.incidentType}
            onChange={e => setForm({ ...form, incidentType: e.target.value })}
          />
          <select
            className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            value={form.harmLevel}
            onChange={e => setForm({ ...form, harmLevel: e.target.value })}
          >
            {HARM_LEVELS.map(h => <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>)}
          </select>
          <input
            className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Location (e.g. Ward 4)"
            value={form.location}
            onChange={e => setForm({ ...form, location: e.target.value })}
          />
          <input
            type="datetime-local"
            className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            value={form.incidentDate}
            onChange={e => setForm({ ...form, incidentDate: e.target.value })}
          />
          <textarea
            className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Description of what happened"
            rows={3}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
          <textarea
            className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Immediate actions taken (optional)"
            rows={2}
            value={form.immediateActionsTaken}
            onChange={e => setForm({ ...form, immediateActionsTaken: e.target.value })}
          />
        </div>
        <button
          disabled={saving || !form.incidentType || !form.description}
          onClick={submit}
          className="mt-4 w-full py-2 rounded-[8px] text-sm font-semibold bg-[#3B9EFF] text-white disabled:opacity-50"
        >
          {saving ? 'Submitting…' : 'Submit Report'}
        </button>
      </div>
    </div>
  );
}

export default function PatientSafetyIncidentDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [summary, setSummary] = useState({ total: 0, openCount: 0, rcaPendingCount: 0 });
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/patient-safety/incidents', { params: statusFilter ? { status: statusFilter } : {} }),
      api.get('/patient-safety/incidents/dashboard'),
    ]).then(([list, dash]) => {
      const listData = list.data ?? list;
      setIncidents(listData.incidents ?? []);
      setSummary(listData.summary ?? { total: 0, openCount: 0, rcaPendingCount: 0 });
      setDashboard(dash.data ?? dash);
    }).finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading && incidents.length === 0) {
    return <div className="flex items-center justify-center h-64 text-[#7A9CBC]">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#080E1A] text-[#E2EDF8] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans', letterSpacing: '-0.02em' }}>
            Patient Safety Incidents
          </h1>
          <p className="text-[#7A9CBC] text-sm mt-1">Incident register, root-cause analysis & corrective actions</p>
        </div>
        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-semibold bg-[#3B9EFF] text-white"
        >
          <Plus size={16} /> Report Incident
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-4">
          <div className="text-[#7A9CBC] text-xs uppercase tracking-widest mb-1">Total Incidents</div>
          <div className="text-2xl font-bold">{summary.total}</div>
        </div>
        <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-4">
          <div className="text-[#7A9CBC] text-xs uppercase tracking-widest mb-1">Open</div>
          <div className="text-2xl font-bold text-[#F0954A]">{summary.openCount}</div>
        </div>
        <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-4">
          <div className="text-[#7A9CBC] text-xs uppercase tracking-widest mb-1">RCA Pending</div>
          <div className="text-2xl font-bold text-[#E8614D]">{summary.rcaPendingCount}</div>
        </div>
      </div>

      {dashboard && dashboard.overdueActions.length > 0 && (
        <div className="bg-[#111E35] rounded-[14px] border border-[#E8614D44] p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-[#E8614D]" />
            <h2 className="text-base font-semibold">Overdue Corrective Actions</h2>
            <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E8614D22] text-[#E8614D]">
              {dashboard.overdueActions.length}
            </span>
          </div>
          <ul className="space-y-2">
            {dashboard.overdueActions.map((a: any) => (
              <li key={a.id} className="text-sm text-[#E2EDF8] flex justify-between border-b border-[#162440] pb-2">
                <span>{a.action_description}</span>
                <span className="text-[#E8614D] text-xs">Due {a.due_date}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Incident list */}
      <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert size={18} className="text-[#3B9EFF]" />
          <h2 className="text-base font-semibold">Incident Register</h2>
          <select
            className="ml-auto bg-[#0C1528] border border-[#162440] rounded-[8px] px-2 py-1 text-xs text-[#E2EDF8]"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="reported">Reported</option>
            <option value="under_review">Under review</option>
            <option value="rca_in_progress">RCA in progress</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#7A9CBC] text-xs border-b border-[#162440]">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Location</th>
              <th className="text-left py-2">Harm Level</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map(item => (
              <tr key={item.id} className="border-b border-[#162440] hover:bg-[#0C1528]">
                <td className="py-3 text-[#7A9CBC]">{new Date(item.incident_date).toLocaleDateString()}</td>
                <td className="py-3 font-medium capitalize">{item.incident_type.replace(/_/g, ' ')}</td>
                <td className="py-3 text-[#7A9CBC]">{item.location || '—'}</td>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: `${HARM_COLORS[item.harm_level]}22`, color: HARM_COLORS[item.harm_level] }}>
                    {item.harm_level.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: `${STATUS_COLORS[item.status]}22`, color: STATUS_COLORS[item.status] }}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
            {incidents.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#7A9CBC]">
                  <CheckCircle size={20} className="inline mr-2 text-[#0AA98A]" />
                  No incidents recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showReportModal && (
        <ReportIncidentModal onClose={() => setShowReportModal(false)} onSaved={load} />
      )}
    </div>
  );
}
