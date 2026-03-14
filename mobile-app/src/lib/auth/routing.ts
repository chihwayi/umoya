import type { AuthSession } from './types';

export function routeForRole(role: AuthSession['role']): '/doctor/rounds' | '/nurse/shift' | '/patient/home' {
  if (role === 'doctor') return '/doctor/rounds';
  if (role === 'nurse') return '/nurse/shift';
  return '/patient/home';
}

/** Login screen to show after logout or session invalidation. Same clinic, role-specific form. */
export function loginRouteAfterLogout(role: AuthSession['role'] | null | undefined): '/auth/provider-login' | '/auth/patient-login' {
  if (role === 'patient') return '/auth/patient-login';
  return '/auth/provider-login';
}
