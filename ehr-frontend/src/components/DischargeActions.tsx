import React, { useState } from 'react';
import { api } from '../services/api';

interface Props {
  encounterId: string;
  alreadyFinalized: boolean;
}

export function DischargeActions({ encounterId, alreadyFinalized }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(alreadyFinalized);
  const [count, setCount] = useState(0);

  async function handleFinalise() {
    if (!confirm("This will send all discharge documents to the patient's app. Proceed?")) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/encounters/${encounterId}/discharge/finalise`);
      setCount(data.documentsCreated);
      setDone(true);
    } catch {
      alert('Failed to send discharge documents. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-300 rounded-lg text-sm text-green-700">
        <span>✓</span>
        <span>
          {count > 0
            ? `${count} discharge document(s) sent to patient's app`
            : 'Discharge documents already sent'}
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={handleFinalise}
      disabled={loading}
      className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
    >
      {loading ? 'Sending…' : '✓ Finalise & Send to Patient'}
    </button>
  );
}
