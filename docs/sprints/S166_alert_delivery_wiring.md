# Sprint S166 — Clinical Alert Delivery Wiring

## Sprint Goal
Wire the OI Early Warning Service and the NEWS2 Early Warning Service into the existing `AlertDeliveryService.broadcastCriticalAlert()` method so that computed clinical alerts are actually delivered to on-call staff via FCM push, WebSocket, and SMS. Currently both services compute alerts and write them to the DB but never call the delivery layer.

## Prerequisites
- None. This is a Phase 1 sprint and has no dependencies.

## Scope
### In Scope
- Add `AlertDeliveryService` injection to `OiEarlyWarningService`
- Call `broadcastCriticalAlert` after every `saveAlerts()` call in `OiEarlyWarningService`
- Add `AlertDeliveryService` injection to `EarlyWarningService`
- Call `broadcastCriticalAlert` after every NEWS2 alert is generated
- New DB table `ai_alert_delivery_log` to track per-patient alert delivery history
- EHR: Alert badge counter on nurse worklist nav item
- Mobile: Push notification handler for received clinical alerts (tap → opens worklist)

### Out of Scope
- Changing AlertDeliveryService internals
- Changing the alert UI display (already exists in `alert-delivery.controller.ts`)

---

## Step 1 — Database Provisioning

**File:** `services/tenant-service/src/services/database-provisioning.service.ts`

Add this bundle inside the array returned by `getProvisioningBundles()`, after the last existing bundle:

```typescript
{
  id: 'ai_alert_delivery_log',
  label: 'Clinical Alert Delivery Audit Log',
  version: '2026.05.27.1',
  description: 'Tracks every AI-generated clinical alert delivery attempt with outcome and acknowledgement metadata',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS ai_alert_delivery_log (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID        NOT NULL,
      alert_type      VARCHAR(64) NOT NULL,
      source_service  VARCHAR(64) NOT NULL,
      severity        VARCHAR(16) NOT NULL,
      message         TEXT        NOT NULL,
      delivery_method VARCHAR(32) NOT NULL DEFAULT 'broadcast',
      delivered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      acknowledged_at TIMESTAMPTZ,
      acknowledged_by UUID,
      staff_notified  INTEGER     NOT NULL DEFAULT 0,
      payload         JSONB       NOT NULL DEFAULT '{}'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_alert_log_patient ON ai_alert_delivery_log (patient_id, delivered_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_alert_log_severity ON ai_alert_delivery_log (severity, acknowledged_at) WHERE acknowledged_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS idx_alert_log_service ON ai_alert_delivery_log (source_service, delivered_at DESC)`,
  ],
},
```

---

## Step 2 — Extend OiEarlyWarningService

**File:** `services/ehr-service/src/services/oi-early-warning.service.ts`

Find the existing `saveAlerts()` method. It saves alerts to the DB but does not deliver them. You need to:

1. Inject `AlertDeliveryService` into the constructor.
2. After saving alerts, call `broadcastCriticalAlert` for each alert with severity `urgent` or `critical`.
3. Write a delivery log entry to `ai_alert_delivery_log`.

**Add this import at the top of the file:**
```typescript
import { AlertDeliveryService, AlertPayload } from './alert-delivery.service';
import { TenantService } from './tenant.service';
```

**Modify the constructor** — add `AlertDeliveryService` and `TenantService` as optional injected dependencies (use `@Optional()` to avoid breaking existing tests):
```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
// ... existing imports ...
import { AlertDeliveryService, AlertPayload } from './alert-delivery.service';
import { TenantService } from './tenant.service';

@Injectable()
export class OiEarlyWarningService {
  private readonly logger = new Logger(OiEarlyWarningService.name);

  constructor(
    @Optional() private readonly alertDeliveryService: AlertDeliveryService,
    @Optional() private readonly tenantService: TenantService,
  ) {}

  // ... existing methods unchanged ...

  async saveAlerts(patientId: string, alerts: OiAlert[], db: any): Promise<void> {
    // ── existing logic: save each alert to DB ──
    for (const alert of alerts) {
      await db.query(
        `INSERT INTO oi_early_warning_alerts
           (patient_id, alert_type, severity, message, recommended_action, guideline_reference)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (patient_id, alert_type) DO UPDATE SET
           severity = EXCLUDED.severity,
           message = EXCLUDED.message,
           updated_at = now()`,
        [patientId, alert.alertType, alert.severity, alert.message, alert.recommendedAction, alert.guidelineReference],
      );
    }

    // ── NEW: deliver critical/urgent alerts ──
    if (!this.alertDeliveryService || !this.tenantService) return;

    const tenantId: string = db.options?.database ?? '';
    if (!tenantId) return;

    const subdomain = await this.resolveTenantSubdomain(tenantId);
    if (!subdomain) return;

    for (const alert of alerts) {
      if (alert.severity !== 'critical' && alert.severity !== 'urgent') continue;

      const payload: AlertPayload = {
        alertType: `oi_${alert.alertType}`,
        sourceEntityId: patientId,
        patientId,
        severity: alert.severity,
        message: alert.message,
        payload: {
          recommendedAction: alert.recommendedAction,
          guidelineReference: alert.guidelineReference,
          sourceService: 'OiEarlyWarningService',
        },
      };

      await this.alertDeliveryService.broadcastCriticalAlert(subdomain, payload);

      await db.query(
        `INSERT INTO ai_alert_delivery_log
           (patient_id, alert_type, source_service, severity, message, delivered_at)
         VALUES ($1, $2, $3, $4, $5, now())`,
        [patientId, alert.alertType, 'OiEarlyWarningService', alert.severity, alert.message],
      );
    }
  }

  private async resolveTenantSubdomain(dbName: string): Promise<string | null> {
    try {
      const tenants = await this.tenantService.getAllTenants();
      const found = tenants.find((t: any) => t.dbName === dbName || t.database === dbName);
      return found?.subdomain ?? found?.slug ?? null;
    } catch {
      return null;
    }
  }
}
```

---

## Step 3 — Extend EarlyWarningService

**File:** `services/ehr-service/src/services/early-warning.service.ts`

The `EarlyWarningService` computes NEWS2 scores and generates deterioration alerts. Find the method that produces NEWS2 alerts (likely `assessVitals` or `computeScore`). Add alert delivery after the score is computed.

**Add import at top:**
```typescript
import { AlertDeliveryService, AlertPayload } from './alert-delivery.service';
import { TenantService } from './tenant.service';
```

**Modify constructor to inject both services with `@Optional()`:**
```typescript
constructor(
  @Optional() private readonly alertDeliveryService: AlertDeliveryService,
  @Optional() private readonly tenantService: TenantService,
) {}
```

**After the NEWS2 score is computed and an alert object is returned**, add:
```typescript
// ── Deliver if score is HIGH (≥5) or CRITICAL (≥7) ──
private async deliverNews2Alert(
  patientId: string,
  news2Score: number,
  alertMessage: string,
  db: any,
): Promise<void> {
  if (!this.alertDeliveryService) return;
  if (news2Score < 5) return; // only high/critical NEWS2

  const severity = news2Score >= 7 ? 'critical' : 'high';
  const tenantId: string = db.options?.database ?? '';
  if (!tenantId) return;
  const subdomain = await this.resolveTenantSubdomain(tenantId);
  if (!subdomain) return;

  const payload: AlertPayload = {
    alertType: 'news2_deterioration',
    sourceEntityId: patientId,
    patientId,
    severity,
    message: `NEWS2 score ${news2Score}: ${alertMessage}`,
    payload: { news2Score, sourceService: 'EarlyWarningService' },
  };

  await this.alertDeliveryService.broadcastCriticalAlert(subdomain, payload);

  await db.query(
    `INSERT INTO ai_alert_delivery_log
       (patient_id, alert_type, source_service, severity, message, delivered_at)
     VALUES ($1, $2, $3, $4, $5, now())`,
    [patientId, 'news2_deterioration', 'EarlyWarningService', severity, payload.message],
  );
}

private async resolveTenantSubdomain(dbName: string): Promise<string | null> {
  try {
    const tenants = await this.tenantService.getAllTenants();
    const found = tenants.find((t: any) => t.dbName === dbName || t.database === dbName);
    return found?.subdomain ?? found?.slug ?? null;
  } catch {
    return null;
  }
}
```

Call `await this.deliverNews2Alert(patientId, news2Score, alertMessage, db)` at the end of any method that computes a NEWS2 score above threshold.

---

## Step 4 — Register in ehr.module.ts

**File:** `services/ehr-service/src/ehr.module.ts`

`AlertDeliveryService` and `TenantService` are already likely in `providers`. Verify they are present. If `OiEarlyWarningService` was not already receiving them, it will now get them via NestJS DI automatically because they are in the same module's `providers` array.

No change needed if both services are already providers. Verify with:
```bash
grep -n "AlertDeliveryService\|OiEarlyWarningService\|EarlyWarningService" services/ehr-service/src/ehr.module.ts
```
All three must appear in `providers: []`. If any are missing, add them.

---

## Step 5 — EHR Frontend: Alert Badge on Nurse Nav

**File:** `ehr-frontend/src/components/NavSidebar.tsx` (or equivalent nav component)

Add an unacknowledged alert count badge next to the Worklist nav item:

```tsx
// Add to imports
import { useEffect, useState } from 'react';
import { ehrApi } from '../services/api'; // adjust import to actual api service

// Inside the nav component, add:
const [unackedAlerts, setUnackedAlerts] = useState(0);

useEffect(() => {
  const fetchAlerts = async () => {
    try {
      const res = await ehrApi.get('/security/alert-delivery/unacknowledged');
      setUnackedAlerts(res.data?.length ?? 0);
    } catch { /* silent */ }
  };
  fetchAlerts();
  const interval = setInterval(fetchAlerts, 30000); // poll every 30s
  return () => clearInterval(interval);
}, []);

// In the JSX where the Worklist nav item is rendered, wrap with:
<div className="relative">
  {/* existing nav item */}
  {unackedAlerts > 0 && (
    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
      {unackedAlerts > 99 ? '99+' : unackedAlerts}
    </span>
  )}
</div>
```

---

## Step 6 — Mobile: Push Notification Handler

**File:** `mobile/src/App.tsx` or `mobile/src/navigation/RootNavigator.tsx`

Add a listener for incoming push notifications that navigates to the worklist:

```typescript
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

// Inside the root component:
const navigationRef = useRef<any>(null);

useEffect(() => {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as any;
    if (data?.alertType && navigationRef.current) {
      // Navigate to nurse worklist or patient detail
      if (data.patientId) {
        navigationRef.current.navigate('PatientDetail', { patientId: data.patientId });
      } else {
        navigationRef.current.navigate('NurseWorklist');
      }
    }
  });
  return () => subscription.remove();
}, []);
```

**File:** `mobile/src/i18n/locales/en/translation.json` — add these keys:
```json
"alerts": {
  "clinical_alert": "Clinical Alert",
  "oi_warning": "OI Early Warning",
  "news2_high": "Patient Deterioration — NEWS2 High",
  "tap_to_view": "Tap to view patient",
  "acknowledged": "Acknowledged",
  "unacknowledged": "Unacknowledged"
}
```

Add the same keys (translated) to: `sn, nd, pt, fr, sw, zu, af` translation files.

**Shona (sn):**
```json
"alerts": {
  "clinical_alert": "Yambiro yeMutiriri",
  "oi_warning": "Yambiro ye-OI",
  "news2_high": "Murwere Ari Kusiyana — NEWS2 Yakakwira",
  "tap_to_view": "Dzvanya kuona murwere",
  "acknowledged": "Zvinzwika",
  "unacknowledged": "Zvisina kunzwika"
}
```

**Ndebele (nd):**
```json
"alerts": {
  "clinical_alert": "Isexwayiso Sezemvelo",
  "oi_warning": "Isexwayiso se-OI",
  "news2_high": "Umkhulelwa Uyashintsha — NEWS2 Iphezulu",
  "tap_to_view": "Thepha ukubona umguli",
  "acknowledged": "Kwamukelwa",
  "unacknowledged": "Akwamukelwanga"
}
```

**Portuguese (pt):**
```json
"alerts": {
  "clinical_alert": "Alerta Clínico",
  "oi_warning": "Aviso de IO Precoce",
  "news2_high": "Deterioração do Paciente — NEWS2 Alto",
  "tap_to_view": "Toque para ver o paciente",
  "acknowledged": "Confirmado",
  "unacknowledged": "Não confirmado"
}
```

**French (fr):**
```json
"alerts": {
  "clinical_alert": "Alerte Clinique",
  "oi_warning": "Alerte IO Précoce",
  "news2_high": "Détérioration du Patient — NEWS2 Élevé",
  "tap_to_view": "Appuyer pour voir le patient",
  "acknowledged": "Reconnu",
  "unacknowledged": "Non reconnu"
}
```

**Swahili (sw):**
```json
"alerts": {
  "clinical_alert": "Tahadhari ya Kliniki",
  "oi_warning": "Onyo la OI la Mapema",
  "news2_high": "Mgonjwa Anazorota — NEWS2 Juu",
  "tap_to_view": "Gusa kuona mgonjwa",
  "acknowledged": "Imethibitishwa",
  "unacknowledged": "Haijathibitishwa"
}
```

**Zulu (zu):**
```json
"alerts": {
  "clinical_alert": "Isexwayiso Sezokwelapha",
  "oi_warning": "Isexwayiso se-OI Esakuqala",
  "news2_high": "Isimo Somguli Sishintsha — NEWS2 Phezulu",
  "tap_to_view": "Thepha ukubona umguli",
  "acknowledged": "Kwamkelwe",
  "unacknowledged": "Akwamkelwanga"
}
```

**Afrikaans (af):**
```json
"alerts": {
  "clinical_alert": "Kliniese Waarskuwing",
  "oi_warning": "OI Vroeë Waarskuwing",
  "news2_high": "Pasiënt Agteruitgang — NEWS2 Hoog",
  "tap_to_view": "Tik om pasiënt te sien",
  "acknowledged": "Bevestig",
  "unacknowledged": "Nie bevestig nie"
}
```

---

## Step 7 — Test Spec

**File:** `services/ehr-service/src/services/oi-early-warning-wiring.spec.ts`

```typescript
import { OiEarlyWarningService } from './oi-early-warning.service';
import { AlertDeliveryService } from './alert-delivery.service';
import { TenantService } from './tenant.service';

describe('OiEarlyWarningService — alert delivery wiring', () => {
  let service: OiEarlyWarningService;
  let alertDelivery: jest.Mocked<AlertDeliveryService>;
  let tenantService: jest.Mocked<TenantService>;
  let db: any;

  beforeEach(() => {
    alertDelivery = {
      broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined),
    } as any;
    tenantService = {
      getAllTenants: jest.fn().mockResolvedValue([
        { dbName: 'clinic_test_db', subdomain: 'testclinic' },
      ]),
    } as any;
    db = {
      query: jest.fn().mockResolvedValue([]),
      options: { database: 'clinic_test_db' },
    };
    service = new OiEarlyWarningService(alertDelivery, tenantService);
  });

  it('broadcasts critical alert when severity is critical', async () => {
    const alerts = [{
      alertType: 'cryptococcal',
      severity: 'critical',
      message: 'CD4 < 100 — start fluconazole prophylaxis',
      recommendedAction: 'Start fluconazole 200mg daily',
      guidelineReference: 'WHO 2021 consolidated HIV guidelines §5.4',
    }];
    await service.saveAlerts('patient-1', alerts, db);
    expect(alertDelivery.broadcastCriticalAlert).toHaveBeenCalledWith(
      'testclinic',
      expect.objectContaining({
        alertType: 'oi_cryptococcal',
        patientId: 'patient-1',
        severity: 'critical',
      }),
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('ai_alert_delivery_log'),
      expect.any(Array),
    );
  });

  it('does NOT broadcast when severity is low', async () => {
    const alerts = [{ alertType: 'general', severity: 'low', message: 'Monitor', recommendedAction: '', guidelineReference: '' }];
    await service.saveAlerts('patient-1', alerts, db);
    expect(alertDelivery.broadcastCriticalAlert).not.toHaveBeenCalled();
  });

  it('does not throw if alertDeliveryService is undefined', async () => {
    const svc = new OiEarlyWarningService(undefined as any, undefined as any);
    await expect(svc.saveAlerts('p1', [], db)).resolves.not.toThrow();
  });
});
```

---

## Acceptance Criteria

1. When a patient's CD4 drops below 200, `OiEarlyWarningService.saveAlerts()` writes to `ai_alert_delivery_log` AND calls `AlertDeliveryService.broadcastCriticalAlert()`.
2. When a patient's NEWS2 score is ≥ 5, `EarlyWarningService` calls `AlertDeliveryService.broadcastCriticalAlert()`.
3. Alerts with severity `low` or `medium` are saved to DB but NOT broadcast via push/SMS.
4. If `AlertDeliveryService` is not injected (e.g., in a test with no DI), no exception is thrown.
5. The `ai_alert_delivery_log` table exists in all 3 tenant DBs after running `provision-repair-all.sh`.
6. The EHR nurse nav shows a red badge with the unacknowledged alert count, updating every 30 seconds.
7. On mobile, tapping a clinical push notification navigates to the patient detail screen.
8. All 8 i18n locale files contain the `alerts` translation keys.
9. `npm test` passes in `services/ehr-service/` with the new spec file.
10. `tsc --noEmit` passes in all three frontend workspaces.

## Definition of Done
- [ ] Provisioning bundle `ai_alert_delivery_log` added and verified in all tenant DBs
- [ ] `OiEarlyWarningService` injects and calls `AlertDeliveryService` for critical/urgent OI alerts
- [ ] `EarlyWarningService` injects and calls `AlertDeliveryService` for NEWS2 ≥ 5
- [ ] Alert badge added to EHR nurse nav
- [ ] Mobile push handler navigates to correct screen
- [ ] i18n keys added to all 8 locales
- [ ] Test spec passes
- [ ] `tsc --noEmit` clean
- [ ] `provision-repair-all.sh` runs without error
