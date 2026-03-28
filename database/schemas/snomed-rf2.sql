-- Enable pg_trgm extension for similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- SNOMED CT RF2 Release Format Tables
-- These tables store the full SNOMED CT release data

-- Concepts Table
CREATE TABLE IF NOT EXISTS snomed_concepts (
    concept_id VARCHAR(20) PRIMARY KEY,
    effective_time DATE NOT NULL,
    active BOOLEAN NOT NULL,
    module_id VARCHAR(20) NOT NULL,
    definition_status_id VARCHAR(20) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snomed_concepts_active ON snomed_concepts(active);

-- Descriptions Table
CREATE TABLE IF NOT EXISTS snomed_descriptions (
    description_id VARCHAR(20) PRIMARY KEY,
    effective_time DATE NOT NULL,
    active BOOLEAN NOT NULL,
    module_id VARCHAR(20) NOT NULL,
    concept_id VARCHAR(20) NOT NULL REFERENCES snomed_concepts(concept_id),
    language_code VARCHAR(10) NOT NULL,
    type_id VARCHAR(20) NOT NULL,
    term TEXT NOT NULL,
    case_significance_id VARCHAR(20) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snomed_descriptions_concept_id ON snomed_descriptions(concept_id);
CREATE INDEX IF NOT EXISTS idx_snomed_descriptions_term_trgm ON snomed_descriptions USING gin (term gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_snomed_descriptions_active ON snomed_descriptions(active);
CREATE INDEX IF NOT EXISTS idx_snomed_descriptions_type_id ON snomed_descriptions(type_id);

-- Relationships Table
CREATE TABLE IF NOT EXISTS snomed_relationships (
    relationship_id VARCHAR(20) PRIMARY KEY,
    effective_time DATE NOT NULL,
    active BOOLEAN NOT NULL,
    module_id VARCHAR(20) NOT NULL,
    source_id VARCHAR(20) NOT NULL REFERENCES snomed_concepts(concept_id),
    destination_id VARCHAR(20) NOT NULL REFERENCES snomed_concepts(concept_id),
    relationship_group INTEGER NOT NULL,
    type_id VARCHAR(20) NOT NULL,
    characteristic_type_id VARCHAR(20) NOT NULL,
    modifier_id VARCHAR(20) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snomed_relationships_source ON snomed_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_snomed_relationships_destination ON snomed_relationships(destination_id);
CREATE INDEX IF NOT EXISTS idx_snomed_relationships_type ON snomed_relationships(type_id);

-- Materialized View for Search
-- description_id is included so we can create a UNIQUE index enabling
-- REFRESH MATERIALIZED VIEW CONCURRENTLY (non-blocking during imports)
CREATE MATERIALIZED VIEW IF NOT EXISTS snomed_search_view AS
SELECT
    d.description_id,
    c.concept_id,
    d.term,
    d.type_id as term_type,
    c.active,
    to_tsvector('english', d.term) as search_vector
FROM snomed_concepts c
JOIN snomed_descriptions d ON c.concept_id = d.concept_id
WHERE c.active = true AND d.active = true;

-- UNIQUE index is required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_snomed_search_description_id ON snomed_search_view(description_id);
CREATE INDEX IF NOT EXISTS idx_snomed_search_vector ON snomed_search_view USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_snomed_search_concept_id ON snomed_search_view(concept_id);

-- ICD-10 Codes Table
CREATE TABLE IF NOT EXISTS icd10_codes (
    code VARCHAR(20) PRIMARY KEY,
    description TEXT NOT NULL,
    valid_for_coding BOOLEAN DEFAULT true,
    billable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_icd10_codes_description_trgm ON icd10_codes USING gin (description gin_trgm_ops);

-- SNOMED to ICD-10 Mapping Table
CREATE TABLE IF NOT EXISTS snomed_to_icd10_map (
    snomed_code VARCHAR(20) NOT NULL,
    snomed_term TEXT,
    icd10_code VARCHAR(20) NOT NULL,
    map_category VARCHAR(100),
    map_rule VARCHAR(100),
    map_priority INTEGER DEFAULT 1,
    correlation VARCHAR(100),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (snomed_code, icd10_code, map_priority)
);

CREATE INDEX IF NOT EXISTS idx_snomed_icd10_map_snomed ON snomed_to_icd10_map(snomed_code);
CREATE INDEX IF NOT EXISTS idx_snomed_icd10_map_icd10 ON snomed_to_icd10_map(icd10_code);

-- Terminology Import Jobs Table
CREATE TABLE IF NOT EXISTS terminology_import_jobs (
    job_id VARCHAR(50) PRIMARY KEY,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    progress INTEGER DEFAULT 0,
    total_rows INTEGER,
    processed_rows INTEGER,
    file_name VARCHAR(255),
    type VARCHAR(20),
    error TEXT,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_start_time ON terminology_import_jobs(start_time DESC);
