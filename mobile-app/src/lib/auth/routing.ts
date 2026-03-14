import type { AuthSession } from './types';

export function routeForRole(role: AuthSession['role']): '/doctor/rounds' | '/nurse/shift' | '/patient/home' {
  if (role === 'doctor') return '/doctor/rounds';
  if (role === 'nurse') return '/nurse/shift';
  return '/patient/home';
}
