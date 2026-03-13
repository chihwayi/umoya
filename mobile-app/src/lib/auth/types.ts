export type AuthSession = {
  role: 'doctor' | 'nurse' | 'patient';
  accessToken: string;
  refreshToken?: string;
  userId: string;
  email: string;
};
