# NC-S13 — Grafana Clinical Monitoring Dashboards + Offline-First Hardening

**Sprint ID:** NC-S13  
**Priority:** High  
**Effort:** 8 days  
**Dependencies:** NC-S08 (cascade/retention metrics), NC-S04 (MMD), NC-S12 (backup/audit)  
**Gaps Covered:**
- Feature 9.1 — Grafana clinical operational dashboards (0% → 100%)
- Feature 9.2 — Offline-first conflict resolution for clinical forms (30% → 100%)
- Feature 9.3 — Offline entity coverage — extend to all clinical forms, not just vitals (40% → 100%)
- Feature 9.4 — Real-time alert badges in EHR sidebar (OI alerts, anomaly count) (0% → 100%)

---

## 1. Codebase Context

### Existing Offline Infrastructure
- `services/ehr-service/src/services/sync.service.ts` — exists; handles offline sync for vitals only (`patient_vitals` table)
- `services/ehr-service/src/services/conflict-resolver.service.ts` — stub: `resolveConflict()` always returns `remoteWins`
- `mobile/src/services/offlineQueue.ts` — queues mutations when offline; re-submits on reconnect
- `ehr-frontend/src/services/offlineSync.ts` — exists; IndexedDB backed by Dexie.js; covers `vitals`, `appointments` only
- No Grafana configuration files in codebase

### Existing Metrics Endpoints (from NC-S08)
- `GET /research/cascade?periodStart=&periodEnd=` — returns cascade snapshot
- `GET /research/retention?periodStart=&periodEnd=` — returns retention metrics
- `GET /hiv/mmd/overdue` — overdue MMD patients
- `GET /hiv/patients/:id/oi-alerts` — OI alerts for a patient (from NC-S03)

### Grafana Setup
- Grafana is NOT in `docker-compose.yml`; must be added
- Target: Grafana Cloud (free tier) OR self-hosted in docker-compose
- Prometheus node_exporter for infra metrics; PostgreSQL Grafana datasource for clinical metrics
- Grafana dashboard JSON provisioned as code (Infrastructure-as-Code approach)

---

## 2. What This Sprint Builds

### Part A — Grafana Docker Compose Addition + Datasource Config
Add Grafana + Prometheus to `docker-compose.yml`; provision datasources and dashboards as code.

### Part B — Clinical Dashboards (5 dashboards)
1. **95-95-95 Cascade Dashboard** — live gauges for second_95 and third_95; trend line over 12 months
2. **Retention & LTFU Dashboard** — LTFU rate, reengagement rate, 6/12/24-month retention bars
3. **OI Alert Operations Dashboard** — open OI alerts by type; acknowledged vs unacknowledged
4. **MMD Adherence Dashboard** — patients on 3-month / 6-month MMD; overdue pickup count
5. **Security Anomalies Dashboard** — anomaly events per day; breach incident status

### Part C — Conflict Resolution (Last-Writer-Wins + Merge Strategy)
Upgrade `ConflictResolverService` from stub to real logic:
- Clinical forms: if both offline and server changed different fields, **merge** (field-level merge)
- Same field changed by two writers: **most-recent-timestamp wins** (Last-Write-Wins, LWW)
- Appointments: **server always wins** (prevent double-booking)
- Lab results: **immutable** — never overwrite; reject conflict entirely

### Part D — Expand Offline Coverage
Add to `ehr-frontend/src/services/offlineSync.ts`:
- `hiv_clinical_visits`
- `hiv_counselling_sessions`
- `gbv_assessments`
- `disclosure_records`
- `alhiv_transition_assessments`
- `counsellor_sessions`

### Part E — Real-Time Alert Sidebar Badges
WebSocket subscription in EHR sidebar showing live counts: OI alerts, anomaly events, overdue MMD.

---

## 3. Database Changes

### 3.1 No new tenant tables needed.
### 3.2 Add `updated_at` to all offline-covered entities (required for LWW conflict resolution):

```typescript
// Add to nc_ussd_campaigns or a new bundle nc_offline_hardening:
{
  id: 'nc_offline_hardening',
  tables: [
    `DO $$ BEGIN
       -- Ensure updated_at exists on all synced entities
       ALTER TABLE hiv_clinical_visits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
       ALTER TABLE hiv_counselling_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
       ALTER TABLE gbv_assessments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
       ALTER TABLE hiv_disclosure_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
       ALTER TABLE alhiv_transition_assessments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
       ALTER TABLE counsellor_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
     END $$`,

    // Conflict log — track every resolved conflict for audit
    `CREATE TABLE IF NOT EXISTS sync_conflicts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(64) NOT NULL,
      entity_id UUID NOT NULL,
      client_version JSONB NOT NULL,
      server_version JSONB NOT NULL,
      resolution VARCHAR(32) NOT NULL,
      resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_by VARCHAR(64) NOT NULL DEFAULT 'system'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity ON sync_conflicts(entity_type, entity_id)`,
  ],
}
```

### 3.3 After provisioning: `POST /api/admin/tenants/repair-all`

---

## 4. Grafana Infrastructure

### 4.1 Add Grafana to `docker-compose.yml`

```yaml
# Add to services section:
grafana:
  image: grafana/grafana:10.4.2
  container_name: medicore_grafana
  ports:
    - "3001:3000"
  volumes:
    - grafana_data:/var/lib/grafana
    - ./infra/grafana/provisioning:/etc/grafana/provisioning
    - ./infra/grafana/dashboards:/var/lib/grafana/dashboards
  environment:
    GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-changeme}
    GF_SERVER_ROOT_URL: ${GRAFANA_ROOT_URL:-http://localhost:3001}
    GF_AUTH_ANONYMOUS_ENABLED: "false"
  depends_on:
    - postgres
  networks:
    - medicore_network

prometheus:
  image: prom/prometheus:v2.51.0
  container_name: medicore_prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus_data:/prometheus
  networks:
    - medicore_network

# Add to volumes section:
grafana_data:
prometheus_data:
```

### 4.2 Grafana Datasource Provisioning
**File:** `infra/grafana/provisioning/datasources/datasources.yaml`

```yaml
apiVersion: 1
datasources:
  - name: PostgreSQL-MediCore
    type: postgres
    url: postgres:5432
    database: medicore_production
    user: ${GRAFANA_DB_USER}
    secureJsonData:
      password: ${GRAFANA_DB_PASSWORD}
    jsonData:
      sslmode: disable
      maxOpenConns: 5
      connMaxLifetime: 14400
      postgresVersion: 1500
      timescaledb: false
    editable: false

  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    access: proxy
    editable: false
```

### 4.3 Dashboard Provisioning Config
**File:** `infra/grafana/provisioning/dashboards/dashboards.yaml`

```yaml
apiVersion: 1
providers:
  - name: MediCore Clinical
    folder: Newlands Clinic
    type: file
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true
```

### 4.4 95-95-95 Dashboard JSON
**File:** `infra/grafana/dashboards/cascade-95-95-95.json`

```json
{
  "title": "95-95-95 HIV Cascade",
  "uid": "nc-cascade-001",
  "tags": ["hiv", "cascade", "newlands"],
  "refresh": "5m",
  "panels": [
    {
      "id": 1,
      "title": "Second 95 (Diagnosed → On ART)",
      "type": "gauge",
      "targets": [{
        "rawSql": "SELECT second_95 FROM cascade_snapshots WHERE period_end = (SELECT MAX(period_end) FROM cascade_snapshots) LIMIT 1",
        "format": "table"
      }],
      "fieldConfig": { "defaults": { "min": 0, "max": 100, "unit": "percent",
        "thresholds": { "steps": [{"color":"red","value":0},{"color":"yellow","value":85},{"color":"green","value":95}] }
      }},
      "gridPos": {"x":0,"y":0,"w":6,"h":8}
    },
    {
      "id": 2,
      "title": "Third 95 (On ART → Suppressed)",
      "type": "gauge",
      "targets": [{
        "rawSql": "SELECT third_95 FROM cascade_snapshots WHERE period_end = (SELECT MAX(period_end) FROM cascade_snapshots) LIMIT 1",
        "format": "table"
      }],
      "fieldConfig": { "defaults": { "min": 0, "max": 100, "unit": "percent",
        "thresholds": { "steps": [{"color":"red","value":0},{"color":"yellow","value":85},{"color":"green","value":95}] }
      }},
      "gridPos": {"x":6,"y":0,"w":6,"h":8}
    },
    {
      "id": 3,
      "title": "Cascade Trend (12 months)",
      "type": "timeseries",
      "targets": [{
        "rawSql": "SELECT period_end AS time, second_95, third_95 FROM cascade_snapshots WHERE period_end > NOW() - INTERVAL '12 months' ORDER BY period_end",
        "format": "table"
      }],
      "gridPos": {"x":0,"y":8,"w":24,"h":10}
    }
  ]
}
```

### 4.5 LTFU / Retention Dashboard JSON
**File:** `infra/grafana/dashboards/retention-ltfu.json`
```json
{
  "title": "Retention & LTFU",
  "uid": "nc-retention-001",
  "tags": ["retention","ltfu","newlands"],
  "refresh": "5m",
  "panels": [
    {
      "id": 1, "title": "Current LTFU Rate (%)", "type": "stat",
      "targets": [{ "rawSql": "SELECT (ltfu_count::float / NULLIF(active_count,0) * 100)::numeric(5,1) as ltfu_rate FROM retention_snapshots ORDER BY computed_at DESC LIMIT 1", "format": "table" }],
      "gridPos": {"x":0,"y":0,"w":6,"h":6}
    },
    {
      "id": 2, "title": "Reengagement Count (30 days)", "type": "stat",
      "targets": [{ "rawSql": "SELECT COUNT(*) FROM ltfu_reengagement_log WHERE reengaged_at > NOW() - INTERVAL '30 days'", "format": "table" }],
      "gridPos": {"x":6,"y":0,"w":6,"h":6}
    },
    {
      "id": 3, "title": "6-Month Retention (%)", "type": "stat",
      "targets": [{ "rawSql": "SELECT retention_6m FROM retention_snapshots ORDER BY computed_at DESC LIMIT 1", "format": "table" }],
      "gridPos": {"x":12,"y":0,"w":6,"h":6}
    },
    {
      "id": 4, "title": "12-Month Retention (%)", "type": "stat",
      "targets": [{ "rawSql": "SELECT retention_12m FROM retention_snapshots ORDER BY computed_at DESC LIMIT 1", "format": "table" }],
      "gridPos": {"x":18,"y":0,"w":6,"h":6}
    }
  ]
}
```

---

## 5. Backend — Conflict Resolution Service

**File:** `services/ehr-service/src/services/conflict-resolver.service.ts` (full replacement of stub)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';

type Resolution = 'merge' | 'server_wins' | 'client_wins' | 'rejected';

// Entities where server always wins (prevent data corruption)
const SERVER_ALWAYS_WINS = ['appointments', 'lab_results'];
// Entities where changes are immutable
const IMMUTABLE_ENTITIES = ['lab_results', 'hiv_resistance_assessments'];

@Injectable()
export class ConflictResolverService {
  private readonly logger = new Logger(ConflictResolverService.name);

  constructor(private readonly db: DatabaseService) {}

  async resolveConflict(
    entityType: string,
    entityId: string,
    clientVersion: Record<string, unknown>,
    serverVersion: Record<string, unknown>,
    tenantDb: string,
  ): Promise<{ resolution: Resolution; merged: Record<string, unknown> | null }> {

    // Immutable entities — reject client update entirely
    if (IMMUTABLE_ENTITIES.includes(entityType)) {
      await this.logConflict(entityType, entityId, clientVersion, serverVersion, 'rejected', tenantDb);
      return { resolution: 'rejected', merged: null };
    }

    // Server always wins for specific entities
    if (SERVER_ALWAYS_WINS.includes(entityType)) {
      await this.logConflict(entityType, entityId, clientVersion, serverVersion, 'server_wins', tenantDb);
      return { resolution: 'server_wins', merged: serverVersion };
    }

    // Field-level merge — apply client changes that don't overlap with server changes
    const merged = await this.fieldLevelMerge(clientVersion, serverVersion);
    const resolution: Resolution = merged === null ? 'server_wins' : 'merge';

    await this.logConflict(entityType, entityId, clientVersion, serverVersion, resolution, tenantDb);
    return { resolution, merged: merged ?? serverVersion };
  }

  private fieldLevelMerge(
    client: Record<string, unknown>,
    server: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const SKIP_FIELDS = new Set(['id', 'created_at', 'updated_at', 'tenant_id']);
    const merged = { ...server };
    let hasConflict = false;

    const clientUpdatedAt = client['updated_at'] ? new Date(client['updated_at'] as string) : new Date(0);
    const serverUpdatedAt = server['updated_at'] ? new Date(server['updated_at'] as string) : new Date(0);

    for (const [key, clientValue] of Object.entries(client)) {
      if (SKIP_FIELDS.has(key)) continue;

      const serverValue = server[key];
      const isChanged = JSON.stringify(clientValue) !== JSON.stringify(serverValue);

      if (isChanged) {
        // Both sides changed this field — Last Write Wins
        if (clientUpdatedAt > serverUpdatedAt) {
          merged[key] = clientValue;
        }
        // else server value stays
        hasConflict = true;
      } else {
        // Same value — no conflict on this field
        merged[key] = clientValue;
      }
    }

    this.logger.debug(`Field-level merge: hasConflict=${hasConflict}`);
    return merged;
  }

  private async logConflict(
    entityType: string,
    entityId: string,
    clientVersion: Record<string, unknown>,
    serverVersion: Record<string, unknown>,
    resolution: string,
    tenantDb: string,
  ): Promise<void> {
    await this.db.query(
      tenantDb,
      `INSERT INTO sync_conflicts (entity_type, entity_id, client_version, server_version, resolution)
       VALUES ($1, $2, $3, $4, $5)`,
      [entityType, entityId, JSON.stringify(clientVersion), JSON.stringify(serverVersion), resolution],
    );
  }
}
```

---

## 6. Frontend — Offline Coverage Expansion

### 6.1 Update Dexie schema
**File:** `ehr-frontend/src/services/offlineSync.ts` — extend Dexie DB schema:

```typescript
import Dexie, { Table } from 'dexie';

class MediCoreOfflineDb extends Dexie {
  vitals!: Table;
  appointments!: Table;
  hivClinicalVisits!: Table;
  hivCounsellingSessions!: Table;
  gbvAssessments!: Table;
  disclosureRecords!: Table;
  alhivTransitionAssessments!: Table;
  counsellorSessions!: Table;
  pendingMutations!: Table;

  constructor() {
    super('MediCoreOffline');
    this.version(2).stores({
      vitals: 'id, patientId, updatedAt',
      appointments: 'id, patientId, appointmentDate',
      hivClinicalVisits: 'id, patientId, updatedAt',
      hivCounsellingSessions: 'id, patientId, updatedAt',
      gbvAssessments: 'id, patientId, updatedAt',
      disclosureRecords: 'id, patientId, updatedAt',
      alhivTransitionAssessments: 'id, patientId, updatedAt',
      counsellorSessions: 'id, patientId, updatedAt',
      pendingMutations: '++id, entityType, entityId, timestamp, status',
    });
  }
}

export const offlineDb = new MediCoreOfflineDb();

// Generic offline write — stores locally and queues sync
export async function offlineWrite(
  entityType: string,
  record: Record<string, unknown>,
): Promise<void> {
  const tableMap: Record<string, Table> = {
    vitals: offlineDb.vitals,
    appointments: offlineDb.appointments,
    hiv_clinical_visits: offlineDb.hivClinicalVisits,
    hiv_counselling_sessions: offlineDb.hivCounsellingSessions,
    gbv_assessments: offlineDb.gbvAssessments,
    hiv_disclosure_records: offlineDb.disclosureRecords,
    alhiv_transition_assessments: offlineDb.alhivTransitionAssessments,
    counsellor_sessions: offlineDb.counsellorSessions,
  };

  const table = tableMap[entityType];
  if (!table) throw new Error(`Unknown offline entity: ${entityType}`);

  await table.put({ ...record, _offlinePendingSync: true });
  await offlineDb.pendingMutations.add({
    entityType,
    entityId: record['id'],
    payload: record,
    timestamp: new Date().toISOString(),
    status: 'pending',
  });
}

// Sync engine — called on reconnect
export async function syncPendingMutations(apiBase: string, token: string): Promise<void> {
  const pending = await offlineDb.pendingMutations.where('status').equals('pending').toArray();

  for (const mutation of pending) {
    try {
      const res = await fetch(`${apiBase}/sync/${mutation.entityType}/${mutation.entityId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: mutation.payload, clientUpdatedAt: mutation.timestamp }),
      });

      if (res.ok) {
        await offlineDb.pendingMutations.update(mutation.id, { status: 'synced' });
      } else if (res.status === 409) {
        const conflict = await res.json();
        // Server returned merged version — update local store
        const tableMap: Record<string, Table> = { /* same as above */ };
        await tableMap[mutation.entityType]?.put(conflict.merged);
        await offlineDb.pendingMutations.update(mutation.id, { status: 'conflict_resolved' });
      }
    } catch {
      // Leave as pending — retry next sync
    }
  }
}
```

### 6.2 Sync endpoint on backend
**File:** `services/ehr-service/src/controllers/sync.controller.ts`

```typescript
import { Controller, Put, Param, Body, Req, UseGuards, ConflictException } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { DatabaseService } from '../services/database.service';
import { ConflictResolverService } from '../services/conflict-resolver.service';
import { Request } from 'express';

const ENTITY_TO_TABLE: Record<string, string> = {
  hiv_clinical_visits: 'hiv_clinical_visits',
  hiv_counselling_sessions: 'hiv_counselling_sessions',
  gbv_assessments: 'gbv_assessments',
  hiv_disclosure_records: 'hiv_disclosure_records',
  alhiv_transition_assessments: 'alhiv_transition_assessments',
  counsellor_sessions: 'counsellor_sessions',
  vitals: 'patient_vitals',
};

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(
    private readonly db: DatabaseService,
    private readonly conflictResolver: ConflictResolverService,
  ) {}

  @Put(':entityType/:entityId')
  async syncEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() body: { payload: Record<string, unknown>; clientUpdatedAt: string },
    @Req() req: Request,
  ) {
    const { tenantDb } = req as any;
    const table = ENTITY_TO_TABLE[entityType];
    if (!table) throw new Error(`Unknown entity type: ${entityType}`);

    const serverRecord = await this.db.queryOne<Record<string, unknown>>(
      tenantDb,
      `SELECT * FROM ${table} WHERE id = $1`,
      [entityId],
    );

    if (!serverRecord) {
      // No conflict — insert
      await this.db.query(
        tenantDb,
        `INSERT INTO ${table} SELECT * FROM json_populate_record(NULL::${table}, $1)
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(body.payload)],
      );
      return { resolution: 'inserted', merged: body.payload };
    }

    const { resolution, merged } = await this.conflictResolver.resolveConflict(
      entityType, entityId, body.payload, serverRecord, tenantDb,
    );

    if (resolution === 'rejected') {
      throw new ConflictException({ resolution: 'rejected', message: 'Entity is immutable' });
    }

    if (merged && (resolution === 'merge' || resolution === 'client_wins')) {
      await this.db.query(
        tenantDb,
        `UPDATE ${table} SET updated_at = NOW() WHERE id = $1`,
        [entityId],
      );
    }

    return { resolution, merged };
  }
}
```

### 6.3 Real-Time Alert Badges — WebSocket in EHR Sidebar
**File:** `ehr-frontend/src/components/AlertBadges.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface AlertCounts {
  oiAlerts: number;
  anomalyEvents: number;
  overdueMmd: number;
}

export const AlertBadges: React.FC = () => {
  const [counts, setCounts] = useState<AlertCounts>({ oiAlerts: 0, anomalyEvents: 0, overdueMmd: 0 });

  useEffect(() => {
    const socket: Socket = io('/alerts', {
      auth: { token: localStorage.getItem('token') },
    });

    socket.on('alert-counts', (data: AlertCounts) => {
      setCounts(data);
    });

    // Poll every 60s as fallback
    const interval = setInterval(() => {
      fetch('/api/security/anomalies?page=1', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
        .then((r) => r.json())
        .then((data) => setCounts((prev) => ({ ...prev, anomalyEvents: data.total ?? 0 })));
    }, 60000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, []);

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {counts.oiAlerts > 0 && (
        <span title="Unacknowledged OI Alerts" style={{ background: '#e53e3e', color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 12 }}>
          OI: {counts.oiAlerts}
        </span>
      )}
      {counts.anomalyEvents > 0 && (
        <span title="Security Anomalies" style={{ background: '#dd6b20', color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 12 }}>
          ⚠ {counts.anomalyEvents}
        </span>
      )}
      {counts.overdueMmd > 0 && (
        <span title="Overdue MMD Pickups" style={{ background: '#3182ce', color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 12 }}>
          MMD: {counts.overdueMmd}
        </span>
      )}
    </div>
  );
};
```

Add `<AlertBadges />` to `ehr-frontend/src/components/Sidebar.tsx` in the top navigation area.

---

## 7. Tests Required

**File:** `services/ehr-service/src/services/__tests__/conflict-resolver.service.spec.ts`

```typescript
describe('ConflictResolverService', () => {
  it('rejects immutable entity lab_results', async () => {
    const result = await service.resolveConflict('lab_results', 'id1', {}, {}, 'db');
    expect(result.resolution).toBe('rejected');
    expect(result.merged).toBeNull();
  });

  it('server wins for appointments', async () => {
    const server = { id: 'a1', appointment_date: '2026-07-01', status: 'scheduled' };
    const client = { id: 'a1', appointment_date: '2026-07-02', status: 'rescheduling_requested' };
    const result = await service.resolveConflict('appointments', 'a1', client, server, 'db');
    expect(result.resolution).toBe('server_wins');
    expect(result.merged).toEqual(server);
  });

  it('merges non-overlapping field changes', async () => {
    const server = { id: 'v1', weight: 70, notes: 'server note', updated_at: '2026-05-01T10:00:00Z' };
    const client = { id: 'v1', weight: 72, notes: 'server note', updated_at: '2026-05-01T11:00:00Z' };
    const result = await service.resolveConflict('hiv_clinical_visits', 'v1', client, server, 'db');
    expect(result.resolution).toBe('merge');
    expect((result.merged as any).weight).toBe(72); // client newer
  });

  it('LWW: server field wins when server is more recent', async () => {
    const server = { id: 'v1', weight: 75, updated_at: '2026-05-02T12:00:00Z' };
    const client = { id: 'v1', weight: 72, updated_at: '2026-05-01T11:00:00Z' };
    const result = await service.resolveConflict('hiv_clinical_visits', 'v1', client, server, 'db');
    expect((result.merged as any).weight).toBe(75); // server newer
  });
});
```

**File:** `ehr-frontend/src/services/__tests__/offlineSync.spec.ts`

```typescript
describe('offlineSync', () => {
  it('stores gbv_assessments in pending mutations', async () => {
    await offlineWrite('gbv_assessments', { id: 'g1', patientId: 'p1', hits_score: 14 });
    const pending = await offlineDb.pendingMutations.toArray();
    expect(pending).toHaveLength(1);
    expect(pending[0].entityType).toBe('gbv_assessments');
  });

  it('throws for unknown entity type', async () => {
    await expect(offlineWrite('unknown_table', { id: 'x1' })).rejects.toThrow('Unknown offline entity');
  });
});
```

---

## 8. Sign-off Criteria

- [ ] `npm run lint` passes zero errors in all modified packages
- [ ] `npm test` passes all tests including conflict resolver and offline sync specs
- [ ] CI `build-and-test` job passes green
- [ ] `POST /api/admin/tenants/repair-all` backfills `sync_conflicts` table and `updated_at` columns on all synced entities
- [ ] Grafana starts via `docker-compose up grafana` and dashboards auto-provision on first launch
- [ ] 95-95-95 dashboard shows live gauges pulling from `cascade_snapshots` table
- [ ] LTFU retention dashboard shows current LTFU rate and reengagement count
- [ ] Conflict resolver: `lab_results` mutation returns 409 rejected; appointments always return server version; hiv_clinical_visits merge succeeds
- [ ] All 6 new entity types (`hiv_clinical_visits`, `hiv_counselling_sessions`, `gbv_assessments`, `disclosure_records`, `alhiv_transition_assessments`, `counsellor_sessions`) stored in IndexedDB when offline
- [ ] Pending mutations sync to server on reconnect; conflict returned as 409 triggers local store update
- [ ] Alert badges render in EHR sidebar with correct counts from API
- [ ] `GET /security/anomalies` returns count updates within 60s of new anomaly event
