import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface DataPoint {
  recorded_at: string;
  value: number;
  is_flagged: boolean;
}

interface TrendAlert {
  id: string;
  reading_type: string;
  alert_level: string;
  message: string;
}

const READING_TYPES = [
  { key: 'bp_systolic',  label: 'SBP (mmHg)' },
  { key: 'bp_diastolic', label: 'DBP (mmHg)' },
  { key: 'heart_rate',   label: 'HR (bpm)' },
  { key: 'glucose',      label: 'Glucose (mmol/L)' },
  { key: 'spo2',         label: 'SpO₂ (%)' },
] as const;

export function WearableTimelinePanel({ patientId }: { patientId: string }) {
  const [selected, setSelected] = useState<string>('bp_systolic');
  const [points, setPoints] = useState<DataPoint[]>([]);
  const [alerts, setAlerts] = useState<TrendAlert[]>([]);

  useEffect(() => {
    loadTimeline(selected);
    loadAlerts();
  }, [patientId, selected]);

  async function loadTimeline(type: string) {
    const { data } = await api.get(`/wearable/timeline/${patientId}?type=${type}&days=7`);
    setPoints(data ?? []);
  }

  async function loadAlerts() {
    const { data } = await api.get(`/wearable/alerts?patientId=${patientId}`);
    setAlerts(data ?? []);
  }

  async function acknowledge(alertId: string) {
    await api.patch(`/wearable/alerts/${alertId}/acknowledge`, {});
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }

  const max = Math.max(...points.map((p) => p.value), 1);
  const visibleAlerts = alerts.filter((a) => a.reading_type === selected);

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-gray-800 text-sm">Wearable / Home Device Readings</h4>
        {alerts.length > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            {alerts.length} trend alert{alerts.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {READING_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setSelected(t.key)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              selected === t.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sparkline */}
      <div className="flex items-end gap-0.5 h-20 mb-2 border-b border-gray-100 pb-1">
        {points.length === 0 ? (
          <span className="text-xs text-gray-400 self-center mx-auto">No data for last 7 days</span>
        ) : (
          points.map((p, i) => (
            <div
              key={i}
              title={`${new Date(p.recorded_at).toLocaleDateString()}: ${p.value}`}
              className={`flex-1 rounded-t transition-all ${
                p.is_flagged ? 'bg-red-400' : 'bg-blue-400'
              }`}
              style={{ height: `${Math.max(4, (p.value / max) * 72)}px` }}
            />
          ))
        )}
      </div>

      {/* Date range label */}
      {points.length > 0 && (
        <div className="flex justify-between text-xs text-gray-400 mb-3">
          <span>{new Date(points[0].recorded_at).toLocaleDateString()}</span>
          <span>{new Date(points[points.length - 1].recorded_at).toLocaleDateString()}</span>
        </div>
      )}

      {/* Trend alerts for selected type */}
      {visibleAlerts.map((a) => (
        <div
          key={a.id}
          className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg mb-1 ${
            a.alert_level === 'critical'
              ? 'bg-red-50 border border-red-300 text-red-700'
              : 'bg-amber-50 border border-amber-300 text-amber-700'
          }`}
        >
          <span>⚠ {a.message}</span>
          <button
            onClick={() => acknowledge(a.id)}
            className="ml-3 underline text-xs opacity-70 hover:opacity-100"
          >
            Acknowledge
          </button>
        </div>
      ))}
    </div>
  );
}
