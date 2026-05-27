import React, { useEffect, useState } from 'react';
import { Sparkles, Check, X } from 'lucide-react';

interface Suggestion {
  id: string;
  order_type: string;
  instructions: string;
  priority: string;
  ai_reason: string;
  confidence_score?: number;
  created_at: string;
}

const priorityColor: Record<string, string> = {
  urgent: 'border-red-300 bg-red-50',
  high: 'border-orange-300 bg-orange-50',
  normal: 'border-blue-200 bg-blue-50',
  low: 'border-gray-200 bg-gray-50',
};

export const AiOrderSuggestionsPanel: React.FC<{
  patientId: string;
  tenantSlug: string;
  onApproved?: () => void;
}> = ({ patientId, tenantSlug, onApproved }) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    'X-Tenant-Slug': tenantSlug,
    'Content-Type': 'application/json',
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai-order-suggestions?patientId=${patientId}`, { headers });
      setSuggestions(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [patientId]);

  const approve = async (id: string) => {
    await fetch(`/api/ai-order-suggestions/${id}/approve`, { method: 'PATCH', headers });
    load();
    onApproved?.();
  };

  const reject = async (id: string) => {
    const reason = window.prompt('Reason for rejection (optional):') ?? '';
    await fetch(`/api/ai-order-suggestions/${id}/reject`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ rejectionReason: reason }),
    });
    load();
  };

  if (loading) return <div className="animate-pulse h-16 bg-gray-100 rounded-xl mb-4" />;
  if (!suggestions.length) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-gray-900">AI Suggested Orders</h3>
        <span className="ml-auto bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
          {suggestions.length} pending
        </span>
      </div>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className={`rounded-xl border p-3 ${priorityColor[s.priority] ?? priorityColor.normal}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                    {s.order_type.replace('_', ' ')}
                  </span>
                  {s.confidence_score != null && (
                    <span className="text-xs text-gray-500">
                      {Math.round(s.confidence_score * 100)}% confidence
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 mt-1">{s.instructions}</p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> {s.ai_reason}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => approve(s.id)}
                  className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-700 rounded-full hover:bg-green-200"
                  title="Approve"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => reject(s.id)}
                  className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-700 rounded-full hover:bg-red-200"
                  title="Reject"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
