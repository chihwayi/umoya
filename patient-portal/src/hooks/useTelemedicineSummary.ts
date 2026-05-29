import { useEffect, useState } from 'react';
import { patientPortalApi } from '../services/api';

export function useTelemedicineSummary(patientId: string, token: string, tenantSlug: string) {
  const [summaryReady, setSummaryReady] = useState(false);

  useEffect(() => {
    if (!patientId || !token || !tenantSlug) return;
    const poll = setInterval(async () => {
      try {
        const notifications = await patientPortalApi.getNotifications(token, tenantSlug, {
          notificationType: 'telemedicine_summary',
          limit: 1,
        });
        if ((notifications as unknown[]).length > 0) {
          setSummaryReady(true);
          clearInterval(poll);
        }
      } catch {
        // silent — non-fatal polling failure
      }
    }, 10000);
    return () => clearInterval(poll);
  }, [patientId, token, tenantSlug]);

  return { summaryReady };
}
