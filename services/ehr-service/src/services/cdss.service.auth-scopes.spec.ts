import { CdssService } from './cdss.service';

function decodePayload(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
}

describe('CdssService service JWT scopes', () => {
  const ORIGINAL_SECRET = process.env.CDSS_SERVICE_JWT_SECRET;

  beforeEach(() => {
    process.env.CDSS_SERVICE_JWT_SECRET = 'test_cdss_service_jwt_secret_0123456789';
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.CDSS_SERVICE_JWT_SECRET;
    } else {
      process.env.CDSS_SERVICE_JWT_SECRET = ORIGINAL_SECRET;
    }
  });

  it('includes copilot guidelines scope for /guidelines/search', () => {
    const service = new CdssService(undefined, undefined);
    const token = (service as any).createServiceJwt('/guidelines/search', 'POST');
    expect(token).toBeTruthy();
    const payload = decodePayload(token as string);
    const scopes: string[] = payload.scopes || [];
    expect(scopes).toContain('cdss.copilot.guidelines.read');
    expect(scopes).toContain('cdss.api.invoke');
    expect(String(payload.scope)).toContain('cdss.copilot.guidelines.read');
  });

  it('includes intelligent diagnosis scope for /diagnosis/suggest/intelligent', () => {
    const service = new CdssService(undefined, undefined);
    const token = (service as any).createServiceJwt('/diagnosis/suggest/intelligent', 'POST');
    expect(token).toBeTruthy();
    const payload = decodePayload(token as string);
    const scopes: string[] = payload.scopes || [];
    expect(scopes).toContain('cdss.copilot.diagnosis.write');
    expect(scopes).toContain('cdss.api.invoke');
  });

  it('includes registration document scope for /registration/documents/analyze', () => {
    const service = new CdssService(undefined, undefined);
    const token = (service as any).createServiceJwt('/registration/documents/analyze', 'POST');
    expect(token).toBeTruthy();
    const payload = decodePayload(token as string);
    const scopes: string[] = payload.scopes || [];
    expect(scopes).toContain('cdss.copilot.registration.write');
    expect(scopes).toContain('cdss.api.invoke');
  });

  it('falls back to cdss.api.invoke for general routes', () => {
    const service = new CdssService(undefined, undefined);
    const token = (service as any).createServiceJwt('/risk/calculate', 'POST');
    expect(token).toBeTruthy();
    const payload = decodePayload(token as string);
    const scopes: string[] = payload.scopes || [];
    expect(scopes).toContain('cdss.api.invoke');
    expect(scopes).not.toContain('cdss.copilot.guidelines.read');
    expect(scopes).not.toContain('cdss.copilot.diagnosis.write');
  });
});
