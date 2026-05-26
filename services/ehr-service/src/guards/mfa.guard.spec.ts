import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { MfaGuard } from './mfa.guard';
import { SKIP_MFA_KEY } from '../decorators/skip-mfa.decorator';

function makeContext(request: any): any {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

describe('MfaGuard', () => {
  const jwtService = { decode: jest.fn() } as unknown as JwtService;

  it('passes when tenant does not require MFA', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new MfaGuard(reflector, jwtService);
    expect(guard.canActivate(makeContext({ tenant: { mfaRequired: false }, user: {} }))).toBe(true);
  });

  it('throws when tenant requires MFA and user is not verified', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new MfaGuard(reflector, jwtService);
    expect(() =>
      guard.canActivate(
        makeContext({
          headers: { authorization: 'Bearer token' },
          tenant: { mfaRequired: true },
          user: { mfaVerified: false },
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('passes when tenant requires MFA and user is verified', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new MfaGuard(reflector, jwtService);
    expect(
      guard.canActivate(
        makeContext({
          headers: { authorization: 'Bearer token' },
          tenant: { mfaRequired: true },
          user: { mfaVerified: true },
        }),
      ),
    ).toBe(true);
  });

  it('passes when handler has SkipMfa metadata', () => {
    const reflector = { getAllAndOverride: jest.fn((key) => key === SKIP_MFA_KEY) } as unknown as Reflector;
    const guard = new MfaGuard(reflector, jwtService);
    expect(guard.canActivate(makeContext({ tenant: { mfaRequired: true }, user: { mfaVerified: false } }))).toBe(true);
  });
});
