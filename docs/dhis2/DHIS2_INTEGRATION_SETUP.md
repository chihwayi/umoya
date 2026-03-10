# DHIS2 Integration Setup Guide

## Overview

The DHIS2 integration has been upgraded from mocked calls to real API integration. The service automatically falls back to mock mode if credentials are not configured, ensuring backward compatibility.

## Configuration

### Environment Variables

Add these to your `services/ehr-service/.env` file:

```bash
# DHIS2 Configuration
DHIS2_URL=http://localhost:8888
DHIS2_API_VERSION=40
DHIS2_PAT=your_dhis2_personal_access_token

# Optional: Organization-specific settings
DHIS2_ORG_UNIT=YOUR_ORG_UNIT_ID
DHIS2_TRACKED_ENTITY_TYPE=MCPQUTHX1Ze
DHIS2_DATASET_ID=BfMAe6Itzgt

# Enable/Disable Mock Mode (for testing)
DHIS2_USE_MOCK=false
```

### Getting DHIS2 Credentials

1. Generate a **Personal Access Token** in DHIS2 user profile:
   - Path: `User Profile -> Personal Access Tokens`
   - Context: `Server/script context`
   - Methods: `GET, POST, PUT, PATCH` (and `DELETE` only if needed)
   - For local dev, use a long expiry.
2. Store the token as `DHIS2_PAT`.
3. Use `DHIS2_USERNAME`/`DHIS2_PASSWORD` only as fallback.

2. **Test Environment**: You can use DHIS2 test instance:
   - URL: `https://test.dhis2.mohcc.gov.zw` (if available)
   - Or set up local DHIS2 instance for testing

## Features

### ✅ Real API Integration

- **Patient Sync**: Syncs patients to DHIS2 as tracked entity instances
- **Event Sending**: Sends clinical events (visits, lab results, etc.)
- **Data Values**: Sends aggregate data values
- **Programs**: Fetches available DHIS2 programs
- **Data Elements**: Fetches data elements for programs
- **Sync Status**: Checks connection and sync status

### 🔄 Automatic Fallback

- If credentials are not set, service runs in **MOCK mode**
- MOCK mode returns simulated responses
- No breaking changes - existing code continues to work
- Logs clearly indicate when running in MOCK mode

## Usage

### Sync Patients

```typescript
POST /api/dhis2/sync/patients
```

Syncs all active patients to DHIS2.

### Send Event

```typescript
POST /api/dhis2/events
Body: {
  program: 'uy2gU8kT1jF', // HIV Care Program
  orgUnit: 'YOUR_ORG_UNIT_ID',
  eventDate: '2024-12-09',
  patientId: 'patient-uuid',
  dataValues: [
    { dataElement: 'element-id', value: 'value' }
  ]
}
```

### Send Aggregate Report

```typescript
POST /api/dhis2/reports/aggregate
Body: {
  dataSet: 'BfMAe6Itzgt',
  period: '202412', // YYYYMM format
  orgUnit: 'YOUR_ORG_UNIT_ID'
}
```

### Check Sync Status

```typescript
GET /api/dhis2/sync-status
```

Returns connection status and sync statistics.

## Testing

### Test with Mock Mode

1. Set `DHIS2_USE_MOCK=true`
2. Service will automatically use MOCK mode
3. All endpoints will return simulated responses

### Test with Real API

1. Set `DHIS2_URL`, `DHIS2_API_VERSION`, and `DHIS2_PAT`
2. Restart EHR service
3. Check logs for "DHIS2 service initialized with real API integration"
4. Test endpoints - should connect to real DHIS2

### PAT Header Format (DHIS2 2.40)

Use:

```bash
Authorization: ApiToken <DHIS2_PAT>
```

`Bearer <token>` does not work for DHIS2 personal access tokens in local 2.40 testing.

## Error Handling

- All methods have try-catch blocks
- Errors are logged but don't break the application
- Error responses include error details for debugging
- MOCK mode fallback ensures service always responds

## Data Mapping

### Patient Attributes

- First Name: `w75KJ2mc4zz`
- Last Name: `zDhUuAYrxNC`
- Date of Birth: `FO4GPuUTfQU`
- Gender: `cejWyOfXge6`
- National ID: `AuPLng5hLbE`

**Note**: These attribute IDs are examples. Get actual IDs from your DHIS2 instance.

### Programs

- HIV Care and Treatment: `uy2gU8kT1jF`
- TB Care and Treatment: `M3xtLkYBlKI`
- Malaria Case Management: `WSGAb5XwJ3Y`
- Child Programme: `IpHINAT79UW`

**Note**: Program IDs vary by DHIS2 instance. Fetch using `/api/dhis2/programs`.

## Troubleshooting

### Connection Issues

1. **Check token**: Verify `DHIS2_PAT` is valid and not expired
2. **Check URL**: Ensure DHIS2 URL is accessible
3. **Check API version**: For DHIS2 2.40 use `DHIS2_API_VERSION=40`
4. **Check logs**: Look for detailed error messages

### Common Errors

- **401 Unauthorized**: Invalid/expired PAT or wrong header format
- **404 Not Found**: Wrong API version or endpoint
- **Timeout**: DHIS2 server not responding (check network)
- **403 Forbidden**: User doesn't have API access

## Next Steps

1. ✅ **Get DHIS2 credentials** from MOHCC
2. ✅ **Configure environment variables**
3. ✅ **Test connection** using `/api/dhis2/sync-status`
4. ✅ **Map data elements** for your specific programs
5. ✅ **Set up sync schedule** (daily/weekly)
6. ✅ **Monitor sync logs** for errors

## Support

For DHIS2-specific questions:
- DHIS2 Documentation: https://docs.dhis2.org/
- Zimbabwe MOHCC DHIS2 Support: Contact MOHCC IT department

For integration issues:
- Check service logs: `docker logs medicore-ehr-service`
- Review error responses from API endpoints
