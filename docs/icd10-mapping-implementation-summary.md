# ICD-10 Mapping Implementation Summary

## Completed Components

### 1. Database Schema & Provisioning Bundle ✅
- **Location**: `services/tenant-service/src/services/database-provisioning.service.ts`
- **Bundle ID**: `icd10_mapping`
- **Tables Created**:
  - `snomed_icd10_mappings`: Stores SNOMED→ICD-10 mappings with map group, priority, advice, status
  - `icd10_mapping_metadata`: Tracks version, effective time, import status
- **Indexes**: Optimized for lookups by `concept_id`, `target_code`, and active status

### 2. Import Script ✅
- **Location**: `scripts/import-icd10-map.ts`
- **Features**:
  - Extracts RF2 map files from `SNOMED_CT_to_ICD-10-CM_Resources_20250901.zip`
  - Parses SimpleMap and ExtendedMap refsets
  - Upserts mappings into tenant database
  - Records metadata (version, effective time, row counts)
  - Supports `--connection`, `--zip`, `--dry-run` flags

### 3. Backend API ✅
- **Location**: `services/ehr-service/src/services/terminology.service.ts`
- **Methods**:
  - `getIcd10Mappings()`: Query mappings with filtering (primaryOnly, includeInactive, limit)
  - `getIcd10MappingMetadata()`: Get version/import status
  - `mapConcept()`: Updated to use ICD-10 mappings when targetSystem is 'ICD10'
- **Controller**: `services/ehr-service/src/controllers/terminology.controller.ts`
  - `GET /terminology/snomed/map/:conceptId/ICD10` - Get ICD-10 mappings
  - `GET /terminology/snomed/icd10/metadata` - Get mapping metadata

### 4. Frontend API Client ✅
- **Location**: `ehr-frontend/src/services/api.ts`
- **Methods Added to `terminologyApi`**:
  - `getIcd10Mappings()`: Fetch ICD-10 mappings for a SNOMED concept
  - `getIcd10MappingMetadata()`: Get mapping version info

### 5. UI Component ✅
- **Location**: `ehr-frontend/src/components/Icd10Suggestions.tsx`
- **Features**:
  - Displays ICD-10 code suggestions when a SNOMED concept is selected
  - Shows map priority, status badges, and advice
  - Allows selection of ICD-10 codes
  - Collapsible UI with loading/error states
  - Visual indicators for primary vs. alternative mappings

## Usage

### Importing Mappings
```bash
# Import from the staged zip file
npx ts-node scripts/import-icd10-map.ts \
  --connection "postgresql://user:pass@host:5432/tenant_db" \
  --zip snowstorm/imports/SNOMED_CT_to_ICD-10-CM_Resources_20250901.zip
```

### Applying Schema to Tenants
```bash
# Apply the ICD-10 mapping bundle to a tenant
npx ts-node scripts/run-tenant-upgrades.ts \
  --bundle icd10_mapping \
  --connection "postgresql://user:pass@host:5432/tenant_db"
```

### Using in Frontend
```tsx
import Icd10Suggestions from './components/Icd10Suggestions';

<Icd10Suggestions
  snomedConceptId={selectedConcept?.conceptId || null}
  token={token}
  tenantSlug={tenantSlug}
  onSelect={(code, display) => {
    // Handle ICD-10 code selection
    setIcd10Code(code);
  }}
/>
```

## API Examples

### Get ICD-10 Mappings
```bash
GET /api/terminology/snomed/map/197480006/ICD10?primaryOnly=false&limit=10
Authorization: Bearer <token>
X-Tenant-ID: <tenant-slug>
```

Response:
```json
[
  {
    "conceptId": "197480006",
    "targetCode": "F41.9",
    "targetDisplay": "Anxiety disorder, unspecified",
    "mapGroup": 1,
    "mapPriority": 1,
    "mapAdvice": "Use additional code if applicable",
    "mapStatus": "APPROVED",
    "active": true,
    "effectiveTime": "2025-09-01"
  }
]
```

### Get Mapping Metadata
```bash
GET /api/terminology/snomed/icd10/metadata
Authorization: Bearer <token>
X-Tenant-ID: <tenant-slug>
```

Response:
```json
{
  "releaseLabel": "SNOMED_CT_to_ICD-10-CM_Resources_20250901",
  "effectiveTime": "2025-09-01",
  "sourceZip": "SNOMED_CT_to_ICD-10-CM_Resources_20250901.zip",
  "totalRows": 123456,
  "importStartedAt": "2025-01-15T10:00:00Z",
  "importCompletedAt": "2025-01-15T10:15:00Z"
}
```

## Next Steps

1. **Integration**: Add `Icd10Suggestions` component to diagnosis input fields in:
   - `AppointmentNotes.tsx` (when SNOMED diagnosis is selected)
   - `PatientAssessment.tsx` (triage assessments)
   - Specialty dashboards (Oncology, Cardiology)

2. **Testing**: 
   - Run import script on QA tenant
   - Verify API endpoints return correct mappings
   - Test UI component with various SNOMED concepts

3. **Documentation**: Update user guides to explain ICD-10 code suggestions

## Notes

- Mappings are stored per-tenant (each tenant database has its own `snomed_icd10_mappings` table)
- The import script can be run multiple times safely (uses upsert logic)
- Mapping metadata tracks version to support future updates
- UI component gracefully handles missing mappings or unprovisioned tenants

