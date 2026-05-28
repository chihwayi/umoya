import React from 'react';

export type AiStatus =
  | 'active'
  | 'unavailable'
  | 'abstained'
  | 'low_confidence'
  | 'loading';

interface Props {
  status: AiStatus;
  reason?: string;
  compact?: boolean;
}

const CONFIG: Record<AiStatus, { label: string; color: string; bg: string; icon: string }> = {
  active:         { label: 'AI Active',       color: '#16a34a', bg: '#dcfce7', icon: '●' },
  unavailable:    { label: 'AI Unavailable',  color: '#dc2626', bg: '#fee2e2', icon: '✕' },
  abstained:      { label: 'AI Abstained',    color: '#f97316', bg: '#ffedd5', icon: '○' },
  low_confidence: { label: 'Low Confidence',  color: '#d97706', bg: '#fef9c3', icon: '◐' },
  loading:        { label: 'AI Analysing...', color: '#2563eb', bg: '#dbeafe', icon: '⟳' },
};

export const AiStatusBadge: React.FC<Props> = ({ status, reason, compact = false }) => {
  const cfg = CONFIG[status];
  return (
    <span
      title={reason}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: compact ? '1px 6px' : '3px 10px',
        borderRadius: 12,
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        backgroundColor: cfg.bg,
        color: cfg.color,
        cursor: reason ? 'help' : 'default',
      }}
    >
      <span style={{ fontSize: compact ? 8 : 10 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
};
