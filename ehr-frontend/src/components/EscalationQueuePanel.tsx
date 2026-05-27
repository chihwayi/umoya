import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface Escalation {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  mrn: string;
  escalation_level: 'moderate' | 'high' | 'critical';
  signal_summary: string;
  detected_findings: string[];
  status: string;
  created_at: string;
}

const levelColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

export const EscalationQueuePanel: React.FC<{ tenantSlug: string }> = ({ tenantSlug }) => {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'X-Tenant-Slug': tenantSlug,
  };

  const load = async () => {
    try {
      const res = await fetch('/api/post-visit-escalations', { headers });
      const data = await res.json();
      setEscalations(Array.isArray(data) ? data : []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const acknowledge = async (id: string) => {
    await fetch(`/api/post-visit-escalations/${id}/acknowledge`, {
      method: 'PATCH',
      headers,
    });
    load();
  };

  if (loading) return <div className="animate-pulse h-20 bg-gray-100 rounded-xl" />;
  if (!escalations.length) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        <h3 className="font-bold text-gray-900">Post-Visit Escalations</h3>
        <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {escalations.length}
        </span>
      </div>
      <div className="space-y-2">
        {escalations.map((esc) => (
          <div
            key={esc.id}
            className={`rounded-xl border p-3 ${levelColor[esc.escalation_level] ?? levelColor.moderate}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">
                  {esc.first_name} {esc.last_name} — {esc.mrn}
                </p>
                <p className="text-xs mt-0.5 line-clamp-2">{esc.signal_summary}</p>
              </div>
              <span className="text-xs font-bold uppercase shrink-0">{esc.escalation_level}</span>
            </div>
            <div className="flex gap-2 mt-2">
              {esc.status === 'routed' && (
                <button
                  onClick={() => acknowledge(esc.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-current border border-current rounded-full px-3 py-1 hover:opacity-70"
                >
                  <CheckCircle className="w-3 h-3" /> Acknowledge
                </button>
              )}
              <span className="flex items-center gap-1 text-xs opacity-60">
                <Clock className="w-3 h-3" />
                {new Date(esc.created_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
