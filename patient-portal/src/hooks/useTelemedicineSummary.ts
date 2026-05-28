import { useEffect, useState } from 'react';
import api from '../services/api';

export function useTelemedicineSummary(patientId: string) {
  const [summaryReady, setSummaryReady] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    const poll = setInterval(async () => {
      try {
        const res = await api.get('/patient-portal/notifications?type=telemedicine_summary&limit=1');
        const notifications: unknown[] = res.data ?? [];
        if (notifications.length > 0) {
          setSummaryReady(true);
          clearInterval(poll);
        }
      } catch {
        // silent — non-fatal polling failure
      }
    }, 10000);
    return () => clearInterval(poll);
  }, [patientId]);

  return { summaryReady };
}
