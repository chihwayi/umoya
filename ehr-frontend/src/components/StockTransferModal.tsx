import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { storeroomApi } from '../services/api';

interface RequestItem {
  catalog_id: string;
  item_name: string;
  quantity_requested: number;
  quantity_approved?: number;
}

interface Props {
  request: {
    id: string;
    requesting_location_id: string;
    requesting_location_name?: string;
    fulfilling_location_id: string;
    fulfilling_location_name?: string;
    items: RequestItem[];
  };
  onClose: () => void;
  onDone?: () => void;
}

interface StockRow {
  catalog_id: string;
  item_name: string;
  batch_number?: string;
  expiry_date?: string;
  available: number;
  dispatch: number;
}

export default function StockTransferModal({ request, onClose, onDone }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = useMemo(() => localStorage.getItem('ehr_token') ?? '', []);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    storeroomApi.getStockByLocation(request.fulfilling_location_id, {}, token!, tenantSlug!)
      .then((stock: any[]) => {
        const built: StockRow[] = request.items.map(item => {
          const batches = stock.filter((s: any) => s.catalog_id === item.catalog_id);
          const available = batches.reduce((sum: number, b: any) => sum + (b.quantity_on_hand ?? 0), 0);
          const top = batches[0];
          return {
            catalog_id: item.catalog_id,
            item_name: item.item_name,
            batch_number: top?.batch_number,
            expiry_date: top?.expiry_date,
            available,
            dispatch: Math.min(item.quantity_approved ?? item.quantity_requested, available),
          };
        });
        setRows(built);
      })
      .catch(() => setError('Could not load stock levels.'))
      .finally(() => setLoading(false));
  }, [request, token, tenantSlug]);

  function updateDispatch(catalogId: string, qty: number) {
    setRows(prev => prev.map(r =>
      r.catalog_id === catalogId
        ? { ...r, dispatch: Math.min(Math.max(0, qty), r.available) }
        : r
    ));
  }

  async function handleDispatch() {
    const dispatchItems = rows.filter(r => r.dispatch > 0);
    if (dispatchItems.length === 0) {
      setError('Enter at least one dispatch quantity.'); return;
    }
    setSubmitting(true);
    setError('');
    try {
      await storeroomApi.createTransfer({
        request_id: request.id,
        from_location_id: request.fulfilling_location_id,
        to_location_id: request.requesting_location_id,
        items: dispatchItems.map(r => ({
          catalog_id: r.catalog_id,
          quantity_dispatched: r.dispatch,
        })),
      }, token!, tenantSlug!);
      onDone?.();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to dispatch transfer.');
    } finally { setSubmitting(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28, width: 580, maxHeight: '90vh',
        overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>Dispatch Transfer</h3>
        <p style={{ margin: '0 0 18px', fontSize: 12, color: '#6b7280' }}>
          From <strong>{request.fulfilling_location_name ?? request.fulfilling_location_id}</strong> →{' '}
          <strong>{request.requesting_location_name ?? request.requesting_location_id}</strong>
        </p>

        {loading ? (
          <div style={{ padding: '20px 0', color: '#6b7280', fontSize: 13 }}>Loading stock levels…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['Item', 'Batch', 'Expiry', 'Available', 'Dispatch'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, fontWeight: 700, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.catalog_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px', fontWeight: 600 }}>{row.item_name}</td>
                  <td style={{ padding: '8px', color: '#6b7280' }}>{row.batch_number ?? '—'}</td>
                  <td style={{ padding: '8px', color: row.expiry_date && new Date(row.expiry_date) < new Date(Date.now() + 30 * 86400000) ? '#dc2626' : '#374151' }}>
                    {row.expiry_date ? new Date(row.expiry_date).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '8px', fontWeight: 700, color: row.available === 0 ? '#dc2626' : '#16a34a' }}>
                    {row.available}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="number" min={0} max={row.available}
                      value={row.dispatch}
                      disabled={row.available === 0}
                      onChange={e => updateDispatch(row.catalog_id, Number(e.target.value))}
                      style={{
                        width: 70, padding: '4px 8px', border: '1px solid #d1d5db',
                        borderRadius: 6, fontSize: 13, textAlign: 'center',
                        background: row.available === 0 ? '#f9fafb' : '#fff',
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 20px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleDispatch}
            disabled={submitting || loading}
            style={{
              padding: '8px 24px', background: '#16a34a', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: submitting || loading ? 'not-allowed' : 'pointer',
              opacity: submitting || loading ? 0.7 : 1,
            }}
          >
            {submitting ? 'Dispatching…' : 'Dispatch'}
          </button>
        </div>
      </div>
    </div>
  );
}
