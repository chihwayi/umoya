/*
  Comprehensive HIV Monitoring Features Seed Script
  - Creates multiple patients with different scenarios to showcase all features
  - Creates visits that auto-populate monitoring schedules, alerts, adherence, regimen history
  - Demonstrates: EAC, treatment failures, good adherence, poor adherence, LTFU, etc.
*/

const axios = require('axios');

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';
const LOGIN_EMAIL = process.env.SEED_LOGIN_EMAIL || 'nurse@bulawayo-general.co.zw';
const LOGIN_PASSWORD = process.env.SEED_LOGIN_PASSWORD || 'Password1#';

const ehr = axios.create({ baseURL: EHR_API_URL, timeout: 30000 });

function authHeaders(token) {
  return { headers: { 'X-Tenant-ID': TENANT_SLUG, Authorization: `Bearer ${token}` } };
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function createPatientAndEnrollment(token, providerId, patientData, enrollmentData) {
  const patientRes = await ehr.post('/patients', patientData, authHeaders(token));
  const patient = patientRes.data?.patient || patientRes.data;
  
  const enrollmentRes = await ehr.post('/hiv/enrollments', {
    ...enrollmentData,
    patientId: patient.id,
    createdBy: providerId
  }, authHeaders(token));
  
  const enrollment = enrollmentRes.data?.enrollment || enrollmentRes.data;
  return { patient, enrollment };
}

async function createVisit(token, enrollmentId, visitData) {
  const visitRes = await ehr.post('/hiv/visits', {
    enrollmentId,
    visitNumber: visitData.visitNumber,
    visitDate: visitData.visitDate,
    visitType: visitData.visitType,
    providerId: visitData.providerId,
    providerRole: visitData.providerRole,
    weightKg: visitData.weightKg,
    heightCm: visitData.heightCm || null,
    bloodPressure: visitData.bloodPressure || null,
    arvStatus: visitData.arvStatus,
    arvRegimenCode: visitData.arvRegimenCode,
    arvRegimenName: visitData.arvRegimenName,
    arvQuantityDispensed: visitData.arvQuantityDispensed,
    arvAdherencePercentage: visitData.arvAdherencePercentage,
    arvChangeStopReason: visitData.arvChangeStopReason || null,
    cd4Count: visitData.cd4Count,
    cd4TestDate: visitData.cd4TestDate,
    viralLoad: visitData.viralLoad,
    viralLoadTestDate: visitData.viralLoadTestDate,
    viralLoadUnit: 'copies/mL',
    nextReviewDate: visitData.nextReviewDate,
    visitStatus: visitData.visitStatus,
    functionalStatus: 'W',
    whoClinicalStage: '1',
  }, authHeaders(token));
  return visitRes.data?.visit || visitRes.data;
}

async function main() {
  console.log('🌱 Seeding HIV Monitoring Features - Comprehensive Data\n');
  console.log('This will create multiple patients with different scenarios:\n');
  console.log('1. Patient with EAC needed (2 consecutive high VLs)');
  console.log('2. Patient with treatment failure');
  console.log('3. Patient with good adherence (suppressed VL)');
  console.log('4. Patient with poor adherence');
  console.log('5. Patient LTFU (not seen in 90+ days)');
  console.log('6. Pediatric patient (for dosing calculator)\n');

  // 1) Login
  console.log('1️⃣  Logging in...');
  const loginRes = await ehr.post('/auth/login', 
    { email: LOGIN_EMAIL, password: LOGIN_PASSWORD }, 
    { headers: { 'X-Tenant-ID': TENANT_SLUG } }
  );
  const token = loginRes.data?.token;
  if (!token) throw new Error('Login failed - no token');
  console.log('✅ Logged in as', LOGIN_EMAIL);

  // 2) Get profile
  const profile = (await ehr.get('/auth/profile', authHeaders(token))).data;
  const providerId = profile?.user?.id || profile?.id;
  const providerRole = profile?.user?.role || profile?.role || 'nurse';
  console.log('✅ Provider ID:', providerId, 'Role:', providerRole);

  // 3) Get ARV regimens
  console.log('\n2️⃣  Fetching ARV regimens...');
  const regimensRes = await ehr.get('/hiv/lookup/art_regimens', authHeaders(token));
  const regimens = regimensRes.data?.data || regimensRes.data || [];
  const adultRegimens = regimens.filter(r => r.category === 'Adult');
  const pediatricRegimens = regimens.filter(r => r.category === 'Paediatric');
  const firstAdultRegimen = adultRegimens.find(r => r.line === '1st Line') || adultRegimens[0];
  const secondLineRegimen = adultRegimens.find(r => r.line === '2nd Line') || adultRegimens[1] || adultRegimens[0];
  const firstPediatricRegimen = pediatricRegimens[0];
  
  if (!firstAdultRegimen) throw new Error('No adult regimens found');
  console.log(`✅ Using regimen: ${firstAdultRegimen.name} (${firstAdultRegimen.code})`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ============================================
  // SCENARIO 1: Patient with EAC Needed (2 consecutive high VLs)
  // ============================================
  console.log('\n3️⃣  Creating Patient 1: EAC Needed (2 consecutive high VLs)...');
  const eacPatient = await createPatientAndEnrollment(
    token,
    providerId,
    {
      firstName: 'EAC',
      lastName: `Needed-${Date.now().toString().slice(-6)}`,
      gender: 'female',
      dateOfBirth: '1985-06-15',
      phone: `0772${Date.now().toString().slice(-6)}`,
      address: '123 Test Street, Bulawayo',
      city: 'Bulawayo',
      nationalId: `63${Date.now().toString().slice(-8)}A12`,
      emergencyContactName: 'Memory Dube',
      emergencyContactPhone: '0772123457',
      emergencyContactRelationship: 'Spouse',
    },
    {
      enrollmentDate: formatDate(addMonths(today, -12)),
      dateConfirmedPositive: formatDate(addMonths(today, -13)),
      baselineViralLoad: '500',
      baselineCd4: '350',
      artStartDate: formatDate(addMonths(today, -12)),
      baselineClinicalStage: null,
      baselineWhoStage: null,
    }
  );

  // Create 8 visits over 12 months
  const eacVisits = [];
  for (let i = 0; i < 8; i++) {
    const visitDate = addMonths(addMonths(today, -12), i);
    const isHighVL = i === 6 || i === 7; // Last 2 visits have high VL
    
    const visitData = {
      visitNumber: i + 1,
      visitDate: formatDate(visitDate),
      visitType: 'A',
      providerId,
      providerRole,
      weightKg: 65 + (i * 0.5),
      arvStatus: i === 0 ? '2a' : '3',
      arvRegimenCode: firstAdultRegimen.code,
      arvRegimenName: firstAdultRegimen.name,
      arvQuantityDispensed: 30,
      arvAdherencePercentage: isHighVL ? 85 : 98, // Poor adherence for high VL visits
      cd4Count: 350 + (i * 20),
      cd4TestDate: formatDate(visitDate),
      viralLoad: isHighVL ? (i === 6 ? '1200' : '1500') : '200',
      viralLoadTestDate: formatDate(visitDate),
      nextReviewDate: formatDate(addDays(visitDate, 30)),
      visitStatus: i === 0 ? 'on_time' : 'on_time',
    };

    const visit = await createVisit(token, eacPatient.enrollment.id, visitData);
    eacVisits.push(visit);
    console.log(`   ✅ Visit ${i + 1} created (${isHighVL ? 'HIGH VL' : 'Suppressed'})`);
  }
  console.log('✅ Patient 1 created with EAC scenario');

  // ============================================
  // SCENARIO 2: Treatment Failure Patient
  // ============================================
  console.log('\n4️⃣  Creating Patient 2: Treatment Failure...');
  const failurePatient = await createPatientAndEnrollment(
    token,
    providerId,
    {
      firstName: 'Treatment',
      lastName: `Failure-${Date.now().toString().slice(-6)}`,
      gender: 'male',
      dateOfBirth: '1978-03-20',
      phone: `0773${Date.now().toString().slice(-6)}`,
      address: '456 Test Street, Bulawayo',
      city: 'Bulawayo',
      nationalId: `63${Date.now().toString().slice(-8)}B34`,
      emergencyContactName: 'John Moyo',
      emergencyContactPhone: '0772234567',
      emergencyContactRelationship: 'Brother',
    },
    {
      enrollmentDate: formatDate(addMonths(today, -18)),
      dateConfirmedPositive: formatDate(addMonths(today, -19)),
      baselineViralLoad: '800',
      baselineCd4: '280',
      artStartDate: formatDate(addMonths(today, -18)),
      baselineClinicalStage: null,
      baselineWhoStage: null,
    }
  );

  // Create visits showing treatment failure progression
  for (let i = 0; i < 6; i++) {
    const visitDate = addMonths(addMonths(today, -18), i * 3);
    const visitData = {
      visitNumber: i + 1,
      visitDate: formatDate(visitDate),
      visitType: 'A',
      providerId,
      providerRole,
      weightKg: 70 - (i * 0.3), // Weight loss
      arvStatus: i === 0 ? '2a' : '3',
      arvRegimenCode: firstAdultRegimen.code,
      arvRegimenName: firstAdultRegimen.name,
      arvQuantityDispensed: 90,
      arvAdherencePercentage: 92,
      viralLoad: i < 4 ? '250' : (i === 4 ? '1500' : '2000'), // Treatment failure
      viralLoadTestDate: formatDate(visitDate),
      cd4Count: 280 - (i * 15), // Declining CD4
      cd4TestDate: formatDate(visitDate),
      nextReviewDate: formatDate(addDays(visitDate, 90)),
      visitStatus: 'on_time',
    };
    await createVisit(token, failurePatient.enrollment.id, visitData);
    console.log(`   ✅ Visit ${i + 1} created (VL: ${visitData.viralLoad})`);
  }
  console.log('✅ Patient 2 created with treatment failure scenario');

  // ============================================
  // SCENARIO 3: Good Adherence Patient (Suppressed)
  // ============================================
  console.log('\n5️⃣  Creating Patient 3: Good Adherence (Suppressed)...');
  const goodPatient = await createPatientAndEnrollment(
    token,
    providerId,
    {
      firstName: 'Good',
      lastName: `Adherence-${Date.now().toString().slice(-6)}`,
      gender: 'female',
      dateOfBirth: '1990-08-10',
      phone: `0774${Date.now().toString().slice(-6)}`,
      address: '789 Test Street, Bulawayo',
      city: 'Bulawayo',
      nationalId: `63${Date.now().toString().slice(-8)}C56`,
      emergencyContactName: 'Sarah Ncube',
      emergencyContactPhone: '0772345678',
      emergencyContactRelationship: 'Sister',
    },
    {
      enrollmentDate: formatDate(addMonths(today, -24)),
      dateConfirmedPositive: formatDate(addMonths(today, -25)),
      baselineViralLoad: '1200',
      baselineCd4: '200',
      artStartDate: formatDate(addMonths(today, -24)),
      baselineClinicalStage: null,
      baselineWhoStage: null,
    }
  );

  // Create visits showing excellent adherence and suppression
  for (let i = 0; i < 10; i++) {
    const visitDate = addMonths(addMonths(today, -24), i * 3);
    const visitData = {
      visitNumber: i + 1,
      visitDate: formatDate(visitDate),
      visitType: 'A',
      providerId,
      providerRole,
      weightKg: 60 + (i * 0.2), // Gaining weight
      arvStatus: i === 0 ? '2a' : '3',
      arvRegimenCode: firstAdultRegimen.code,
      arvRegimenName: firstAdultRegimen.name,
      arvQuantityDispensed: 90,
      arvAdherencePercentage: 98, // Excellent adherence
      viralLoad: i < 2 ? '800' : (i < 4 ? '150' : '50'), // Becoming suppressed
      viralLoadTestDate: formatDate(visitDate),
      cd4Count: 200 + (i * 30), // Improving CD4
      cd4TestDate: i % 2 === 0 ? formatDate(visitDate) : null, // Every other visit
      nextReviewDate: formatDate(addDays(visitDate, 90)),
      visitStatus: 'on_time',
    };
    await createVisit(token, goodPatient.enrollment.id, visitData);
    console.log(`   ✅ Visit ${i + 1} created (VL: ${visitData.viralLoad}, Adherence: ${visitData.arvAdherencePercentage}%)`);
  }
  console.log('✅ Patient 3 created with good adherence scenario');

  // ============================================
  // SCENARIO 4: Poor Adherence Patient
  // ============================================
  console.log('\n6️⃣  Creating Patient 4: Poor Adherence...');
  const poorPatient = await createPatientAndEnrollment(
    token,
    providerId,
    {
      firstName: 'Poor',
      lastName: `Adherence-${Date.now().toString().slice(-6)}`,
      gender: 'male',
      dateOfBirth: '1982-11-05',
      phone: `0775${Date.now().toString().slice(-6)}`,
      address: '321 Test Street, Bulawayo',
      city: 'Bulawayo',
      nationalId: `63${Date.now().toString().slice(-8)}D78`,
      emergencyContactName: 'Peter Sibanda',
      emergencyContactPhone: '0772456789',
      emergencyContactRelationship: 'Friend',
    },
    {
      enrollmentDate: formatDate(addMonths(today, -9)),
      dateConfirmedPositive: formatDate(addMonths(today, -10)),
      baselineViralLoad: '600',
      baselineCd4: '320',
      artStartDate: formatDate(addMonths(today, -9)),
      baselineClinicalStage: null,
      baselineWhoStage: null,
    }
  );

  // Create visits with poor adherence
  for (let i = 0; i < 5; i++) {
    const visitDate = addMonths(addMonths(today, -9), i * 2);
    const visitData = {
      visitNumber: i + 1,
      visitDate: formatDate(visitDate),
      visitType: 'A',
      providerId,
      providerRole,
      weightKg: 75,
      arvStatus: i === 0 ? '2a' : '3',
      arvRegimenCode: firstAdultRegimen.code,
      arvRegimenName: firstAdultRegimen.name,
      arvQuantityDispensed: 60,
      arvAdherencePercentage: 80 - (i * 2), // Declining adherence
      viralLoad: '400' + (i * 100), // Rising VL
      viralLoadTestDate: formatDate(visitDate),
      cd4Count: 320 - (i * 10),
      cd4TestDate: formatDate(visitDate),
      nextReviewDate: formatDate(addDays(visitDate, 60)),
      visitStatus: 'on_time',
    };
    await createVisit(token, poorPatient.enrollment.id, visitData);
    console.log(`   ✅ Visit ${i + 1} created (Adherence: ${visitData.arvAdherencePercentage}%)`);
  }
  console.log('✅ Patient 4 created with poor adherence scenario');

  // ============================================
  // SCENARIO 5: LTFU Patient (not seen in 90+ days)
  // ============================================
  console.log('\n7️⃣  Creating Patient 5: LTFU (Lost to Follow-Up)...');
  const ltfuPatient = await createPatientAndEnrollment(
    token,
    providerId,
    {
      firstName: 'LTFU',
      lastName: `Patient-${Date.now().toString().slice(-6)}`,
      gender: 'female',
      dateOfBirth: '1988-04-12',
      phone: `0776${Date.now().toString().slice(-6)}`,
      address: '654 Test Street, Bulawayo',
      city: 'Bulawayo',
      nationalId: `63${Date.now().toString().slice(-8)}E90`,
      emergencyContactName: 'Mary Khumalo',
      emergencyContactPhone: '0772567890',
      emergencyContactRelationship: 'Mother',
    },
    {
      enrollmentDate: formatDate(addMonths(today, -18)),
      dateConfirmedPositive: formatDate(addMonths(today, -19)),
      baselineViralLoad: '700',
      baselineCd4: '300',
      artStartDate: formatDate(addMonths(today, -18)),
      baselineClinicalStage: null,
      baselineWhoStage: null,
    }
  );

  // Create visits but last one is 95 days ago
  for (let i = 0; i < 4; i++) {
    const visitDate = i < 3 
      ? addMonths(addMonths(today, -18), i * 3)
      : addDays(today, -95); // Last visit 95 days ago
      
    const visitData = {
      visitNumber: i + 1,
      visitDate: formatDate(visitDate),
      visitType: 'A',
      providerId,
      providerRole,
      weightKg: 68,
      arvStatus: i === 0 ? '2a' : '3',
      arvRegimenCode: firstAdultRegimen.code,
      arvRegimenName: firstAdultRegimen.name,
      arvQuantityDispensed: 90,
      arvAdherencePercentage: 95,
      viralLoad: '300',
      viralLoadTestDate: formatDate(visitDate),
      cd4Count: 300 + (i * 25),
      cd4TestDate: formatDate(visitDate),
      nextReviewDate: formatDate(addDays(visitDate, 90)),
      visitStatus: 'on_time',
    };
    await createVisit(token, ltfuPatient.enrollment.id, visitData);
    console.log(`   ✅ Visit ${i + 1} created (${i === 3 ? '95 days ago' : 'Regular'})`);
  }
  console.log('✅ Patient 5 created with LTFU scenario');

  // ============================================
  // SCENARIO 6: Pediatric Patient (for dosing calculator)
  // ============================================
  if (firstPediatricRegimen) {
    console.log('\n8️⃣  Creating Patient 6: Pediatric Patient...');
    const pediatricPatient = await createPatientAndEnrollment(
      token,
      providerId,
      {
        firstName: 'Pediatric',
        lastName: `Patient-${Date.now().toString().slice(-6)}`,
        gender: 'male',
        dateOfBirth: formatDate(addMonths(today, -60)), // 5 years old
        phone: `0777${Date.now().toString().slice(-6)}`,
        address: '987 Test Street, Bulawayo',
        city: 'Bulawayo',
        nationalId: `63${Date.now().toString().slice(-8)}F12`,
        emergencyContactName: 'Jane Moyo',
        emergencyContactPhone: '0772678901',
        emergencyContactRelationship: 'Mother',
      },
      {
        enrollmentDate: formatDate(addMonths(today, -6)),
        dateConfirmedPositive: formatDate(addMonths(today, -7)),
        baselineViralLoad: '800',
        baselineCd4: '400',
        artStartDate: formatDate(addMonths(today, -6)),
        baselineClinicalStage: null,
        baselineWhoStage: null,
      }
    );

    // Create visits for pediatric patient
    for (let i = 0; i < 3; i++) {
      const visitDate = addMonths(addMonths(today, -6), i * 2);
      const visitData = {
        visitNumber: i + 1,
        visitDate: formatDate(visitDate),
        visitType: 'A',
        providerId,
        providerRole,
        weightKg: 18 + (i * 0.5), // Growing child
        heightCm: 105 + (i * 2),
        arvStatus: i === 0 ? '2a' : '3',
        arvRegimenCode: firstPediatricRegimen.code,
        arvRegimenName: firstPediatricRegimen.name,
        arvQuantityDispensed: 60,
        arvAdherencePercentage: 97,
        viralLoad: i === 0 ? '600' : '150',
        viralLoadTestDate: formatDate(visitDate),
        cd4Count: 400 + (i * 50),
        cd4TestDate: formatDate(visitDate),
        nextReviewDate: formatDate(addDays(visitDate, 60)),
        visitStatus: 'on_time',
      };
      await createVisit(token, pediatricPatient.enrollment.id, visitData);
      console.log(`   ✅ Visit ${i + 1} created (Weight: ${visitData.weightKg}kg)`);
    }
    console.log('✅ Patient 6 created with pediatric scenario');
  }

  // ============================================
  // SCENARIO 7: Regimen Change Patient
  // ============================================
  console.log('\n9️⃣  Creating Patient 7: Regimen Change...');
  const regimenChangePatient = await createPatientAndEnrollment(
    token,
    providerId,
    {
      firstName: 'Regimen',
      lastName: `Change-${Date.now().toString().slice(-6)}`,
      gender: 'female',
      dateOfBirth: '1980-07-22',
      phone: `0778${Date.now().toString().slice(-6)}`,
      address: '147 Test Street, Bulawayo',
      city: 'Bulawayo',
      nationalId: `63${Date.now().toString().slice(-8)}G34`,
      emergencyContactName: 'Grace Ndlovu',
      emergencyContactPhone: '0772789012',
      emergencyContactRelationship: 'Sister',
    },
    {
      enrollmentDate: formatDate(addMonths(today, -15)),
      dateConfirmedPositive: formatDate(addMonths(today, -16)),
      baselineViralLoad: '1000',
      baselineCd4: '250',
      artStartDate: formatDate(addMonths(today, -15)),
      baselineClinicalStage: null,
      baselineWhoStage: null,
    }
  );

  // Create visits showing regimen change
  for (let i = 0; i < 7; i++) {
    const visitDate = addMonths(addMonths(today, -15), i * 2);
    const isRegimenChange = i === 5; // Change regimen on visit 6
    
    const visitData = {
      visitNumber: i + 1,
      visitDate: formatDate(visitDate),
      visitType: 'A',
      providerId,
      providerRole,
      weightKg: 70,
      arvStatus: i === 0 ? '2a' : (isRegimenChange ? '4' : '3'),
      arvRegimenCode: isRegimenChange ? secondLineRegimen.code : firstAdultRegimen.code,
      arvRegimenName: isRegimenChange ? secondLineRegimen.name : firstAdultRegimen.name,
      arvChangeStopReason: isRegimenChange ? 'Treatment failure' : null,
      arvQuantityDispensed: 60,
      arvAdherencePercentage: 94,
      viralLoad: isRegimenChange ? '1800' : (i < 5 ? '500' : '1200'),
      viralLoadTestDate: formatDate(visitDate),
      cd4Count: 250 + (i * 15),
      cd4TestDate: formatDate(visitDate),
      nextReviewDate: formatDate(addDays(visitDate, 60)),
      visitStatus: 'on_time',
    };
    await createVisit(token, regimenChangePatient.enrollment.id, visitData);
    console.log(`   ✅ Visit ${i + 1} created (${isRegimenChange ? 'REGIMEN CHANGE' : 'Continue'})`);
  }
  console.log('✅ Patient 7 created with regimen change scenario');

  console.log('\n✅ All patients and visits created!');
  console.log('\n📊 Summary:');
  console.log('- Patient 1: EAC Needed (2 consecutive high VLs)');
  console.log('- Patient 2: Treatment Failure');
  console.log('- Patient 3: Good Adherence (Suppressed)');
  console.log('- Patient 4: Poor Adherence');
  console.log('- Patient 5: LTFU (95 days since last visit)');
  console.log('- Patient 6: Pediatric Patient (for dosing calculator)');
  console.log('- Patient 7: Regimen Change');
  console.log('\n🎉 All monitoring features will be auto-populated from these visits!');
  console.log('   - Monitoring schedules (VL & CD4)');
  console.log('   - Clinical alerts (treatment failure, high VL, adherence)');
  console.log('   - Adherence tracking records');
  console.log('   - Regimen history timeline');
  console.log('   - Side effects (if any)');
}

main().catch(error => {
  console.error('❌ Error:', error.response?.data || error.message);
  if (error.response?.data) {
    console.error('Response:', JSON.stringify(error.response.data, null, 2));
  }
  process.exit(1);
});

