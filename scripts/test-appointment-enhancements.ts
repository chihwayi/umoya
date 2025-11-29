import axios from 'axios';

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, status: 'PASS' });
    console.log(`✅ ${name}`);
  } catch (error: any) {
    results.push({ name, status: 'FAIL', message: error.message });
    console.error(`❌ ${name}: ${error.message}`);
  }
}

async function skip(name: string, reason: string): Promise<void> {
  results.push({ name, status: 'SKIP', message: reason });
  console.log(`⏭️  ${name}: ${reason}`);
}

// Helper to get auth token
async function login(email: string, password: string): Promise<string> {
  const response = await axios.post(`${EHR_API_URL}/auth/login`, { email, password }, {
    headers: { 'X-Tenant-ID': TENANT_SLUG }
  });
  return response.data.token;
}

// Helper to create axios instance with auth
function createAuthAxios(token: string) {
  return axios.create({
    baseURL: EHR_API_URL,
    headers: {
      'X-Tenant-ID': TENANT_SLUG,
      'Authorization': `Bearer ${token}`
    }
  });
}

async function main() {
  console.log('🧪 Testing Appointment Enhancements\n');
  console.log(`Tenant: ${TENANT_SLUG}\n`);

  // Login as admin first to get users
  let adminToken: string;
  try {
    adminToken = await login('admin@bulawayo-general.co.zw', 'Password1#');
    console.log(`✅ Logged in as admin\n`);
  } catch (error: any) {
    console.error('❌ Failed to login as admin:', error.message);
    process.exit(1);
  }

  const adminAxios = createAuthAxios(adminToken);

  // Get a doctor
  let doctorId: string;
  let doctorToken: string;
  try {
    const doctorsResponse = await adminAxios.get('/users', { params: { role: 'doctor' } });
    const doctors = Array.isArray(doctorsResponse.data) ? doctorsResponse.data : (doctorsResponse.data.users || []);
    if (doctors.length === 0) {
      throw new Error('No doctors found. Please create a doctor first.');
    }
    const doctor = doctors[0];
    doctorId = doctor.id;
    // Try to login as the doctor (use admin token for now)
    doctorToken = adminToken;
    console.log(`✅ Using doctor: ${doctor.email || doctor.firstName} ${doctor.lastName} (${doctorId})\n`);
  } catch (error: any) {
    console.error('❌ Failed to get doctor:', error.message);
    process.exit(1);
  }

  const doctorAxios = createAuthAxios(doctorToken);

  // Get a nurse
  let nurseToken: string;
  try {
    const nursesResponse = await adminAxios.get('/users', { params: { role: 'nurse' } });
    const nurses = Array.isArray(nursesResponse.data) ? nursesResponse.data : (nursesResponse.data.users || []);
    if (nurses.length === 0) {
      throw new Error('No nurses found. Please create a nurse first.');
    }
    // Use admin token for nurse operations
    nurseToken = adminToken;
    console.log(`✅ Using nurse: ${nurses[0].email || nurses[0].firstName} ${nurses[0].lastName}\n`);
  } catch (error: any) {
    console.error('❌ Failed to get nurse:', error.message);
    process.exit(1);
  }

  const nurseAxios = createAuthAxios(nurseToken);

  // Get a patient for testing
  let patientId: string;
  try {
    const patientsResponse = await nurseAxios.get('/patients', { params: { limit: 1 } });
    const patients = Array.isArray(patientsResponse.data) 
      ? patientsResponse.data 
      : (patientsResponse.data.patients || patientsResponse.data.data || []);
    if (patients.length === 0) {
      console.error('❌ No patients found. Please create a patient first.');
      process.exit(1);
    }
    patientId = patients[0].id;
    console.log(`✅ Using patient: ${patients[0].firstName} ${patients[0].lastName} (${patientId})\n`);
  } catch (error: any) {
    console.error('❌ Failed to get patient:', error.message);
    process.exit(1);
  }

  let availabilityId: string;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
  const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0];

  // Test 1: Create doctor unavailability (all-day)
  await test('Create all-day unavailability', async () => {
    const response = await doctorAxios.post('/doctor-availability', {
      doctorId,
      startDate: tomorrowStr,
      endDate: tomorrowStr,
      isAllDay: true,
      isUnavailable: true,
      reason: 'Conference',
      notes: 'Attending medical conference'
    });
    availabilityId = response.data.id;
    if (!availabilityId) throw new Error('No availability ID returned');
  });

  // Test 2: Create doctor unavailability (specific time)
  let timeAvailabilityId: string;
  await test('Create time-specific unavailability', async () => {
    const response = await doctorAxios.post('/doctor-availability', {
      doctorId,
      startDate: dayAfterTomorrowStr,
      endDate: dayAfterTomorrowStr,
      startTime: '14:00',
      endTime: '16:00',
      isAllDay: false,
      isUnavailable: true,
      reason: 'Lunch break',
      notes: 'Extended lunch break'
    });
    timeAvailabilityId = response.data.id;
    if (!timeAvailabilityId) throw new Error('No availability ID returned');
  });

  // Test 3: List doctor availability
  await test('List doctor availability', async () => {
    const response = await doctorAxios.get('/doctor-availability', {
      params: { doctorId, page: 1, limit: 10 }
    });
    if (!response.data.availabilities || response.data.availabilities.length === 0) {
      throw new Error('No availabilities returned');
    }
  });

  // Test 4: Try to create appointment during all-day unavailability (should fail)
  await test('Prevent appointment during all-day unavailability', async () => {
    try {
      await nurseAxios.post('/appointments', {
        patientId,
        doctorId,
        appointmentDate: tomorrowStr,
        appointmentTime: '10:00',
        duration: 30,
        type: 'consultation',
        reason: 'Test appointment'
      });
      throw new Error('Appointment should have been blocked');
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Expected conflict
        return;
      }
      throw error;
    }
  });

  // Test 5: Try to create appointment during time-specific unavailability (should fail)
  await test('Prevent appointment during time-specific unavailability', async () => {
    try {
      await nurseAxios.post('/appointments', {
        patientId,
        doctorId,
        appointmentDate: dayAfterTomorrowStr,
        appointmentTime: '15:00',
        duration: 30,
        type: 'consultation',
        reason: 'Test appointment'
      });
      throw new Error('Appointment should have been blocked');
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Expected conflict
        return;
      }
      throw error;
    }
  });

  // Test 6: Create appointment outside unavailability (should succeed)
  let appointmentId: string;
  await test('Allow appointment outside unavailability', async () => {
    const response = await nurseAxios.post('/appointments', {
      patientId,
      doctorId,
      appointmentDate: dayAfterTomorrowStr,
      appointmentTime: '10:00',
      duration: 30,
      type: 'consultation',
      reason: 'Test appointment'
    });
    appointmentId = response.data.id;
    if (!appointmentId) throw new Error('No appointment ID returned');
  });

  // Test 7: Get available slots (should exclude unavailable times)
  await test('Get available slots (excludes unavailable times)', async () => {
    const response = await nurseAxios.get(`/appointments/available-slots/${doctorId}`, {
      params: {
        date: dayAfterTomorrowStr,
        duration: 30
      }
    });
    const slots = response.data.slots || [];
    // Should not include 14:00-16:00 slot
    const unavailableSlot = slots.find((slot: string) => slot >= '14:00' && slot < '16:00');
    if (unavailableSlot) {
      throw new Error(`Unavailable slot ${unavailableSlot} was included in available slots`);
    }
  });

  // Test 8: Update availability
  await test('Update availability', async () => {
    await doctorAxios.patch(`/doctor-availability/${availabilityId}`, {
      reason: 'Conference - Updated',
      notes: 'Updated notes'
    });
  });

  // Test 9: Delete availability
  await test('Delete availability', async () => {
    await doctorAxios.delete(`/doctor-availability/${timeAvailabilityId}`);
  });

  // Test 10: Create recurring appointments (weekly)
  await test('Create recurring appointments (weekly)', async () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const endDate = new Date(nextWeek);
    endDate.setDate(endDate.getDate() + 21); // 3 weeks

    const response = await nurseAxios.post('/appointments/recurring', {
      appointment: {
        patientId,
        doctorId,
        appointmentDate: nextWeek.toISOString().split('T')[0],
        appointmentTime: '09:00',
        duration: 30,
        type: 'consultation',
        reason: 'Recurring test'
      },
      pattern: 'weekly',
      endDate: endDate.toISOString().split('T')[0]
    });

    if (!response.data.appointments || response.data.appointments.length === 0) {
      throw new Error('No recurring appointments created');
    }
    if (response.data.appointments.length !== 4) {
      throw new Error(`Expected 4 appointments, got ${response.data.appointments.length}`);
    }
  });

  // Test 11: Create recurring appointments (monthly)
  await test('Create recurring appointments (monthly)', async () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const endDate = new Date(nextMonth);
    endDate.setMonth(endDate.getMonth() + 3); // 3 months

    const response = await nurseAxios.post('/appointments/recurring', {
      appointment: {
        patientId,
        doctorId,
        appointmentDate: nextMonth.toISOString().split('T')[0],
        appointmentTime: '11:00',
        duration: 30,
        type: 'consultation',
        reason: 'Monthly recurring test'
      },
      pattern: 'monthly',
      endDate: endDate.toISOString().split('T')[0]
    });

    if (!response.data.appointments || response.data.appointments.length === 0) {
      throw new Error('No recurring appointments created');
    }
    if (response.data.appointments.length !== 4) {
      throw new Error(`Expected 4 appointments, got ${response.data.appointments.length}`);
    }
  });

  // Test 12: Recurring appointments skip conflicts
  await test('Recurring appointments skip conflicts gracefully', async () => {
    // Create unavailability for a specific date
    const conflictDate = new Date();
    conflictDate.setDate(conflictDate.getDate() + 10);
    const conflictDateStr = conflictDate.toISOString().split('T')[0];

    await doctorAxios.post('/doctor-availability', {
      doctorId,
      startDate: conflictDateStr,
      endDate: conflictDateStr,
      isAllDay: true,
      isUnavailable: true,
      reason: 'Conflict test'
    });

    // Create recurring appointments that would conflict
    const startDate = new Date(conflictDate);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(conflictDate);
    endDate.setDate(endDate.getDate() + 7);

    const response = await nurseAxios.post('/appointments/recurring', {
      appointment: {
        patientId,
        doctorId,
        appointmentDate: startDate.toISOString().split('T')[0],
        appointmentTime: '10:00',
        duration: 30,
        type: 'consultation',
        reason: 'Conflict test'
      },
      pattern: 'weekly',
      endDate: endDate.toISOString().split('T')[0]
    });

    // Should create some appointments but skip the conflicting one
    if (!response.data.appointments || response.data.appointments.length === 0) {
      throw new Error('No recurring appointments created (should skip conflicts)');
    }
  });

  // Print summary
  console.log('\n📊 Test Summary:');
  console.log('================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  }

  console.log('\n🎉 All tests passed!');
}

main().catch((error) => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
});

