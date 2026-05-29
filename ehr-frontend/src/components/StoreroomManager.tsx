import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { storeroomApi, ehrAxios } from '../services/api';
import StockRequestModal from './StockRequestModal';
import StockTransferModal from './StockTransferModal';

const TABS = ['Overview', 'Inventory', 'Requests', 'Transfers', 'Catalog', 'Intelligence'] as const;
type Tab = typeof TABS[number];

export default function StoreroomManager() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = useMemo(() => localStorage.getItem('ehr_token') ?? '', []);
  const [tab, setTab] = useState<Tab>('Overview');

  // Overview
  const [dashboard, setDashboard] = useState<any>(null);

  // Inventory
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [stock, setStock] = useState<any[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  // Requests
  const [requests, setRequests] = useState<any[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState<any>(null);

  // Transfers
  const [transfers, setTransfers] = useState<any[]>([]);

  // Catalog
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catSearch, setCatSearch] = useState('');
  const [catCategory, setCatCategory] = useState('');

  // Intelligence
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [reorderSuggestions, setReorderSuggestions] = useState<any[]>([]);
  const [forecastLocationId, setForecastLocationId] = useState('');
  const [forecastCatalogId, setForecastCatalogId] = useState('');
  const [forecastResult, setForecastResult] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBase();
  }, [token, tenantSlug]);

  async function loadBase() {
    setLoading(true);
    try {
      const [locs, dash, reqs, trans] = await Promise.all([
        storeroomApi.listLocations(token!, tenantSlug!),
        storeroomApi.getDashboard(token!, tenantSlug!),
        storeroomApi.listRequests({}, token!, tenantSlug!),
        storeroomApi.listTransfers({}, token!, tenantSlug!),
      ]);
      setLocations(locs);
      setDashboard(dash);
      setRequests(reqs);
      setTransfers(trans);
      if (locs.length > 0 && !selectedLocation) setSelectedLocation(locs[0].id);
    } catch { setError('Failed to load storeroom data.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!selectedLocation || tab !== 'Inventory') return;
    setStockLoading(true);
    Promise.all([
      storeroomApi.getStockByLocation(selectedLocation, {}, token!, tenantSlug!),
      storeroomApi.getAlerts(token!, tenantSlug!),
    ]).then(([s, a]) => {
      setStock(s);
      setAlerts(a);
    }).finally(() => setStockLoading(false));
  }, [selectedLocation, tab, token, tenantSlug]);

  useEffect(() => {
    if (tab !== 'Catalog') return;
    storeroomApi.listCatalog({ category: catCategory || undefined, search: catSearch || undefined }, token!, tenantSlug!)
      .then(setCatalog);
  }, [tab, catSearch, catCategory, token, tenantSlug]);

  useEffect(() => {
    if (tab !== 'Intelligence') return;
    Promise.all([
      ehrAxios.get('/storeroom/intelligence/anomalies', { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } }),
      ehrAxios.get('/storeroom/intelligence/reorder-suggestions', { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } }),
    ]).then(([a, r]) => {
      setAnomalies(a.data ?? []);
      setReorderSuggestions(r.data ?? []);
    }).catch(() => {});
  }, [tab, token, tenantSlug]);

  const alertMap = new Set(alerts.map((a: any) => a.catalog_id + ':' + a.location_id));

  function statusBadge(status: string) {
    const map: Record<string, { bg: string; color: string }> = {
      pending: { bg: '#fef9c3', color: '#854d0e' },
      approved: { bg: '#dbeafe', color: '#1d4ed8' },
      dispatched: { bg: '#ede9fe', color: '#6d28d9' },
      received: { bg: '#dcfce7', color: '#166534' },
      rejected: { bg: '#fee2e2', color: '#dc2626' },
      routine: { bg: '#f3f4f6', color: '#374151' },
      urgent: { bg: '#fee2e2', color: '#dc2626' },
    };
    const s = map[status] ?? { bg: '#f3f4f6', color: '#374151' };
    return (
      <span style={{
        background: s.bg, color: s.color, borderRadius: 6, padding: '2px 8px',
        fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
      }}>{status}</span>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)',
        padding: '24px 32px', color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>📦</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Central Storeroom</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.8 }}>
              Inventory · Requests · Transfers
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 20 }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: tab === t ? '#fff' : 'rgba(255,255,255,0.15)',
                color: tab === t ? '#1d4ed8' : '#fff',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {loading && <div style={{ color: '#6b7280', fontSize: 13 }}>Loading…</div>}
        {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {/* ── Overview ── */}
        {tab === 'Overview' && dashboard && (
          <div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              {[
                { label: 'Catalog Items', value: dashboard.total_catalog_items, color: '#1d4ed8' },
                { label: 'Stockouts', value: dashboard.stockout_count, color: dashboard.stockout_count > 0 ? '#dc2626' : '#16a34a' },
                { label: 'Low Stock', value: dashboard.low_stock_count, color: dashboard.low_stock_count > 0 ? '#d97706' : '#16a34a' },
                { label: 'Open Alerts', value: dashboard.open_alerts, color: dashboard.open_alerts > 0 ? '#7c3aed' : '#16a34a' },
                { label: 'Pending Requests', value: dashboard.pending_requests, color: '#0369a1' },
              ].map(card => (
                <div key={card.label} style={{
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
                  padding: '16px 20px', minWidth: 110,
                }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{card.label}</div>
                </div>
              ))}
            </div>
            {dashboard.expiring_soon?.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 10 }}>
                  Expiring within 30 days
                </div>
                {dashboard.expiring_soon.slice(0, 10).map((item: any, idx: number) => (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: 13,
                    padding: '6px 0', borderBottom: '1px solid #f3f4f6',
                  }}>
                    <span>{item.item_name} — <span style={{ color: '#6b7280' }}>{item.location_name}</span></span>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                      {item.quantity_on_hand} units · {new Date(item.expiry_date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Inventory ── */}
        {tab === 'Inventory' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <select
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
              >
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                {stock.length} items
              </span>
            </div>
            {stockLoading ? (
              <div style={{ color: '#6b7280', fontSize: 13 }}>Loading stock…</div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      {['Item', 'Category', 'Batch', 'Expiry', 'On Hand', 'Min Level', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map((s: any, idx: number) => {
                      const isAlert = alertMap.has(s.catalog_id + ':' + selectedLocation);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', background: isAlert ? '#fffbeb' : '#fff' }}>
                          <td style={{ padding: '9px 12px', fontWeight: 600 }}>{s.item_name ?? s.name}</td>
                          <td style={{ padding: '9px 12px', color: '#6b7280' }}>{s.category}</td>
                          <td style={{ padding: '9px 12px', color: '#6b7280' }}>{s.batch_number ?? '—'}</td>
                          <td style={{ padding: '9px 12px', color: s.expiry_date && new Date(s.expiry_date) < new Date(Date.now() + 30 * 86400000) ? '#dc2626' : '#374151' }}>
                            {s.expiry_date ? new Date(s.expiry_date).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: s.quantity_on_hand === 0 ? '#dc2626' : '#111827' }}>
                            {s.quantity_on_hand}
                          </td>
                          <td style={{ padding: '9px 12px', color: '#6b7280' }}>{s.min_level ?? '—'}</td>
                          <td style={{ padding: '9px 12px' }}>
                            {s.quantity_on_hand === 0
                              ? statusBadge('stockout')
                              : isAlert ? statusBadge('low stock') : <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 700 }}>OK</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {stock.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No stock records</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Requests ── */}
        {tab === 'Requests' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button
                onClick={() => setShowRequestModal(true)}
                style={{
                  padding: '8px 20px', background: '#1d4ed8', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                + New Request
              </button>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    {['Ref', 'From', 'To', 'Priority', 'Items', 'Status', 'Date', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r: any) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#1d4ed8', fontFamily: 'monospace', fontSize: 12 }}>{r.reference_number}</td>
                      <td style={{ padding: '9px 12px' }}>{r.requesting_location_name ?? r.requesting_location_id}</td>
                      <td style={{ padding: '9px 12px' }}>{r.fulfilling_location_name ?? r.fulfilling_location_id}</td>
                      <td style={{ padding: '9px 12px' }}>{statusBadge(r.priority)}</td>
                      <td style={{ padding: '9px 12px', color: '#6b7280' }}>{r.items?.length ?? 0}</td>
                      <td style={{ padding: '9px 12px' }}>{statusBadge(r.status)}</td>
                      <td style={{ padding: '9px 12px', color: '#6b7280', fontSize: 12 }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        {r.status === 'approved' && (
                          <button
                            onClick={() => setTransferTarget(r)}
                            style={{
                              padding: '4px 12px', background: '#16a34a', color: '#fff', border: 'none',
                              borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            Dispatch
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No requests</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Transfers ── */}
        {tab === 'Transfers' && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  {['Ref', 'From', 'To', 'Items', 'Status', 'Dispatched', 'Received'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transfers.map((t: any) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 700, color: '#7c3aed', fontFamily: 'monospace', fontSize: 12 }}>{t.reference_number}</td>
                    <td style={{ padding: '9px 12px' }}>{t.from_location_name ?? t.from_location_id}</td>
                    <td style={{ padding: '9px 12px' }}>{t.to_location_name ?? t.to_location_id}</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280' }}>{t.items?.length ?? 0}</td>
                    <td style={{ padding: '9px 12px' }}>{statusBadge(t.status)}</td>
                    <td style={{ padding: '9px 12px', color: '#6b7280', fontSize: 12 }}>
                      {t.dispatched_at ? new Date(t.dispatched_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', color: '#6b7280', fontSize: 12 }}>
                      {t.received_at ? new Date(t.received_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No transfers</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Catalog ── */}
        {tab === 'Intelligence' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* Demand Forecast card */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800 }}>Demand Forecast</h4>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <select
                  value={forecastLocationId}
                  onChange={e => setForecastLocationId(e.target.value)}
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12 }}
                >
                  <option value="">Select location…</option>
                  {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <select
                  value={forecastCatalogId}
                  onChange={e => setForecastCatalogId(e.target.value)}
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12 }}
                >
                  <option value="">Select item…</option>
                  {catalog.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button
                disabled={!forecastLocationId || !forecastCatalogId || forecastLoading}
                onClick={async () => {
                  setForecastLoading(true);
                  try {
                    const res = await ehrAxios.post('/storeroom/intelligence/forecast', {
                      location_id: forecastLocationId,
                      catalog_id: forecastCatalogId,
                      horizon_days: 30,
                    }, { headers: { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` } });
                    setForecastResult(res.data);
                  } catch { /* ignore */ } finally { setForecastLoading(false); }
                }}
                style={{ padding: '7px 18px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600, opacity: (!forecastLocationId || !forecastCatalogId || forecastLoading) ? 0.5 : 1 }}
              >
                {forecastLoading ? 'Forecasting…' : 'Run Forecast'}
              </button>
              {forecastResult && (
                <div style={{ marginTop: 14, padding: 12, background: '#f0f9ff', borderRadius: 8, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#1d4ed8', marginBottom: 4 }}>{forecastResult.predicted_qty} units</div>
                  <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>predicted over 30 days · {Math.round((forecastResult.confidence ?? 0) * 100)}% confidence</div>
                  <div style={{ color: forecastResult.days_of_supply < 7 ? '#dc2626' : '#374151', fontWeight: 600, marginBottom: 6 }}>Days of supply: {forecastResult.days_of_supply}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>{forecastResult.reasoning}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Source: {forecastResult.ai_source}</div>
                </div>
              )}
            </div>

            {/* Reorder Suggestions */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800 }}>
                Reorder Suggestions
                {reorderSuggestions.length > 0 && (
                  <span style={{ marginLeft: 8, background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '2px 8px', fontSize: 11 }}>{reorderSuggestions.length}</span>
                )}
              </h4>
              {reorderSuggestions.length === 0
                ? <p style={{ fontSize: 12, color: '#9ca3af' }}>No reorder suggestions. Run forecasts first.</p>
                : reorderSuggestions.slice(0, 8).map((r: any, idx: number) => (
                  <div key={idx} style={{ padding: '7px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: r.days_of_supply <= 3 ? '#dc2626' : '#374151' }}>{r.item_name}</div>
                    <div style={{ color: '#6b7280' }}>{r.location_name} · {r.days_of_supply}d supply · reorder {r.reorder_qty} units</div>
                  </div>
                ))
              }
            </div>

            {/* Anomalies */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, gridColumn: '1 / -1' }}>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800 }}>
                Consumption Anomalies
                {anomalies.length > 0 && (
                  <span style={{ marginLeft: 8, background: '#fef3c7', color: '#d97706', borderRadius: 10, padding: '2px 8px', fontSize: 11 }}>{anomalies.length}</span>
                )}
              </h4>
              {anomalies.length === 0
                ? <p style={{ fontSize: 12, color: '#9ca3af' }}>No anomalies detected in the last 30 days.</p>
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#fefce8' }}>
                        {['Item', 'Location', 'Type', 'Avg Daily', 'Recent Daily', 'Deviation'].map(h => (
                          <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #fde68a' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {anomalies.map((a: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '7px 10px', fontWeight: 700 }}>{a.item_name}</td>
                          <td style={{ padding: '7px 10px', color: '#6b7280' }}>{a.location_name}</td>
                          <td style={{ padding: '7px 10px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: a.anomaly_type === 'spike' ? '#fee2e2' : '#f3f4f6', color: a.anomaly_type === 'spike' ? '#dc2626' : '#6b7280' }}>
                              {a.anomaly_type === 'spike' ? 'SPIKE' : 'ZERO MOVEMENT'}
                            </span>
                          </td>
                          <td style={{ padding: '7px 10px' }}>{Number(a.avg_daily).toFixed(1)}</td>
                          <td style={{ padding: '7px 10px', fontWeight: 700, color: a.anomaly_type === 'spike' ? '#dc2626' : '#6b7280' }}>{Number(a.recent_3d_daily).toFixed(1)}</td>
                          <td style={{ padding: '7px 10px', color: '#7c3aed' }}>{a.anomaly_type === 'spike' ? `${a.deviation_factor}σ` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </div>
          </div>
        )}

        {tab === 'Catalog' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input
                value={catSearch}
                onChange={e => setCatSearch(e.target.value)}
                placeholder="Search items…"
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
              />
              <select
                value={catCategory}
                onChange={e => setCatCategory(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
              >
                <option value="">All categories</option>
                {['medicine', 'vaccine', 'consumable', 'test_kit', 'blood_product', 'equipment', 'other'].map(c => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    {['Name', 'Code', 'Category', 'Unit', 'ATC / LOINC', 'Cold Chain', 'Controlled'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((c: any) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{c.code ?? '—'}</td>
                      <td style={{ padding: '9px 12px' }}>{statusBadge(c.category)}</td>
                      <td style={{ padding: '9px 12px', color: '#6b7280' }}>{c.unit_of_measure}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#374151' }}>
                        {c.atc_code ?? c.loinc_code ?? '—'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        {c.requires_cold_chain ? <span style={{ color: '#0369a1', fontWeight: 700, fontSize: 11 }}>❄ Yes</span> : '—'}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        {c.is_controlled ? <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 11 }}>⚠ Yes</span> : '—'}
                      </td>
                    </tr>
                  ))}
                  {catalog.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No catalog items</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showRequestModal && (
        <StockRequestModal
          onClose={() => setShowRequestModal(false)}
          onDone={() => {
            setShowRequestModal(false);
            storeroomApi.listRequests({}, token!, tenantSlug!).then(setRequests);
          }}
        />
      )}

      {transferTarget && (
        <StockTransferModal
          request={transferTarget}
          onClose={() => setTransferTarget(null)}
          onDone={() => {
            setTransferTarget(null);
            Promise.all([
              storeroomApi.listRequests({}, token!, tenantSlug!),
              storeroomApi.listTransfers({}, token!, tenantSlug!),
            ]).then(([reqs, trans]) => { setRequests(reqs); setTransfers(trans); });
          }}
        />
      )}
    </div>
  );
}
