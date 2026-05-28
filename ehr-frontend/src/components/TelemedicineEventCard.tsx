import React from 'react';

interface PostcallEvent {
  id: string;
  call_ended_at: string;
  duration_seconds: number;
  status: 'processing' | 'completed' | 'failed' | 'skipped';
  soap_note: string | null;
  escalation_level: string;
}

interface Props {
  event: PostcallEvent;
  onRetry?: (id: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  completed: '#16a34a',
  processing: '#2563eb',
  failed: '#dc2626',
  skipped: '#9ca3af',
};

const ESCALATION_COLOR: Record<string, string> = {
  critical: '#dc2626',
  urgent: '#f97316',
  routine: '#2563eb',
  none: '#9ca3af',
};

export const TelemedicineEventCard: React.FC<Props> = ({ event, onRetry }) => {
  const statusColor = STATUS_COLOR[event.status] ?? '#9ca3af';
  const escalationColor = ESCALATION_COLOR[event.escalation_level] ?? '#9ca3af';

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>
          Telemedicine — {new Date(event.call_ended_at).toLocaleString()}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '2px 8px',
          borderRadius: 12, backgroundColor: statusColor + '20',
          color: statusColor,
        }}>
          {event.status.toUpperCase()}
        </span>
      </div>

      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
        Duration: {Math.round(event.duration_seconds / 60)} min
        {event.escalation_level && event.escalation_level !== 'none' && (
          <span style={{ marginLeft: 12, fontWeight: 700, color: escalationColor }}>
            Escalation: {event.escalation_level.toUpperCase()}
          </span>
        )}
      </div>

      {event.soap_note && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: '#2563eb' }}>
            View AI-Generated SOAP Note
          </summary>
          <pre style={{
            marginTop: 8, padding: 12, backgroundColor: '#f9fafb',
            borderRadius: 6, fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'monospace',
          }}>
            {event.soap_note}
          </pre>
        </details>
      )}

      {event.status === 'failed' && onRetry && (
        <button
          onClick={() => onRetry(event.id)}
          style={{
            marginTop: 8, padding: '4px 12px', backgroundColor: '#f97316',
            color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
          }}
        >
          Retry Pipeline
        </button>
      )}
    </div>
  );
};
