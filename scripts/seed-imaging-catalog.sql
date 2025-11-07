-- Seed Imaging Catalog with Modalities and Common Study Types
-- This script populates imaging_modalities and imaging_study_types tables

-- ===================================
-- IMAGING MODALITIES
-- ===================================

INSERT INTO imaging_modalities (modality_code, modality_name, description, is_active)
VALUES 
  ('XR', 'X-Ray (Radiography)', 'Conventional radiography using ionizing radiation', true),
  ('CT', 'CT Scan (Computed Tomography)', 'Cross-sectional imaging using X-rays and computer processing', true),
  ('MRI', 'MRI (Magnetic Resonance Imaging)', 'Imaging using magnetic fields and radio waves', true),
  ('US', 'Ultrasound', 'Imaging using high-frequency sound waves', true),
  ('MG', 'Mammography', 'Breast imaging using low-dose X-rays', true),
  ('FL', 'Fluoroscopy', 'Real-time X-ray imaging', true),
  ('NM', 'Nuclear Medicine', 'Imaging using radioactive tracers', true),
  ('PET', 'PET Scan', 'Positron emission tomography for metabolic imaging', true)
ON CONFLICT (modality_code) DO NOTHING;

-- ===================================
-- X-RAY STUDIES
-- ===================================

-- Chest X-Ray
INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, views, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'CXR-PA', 'Chest X-Ray (PA)', 'Chest', ARRAY['PA'], 1, false, 25.00,
  'Posterior-anterior view of chest', 
  'Remove jewelry and metallic objects from chest area. Patient should be able to hold breath.', 
  true
FROM imaging_modalities WHERE modality_code = 'XR' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, views, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'CXR-PA-LAT', 'Chest X-Ray (PA & Lateral)', 'Chest', ARRAY['PA', 'Lateral'], 2, false, 35.00,
  'PA and lateral views of chest',
  'Remove jewelry and metallic objects from chest area. Patient should be able to hold breath.',
  true
FROM imaging_modalities WHERE modality_code = 'XR' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

-- Abdomen X-Ray
INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, views, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'AXR', 'Abdomen X-Ray', 'Abdomen', ARRAY['AP'], 1, false, 30.00,
  'Anteroposterior view of abdomen',
  'Remove clothing and jewelry from abdomen area. Fasting not required unless specified.',
  true
FROM imaging_modalities WHERE modality_code = 'XR' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

-- Spine X-Rays
INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, views, typical_images, contrast_required, cost, description, is_active)
SELECT id, 'SPINE-C', 'Cervical Spine X-Ray', 'Cervical Spine', ARRAY['AP', 'Lateral'], 2, false, 40.00,
  'AP and lateral views of cervical spine',
  true
FROM imaging_modalities WHERE modality_code = 'XR' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, views, typical_images, contrast_required, cost, description, is_active)
SELECT id, 'SPINE-L', 'Lumbar Spine X-Ray', 'Lumbar Spine', ARRAY['AP', 'Lateral'], 2, false, 45.00,
  'AP and lateral views of lumbar spine',
  true
FROM imaging_modalities WHERE modality_code = 'XR' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

-- Extremities
INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, views, typical_images, contrast_required, cost, description, is_active)
SELECT id, 'HAND', 'Hand X-Ray', 'Hand', ARRAY['PA', 'Oblique', 'Lateral'], 3, false, 35.00,
  'Three views of hand',
  true
FROM imaging_modalities WHERE modality_code = 'XR' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, views, typical_images, contrast_required, cost, description, is_active)
SELECT id, 'KNEE', 'Knee X-Ray', 'Knee', ARRAY['AP', 'Lateral'], 2, false, 35.00,
  'AP and lateral views of knee',
  true
FROM imaging_modalities WHERE modality_code = 'XR' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, views, typical_images, contrast_required, cost, description, is_active)
SELECT id, 'ANKLE', 'Ankle X-Ray', 'Ankle', ARRAY['AP', 'Lateral', 'Mortise'], 3, false, 35.00,
  'Three views of ankle',
  true
FROM imaging_modalities WHERE modality_code = 'XR' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

-- ===================================
-- CT SCANS
-- ===================================

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'CT-HEAD', 'CT Head (Brain)', 'Head/Brain', 1, false, 200.00,
  'Non-contrast CT scan of the head and brain',
  'Remove all metal objects from head. Patient must remain still during scan.',
  true
FROM imaging_modalities WHERE modality_code = 'CT' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'CT-CHEST', 'CT Chest', 'Chest', 1, true, 250.00,
  'CT scan of chest with or without contrast',
  'NPO 4 hours before scan if contrast is planned. Remove metal objects. Inform if allergic to contrast.',
  true
FROM imaging_modalities WHERE modality_code = 'CT' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'CT-ABD-PELVIS', 'CT Abdomen & Pelvis', 'Abdomen/Pelvis', 1, true, 300.00,
  'CT scan of abdomen and pelvis with or without contrast',
  'NPO 4 hours before scan. May require oral contrast 1-2 hours prior. Remove metal objects.',
  true
FROM imaging_modalities WHERE modality_code = 'CT' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

-- ===================================
-- MRI SCANS
-- ===================================

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'MRI-BRAIN', 'MRI Brain', 'Brain', 1, false, 400.00,
  'MRI of brain with or without contrast',
  'Remove all metal objects. Inform staff of any implants, pacemakers, or claustrophobia. Fast 4 hours if contrast planned.',
  true
FROM imaging_modalities WHERE modality_code = 'MRI' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'MRI-SPINE-L', 'MRI Lumbar Spine', 'Lumbar Spine', 1, false, 450.00,
  'MRI of lumbar spine',
  'Remove all metal objects. Inform staff of any implants or pacemakers.',
  true
FROM imaging_modalities WHERE modality_code = 'MRI' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

-- ===================================
-- ULTRASOUND STUDIES
-- ===================================

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'US-ABD', 'Abdomen Ultrasound', 'Abdomen', 1, false, 75.00,
  'Ultrasound examination of abdomen (liver, gallbladder, kidneys, spleen)',
  'NPO 6-8 hours before exam. Drink 32oz water 1 hour before if bladder evaluation needed.',
  true
FROM imaging_modalities WHERE modality_code = 'US' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'US-OB', 'Obstetric Ultrasound', 'Uterus/Fetus', 1, false, 85.00,
  'Ultrasound for pregnancy evaluation',
  'Full bladder recommended for early pregnancy. Drink 32oz water 1 hour before exam.',
  true
FROM imaging_modalities WHERE modality_code = 'US' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'US-PELVIC', 'Pelvic Ultrasound', 'Pelvis', 1, false, 80.00,
  'Ultrasound of pelvic organs (uterus, ovaries, bladder)',
  'Full bladder required. Drink 32oz water 1 hour before exam and do not void.',
  true
FROM imaging_modalities WHERE modality_code = 'US' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, typical_images, contrast_required, cost, description, is_active)
SELECT id, 'US-THYROID', 'Thyroid Ultrasound', 'Neck/Thyroid', 1, false, 70.00,
  'Ultrasound examination of thyroid gland',
  true
FROM imaging_modalities WHERE modality_code = 'US' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'US-BREAST', 'Breast Ultrasound', 'Breast', 1, false, 75.00,
  'Ultrasound examination of breast tissue',
  'No special preparation required.',
  true
FROM imaging_modalities WHERE modality_code = 'US' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

-- ===================================
-- MAMMOGRAPHY
-- ===================================

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, views, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'MG-SCREENING', 'Screening Mammogram', 'Breast', ARRAY['CC', 'MLO'], 4, false, 120.00,
  'Screening mammography (bilateral CC and MLO views)',
  'Do not use deodorant, powder, or lotion on chest/underarm area. Wear two-piece clothing.',
  true
FROM imaging_modalities WHERE modality_code = 'MG' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

INSERT INTO imaging_study_types (modality_id, study_code, study_name, body_part, views, typical_images, contrast_required, cost, description, preparation_instructions, is_active)
SELECT id, 'MG-DIAGNOSTIC', 'Diagnostic Mammogram', 'Breast', ARRAY['CC', 'MLO', 'Spot'], 6, false, 150.00,
  'Diagnostic mammography with additional views as needed',
  'Do not use deodorant, powder, or lotion on chest/underarm area. Bring previous mammograms if available.',
  true
FROM imaging_modalities WHERE modality_code = 'MG' LIMIT 1
ON CONFLICT (study_code) DO NOTHING;

-- ===================================
-- COMMON REPORT TEMPLATES
-- ===================================

-- Chest X-Ray Normal Template
INSERT INTO imaging_report_templates (modality_id, study_type_id, template_name, template_code, technique_template, findings_template, impression_template, is_default, created_by)
SELECT 
  mod.id, 
  st.id,
  'Chest X-Ray - Normal', 
  'CXR-NORMAL',
  'PA and lateral chest radiographs were obtained.',
  E'LUNGS: Clear bilaterally. No focal consolidation, pleural effusion, or pneumothorax.\nHEART: Normal size and contour.\nMEDIASTINUM: Normal width. No mediastinal mass or lymphadenopathy.\nBONES: No acute fracture or destructive lesion visualized.\nSOFT TISSUES: Unremarkable.',
  'Normal chest radiograph.',
  true,
  NULL
FROM imaging_modalities mod, imaging_study_types st
WHERE mod.modality_code = 'XR' AND st.study_code = 'CXR-PA-LAT'
LIMIT 1
ON CONFLICT (template_code) DO NOTHING;

-- Abdominal Ultrasound Template
INSERT INTO imaging_report_templates (modality_id, study_type_id, template_name, template_code, technique_template, findings_template, impression_template, is_default)
SELECT 
  mod.id,
  st.id,
  'Abdomen Ultrasound - Normal',
  'US-ABD-NORMAL',
  'Grayscale ultrasound examination of the abdomen.',
  E'LIVER: Normal size, echogenicity, and contour. No focal lesion.\nGALLBLADDER: Normal. No stones or wall thickening.\nKIDNEYS: Right and left kidneys are normal in size and echogenicity. No hydronephrosis or stones.\nSPLEEN: Normal size and echogenicity.\nPANCREAS: Visualized portions are unremarkable.\nAORTA: Normal caliber.\nASCITES: None.',
  'Normal abdominal ultrasound.',
  true
FROM imaging_modalities mod, imaging_study_types st
WHERE mod.modality_code = 'US' AND st.study_code = 'US-ABD'
LIMIT 1
ON CONFLICT (template_code) DO NOTHING;

-- Obstetric Ultrasound Template
INSERT INTO imaging_report_templates (modality_id, study_type_id, template_name, template_code, technique_template, findings_template, impression_template, is_default)
SELECT 
  mod.id,
  st.id,
  'Obstetric Ultrasound',
  'US-OB-TEMPLATE',
  'Transabdominal ultrasound examination of gravid uterus.',
  E'NUMBER OF FETUSES: [Single/Multiple]\nFETAL VIABILITY: [Yes/No] - Cardiac activity [present/absent]\nFETAL PRESENTATION: [Cephalic/Breech/Transverse]\nGESTATIONAL AGE: ___ weeks ___ days by [measurements]\nBIPARIETAL DIAMETER (BPD): ___ mm\nHEAD CIRCUMFERENCE (HC): ___ mm\nABDOMINAL CIRCUMFERENCE (AC): ___ mm\nFEMUR LENGTH (FL): ___ mm\nESTIMATED FETAL WEIGHT: ___ grams\nPLACENTA: [Location - anterior/posterior/fundal/low-lying]\nAMNIOTIC FLUID: [Normal/Oligohydramnios/Polyhydramnios] - AFI ___ cm\nANOMALIES: [None detected/Describe]',
  'Intrauterine pregnancy at ___ weeks gestation.',
  true
FROM imaging_modalities mod, imaging_study_types st
WHERE mod.modality_code = 'US' AND st.study_code = 'US-OB'
LIMIT 1
ON CONFLICT (template_code) DO NOTHING;

-- CT Head Template
INSERT INTO imaging_report_templates (modality_id, study_type_id, template_name, template_code, technique_template, findings_template, impression_template, is_default)
SELECT 
  mod.id,
  st.id,
  'CT Head - Normal',
  'CT-HEAD-NORMAL',
  'Non-contrast axial CT images of the head from the skull base to the vertex.',
  E'BRAIN: Normal gray-white matter differentiation. No acute infarct, hemorrhage, or mass effect.\nVENTRICLES: Normal size and configuration. No hydrocephalus.\nSULCI/CISTERNS: Normal. No effacement.\nMIDLINE: Maintained.\nSKULL: No fracture.\nPARANASAL SINUSES: Clear.\nMASTOID AIR CELLS: Clear.',
  'Normal non-contrast CT of the head.',
  true
FROM imaging_modalities mod, imaging_study_types st
WHERE mod.modality_code = 'CT' AND st.study_code = 'CT-HEAD'
LIMIT 1
ON CONFLICT (template_code) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Imaging catalog seeded successfully!';
  RAISE NOTICE 'Added 8 imaging modalities';
  RAISE NOTICE 'Added 12+ common imaging study types';
  RAISE NOTICE 'Created 4 report templates';
END $$;

