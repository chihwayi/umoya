import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface QueueEntry {
  id: string;
  patient_id: string;
  first_name?: string;
  last_name?: string;
  record_type: 'allergy' | 'active_medication';
  conflict_field: string;
  server_value: unknown;
  client_value: unknown;
  client_device_id?: string;
  created_at: string;
}

interface Props {
  /** Scope to one patient when shown in a patient chart; omit for global sidebar view */
  patientId?: string;
  onCountChange?: (count: number) => void;
}

export function ConflictResolutionQueue({ patientId, onCountChange }: Props) {
  const [entries, setEntries] = useState<QueueEntry[]>([]);

  useEffect(() => {
    const url = patientId
      ? `/conflict-queue/patient/${patientId}`
      : '/conflict-queue/all';
    api.get(url).then((r: any) => {
      const data: QueueEntry[] = r.data ?? r;
      setEntries(data);
      onCountChange?.(data.length);
    });
  }, [patientId]);

  async function resolve(
    id: string,
    resolution: 'resolved_keep_server' | 'resolved_keep_client',
  ) {
    await api.patch(`/conflict-queue/${id}/resolve`, {
      resolution,
      resolvedBy: (window as any).__currentUserId ?? 'unknown',
    });
    setEntries((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      onCountChange?.(updated.length);
      return updated;
    });
  }

  if (!entries.length) return null;

  return (
    <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded-md mb-4">
      <h3 className="font-bold text-red-700 text-sm mb-1">
        ⚠ {entries.length} Unresolved Clinical Conflict{entries.length > 1 ? 's' : ''}
      </h3>
      <p className="text-xs text-red-600 mb-3">
        These records were edited offline and online simultaneously. Choose which version
        is clinically correct — the other will be discarded.
      </p>

      {entries.map((e) => (
        <div key={e.id} className="bg-white border border-red-200 rounded p-3 mb-2">
          <div className="text-sm font-semibold text-gray-800 mb-1">
            {e.first_name} {e.last_name}
            {' · '}
            {e.record_type === 'allergy' ? 'Allergy' : 'Medication'}
            {' · '}
            <code className="bg-gray-100 px-1 rounded">{e.conflict_field}</code>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div className="bg-blue-50 border border-blue-200 p-2 rounded">
              <div className="font-medium text-blue-700 mb-1">Server (online) version</div>
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(e.server_value, null, 2)}
              </pre>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-2 rounded">
              <div className="font-medium text-amber-700 mb-1">
                Device version{e.client_device_id ? ` (${e.client_device_id})` : ''}
              </div>
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(e.client_value, null, 2)}
              </pre>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => resolve(e.id, 'resolved_keep_server')}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              ✓ Keep server version
            </button>
            <button
              onClick={() => resolve(e.id, 'resolved_keep_client')}
              className="px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
            >
              ✓ Keep device version
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
