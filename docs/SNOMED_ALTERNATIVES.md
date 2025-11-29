# SNOMED CT Terminology Server Alternatives

## Current Problem
Snowstorm + Elasticsearch is causing significant issues:
- Unreliable text search results
- Test/demo data pollution
- Requires extensive hardcoding of known concept IDs
- Complex setup and maintenance
- External dependency that can fail

## Recommended Solution: Direct PostgreSQL Import

### Why PostgreSQL Direct Import?
✅ **Full Control** - No external dependencies  
✅ **Reliable Search** - PostgreSQL full-text search (tsvector/tsquery)  
✅ **Fast Queries** - Native database indexes  
✅ **Simple Setup** - Uses existing PostgreSQL infrastructure  
✅ **No Hardcoding Needed** - Proper text search works out of the box  
✅ **Cost Effective** - No additional services to maintain  

### Architecture

```
SNOMED CT RF2 Files
    ↓
PostgreSQL Import Script
    ↓
PostgreSQL Tables:
  - snomed_concepts (conceptId, active, moduleId, definitionStatus)
  - snomed_descriptions (conceptId, term, typeId, languageCode, caseSignificanceId)
  - snomed_relationships (sourceId, destinationId, typeId, active)
  - snomed_refsets (refsetId, referencedComponentId, active)
    ↓
PostgreSQL Full-Text Search Indexes
    ↓
TerminologyService (simplified - no Snowstorm calls)
```

### Implementation Options

#### Option 1: Direct RF2 Import (Recommended)
- Parse RF2 files directly
- Import into PostgreSQL tables
- Use PostgreSQL full-text search
- **Pros**: Full control, reliable, fast
- **Cons**: Initial import time (~30-60 minutes)

#### Option 2: Snow Owl
- Alternative terminology server
- Similar to Snowstorm but different implementation
- **Pros**: Pre-built, FHIR support
- **Cons**: Still external dependency, may have similar issues

#### Option 3: FHIR Terminology Service (Ontoserver/HAPI)
- FHIR-based terminology server
- Supports SNOMED CT via FHIR ValueSet
- **Pros**: Standards-based, well-maintained
- **Cons**: Requires FHIR server setup, still external

#### Option 4: Hybrid Approach
- Keep known concept IDs for critical terms
- Use PostgreSQL for everything else
- **Pros**: Best of both worlds
- **Cons**: Still need some hardcoding

## Recommended: PostgreSQL Direct Import

### Database Schema

```sql
-- Core SNOMED CT tables
CREATE TABLE snomed_concepts (
  concept_id VARCHAR(18) PRIMARY KEY,
  effective_time DATE NOT NULL,
  active BOOLEAN NOT NULL,
  module_id VARCHAR(18) NOT NULL,
  definition_status_id VARCHAR(18) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE snomed_descriptions (
  description_id VARCHAR(18) PRIMARY KEY,
  effective_time DATE NOT NULL,
  active BOOLEAN NOT NULL,
  module_id VARCHAR(18) NOT NULL,
  concept_id VARCHAR(18) NOT NULL REFERENCES snomed_concepts(concept_id),
  language_code VARCHAR(2) NOT NULL DEFAULT 'en',
  type_id VARCHAR(18) NOT NULL, -- 900000000000003001 (FSN), 900000000000013009 (Synonym)
  term TEXT NOT NULL,
  case_significance_id VARCHAR(18) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE snomed_relationships (
  relationship_id VARCHAR(18) PRIMARY KEY,
  effective_time DATE NOT NULL,
  active BOOLEAN NOT NULL,
  module_id VARCHAR(18) NOT NULL,
  source_id VARCHAR(18) NOT NULL REFERENCES snomed_concepts(concept_id),
  destination_id VARCHAR(18) NOT NULL REFERENCES snomed_concepts(concept_id),
  relationship_group INTEGER NOT NULL,
  type_id VARCHAR(18) NOT NULL,
  characteristic_type_id VARCHAR(18) NOT NULL,
  modifier_id VARCHAR(18) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Full-text search indexes
CREATE INDEX idx_snomed_descriptions_concept_id ON snomed_descriptions(concept_id);
CREATE INDEX idx_snomed_descriptions_term_fts ON snomed_descriptions USING gin(to_tsvector('english', term));
CREATE INDEX idx_snomed_descriptions_active ON snomed_descriptions(active) WHERE active = true;
CREATE INDEX idx_snomed_descriptions_type_id ON snomed_descriptions(type_id);
CREATE INDEX idx_snomed_concepts_active ON snomed_concepts(active) WHERE active = true;

-- Materialized view for fast search
CREATE MATERIALIZED VIEW snomed_search_view AS
SELECT 
  c.concept_id,
  c.active,
  d.term,
  d.type_id,
  CASE 
    WHEN d.type_id = '900000000000003001' THEN 'FSN'
    WHEN d.type_id = '900000000000013009' THEN 'Synonym'
    ELSE 'Other'
  END as term_type,
  to_tsvector('english', d.term) as search_vector
FROM snomed_concepts c
JOIN snomed_descriptions d ON c.concept_id = d.concept_id
WHERE c.active = true AND d.active = true AND d.language_code = 'en';

CREATE INDEX idx_snomed_search_view_vector ON snomed_search_view USING gin(search_vector);
CREATE INDEX idx_snomed_search_view_term ON snomed_search_view(term);
```

### Search Query Example

```sql
-- Fast full-text search
SELECT concept_id, term, term_type
FROM snomed_search_view
WHERE search_vector @@ to_tsquery('english', 'diabetes & mellitus')
ORDER BY ts_rank(search_vector, to_tsquery('english', 'diabetes & mellitus')) DESC
LIMIT 50;
```

### Benefits

1. **No External Dependencies** - Everything in PostgreSQL
2. **Reliable Search** - PostgreSQL full-text search is battle-tested
3. **Fast** - Native database indexes, no network calls
4. **Simple** - Standard SQL queries
5. **Maintainable** - Easy to update when new SNOMED CT releases come out
6. **No Hardcoding** - Proper search works for all terms

## Migration Path

1. **Phase 1**: Import RF2 into PostgreSQL (one-time, ~30-60 min)
2. **Phase 2**: Update TerminologyService to use PostgreSQL instead of Snowstorm
3. **Phase 3**: Remove Snowstorm/Elasticsearch from docker-compose
4. **Phase 4**: Remove hardcoded known concept IDs (no longer needed!)

## Implementation Estimate

- **RF2 Import Script**: 2-3 hours
- **TerminologyService Refactor**: 1-2 hours  
- **Testing**: 1 hour
- **Total**: ~4-6 hours

## Next Steps

Would you like me to:
1. Create the PostgreSQL import script for RF2 files?
2. Refactor TerminologyService to use PostgreSQL?
3. Remove Snowstorm dependency?

This will give you a **much more reliable** SNOMED CT search without the pain of Snowstorm!


