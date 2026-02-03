/*
  Seed demo data into a tenant via EHR API.
  - Creates ~10 patients
  - Adds problems, allergies, vitals
  - Creates appointments across dates and statuses
  - Creates and authorizes some medication and lab orders
*/

const axios = require('axios');

const EHR_API_URL = process.env.EHR_API_URL;
const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';
const LOGIN_EMAIL = process.env.SEED_LOGIN_EMAIL || 'doctor@bulawayo-general.co.zw';
const LOGIN_PASSWORD = process.env.SEED_LOGIN_PASSWORD || 'Password1#';

const ehr = axios.create({ baseURL: EHR_API_URL, timeout: 20000 });

function authHeaders(token) {
  return { headers: { 'X-Tenant-ID': TENANT_SLUG, Authorization: `Bearer ${token}` } };
}

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function main() {
  console.log('Seeding demo data for tenant:', TENANT_SLUG);

  // 1) Login
  const loginRes = await ehr.post('/auth/login', { email: LOGIN_EMAIL, password: LOGIN_PASSWORD }, { headers: { 'X-Tenant-ID': TENANT_SLUG } });
  const token = loginRes.data?.token;
  if (!token) throw new Error('Login failed - no token');
  console.log('Logged in as', LOGIN_EMAIL);

  // 2) Discover doctors (works with admin; if non-admin, fallback to own id)
  const profile = (await ehr.get('/auth/profile', authHeaders(token))).data;
  const selfId = profile?.user?.id || profile?.id;
  let doctors = [];
  try {
    const usersRes = await ehr.get('/users', { ...authHeaders(token), params: { role: 'doctor' } });
    doctors = usersRes.data || [];
  } catch (e) {
    doctors = [{ id: selfId }];
  }
  if (!doctors.length) doctors = [{ id: selfId }];
  console.log('Doctors to seed for:', doctors.map(d => d.email || d.id));

  // 3) Create patients (distributed across doctors round-robin)
  const firstNames = ['Tariro','Kuda','Ruvimbo','Tendai','Nyasha','Farai','Chiedza','Tatenda','Ropafadzo','Anesu'];
  const lastNames = ['Moyo','Dube','Chikafu','Mhlanga','Ndlovu','Gutu','Madzorera','Sithole','Mlambo','Chihwayi'];
  const genders = ['male','female'];

  const patients = [];
  for (let i = 0; i < 12; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const gender = randomChoice(genders);
    const dob = new Date(1975 + Math.floor(Math.random()*30), Math.floor(Math.random()*12), Math.floor(1+Math.random()*27)).toISOString().slice(0,10);
    const patientPayload = {
      firstName,
      lastName,
      gender,
      dateOfBirth: dob,
      phone: `0772${Math.floor(100000 + Math.random()*899999)}`,
      address: `${Math.floor(Math.random()*500)} Samora Machel Ave, Harare`,
      city: randomChoice(['Harare','Bulawayo','Gweru','Mutare','Masvingo']),
      nationalId: `${Math.floor(10_000_000 + Math.random()*89_999_999)}${randomChoice(['A','B','C'])}${Math.floor(10 + Math.random()*89)}`,
      emergencyContactName: `${randomChoice(['Memory','Blessing','Liberty','Bright','Fortunate'])} ${randomChoice(['Moyo','Ncube','Dlamini','Mpofu','Mhaka'])}`,
      emergencyContactPhone: `0712${Math.floor(100000 + Math.random()*899999)}`,
      emergencyContactRelationship: randomChoice(['Spouse','Sibling','Parent','Friend'])
    };
    const created = (await ehr.post('/patients', patientPayload, authHeaders(token))).data;
    patients.push({ ...(created?.patient || created), assignedDoctorId: doctors[i % doctors.length].id });
  }
  console.log('Created patients:', patients.length);

  // 4) Create appointments using available slots to avoid conflicts
  const now = new Date();
  const isoDate = (d) => d.toISOString();
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+n, 9 + (Math.floor(Math.random()*7)), 0, 0);

  const types = ['consultation','follow_up','review','procedure'];
  const createdAppointments = [];
  const dayOffsets = [0, 1, 3];
  for (const p of patients) {
    const docId = p.assignedDoctorId;
    for (const off of dayOffsets) {
      const d = addDays(now, off);
      const day = d.toISOString().slice(0,10);
      try {
        const slotsRes = await ehr.get(`/appointments/doctor/${docId}/available-slots`, { ...authHeaders(token), params: { date: day } });
        const slots = Array.isArray(slotsRes.data) ? slotsRes.data : [];
        const pick = slots.slice(0, 2);
        for (const slot of pick) {
          const payload = {
            patientId: p.id,
            doctorId: docId,
            appointmentDate: typeof slot === 'string' ? slot : isoDate(d),
            appointmentType: randomChoice(types),
            reason: randomChoice(['Headache','Back pain','Fever','Diabetes review','Hypertension review','Routine checkup']),
          };
          const a = (await ehr.post('/appointments', payload, authHeaders(token))).data;
          const created = a?.appointment || a;
          createdAppointments.push(created);
        }
      } catch (e) {
        // fallback: try one manual time if no slots or error
        const payload = {
          patientId: p.id,
          doctorId: docId,
          appointmentDate: isoDate(d),
          appointmentType: randomChoice(types),
          reason: randomChoice(['Headache','Back pain','Fever','Diabetes review','Hypertension review','Routine checkup']),
        };
        try {
          const a = (await ehr.post('/appointments', payload, authHeaders(token))).data;
          const created = a?.appointment || a;
          createdAppointments.push(created);
        } catch (err) {
          console.warn('Create appointment failed (both modes) for patient', p.id, err?.response?.data || err.message);
        }
      }
    }
  }
  console.log('Created appointments:', createdAppointments.length);

  // 5) For a subset: mark some as in_progress to enable Current Appointment UI
  for (const a of createdAppointments.slice(0, 10)) {
    try {
      await ehr.put(`/appointments/${a.id}/start`, {}, authHeaders(token));
    } catch {}
  }

  // 6) Problems & Allergies
  const commonProblems = [
    { problemName: 'Hypertension', icdCode: 'I10', status: 'active' },
    { problemName: 'Type 2 Diabetes', icdCode: 'E11.9', status: 'active' },
    { problemName: 'Asthma', icdCode: 'J45.909', status: 'active' },
  ];
  const commonAllergies = [
    { allergen: 'Penicillin', reaction: 'Rash', severity: 'moderate', status: 'active' },
    { allergen: 'Peanuts', reaction: 'Anaphylaxis', severity: 'severe', status: 'active' },
  ];

  for (const p of patients) {
    const problems = [randomChoice(commonProblems)];
    const allergies = Math.random() > 0.5 ? [randomChoice(commonAllergies)] : [];
    try {
      await ehr.put(`/problems/patient/${p.id}`, { problems }, authHeaders(token));
      await ehr.put(`/allergies/patient/${p.id}`, { allergies }, authHeaders(token));
    } catch (e) {
      console.warn('Set problems/allergies failed', p.id, e?.response?.data || e.message);
    }
  }
  console.log('Assigned problems/allergies');

  // 7) Vitals (subset)
  for (const a of createdAppointments.slice(0, 20)) {
    const v = {
      patientId: a.patientId,
      appointmentId: a.id,
      bloodPressure: `${110 + Math.floor(Math.random()*30)}/${70 + Math.floor(Math.random()*20)}`,
      heartRate: 60 + Math.floor(Math.random()*40),
      temperature: +(36 + Math.random()*1.5).toFixed(1),
      oxygenSaturation: 95 + Math.floor(Math.random()*5),
      weight: +(55 + Math.random()*30).toFixed(1),
      height: 150 + Math.floor(Math.random()*30),
    };
    try { await ehr.post('/vitals', v, authHeaders(token)); } catch {}
  }
  console.log('Recorded vitals for sample appointments');

  // 8) Orders (medication + lab) and authorize
  for (const a of createdAppointments.slice(0, 24)) {
    try {
      const med = await ehr.post('/orders', {
        patientId: a.patientId,
        appointmentId: a.id,
        doctorId: a.doctorId,
        orderType: 'medication',
        orderName: randomChoice(['Amoxicillin 500mg','Paracetamol 1g','Metformin 500mg']),
        description: 'Auto-seeded medication order',
        instructions: 'Take as directed',
        priority: 'normal'
      }, authHeaders(token));
      const medId = med.data?.order?.id || med.data?.id;
      if (medId) await ehr.put(`/orders/${medId}/authorize`, {}, authHeaders(token));

      const lab = await ehr.post('/orders', {
        patientId: a.patientId,
        appointmentId: a.id,
        doctorId: a.doctorId,
        orderType: 'lab_test',
        orderName: randomChoice(['FBC','LFTs','U&E','HbA1c']),
        description: 'Auto-seeded lab order',
        instructions: 'Process today',
        priority: 'normal'
      }, authHeaders(token));
      const labId = lab.data?.order?.id || lab.data?.id;
      if (labId) await ehr.put(`/orders/${labId}/authorize`, {}, authHeaders(token));
    } catch (e) {
      console.warn('Create/authorize order failed', a.id, e?.response?.data || e.message);
    }
  }
  console.log('Created and authorized sample orders');

  // 9) Create extra staff users (2 doctors, 1 nurse)
  const staff = [
    { email: 'dr.moyo@bulawayo-general.co.zw', firstName: 'Takudzwa', lastName: 'Moyo', role: 'doctor', phone: '0772000001' },
    { email: 'dr.ndlovu@bulawayo-general.co.zw', firstName: 'Nomsa', lastName: 'Ndlovu', role: 'doctor', phone: '0772000002' },
    { email: 'nurse.chipo@bulawayo-general.co.zw', firstName: 'Chipo', lastName: 'Dube', role: 'nurse', phone: '0772000003' },
  ];
  for (const u of staff) {
    try {
      await ehr.post('/users', u, authHeaders(token));
      console.log('Created user:', u.email);
    } catch (e) {
      const msg = e?.response?.data || e.message;
      console.warn('Create user failed (possibly exists):', u.email, msg);
    }
  }

  console.log('Seed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err?.response?.data || err.message);
  process.exit(1);
});


