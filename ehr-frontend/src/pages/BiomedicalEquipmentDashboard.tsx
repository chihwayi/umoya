import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Wrench, CheckCircle, Plus, X } from 'lucide-react';
import { api } from '../services/api';

interface Equipment {
  id: string;
  equipment_type: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  status: string;
  next_calibration_due_date: string | null;
}

interface Dashboard {
  byType: { equipmentType: string; count: number }[];
  byStatus: { status: string; count: number }[];
  overdueCalibration: Equipment[];
  dueWithin30Days: Equipment[];
}

const STATUS_COLORS: Record<string, string> = {
  in_service: '#0AA98A',
  out_of_service: '#E8614D',
  decommissioned: '#7A9CBC',
};

function RegisterEquipmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    equipmentType: '', name: '', manufacturer: '', model: '', serialNumber: '',
    location: '', lastCalibrationDate: '', calibrationIntervalDays: 365,
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/biomedical-equipment', form);
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
          <h2 className="text-base font-semibold text-[#E2EDF8]">Register Equipment</h2>
          <button onClick={onClose} className="text-[#7A9CBC] hover:text-[#E2EDF8]"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Equipment type (e.g. ventilator, infusion_pump, defibrillator)"
            value={form.equipmentType} onChange={e => setForm({ ...form, equipmentType: e.target.value })} />
          <input className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className="bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
              placeholder="Manufacturer" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} />
            <input className="bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
              placeholder="Model" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
          </div>
          <input className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Serial number" value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} />
          <input className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8]"
            placeholder="Location / ward" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          <div>
            <label className="text-xs text-[#7A9CBC]">Last calibration date (optional)</label>
            <input type="date" className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8] mt-1"
              value={form.lastCalibrationDate} onChange={e => setForm({ ...form, lastCalibrationDate: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-[#7A9CBC]">Calibration interval (days)</label>
            <input type="number" className="w-full bg-[#0C1528] border border-[#162440] rounded-[8px] px-3 py-2 text-sm text-[#E2EDF8] mt-1"
              value={form.calibrationIntervalDays} onChange={e => setForm({ ...form, calibrationIntervalDays: Number(e.target.value) })} />
          </div>
        </div>
        <button
          disabled={saving || !form.equipmentType || !form.name}
          onClick={submit}
          className="mt-4 w-full py-2 rounded-[8px] text-sm font-semibold bg-[#3B9EFF] text-white disabled:opacity-50"
        >
          {saving ? 'Registering…' : 'Register Equipment'}
        </button>
      </div>
    </div>
  );
}

export default function BiomedicalEquipmentDashboard() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/biomedical-equipment', { params: statusFilter ? { status: statusFilter } : {} }),
      api.get('/biomedical-equipment/dashboard'),
    ]).then(([eq, dash]) => {
      setEquipment(eq.data ?? eq);
      setDashboard(dash.data ?? dash);
    }).finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading && equipment.length === 0) {
    return <div className="flex items-center justify-center h-64 text-[#7A9CBC]">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#080E1A] text-[#E2EDF8] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans', letterSpacing: '-0.02em' }}>
            Biomedical Equipment Register
          </h1>
          <p className="text-[#7A9CBC] text-sm mt-1">Inventory, calibration due-dates & maintenance history</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-semibold bg-[#3B9EFF] text-white"
        >
          <Plus size={16} /> Register Equipment
        </button>
      </div>

      {dashboard && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-4">
            <div className="text-[#7A9CBC] text-xs uppercase tracking-widest mb-1">Total Registered</div>
            <div className="text-2xl font-bold">{dashboard.byStatus.reduce((sum, s) => sum + s.count, 0)}</div>
          </div>
          <div className="bg-[#111E35] rounded-[14px] border border-[#E8614D44] p-4">
            <div className="text-[#7A9CBC] text-xs uppercase tracking-widest mb-1">Overdue Calibration</div>
            <div className="text-2xl font-bold text-[#E8614D]">{dashboard.overdueCalibration.length}</div>
          </div>
          <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-4">
            <div className="text-[#7A9CBC] text-xs uppercase tracking-widest mb-1">Due Within 30 Days</div>
            <div className="text-2xl font-bold text-[#F0954A]">{dashboard.dueWithin30Days.length}</div>
          </div>
        </div>
      )}

      {dashboard && dashboard.overdueCalibration.length > 0 && (
        <div className="bg-[#111E35] rounded-[14px] border border-[#E8614D44] p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-[#E8614D]" />
            <h2 className="text-base font-semibold">Overdue Calibration</h2>
          </div>
          <ul className="space-y-2">
            {dashboard.overdueCalibration.map(e => (
              <li key={e.id} className="text-sm flex justify-between border-b border-[#162440] pb-2">
                <span>{e.name} <span className="text-[#7A9CBC]">({e.location || 'unlocated'})</span></span>
                <span className="text-[#E8614D] text-xs">Due {e.next_calibration_due_date}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wrench size={18} className="text-[#3B9EFF]" />
          <h2 className="text-base font-semibold">Equipment Inventory</h2>
          <select
            className="ml-auto bg-[#0C1528] border border-[#162440] rounded-[8px] px-2 py-1 text-xs text-[#E2EDF8]"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="in_service">In service</option>
            <option value="out_of_service">Out of service</option>
            <option value="decommissioned">Decommissioned</option>
          </select>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#7A9CBC] text-xs border-b border-[#162440]">
              <th className="text-left py-2">Name</th>
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Location</th>
              <th className="text-left py-2">Calibration Due</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map(e => (
              <tr key={e.id} className="border-b border-[#162440] hover:bg-[#0C1528]">
                <td className="py-3 font-medium">{e.name}</td>
                <td className="py-3 text-[#7A9CBC] capitalize">{e.equipment_type.replace(/_/g, ' ')}</td>
                <td className="py-3 text-[#7A9CBC]">{e.location || '—'}</td>
                <td className="py-3 text-[#7A9CBC]">{e.next_calibration_due_date || '—'}</td>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: `${STATUS_COLORS[e.status]}22`, color: STATUS_COLORS[e.status] }}>
                    {e.status.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
            {equipment.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#7A9CBC]">
                  <CheckCircle size={20} className="inline mr-2 text-[#0AA98A]" />
                  No equipment registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && <RegisterEquipmentModal onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}
