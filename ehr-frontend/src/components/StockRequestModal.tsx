import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { storeroomApi } from '../services/api';

interface Props {
  defaultItems?: Array<{ catalog_id: string; item_name: string; quantity?: number }>;
  requestingLocationId?: string;
  onClose: () => void;
  onDone?: () => void;
}

export default function StockRequestModal({
  defaultItems = [], requestingLocationId, onClose, onDone,
}: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = useMemo(() => localStorage.getItem('ehr_token') ?? '', []);
  const [locations, setLocations] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [fromLocation, setFromLocation] = useState(requestingLocationId ?? '');
  const [toLocation, setToLocation] = useState('');
  const [priority, setPriority] = useState<'routine' | 'urgent'>('routine');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{ catalog_id: string; item_name: string; quantity_requested: number }>>(
    defaultItems.map(d => ({ catalog_id: d.catalog_id, item_name: d.item_name, quantity_requested: d.quantity ?? 1 }))
  );
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      storeroomApi.listLocations(token!, tenantSlug!),
      storeroomApi.listCatalog({}, token!, tenantSlug!),
    ]).then(([locs, cats]) => {
      setLocations(locs);
      setCatalog(cats);
      const central = locs.find((l: any) => l.code === 'CENTRAL');
      if (central) setToLocation(central.id);
    });
  }, [token, tenantSlug]);

  function addItem(catalogItem: any) {
    if (items.some(i => i.catalog_id === catalogItem.id)) return;
    setItems(prev => [...prev, { catalog_id: catalogItem.id, item_name: catalogItem.name, quantity_requested: 1 }]);
    setSearch('');
  }

  function updateQty(catalogId: string, qty: number) {
    setItems(prev => prev.map(i => i.catalog_id === catalogId ? { ...i, quantity_requested: Math.max(1, qty) } : i));
  }

  function removeItem(catalogId: string) {
    setItems(prev => prev.filter(i => i.catalog_id !== catalogId));
  }

  async function handleSubmit() {
    if (!fromLocation || !toLocation || items.length === 0) {
      setError('Select locations and add at least one item.'); return;
    }
    setSubmitting(true);
    setError('');
    try {
      await storeroomApi.createRequest({
        requesting_location_id: fromLocation,
        fulfilling_location_id: toLocation,
        priority, notes: notes || undefined,
        items,
      }, token!, tenantSlug!);
      onDone?.();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to submit request.');
    } finally { setSubmitting(false); }
  }

  const filtered = catalog.filter(c =>
    search.length > 1 &&
    !items.some(i => i.catalog_id === c.id) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.code?.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 8);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28, width: 540, maxHeight: '90vh',
        overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800 }}>Request Stock</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Requesting Location
            </label>
            <select
              value={fromLocation}
              onChange={e => setFromLocation(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
            >
              <option value="">Select…</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Fulfil From
            </label>
            <select
              value={toLocation}
              onChange={e => setToLocation(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
            >
              <option value="">Select…</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
            Priority
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['routine', 'urgent'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                style={{
                  padding: '6px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: priority === p ? (p === 'urgent' ? '#fee2e2' : '#dbeafe') : '#f9fafb',
                  color: priority === p ? (p === 'urgent' ? '#dc2626' : '#1d4ed8') : '#6b7280',
                  border: `1px solid ${priority === p ? (p === 'urgent' ? '#fca5a5' : '#93c5fd') : '#e5e7eb'}`,
                }}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14, position: 'relative' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
            Add Items
          </label>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search catalog…"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
          />
          {filtered.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
              zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}>
              {filtered.map((c: any) => (
                <div
                  key={c.id}
                  onClick={() => addItem(c)}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 11 }}>{c.category} · {c.unit_of_measure}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div style={{ marginBottom: 14, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            {items.map((item, idx) => (
              <div
                key={item.catalog_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  borderBottom: idx < items.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}
              >
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{item.item_name}</span>
                <input
                  type="number" min={1} value={item.quantity_requested}
                  onChange={e => updateQty(item.catalog_id, Number(e.target.value))}
                  style={{ width: 70, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                />
                <button
                  onClick={() => removeItem(item.catalog_id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', marginBottom: 14 }}
        />

        {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 20px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding: '8px 24px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
