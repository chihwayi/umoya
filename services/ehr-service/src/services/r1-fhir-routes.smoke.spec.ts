// FX-004 ($-route reachability) red→green smoke spec.
//
// Hits a BOOTED ehr-service over HTTP and asserts every operation the
// CapabilityStatement advertises is past Express routing (i.e. the
// response is NOT Nest's `Cannot POST/GET ...` routing 404). Response
// *content* correctness for $batch/$transaction is out of scope for R1;
// reachability is the bar.
//
// Run: SMOKE_EHR_URL=http://127.0.0.1:3013 SMOKE_JWT_SECRET=<secret> \
//        SMOKE_TENANT=audit-clinic npx jest --config jest.smoke.config.js r1-fhir-routes
const EHR_URL = process.env.SMOKE_EHR_URL || 'http://127.0.0.1:3013';
const JWT_SECRET = process.env.SMOKE_JWT_SECRET as string;
const TENANT = process.env.SMOKE_TENANT || 'audit-clinic';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = require('jsonwebtoken');

function authHeaders(): Record<string, string> {
  const token = jwt.sign(
    { sub: 'r1-fx004', role: 'admin', email: 'fx004@t.t', tenantId: TENANT },
    JWT_SECRET,
    { expiresIn: '5m' },
  );
  return {
    Authorization: `Bearer ${token}`,
    'X-Tenant-Id': TENANT,
    'Content-Type': 'application/json',
  };
}

function isRouting404(status: number, body: any): boolean {
  return (
    status === 404 &&
    typeof body?.message === 'string' &&
    /Cannot (GET|POST|PUT|DELETE)/.test(body.message)
  );
}

describe('FX-004 $ operation reachability (live server)', () => {
  beforeAll(() => {
    if (!JWT_SECRET) {
      throw new Error('SMOKE_JWT_SECRET must be set (the booted server JWT secret)');
    }
  });

  test.each([
    ['POST', '$batch'],
    ['POST', '$transaction'],
    ['POST', '$validate'],
  ])('%s /api/fhir/%s is past routing', async (method, op) => {
    const res = await fetch(`${EHR_URL}/api/fhir/${op}`, {
      method,
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    expect(isRouting404(res.status, body)).toBe(false);
  });

  test('GET /api/fhir/Patient/:id/$everything is past routing', async () => {
    const res = await fetch(`${EHR_URL}/api/fhir/Patient/synthetic-nonexistent/$everything`, {
      headers: authHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    expect(isRouting404(res.status, body)).toBe(false);
  });

  test('CapabilityStatement does not claim an XML format', async () => {
    const res = await fetch(`${EHR_URL}/api/fhir/metadata`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const meta = await res.json();
    expect(meta.format).toEqual(['json']);
  });
});
