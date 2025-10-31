# Seeding Lab Tests and Order Sets

Before using the Lab Orders modal, you need to seed the test catalog and order sets in your database.

## Option 1: Using API (Recommended)

1. **Login as admin** to get your token
2. **Seed Lab Tests:**
   ```bash
   curl -X POST http://localhost:3013/api/lab-tests/seed \
     -H "X-Tenant-ID: bulawayo-general" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Seed Order Sets:**
   ```bash
   curl -X POST http://localhost:3013/api/lab-order-sets/seed \
     -H "X-Tenant-ID: bulawayo-general" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Option 2: Using Browser Console

1. Open browser dev tools (F12)
2. Go to Console tab
3. Get your token:
   ```javascript
   const token = localStorage.getItem('ehr_token');
   const tenantSlug = 'bulawayo-general';
   ```

4. Seed tests:
   ```javascript
   fetch('http://localhost:3013/api/lab-tests/seed', {
     method: 'POST',
     headers: {
       'X-Tenant-ID': tenantSlug,
       'Authorization': `Bearer ${token}`
     }
   }).then(r => r.json()).then(console.log);
   ```

5. Seed order sets:
   ```javascript
   fetch('http://localhost:3013/api/lab-order-sets/seed', {
     method: 'POST',
     headers: {
       'X-Tenant-ID': tenantSlug,
       'Authorization': `Bearer ${token}`
     }
   }).then(r => r.json()).then(console.log);
   ```

## What Gets Seeded

### Lab Tests (20+ tests):
- **Hematology**: WBC, RBC, Hemoglobin, Hematocrit, MCV, Platelet Count
- **Chemistry**: Glucose, Creatinine, BUN, Sodium, Potassium, Chloride, CO2, Total Protein, Albumin, Bilirubin, ALT, AST, ALP
- **Lipid Panel**: Total Cholesterol, Triglycerides, HDL, LDL
- **Other**: TSH, Free T4, Hemoglobin A1c, HIV Antibody

### Order Sets:
- **CBC** (Complete Blood Count): 6 tests
- **CMP** (Comprehensive Metabolic Panel): 13 tests
- **BMP** (Basic Metabolic Panel): 7 tests
- **Lipid Panel**: 4 tests
- **LFT** (Liver Function Tests): 6 tests
- **Thyroid Panel**: 2 tests

After seeding, you can:
1. Use "Quick Order Sets" buttons in the modal to add entire panels
2. Search and select individual tests from the catalog
3. Create orders that will appear in the Lab Tech dashboard

