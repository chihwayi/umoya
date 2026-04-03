import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Alert {
  id: string;
  patientId: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  recommendedAction?: string;
  guidelineReference?: string;
}

const SEVERITY_COLOR = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-400 text-black',
  low: 'bg-blue-500 text-white',
};

export function ProactiveAlertBell({ userId, token, dark = false }: { userId: string; token: string; dark?: boolean }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const socket: Socket = io(`${process.env.REACT_APP_EHR_API_URL}/alerts`, {
      auth: { userId, token },
    });

    socket.on('connect', () => {
      fetch(`${process.env.REACT_APP_EHR_API_URL}/proactive/alerts/ward`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => setAlerts(data || []));
    });

    socket.on('clinical_alert', (payload: any) => {
      if (payload.type === 'proactive_analysis' && payload.alerts?.length) {
        setAlerts(prev => {
          const newAlerts = payload.alerts as Alert[];
          const ids = new Set(prev.map(a => a.id));
          return [...prev, ...newAlerts.filter(a => !ids.has(a.id))];
        });
      }
    });

    return () => { socket.disconnect(); };
  }, [userId, token]);

  const critical = alerts.filter(a => a.severity === 'critical').length;
  const total = alerts.length;

  const acknowledge = async (alertId: string) => {
    await fetch(`${process.env.REACT_APP_EHR_API_URL}/proactive/alerts/${alertId}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`relative p-2 rounded-lg transition-colors ${dark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
      >
        <svg className={`w-6 h-6 ${dark ? 'text-white' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {total > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-xs flex items-center justify-center font-bold ${critical > 0 ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>
            {total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-[420px] max-h-[500px] overflow-y-auto bg-slate-800 rounded-xl shadow-2xl border border-slate-600 z-50">
          <div className="p-3 border-b border-slate-600 flex justify-between items-center">
            <h3 className="text-white font-semibold text-sm">Clinical Alerts ({total})</h3>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
          </div>
          {alerts.length === 0 && (
            <div className="p-4 text-slate-400 text-sm text-center">No active alerts</div>
          )}
          {alerts.map(alert => (
            <div key={alert.id} className={`p-3 border-b border-slate-700 ${alert.severity === 'critical' ? 'border-l-4 border-l-red-500' : alert.severity === 'high' ? 'border-l-4 border-l-orange-500' : ''}`}>
              <div className="flex justify-between items-start mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLOR[alert.severity]}`}>
                  {alert.severity.toUpperCase()}
                </span>
                <button onClick={() => acknowledge(alert.id)} className="text-slate-500 hover:text-slate-300 text-xs">✓ Ack</button>
              </div>
              <p className="text-white text-sm font-medium">{alert.title}</p>
              <p className="text-slate-300 text-xs mt-1">{alert.message}</p>
              {alert.recommendedAction && (
                <p className="text-amber-400 text-xs mt-1">→ {alert.recommendedAction}</p>
              )}
              {alert.guidelineReference && (
                <p className="text-slate-500 text-xs mt-1 italic">{alert.guidelineReference}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
