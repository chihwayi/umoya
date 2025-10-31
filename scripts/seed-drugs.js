const axios = require('axios');

const EHR_SERVICE_URL = process.env.EHR_SERVICE_URL || 'http://localhost:3013';
const TENANT_SLUG = 'bulawayo-general';
const ADMIN_EMAIL = 'admin@bulawayo-general.co.zw';
const ADMIN_PASSWORD = 'Password1#';

async function seedDrugs() {
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

    // Seed drugs
    console.log('💊 Seeding drug database...');
    try {
      const drugsResponse = await axios.post(
        `${EHR_SERVICE_URL}/api/drugs/seed`,
        {},
        {
          headers: {
            'X-Tenant-ID': TENANT_SLUG,
            'Authorization': `Bearer ${token}`
          }
        }
      );
      console.log('✅ Drugs seeded successfully');
      console.log('   Response:', drugsResponse.data?.message || 'Done');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already seeded')) {
        console.log('ℹ️  Drugs already seeded, skipping...');
      } else {
        throw error;
      }
    }

    console.log('\n🎉 Seeding complete!');
    console.log('   You can now use the drug database for prescriptions and interaction checking.');
    
  } catch (error) {
    console.error('❌ Error seeding drugs:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.response?.status) {
      console.error('   Status:', error.response.status);
    }
    if (error.message) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
}

seedDrugs();

