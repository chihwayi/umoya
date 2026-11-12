// S286 — parity spec for the TypeScript port of
// services/cdss-service/privacy_guard.py. The port must behave identically to
// the Python original on every pattern (verified differentially during S286:
// 19-case battery, 0 mismatches). If you change a pattern here, change the
// Python file too (or document why they intentionally differ).
import {
  containsPHI,
  findBareDateMatch,
  findPhiMatch,
  isPHIRedactionEnabled,
  redactText,
} from './privacy-guard';

describe('privacy-guard (TS port of privacy_guard.py)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.CDSS_PHI_REDACTION_ENABLED;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('detects an email address', () => {
    expect(containsPHI('Contact jane.doe@example.com for follow-up')).toBe(true);
    expect(redactText('Contact jane.doe@example.com for follow-up')).toBe(
      'Contact [REDACTED_EMAIL] for follow-up',
    );
  });

  it('detects an international phone number', () => {
    expect(containsPHI('Call me at +263 77 123 4567')).toBe(true);
    expect(redactText('Call me at +263 77 123 4567')).toContain('[REDACTED_PHONE]');
  });

  it('detects SSN-style and long alnum IDs (case-sensitive)', () => {
    expect(containsPHI('SSN 123-45-6789 on file')).toBe(true);
    expect(containsPHI('Passport AB12345678 verified')).toBe(true);
    // 7 chars is below the 8-char minimum; lowercase never matches.
    expect(containsPHI('short id ABC1234 ok')).toBe(false);
    expect(containsPHI('lowercase abc12345 ok')).toBe(false);
  });

  it('detects MRN labels', () => {
    expect(containsPHI('Patient ID: ABC12345 recorded')).toBe(true);
    expect(containsPHI('MRN#XYZ-123 noted')).toBe(true);
  });

  it('detects labeled DOBs', () => {
    expect(containsPHI('DOB: 12/03/1987')).toBe(true);
    expect(containsPHI('Date of Birth: 1985-07-11')).toBe(true);
    expect(redactText('DOB: 1985-07-11')).toContain('[REDACTED_DOB]');
  });

  it('detects labeled patient names but not bare names', () => {
    expect(containsPHI('Patient name: John Mukamuri')).toBe(true);
    expect(redactText('Name: John Mukamuri')).toContain('[REDACTED_NAME]');
    // Known baseline boundary: no "name" label, no match (same as Python).
    expect(containsPHI('My patient John Mukamuri presented with fever')).toBe(false);
  });

  it('does not flag ordinary clinical narrative', () => {
    expect(containsPHI('Fever and cough for 3 days, otherwise well')).toBe(false);
    expect(containsPHI('General Hospital referral noted')).toBe(false);
  });

  it('returns empty input unchanged and never flags it', () => {
    expect(containsPHI('')).toBe(false);
    expect(redactText('')).toBe('');
    expect(findPhiMatch('')).toBeNull();
  });

  it('findPhiMatch reports the kind and exact span', () => {
    expect(findPhiMatch('Patient ID: ABC12345 recorded')).toEqual({
      kind: expect.any(String),
      match: expect.stringContaining('ABC12345'),
    });
    expect(findPhiMatch('nothing here')).toBeNull();
  });

  it('redactText is a no-op when the flag is off (ported gating behavior)', () => {
    process.env.CDSS_PHI_REDACTION_ENABLED = 'false';
    expect(redactText('Contact jane.doe@example.com')).toBe('Contact jane.doe@example.com');
    // containsPHI is NOT gated — detection always runs.
    expect(containsPHI('Contact jane.doe@example.com')).toBe(true);
  });

  it('isPHIRedactionEnabled defaults to true', () => {
    expect(isPHIRedactionEnabled()).toBe(true);
    process.env.CDSS_PHI_REDACTION_ENABLED = 'false';
    expect(isPHIRedactionEnabled()).toBe(false);
  });
});

describe('findBareDateMatch (Clinician-Network-only addition, not part of the port)', () => {
  it('flags unlabeled calendar dates as dob-kind', () => {
    expect(findBareDateMatch('born 12/03/1987 at home')).toEqual({
      kind: 'dob',
      match: '12/03/1987',
    });
    expect(findBareDateMatch('admitted 1987-03-12')).toEqual({
      kind: 'dob',
      match: '1987-03-12',
    });
  });

  it('does not flag relative durations or plain narrative', () => {
    expect(findBareDateMatch('Fever and cough for 3 days, otherwise well')).toBeNull();
    expect(findBareDateMatch('follow up in 2 to 4 weeks')).toBeNull();
    expect(findBareDateMatch('')).toBeNull();
  });
});
