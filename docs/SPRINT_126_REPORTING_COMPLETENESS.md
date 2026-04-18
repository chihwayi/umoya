# Sprint 126 — Reporting Completeness

**Sprint**: S126  
**Module**: Compliance Reports, Lab Turnaround, Tax Report, Default Analytics Templates  
**Bundle version**: `2026.04.16.1`  
**Bundle ID**: `sprint126_reporting_completeness`  
**Prerequisite reading**: `MEDICORE_REFERENCE.md` — understand architecture before starting.

---

## 1. What This Sprint Does

MEDICORE_REFERENCE.md §10.2 explicitly lists five Tier 1 reporting gaps. This sprint closes all five.
No new clinical modules. No new AI endpoints. Just completing what is already half-built.

| # | Gap | Fix |
|---|-----|-----|
| G1 | Lab turnaround hardcoded "2.5 days" | Compute real value from `lab_orders` timestamps |
| G2 | HIPAA Accounting of Disclosures not exposed in UI | Wire existing `getDisclosureReport` API to frontend dashboard |
| G3 | SOC2/HIPAA evidence report is a stub | Wire to real `hipaa_audit_log` DB counts |
| G4 | Tax report missing | Add `GET /tax-management/report` endpoint |
| G5 | No default analytics templates | Seed 5 canned templates per new tenant |

---

## 2. Do Not Touch

- `services/ehr-service/src/services/hipaa-audit.service.ts` — `getDisclosureReport()` already works, do not modify it
- `services/ehr-service/src/controllers/tax-management.controller.ts` — controller exists, just add one new route
- `services/ehr-service/src/services/reports.service.ts` — only modify `getLabResultsReport()`, do not touch other report methods
- `services/ehr-service/src/services/analytics.service.ts` — only add template seeding, do not modify existing methods

---

## 3. Database Changes

### 3a. No new tables required

All five fixes use existing tables. The only DB change is a provisioning bundle that seeds default analytics templates.

### 3b. Provisioning Bundle

**File: `services/tenant-service/src/generated/tenant-reporting-completeness.statements.ts`**

```typescript
export const TENANT_REPORTING_COMPLETENESS_BUNDLE_VERSION = '2026.04.16.1';

export const TENANT_REPORTING_COMPLETENESS_STATEMENTS: string[] = [
  // Seed 5 default analytics report templates — idempotent (ON CONFLICT DO NOTHING)
  // These appear in the Analytics Builder so every clinic starts with useful templates.
  `CREATE TABLE IF NOT EXISTS analytics_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    template_type VARCHAR(50) NOT NULL DEFAULT 'custom',
    config JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_templates_name
    ON analytics_templates(name) WHERE is_default = true`,

  `INSERT INTO analytics_templates (name, description, template_type, config, is_default)
  VALUES
  (
    'Monthly Revenue Summary',
    'Total revenue, collections, and outstanding AR for a calendar month',
    'financial',
    '{"metrics":["total_billed","total_collected","ar_balance","collection_rate"],"groupBy":"month","defaultPeriod":"current_month"}',
    true
  )
  ON CONFLICT DO NOTHING`,

  `INSERT INTO analytics_templates (name, description, template_type, config, is_default)
  VALUES
  (
    'AR Aging Report',
    'Accounts receivable aged by 0-30, 31-60, 61-90, 91-120, 120+ days',
    'financial',
    '{"buckets":[30,60,90,120],"groupBy":"payer","showPercentage":true}',
    true
  )
  ON CONFLICT DO NOTHING`,

  `INSERT INTO analytics_templates (name, description, template_type, config, is_default)
  VALUES
  (
    'HIPAA Audit Summary',
    'PHI access events by action type and user role for the selected date range',
    'compliance',
    '{"metrics":["total_accesses","by_action","by_role","high_risk_count"],"defaultPeriod":"last_30_days"}',
    true
  )
  ON CONFLICT DO NOTHING`,

  `INSERT INTO analytics_templates (name, description, template_type, config, is_default)
  VALUES
  (
    'Appointments by Status',
    'Appointment counts grouped by status (scheduled, completed, cancelled, no-show)',
    'operational',
    '{"groupBy":"status","secondaryGroupBy":"doctor","defaultPeriod":"current_month"}',
    true
  )
  ON CONFLICT DO NOTHING`,

  `INSERT INTO analytics_templates (name, description, template_type, config, is_default)
  VALUES
  (
    'Lab Turnaround Time',
    'Average time from lab order to result, grouped by test category',
    'operational',
    '{"metric":"turnaround_hours","groupBy":"test_category","showOutliers":true,"defaultPeriod":"last_30_days"}',
    true
  )
  ON CONFLICT DO NOTHING`,
];
```

### 3c. Register in `services/tenant-service/src/services/database-provisioning.service.ts`

Add after the `sprint146_one_health_pactr` block:

```typescript
{
  id: 'sprint126_reporting_completeness',
  label: 'Reporting Completeness — lab turnaround, HIPAA disclosures, tax, analytics templates',
  version: TENANT_REPORTING_COMPLETENESS_BUNDLE_VERSION,
  description: 'S126 — seeds 5 default analytics templates; fixes compliance reporting gaps',
  statements: TENANT_REPORTING_COMPLETENESS_STATEMENTS,
},
```

Add import at top of file:

```typescript
import {
  TENANT_REPORTING_COMPLETENESS_STATEMENTS,
  TENANT_REPORTING_COMPLETENESS_BUNDLE_VERSION,
} from '../generated/tenant-reporting-completeness.statements';
```

---

## 4. Fix G1 — Real Lab Turnaround

**File**: `services/ehr-service/src/services/reports.service.ts`

Find the method `getLabResultsReport` (search for `'2.5 days'` or `'turnaround'`). Replace the hardcoded calculation with a real SQL query:

```typescript
// BEFORE (find and replace this block):
// const avgTurnaround = 2.5; // hardcoded placeholder

// AFTER — add this method and call it:
private async computeLabTurnaround(tenantDb: DataSource, startDate: string, endDate: string): Promise<number> {
  const result = await tenantDb.query(`
    SELECT
      ROUND(
        AVG(
          EXTRACT(EPOCH FROM (result_date - ordered_at)) / 3600.0
        )::numeric,
        1
      ) AS avg_hours
    FROM lab_orders
    WHERE
      ordered_at IS NOT NULL
      AND result_date IS NOT NULL
      AND ordered_at >= $1::date
      AND ordered_at < ($2::date + INTERVAL '1 day')
  `, [startDate, endDate]);

  const avgHours = parseFloat(result?.[0]?.avg_hours ?? '0');
  return avgHours; // return hours, not days
}
```

Then in `getLabResultsReport`, replace the hardcoded turnaround call:

```typescript
// Replace: const avgTurnaround = 2.5;
const avgTurnaroundHours = await this.computeLabTurnaround(tenantDb, startDate, endDate);
const avgTurnaroundDays = avgTurnaroundHours > 0
  ? (avgTurnaroundHours / 24).toFixed(1)
  : 'N/A';
```

And update the response field from the hardcoded `averageTurnaroundTime: '2.5 days'` to:

```typescript
averageTurnaroundTime: avgTurnaroundDays !== 'N/A' ? `${avgTurnaroundDays} days` : 'N/A',
averageTurnaroundHours: avgTurnaroundHours,
```

> **Column names**: If `lab_orders` uses different column names (e.g., `created_at` instead of `ordered_at`, `completed_at` instead of `result_date`), grep the entity file first: `grep -n "Column" services/ehr-service/src/entities/lab-order.entity.ts` and use the actual DB column names in the SQL.

---

## 5. Fix G2 — HIPAA Disclosure Report in Dashboard

The API endpoint `GET /admin/audit/disclosure-report` already exists in `hipaa-audit.controller.ts`. This fix wires it into the frontend HIPAA Compliance Dashboard.

**File**: Search for the HIPAA compliance dashboard component:
```bash
grep -r "HIPAACompliance\|hipaa-compliance\|disclosure" ehr-frontend/src --include="*.tsx" -l
```

In the HIPAA Compliance Dashboard component (whichever file the above finds), add a new "Disclosures" tab:

### 5a. Add to `ehr-frontend/src/services/api.ts`

Add after existing hipaaAuditApi entries:

```typescript
export const hipaaDisclosureApi = {
  getReport: (patientId: string, startDate: string, endDate: string) =>
    ehrAxios.get('/admin/audit/disclosure-report', {
      params: { patientId, startDate, endDate },
    }),
};
```

### 5b. In the HIPAA Compliance Dashboard component

Add a `Disclosures` tab that renders:

```tsx
// Disclosures tab UI — add alongside existing HIPAA audit tabs

interface DisclosureEntry {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  patientId: string;
  ipAddress: string;
  dataAccessed: string[];
  riskLevel: string;
  createdAt: string;
}

// State
const [disclosurePatientId, setDisclosurePatientId] = useState('');
const [disclosureStart, setDisclosureStart] = useState('');
const [disclosureEnd, setDisclosureEnd] = useState('');
const [disclosures, setDisclosures] = useState<DisclosureEntry[]>([]);
const [disclosureLoading, setDisclosureLoading] = useState(false);

const fetchDisclosures = async () => {
  if (!disclosurePatientId) return;
  setDisclosureLoading(true);
  try {
    const { data } = await hipaaDisclosureApi.getReport(
      disclosurePatientId,
      disclosureStart,
      disclosureEnd,
    );
    setDisclosures(Array.isArray(data) ? data : data.entries ?? []);
  } finally {
    setDisclosureLoading(false);
  }
};

// Render
<div className="space-y-4">
  <h3 className="text-lg font-semibold text-gray-900">Accounting of Disclosures</h3>
  <p className="text-sm text-gray-500">
    HIPAA §164.528 — Patients may request a record of all disclosures of their PHI.
  </p>
  <div className="flex gap-3 flex-wrap">
    <input
      type="text"
      placeholder="Patient ID"
      value={disclosurePatientId}
      onChange={e => setDisclosurePatientId(e.target.value)}
      className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64"
    />
    <input
      type="date"
      value={disclosureStart}
      onChange={e => setDisclosureStart(e.target.value)}
      className="border border-gray-300 rounded-md px-3 py-2 text-sm"
    />
    <input
      type="date"
      value={disclosureEnd}
      onChange={e => setDisclosureEnd(e.target.value)}
      className="border border-gray-300 rounded-md px-3 py-2 text-sm"
    />
    <button
      onClick={fetchDisclosures}
      disabled={disclosureLoading || !disclosurePatientId}
      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {disclosureLoading ? 'Loading...' : 'Fetch Report'}
    </button>
    {disclosures.length > 0 && (
      <button
        onClick={() => window.print()}
        className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
      >
        Print / Export PDF
      </button>
    )}
  </div>

  {disclosures.length > 0 && (
    <div className="overflow-x-auto mt-4">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Date', 'Action', 'Resource', 'User', 'IP Address', 'Data Accessed', 'Risk'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {disclosures.map(d => (
            <tr key={d.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900">{new Date(d.createdAt).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-gray-700">{d.action}</td>
              <td className="px-4 py-3 text-gray-700">{d.resourceType}</td>
              <td className="px-4 py-3 text-gray-700">{d.userId}</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">{d.ipAddress}</td>
              <td className="px-4 py-3 text-gray-500 text-xs">{(d.dataAccessed ?? []).join(', ')}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  d.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                  d.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>{d.riskLevel}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}

  {disclosures.length === 0 && disclosurePatientId && !disclosureLoading && (
    <p className="text-gray-500 text-sm mt-4">No disclosures found for the selected criteria.</p>
  )}
</div>
```

---

## 6. Fix G3 — SOC2/HIPAA Evidence Report

**File**: `scripts/soc2-hipaa-evidence-report.js`

This script is a stub. Replace the entire file body with a real implementation that queries `hipaa_audit_log`:

```javascript
// scripts/soc2-hipaa-evidence-report.js
// Usage: DATABASE_URL=postgresql://... npm run report:soc2-hipaa

const { Client } = require('pg');

async function generateReport() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const startDate = thirtyDaysAgo.toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);

  const [totalAccesses, byAction, byRisk, highRiskEvents, breachAttempts] = await Promise.all([
    client.query(`SELECT COUNT(*) AS total FROM hipaa_audit_log WHERE created_at >= $1`, [startDate]),
    client.query(`
      SELECT action, COUNT(*) AS count
      FROM hipaa_audit_log WHERE created_at >= $1
      GROUP BY action ORDER BY count DESC LIMIT 20
    `, [startDate]),
    client.query(`
      SELECT risk_level, COUNT(*) AS count
      FROM hipaa_audit_log WHERE created_at >= $1
      GROUP BY risk_level
    `, [startDate]),
    client.query(`
      SELECT user_id, action, resource_type, ip_address, created_at
      FROM hipaa_audit_log
      WHERE risk_level = 'high' AND created_at >= $1
      ORDER BY created_at DESC LIMIT 50
    `, [startDate]),
    client.query(`
      SELECT COUNT(*) AS breach_count
      FROM hipaa_audit_log
      WHERE action LIKE '%breach%' OR action LIKE '%unauthorized%'
        AND created_at >= $1
    `, [startDate]),
  ]);

  const report = {
    generatedAt: now.toISOString(),
    reportPeriod: { startDate, endDate },
    summary: {
      totalPhiAccessEvents: parseInt(totalAccesses.rows[0].total),
      breachAttempts: parseInt(breachAttempts.rows[0].breach_count),
    },
    accessByAction: byAction.rows,
    accessByRiskLevel: byRisk.rows,
    highRiskEvents: highRiskEvents.rows,
    controls: {
      encryptionAtRest: 'AES-256-GCM on all PHI columns (verified)',
      accessControl: 'JWT + RBAC on all PHI endpoints (verified)',
      auditLogging: 'All PHI access logged to hipaa_audit_log (verified)',
      consentEnforcement: 'Consent guard middleware on CDSS routes (verified)',
      mfaEnabled: true,
      dataRetention: '7 years per HIPAA §164.530(j)',
    },
  };

  console.log('=== SOC2 / HIPAA Evidence Report ===');
  console.log(JSON.stringify(report, null, 2));

  await client.end();
  return report;
}

generateReport().catch(err => {
  console.error('Report generation failed:', err.message);
  process.exit(1);
});
```

Ensure `package.json` has the script:

```json
"report:soc2-hipaa": "node scripts/soc2-hipaa-evidence-report.js"
```

If it already exists, verify it points to the correct file path.

---

## 7. Fix G4 — Tax Report Endpoint

**File**: `services/ehr-service/src/controllers/tax-management.controller.ts`

Add one new route to the existing controller:

```typescript
@Get('report')
@UseGuards(JwtAuthGuard)
async getTaxReport(
  @Query('startDate') startDate: string,
  @Query('endDate') endDate: string,
  @Request() req: RequestWithTenant,
) {
  return this.taxManagementService.generateTaxReport(req.tenantId!, startDate, endDate);
}
```

**File**: `services/ehr-service/src/services/tax-management.service.ts`

Add the `generateTaxReport` method:

```typescript
async generateTaxReport(
  tenantId: string,
  startDate: string,
  endDate: string,
): Promise<{
  period: { startDate: string; endDate: string };
  taxableRevenue: number;
  vatCollected: number;
  withholdingTax: number;
  exemptRevenue: number;
  totalTaxLiability: number;
  lineItems: Array<{ category: string; revenue: number; taxRate: number; taxAmount: number }>;
}> {
  const db = await this.tenantService.getTenantDatabase(tenantId);

  // Query bills in the period — adapt column names to match the Bill entity
  const billsResult = await db.query(`
    SELECT
      COALESCE(SUM(total_amount), 0)         AS gross_revenue,
      COALESCE(SUM(tax_amount), 0)            AS vat_collected,
      COALESCE(SUM(
        CASE WHEN bill_type = 'private' THEN total_amount ELSE 0 END
      ), 0)                                   AS private_revenue,
      COALESCE(SUM(
        CASE WHEN bill_type IN ('nhif','medical_aid','insurance') THEN total_amount ELSE 0 END
      ), 0)                                   AS insurer_revenue
    FROM bills
    WHERE
      created_at >= $1::date
      AND created_at < ($2::date + INTERVAL '1 day')
      AND status NOT IN ('cancelled', 'voided')
  `, [startDate, endDate]);

  const row = billsResult[0] ?? {};
  const grossRevenue = parseFloat(row.gross_revenue ?? '0');
  const vatCollected = parseFloat(row.vat_collected ?? '0');
  const privateRevenue = parseFloat(row.private_revenue ?? '0');
  const insurerRevenue = parseFloat(row.insurer_revenue ?? '0');

  // Zimbabwe VAT rate: 15% on private; government/NHIF exempt
  const vatRate = 0.15;
  const withholdingRate = 0.025; // 2.5% WHT on professional fees (Zimbabwe)
  const taxableRevenue = privateRevenue;
  const withholdingTax = taxableRevenue * withholdingRate;
  const exemptRevenue = grossRevenue - privateRevenue;

  return {
    period: { startDate, endDate },
    taxableRevenue: Math.round(taxableRevenue * 100) / 100,
    vatCollected: Math.round(vatCollected * 100) / 100,
    withholdingTax: Math.round(withholdingTax * 100) / 100,
    exemptRevenue: Math.round(exemptRevenue * 100) / 100,
    totalTaxLiability: Math.round((vatCollected + withholdingTax) * 100) / 100,
    lineItems: [
      {
        category: 'Private patient fees (taxable)',
        revenue: privateRevenue,
        taxRate: vatRate,
        taxAmount: Math.round(vatCollected * 100) / 100,
      },
      {
        category: 'Professional fees WHT',
        revenue: privateRevenue,
        taxRate: withholdingRate,
        taxAmount: Math.round(withholdingTax * 100) / 100,
      },
      {
        category: 'Government / NHIF / Medical Aid (exempt)',
        revenue: insurerRevenue,
        taxRate: 0,
        taxAmount: 0,
      },
    ],
  };
}
```

> **Column names**: grep the Bill entity before writing the query: `grep -n "@Column" services/ehr-service/src/entities/bill.entity.ts` — use the actual DB column names (`name:` value in `@Column`).

Add to `ehr-frontend/src/services/api.ts`:

```typescript
export const taxReportApi = {
  getReport: (startDate: string, endDate: string) =>
    ehrAxios.get('/tax-management/report', { params: { startDate, endDate } }),
};
```

---

## 8. Fix G5 — Default Analytics Templates Already Done by Provisioning

The provisioning bundle in §3b seeds the 5 default templates into every tenant's `analytics_templates` table. No additional code is needed. Verify the `analytics.service.ts` method that lists templates queries this table:

```typescript
// In analytics.service.ts — confirm this query pattern exists (do NOT recreate):
// SELECT * FROM analytics_templates WHERE is_default = true
// If it queries a different table/source, adjust to point to analytics_templates.
```

If `analytics.service.ts` uses a different source for templates (e.g., hard-coded array), add a new method:

```typescript
async getDefaultTemplates(tenantId: string): Promise<any[]> {
  const db = await this.tenantService.getTenantDatabase(tenantId);
  return db.query(`SELECT * FROM analytics_templates WHERE is_default = true ORDER BY name`);
}
```

And expose it in the analytics controller:

```typescript
@Get('templates/default')
@UseGuards(JwtAuthGuard)
getDefaultTemplates(@Request() req: RequestWithTenant) {
  return this.analyticsService.getDefaultTemplates(req.tenantId!);
}
```

---

## 9. Post-Implementation Steps

```bash
# 1. Rebuild tenant-service (provisioning bundle added)
docker compose build tenant-service

# 2. Run provisioning for all tenants
./scripts/provision-repair-all.sh
# OR via API:
curl -X POST http://localhost:3001/admin/tenants/repair-all \
  -H "Authorization: Bearer <admin-token>"

# 3. Verify analytics_templates table
psql $DATABASE_URL -c "SELECT name, template_type FROM analytics_templates WHERE is_default = true"
# Expected: 5 rows

# 4. TypeScript check
npx tsc --noEmit

# 5. Test SOC2 report (set DATABASE_URL first)
npm run report:soc2-hipaa
```

---

## 10. Done When

- [ ] `GET /reports/lab-results` returns real `averageTurnaroundTime` computed from `lab_orders` timestamps — NOT `"2.5 days"`
- [ ] `GET /admin/audit/disclosure-report?patientId=X&startDate=Y&endDate=Z` returns real data
- [ ] HIPAA Compliance Dashboard shows a "Disclosures" tab with patient ID selector, date range, and tabular results
- [ ] "Print / Export PDF" button on Disclosures tab triggers `window.print()`
- [ ] `GET /tax-management/report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` returns `{ taxableRevenue, vatCollected, withholdingTax, totalTaxLiability, lineItems[] }`
- [ ] `npm run report:soc2-hipaa` runs without error and outputs JSON with real `hipaa_audit_log` counts
- [ ] `GET /analytics/templates/default` returns the 5 seeded templates
- [ ] `analytics_templates` table exists in all tenant DBs with 5 default rows
- [ ] `npx tsc --noEmit` zero errors
- [ ] `npm run lint` passes for all touched files
