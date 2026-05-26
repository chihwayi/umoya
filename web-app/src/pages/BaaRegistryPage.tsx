import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, RefreshCw, Save, ShieldCheck, X } from 'lucide-react';
import { baaRegistryAPI, BaaRegistryEntry } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';

const statusLabel: Record<BaaRegistryEntry['baaStatus'], string> = {
  signed: 'Signed',
  pending: 'Pending',
  expired: 'Expired',
  not_required: 'Not required',
};

const statusClass: Record<BaaRegistryEntry['baaStatus'], string> = {
  signed: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  pending: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  expired: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
  not_required: 'border-slate-300/20 bg-slate-300/10 text-slate-200',
};

export const BaaRegistryPage: React.FC = () => {
  const { success, error } = useNotification();
  const [entries, setEntries] = useState<BaaRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<BaaRegistryEntry | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      setEntries(await baaRegistryAPI.getAll());
    } catch {
      error('Load failed', 'Unable to load the BAA registry');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const summary = useMemo(() => ({
    total: entries.length,
    signed: entries.filter((entry) => entry.baaStatus === 'signed').length,
    pending: entries.filter((entry) => entry.baaStatus === 'pending').length,
    expired: entries.filter((entry) => entry.baaStatus === 'expired').length,
  }), [entries]);

  const saveEntry = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      const updated = await baaRegistryAPI.update(editing.id, editing);
      setEntries((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setEditing(null);
      success('BAA updated', `${updated.vendorName} compliance details saved`);
    } catch {
      error('Update failed', 'Unable to update the BAA entry');
    } finally {
      setSaving(false);
    }
  };

  const markSigned = async (entry: BaaRegistryEntry) => {
    const today = new Date().toISOString().slice(0, 10);
    const updated = await baaRegistryAPI.update(entry.id, { baaStatus: 'signed', baaSignedDate: today });
    setEntries((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    success('Marked signed', `${updated.vendorName} is now signed`);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ['Vendors', summary.total, 'text-[#7DE8CA]'],
          ['Signed', summary.signed, 'text-emerald-200'],
          ['Pending', summary.pending, 'text-amber-100'],
          ['Expired', summary.expired, 'text-rose-100'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-[#0A1525]/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7A9AB8]">{label}</p>
            <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0A1525]/80">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2 text-white">
            <ShieldCheck className="h-5 w-5 text-[#7DE8CA]" />
            <h2 className="text-sm font-bold">Business Associate Agreements</h2>
          </div>
          <button onClick={loadEntries} className="rounded-xl p-2 text-[#7A9AB8] hover:bg-white/[0.06] hover:text-white" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-[#7A9AB8]">Loading registry...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.06] text-sm">
              <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.14em] text-[#7A9AB8]">
                <tr>
                  {['Vendor', 'Type', 'Status', 'Signed', 'Expiry', 'Document', 'Actions'].map((head) => (
                    <th key={head} className="px-4 py-3 font-semibold">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {entries.map((entry) => (
                  <tr key={entry.id} className="text-[#D8E5F8]">
                    <td className="px-4 py-3 font-semibold text-white">{entry.vendorName}</td>
                    <td className="px-4 py-3 capitalize text-[#9DB2D1]">{entry.vendorType.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass[entry.baaStatus]}`}>
                        {statusLabel[entry.baaStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#9DB2D1]">{entry.baaSignedDate || '-'}</td>
                    <td className="px-4 py-3 text-[#9DB2D1]">{entry.baaExpiryDate || '-'}</td>
                    <td className="px-4 py-3">
                      {entry.baaDocumentUrl ? (
                        <a href={entry.baaDocumentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#7DE8CA]">
                          <FileText className="h-4 w-4" /> Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setEditing(entry)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/[0.06]">Edit</button>
                        {entry.baaStatus !== 'signed' && (
                          <button onClick={() => markSigned(entry)} className="rounded-lg bg-[#00C896] px-3 py-1.5 text-xs font-bold text-[#051119]">Mark signed</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0A1525] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editing.vendorName}</h3>
              <button onClick={() => setEditing(null)} className="rounded-xl p-2 text-[#7A9AB8] hover:bg-white/[0.06] hover:text-white" title="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-[#D8E5F8]">
                Status
                <select className="mt-2 w-full rounded-xl border border-[#253A58] bg-[#091320] px-3 py-2 text-white" value={editing.baaStatus} onChange={(e) => setEditing({ ...editing, baaStatus: e.target.value as BaaRegistryEntry['baaStatus'] })}>
                  {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-[#D8E5F8]">
                Signed date
                <input className="mt-2 w-full rounded-xl border border-[#253A58] bg-[#091320] px-3 py-2 text-white" type="date" value={editing.baaSignedDate || ''} onChange={(e) => setEditing({ ...editing, baaSignedDate: e.target.value || null })} />
              </label>
              <label className="text-sm font-semibold text-[#D8E5F8]">
                Expiry date
                <input className="mt-2 w-full rounded-xl border border-[#253A58] bg-[#091320] px-3 py-2 text-white" type="date" value={editing.baaExpiryDate || ''} onChange={(e) => setEditing({ ...editing, baaExpiryDate: e.target.value || null })} />
              </label>
              <label className="text-sm font-semibold text-[#D8E5F8]">
                Document URL
                <input className="mt-2 w-full rounded-xl border border-[#253A58] bg-[#091320] px-3 py-2 text-white" value={editing.baaDocumentUrl || ''} onChange={(e) => setEditing({ ...editing, baaDocumentUrl: e.target.value || null })} />
              </label>
              <label className="md:col-span-2 text-sm font-semibold text-[#D8E5F8]">
                Notes
                <textarea className="mt-2 min-h-[110px] w-full rounded-xl border border-[#253A58] bg-[#091320] px-3 py-2 text-white" value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value || null })} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white">Cancel</button>
              <button onClick={saveEntry} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#00C896] px-4 py-2 text-sm font-bold text-[#051119] disabled:opacity-60">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
