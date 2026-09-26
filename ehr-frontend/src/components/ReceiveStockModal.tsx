import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { storeroomApi } from '../services/api';

interface Props {
  defaultLocationId?: string;
  onClose: () => void;
  onDone?: () => void;
}

export default function ReceiveStockModal({ defaultLocationId, onClose, onDone }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = useMemo(() => localStorage.getItem('ehr_token') ?? '', []);
  const [locations, setLocations] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [locationId, setLocationId] = useState(defaultLocationId ?? '');
  const [catalogId, setCatalogId] = useState('');
  const [search, setSearch] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      storeroomApi.listLocations(token!, tenantSlug!),
      storeroomApi.listCatalog({}, token!, tenantSlug!),
    ]).then(([locs, cats]) => {
      setLocations(locs);
      setCatalog(cats);
      if (!defaultLocationId && locs.length > 0) {
        const central = locs.find((l: any) => l.code === 'CENTRAL');
        setLocationId(central ? central.id : locs[0].id);
      }
    });
  }, [token, tenantSlug, defaultLocationId]);

  const selectedItem = catalog.find((c: any) => c.id === catalogId);
  const filtered = catalog.filter((c: any) =>
    search.length > 1 &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.code?.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 8);

  async function handleSubmit() {
    if (!locationId || !catalogId || quantity <= 0) {
      setError('Select a location, an item, and a quantity greater than zero.'); return;
    }
    setSubmitting(true);
    setError('');
    try {
      await storeroomApi.receiveStock({
        location_id: locationId,
        catalog_id: catalogId,
        batch_number: batchNumber || undefined,
        expiry_date: expiryDate || undefined,
        quantity,
        unit_cost: unitCost ? Number(unitCost) : undefined,
        notes: notes || undefined,
      }, token!, tenantSlug!);
      onDone?.();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to receive stock.');
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
        <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800 }}>Receive Stock</h3>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
            Location
          </label>
          <select
            value={locationId}
            onChange={e => setLocationId(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
          >
            <option value="">Select…</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14, position: 'relative' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
            Item
          </label>
          {selectedItem ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13,
            }}>
              <span style={{ fontWeight: 600 }}>{selectedItem.name}</span>
              <button
                onClick={() => { setCatalogId(''); setSearch(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}
              >×</button>
            </div>
          ) : (
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search catalog…"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
            />
          )}
          {!selectedItem && filtered.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
              zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}>
              {filtered.map((c: any) => (
                <div
                  key={c.id}
                  onClick={() => { setCatalogId(c.id); setSearch(''); }}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Batch Number
            </label>
            <input
              value={batchNumber}
              onChange={e => setBatchNumber(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Expiry Date
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Quantity
            </label>
            <input
              type="number" min={1} value={quantity}
              onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              Unit Cost (optional)
            </label>
            <input
              type="number" min={0} step="0.01" value={unitCost}
              onChange={e => setUnitCost(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
        </div>

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
            {submitting ? 'Receiving…' : 'Receive Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}
