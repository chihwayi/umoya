/*
  Seed a single showcase patient with:
  - Problems, Allergies
  - Today's started appointment
  - Latest vitals
  - Recent medication + lab orders (authorized)
*/

const axios = require('axios');

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';
const LOGIN_EMAIL = process.env.SEED_LOGIN_EMAIL || 'admin@bulawayo-general.co.zw';
const LOGIN_PASSWORD = process.env.SEED_LOGIN_PASSWORD || 'Password1#';
const TARGET_DOCTOR_EMAIL = process.env.SHOWCASE_DOCTOR_EMAIL || 'dr.ndlovu@bulawayo-general.co.zw';

const ehr = axios.create({ baseURL: EHR_API_URL, timeout: 20000 });

function authHeaders(token) {
  return { headers: { 'X-Tenant-ID': TENANT_SLUG, Authorization: `Bearer ${token}` } };
}

async function main() {
  console.log('Seeding showcase patient for tenant:', TENANT_SLUG);

  // Login
  const login = await ehr.post('/auth/login', { email: LOGIN_EMAIL, password: LOGIN_PASSWORD }, { headers: { 'X-Tenant-ID': TENANT_SLUG } });
  const token = login.data?.token;
  if (!token) throw new Error('Login failed');

  // Find target doctor
  const usersRes = await ehr.get('/users', { ...authHeaders(token), params: { role: 'doctor' } });
  const doctors = usersRes.data || [];
  let doctor = doctors.find((d) => (d.email || '').toLowerCase() === TARGET_DOCTOR_EMAIL.toLowerCase()) || doctors[0];
  if (!doctor) throw new Error('No doctor found');
  console.log('Using doctor:', doctor.email || doctor.id);

  // Create patient (idempotent by nationalId)
  const nationalId = '63-555555-B-55';
  const patientPayload = {
    firstName: 'Showcase',
    lastName: 'Patient',
    gender: 'female',
    dateOfBirth: '1992-04-10',
    phone: '0772123456',
    email: 'showcase.patient@example.com',
    address: '10 Jason Moyo Ave',
    city: 'Bulawayo',
    nationalId,
    emergencyContactName: 'Memory Moyo',
    emergencyContactPhone: '0712987654',
    emergencyContactRelationship: 'Sibling'
  };
  // Try create; if conflict, search and reuse
  let patient;
  try {
    const created = await ehr.post('/patients', patientPayload, authHeaders(token));
    patient = created.data?.patient || created.data;
  } catch (e) {
    const list = await ehr.get('/patients/search', { ...authHeaders(token), params: { q: 'Showcase Patient' } });
    patient = (list.data?.patients || list.data || []).find((p) => p.nationalId === nationalId) || (list.data?.patients || [])[0];
  }
  if (!patient) throw new Error('Failed to create/find showcase patient');
  console.log('Patient:', patient.firstName, patient.lastName, patient.id);

  // Create appointment today and start it
  const startAt = new Date();
  startAt.setMinutes(startAt.getMinutes() + 5);
  const aptRes = await ehr.post('/appointments', {
    patientId: patient.id,
    doctorId: doctor.id,
    appointmentDate: startAt.toISOString(),
    appointmentType: 'follow_up',
    reason: 'Hypertension review'
  }, authHeaders(token));
  const appointment = aptRes.data?.appointment || aptRes.data;
  try { await ehr.put(`/appointments/${appointment.id}/start`, {}, authHeaders(token)); } catch {}
  console.log('Appointment started:', appointment.id);

  // Problems & Allergies
  await ehr.put(`/problems/patient/${patient.id}`, {
    problems: [
      { problemName: 'Hypertension', icdCode: 'I10', status: 'active' },
      { problemName: 'Type 2 Diabetes', icdCode: 'E11.9', status: 'active' }
    ]
  }, authHeaders(token));

  await ehr.put(`/allergies/patient/${patient.id}`, {
    allergies: [
      { allergen: 'Penicillin', reaction: 'Rash', severity: 'moderate', status: 'active' }
    ]
  }, authHeaders(token));

  // Vitals (latest)
  await ehr.post('/vitals', {
    patientId: patient.id,
    appointmentId: appointment.id,
    bloodPressure: '148/96',
    heartRate: 88,
    temperature: 37.8,
    oxygenSaturation: 96,
    weight: 72.5,
    height: 168,
    painLevel: 2,
    recordedAt: new Date().toISOString(),
    recordedBy: doctor.id
  }, authHeaders(token));

  // Orders (med + lab) and authorize
  const med = await ehr.post('/orders', {
    patientId: patient.id,
    appointmentId: appointment.id,
    doctorId: doctor.id,
    orderType: 'medication',
    orderName: 'Amlodipine 5mg',
    description: 'Blood pressure control',
    instructions: 'Once daily',
    priority: 'normal'
  }, authHeaders(token));
  const medId = med.data?.order?.id || med.data?.id;
  if (medId) await ehr.put(`/orders/${medId}/authorize`, {}, authHeaders(token));

  const lab = await ehr.post('/orders', {
    patientId: patient.id,
    appointmentId: appointment.id,
    doctorId: doctor.id,
    orderType: 'lab_test',
    orderName: 'HbA1c',
    description: 'Glycemic control',
    instructions: 'Process today',
    priority: 'normal'
  }, authHeaders(token));
  const labId = lab.data?.order?.id || lab.data?.id;
  if (labId) await ehr.put(`/orders/${labId}/authorize`, {}, authHeaders(token));

  console.log('Showcase ready: patient, problems, allergies, vitals, orders.');
  console.log('Patient ID:', patient.id);
  console.log('Appointment ID:', appointment.id);
}

main().catch((e) => {
  console.error('Showcase seed failed:', e?.response?.data || e.message);
  process.exit(1);
});


