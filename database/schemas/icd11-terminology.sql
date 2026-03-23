-- ICD-11 Terminology Schema
-- WHO ICD-11 Mortality and Morbidity Statistics (MMS) linearization
-- Codes use alphanumeric format (e.g. CA22.0, XY12.Z0)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS icd11_codes (
    code            VARCHAR(20)  PRIMARY KEY,
    title           TEXT         NOT NULL,
    inclusion       TEXT,
    exclusion       TEXT,
    parent_code     VARCHAR(20),
    chapter         VARCHAR(10),
    block_start     VARCHAR(20),
    block_end       VARCHAR(20),
    billable        BOOLEAN      NOT NULL DEFAULT true,
    valid_for_coding BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_icd11_title_trgm    ON icd11_codes USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_icd11_title_fulltext ON icd11_codes USING gin (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_icd11_parent_code   ON icd11_codes(parent_code);
CREATE INDEX IF NOT EXISTS idx_icd11_chapter       ON icd11_codes(chapter);
CREATE INDEX IF NOT EXISTS idx_icd11_billable      ON icd11_codes(billable);

-- SNOMED to ICD-11 mapping table
CREATE TABLE IF NOT EXISTS snomed_to_icd11_map (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    snomed_code VARCHAR(20) NOT NULL,
    snomed_term TEXT,
    icd11_code  VARCHAR(20) NOT NULL REFERENCES icd11_codes(code),
    correlation VARCHAR(20),   -- exact, narrow, broad, inexact
    active      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (snomed_code, icd11_code)
);

CREATE INDEX IF NOT EXISTS idx_snomed_to_icd11_snomed ON snomed_to_icd11_map(snomed_code);
CREATE INDEX IF NOT EXISTS idx_snomed_to_icd11_icd11  ON snomed_to_icd11_map(icd11_code);

-- Full-text search function for ICD-11
CREATE OR REPLACE FUNCTION search_icd11_codes(
    search_term   TEXT,
    limit_val     INTEGER DEFAULT 20,
    offset_val    INTEGER DEFAULT 0,
    billable_only BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
    code    VARCHAR(20),
    title   TEXT,
    chapter VARCHAR(10),
    billable BOOLEAN,
    rank    REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.code,
        i.title,
        i.chapter,
        i.billable,
        ts_rank(to_tsvector('english', i.title), plainto_tsquery('english', search_term)) AS rank
    FROM icd11_codes i
    WHERE
        (to_tsvector('english', i.title) @@ plainto_tsquery('english', search_term)
         OR i.code ILIKE search_term || '%'
         OR i.title ILIKE '%' || search_term || '%')
        AND i.valid_for_coding = true
        AND (billable_only IS NULL OR i.billable = billable_only)
    ORDER BY
        CASE
            WHEN i.code = UPPER(search_term) THEN 0
            WHEN i.code ILIKE search_term || '%' THEN 1
            ELSE 2
        END,
        rank DESC,
        i.code ASC
    LIMIT limit_val OFFSET offset_val;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE icd11_codes IS 'WHO ICD-11 MMS linearization codes for clinical documentation and billing';
COMMENT ON TABLE snomed_to_icd11_map IS 'Mapping between SNOMED CT concepts and ICD-11 codes';
