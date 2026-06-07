import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

const makeContext = (role: string | undefined) =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  } as any);

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const withRoles = (required: string[] | null, role: string | undefined) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);
    return guard.canActivate(makeContext(role));
  };

  it('allows when no roles are required', () => {
    expect(withRoles(null, 'reception')).toBe(true);
  });

  it('allows when required roles is empty array', () => {
    expect(withRoles([], 'reception')).toBe(true);
  });

  it('allows when user role matches required', () => {
    expect(withRoles(['doctor', 'admin'], 'doctor')).toBe(true);
  });

  it('allows admin to bypass any required role', () => {
    expect(withRoles(['doctor'], 'admin')).toBe(true);
  });

  it('allows super_admin to bypass any required role', () => {
    expect(withRoles(['doctor'], 'super_admin')).toBe(true);
  });

  it('throws ForbiddenException when role does not match', () => {
    expect(() => withRoles(['doctor', 'admin'], 'reception')).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['doctor']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it('nurse_accounts still satisfies nurse-only endpoints', () => {
    expect(withRoles(['nurse'], 'nurse_accounts')).toBe(true);
  });

  it('nurse_accounts can access finance/accounts endpoints (regression: payment 403)', () => {
    // Previously nurse_accounts was collapsed to "nurse" and was denied here.
    expect(withRoles(['accounts', 'nurse_accounts'], 'nurse_accounts')).toBe(true);
    expect(withRoles(['accounts'], 'nurse_accounts')).toBe(true);
    expect(withRoles(['nurse_accounts'], 'nurse_accounts')).toBe(true);
  });

  it('plain nurse is still denied finance-only endpoints', () => {
    expect(() => withRoles(['accounts'], 'nurse')).toThrow(ForbiddenException);
  });
});
