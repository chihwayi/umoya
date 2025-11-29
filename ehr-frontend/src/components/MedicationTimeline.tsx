import React, { useEffect, useMemo, useState } from 'react';
import { Filter, Loader2, RefreshCw, Pill, Activity, ClipboardCheck } from 'lucide-react';
import { medicationHistoryApi } from '../services/api';
import { useNotification } from './GlobalNotification';

interface MedicationTimelineEntry {
  id: string;
  entity: 'medication' | 'medication-end' | 'adherence' | 'reconciliation' | string;
  date: string;
  title: string;
  subtitle?: string;
  status?: string;
  medicationType?: string;
  medicationId?: string;
  notes?: string;
}

interface MedicationTimelineProps {
  patientId: string;
  tenantSlug: string;
  token: string;
}

const entityLabels: Record<string, string> = {
  medication: 'Medication Started',
  'medication-end': 'Medication Completed',
  adherence: 'Adherence',
  reconciliation: 'Reconciliation',
};

const statusColors: Record<string, string> = {
  active: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  discontinued: 'text-rose-600 bg-rose-50 border-rose-100',
  completed: 'text-blue-600 bg-blue-50 border-blue-100',
  on_hold: 'text-amber-600 bg-amber-50 border-amber-100',
  taken: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  missed: 'text-rose-600 bg-rose-50 border-rose-100',
};

const medicationTypeBadges: Record<string, string> = {
  current: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  past: 'bg-slate-50 text-slate-600 border-slate-200',
  allergy: 'bg-amber-50 text-amber-600 border-amber-100',
  discontinued: 'bg-rose-50 text-rose-600 border-rose-100',
};

const MedicationTimeline: React.FC<MedicationTimelineProps> = ({ patientId, tenantSlug, token }) => {
  const { showError } = useNotification();
  const [entries, setEntries] = useState<MedicationTimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    entity: 'all',
    status: 'all',
    search: '',
  });

  const loadTimeline = async () => {
    if (!patientId || !token || !tenantSlug) return;
    try {
      setLoading(true);
      const response = await medicationHistoryApi.getMedicationTimeline(patientId, token, tenantSlug);
      setEntries(response.data || []);
    } catch (error: any) {
      console.error('Failed to load medication timeline', error);
      showError('Medication Timeline', error?.response?.data?.message || 'Unable to load timeline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, token, tenantSlug]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (filters.entity !== 'all' && entry.entity !== filters.entity) {
        return false;
      }
      if (filters.status !== 'all' && entry.status && entry.status !== filters.status) {
        return false;
      }
      if (filters.search) {
        const term = filters.search.toLowerCase();
        return (
          entry.title.toLowerCase().includes(term) ||
          entry.subtitle?.toLowerCase().includes(term) ||
          entry.notes?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [entries, filters]);

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, MedicationTimelineEntry[]>();
    filteredEntries.forEach((entry) => {
      const date = new Date(entry.date).toLocaleDateString();
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)?.push(entry);
    });
    return Array.from(groups.entries()).sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime(),
    );
  }, [filteredEntries]);

  const renderBadge = (label: string, classes: string) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );

  const renderEntry = (entry: MedicationTimelineEntry) => {
    const color =
      (entry.status && statusColors[entry.status]) ||
      (entry.medicationType && medicationTypeBadges[entry.medicationType]) ||
      'text-slate-600 bg-slate-50 border-slate-200';

    return (
      <div key={entry.id} className="relative pl-6 pb-6 last:pb-0">
        <span className="absolute left-0 top-1 w-3 h-3 rounded-full bg-indigo-500 shadow" />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
              {entry.subtitle && <p className="text-sm text-slate-500">{entry.subtitle}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {entry.medicationType &&
                renderBadge(
                  entry.medicationType.replace('_', ' '),
                  medicationTypeBadges[entry.medicationType] || 'bg-slate-50 text-slate-600 border-slate-200',
                )}
              {entry.status &&
                renderBadge(
                  entry.status.replace('_', ' '),
                  statusColors[entry.status] || 'bg-slate-50 text-slate-600 border-slate-200',
                )}
              {renderBadge(
                entityLabels[entry.entity] || entry.entity,
                'bg-slate-100 text-slate-600 border-slate-200',
              )}
            </div>
          </div>
          {entry.notes && (
            <p className="mt-3 text-sm text-slate-600 border-t border-slate-100 pt-3">{entry.notes}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Pill className="w-5 h-5 text-indigo-600" />
            Medication Timeline
          </h3>
          <p className="text-sm text-slate-500">Track medication events, adherence, and reconciliations.</p>
        </div>
        <button
          onClick={loadTimeline}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Event Type</label>
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={filters.entity}
              onChange={(e) => setFilters((prev) => ({ ...prev, entity: e.target.value }))}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            >
              <option value="all">All</option>
              <option value="medication">Medication Starts</option>
              <option value="medication-end">Medication Ends</option>
              <option value="adherence">Adherence</option>
              <option value="reconciliation">Reconciliations</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="discontinued">Discontinued</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="taken">Dose Taken</option>
            <option value="missed">Dose Missed</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Search</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Search medication, note..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading timeline...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500">
          <Activity className="w-10 h-10 mb-3 text-slate-400" />
          <p>No medication history found for the selected filters.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-1.5 top-0 bottom-0 border-l-2 border-slate-100" />
          <div className="space-y-6">
            {groupedEntries.map(([date, dateEntries]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardCheck className="w-4 h-4 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{date}</p>
                </div>
                <div className="space-y-4">{dateEntries.map(renderEntry)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationTimeline;

