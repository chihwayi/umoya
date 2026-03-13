import { ehrClient } from './http';

export async function providerLogin(payload: { email: string; password: string }) {
  const { data } = await ehrClient.post('/auth/login', payload);
  return data;
}

export async function providerProfile() {
  const { data } = await ehrClient.get('/auth/profile');
  return data;
}

export async function changeProviderPassword(payload: { currentPassword: string; newPassword: string }) {
  const { data } = await ehrClient.put('/auth/change-password', payload);
  return data;
}

export async function completeProvider2FA(payload: { code: string; tempToken: string }) {
  const { data } = await ehrClient.post('/auth/2fa/complete-login', payload);
  return data;
}

export async function forceProviderPasswordChange(payload: { newPassword: string; temporaryToken: string }) {
  const { data } = await ehrClient.post(
    '/auth/force-password-change',
    { newPassword: payload.newPassword },
    {
      headers: {
        Authorization: `Bearer ${payload.temporaryToken}`
      }
    }
  );
  return data;
}

export async function patientLogin(payload: { email: string; password: string }) {
  const { data } = await ehrClient.post('/patient-portal/login', payload);
  return data;
}

export async function patientRegister(payload: Record<string, unknown>) {
  const { data } = await ehrClient.post('/patient-portal/register', payload);
  return data;
}

export async function patientProfile() {
  const { data } = await ehrClient.get('/patient-portal/profile');
  return data;
}

export async function mobileVersionMetadata() {
  const { data } = await ehrClient.get('/mobile/version');
  return data;
}
