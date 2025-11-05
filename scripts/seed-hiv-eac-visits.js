/*
  Seed HIV visits for EAC testing
  - Finds or creates an HIV enrolled patient
  - Creates multiple visits with increasing dates
  - Ensures 2 consecutive high viral loads (>1000) 3-6 months apart for EAC eligibility
*/

const axios = require('axios');

const EHR_API_URL = process.env.EHR_API_URL || 'http://localhost:3013/api';
const TENANT_SLUG = process.env.TENANT_SLUG || 'bulawayo-general';
const LOGIN_EMAIL = process.env.SEED_LOGIN_EMAIL || 'doctor@bulawayo-general.co.zw';
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
  // Ensure we format as YYYY-MM-DD in local timezone, not UTC
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function main() {
  console.log('🌱 Seeding HIV visits for EAC testing...\n');

  // 1) Login
  console.log('1️⃣  Logging in...');
  const loginRes = await ehr.post('/auth/login', 
    { email: LOGIN_EMAIL, password: LOGIN_PASSWORD }, 
    { headers: { 'X-Tenant-ID': TENANT_SLUG } }
  );
  const token = loginRes.data?.token;
  if (!token) throw new Error('Login failed - no token');
  console.log('✅ Logged in as', LOGIN_EMAIL);

  // 2) Get profile to get provider ID
  const profile = (await ehr.get('/auth/profile', authHeaders(token))).data;
  const providerId = profile?.user?.id || profile?.id;
  const providerRole = profile?.user?.role || profile?.role || 'doctor';
  console.log('✅ Provider ID:', providerId, 'Role:', providerRole);

  // 3) Create a fresh patient for EAC testing (to avoid interference from old visits)
  console.log('\n2️⃣  Creating fresh patient for EAC testing...');
  
  let enrollment;
  let patient;
  
  // Always create a new patient for EAC testing to ensure clean data
  {
    // Create a new patient and enroll them
    console.log('Creating new patient and enrollment for EAC testing...');
    
    // Create patient with unique ID
    const timestamp = Date.now();
    const patientData = {
      firstName: 'EAC',
      lastName: `Test-${timestamp.toString().slice(-6)}`,
      gender: 'female',
      dateOfBirth: '1985-06-15',
      phone: `0772${timestamp.toString().slice(-6)}`,
      address: '123 Test Street, Bulawayo',
      city: 'Bulawayo',
      nationalId: `63${timestamp.toString().slice(-8)}A12`,
      emergencyContactName: 'Memory Dube',
      emergencyContactPhone: '0772123457',
      emergencyContactRelationship: 'Spouse'
    };
    
    const patientRes = await ehr.post('/patients', patientData, authHeaders(token));
    patient = patientRes.data?.patient || patientRes.data;
    console.log('✅ Created patient:', patient.id);
    
    // Enroll in HIV care
    const enrollmentData = {
      patientId: patient.id,
      enrollmentDate: formatDate(new Date()),
      dateConfirmedPositive: formatDate(new Date()),
      baselineViralLoad: '500',
      baselineCd4: '350',
      // baselineClinicalStage and baselineWhoStage may have constraints, set to null if needed
      baselineClinicalStage: null,
      baselineWhoStage: null,
      enrollmentNotes: 'Created for EAC testing',
      createdBy: providerId
    };
    
    try {
      const enrollmentRes = await ehr.post('/hiv/enrollments', enrollmentData, authHeaders(token));
      enrollment = enrollmentRes.data?.enrollment || enrollmentRes.data || enrollmentRes.data;
      if (!enrollment || !enrollment.id) {
        console.error('Enrollment response:', JSON.stringify(enrollmentRes.data, null, 2));
        throw new Error('Failed to create enrollment - no enrollment ID returned');
      }
      console.log('✅ Created enrollment:', enrollment.id);
    } catch (error) {
      console.error('Error creating enrollment:', error.response?.data || error.message);
      console.error('Enrollment data sent:', JSON.stringify(enrollmentData, null, 2));
      throw error;
    }
  }

  // 4) Get existing visits count
  console.log('\n3️⃣  Checking existing visits...');
  const visitCountRes = await ehr.get(`/hiv/visits/count/${enrollment.id}`, authHeaders(token));
  const visitCount = visitCountRes.data?.count || 0;
  const nextVisitNumber = visitCountRes.data?.nextVisitNumber || visitCount + 1;
  console.log(`   Current visits: ${visitCount}`);
  console.log(`   Next visit number: ${nextVisitNumber}`);

  // 5) Get lookup tables for ARV regimens
  console.log('\n4️⃣  Fetching lookup tables...');
  const regimensRes = await ehr.get('/hiv/lookup/art_regimens', authHeaders(token));
  const regimens = regimensRes.data?.data || regimensRes.data || [];
  if (!Array.isArray(regimens)) {
    throw new Error(`Unexpected regimens response format: ${JSON.stringify(regimensRes.data)}`);
  }
  const adultRegimens = regimens.filter(r => r.category === 'Adult');
  const firstRegimen = adultRegimens.length > 0 ? adultRegimens[0] : null;
  
  if (!firstRegimen) {
    throw new Error('No ARV regimens found in lookup tables');
  }
  console.log(`✅ Using regimen: ${firstRegimen.name} (${firstRegimen.code})`);

  // 6) Create visits - start from 10 months ago, create visits with proper spacing
  console.log('\n5️⃣  Creating visits...');
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day
  const startDate = new Date(today);
  startDate.setMonth(startDate.getMonth() - 10); // Start 10 months ago
  
  const visitsToCreate = 8; // Create 8 visits total
  
  // Calculate the two high VL visit dates first (these need to be 3-6 months apart)
  // First high VL: 4 months ago
  // Second high VL: today (4 months after first)
  const firstHighVLDate = new Date(today);
  firstHighVLDate.setMonth(firstHighVLDate.getMonth() - 4); // 4 months ago
  
  const secondHighVLDate = new Date(today); // Today (4 months after first)
  
  // Create all visit dates (mix of monthly visits and the two high VL visits)
  const visitDates = [];
  // Regular monthly visits before first high VL (5 visits, starting 9 months ago)
  for (let i = 0; i < 5; i++) {
    const visitDate = new Date(startDate);
    visitDate.setMonth(visitDate.getMonth() + i);
    visitDates.push(visitDate);
  }
  // First high VL visit
  visitDates.push(new Date(firstHighVLDate));
  // One visit between high VL visits (2 months after first high VL)
  const betweenVisitDate = new Date(firstHighVLDate);
  betweenVisitDate.setMonth(betweenVisitDate.getMonth() + 2);
  visitDates.push(betweenVisitDate);
  // Second high VL visit
  visitDates.push(new Date(secondHighVLDate));
  
  // Sort visit dates to ensure chronological order
  visitDates.sort((a, b) => a.getTime() - b.getTime());
  
  const visits = [];
  
  for (let i = 0; i < visitsToCreate; i++) {
    const visitDate = visitDates[i];
    
    // Determine if this is a high VL visit by comparing dates
    const isHighVL1 = visitDate.getTime() === firstHighVLDate.getTime();
    const isHighVL2 = visitDate.getTime() === secondHighVLDate.getTime();
    const isHighVL = isHighVL1 || isHighVL2;
    
    const visitNumber = nextVisitNumber + i;
    
    // ARV status progression:
    // Visit 1: Start ARV (2a)
    // Visits 2+: Continue ARV (3)
    const arvStatus = i === 0 ? '2a' : '3';
    
    // Viral load progression:
    // Early visits: suppressed (<1000)
    // Visit 6: High VL (1200)
    // Visit 8: High VL (1500) - 4 months after visit 6
    let viralLoad;
    let viralLoadTestDate;
    
    if (isHighVL1) {
      viralLoad = '1200'; // First high VL
      viralLoadTestDate = formatDate(visitDate);
    } else if (isHighVL2) {
      viralLoad = '1500'; // Second high VL
      viralLoadTestDate = formatDate(visitDate);
    } else {
      // Suppressed viral loads for other visits
      viralLoad = Math.floor(50 + Math.random() * 200).toString(); // 50-250 copies/mL
      viralLoadTestDate = formatDate(visitDate);
    }
    
    // Calculate next review date (30 days after if ARV dispensed)
    const nextReviewDate = new Date(visitDate);
    nextReviewDate.setDate(nextReviewDate.getDate() + 30);
    
    const visitData = {
      enrollmentId: enrollment.id,
      visitNumber: visitNumber,
      visitDate: formatDate(visitDate),
      visitType: 'A', // Regular clinical visit
      providerId: providerId,
      providerRole: providerRole,
      
      // Vitals
      weightKg: 65 + Math.random() * 5,
      heightCm: 160,
      bloodPressure: `${110 + Math.floor(Math.random() * 20)}/${70 + Math.floor(Math.random() * 10)}`,
      
      // Clinical
      functionalStatus: 'W',
      whoClinicalStage: '1',
      
      // ARV
      arvStatus: arvStatus,
      arvRegimenCode: firstRegimen.code,
      arvRegimenName: firstRegimen.name,
      arvQuantityDispensed: 30,
      arvAdherencePercentage: isHighVL ? 65 : 95, // Poor adherence for high VL visits
      
      // Lab Results
      cd4Count: 350 + Math.floor(Math.random() * 100),
      cd4Percentage: 25 + Math.floor(Math.random() * 5),
      cd4TestDate: formatDate(visitDate),
      viralLoad: viralLoad,
      viralLoadUnit: 'copies/mL',
      viralLoadTestDate: viralLoadTestDate,
      viralLoadSuppressed: parseFloat(viralLoad) < 1000 ? 'Y' : 'N',
      
      // Follow-up
      nextReviewDate: formatDate(nextReviewDate),
      visitStatus: 'OT',
      visitNotes: isHighVL ? `High viral load detected: ${viralLoad} copies/mL. Patient reports adherence challenges.` : `Routine follow-up visit.`
    };
    
    try {
      const visitRes = await ehr.post('/hiv/visits', visitData, authHeaders(token));
      const createdVisit = visitRes.data?.visit || visitRes.data;
      visits.push({
        visitNumber,
        visitDate: formatDate(visitDate),
        viralLoad,
        isHighVL
      });
      
      const dateStr = formatDate(visitDate);
      if (isHighVL) {
        console.log(`   ⚠️  Visit ${visitNumber} (${dateStr}): High VL = ${viralLoad} copies/mL`);
        if (isHighVL1) console.log(`      📍 First high VL visit`);
        if (isHighVL2) console.log(`      📍 Second high VL visit (should be 4 months after first)`);
      } else {
        console.log(`   ✓  Visit ${visitNumber} (${dateStr}): VL = ${viralLoad} copies/mL`);
      }
    } catch (error) {
      console.error(`   ✗  Failed to create visit ${visitNumber}:`, error.response?.data || error.message);
      throw error;
    }
  }

  console.log(`\n✅ Successfully created ${visits.length} visits`);
  
  // 7) Verify EAC eligibility
  console.log('\n6️⃣  Checking EAC eligibility...');
  try {
    const eacCheckRes = await ehr.get(`/hiv/eac/check/${enrollment.id}`, authHeaders(token));
    const eacEligibility = eacCheckRes.data;
    
    console.log('\n📊 EAC Eligibility Status:');
    console.log(`   Needs EAC: ${eacEligibility.needsEac ? '✅ YES' : '❌ NO'}`);
    console.log(`   Active EAC: ${eacEligibility.activeEac ? '✅ YES' : '❌ NO'}`);
    
    if (eacEligibility.recentVisits && eacEligibility.recentVisits.length > 0) {
      console.log('\n   Recent High VL Visits:');
      eacEligibility.recentVisits.forEach((visit, idx) => {
        const visitDate = new Date(visit.visit_date);
        console.log(`   ${idx + 1}. Visit on ${formatDate(visitDate)}: VL = ${visit.viral_load} copies/mL`);
      });
      
      if (eacEligibility.recentVisits.length === 2) {
        const date1 = new Date(eacEligibility.recentVisits[0].visit_date);
        const date2 = new Date(eacEligibility.recentVisits[1].visit_date);
        const monthsDiff = (date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24 * 30);
        console.log(`   📅 Months between visits: ${monthsDiff.toFixed(2)} (needs 3-6 months)`);
      }
    }
    
    if (eacEligibility.needsEac) {
      console.log('\n🎉 SUCCESS! Patient is eligible for EAC!');
      console.log('   You can now test the EAC module in the EHR frontend.');
    } else {
      console.log('\n⚠️  Patient is not yet eligible for EAC.');
      console.log('   Make sure you have 2 consecutive high VL visits (>1000) that are 3-6 months apart.');
    }
  } catch (error) {
    console.error('   Error checking EAC eligibility:', error.response?.data || error.message);
  }

  console.log('\n✨ Seeding complete!');
  console.log(`\n📋 Patient Details:`);
  console.log(`   Name: ${patient.firstName} ${patient.lastName}`);
  console.log(`   Patient ID: ${patient.id}`);
  console.log(`   Enrollment ID: ${enrollment.id}`);
  console.log(`\n🌐 Access the EHR frontend to view this patient's EAC status.`);
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err.response?.data || err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});

