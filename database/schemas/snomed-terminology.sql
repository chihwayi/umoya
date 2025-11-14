-- SNOMED CT Terminology Service Database Schema
-- This schema supports caching and mapping storage for SNOMED CT integration

-- Search result cache table
CREATE TABLE IF NOT EXISTS snomed_search_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_term VARCHAR(255) NOT NULL,
    result_limit INTEGER NOT NULL,
    result_offset INTEGER NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(search_term, result_limit, result_offset)
);

CREATE INDEX IF NOT EXISTS idx_snomed_search_cache_term ON snomed_search_cache(search_term);
CREATE INDEX IF NOT EXISTS idx_snomed_search_cache_created ON snomed_search_cache(created_at);

-- Concept cache table
CREATE TABLE IF NOT EXISTS snomed_concept_cache (
    concept_id VARCHAR(50) PRIMARY KEY,
    concept_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snomed_concept_cache_created ON snomed_concept_cache(created_at);

-- Mapping cache table
CREATE TABLE IF NOT EXISTS snomed_mapping_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_code VARCHAR(50) NOT NULL,
    target_code VARCHAR(50) NOT NULL,
    target_system VARCHAR(20) NOT NULL CHECK (target_system IN ('ICD10', 'ICD11', 'LOINC', 'CPT')),
    map_category VARCHAR(100),
    active BOOLEAN NOT NULL DEFAULT true,
    mapping_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(source_code, target_code, target_system)
);

CREATE INDEX IF NOT EXISTS idx_snomed_mapping_source ON snomed_mapping_cache(source_code, target_system);
CREATE INDEX IF NOT EXISTS idx_snomed_mapping_target ON snomed_mapping_cache(target_code, target_system);
CREATE INDEX IF NOT EXISTS idx_snomed_mapping_active ON snomed_mapping_cache(active);

-- Manual mapping table (for custom mappings)
CREATE TABLE IF NOT EXISTS snomed_manual_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_code VARCHAR(50) NOT NULL,
    target_code VARCHAR(50) NOT NULL,
    target_system VARCHAR(20) NOT NULL CHECK (target_system IN ('ICD10', 'ICD11', 'LOINC', 'CPT')),
    map_category VARCHAR(100),
    description TEXT,
    created_by UUID REFERENCES users(id),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(source_code, target_code, target_system)
);

CREATE INDEX IF NOT EXISTS idx_snomed_manual_mapping_source ON snomed_manual_mappings(source_code, target_system);
CREATE INDEX IF NOT EXISTS idx_snomed_manual_mapping_active ON snomed_manual_mappings(active);

-- Cleanup function for old cache entries
CREATE OR REPLACE FUNCTION cleanup_snomed_cache()
RETURNS void AS $$
BEGIN
    -- Delete search cache older than 7 days
    DELETE FROM snomed_search_cache WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Delete concept cache older than 30 days
    DELETE FROM snomed_concept_cache WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete mapping cache older than 90 days (keep longer as mappings are more stable)
    DELETE FROM snomed_mapping_cache WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE snomed_search_cache IS 'Caches SNOMED CT search results to reduce API calls';
COMMENT ON TABLE snomed_concept_cache IS 'Caches SNOMED CT concept details';
COMMENT ON TABLE snomed_mapping_cache IS 'Caches SNOMED CT to other terminology mappings';
COMMENT ON TABLE snomed_manual_mappings IS 'Manual mappings created by users for custom terminology mappings';

