-- Seed minimal SNOMED CT test data for development

-- Insert Concepts
INSERT INTO snomed_concepts (concept_id, effective_time, active, module_id, definition_status_id) VALUES
('25064002', '2024-01-01', true, '900000000000207008', '900000000000074008'), -- Headache
('364075005', '2024-01-01', true, '900000000000207008', '900000000000074008'), -- Heart rate
('84114007', '2024-01-01', true, '900000000000207008', '900000000000074008'), -- Heart failure
('301366005', '2024-01-01', true, '900000000000207008', '900000000000074008'), -- Pain in head
('77386006', '2024-01-01', true, '900000000000207008', '900000000000074008'), -- Pregnant
('73211009', '2024-01-01', true, '900000000000207008', '900000000000074008'), -- Diabetes mellitus
('38341003', '2024-01-01', true, '900000000000207008', '900000000000074008'), -- Hypertension
('404684003', '2024-01-01', true, '900000000000207008', '900000000000074008'); -- Clinical finding (root for many findings)

-- Insert Descriptions (FSN and Synonyms)
INSERT INTO snomed_descriptions (description_id, effective_time, active, module_id, concept_id, language_code, type_id, term, case_significance_id) VALUES
-- Headache
('37436011', '2024-01-01', true, '900000000000207008', '25064002', 'en', '900000000000003001', 'Headache (finding)', '900000000000448009'),
('37436012', '2024-01-01', true, '900000000000207008', '25064002', 'en', '900000000000013009', 'Headache', '900000000000448009'),
('37436013', '2024-01-01', true, '900000000000207008', '25064002', 'en', '900000000000013009', 'Head pain', '900000000000448009'),

-- Heart rate
('528069011', '2024-01-01', true, '900000000000207008', '364075005', 'en', '900000000000003001', 'Heart rate (observable entity)', '900000000000448009'),
('528069012', '2024-01-01', true, '900000000000207008', '364075005', 'en', '900000000000013009', 'Heart rate', '900000000000448009'),

-- Heart failure
('135759011', '2024-01-01', true, '900000000000207008', '84114007', 'en', '900000000000003001', 'Heart failure (disorder)', '900000000000448009'),
('135759012', '2024-01-01', true, '900000000000207008', '84114007', 'en', '900000000000013009', 'Heart failure', '900000000000448009'),

-- Pain in head
('446624011', '2024-01-01', true, '900000000000207008', '301366005', 'en', '900000000000003001', 'Pain in head (finding)', '900000000000448009'),

-- Pregnant
('127086011', '2024-01-01', true, '900000000000207008', '77386006', 'en', '900000000000003001', 'Pregnant (finding)', '900000000000448009'),

-- Diabetes
('118844011', '2024-01-01', true, '900000000000207008', '73211009', 'en', '900000000000003001', 'Diabetes mellitus (disorder)', '900000000000448009'),

-- Hypertension
('61676011', '2024-01-01', true, '900000000000207008', '38341003', 'en', '900000000000003001', 'Hypertension (disorder)', '900000000000448009');

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW snomed_search_view;
