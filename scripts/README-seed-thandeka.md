# Seed Thandeka Data Script

## Overview
This script seeds dummy data for patient "Thandeka Moyo" to test:
1. **Questionnaires (PROs)** - Assigns multiple questionnaires to the patient
2. **Family Access** - Sets up family member access

## Prerequisites
- Services must be running (`docker compose up -d`)
- Admin credentials must be configured
- Tenant subdomain must be set

## Configuration

Set environment variables in `.env` or export them:

```bash
export API_URL=http://localhost:3001
export TENANT_SUBDOMAIN=demo  # Your tenant subdomain
export ADMIN_EMAIL=admin@medicore.com
export ADMIN_PASSWORD=admin123
```

## Usage

### Run with ts-node
```bash
npx ts-node scripts/seed-thandeka-data.ts
```

### Or add to package.json
```json
{
  "scripts": {
    "seed:thandeka": "ts-node scripts/seed-thandeka-data.ts"
  }
}
```

Then run:
```bash
npm run seed:thandeka
```

## What the Script Does

1. **Logs in** as admin user
2. **Creates/Finds Patient** "Thandeka Moyo" with:
   - Personal information
   - Contact details
   - Medical aid (CIMAS)
   - Medical history (Hypertension, Type 2 Diabetes)
   - Allergies (Penicillin)

3. **Initializes Questionnaires**:
   - PHQ-9 (Depression screening)
   - GAD-7 (Anxiety screening)
   - PROMIS-29 (General health)
   - Pain Scale

4. **Assigns Questionnaires**:
   - Creates schedules for each questionnaire
   - Sets due dates (3 days from now)
   - Links to patient

5. **Sets up Family Access**:
   - Creates family member "John Moyo" (spouse)
   - Attempts to grant family access
   - Adds family relationship in medical history

## Testing

After running the script:

1. **Test Questionnaires**:
   - Log in to patient portal as Thandeka
   - Navigate to Questionnaires section
   - You should see assigned questionnaires
   - Complete questionnaires to test PRO system

2. **Test Family Access**:
   - Check if family access is visible in patient portal
   - Verify family member can access (if feature implemented)
   - Check family history in patient record

## API Endpoints Used

- `POST /auth/login` - Authentication
- `GET /patients?search=...` - Search patients
- `POST /patients` - Create patient
- `POST /patient-portal/questionnaires/initialize` - Initialize questionnaires
- `GET /pro/patients/:id/questionnaires/available` - Get available questionnaires
- `POST /pro/patients/:id/schedules` - Assign questionnaire
- `POST /patient-portal/family/access` - Grant family access (if available)
- `POST /patients/:id/history/family` - Add family history

## Troubleshooting

### "No questionnaires available"
- Run initialization: `POST /patient-portal/questionnaires/initialize`
- Check database for `questionnaire_templates` table

### "Family access endpoint not found"
- Feature may not be fully implemented
- Family member is still created for testing
- Check patient portal for family access UI

### "Patient already exists"
- Script will use existing patient
- No duplicate will be created

## Notes

- Script uses system APIs to ensure they work correctly
- All operations are logged for debugging
- Script handles errors gracefully
- Can be run multiple times safely

