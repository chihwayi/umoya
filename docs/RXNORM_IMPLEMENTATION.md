# RxNorm Integration Implementation

## Overview

RxNorm integration has been implemented to provide standardized medication nomenclature for improved interoperability, e-prescribing, and pharmacy integration.

## Implementation Status

### ✅ Completed

1. **Database Schema Updates**
   - Added RxNorm fields to `prescriptions` table:
     - `medication_name_rxnorm_code` (VARCHAR 50)
     - `medication_name_rxnorm_name` (TEXT)
     - `medication_name_rxnorm_tty` (VARCHAR 20) - Term Type (IN, SCD, SBD, etc.)
   - Added RxNorm fields to `drugs` table:
     - `rxnorm_code` (VARCHAR 50)
     - `rxnorm_name` (TEXT)
     - `rxnorm_tty` (VARCHAR 20)
   - Added indexes for performance: `idx_drugs_rxnorm_code`

2. **Backend Service Implementation**
   - Created `RxNormService` methods in `TerminologyService`:
     - `searchRxNorm(term, limit, offset)` - Search medications by name
     - `getRxNormConcept(rxcui)` - Get concept details by RXCUI
     - `validateRxNorm(rxcui)` - Validate RXCUI
     - `getRxNormRelated(rxcui, rela)` - Get related concepts
     - `findRxNormByName(name)` - Find concept by exact/approximate name
   - Integrated with NLM RxNorm REST API (https://rxnav.nlm.nih.gov/REST)
   - Added error handling and logging

3. **API Endpoints**
   - `GET /terminology/rxnorm/search?term={term}&limit={limit}&offset={offset}` - Search RxNorm
   - `GET /terminology/rxnorm/concepts/:rxcui` - Get concept details
   - `GET /terminology/rxnorm/validate/:rxcui` - Validate RXCUI
   - `GET /terminology/rxnorm/concepts/:rxcui/related?rela={rela}` - Get related concepts
   - `GET /terminology/rxnorm/find-by-name?name={name}` - Find by name

4. **Entity Updates**
   - Updated `Prescription` entity with RxNorm fields:
     - `medicationNameRxnormCode`
     - `medicationNameRxnormName`
     - `medicationNameRxnormTty`

5. **Frontend API Client**
   - Added RxNorm methods to `terminologyApi`:
     - `searchRxNorm(term, token, tenantSlug, options)`
     - `getRxNormConcept(rxcui, token, tenantSlug)`
     - `validateRxNorm(rxcui, token, tenantSlug)`
     - `getRxNormRelated(rxcui, token, tenantSlug, rela)`
     - `findRxNormByName(name, token, tenantSlug)`

### ⏳ Pending

1. **Frontend Component**
   - Create `RxNormPicker` component (similar to `SnomedConceptPicker`)
   - Integrate into prescription forms
   - Display RxNorm codes alongside SNOMED codes

2. **Prescription Service Updates**
   - Update prescription creation/update to store RxNorm codes
   - Auto-populate RxNorm when medication name is entered
   - Validate RxNorm codes before saving

3. **Drug Service Updates**
   - Update drug catalog to include RxNorm codes
   - Bulk import RxNorm mappings for existing drugs

## RxNorm Term Types (TTY)

Common RxNorm term types:
- **IN** - Ingredient
- **SCD** - Semantic Clinical Drug
- **SBD** - Semantic Branded Drug
- **SCDC** - Semantic Clinical Drug Component
- **SBDC** - Semantic Branded Drug Component
- **GPCK** - Generic Pack
- **BPCK** - Brand Pack

## Usage Examples

### Backend Service

```typescript
// Search for medications
const results = await terminologyService.searchRxNorm('metformin', 20, 0);

// Get concept details
const concept = await terminologyService.getRxNormConcept('6809');

// Find by name
const concept = await terminologyService.findRxNormByName('Metformin 500mg tablet');
```

### Frontend API

```typescript
// Search RxNorm
const results = await terminologyApi.searchRxNorm('metformin', token, tenantSlug, { limit: 20 });

// Get concept
const concept = await terminologyApi.getRxNormConcept('6809', token, tenantSlug);

// Validate
const validation = await terminologyApi.validateRxNorm('6809', token, tenantSlug);
```

## API Integration

The implementation uses the **NLM RxNorm REST API**:
- Base URL: `https://rxnav.nlm.nih.gov/REST`
- No authentication required (public API)
- Rate limiting: Recommended to cache results
- Documentation: https://rxnav.nlm.nih.gov/RxNormAPIs.html

## Benefits

1. **Interoperability**: Standardized medication codes for system-to-system communication
2. **E-Prescribing**: Required for e-prescribing systems (NCPDP SCRIPT)
3. **Pharmacy Integration**: Direct integration with pharmacy systems
4. **Drug Interaction Checking**: Better drug interaction detection using standardized codes
5. **Medication Reconciliation**: Accurate medication matching across systems

## Next Steps

1. Create `RxNormPicker` React component
2. Integrate into prescription creation/editing forms
3. Update prescription service to auto-populate RxNorm codes
4. Add RxNorm validation to prescription DTOs
5. Create migration script to backfill RxNorm codes for existing prescriptions
6. Add RxNorm to drug catalog import/export

## Testing

To test the RxNorm integration:

```bash
# Search for a medication
curl -X GET "http://localhost:3014/terminology/rxnorm/search?term=metformin" \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-ID: {tenant-slug}"

# Get concept details
curl -X GET "http://localhost:3014/terminology/rxnorm/concepts/6809" \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-ID: {tenant-slug}"
```

## Configuration

Environment variables:
- `RXNORM_BASE_URL` - RxNorm API base URL (default: `https://rxnav.nlm.nih.gov/REST`)

## Related Standards

- **SNOMED CT**: For clinical drug concepts (already implemented)
- **NDC**: National Drug Code (future implementation)
- **NCPDP SCRIPT**: E-prescribing standard (future implementation)


