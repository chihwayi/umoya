# Testing New Features Guide

This document provides instructions for testing all the newly implemented features.

## Prerequisites

1. **Services Running**: Ensure all services are running
   ```bash
   docker-compose up -d
   ```

2. **Database Provisioned**: Ensure tenant databases have the latest schema
   - HIPAA audit logs table
   - Quality measure results table
   - RxNorm fields in prescriptions/drugs tables

3. **Test Data**: Ensure you have:
   - At least one patient in the system
   - Some lab results (for quality measures)
   - Some prescriptions (for RxNorm testing)

## Running Tests

### Automated Test Script

Run the comprehensive test script:

```bash
node scripts/test-new-features.js
```

Or with custom configuration:

```bash
EHR_SERVICE_URL=http://localhost:3013 \
TENANT_SLUG=your-tenant \
ADMIN_EMAIL=admin@your-tenant.co.zw \
ADMIN_PASSWORD=your-password \
node scripts/test-new-features.js
```

### Manual Testing

#### 1. RxNorm Integration

**Test Search**:
```bash
curl -X GET "http://localhost:3013/api/terminology/rxnorm/search?term=metformin&limit=5" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test Get Concept**:
```bash
curl -X GET "http://localhost:3013/api/terminology/rxnorm/concepts/6809" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test Validate**:
```bash
curl -X GET "http://localhost:3013/api/terminology/rxnorm/validate/6809" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 2. FHIR R4 Resource Expansion

**Test New Resources**:
```bash
# Immunization
curl -X GET "http://localhost:3013/api/fhir/Immunization?_count=10" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Procedure
curl -X GET "http://localhost:3013/api/fhir/Procedure?_count=10" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Practitioner
curl -X GET "http://localhost:3013/api/fhir/Practitioner?_count=10" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test CapabilityStatement**:
```bash
curl -X GET "http://localhost:3013/api/fhir/metadata" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 3. CCDA Document Generation

**Test CCD**:
```bash
curl -X GET "http://localhost:3013/api/ccda/ccd/PATIENT_ID?authorId=USER_ID" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test Referral Summary**:
```bash
curl -X GET "http://localhost:3013/api/ccda/referral-summary/PATIENT_ID?authorId=USER_ID" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test Discharge Summary** (requires encounterId):
```bash
curl -X GET "http://localhost:3013/api/ccda/discharge-summary/PATIENT_ID?encounterId=ENCOUNTER_ID&authorId=USER_ID" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 4. HIPAA Audit Logging

**Test Get Audit Logs**:
```bash
curl -X GET "http://localhost:3013/api/hipaa-audit/logs?limit=10" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test Audit Summary**:
```bash
curl -X GET "http://localhost:3013/api/hipaa-audit/summary?startDate=2024-01-01&endDate=2024-12-31" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test Breach Detection**:
```bash
curl -X GET "http://localhost:3013/api/hipaa-audit/breaches?lookbackDays=30" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test Patient Access Report**:
```bash
curl -X GET "http://localhost:3013/api/hipaa-audit/patient/PATIENT_ID/access-report" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 5. Quality Measures (HEDIS/eCQM)

**Test Get All Measures**:
```bash
curl -X GET "http://localhost:3013/api/quality-measures/measures" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test Get Specific Measure**:
```bash
curl -X GET "http://localhost:3013/api/quality-measures/measures/hedis-dm-001" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test Calculate Measure**:
```bash
curl -X POST "http://localhost:3013/api/quality-measures/calculate/hedis-dm-001?startDate=2024-01-01&endDate=2024-12-31&save=false" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Test Quality Dashboard**:
```bash
curl -X GET "http://localhost:3013/api/quality-measures/dashboard?startDate=2024-01-01&endDate=2024-12-31" \
  -H "X-Tenant-ID: bulawayo-general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Expected Results

### RxNorm
- ✅ Search returns RxNorm concepts
- ✅ Get concept returns detailed information
- ✅ Validation returns boolean
- ✅ Find by name returns matching concepts

### FHIR R4
- ✅ All 7 new resources accessible
- ✅ CapabilityStatement includes new resources
- ✅ Resources return valid FHIR Bundle format

### CCDA
- ✅ CCD generates valid XML document
- ✅ Referral Summary generates valid XML
- ✅ Documents include patient demographics
- ✅ Documents include clinical sections

### HIPAA Audit
- ✅ Audit logs retrievable
- ✅ Summary provides aggregate statistics
- ✅ Breach detection identifies suspicious patterns
- ✅ Patient access reports show access history

### Quality Measures
- ✅ All 11 measures available
- ✅ Measure calculation returns valid results
- ✅ Results include numerator/denominator/rate
- ✅ Dashboard provides summary statistics

## Troubleshooting

### Service Not Running
```bash
# Check service status
docker-compose ps

# Start services
docker-compose up -d

# Check logs
docker-compose logs ehr-service
```

### Authentication Issues
- Verify tenant slug is correct
- Check admin credentials
- Ensure tenant is active

### Database Schema Issues
- Run database provisioning for tenant
- Check if new tables exist:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_name IN ('hipaa_audit_logs', 'quality_measure_results');
  ```

### No Test Data
- Create test patients
- Add lab results
- Add prescriptions
- Add medical records

## Next Steps

After successful testing:
1. Review test results
2. Fix any issues found
3. Document any limitations
4. Update API documentation
5. Create user guides for new features


