/* Seed Problems and Allergies for Showcase Patient */
const axios = require('axios');

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';
const LOGIN_EMAIL = process.env.SEED_LOGIN_EMAIL || 'admin@bulawayo-general.co.zw';
const LOGIN_PASSWORD = process.env.SEED_LOGIN_PASSWORD || 'Password1#';

const ehr = axios.create({ baseURL: EHR_API_URL, timeout: 20000 });

function authHeaders(token) {
  return { headers: { 'X-Tenant-ID': TENANT_SLUG, Authorization: `Bearer ${token}` } };
}

async function main() {
  const login = await ehr.post('/auth/login', { email: LOGIN_EMAIL, password: LOGIN_PASSWORD }, { headers: { 'X-Tenant-ID': TENANT_SLUG } });
  const token = login.data?.token;
  if (!token) throw new Error('Login failed');

  // Find Showcase Patient
  const list = await ehr.get('/patients/search', { ...authHeaders(token), params: { q: 'Showcase Patient' } });
  const patients = list.data?.patients || list.data || [];
  const patient = patients.find((p) => (`${p.firstName} ${p.lastName}`).toLowerCase() === 'showcase patient') || patients[0];
  if (!patient) throw new Error('Showcase Patient not found');

  // Seed Problems
  await ehr.put(`/problems/patient/${patient.id}`, {
    problems: [
      { problemName: 'Hypertension', icdCode: 'I10', status: 'active' },
      { problemName: 'Type 2 Diabetes', icdCode: 'E11.9', status: 'active' }
    ]
  }, authHeaders(token));

  // Seed Allergies
  await ehr.put(`/allergies/patient/${patient.id}`, {
    allergies: [
      { allergen: 'Penicillin', reaction: 'Rash', severity: 'moderate', status: 'active' },
      { allergen: 'Aspirin', reaction: 'GI upset', severity: 'mild', status: 'active' }
    ]
  }, authHeaders(token));

  console.log('Seeded problems and allergies for patient:', patient.id);
}

main().catch((e) => {
  console.error('Seed failed:', e?.response?.data || e.message);
  process.exit(1);
});


