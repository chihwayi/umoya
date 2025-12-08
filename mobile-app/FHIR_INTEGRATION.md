# FHIR Integration Guide for MediCore Mobile App

## Overview

FHIR (Fast Healthcare Interoperability Resources) is a standard for exchanging healthcare information electronically. The MediCore backend supports FHIR R4, and the mobile app can connect to it in two ways:

## Current Implementation

**Currently, the mobile app uses REST API endpoints directly** (not FHIR). This is simpler and faster for most use cases.

### Current API Structure:
- `/api/patients` - Patient management
- `/api/appointments` - Appointment management
- `/api/prescriptions` - Prescription management
- `/api/lab-results` - Lab results
- `/api/documents` - Document management

## FHIR Integration Options

### Option 1: Direct FHIR Endpoints (Recommended for Interoperability)

The backend exposes FHIR endpoints at `/api/fhir/`:

#### Available FHIR Resources:
- **Patient**: `/api/fhir/Patient` - Patient demographics
- **Appointment**: `/api/fhir/Appointment` - Scheduled appointments
- **Encounter**: `/api/fhir/Encounter` - Patient visits
- **Observation**: `/api/fhir/Observation` - Vitals, lab results
- **MedicationRequest**: `/api/fhir/MedicationRequest` - Prescriptions
- **DocumentReference**: `/api/fhir/DocumentReference` - Medical documents

#### Example FHIR Request:
```typescript
// Get patient by ID
const response = await ehrApi.get('/fhir/Patient/patient-id-123');

// Search patients
const response = await ehrApi.get('/fhir/Patient?name=John&birthdate=1990-01-01');

// Get appointments
const response = await ehrApi.get('/fhir/Appointment?date=2024-01-15&status=confirmed');
```

#### Benefits:
- ✅ Standardized format (FHIR R4)
- ✅ Interoperable with other EHR systems
- ✅ Rich metadata and relationships
- ✅ Supports complex queries

#### Drawbacks:
- ❌ More verbose (larger payloads)
- ❌ Requires FHIR knowledge
- ❌ Slightly slower than REST

### Option 2: Hybrid Approach (Best of Both Worlds)

Use REST API for most operations, FHIR for:
- Interoperability with external systems
- Complex queries
- Data exchange with other EHRs
- Compliance requirements

## Implementation Example

### Creating a FHIR Service

```typescript
// mobile-app/src/services/fhir.service.ts
import { ehrApi } from '../config/api';

export const fhirService = {
  // Get patient as FHIR resource
  getPatient: async (patientId: string) => {
    const response = await ehrApi.get(`/fhir/Patient/${patientId}`);
    return response;
  },

  // Search patients using FHIR
  searchPatients: async (params: {
    name?: string;
    birthdate?: string;
    identifier?: string;
  }) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await ehrApi.get(`/fhir/Patient?${queryString}`);
    return response.entry || [];
  },

  // Get appointments as FHIR resources
  getAppointments: async (date: string, status?: string) => {
    let url = `/fhir/Appointment?date=${date}`;
    if (status) url += `&status=${status}`;
    const response = await ehrApi.get(url);
    return response.entry || [];
  },
};
```

## When to Use FHIR vs REST

### Use REST API when:
- ✅ Building internal features
- ✅ Need fast, simple responses
- ✅ Working with single resources
- ✅ Performance is critical

### Use FHIR when:
- ✅ Integrating with external systems
- ✅ Need complex queries
- ✅ Compliance requires FHIR
- ✅ Exchanging data with other EHRs
- ✅ Building interoperable features

## FHIR Authentication

FHIR endpoints use the same authentication as REST:
- JWT token in `Authorization: Bearer <token>` header
- Tenant ID in `X-Tenant-ID` header

## FHIR Response Format

FHIR responses follow the FHIR R4 specification:

```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 10,
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "123",
        "name": [{
          "given": ["John"],
          "family": "Doe"
        }],
        "birthDate": "1990-01-01",
        "gender": "male"
      }
    }
  ]
}
```

## Migration Path

If you want to migrate to FHIR:

1. **Phase 1**: Keep REST API, add FHIR service alongside
2. **Phase 2**: Use FHIR for new features
3. **Phase 3**: Gradually migrate existing features
4. **Phase 4**: Full FHIR implementation (optional)

## Recommendation

**For now, stick with REST API** because:
- It's faster and simpler
- The backend already provides all needed endpoints
- FHIR can be added later if needed for interoperability

**Add FHIR support when:**
- You need to integrate with external systems
- Compliance requires FHIR
- You're building features that need FHIR's rich metadata

## Resources

- [FHIR R4 Specification](https://www.hl7.org/fhir/)
- [FHIR Patient Resource](https://www.hl7.org/fhir/patient.html)
- [FHIR Appointment Resource](https://www.hl7.org/fhir/appointment.html)
- Backend FHIR endpoints: `/api/fhir/*`


