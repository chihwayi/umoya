import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface ConsentRecord {
  id: string;
  procedure_name: string;
  status: string;
  signed_at?: string;
  pdf_key?: string;
}

const STATUS_CLASSES: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-700',
  signed:   'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired:  'bg-gray-100 text-gray-500',
};

export function ConsentStatusBadge({ encounterId }: { encounterId: string }) {
  const [consents, setConsents] = useState<ConsentRecord[]>([]);

  useEffect(() => {
    api.get(`/consent/encounter/${encounterId}`)
      .then((r: any) => setConsents(r.data ?? r))
      .catch(() => {});
  }, [encounterId]);

  if (consents.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {consents.map((c) => (
        <div key={c.id} className="flex items-center gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {c.procedure_name}: {c.status}
          </span>
          {c.status === 'signed' && c.pdf_key && (
            <button
              onClick={async () => {
                const { data } = await api.get(`/consent/requests/${c.id}/pdf`);
                window.open(data.url, '_blank');
              }}
              className="text-xs text-blue-600 underline"
            >
              View PDF
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
