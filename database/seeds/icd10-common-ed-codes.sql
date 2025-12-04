-- Common ICD-10 Codes for Emergency Department
-- This is a starter set - can be expanded with full ICD-10 database

INSERT INTO icd10_codes (code, description, category, category_description, billable, valid_for_coding) VALUES
-- Cardiovascular (I00-I99)
('I21.0', 'ST elevation (STEMI) myocardial infarction of anterior wall', 'I21', 'ST elevation myocardial infarction', true, true),
('I21.4', 'Non-ST elevation (NSTEMI) myocardial infarction', 'I21', 'ST elevation myocardial infarction', true, true),
('I20.0', 'Unstable angina', 'I20', 'Angina pectoris', true, true),
('I46.9', 'Cardiac arrest, cause unspecified', 'I46', 'Cardiac arrest', true, true),
('I50.9', 'Heart failure, unspecified', 'I50', 'Heart failure', true, true),
('I48.91', 'Unspecified atrial fibrillation', 'I48', 'Atrial fibrillation and flutter', true, true),
('I10', 'Essential (primary) hypertension', 'I10', 'Essential hypertension', true, true),

-- Respiratory (J00-J99)
('J18.9', 'Pneumonia, unspecified organism', 'J18', 'Pneumonia', true, true),
('J44.1', 'Chronic obstructive pulmonary disease with (acute) exacerbation', 'J44', 'COPD', true, true),
('J45.901', 'Unspecified asthma with (acute) exacerbation', 'J45', 'Asthma', true, true),
('J96.00', 'Acute respiratory failure, unspecified whether with hypoxia or hypercapnia', 'J96', 'Respiratory failure', true, true),
('R06.02', 'Shortness of breath', 'R06', 'Abnormalities of breathing', true, true),
('J02.9', 'Acute pharyngitis, unspecified', 'J02', 'Acute pharyngitis', true, true),

-- Neurological (G00-G99, I60-I69)
('I63.9', 'Cerebral infarction, unspecified', 'I63', 'Cerebral infarction', true, true),
('I61.9', 'Nontraumatic intracerebral hemorrhage, unspecified', 'I61', 'Intracerebral hemorrhage', true, true),
('G40.909', 'Epilepsy, unspecified, not intractable, without status epilepticus', 'G40', 'Epilepsy', true, true),
('R55', 'Syncope and collapse', 'R55', 'Syncope and collapse', true, true),
('R51', 'Headache', 'R51', 'Headache', true, true),
('G43.909', 'Migraine, unspecified, not intractable, without status migrainosus', 'G43', 'Migraine', true, true),

-- Gastrointestinal (K00-K95)
('K92.2', 'Gastrointestinal hemorrhage, unspecified', 'K92', 'Other diseases of digestive system', true, true),
('K35.80', 'Unspecified acute appendicitis', 'K35', 'Acute appendicitis', true, true),
('K85.9', 'Acute pancreatitis, unspecified', 'K85', 'Acute pancreatitis', true, true),
('A09', 'Infectious gastroenteritis and colitis, unspecified', 'A09', 'Gastroenteritis', true, true),
('R10.9', 'Unspecified abdominal pain', 'R10', 'Abdominal and pelvic pain', true, true),
('K21.9', 'Gastro-esophageal reflux disease without esophagitis', 'K21', 'GERD', true, true),

-- Trauma (S00-T88)
('S06.0X0A', 'Concussion without loss of consciousness, initial encounter', 'S06', 'Intracranial injury', true, true),
('S42.001A', 'Fracture of unspecified part of right clavicle, initial encounter for closed fracture', 'S42', 'Fracture of shoulder and upper arm', true, true),
('S82.001A', 'Unspecified fracture of right patella, initial encounter for closed fracture', 'S82', 'Fracture of lower leg', true, true),
('S72.001A', 'Fracture of unspecified part of neck of right femur, initial encounter for closed fracture', 'S72', 'Fracture of femur', true, true),
('T14.90', 'Injury, unspecified', 'T14', 'Injury of unspecified body region', true, true),
('S09.90XA', 'Unspecified injury of head, initial encounter', 'S09', 'Other injuries of head', true, true),

-- Infectious Disease (A00-B99)
('A41.9', 'Sepsis, unspecified organism', 'A41', 'Other sepsis', true, true),
('N39.0', 'Urinary tract infection, site not specified', 'N39', 'Other disorders of urinary system', true, true),
('L03.90', 'Cellulitis, unspecified', 'L03', 'Cellulitis', true, true),
('B34.9', 'Viral infection, unspecified', 'B34', 'Viral infection', true, true),

-- Common Symptoms (R00-R99)
('R07.9', 'Chest pain, unspecified', 'R07', 'Pain in throat and chest', true, true),
('R50.9', 'Fever, unspecified', 'R50', 'Fever', true, true),
('R11.0', 'Nausea', 'R11', 'Nausea and vomiting', true, true),
('R11.10', 'Vomiting, unspecified', 'R11', 'Nausea and vomiting', true, true),
('R42', 'Dizziness and giddiness', 'R42', 'Dizziness', true, true),
('R00.0', 'Tachycardia, unspecified', 'R00', 'Abnormalities of heart beat', true, true),
('R06.00', 'Dyspnea, unspecified', 'R06', 'Abnormalities of breathing', true, true),

-- Endocrine (E00-E90)
('E11.65', 'Type 2 diabetes mellitus with hyperglycemia', 'E11', 'Type 2 diabetes mellitus', true, true),
('E11.9', 'Type 2 diabetes mellitus without complications', 'E11', 'Type 2 diabetes mellitus', true, true),
('E10.65', 'Type 1 diabetes mellitus with hyperglycemia', 'E10', 'Type 1 diabetes mellitus', true, true),
('E86.0', 'Dehydration', 'E86', 'Volume depletion', true, true),

-- Renal (N00-N39)
('N17.9', 'Acute kidney failure, unspecified', 'N17', 'Acute kidney failure', true, true),
('N18.9', 'Chronic kidney disease, unspecified', 'N18', 'Chronic kidney disease', true, true),

-- Mental Health (F00-F99)
('F41.9', 'Anxiety disorder, unspecified', 'F41', 'Anxiety disorders', true, true),
('F32.9', 'Major depressive disorder, single episode, unspecified', 'F32', 'Depressive episode', true, true),
('F10.10', 'Alcohol abuse, uncomplicated', 'F10', 'Alcohol related disorders', true, true),

-- Pregnancy/OB (O00-O9A)
('O20.0', 'Threatened abortion', 'O20', 'Hemorrhage in early pregnancy', true, true),
('O47.9', 'False labor, unspecified', 'O47', 'False labor', true, true),
('O80', 'Encounter for full-term uncomplicated delivery', 'O80', 'Normal delivery', true, true)

ON CONFLICT (code) DO UPDATE SET
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    category_description = EXCLUDED.category_description,
    billable = EXCLUDED.billable,
    valid_for_coding = EXCLUDED.valid_for_coding,
    updated_at = NOW();

-- Create common category summary
INSERT INTO icd10_codes (code, description, category, category_description, billable, valid_for_coding) VALUES
('I21', 'ST elevation (STEMI) myocardial infarction', 'I21', 'ST elevation myocardial infarction', false, false),
('I20', 'Angina pectoris', 'I20', 'Angina pectoris', false, false),
('J18', 'Pneumonia, organism unspecified', 'J18', 'Pneumonia', false, false),
('K35', 'Acute appendicitis', 'K35', 'Acute appendicitis', false, false)
ON CONFLICT (code) DO NOTHING;


