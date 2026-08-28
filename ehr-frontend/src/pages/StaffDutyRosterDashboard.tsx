import React, { useEffect, useState, useCallback } from 'react';
import { CalendarClock, Phone, MessageSquare, Plus, X, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

interface Shift {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  ward: string;
  shift_date: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  on_call: boolean;
  status: string;
}

interface HandoverNote {
  id: string;
  ward: string;
  from_first_name: string;
  from_last_name: string;
  to_first_name: string | null;
  to_last_name: string | null;
  notes: string;
  created_at: string;
}

const SHIFT_TYPE_COLORS: Record<string, string> = { day: '#3B9EFF', night: '#8B5CF6', on_call: '#F0954A' };

function NewShiftModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    userId: '', ward: '', shiftDate: new Date().toISOString().slice(0, 10),
    shiftType: 'day', startTime: '08:00', endTime: '16:00', onCall: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post('/staff-rostering/shifts', form);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create shift');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#E2EDF8]">Schedule Shift</h2>
          <button onClick={onClose} className="text-[#7A9CBC] hover:text-[#E2EDF8]"><X size={18} /></button>
        </div>
        {error && <div className="mb-3 px-3 py-2 rounded-[8px] bg-[#E8614D22] text-[#E8614D] text-sm">{error}</div>}
        <div className="space-y-3">
          <input className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Staff user ID" value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} />
          <input className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Ward" value={form.ward} onChange={e => setForm({ ...form, ward: e.target.value })} />
          <input type="date" className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            value={form.shiftDate} onChange={e => setForm({ ...form, shiftDate: e.target.value })} />
          <select className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            value={form.shiftType} onChange={e => setForm({ ...form, shiftType: e.target.value })}>
            <option value="day">Day</option>
            <option value="night">Night</option>
            <option value="on_call">On-call</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="time" className="bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
              value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
            <input type="time" className="bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
              value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#7A9CBC]">
            <input type="checkbox" checked={form.onCall} onChange={e => setForm({ ...form, onCall: e.target.checked })} />
            On-call shift
          </label>
        </div>
        <button
          disabled={saving || !form.userId || !form.ward}
          onClick={submit}
          className="mt-4 w-full py-2 rounded-[8px] text-sm font-semibold bg-[#3B9EFF] text-white disabled:opacity-50"
        >
          {saving ? 'Scheduling…' : 'Schedule Shift'}
        </button>
      </div>
    </div>
  );
}

export default function StaffDutyRosterDashboard() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [onCallStaff, setOnCallStaff] = useState<Shift[]>([]);
  const [handoverNotes, setHandoverNotes] = useState<HandoverNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [wardFilter, setWardFilter] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/staff-rostering/shifts', { params: { fromDate: today, ...(wardFilter ? { ward: wardFilter } : {}) } }),
      api.get('/staff-rostering/on-call', { params: { date: today, ...(wardFilter ? { ward: wardFilter } : {}) } }),
      wardFilter ? api.get('/staff-rostering/handover-notes', { params: { ward: wardFilter } }) : Promise.resolve({ data: [] }),
    ]).then(([shiftList, onCall, notes]) => {
      setShifts(shiftList.data ?? shiftList);
      setOnCallStaff(onCall.data ?? onCall);
      setHandoverNotes(notes.data ?? notes);
    }).finally(() => setLoading(false));
  }, [wardFilter, today]);

  useEffect(() => { load(); }, [load]);

  if (loading && shifts.length === 0) {
    return <div className="flex items-center justify-center h-64 text-[#7A9CBC]">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#080E1A] text-[#E2EDF8] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans', letterSpacing: '-0.02em' }}>
            Staff Duty Roster
          </h1>
          <p className="text-[#7A9CBC] text-sm mt-1">Ward shifts, on-call status & handover notes</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            className="bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Filter by ward"
            value={wardFilter}
            onChange={e => setWardFilter(e.target.value)}
          />
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-semibold bg-[#3B9EFF] text-white"
          >
            <Plus size={16} /> Schedule Shift
          </button>
        </div>
      </div>

      {onCallStaff.length > 0 && (
        <div className="bg-[#111E35] rounded-[14px] border border-[#F0954A44] p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Phone size={18} className="text-[#F0954A]" />
            <h2 className="text-base font-semibold">On-Call Today</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {onCallStaff.map(s => (
              <div key={s.id} className="bg-[#0C1528] rounded-[8px] px-3 py-2 text-sm">
                <span className="font-medium">{s.first_name} {s.last_name}</span>
                <span className="text-[#7A9CBC]"> — {s.ward} ({s.start_time}–{s.end_time})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarClock size={18} className="text-[#3B9EFF]" />
          <h2 className="text-base font-semibold">Upcoming Shifts</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#7A9CBC] text-xs border-b border-[#162440]">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Staff</th>
              <th className="text-left py-2">Ward</th>
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Time</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map(s => (
              <tr key={s.id} className="border-b border-[#162440] hover:bg-[#0C1528]">
                <td className="py-3 text-[#7A9CBC]">{s.shift_date}</td>
                <td className="py-3 font-medium">{s.first_name} {s.last_name}</td>
                <td className="py-3 text-[#7A9CBC]">{s.ward}</td>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: `${SHIFT_TYPE_COLORS[s.shift_type]}22`, color: SHIFT_TYPE_COLORS[s.shift_type] }}>
                    {s.shift_type.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-3 text-[#7A9CBC]">{s.start_time}–{s.end_time}</td>
                <td className="py-3 text-[#7A9CBC] capitalize">{s.status}</td>
              </tr>
            ))}
            {shifts.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#7A9CBC]">
                  <CheckCircle size={20} className="inline mr-2 text-[#0AA98A]" />
                  No shifts scheduled.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {wardFilter && (
        <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={18} className="text-[#3B9EFF]" />
            <h2 className="text-base font-semibold">Handover Notes — {wardFilter}</h2>
          </div>
          <div className="space-y-3">
            {handoverNotes.map(n => (
              <div key={n.id} className="border-b border-[#162440] pb-2 text-sm">
                <div className="text-[#7A9CBC] text-xs">
                  {n.from_first_name} {n.from_last_name}
                  {n.to_first_name && ` → ${n.to_first_name} ${n.to_last_name}`}
                  {' · '}{new Date(n.created_at).toLocaleString()}
                </div>
                <div className="mt-1">{n.notes}</div>
              </div>
            ))}
            {handoverNotes.length === 0 && (
              <div className="text-center py-4 text-[#7A9CBC] text-sm">No handover notes for this ward yet.</div>
            )}
          </div>
        </div>
      )}

      {showModal && <NewShiftModal onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}
