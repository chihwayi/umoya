import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { storeroomApi } from '../services/api';

interface TransferItem {
  id: string;
  catalog_id: string;
  item_name: string;
  quantity_transferred: number;
}

interface Props {
  transfer: { id: string; reference_number?: string; items: TransferItem[] };
  onClose: () => void;
  onDone?: () => void;
}

const CONDITIONS = ['good', 'short', 'damaged', 'expired'] as const;

export default function ReceiveTransferModal({ transfer, onClose, onDone }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = useMemo(() => localStorage.getItem('ehr_token') ?? '', []);
  const [rows, setRows] = useState(
    transfer.items.map(i => ({
      item_id: i.id,
      item_name: i.item_name,
      quantity_transferred: i.quantity_transferred,
      quantity_received: i.quantity_transferred,
      condition: 'good' as typeof CONDITIONS[number],
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function updateRow(itemId: string, patch: Partial<typeof rows[number]>) {
    setRows(prev => prev.map(r => r.item_id === itemId ? { ...r, ...patch } : r));
  }

  async function handleReceive() {
    setSubmitting(true);
    setError('');
    try {
      await storeroomApi.receiveTransfer(transfer.id, rows.map(r => ({
        item_id: r.item_id,
        quantity_received: r.quantity_received,
        condition: r.condition,
      })), token!, tenantSlug!);
      onDone?.();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to receive transfer.');
    } finally { setSubmitting(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28, width: 580, maxHeight: '90vh',
        overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>Receive Transfer</h3>
        <p style={{ margin: '0 0 18px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
          {transfer.reference_number}
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              {['Item', 'Dispatched', 'Received Qty', 'Condition'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, fontWeight: 700, color: '#374151' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.item_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px', fontWeight: 600 }}>{row.item_name}</td>
                <td style={{ padding: '8px', color: '#6b7280' }}>{row.quantity_transferred}</td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="number" min={0} max={row.quantity_transferred}
                    value={row.quantity_received}
                    onChange={e => updateRow(row.item_id, { quantity_received: Math.max(0, Math.min(row.quantity_transferred, Number(e.target.value))) })}
                    style={{ width: 80, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <select
                    value={row.condition}
                    onChange={e => updateRow(row.item_id, { condition: e.target.value as typeof CONDITIONS[number] })}
                    style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }}
                  >
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
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
            onClick={handleReceive}
            disabled={submitting}
            style={{
              padding: '8px 24px', background: '#16a34a', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Receiving…' : 'Receive'}
          </button>
        </div>
      </div>
    </div>
  );
}
