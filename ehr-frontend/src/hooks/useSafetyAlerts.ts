import { useCallback, useEffect, useMemo, useState } from 'react';
import { ehrApi } from '../services/api';

export interface SafetyAlert {
  id: string;
  patientId: string;
  patientName: string;
  patientRoom?: string;
  alertType: 'allergy' | 'fall_risk' | 'isolation' | 'critical_vitals' | 'medication' | 'lab' | 'general' | 'escalation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  details?: string;
  createdAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  isActive: boolean;
  requiresAction: boolean;
  actionRequired?: string;
  relatedData?: any;
  whyShown?: string;
  whyNow?: string;
  trustSummary?: {
    sourceLabel?: string;
    backingType?: string;
    reviewState?: string;
    classifierStage?: string;
    workflowSource?: string;
    recommendationCount?: number | null;
    evidenceCount?: number | null;
    riskBand?: string | null;
  };
}

export interface SafetyAlertCounts {
  total: number;
  active: number;
  critical: number;
  high: number;
  acknowledged: number;
}

/**
 * Single source of truth for nurse Patient Safety Alerts.
 *
 * Both the notification bell badge (in NurseDashboard) and the Patient Safety
 * Alerts page read from this hook, so the counts can never diverge. It merges:
 *   1. Client-side, appointment-derived alerts (allergy / fall-risk / critical vitals),
 *      de-duplicated per patient+condition so one patient with several appointments
 *      doesn't inflate the count.
 *   2. Server-side clinical escalations (e.g. NEWS2 escalations) from the feed.
 * Acknowledgements are honoured from server state AND optimistic local state, so an
 * acknowledged alert drops out of the active count everywhere immediately.
 */
export function useSafetyAlerts(appointments: any[], currentUserId?: string) {
  const [serverAcknowledgedIds, setServerAcknowledgedIds] = useState<Set<string>>(new Set());
  const [localAcknowledgedIds, setLocalAcknowledgedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [serverEscalationAlerts, setServerEscalationAlerts] = useState<SafetyAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const loadState = useCallback(async () => {
    try {
      const token = localStorage.getItem('ehr_token');
      const tenantSlug = localStorage.getItem('ehr_tenant_slug');
      if (!token || !tenantSlug) return;
      setLoading(true);
      const [stateResponse, escalationResponse] = await Promise.all([
        ehrApi.getNurseWorklistState(token, tenantSlug),
        ehrApi.getClinicalEscalationFeed(token, tenantSlug, { includeCompleted: true, limit: 50 }),
      ]);
      setServerAcknowledgedIds(new Set<string>(stateResponse.data?.acknowledgedAlertIds || []));
      const escalationAlerts: SafetyAlert[] = Array.isArray(escalationResponse.data?.items)
        ? escalationResponse.data.items.map((item: any) => ({
            id: item.id,
            patientId: item.patientId,
            patientName: item.patientName || item.patientNumber || 'Unknown patient',
            alertType: 'escalation' as const,
            severity: item.severity || 'medium',
            title: item.title || 'Clinical escalation',
            description: item.summary || 'Clinical escalation requires follow-up.',
            details: item.recommendedAction || undefined,
            createdAt: item.dueAt || new Date().toISOString(),
            acknowledgedBy: item.status === 'acknowledged' ? 'clinical_escalation' : undefined,
            acknowledgedAt: item.acknowledgedAt || undefined,
            isActive: item.status !== 'completed',
            requiresAction: item.status !== 'completed',
            actionRequired: item.recommendedAction || 'Review escalation and complete follow-up.',
            relatedData: {
              escalationTaskId: item.id,
              sourceModule: item.sourceModule,
              earlyWarning: item.earlyWarning,
              remoteMonitoring: item.remoteMonitoring,
            },
            whyShown:
              item.trustSummary?.sourceLabel ||
              (item.sourceModule ? `Raised from ${item.sourceModule.replace(/_/g, ' ')} workflow.` : 'Raised from clinical escalation workflow.'),
            whyNow:
              item.trustSummary?.riskBand
                ? `Risk band ${String(item.trustSummary.riskBand).toLowerCase()} requires clinician follow-up.`
                : item.earlyWarning?.riskLevel
                  ? `Risk level ${item.earlyWarning.riskLevel} requires nurse follow-up.`
                  : 'Escalation remains open for nurse action.',
            trustSummary: item.trustSummary || undefined,
          }))
        : [];
      setServerEscalationAlerts(escalationAlerts);
    } catch {
      // Feed is best-effort; appointment-derived alerts still render.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState, currentUserId]);

  const alerts = useMemo<SafetyAlert[]>(() => {
    const realAlerts: SafetyAlert[] = [];
    const now = new Date();
    // De-dupe per patient+condition: the same patient across multiple appointments
    // must surface a condition only once (it previously counted once per appointment).
    const seen = new Set<string>();
    const push = (alert: SafetyAlert) => {
      if (seen.has(alert.id)) return;
      seen.add(alert.id);
      realAlerts.push(alert);
    };

    (appointments || []).forEach((apt) => {
      if (!apt?.patient) return;
      const patientId = apt.patient.id;
      const patientName = `${apt.patient.firstName} ${apt.patient.lastName}`;

      if (apt.patient.allergies && apt.patient.allergies.length > 0) {
        push({
          id: `allergy-${patientId}`,
          patientId, patientName, alertType: 'allergy', severity: 'high',
          title: 'Known Allergies',
          description: `Patient has known allergies: ${apt.patient.allergies}`,
          details: 'Verify all medications and treatments for allergen exposure',
          createdAt: now.toISOString(), isActive: true, requiresAction: true,
          actionRequired: 'Verify medication compatibility',
          relatedData: { allergies: apt.patient.allergies },
          whyShown: 'Patient has recorded allergies in chart.',
          whyNow: 'Alert raised while patient is on today’s triage queue.',
        });
      }

      if (apt.patient.age && apt.patient.age > 65) {
        push({
          id: `fall-${patientId}`,
          patientId, patientName, alertType: 'fall_risk', severity: 'medium',
          title: 'Fall Risk Patient',
          description: `Patient age ${apt.patient.age} - high fall risk`,
          details: 'Implement fall prevention measures: bed alarm, non-slip socks, frequent checks',
          createdAt: now.toISOString(), isActive: true, requiresAction: true,
          actionRequired: 'Implement fall prevention protocol',
        });
      }

      if (apt.vitals) {
        const vitals = apt.vitals;
        if (vitals.bloodPressure) {
          const bpValues = String(vitals.bloodPressure).split('/');
          if (bpValues.length === 2) {
            const systolic = parseInt(bpValues[0]);
            const diastolic = parseInt(bpValues[1]);
            if (systolic >= 180 || diastolic >= 110) {
              push({
                id: `bp-${patientId}`,
                patientId, patientName, alertType: 'critical_vitals', severity: 'critical',
                title: 'Critical Blood Pressure',
                description: `Blood pressure: ${vitals.bloodPressure} mmHg`,
                details: 'Immediate medical attention required. Notify physician immediately.',
                createdAt: now.toISOString(), isActive: true, requiresAction: true,
                actionRequired: 'Notify physician immediately',
                relatedData: { vitals },
                whyShown: 'Blood pressure is in critical range.',
                whyNow: 'Most recent vitals crossed critical BP threshold.',
              });
            }
          }
        }
        if (vitals.heartRate && (vitals.heartRate > 120 || vitals.heartRate < 50)) {
          push({
            id: `hr-${patientId}`,
            patientId, patientName, alertType: 'critical_vitals', severity: 'high',
            title: 'Abnormal Heart Rate',
            description: `Heart rate: ${vitals.heartRate} bpm`,
            details: 'Heart rate outside normal range. Monitor closely.',
            createdAt: now.toISOString(), isActive: true, requiresAction: true,
            actionRequired: 'Monitor closely and reassess',
            relatedData: { vitals },
            whyShown: 'Heart rate outside defined safe range.',
            whyNow: 'Latest vitals show tachycardia or bradycardia.',
          });
        }
        if (vitals.temperature && (vitals.temperature > 38.5 || vitals.temperature < 35)) {
          push({
            id: `temp-${patientId}`,
            patientId, patientName, alertType: 'critical_vitals', severity: 'high',
            title: 'Abnormal Temperature',
            description: `Temperature: ${vitals.temperature}°C`,
            details: 'Temperature outside normal range. Consider infection or hypothermia.',
            createdAt: now.toISOString(), isActive: true, requiresAction: true,
            actionRequired: 'Assess for infection or other causes',
            relatedData: { vitals },
            whyShown: 'Temperature suggests fever or hypothermia.',
            whyNow: 'Latest vitals temperature is outside configured range.',
          });
        }
        if (vitals.oxygenSaturation && vitals.oxygenSaturation < 90) {
          push({
            id: `o2-${patientId}`,
            patientId, patientName, alertType: 'critical_vitals', severity: 'critical',
            title: 'Low Oxygen Saturation',
            description: `Oxygen saturation: ${vitals.oxygenSaturation}%`,
            details: 'Oxygen saturation below 90%. Immediate attention required.',
            createdAt: now.toISOString(), isActive: true, requiresAction: true,
            actionRequired: 'Administer oxygen and notify physician',
            relatedData: { vitals },
            whyShown: 'Oxygen saturation below 90%.',
            whyNow: 'Latest vitals show hypoxia requiring urgent review.',
          });
        }
      }
    });

    const merged = [...realAlerts, ...serverEscalationAlerts];

    // Apply acknowledgement + dismissal state from server + optimistic local sets.
    return merged.map((alert) => {
      const acknowledged =
        Boolean(alert.acknowledgedAt) ||
        serverAcknowledgedIds.has(alert.id) ||
        localAcknowledgedIds.has(alert.id);
      const dismissed = dismissedIds.has(alert.id);
      if (acknowledged) {
        return {
          ...alert,
          acknowledgedAt: alert.acknowledgedAt || now.toISOString(),
          acknowledgedBy: alert.acknowledgedBy || currentUserId || 'current_user',
          isActive: false,
        };
      }
      if (dismissed) return { ...alert, isActive: false };
      return alert;
    });
  }, [appointments, serverEscalationAlerts, serverAcknowledgedIds, localAcknowledgedIds, dismissedIds, currentUserId]);

  const counts = useMemo<SafetyAlertCounts>(() => ({
    total: alerts.length,
    active: alerts.filter((a) => a.isActive && !a.acknowledgedAt).length,
    critical: alerts.filter((a) => a.severity === 'critical' && !a.acknowledgedAt).length,
    high: alerts.filter((a) => a.severity === 'high' && !a.acknowledgedAt).length,
    acknowledged: alerts.filter((a) => a.acknowledgedAt).length,
  }), [alerts]);

  const acknowledge = useCallback(async (alertId: string) => {
    const token = localStorage.getItem('ehr_token');
    const tenantSlug = localStorage.getItem('ehr_tenant_slug');
    if (!token || !tenantSlug) return;
    const alert = alerts.find((a) => a.id === alertId);
    // Optimistic update first so the badge/list react instantly.
    setLocalAcknowledgedIds((prev) => new Set(prev).add(alertId));
    try {
      if (alert?.alertType === 'escalation' && alert.relatedData?.escalationTaskId) {
        await ehrApi.acknowledgeClinicalEscalation(alert.relatedData.escalationTaskId, token, tenantSlug);
      } else {
        await ehrApi.acknowledgeNurseAlert(
          alertId,
          { patientId: alert?.patientId, context: { alertType: alert?.alertType, severity: alert?.severity } },
          token,
          tenantSlug,
        );
      }
      setServerAcknowledgedIds((prev) => new Set(prev).add(alertId));
    } catch {
      // Roll back the optimistic ack if the server call failed.
      setLocalAcknowledgedIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  }, [alerts]);

  const dismiss = useCallback((alertId: string) => {
    setDismissedIds((prev) => new Set(prev).add(alertId));
  }, []);

  return { alerts, counts, acknowledge, dismiss, loading, refresh: loadState };
}
