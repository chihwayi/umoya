// R3 / FX-018 RED: critical-result ack restricted to ordering clinician or
// on-duty covering role; receptionist ack denied; time-based escalation routes
// to whoever is actually covering (on-call roster, not a static list); an
// unacknowledged alert re-surfaces instead of silently expiring.
import { ForbiddenException } from '@nestjs/common';
import { LabCriticalAlertService } from './lab-critical-alert.service';

const ALERT_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const ORDERING_DOC = '11111111-1111-4111-8111-111111111111';
const COVERING_DOC = '22222222-2222-4222-8222-222222222222';
const RECEPTIONIST = '33333333-3333-4333-8333-333333333333';
const OFFDUTY_DOC = '44444444-4444-4444-8444-444444444444';
const PATIENT = '55555555-5555-4555-8555-555555555555';
const LAB_ORDER = '66666666-6666-4666-8666-666666666666';

function alertRow(alertedMinutesAgo: number, status = 'pending') {
  const d = new Date(Date.now() - alertedMinutesAgo * 60000);
  return {
    id: ALERT_ID, patient_id: PATIENT, lab_order_id: LAB_ORDER,
    component_name: 'Potassium', result_value: '6.8 mmol/L',
    severity: 'critical', alert_status: status, alerted_to: ORDERING_DOC,
    alerted_at: d, acknowledged_by: null, acknowledged_at: null,
    escalated_to: null, escalated_at: null,
  };
}

function fakeTenantDb(opts: {
  alertAgeMinutes?: number;
  alertStatus?: string;
  onCall: Array<{ user_id: string; role: string; ward?: string }>;
  ward?: string;
}) {
  const alert = alertRow(opts.alertAgeMinutes ?? 5, opts.alertStatus ?? 'pending');
  const calls: string[] = [];
  return {
    calls,
    query: async (sql: string, params: any[] = []) => {
      calls.push(sql.split('\n')[0].trim());
      if (/FROM lab_critical_alerts/.test(sql) && /WHERE lca.id = \$1|WHERE id = \$1/.test(sql)) {
        return params[0] === ALERT_ID ? [{ ...alert }] : [];
      }
      if (/FROM lab_orders/.test(sql)) {
        return [{ id: LAB_ORDER, patient_id: PATIENT, ordering_provider_id: ORDERING_DOC }];
      }
      if (/FROM users/.test(sql) && /WHERE id = \$1|WHERE u.id = \$1/.test(sql)) {
        const id = params[0];
        const roles: Record<string, string> = {
          [ORDERING_DOC]: 'doctor', [COVERING_DOC]: 'doctor',
          [RECEPTIONIST]: 'receptionist', [OFFDUTY_DOC]: 'doctor',
        };
        return [{ id, role: roles[id] || 'doctor' }];
      }
      if (/staff_duty_shifts/.test(sql)) {
        return opts.onCall.map((r) => ({ user_id: r.user_id, role: r.role, ward: r.ward ?? opts.ward ?? 'Ward A', status: 'scheduled', on_call: true }));
      }
      if (/FROM admissions/.test(sql)) {
        return opts.ward ? [{ id: 'adm-1', ward_location_id: 'loc-1' }] : [];
      }
      if (/FROM inventory_locations/.test(sql)) {
        return opts.ward ? [{ id: 'loc-1', name: opts.ward }] : [];
      }
      if (/UPDATE lab_critical_alerts/.test(sql) && /acknowledged/.test(sql)) {
        Object.assign(alert, { alert_status: 'acknowledged', acknowledged_by: params[0], acknowledged_at: new Date() });
        return [{ ...alert }];
      }
      if (/UPDATE lab_critical_alerts/.test(sql) && /escalated/.test(sql)) {
        Object.assign(alert, { alert_status: 'escalated', escalated_to: params[0], escalated_at: new Date() });
        return [{ ...alert }];
      }
      if (/FROM lab_critical_alerts/.test(sql)) {
        // pending-list query: escalated-but-unacknowledged must re-surface
        if (alert.acknowledged_at) return [];
        return [{ ...alert }];
      }
      return [];
    },
  } as any;
}

describe('R3 FX-018 critical-result ack + escalation (red)', () => {
  test('receptionist ack is denied (403), same pattern as R2 role gates', async () => {
    const svc = new LabCriticalAlertService();
    const db = fakeTenantDb({ onCall: [] });
    await expect(
      svc.acknowledgeAlert(db, ALERT_ID, { userId: RECEPTIONIST, role: 'receptionist' }),
    ).rejects.toThrow(ForbiddenException);
  });

  test('ordering clinician ack succeeds', async () => {
    const svc = new LabCriticalAlertService();
    const db = fakeTenantDb({ onCall: [] });
    const row = await svc.acknowledgeAlert(db, ALERT_ID, { userId: ORDERING_DOC, role: 'doctor' }, 'seen, repeat in 1h');
    expect(row.alert_status).toBe('acknowledged');
  });

  test('on-duty covering doctor (not the orderer) ack succeeds', async () => {
    const svc = new LabCriticalAlertService();
    const db = fakeTenantDb({ onCall: [{ user_id: COVERING_DOC, role: 'doctor' }], ward: 'Ward A' });
    const row = await svc.acknowledgeAlert(
      db, ALERT_ID, { userId: COVERING_DOC, role: 'doctor' }, undefined, { ward: 'Ward A' },
    );
    expect(row.alert_status).toBe('acknowledged');
  });

  test('off-duty doctor with no covering relationship is denied', async () => {
    const svc = new LabCriticalAlertService();
    const db = fakeTenantDb({ onCall: [{ user_id: COVERING_DOC, role: 'doctor' }] });
    await expect(
      svc.acknowledgeAlert(db, ALERT_ID, { userId: OFFDUTY_DOC, role: 'doctor' }),
    ).rejects.toThrow(ForbiddenException);
  });

  test('escalation timer fires and reaches the off-shift covering role', async () => {
    const svc = new LabCriticalAlertService();
    const db = fakeTenantDb({ alertAgeMinutes: 45, onCall: [{ user_id: COVERING_DOC, role: 'doctor' }], ward: 'Ward A' });
    const out = await svc.autoEscalateUnacknowledgedAlerts(db, 30, { ward: 'Ward A' });
    expect(out.escalated).toBe(1);
    const pending: any = await svc.getPendingAlerts(db);
    const escalated = pending.alerts.find((a: any) => a.id === ALERT_ID);
    expect(escalated).toBeDefined();
    expect(escalated.escalated_to).toBe(COVERING_DOC);
  });

  test('unacknowledged alert re-surfaces after escalation instead of expiring', async () => {
    const svc = new LabCriticalAlertService();
    const db = fakeTenantDb({ onCall: [{ user_id: COVERING_DOC, role: 'doctor' }] });
    await svc.escalateAlert(db, ALERT_ID, COVERING_DOC, ORDERING_DOC);
    const pending: any = await svc.getPendingAlerts(db);
    expect(pending.alerts.map((a: any) => a.id)).toContain(ALERT_ID);
  });

  test('no covering on-call: alert stays pending and is reported, never silently dropped', async () => {
    const svc = new LabCriticalAlertService();
    const db = fakeTenantDb({ alertAgeMinutes: 90, onCall: [] });
    const out = await svc.autoEscalateUnacknowledgedAlerts(db, 30);
    expect(out.escalated).toBe(0);
    expect(out.unescalated).toBe(1);
    const pending: any = await svc.getPendingAlerts(db);
    expect(pending.alerts.map((a: any) => a.id)).toContain(ALERT_ID);
  });
});
