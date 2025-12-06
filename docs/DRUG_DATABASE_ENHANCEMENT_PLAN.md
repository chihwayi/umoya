# Drug Database Enhancement Plan

## Current Status

### Database Structure
- **Table**: `drugs`
- **Current Count**: 15 drugs (very limited)
- **Current Fields**:
  - `generic_name` ✅
  - `brand_names` ✅ (array)
  - `atc_code` ✅ (WHO ATC classification)
  - `drug_class` ✅
  - `active_ingredients` ✅ (array)
  - `dosage_forms` ✅ (array)
  - `route_of_administration` ✅ (array)
  - `description` ✅
  - `is_active` ✅

### Missing Critical Fields for FHIR Compliance
- ❌ **RxNorm Code** - Essential for US drug identification
- ❌ **RxNorm Name** - Standardized drug name
- ❌ **SNOMED CT Code** - International standard
- ❌ **SNOMED CT Term** - SNOMED terminology
- ❌ **NDC Code** - National Drug Code (US)
- ❌ **Strength** - Drug strength/dosage
- ❌ **Unit** - Unit of measurement
- ❌ **Status** - active, inactive, entered-in-error (FHIR standard)

---

## Recommended Drug Data Sources

### 1. **RxNorm (Primary - US Standard)**
**Source**: U.S. National Library of Medicine (NLM)
- **License**: Free (requires UMLS registration)
- **Coverage**: ~200,000+ drug concepts
- **Update Frequency**: Monthly
- **Format**: Pipe-delimited files, API
- **Best For**: US market, FHIR compliance, prescription writing

**How to Access**:
1. Register for free UMLS license: https://uts.nlm.nih.gov/uts
2. Download RxNorm files: https://www.nlm.nih.gov/research/umls/rxnorm/docs/rxnormfiles.html
3. Use "Current Prescribable Content" subset (no license needed for subset)
4. API access: https://www.nlm.nih.gov/research/umls/rxnorm/docs/RxNormAPIs.html

**Key Files**:
- `RXNCONSO.RRF` - Concepts and names
- `RXNREL.RRF` - Relationships
- `RXNSAT.RRF` - Attributes (strength, form, etc.)

### 2. **SNOMED CT (International Standard)**
**Source**: SNOMED International
- **License**: Requires membership/license (varies by country)
- **Coverage**: Global, comprehensive
- **Update Frequency**: Twice yearly
- **Format**: RF2 files, API
- **Best For**: International use, clinical terminology

**How to Access**:
- For Zimbabwe: Check if available through WHO or local health authority
- Alternative: Use SNOMED CT browser: https://browser.ihtsdotools.org/
- API: https://browser.ihtsdotools.org/api/

### 3. **WHO ATC/DDD Index (Drug Classification)**
**Source**: World Health Organization
- **License**: Free
- **Coverage**: ~5,000+ drugs with ATC codes
- **Update Frequency**: Annually
- **Format**: Text files, Excel
- **Best For**: Drug classification, DDD (Defined Daily Dose)

**How to Access**:
- Download: https://www.whocc.no/atc_ddd_index/
- File: `atc_ddd_index.txt`

### 4. **OpenFDA Drug Database (US)**
**Source**: U.S. Food and Drug Administration
- **License**: Free, public domain
- **Coverage**: FDA-approved drugs
- **Update Frequency**: Real-time API
- **Format**: JSON API
- **Best For**: FDA labels, adverse events, NDC codes

**How to Access**:
- API: https://open.fda.gov/apis/drug/
- Documentation: https://open.fda.gov/apis/drug/label/

### 5. **DrugBank (Commercial/Research)**
**Source**: DrugBank
- **License**: Free for academic, commercial license required
- **Coverage**: ~14,000+ drugs
- **Update Frequency**: Quarterly
- **Format**: XML, CSV, SQL
- **Best For**: Drug interactions, pharmacology, targets

**How to Access**:
- Free tier: https://go.drugbank.com/releases/latest
- Requires registration

---

## Recommended Approach for Your System

### Phase 1: Enhance Drug Entity (IMMEDIATE)
Add missing fields to support FHIR Medication resource:

```sql
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS rxnorm_code VARCHAR(20);
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS rxnorm_name TEXT;
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS snomed_code VARCHAR(50);
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS snomed_term TEXT;
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS ndc_code VARCHAR(20);
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS strength VARCHAR(50);
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS unit VARCHAR(20);
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_drugs_rxnorm_code ON drugs(rxnorm_code);
CREATE INDEX IF NOT EXISTS idx_drugs_snomed_code ON drugs(snomed_code);
CREATE INDEX IF NOT EXISTS idx_drugs_ndc_code ON drugs(ndc_code);
```

### Phase 2: Import RxNorm Data (RECOMMENDED)
**Why RxNorm First?**
- Free and comprehensive
- US standard (widely used)
- FHIR-compliant
- Monthly updates
- Good API support

**Steps**:
1. Register for UMLS license (free)
2. Download "Current Prescribable Content" subset (no license needed)
3. Create import script to map RxNorm to your schema
4. Import top 10,000 most common drugs
5. Set up monthly update process

### Phase 3: Supplement with WHO ATC
- Import ATC codes for better classification
- Link to existing drugs by generic name
- Enhance drug class information

### Phase 4: Add SNOMED CT (If Available)
- If SNOMED license available for Zimbabwe
- Import SNOMED medication codes
- Link to RxNorm via cross-maps

---

## Implementation Plan

### Step 1: Update Drug Entity
- [ ] Add RxNorm fields
- [ ] Add SNOMED fields
- [ ] Add NDC, strength, unit fields
- [ ] Add status field
- [ ] Update TypeORM entity

### Step 2: Create Drug Import Service
- [ ] RxNorm import script
- [ ] WHO ATC import script
- [ ] Data validation and deduplication
- [ ] Batch import with progress tracking

### Step 3: Initial Data Import
- [ ] Import RxNorm "Current Prescribable Content" (~10,000 drugs)
- [ ] Import WHO ATC codes
- [ ] Link and cross-reference
- [ ] Validate data quality

### Step 4: Set Up Update Process
- [ ] Monthly RxNorm update script
- [ ] Version control for drug data
- [ ] Audit trail for changes

---

## Quick Start: RxNorm "Current Prescribable Content"

**This subset doesn't require a UMLS license!**

1. **Download**: https://www.nlm.nih.gov/research/umls/rxnorm/docs/rxnormfiles.html#current
2. **File**: `rrf/RXNCONSO.RRF` (concepts)
3. **Filter**: TTY = 'SCD' (Semantic Clinical Drug) or 'SCDC' (Semantic Clinical Drug Component)
4. **Import**: Map to your `drugs` table

**Sample Import Script Structure**:
```typescript
// Parse RXNCONSO.RRF
// Filter for prescribable drugs (TTY = 'SCD', 'SCDC')
// Extract: RXCUI (RxNorm code), STR (name), SAB (source)
// Map to: rxnorm_code, rxnorm_name, generic_name
// Import in batches of 1000
```

---

## Estimated Drug Counts

- **RxNorm Current Prescribable**: ~10,000-15,000 drugs
- **RxNorm Full**: ~200,000+ concepts (includes all forms/strengths)
- **WHO ATC**: ~5,000+ drugs
- **SNOMED CT Medications**: ~50,000+ concepts

**Recommendation**: Start with RxNorm "Current Prescribable Content" (~10,000 drugs) for a robust, production-ready drug database.

---

## Next Steps

1. ✅ Review this plan
2. ⏭️ Enhance Drug entity with missing fields
3. ⏭️ Create RxNorm import script
4. ⏭️ Import initial drug dataset
5. ⏭️ Continue with FHIR Medication resource mapping

**Ready to proceed?** Let me know if you want to:
- A) Enhance the Drug entity first, then import data
- B) Import data first, then enhance entity
- C) Do both in parallel

