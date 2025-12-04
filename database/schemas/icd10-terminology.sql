-- ICD-10 Terminology Database Schema
-- This schema provides searchable ICD-10 codes for clinical documentation and billing

-- Main ICD-10 codes table
CREATE TABLE IF NOT EXISTS icd10_codes (
    code VARCHAR(10) PRIMARY KEY,
    description TEXT NOT NULL,
    category VARCHAR(10),
    category_description TEXT,
    billable BOOLEAN DEFAULT true,
    valid_for_coding BOOLEAN DEFAULT true,
    includes TEXT[],
    excludes TEXT[],
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Full-text search index on description
CREATE INDEX IF NOT EXISTS idx_icd10_description_fulltext ON icd10_codes USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_icd10_category ON icd10_codes(category);
CREATE INDEX IF NOT EXISTS idx_icd10_billable ON icd10_codes(billable);

-- ICD-10 search cache (for performance)
CREATE TABLE IF NOT EXISTS icd10_search_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_term VARCHAR(255) NOT NULL,
    result_limit INTEGER NOT NULL,
    result_offset INTEGER NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(search_term, result_limit, result_offset)
);

CREATE INDEX IF NOT EXISTS idx_icd10_search_cache_term ON icd10_search_cache(search_term);
CREATE INDEX IF NOT EXISTS idx_icd10_search_cache_created ON icd10_search_cache(created_at);

-- SNOMED to ICD-10 mapping table
CREATE TABLE IF NOT EXISTS snomed_to_icd10_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snomed_code VARCHAR(20) NOT NULL,
    snomed_term TEXT,
    icd10_code VARCHAR(10) NOT NULL REFERENCES icd10_codes(code),
    map_category VARCHAR(50),
    map_rule TEXT,
    map_priority INTEGER DEFAULT 1,
    correlation VARCHAR(20), -- exact, narrow, broad, inexact
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(snomed_code, icd10_code)
);

CREATE INDEX IF NOT EXISTS idx_snomed_to_icd10_snomed ON snomed_to_icd10_map(snomed_code);
CREATE INDEX IF NOT EXISTS idx_snomed_to_icd10_icd10 ON snomed_to_icd10_map(icd10_code);
CREATE INDEX IF NOT EXISTS idx_snomed_to_icd10_active ON snomed_to_icd10_map(active);

-- Function to search ICD-10 codes
CREATE OR REPLACE FUNCTION search_icd10_codes(
    search_term TEXT,
    limit_val INTEGER DEFAULT 20,
    offset_val INTEGER DEFAULT 0,
    billable_only BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    code VARCHAR(10),
    description TEXT,
    category VARCHAR(10),
    category_description TEXT,
    billable BOOLEAN,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ic.code,
        ic.description,
        ic.category,
        ic.category_description,
        ic.billable,
        ts_rank(to_tsvector('english', ic.description), plainto_tsquery('english', search_term)) AS rank
    FROM icd10_codes ic
    WHERE 
        (to_tsvector('english', ic.description) @@ plainto_tsquery('english', search_term)
         OR ic.code ILIKE search_term || '%'
         OR ic.description ILIKE '%' || search_term || '%')
        AND ic.valid_for_coding = true
        AND (billable_only IS NULL OR ic.billable = billable_only)
    ORDER BY 
        CASE 
            WHEN ic.code = UPPER(search_term) THEN 0  -- exact code match first
            WHEN ic.code ILIKE search_term || '%' THEN 1  -- code starts with search
            ELSE 2  -- text match
        END,
        rank DESC,
        ic.code ASC
    LIMIT limit_val
    OFFSET offset_val;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get ICD-10 by category
CREATE OR REPLACE FUNCTION get_icd10_by_category(
    category_val VARCHAR(10),
    limit_val INTEGER DEFAULT 100
)
RETURNS TABLE (
    code VARCHAR(10),
    description TEXT,
    billable BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT ic.code, ic.description, ic.billable
    FROM icd10_codes ic
    WHERE ic.category = category_val
      AND ic.valid_for_coding = true
    ORDER BY ic.code
    LIMIT limit_val;
END;
$$ LANGUAGE plpgsql STABLE;

-- Cleanup function for old cache entries
CREATE OR REPLACE FUNCTION cleanup_icd10_cache()
RETURNS void AS $$
BEGIN
    -- Delete search cache older than 7 days
    DELETE FROM icd10_search_cache WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE icd10_codes IS 'ICD-10 diagnosis codes for clinical documentation and billing';
COMMENT ON TABLE icd10_search_cache IS 'Caches ICD-10 search results for performance';
COMMENT ON TABLE snomed_to_icd10_map IS 'Mapping between SNOMED CT concepts and ICD-10 codes';
COMMENT ON FUNCTION search_icd10_codes IS 'Full-text search for ICD-10 codes with ranking';
COMMENT ON COLUMN icd10_codes.billable IS 'Whether this code is valid for billing (some are category-only)';
COMMENT ON COLUMN icd10_codes.valid_for_coding IS 'Whether this code is valid for use in medical records';
COMMENT ON COLUMN snomed_to_icd10_map.correlation IS 'Mapping correlation: exact, narrow, broad, or inexact';


