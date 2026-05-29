import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Props {
  appointmentId: string;
}

type IntakeStatus = 'complete' | 'pending' | 'not_sent';

const STATUS_MAP: Record<IntakeStatus, { label: string; classes: string }> = {
  complete: { label: '✓ Intake done',     classes: 'bg-green-100 text-green-700' },
  pending:  { label: '⏳ Awaiting intake', classes: 'bg-amber-100 text-amber-700' },
  not_sent: { label: 'No intake sent',    classes: 'bg-gray-100 text-gray-500' },
};

export function IntakeStatusBadge({ appointmentId }: Props) {
  const [status, setStatus] = useState<IntakeStatus>('not_sent');

  useEffect(() => {
    api
      .get(`/intake/status/${appointmentId}`)
      .then((r: any) => setStatus((r.data ?? r).status ?? 'not_sent'))
      .catch(() => {});
  }, [appointmentId]);

  const { label, classes } = STATUS_MAP[status];

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classes}`}>
      {label}
    </span>
  );
}
