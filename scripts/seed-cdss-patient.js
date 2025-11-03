const axios = require('axios');

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || 'admin@bulawayo-general.co.zw';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'Password1#';

const ehr = axios.create({ baseURL: EHR_API_URL, timeout: 20000 });

function authHeaders(token) {
  return { headers: { 'X-Tenant-ID': TENANT_SLUG, Authorization: `Bearer ${token}` } };
}

// Helper to create dates in the past
function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function main() {
  console.log('🌱 Seeding CDSS patient with historical data for tenant:', TENANT_SLUG);

  // 1. Login
  const login = await ehr.post('/auth/login', 
    { email: LOGIN_EMAIL, password: LOGIN_PASSWORD }, 
    { headers: { 'X-Tenant-ID': TENANT_SLUG } }
  );
  const token = login.data?.token;
  if (!token) throw new Error('Login failed');
  console.log('✅ Logged in as', LOGIN_EMAIL);

  // 2. Find Dr Moyo
  const usersRes = await ehr.get('/users', { ...authHeaders(token), params: { role: 'doctor' } });
  const doctors = usersRes.data || [];
  let doctorMoyo = doctors.find((d) => 
    (d.lastName || '').toLowerCase().includes('moyo') || 
    (d.email || '').toLowerCase().includes('moyo')
  );
  
  // If not found, try to find by first name
  if (!doctorMoyo) {
    doctorMoyo = doctors.find((d) => (d.firstName || '').toLowerCase().includes('moyo'));
  }
  
  // If still not found, use first doctor
  if (!doctorMoyo) {
    doctorMoyo = doctors[0];
    console.log('⚠️  Dr Moyo not found, using:', doctorMoyo?.email || doctorMoyo?.id);
  } else {
    console.log('✅ Found Dr Moyo:', doctorMoyo.email || `${doctorMoyo.firstName} ${doctorMoyo.lastName}`);
  }
  if (!doctorMoyo) throw new Error('No doctor found');

  // 3. Find a nurse for recording vitals
  const nursesRes = await ehr.get('/users', { ...authHeaders(token), params: { role: 'nurse' } });
  const nurses = nursesRes.data || [];
  const nurse = nurses[0] || doctorMoyo; // Fallback to doctor if no nurse
  console.log('✅ Using nurse for vitals:', nurse.email || nurse.id);

  // 4. Create patient (idempotent by nationalId)
  const nationalId = '63-CDSS-001-B-88';
  const patientPayload = {
    firstName: 'Thandeka',
    lastName: 'Mkhize',
    gender: 'female',
    dateOfBirth: '1985-03-15', // Age ~39 for risk calculations
    phone: '0777123456',
    email: 'thandeka.mkhize@example.com',
    address: '45 Fife Avenue',
    city: 'Bulawayo',
    nationalId,
    emergencyContactName: 'Sipho Mkhize',
    emergencyContactPhone: '0712345678',
    emergencyContactRelationship: 'Husband'
  };

  let patient;
  try {
    const created = await ehr.post('/patients', patientPayload, authHeaders(token));
    patient = created.data?.patient || created.data;
    console.log('✅ Created patient:', patient.firstName, patient.lastName, patient.id);
  } catch (e) {
    console.log('⚠️  Patient creation failed, searching for existing...', e?.response?.data?.message || e.message);
    try {
      const list = await ehr.get('/patients/search', { ...authHeaders(token), params: { q: 'Thandeka' } });
      const patients = list.data?.patients || list.data || [];
      patient = patients.find((p) => (p.nationalId || p.idNumber) === nationalId) || patients[0];
      if (patient) {
        console.log('✅ Found existing patient:', patient.firstName, patient.lastName);
      } else {
        // Try creating with different nationalId
        patientPayload.nationalId = `63-CDSS-${Date.now()}-B-88`;
        const retry = await ehr.post('/patients', patientPayload, authHeaders(token));
        patient = retry.data?.patient || retry.data;
        console.log('✅ Created patient with new ID:', patient.firstName, patient.lastName);
      }
    } catch (e2) {
      console.error('Failed to create/find patient:', e2?.response?.data || e2.message);
      throw new Error('Failed to create/find patient: ' + (e2?.response?.data?.message || e2.message));
    }
  }
  
  if (!patient || !patient.id) {
    throw new Error('Patient creation failed - no patient object returned');
  }

  // 5. Add Problems (for recurring diagnosis pattern)
  await ehr.put(`/problems/patient/${patient.id}`, {
    problems: [
      { problemName: 'Hypertension', icdCode: 'I10', status: 'active' },
      { problemName: 'Type 2 Diabetes', icdCode: 'E11.9', status: 'active' },
      { problemName: 'Chronic Migraine', icdCode: 'G43.909', status: 'active' }
    ]
  }, authHeaders(token));
  console.log('✅ Added problems: Hypertension, Type 2 Diabetes, Chronic Migraine');

  // 6. Add Allergies
  await ehr.put(`/allergies/patient/${patient.id}`, {
    allergies: [
      { allergen: 'Penicillin', reaction: 'Rash', severity: 'moderate', status: 'active' },
      { allergen: 'Sulfonamides', reaction: 'Urticaria', severity: 'moderate', status: 'active' }
    ]
  }, authHeaders(token));
  console.log('✅ Added allergies');

  // 7. Create Historical Appointments (for visit pattern analysis)
  console.log('📅 Creating historical appointments...');
  const historicalDates = [
    { days: 120, type: 'follow_up', reason: 'Hypertension follow-up', priority: 'normal' },
    { days: 90, type: 'follow_up', reason: 'Diabetes review', priority: 'normal' },
    { days: 60, type: 'consultation', reason: 'Migraine episode - severe headache', priority: 'high' },
    { days: 45, type: 'follow_up', reason: 'Blood pressure monitoring', priority: 'normal' },
    { days: 30, type: 'urgent', reason: 'Hypertensive crisis', priority: 'urgent' },
    { days: 21, type: 'follow_up', reason: 'Medication adjustment review', priority: 'normal' },
    { days: 14, type: 'consultation', reason: 'Recurrent migraines', priority: 'high' },
    { days: 7, type: 'follow_up', reason: 'Routine check-up', priority: 'normal' }
  ];

  const historicalAppointments = [];
  for (const hist of historicalDates) {
    const aptDate = daysAgo(hist.days);
    aptDate.setHours(10, 0, 0, 0); // 10 AM
    
    try {
      const aptRes = await ehr.post('/appointments', {
        patientId: patient.id,
        doctorId: doctorMoyo.id,
        appointmentDate: aptDate.toISOString(),
        appointmentType: hist.type,
        reason: hist.reason
      }, authHeaders(token));
      
      const apt = aptRes.data?.appointment || aptRes.data;
      if (apt) {
        // Update status and priority separately
        try {
          await ehr.patch(`/appointments/${apt.id}`, {
            status: 'completed',
            priorityLevel: hist.priority
          }, authHeaders(token));
        } catch {}
        historicalAppointments.push(apt);
      }
      
      // Add notes with diagnosis for some visits
      if (hist.reason.includes('Migraine') || hist.reason.includes('migraine')) {
        await ehr.patch(`/appointments/${apt.id}`, {
          notes: JSON.stringify({
            clinicalDocumentation: {
              chiefComplaint: 'Severe headache with nausea and sensitivity to light',
              clinicalAssessment: 'Migraine with aura'
            }
          })
        }, authHeaders(token));
      }
    } catch (e) {
      console.warn('Failed to create historical appointment:', hist.days, 'days ago', e?.response?.data?.message || e.message);
    }
  }
  console.log(`✅ Created ${historicalAppointments.length} historical appointments`);

  // 8. Create Historical Vitals (for trend analysis)
  console.log('📊 Creating historical vitals...');
  const historicalVitalsData = [
    // 120 days ago - Baseline
    { days: 120, bp: '132/88', hr: 82, temp: 36.8, o2: 97, weight: 68.5, recordedBy: nurse.id },
    // 90 days ago - Slight increase
    { days: 90, bp: '135/90', hr: 85, temp: 36.9, o2: 96, weight: 69.2, recordedBy: nurse.id },
    // 60 days ago - Migraine visit
    { days: 60, bp: '128/84', hr: 88, temp: 37.1, o2: 98, weight: 69.0, recordedBy: nurse.id },
    // 45 days ago
    { days: 45, bp: '138/92', hr: 90, temp: 36.7, o2: 97, weight: 69.5, recordedBy: nurse.id },
    // 30 days ago - Hypertensive crisis
    { days: 30, bp: '165/105', hr: 95, temp: 37.0, o2: 96, weight: 70.1, recordedBy: nurse.id },
    // 21 days ago - After treatment
    { days: 21, bp: '142/94', hr: 87, temp: 36.8, o2: 97, weight: 69.8, recordedBy: nurse.id },
    // 14 days ago
    { days: 14, bp: '140/92', hr: 89, temp: 36.9, o2: 97, weight: 70.2, recordedBy: nurse.id },
    // 7 days ago
    { days: 7, bp: '145/95', hr: 91, temp: 37.0, o2: 96, weight: 70.5, recordedBy: nurse.id },
    // Today - Current (worsening trend)
    { days: 0, bp: '150/98', hr: 93, temp: 37.2, o2: 96, weight: 71.0, recordedBy: nurse.id }
  ];

  const vitalsCreated = [];
  for (const vit of historicalVitalsData) {
    const recordedAt = daysAgo(vit.days);
    
    // Find corresponding appointment for this date
    const matchingApt = historicalAppointments.find(apt => {
      const aptDate = new Date(apt.appointmentDate);
      const diffDays = Math.abs((aptDate.getTime() - recordedAt.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays < 2; // Within 2 days
    });
    
    try {
      const vitalRes = await ehr.post('/vitals', {
        patientId: patient.id,
        appointmentId: matchingApt?.id || null,
        bloodPressure: vit.bp,
        heartRate: vit.hr,
        temperature: vit.temp,
        oxygenSaturation: vit.o2,
        weight: vit.weight,
        height: 165, // Consistent height
        recordedAt: recordedAt.toISOString(),
        recordedBy: vit.recordedBy
      }, authHeaders(token));
      vitalsCreated.push(vitalRes.data);
    } catch (e) {
      console.warn('Failed to create vital', vit.days, 'days ago:', e?.response?.data?.message || e.message);
    }
  }
  console.log(`✅ Created ${vitalsCreated.length} historical vitals (showing BP trend: 132/88 → 150/98)`);

  // 9. Create Today's Appointment with Dr Moyo at 10 AM
  console.log('📅 Creating today\'s appointment at 10 AM...');
  const today = new Date();
  today.setHours(10, 0, 0, 0);
  
  const todayAptRes = await ehr.post('/appointments', {
    patientId: patient.id,
    doctorId: doctorMoyo.id,
    appointmentDate: today.toISOString(),
    appointmentType: 'follow_up',
    reason: 'Hypertension and diabetes review - BP trending upward'
  }, authHeaders(token));
  
  const todayAppointment = todayAptRes.data?.appointment || todayAptRes.data;
  
  // Update priority separately if needed
  try {
    await ehr.patch(`/appointments/${todayAppointment.id}`, {
      priorityLevel: 'high'
    }, authHeaders(token));
  } catch {}
  console.log('✅ Created today\'s appointment:', todayAppointment.id, 'at 10:00 AM');

  // 10. Add current vitals for today's appointment
  const currentVitalsRes = await ehr.post('/vitals', {
    patientId: patient.id,
    appointmentId: todayAppointment.id,
    bloodPressure: '150/98',
    heartRate: 93,
    temperature: 37.2,
    oxygenSaturation: 96,
    weight: 71.0,
    height: 165,
    recordedAt: new Date().toISOString(),
    recordedBy: nurse.id
  }, authHeaders(token));
  console.log('✅ Added current vitals for today\'s appointment');

  // 11. Add Medications (for adherence analysis)
  console.log('💊 Adding medications...');
  const medications = [
    { name: 'Amlodipine 5mg', dosage: '5mg', frequency: 'Once daily', instructions: 'Take in morning' },
    { name: 'Metformin 500mg', dosage: '500mg', frequency: 'Twice daily', instructions: 'With meals' },
    { name: 'Sumatriptan 50mg', dosage: '50mg', frequency: 'As needed', instructions: 'For migraine attacks' }
  ];

  for (const med of medications) {
    try {
      const orderRes = await ehr.post('/orders', {
        patientId: patient.id,
        appointmentId: todayAppointment.id,
        doctorId: doctorMoyo.id,
        orderType: 'medication',
        orderName: med.name,
        description: med.instructions,
        instructions: `${med.dosage} ${med.frequency}`,
        priority: 'normal'
      }, authHeaders(token));
      
      const orderId = orderRes.data?.order?.id || orderRes.data?.id;
      if (orderId) {
        await ehr.put(`/orders/${orderId}/authorize`, {}, authHeaders(token));
      }
    } catch (e) {
      console.warn('Failed to create medication order:', med.name, e?.response?.data?.message || e.message);
    }
  }
  console.log('✅ Added medications');

  // Summary
  console.log('\n✅ CDSS Patient Seeding Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Patient: ${patient.firstName} ${patient.lastName}`);
  console.log(`Patient ID: ${patient.id}`);
  console.log(`National ID: ${nationalId}`);
  console.log(`Today's Appointment: ${todayAppointment.id} at 10:00 AM with Dr Moyo`);
  console.log(`Historical Data:`);
  console.log(`  - ${historicalAppointments.length} previous appointments`);
  console.log(`  - ${vitalsCreated.length} historical vitals (trend: BP increasing)`);
  console.log(`  - ${medications.length} active medications`);
  console.log(`  - 3 chronic problems (Hypertension, Diabetes, Migraine)`);
  console.log(`  - 2 allergies`);
  console.log('\n💡 CDSS Analysis Features Available:');
  console.log('  ✓ Vital trends (BP trending upward: 132/88 → 150/98)');
  console.log('  ✓ Visit patterns (8 previous visits, frequent follow-ups)');
  console.log('  ✓ Recurring diagnoses (Migraine pattern)');
  console.log('  ✓ Care gaps (Hypertension follow-up overdue)');
  console.log('  ✓ Risk assessment (with historical context)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((e) => {
  console.error('❌ Seed failed:', e?.response?.data || e.message);
  if (e.response) {
    console.error('Response data:', JSON.stringify(e.response.data, null, 2));
  }
  process.exit(1);
});

