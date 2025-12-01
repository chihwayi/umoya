-- Script to populate dummy data for Thandeka patient
-- This includes:
-- 1. Cardiology encounters
-- 2. Diabetes registry (if not exists)
-- 3. Glucose monitoring entries
-- 4. Diabetes care bundle
-- 5. Diabetes medications

-- First, get Thandeka's patient ID (replace with actual ID)
-- Get a doctor ID for cardiologist
DO $$
DECLARE
    thandeka_id UUID;
    doctor_id UUID;
    cardiologist_id UUID;
    registry_id UUID;
    care_bundle_id UUID;
BEGIN
    -- Find Thandeka's patient ID
    SELECT id INTO thandeka_id 
    FROM patients 
    WHERE LOWER(first_name) LIKE '%thandeka%' OR LOWER(last_name) LIKE '%thandeka%'
    LIMIT 1;
    
    -- If not found, get the most recent patient
    IF thandeka_id IS NULL THEN
        SELECT id INTO thandeka_id 
        FROM patients 
        ORDER BY created_at DESC 
        LIMIT 1;
    END IF;
    
    -- Get a doctor ID for encounters
    SELECT id INTO doctor_id 
    FROM users 
    WHERE role = 'doctor' 
    LIMIT 1;
    
    -- Get a cardiologist (or use same doctor)
    SELECT id INTO cardiologist_id 
    FROM users 
    WHERE (role = 'doctor' AND specialization ILIKE '%cardio%') OR role = 'doctor'
    LIMIT 1;
    
    IF cardiologist_id IS NULL THEN
        cardiologist_id := doctor_id;
    END IF;
    
    RAISE NOTICE 'Using patient ID: %', thandeka_id;
    RAISE NOTICE 'Using doctor ID: %', doctor_id;
    RAISE NOTICE 'Using cardiologist ID: %', cardiologist_id;
    
    -- ============================================
    -- CARDIOLOGY ENCOUNTERS
    -- ============================================
    INSERT INTO cardiology_encounters (
        patient_id,
        encounter_date,
        encounter_type,
        cardiologist_id,
        visit_reason,
        presenting_symptoms,
        hemodynamics,
        risk_score,
        care_status,
        payment_status,
        care_plan,
        follow_up_plan,
        created_at
    ) VALUES
    (
        thandeka_id,
        NOW() - INTERVAL '30 days',
        'clinic_visit',
        cardiologist_id,
        'Routine cardiovascular checkup',
        'Patient reports occasional chest discomfort during exercise',
        jsonb_build_object(
            'systolic_bp', 135,
            'diastolic_bp', 85,
            'heart_rate', 72,
            'respiratory_rate', 16,
            'oxygen_saturation', 98
        ),
        'moderate',
        'completed',
        'payment_confirmed',
        'Continue current medication. Monitor BP weekly. Follow up in 3 months.',
        'Schedule follow-up appointment in 3 months. Continue lifestyle modifications.',
        NOW() - INTERVAL '30 days'
    ),
    (
        thandeka_id,
        NOW() - INTERVAL '15 days',
        'clinic_visit',
        cardiologist_id,
        'Hypertension follow-up',
        'Patient reports improved BP control with medication',
        jsonb_build_object(
            'systolic_bp', 128,
            'diastolic_bp', 82,
            'heart_rate', 68,
            'respiratory_rate', 15,
            'oxygen_saturation', 99
        ),
        'low',
        'completed',
        'payment_confirmed',
        'BP well controlled. Continue current regimen.',
        'Continue medication. Next visit in 2 months.',
        NOW() - INTERVAL '15 days'
    ),
    (
        thandeka_id,
        NOW() - INTERVAL '5 days',
        'clinic_visit',
        cardiologist_id,
        'Annual cardiovascular assessment',
        'Annual comprehensive cardiovascular evaluation',
        jsonb_build_object(
            'systolic_bp', 132,
            'diastolic_bp', 88,
            'heart_rate', 75,
            'respiratory_rate', 16,
            'oxygen_saturation', 98
        ),
        'moderate',
        'completed',
        'payment_confirmed',
        'Overall cardiovascular health stable. Continue monitoring.',
        'Annual follow-up completed. Continue current management.',
        NOW() - INTERVAL '5 days'
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created cardiology encounters';
    
    -- ============================================
    -- DIABETES REGISTRY
    -- ============================================
    -- Check if registry exists, if not create it
    SELECT id INTO registry_id 
    FROM diabetes_registry 
    WHERE patient_id = thandeka_id;
    
    IF registry_id IS NULL THEN
        INSERT INTO diabetes_registry (
            patient_id,
            diabetes_type,
            diagnosis_date,
            age_at_diagnosis,
            status,
            family_history,
            primary_care_provider_id,
            care_plan,
            notes,
            created_at
        ) VALUES (
            thandeka_id,
            'type2',
            CURRENT_DATE - INTERVAL '2 years',
            45,
            'active',
            true,
            doctor_id,
            'Type 2 Diabetes Management Plan:
            - Monitor blood glucose 2x daily (fasting and post-meal)
            - Target HbA1c: <7%
            - Regular foot exams every 3 months
            - Annual eye exam
            - Lipid profile every 6 months
            - Blood pressure control <130/80
            - Medication adherence monitoring
            - Diabetes education sessions',
            'Patient diagnosed with Type 2 Diabetes. Family history positive for diabetes.',
            NOW()
        ) RETURNING id INTO registry_id;
        
        RAISE NOTICE 'Created diabetes registry with ID: %', registry_id;
    ELSE
        RAISE NOTICE 'Diabetes registry already exists with ID: %', registry_id;
    END IF;
    
    -- ============================================
    -- GLUCOSE MONITORING (from glucose_monitoring table)
    -- ============================================
    INSERT INTO glucose_monitoring (
        diabetes_registry_id,
        patient_id,
        monitoring_type,
        glucose_value,
        glucose_unit,
        reading_type,
        recorded_at,
        notes,
        created_at
    ) VALUES
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        95.0,
        'mg/dL',
        'fasting',
        NOW() - INTERVAL '1 day',
        'Morning fasting reading',
        NOW() - INTERVAL '1 day'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        142.0,
        'mg/dL',
        'post_meal',
        NOW() - INTERVAL '1 day' + INTERVAL '2 hours',
        'Post-breakfast reading',
        NOW() - INTERVAL '1 day' + INTERVAL '2 hours'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        110.0,
        'mg/dL',
        'fasting',
        NOW() - INTERVAL '2 days',
        'Morning fasting reading',
        NOW() - INTERVAL '2 days'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        128.0,
        'mg/dL',
        'post_meal',
        NOW() - INTERVAL '2 days' + INTERVAL '2 hours',
        'Post-lunch reading',
        NOW() - INTERVAL '2 days' + INTERVAL '2 hours'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        88.0,
        'mg/dL',
        'fasting',
        NOW() - INTERVAL '3 days',
        'Morning fasting reading - excellent control',
        NOW() - INTERVAL '3 days'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        155.0,
        'mg/dL',
        'post_meal',
        NOW() - INTERVAL '3 days' + INTERVAL '2 hours',
        'Post-dinner reading',
        NOW() - INTERVAL '3 days' + INTERVAL '2 hours'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        102.0,
        'mg/dL',
        'fasting',
        NOW() - INTERVAL '4 days',
        'Morning fasting reading',
        NOW() - INTERVAL '4 days'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        138.0,
        'mg/dL',
        'post_meal',
        NOW() - INTERVAL '4 days' + INTERVAL '2 hours',
        'Post-meal reading',
        NOW() - INTERVAL '4 days' + INTERVAL '2 hours'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        92.0,
        'mg/dL',
        'fasting',
        NOW() - INTERVAL '5 days',
        'Morning fasting reading',
        NOW() - INTERVAL '5 days'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        145.0,
        'mg/dL',
        'post_meal',
        NOW() - INTERVAL '5 days' + INTERVAL '2 hours',
        'Post-meal reading',
        NOW() - INTERVAL '5 days' + INTERVAL '2 hours'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        98.0,
        'mg/dL',
        'fasting',
        NOW() - INTERVAL '7 days',
        'Morning fasting reading',
        NOW() - INTERVAL '7 days'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        132.0,
        'mg/dL',
        'post_meal',
        NOW() - INTERVAL '7 days' + INTERVAL '2 hours',
        'Post-meal reading',
        NOW() - INTERVAL '7 days' + INTERVAL '2 hours'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        105.0,
        'mg/dL',
        'fasting',
        NOW() - INTERVAL '10 days',
        'Morning fasting reading',
        NOW() - INTERVAL '10 days'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        148.0,
        'mg/dL',
        'post_meal',
        NOW() - INTERVAL '10 days' + INTERVAL '2 hours',
        'Post-meal reading',
        NOW() - INTERVAL '10 days' + INTERVAL '2 hours'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        89.0,
        'mg/dL',
        'fasting',
        NOW() - INTERVAL '14 days',
        'Morning fasting reading - excellent',
        NOW() - INTERVAL '14 days'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        125.0,
        'mg/dL',
        'post_meal',
        NOW() - INTERVAL '14 days' + INTERVAL '2 hours',
        'Post-meal reading',
        NOW() - INTERVAL '14 days' + INTERVAL '2 hours'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        112.0,
        'mg/dL',
        'fasting',
        NOW() - INTERVAL '21 days',
        'Morning fasting reading',
        NOW() - INTERVAL '21 days'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        140.0,
        'mg/dL',
        'post_meal',
        NOW() - INTERVAL '21 days' + INTERVAL '2 hours',
        'Post-meal reading',
        NOW() - INTERVAL '21 days' + INTERVAL '2 hours'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        96.0,
        'mg/dL',
        'fasting',
        NOW() - INTERVAL '30 days',
        'Morning fasting reading',
        NOW() - INTERVAL '30 days'
    ),
    (
        registry_id,
        thandeka_id,
        'self_monitoring',
        135.0,
        'mg/dL',
        'post_meal',
        NOW() - INTERVAL '30 days' + INTERVAL '2 hours',
        'Post-meal reading',
        NOW() - INTERVAL '30 days' + INTERVAL '2 hours'
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created glucose monitoring entries';
    
    -- ============================================
    -- DIABETES CARE BUNDLE
    -- ============================================
    INSERT INTO diabetes_care_bundle (
        diabetes_registry_id,
        patient_id,
        bundle_date,
        hba1c_checked,
        hba1c_value,
        hba1c_date,
        blood_pressure_checked,
        systolic_bp,
        diastolic_bp,
        bp_date,
        lipid_profile_checked,
        lipid_profile_date,
        foot_exam_checked,
        foot_exam_date,
        foot_exam_result,
        eye_exam_checked,
        eye_exam_date,
        eye_exam_result,
        urine_acr_checked,
        urine_acr_value,
        urine_acr_date,
        diabetes_education_documented,
        education_date,
        medication_review_completed,
        medication_review_date,
        bundle_completion_percentage,
        reviewed_by,
        created_at
    ) VALUES
    (
        registry_id,
        thandeka_id,
        CURRENT_DATE - INTERVAL '30 days',
        true,
        6.8,
        CURRENT_DATE - INTERVAL '30 days',
        true,
        128,
        82,
        CURRENT_DATE - INTERVAL '30 days',
        true,
        CURRENT_DATE - INTERVAL '30 days',
        true,
        CURRENT_DATE - INTERVAL '30 days',
        'No abnormalities detected. Normal sensation and pulses.',
        true,
        CURRENT_DATE - INTERVAL '60 days',
        'No diabetic retinopathy. Annual exam recommended.',
        true,
        12.5,
        CURRENT_DATE - INTERVAL '30 days',
        true,
        CURRENT_DATE - INTERVAL '45 days',
        true,
        CURRENT_DATE - INTERVAL '30 days',
        95,
        doctor_id,
        NOW() - INTERVAL '30 days'
    ),
    (
        registry_id,
        thandeka_id,
        CURRENT_DATE - INTERVAL '90 days',
        true,
        7.1,
        CURRENT_DATE - INTERVAL '90 days',
        true,
        135,
        88,
        CURRENT_DATE - INTERVAL '90 days',
        true,
        CURRENT_DATE - INTERVAL '90 days',
        true,
        CURRENT_DATE - INTERVAL '90 days',
        'Normal exam. Continue monitoring.',
        true,
        CURRENT_DATE - INTERVAL '120 days',
        'Mild background retinopathy. Continue annual monitoring.',
        true,
        15.2,
        CURRENT_DATE - INTERVAL '90 days',
        true,
        CURRENT_DATE - INTERVAL '105 days',
        true,
        CURRENT_DATE - INTERVAL '90 days',
        90,
        doctor_id,
        NOW() - INTERVAL '90 days'
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created diabetes care bundles';
    
    -- ============================================
    -- DIABETES MEDICATIONS
    -- ============================================
    INSERT INTO diabetes_medications (
        diabetes_registry_id,
        patient_id,
        medication_name,
        medication_type,
        dosage,
        frequency,
        start_date,
        status,
        notes,
        created_at
    ) VALUES
    (
        registry_id,
        thandeka_id,
        'Metformin',
        'oral',
        '1000mg',
        'Twice daily with meals',
        CURRENT_DATE - INTERVAL '18 months',
        'active',
        'Primary medication for Type 2 Diabetes. Good tolerance and adherence.',
        NOW() - INTERVAL '18 months'
    ),
    (
        registry_id,
        thandeka_id,
        'Gliclazide',
        'oral',
        '80mg',
        'Once daily before breakfast',
        CURRENT_DATE - INTERVAL '12 months',
        'active',
        'Added to improve glucose control. Monitor for hypoglycemia.',
        NOW() - INTERVAL '12 months'
    ),
    (
        registry_id,
        thandeka_id,
        'Empagliflozin',
        'oral',
        '10mg',
        'Once daily',
        CURRENT_DATE - INTERVAL '6 months',
        'active',
        'SGLT2 inhibitor. Added for cardiovascular benefits and glucose control.',
        NOW() - INTERVAL '6 months'
    ),
    (
        registry_id,
        thandeka_id,
        'Glipizide',
        'oral',
        '5mg',
        'Twice daily',
        CURRENT_DATE - INTERVAL '24 months',
        'discontinued',
        'Discontinued due to hypoglycemic episodes. Replaced with Gliclazide.',
        NOW() - INTERVAL '12 months'
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created diabetes medications';
    
    RAISE NOTICE '✅ All data populated successfully for patient ID: %', thandeka_id;
END $$;

