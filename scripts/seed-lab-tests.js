const axios = require('axios');

const EHR_SERVICE_URL = process.env.EHR_SERVICE_URL || 'http://localhost:3013';
const TENANT_SLUG = 'bulawayo-general';
const ADMIN_EMAIL = 'admin@bulawayo-general.co.zw';
const ADMIN_PASSWORD = 'Password1#';

async function seedLabTests() {
  try {
    console.log('🔐 Logging in as admin...');
    
    // Login to get token
    const loginResponse = await axios.post(`${EHR_SERVICE_URL}/api/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    }, {
      headers: {
        'X-Tenant-ID': TENANT_SLUG
      }
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // Seed lab tests
    console.log('🧪 Seeding lab tests...');
    try {
      const testsResponse = await axios.post(
        `${EHR_SERVICE_URL}/api/lab-tests/seed`,
        {},
        {
          headers: {
            'X-Tenant-ID': TENANT_SLUG,
            'Authorization': `Bearer ${token}`
          }
        }
      );
      console.log('✅ Lab tests seeded successfully');
      console.log('   Response:', testsResponse.data?.message || 'Done');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already seeded')) {
        console.log('ℹ️  Lab tests already seeded, skipping...');
      } else {
        throw error;
      }
    }

    // Seed order sets
    console.log('📦 Seeding lab order sets...');
    try {
      const setsResponse = await axios.post(
        `${EHR_SERVICE_URL}/api/lab-order-sets/seed`,
        {},
        {
          headers: {
            'X-Tenant-ID': TENANT_SLUG,
            'Authorization': `Bearer ${token}`
          }
        }
      );
      console.log('✅ Lab order sets seeded successfully');
      console.log('   Response:', setsResponse.data?.message || 'Done');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already seeded')) {
        console.log('ℹ️  Lab order sets already seeded, skipping...');
      } else {
        throw error;
      }
    }

    console.log('\n🎉 Seeding complete!');
    console.log('   You can now use the Lab Orders modal with test catalog and order sets.');
    
  } catch (error) {
    console.error('❌ Error seeding lab tests:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

seedLabTests();

