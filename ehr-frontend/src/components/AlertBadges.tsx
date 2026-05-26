import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface AlertCounts {
  oiAlerts: number;
  anomalyEvents: number;
  overdueMmd: number;
}

interface AlertBadgesProps {
  token?: string;
  apiBase?: string;
}

export const AlertBadges: React.FC<AlertBadgesProps> = ({
  token = localStorage.getItem('token') ?? '',
  apiBase = '',
}) => {
  const [counts, setCounts] = useState<AlertCounts>({
    oiAlerts: 0,
    anomalyEvents: 0,
    overdueMmd: 0,
  });

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io('/alerts', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('alert-counts', (data: AlertCounts) => {
      setCounts(data);
    });

    const pollAnomalies = () => {
      fetch(`${apiBase}/security/anomalies?page=1`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setCounts((prev) => ({ ...prev, anomalyEvents: data.total ?? 0 }));
          }
        })
        .catch(() => undefined);
    };

    pollAnomalies();
    const interval = setInterval(pollAnomalies, 60_000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [token, apiBase]);

  if (counts.oiAlerts === 0 && counts.anomalyEvents === 0 && counts.overdueMmd === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {counts.oiAlerts > 0 && (
        <span
          title="Unacknowledged OI Alerts"
          style={{
            background: '#e53e3e',
            color: '#fff',
            borderRadius: 12,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          OI: {counts.oiAlerts}
        </span>
      )}
      {counts.anomalyEvents > 0 && (
        <span
          title="Security Anomalies"
          style={{
            background: '#dd6b20',
            color: '#fff',
            borderRadius: 12,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          &#9888; {counts.anomalyEvents}
        </span>
      )}
      {counts.overdueMmd > 0 && (
        <span
          title="Overdue MMD Pickups"
          style={{
            background: '#3182ce',
            color: '#fff',
            borderRadius: 12,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          MMD: {counts.overdueMmd}
        </span>
      )}
    </div>
  );
};
