import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { storeroomApi } from '../services/api';

interface DashboardStats {
  total_catalog_items: number;
  stockout_count: number;
  low_stock_count: number;
  open_alerts: number;
  pending_requests: number;
  expiring_soon: Array<{ item_name: string; location_name: string; expiry_date: string; quantity_on_hand: number }>;
}

interface Props {
  compact?: boolean;
}

export default function StoreroomDashboard({ compact = false }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const token = useMemo(() => localStorage.getItem('ehr_token') ?? '', []);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storeroomApi.getDashboard(token!, tenantSlug!)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [token, tenantSlug]);

  if (loading) return <div style={{ padding: 16, color: '#6b7280' }}>Loading storeroom…</div>;
  if (!stats) return null;

  const statCards = [
    { label: 'Catalog Items', value: stats.total_catalog_items, color: '#1d4ed8' },
    { label: 'Stockouts', value: stats.stockout_count, color: stats.stockout_count > 0 ? '#dc2626' : '#16a34a' },
    { label: 'Low Stock', value: stats.low_stock_count, color: stats.low_stock_count > 0 ? '#d97706' : '#16a34a' },
    { label: 'Open Alerts', value: stats.open_alerts, color: stats.open_alerts > 0 ? '#7c3aed' : '#16a34a' },
    { label: 'Pending Requests', value: stats.pending_requests, color: stats.pending_requests > 0 ? '#0369a1' : '#6b7280' },
  ];

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: compact ? 12 : 20 }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#111827' }}>
        Central Storeroom
      </h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {statCards.map(card => (
          <div
            key={card.label}
            style={{
              background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
              padding: '10px 14px', minWidth: 90,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{card.label}</div>
          </div>
        ))}
      </div>
      {!compact && stats.expiring_soon.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
            Expiring within 30 days
          </div>
          {stats.expiring_soon.slice(0, 5).map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex', justifyContent: 'space-between', fontSize: 12,
                padding: '4px 0', borderBottom: '1px solid #f3f4f6', color: '#374151',
              }}
            >
              <span>{item.item_name} — {item.location_name}</span>
              <span style={{ color: '#dc2626' }}>
                {item.quantity_on_hand} units · {new Date(item.expiry_date).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
