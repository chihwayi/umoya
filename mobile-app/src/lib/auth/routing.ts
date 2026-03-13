import type { AuthSession } from './types';

export function routeForRole(role: AuthSession['role']): '/doctor' | '/nurse' | '/patient' {
  if (role === 'doctor') return '/doctor';
  if (role === 'nurse') return '/nurse';
  return '/patient';
}
