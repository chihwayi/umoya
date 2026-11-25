/**
 * R1 / FX-002 (S-004) red→green: fail closed on missing/invalid keys,
 * ciphertext shape guarantees, stored-value classifier for backfill.
 *
 * Audit evidence: encrypt() silently returns PLAINTEXT when ENCRYPTION_KEY is
 * missing/invalid, and VARCHAR(50) columns truncate real ciphertext
 * (iv:tag:ct hex is 66 chars of overhead alone).
 */
describe('R1 FX-002 encryption fail-closed (red→green)', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    process.env = OLD_ENV;
    jest.resetModules();
  });

  it('refuses to load in production without a valid key', async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'production', ENCRYPTION_KEY: '' };
    let threw: Error | null = null;
    try {
      require('./encryption.transformer');
    } catch (e: any) {
      threw = e;
    }
    expect(threw).not.toBeNull();
    expect(String(threw?.message)).toMatch(/ENCRYPTION_KEY/);
  });

  it('refuses a malformed key in production', async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'production', ENCRYPTION_KEY: 'short' };
    await expect(
      (async () => require('./encryption.transformer'))(),
    ).rejects.toThrow(/ENCRYPTION_KEY/);
  });

  it('loads in test env without a key (dev convenience preserved)', async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'test', ENCRYPTION_KEY: '' };
    const mod = require('./encryption.transformer');
    expect(mod.encrypt('x')).toBe('x'); // passthrough only where allowed
  });

  it('ciphertext carries 66 chars of iv:tag overhead and round-trips', async () => {
    // Synthetic key generated inline — never a literal, never a real credential.
    const syntheticKey = require('crypto').randomBytes(32).toString('hex');
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'test',
      ENCRYPTION_KEY: syntheticKey,
    };
    const mod = require('./encryption.transformer');
    const ct = mod.encrypt('63-1234567-A-63');
    expect(ct.length).toBeGreaterThan(50); // proves VARCHAR(50) can never hold it
    expect(ct.split(':')).toHaveLength(3);
    expect(mod.decrypt(ct)).toBe('63-1234567-A-63');
  });

  it('classifies stored values for backfill triage', async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'test' };
    const mod = require('./encryption.transformer');
    expect(mod.classifyStoredValue(null)).toBe('empty');
    expect(mod.classifyStoredValue('63-1234567-A-63')).toBe('plaintext');
    expect(mod.classifyStoredValue('abc:def')).toBe('truncated');
    const ct =
      'aa'.repeat(16) + ':' + 'bb'.repeat(16) + ':' + 'cc'.repeat(20);
    expect(mod.classifyStoredValue(ct)).toBe('ciphertext-shape');
  });
});
