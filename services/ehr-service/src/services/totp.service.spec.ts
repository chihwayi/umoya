import { authenticator } from 'otplib';
import { TotpService } from './totp.service';

describe('TotpService', () => {
  it('generateSecret returns a base32 string', () => {
    const svc = new TotpService();
    expect(svc.generateSecret()).toMatch(/^[A-Z2-7]+$/);
  });

  it('verify returns true for a correct current TOTP code', () => {
    const svc = new TotpService();
    const secret = svc.generateSecret();
    const token = authenticator.generate(secret);
    expect(svc.verify(token, secret)).toBe(true);
  });

  it('verify returns false for a wrong code', () => {
    const svc = new TotpService();
    const secret = svc.generateSecret();
    expect(svc.verify('000000', secret)).toBe(false);
  });
});
