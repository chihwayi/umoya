import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { storeroomApi } from '../services/api';

interface RequestItem {
  id: string;
  catalog_id: string;
  item_name: string;
  quantity_requested: number;
}

interface Props {
  request: { id: string; reference_number?: string; items: RequestItem[] };
  onClose: () => void;
  onDone?: () => void;
}

export default function ApproveRequestModal({ request, onClose, onDone }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = useMemo(() => localStorage.getItem('ehr_token') ?? '', []);
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(request.items.map(i => [i.id, i.quantity_requested]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function updateQty(itemId: string, qty: number) {
    setQuantities(prev => ({ ...prev, [itemId]: Math.max(0, qty) }));
  }

  async function handleApprove() {
    setSubmitting(true);
    setError('');
    try {
      await storeroomApi.approveRequest(request.id, {
        approved_items: request.items.map(i => ({
          item_id: i.id,
          quantity_approved: quantities[i.id] ?? 0,
        })),
      }, token!, tenantSlug!);
      onDone?.();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to approve request.');
    } finally { setSubmitting(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28, width: 540, maxHeight: '90vh',
        overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>Approve Request</h3>
        <p style={{ margin: '0 0 18px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
          {request.reference_number}
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              {['Item', 'Requested', 'Approve Qty'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, fontWeight: 700, color: '#374151' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {request.items.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px', fontWeight: 600 }}>{item.item_name}</td>
                <td style={{ padding: '8px', color: '#6b7280' }}>{item.quantity_requested}</td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="number" min={0}
                    value={quantities[item.id] ?? 0}
                    onChange={e => updateQty(item.id, Number(e.target.value))}
                    style={{ width: 90, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 20px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={submitting}
            style={{
              padding: '8px 24px', background: '#16a34a', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
