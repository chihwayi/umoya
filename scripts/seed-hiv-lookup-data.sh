#!/bin/bash

# Script to seed HIV lookup tables with initial data
# This populates all lookup tables with the standard values

set -e

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
MASTER_DB="${MASTER_DB:-medicore_master}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌱 Seeding HIV Lookup Tables with Initial Data${NC}"
echo -e "${BLUE}==============================================${NC}"

# Function to get tenant database names
get_tenant_databases() {
    docker exec medicore-postgres-master psql -U $DB_USERNAME -d $MASTER_DB -t -c "
        SELECT \"databaseName\" 
        FROM tenants 
        WHERE status IN ('active', 'pending', 'suspended')
        ORDER BY \"createdAt\";
    " | tr -d ' ' | grep -v '^$'
}

# Function to seed lookup data for a database
seed_lookup_data() {
    local database=$1
    echo -e "${YELLOW}📋 Seeding lookup data for: $database${NC}"
    
    # Seed all lookup tables
    docker exec -i medicore-postgres-master psql -U $DB_USERNAME -d "$database" <<'SEEDEOF'
-- Seed Visit Types
INSERT INTO hiv_visit_types (code, name, description, display_order) VALUES
('A', 'Present Self/conventional care (not in a DSD model)', NULL, 1),
('B', 'Sent Care Giver / Treatment Supporter (not in DSD model)', NULL, 2),
('C', 'Visit made at another clinic', NULL, 3),
('D', 'oMalayitsha / Cross Border Transport', NULL, 4),
('E', 'CARG (Family, KPs, General Population)', NULL, 5),
('F', 'Clubs (Teen, Carer & Child, Post partum)', NULL, 6),
('G', 'Fast Track', NULL, 7),
('H', 'Outreach by Facility HCW', NULL, 8),
('I', 'Drop in Centre', NULL, 9),
('J', 'Out of Facility Community ART Distribution (OFCAD)', NULL, 10),
('K', 'Private Pharmacy', NULL, 11),
('L', 'Other, Specify', NULL, 12)
ON CONFLICT (code) DO NOTHING;

-- Seed BMI Classifications
INSERT INTO hiv_bmi_classifications (code, name, min_bmi, max_bmi, display_order) VALUES
('UW', 'Underweight', 0, 18.4, 1),
('NW', 'Normal weight', 18.5, 24.9, 2),
('PO', 'Pre-obesity', 25.0, 29.9, 3),
('Ob1', 'Obesity class I', 30.0, 34.9, 4),
('Ob2', 'Obesity class II', 35.0, 39.9, 5),
('Ob3', 'Obesity class III', 40.0, NULL, 6)
ON CONFLICT (code) DO NOTHING;

-- Seed Pregnancy/Lactating Status
INSERT INTO hiv_pregnancy_lactating_status (code, name, display_order) VALUES
('P', 'Pregnant', 1),
('EFF', 'Exclusive Formula Feeding', 2),
('MF', 'Mixed Feeding (Below 6 Months)', 3),
('BFCF', 'Breast Feeding & Complementary Feeding', 4),
('SBF', 'Stopped Breastfeeding', 5),
('NPL', 'Neither Pregnant nor lactating (for women)', 6),
('N/A', 'Not Applicable (for men & minors)', 7)
ON CONFLICT (code) DO NOTHING;

-- Seed Family Planning Methods
INSERT INTO hiv_family_planning_methods (code, name, display_order) VALUES
('M', 'Implants', 1),
('Z', 'Sterilization', 2),
('A', 'Abstinence', 3),
('C', 'Condom', 4),
('O', 'Not using', 5),
('T', 'Traditional/Withdrawal', 6),
('P', 'Pills', 7),
('L', 'IUD', 8),
('J', 'Injections (e.g Depo)', 9),
('D', 'Dual Method', 10)
ON CONFLICT (code) DO NOTHING;

-- Seed Functional Status
INSERT INTO hiv_functional_status (code, name, display_order) VALUES
('W', 'Work/School', 1),
('A', 'Ambulatory', 2),
('B', 'Bedridden', 3)
ON CONFLICT (code) DO NOTHING;

-- Seed TB Screening Status
INSERT INTO hiv_tb_screening_status (code, name, display_order) VALUES
('Y', 'Screened and has no signs', 1),
('S', 'Presumptive - if there are signs', 2),
('ON', 'On TB Treatment', 3),
('N', 'TB status not assessed', 4)
ON CONFLICT (code) DO NOTHING;

-- Seed TB Investigation Results
INSERT INTO hiv_tb_investigation_results (code, name, display_order) VALUES
('1', 'Investigated and has Active TB not started on TB treatment', 1),
('2', 'Investigated and had active Tuberculosis started TB treatment', 2),
('3', 'Investigated and has No Active TB', 3),
('4', 'Not Investigated', 4),
('5', 'Not Applicable', 5)
ON CONFLICT (code) DO NOTHING;

-- Seed Opportunistic Infections
INSERT INTO hiv_opportunistic_infections (code, name, category, has_sub_categories, display_order) VALUES
('Z', 'Zoster', 'OI', false, 1),
('P', 'Pneumonia', 'OI', false, 2),
('D', 'Dementia/Encephalitis', 'OI', false, 3),
('T', 'Thrush: oral/Vaginal', 'OI', false, 4),
('U', 'Ulcers: mouth, genital, etc.', 'OI', false, 5),
('I', 'IRIS', 'OI', false, 6),
('W', 'Weight Loss', 'OI', false, 7),
('To', 'Toxoplasmosis', 'OI', false, 8),
('STI', 'Sexual Transmitted Infection', 'OI', false, 9),
('H', 'Hypertension', 'Other', true, 10),
('Cx', 'Cancer', 'Other', false, 11),
('DM', 'Diabetes (Screened)', 'Other', true, 12),
('HBV', 'Hepatitis B', 'Other', true, 13),
('HCV', 'Hepatitis C', 'Other', true, 14),
('O', 'Other, specify', 'Other', false, 15)
ON CONFLICT (code) DO NOTHING;

-- Seed OI Sub-categories (after OIs are seeded)
INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order)
SELECT id, 'HPT 2', 'Diagnosed', 1 FROM hiv_opportunistic_infections WHERE code = 'H'
ON CONFLICT (code) DO NOTHING;
INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order)
SELECT id, 'HPT 3', 'Managed', 2 FROM hiv_opportunistic_infections WHERE code = 'H'
ON CONFLICT (code) DO NOTHING;

INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order)
SELECT id, 'D1', 'Screened', 1 FROM hiv_opportunistic_infections WHERE code = 'DM'
ON CONFLICT (code) DO NOTHING;
INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order)
SELECT id, 'T1D', 'Diabetes Type I', 2 FROM hiv_opportunistic_infections WHERE code = 'DM'
ON CONFLICT (code) DO NOTHING;
INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order)
SELECT id, 'T2D', 'Diabetes Type II', 3 FROM hiv_opportunistic_infections WHERE code = 'DM'
ON CONFLICT (code) DO NOTHING;
INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order)
SELECT id, 'D3', 'Managed for Diabetes', 4 FROM hiv_opportunistic_infections WHERE code = 'DM'
ON CONFLICT (code) DO NOTHING;

INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order)
SELECT id, 'HBV 1', 'Tested', 1 FROM hiv_opportunistic_infections WHERE code = 'HBV'
ON CONFLICT (code) DO NOTHING;
INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order)
SELECT id, 'HBV 2', 'Positive', 2 FROM hiv_opportunistic_infections WHERE code = 'HBV'
ON CONFLICT (code) DO NOTHING;
INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order)
SELECT id, 'HBV 3', 'on a TDF based regimen', 3 FROM hiv_opportunistic_infections WHERE code = 'HBV'
ON CONFLICT (code) DO NOTHING;

INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order)
SELECT id, 'HCV 1', 'Tested', 1 FROM hiv_opportunistic_infections WHERE code = 'HCV'
ON CONFLICT (code) DO NOTHING;
INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order)
SELECT id, 'HCV 2', 'Positive', 2 FROM hiv_opportunistic_infections WHERE code = 'HCV'
ON CONFLICT (code) DO NOTHING;
INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order)
SELECT id, 'HCV 3', 'Treated', 3 FROM hiv_opportunistic_infections WHERE code = 'HCV'
ON CONFLICT (code) DO NOTHING;
INSERT INTO hiv_oi_sub_categories (oi_id, code, name, display_order)
SELECT id, 'HCV 4', 'Cured', 4 FROM hiv_opportunistic_infections WHERE code = 'HCV'
ON CONFLICT (code) DO NOTHING;

-- Seed Mental Health Results
INSERT INTO hiv_mental_health_results (code, name, display_order) VALUES
('N', 'Not screened', 1),
('ND', 'No Mental Health Disorders', 2),
('D', 'Depression', 3),
('A', 'Anxiety', 4),
('SA', 'Substance Misuse', 5),
('O', 'Other, Specify', 6)
ON CONFLICT (code) DO NOTHING;

-- Seed Mental Health Management
INSERT INTO hiv_mental_health_management (code, name, display_order) VALUES
('R', 'Referred', 1),
('Rx', 'Treated', 2),
('NT', 'Not treated', 3),
('N/A', 'Not Applicable', 4)
ON CONFLICT (code) DO NOTHING;

-- Seed TPT Eligibility
INSERT INTO hiv_tpt_eligibility (code, name, is_eligible, display_order) VALUES
('Y', 'Eligible for TPT', true, 1),
('TB', 'Active TB disease', false, 2),
('ON', 'On TB treatment', false, 3),
('AL', 'Active Liver disease', false, 4),
('AA', 'Heavy Alcohol Abuse', false, 5),
('CPT', 'Completed IPT in the past = 3yrs', false, 6),
('DDI', 'Drug to Drug interactions', false, 7)
ON CONFLICT (code) DO NOTHING;

-- Seed TPT Status
INSERT INTO hiv_tpt_status (code, name, display_order) VALUES
('AT', 'Active TB disease', 1),
('II', 'INH Initiated', 2),
('3I', '3HP Initiated', 3),
('CT', 'Continue INH', 4),
('TC', 'INH Completed', 5),
('RI', 'Restart INH', 6),
('R3', 'Restart 3HP', 7),
('TNI', 'TPT Not Initiated due to available regimens', 8),
('PN', 'INH Stopped due to Peripheral Neuropathy', 9),
('PP', 'Patient Refused INH', 10)
ON CONFLICT (code) DO NOTHING;

-- Seed Cryptococcal Signs
INSERT INTO hiv_cryptococcal_signs (code, name, display_order) VALUES
('Y', 'Screened has no signs', 1),
('S', 'Presumptive Cryptococcal Signs', 2),
('N', 'Not assessed', 3)
ON CONFLICT (code) DO NOTHING;

-- Seed Cryptococcal Status
INSERT INTO hiv_cryptococcal_status (code, name, display_order) VALUES
('1', 'Yes (Positive)', 1),
('2', 'Yes (Negative)', 2),
('3', 'N-Not Assessed', 3)
ON CONFLICT (code) DO NOTHING;

-- Seed Cryptococcal Treatment
INSERT INTO hiv_cryptococcal_treatment (code, name, display_order) VALUES
('a', 'Liposomal Amphotericin B, Flucytosine + Fluconazole', 1),
('b', 'Liposomal Amphotericin B + Flucytosine', 2),
('c', 'Fluconazole + Flucytosine', 3),
('d', 'Others Specify', 4)
ON CONFLICT (code) DO NOTHING;

-- Seed ARV Status
INSERT INTO hiv_arv_status (code, name, display_order) VALUES
('1', 'No ARV', 1),
('2a', 'Start ARV', 2),
('2b', 'Start ARV (Pregnant)', 3),
('3', 'Continue', 4),
('4', 'Change', 5),
('5', 'Stop', 6),
('6', 'Restart', 7),
('7', 'Transfer Out', 8)
ON CONFLICT (code) DO NOTHING;

-- Seed ART Initiation Category
INSERT INTO hiv_art_initiation_category (code, name, display_order) VALUES
('N1', 'Newly Initiated ART', 1),
('N2.1', 'Re-initiation < 3 months after stopping ART', 2),
('N2.2', 'Re-initiation 3-5 months after stopping ART', 3),
('N2.3', 'Re-initiation 6+ months after stopping ART', 4),
('N3.1', 'Re-engagement <3 months after lost to follow up', 5),
('N3.2', 'Re-engagement 3-5 months after lost to follow up', 6),
('N3.3', 'Re-engagement 6+ months after lost to follow up', 7),
('N4', 'transfer in on ART from the private sector or diaspora', 8)
ON CONFLICT (code) DO NOTHING;

-- Seed Adverse Events Status
INSERT INTO hiv_adverse_events_status (code, name, severity, display_order) VALUES
('a', 'INH1-minor adverse events reported on INH', 'minor', 1),
('b', 'INH2-stopping INH due to adverse events', 'stopping', 2),
('C1', '3HP1-minor adverse events reported on 3HP', 'minor', 3),
('C2', '3HP1-stopping 3HP1 due to adverse events', 'stopping', 4),
('c', 'CTX1-minor adverse event reported on CTX', 'minor', 5),
('d', 'CTX2-stopping CTX due to adverse events', 'stopping', 6),
('e', 'Diflucan1-minor adverse events reported on Diflucan', 'minor', 7),
('f', 'Diflucan 2-stopping Diflucan due to adverse events', 'stopping', 8),
('g', 'ART 1st Line1-minor adverse events reported on 1st Line ART', 'minor', 9),
('h', 'ART 1st Line 2-stopping 1st Line ART due to adverse events', 'stopping', 10),
('i', 'ART 2nd regimen1-minor adverse events reported on 2-line ART', 'minor', 11),
('J', 'ART 2nd regimen2-stopping 2nd-line ART due to adverse events', 'stopping', 12),
('k', 'ART 3rd regimen1-minor adverse events reported on Third line ART', 'minor', 13),
('l', 'ART 3rd regimen2 - stopping Third line ART due to adverse events', 'stopping', 14)
ON CONFLICT (code) DO NOTHING;

-- Seed ARV Reasons (Not on ARV)
INSERT INTO hiv_arv_reasons_not_on (code, name, display_order) VALUES
('11', 'No psychologically ready', 1),
('13', 'No ARVs available', 2),
('14', 'Not willing', 3),
('15', 'On Initial 2 weeks of TB Treatment', 4),
('16', 'Awaits Lab results', 5),
('17', 'Has OI and is too sick to start', 6),
('18', 'No start-other', 7),
('19', 'On initial 4 weeks of Cryptococcal Meningitis treatment', 8)
ON CONFLICT (code) DO NOTHING;

-- Seed ARV Reasons (Start ARV)
INSERT INTO hiv_arv_reasons_start (code, name, display_order) VALUES
('215', 'Treat all', 1),
('216', 'Pregnant women', 2),
('217', 'Lactation women', 3),
('218', 'Other (Specify)', 4)
ON CONFLICT (code) DO NOTHING;

-- Seed ARV Change/Stop Reasons
INSERT INTO hiv_arv_change_stop_reasons (code, name, display_order) VALUES
('401', 'Start TB Rx', 1),
('402', 'Nausea/Vomiting', 2),
('403', 'Diarrhoea', 3),
('404', 'Headache', 4),
('405', 'Fever', 5),
('406', 'Rash', 6),
('407', 'Peripheral Neuropathy', 7),
('408', 'Hepatitis', 8),
('409', 'Jaundice', 9),
('410', 'Dementia', 10),
('411', 'Anemia', 11),
('413', 'CNS Adverse event', 12),
('414', 'Other Adverse event (specify)', 13),
('415', 'Treatment Failure, clinical', 14),
('416', 'Treatment Failure, immunological', 15),
('417', 'Poor Adherence', 16),
('418', 'Patient Decision', 17),
('421', 'Stock out', 18),
('422', 'Other reason (specify)', 19),
('424', 'Virological Failure', 20),
('425', 'Weight gain>10%', 21),
('427', 'Treatment optimization', 22)
ON CONFLICT (code) DO NOTHING;

-- Seed Visit Status
INSERT INTO hiv_visit_status (code, name, display_order) VALUES
('E', 'Earlier than review date', 1),
('OT', 'On time', 2),
('L', 'Late but not defaulter', 3),
('D', 'Default<28days', 4)
ON CONFLICT (code) DO NOTHING;

-- Seed Final Outcome
INSERT INTO hiv_final_outcome (code, name, display_order) VALUES
('Tx', 'active on treatment', 1),
('Miss', '1 or 2 missing Appointments', 2),
('LTFU', 'Lost to Follow-up', 3),
('TO', 'Transfer Out (specify)', 4),
('D', 'Patient Died', 5),
('OO', 'Patient Opted Out', 6),
('O', 'Other, specify', 7)
ON CONFLICT (code) DO NOTHING;

-- Seed Pre-Cancerous Lesion Treatment
INSERT INTO hiv_precancerous_lesion_treatment (code, name, display_order) VALUES
('N', 'No treatment done', 1),
('VC', 'VIAC Pos, Cryotherapy Done', 2),
('VT', 'VIAC Pos, Thermal Ablation Done', 3),
('VL', 'VIAC Pos, LEEP Done', 4),
('SC', 'Suspected Cancer', 5),
('H', 'Hysterectomy', 6),
('R', 'Refer for Further clinical investigation if HPV Neg, but VIAC Pos', 7)
ON CONFLICT (code) DO NOTHING;
SEEDEOF

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Data seeded successfully${NC}"
    else
        echo -e "${RED}❌ Failed to seed data${NC}"
        return 1
    fi

    # Seed WHO Staging (Adults)
    echo -e "${YELLOW}   Seeding WHO Staging (Adults)...${NC}"
    docker exec -i medicore-postgres-master psql -U $DB_USERNAME -d "$database" <<'WHOADULTEOF'
INSERT INTO hiv_who_staging (stage, category, condition_code, condition_name, display_order) VALUES
(1, 'Adults', 'ADULT_ST1_1', 'Asymptomatic', 1),
(1, 'Adults', 'ADULT_ST1_2', 'Persistent Generalised Lymphadenopathy (PGL)', 2),
(2, 'Adults', 'ADULT_ST2_1', 'Weight loss, <10% of body weight', 1),
(2, 'Adults', 'ADULT_ST2_2', 'Recurrent RTI (Respiratory Tract Infection)', 2),
(2, 'Adults', 'ADULT_ST2_3', 'Herpes Zoster', 3),
(2, 'Adults', 'ADULT_ST2_4', 'Angular Cheilitis', 4),
(2, 'Adults', 'ADULT_ST2_5', 'Recurrent ulcerations occurring twice or more then in six months', 5),
(2, 'Adults', 'ADULT_ST2_6', 'Papular pruritic eruptions', 6),
(2, 'Adults', 'ADULT_ST2_7', 'Seborrheic dermatitis', 7),
(2, 'Adults', 'ADULT_ST2_8', 'Fungal nail infections of the fingers', 8),
(3, 'Adults', 'ADULT_ST3_1', 'Weight loss; >10% of body weight', 1),
(3, 'Adults', 'ADULT_ST3_2', 'Unexplained chronic diarrhoea >1 month', 2),
(3, 'Adults', 'ADULT_ST3_3', 'Unexplained prolonged fever >1 month', 3),
(3, 'Adults', 'ADULT_ST3_4', 'Pulmonary Tuberculosis, current or within the past 2 months or TB adenitis', 4),
(3, 'Adults', 'ADULT_ST3_5', 'Severe infection including pneumonia, meningitis, bone or joint infection', 5),
(3, 'Adults', 'ADULT_ST3_6', 'Oral Candidiasis', 6),
(3, 'Adults', 'ADULT_ST3_7', 'Oral hairy leukoplakia', 7),
(3, 'Adults', 'ADULT_ST3_8', 'Acute necrotising ulcerative gingivitis or necrotizing ulcerative periodontitis', 8),
(3, 'Adults', 'ADULT_ST3_9', 'Unexplained anaemia >1 month', 9),
(4, 'Adults', 'ADULT_ST4_1', 'HIV wasting syndrome', 1),
(4, 'Adults', 'ADULT_ST4_2', 'Pneumocystis Pneumonia', 2),
(4, 'Adults', 'ADULT_ST4_3', 'Recurrent severe or radiological bacterial pneumonia (two or more episodes within a year)', 3),
(4, 'Adults', 'ADULT_ST4_4', 'Cryptococcal meningitis or other extra pulmonary', 4),
(4, 'Adults', 'ADULT_ST4_5', 'Cryptococcus infections', 5),
(4, 'Adults', 'ADULT_ST4_6', 'Extra Pulmonary Tuberculosis except TB adenitis', 6),
(4, 'Adults', 'ADULT_ST4_7', 'Kaposi Sarcoma', 7),
(4, 'Adults', 'ADULT_ST4_8', 'HIV Encephalopathy', 8),
(4, 'Adults', 'ADULT_ST4_9', 'Candidiasis of the oesophagus, trachea, bronchi or lungs', 9),
(4, 'Adults', 'ADULT_ST4_10', 'Chronic Herpes simplex virus (HSV) infection (orolabial, genital or anorectal >1 month, or visceral any duration)', 10),
(4, 'Adults', 'ADULT_ST4_11', 'Cytomegalovirus (CMV) disease of an organ other than liver, spleen or lymph nodes', 11),
(4, 'Adults', 'ADULT_ST4_12', 'Progressive Multifocal Leukoencephalopathy (PML)', 12),
(4, 'Adults', 'ADULT_ST4_13', 'Any disseminated mycosis (e.g. histoplasmosis, coccidioidomycosis, or penicilliosis)', 13),
(4, 'Adults', 'ADULT_ST4_14', 'Lymphoma (cerebral or B cell non-Hodgkin)', 14),
(4, 'Adults', 'ADULT_ST4_15', 'Recurrent non typhoidal salmonella septicaemia (2 or more episodes in last year)', 15),
(4, 'Adults', 'ADULT_ST4_16', 'Invasive cervical cancer', 16),
(4, 'Adults', 'ADULT_ST4_17', 'Visceral leishmaniosis', 17),
(4, 'Adults', 'ADULT_ST4_18', 'Cryptosporidiosis with diarrhoea lasting more than 1 month', 18),
(4, 'Adults', 'ADULT_ST4_19', 'Psoriasis', 19),
(4, 'Adults', 'ADULT_ST4_20', 'Disseminated non-tuberculous mycobacterial infection', 20),
(4, 'Adults', 'ADULT_ST4_21', 'CNS toxoplasmosis', 21)
ON CONFLICT (condition_code) DO NOTHING;
WHOADULTEOF

    # Seed WHO Staging (Paediatrics)
    echo -e "${YELLOW}   Seeding WHO Staging (Paediatrics)...${NC}"
    docker exec -i medicore-postgres-master psql -U $DB_USERNAME -d "$database" <<'WHOPAEDEOF'
INSERT INTO hiv_who_staging (stage, category, condition_code, condition_name, display_order) VALUES
(1, 'Paediatrics', 'PAED_ST1_1', 'Asymptomatic', 1),
(1, 'Paediatrics', 'PAED_ST1_2', 'PGL', 2),
(2, 'Paediatrics', 'PAED_ST2_1', 'Hepatosplenomegaly', 1),
(2, 'Paediatrics', 'PAED_ST2_2', 'Papular pruritic eruptions', 2),
(2, 'Paediatrics', 'PAED_ST2_3', 'Seborrheic dermatitis', 3),
(2, 'Paediatrics', 'PAED_ST2_4', 'Fungal nail infections of the fingers', 4),
(2, 'Paediatrics', 'PAED_ST2_5', 'Angular Cheilitis', 5),
(2, 'Paediatrics', 'PAED_ST2_6', 'Lineal Gingival erythema (LGE)', 6),
(2, 'Paediatrics', 'PAED_ST2_7', 'Human Papilloma Virus infection (extensive facial >5% of body area or disfiguring)', 7),
(2, 'Paediatrics', 'PAED_ST2_8', 'Molluscum contagiosum infection (extensive facial >5% of body area or disfiguring)', 8),
(2, 'Paediatrics', 'PAED_ST2_9', 'Recurrent ulcerations occurring twice or more then in six months', 9),
(2, 'Paediatrics', 'PAED_ST2_10', 'Parotid enlargement', 10),
(2, 'Paediatrics', 'PAED_ST2_11', 'Herpes Zoster', 11),
(2, 'Paediatrics', 'PAED_ST2_12', 'Recurrent Respiratory Tract Infections (RTI) (twice or more in any six month period)', 12),
(3, 'Paediatrics', 'PAED_ST3_1', 'Unexplained malnutrition (very low weight for age; up to 2 standard deviations)', 1),
(3, 'Paediatrics', 'PAED_ST3_2', 'Unexplained persistent diarrhoea (> 14 days and above)', 2),
(3, 'Paediatrics', 'PAED_ST3_3', 'Unexplained persistent fever (intermittent or constant and for longer than 1 month)', 3),
(3, 'Paediatrics', 'PAED_ST3_4', 'Oral Candidiasis (outside first 6 weeks of life)', 4),
(3, 'Paediatrics', 'PAED_ST3_5', 'Oral hairy leukoplakia', 5),
(3, 'Paediatrics', 'PAED_ST3_6', 'Pulmonary Tuberculosis', 6),
(3, 'Paediatrics', 'PAED_ST3_7', 'Severe presumed bacterial pneumonia', 7),
(3, 'Paediatrics', 'PAED_ST3_8', 'Acute necrotising ulcerative gingivitis, or stomatitis or acute necrotizing ulcerative periodontitis', 8),
(3, 'Paediatrics', 'PAED_ST3_9', 'Symptomatic Lymphocytic Interstitial Pneumonia', 9),
(3, 'Paediatrics', 'PAED_ST3_10', 'Chronic HIV associated disease (including bronchiectasis)', 10),
(3, 'Paediatrics', 'PAED_ST3_11', 'Unexplained anaemia or neutropenia >1 monthly', 11),
(4, 'Paediatrics', 'PAED_ST4_1', 'Unexplained severe wasting or severe malnutrition not adequately responding to standard therapy', 1),
(4, 'Paediatrics', 'PAED_ST4_2', 'Pneumocystis Jirovecci Pneumonia (PJP)', 2),
(4, 'Paediatrics', 'PAED_ST4_3', 'Recurrent severe presumed bacterial infection (e.g. meningitis, empyema, pyomyocitis bone or joint infection, bacteraemia)', 3),
(4, 'Paediatrics', 'PAED_ST4_4', 'Chronic Herpes simplex virus infection (chronic orolabial or intraoral lesions, of more than 1 month or visceral of any duration)', 4),
(4, 'Paediatrics', 'PAED_ST4_5', 'Extra pulmonary Tuberculosis', 5),
(4, 'Paediatrics', 'PAED_ST4_6', 'Kaposi Sarcoma', 6),
(4, 'Paediatrics', 'PAED_ST4_7', 'HIV Encephalopathy', 7),
(4, 'Paediatrics', 'PAED_ST4_8', 'Candidiasis of the oesophagus, trachea, bronchi or lungs', 8),
(4, 'Paediatrics', 'PAED_ST4_9', 'Cytomegalovirus (CMV) disease of an organ other than liver, spleen or lymph nodes with onset of age >1 month', 9),
(4, 'Paediatrics', 'PAED_ST4_10', 'Cryptococcal Meningitis', 10),
(4, 'Paediatrics', 'PAED_ST4_11', 'PML', 11),
(4, 'Paediatrics', 'PAED_ST4_12', 'Disseminated mycobacteriosis other than TB', 12),
(4, 'Paediatrics', 'PAED_ST4_13', 'Any disseminated mycosis (e.g. histoplasmosis, coccidioidomycosis, or penicilliosis)', 13),
(4, 'Paediatrics', 'PAED_ST4_14', 'Lymphoma (cerebral or B cell non-Hodgkin)', 14),
(4, 'Paediatrics', 'PAED_ST4_15', 'Cryptosporidiosis with diarrhoea lasting more than 1 month', 15),
(4, 'Paediatrics', 'PAED_ST4_16', 'Psoriasis', 16),
(4, 'Paediatrics', 'PAED_ST4_17', 'CNS toxoplasmosis (outside the neonatal period)', 17),
(4, 'Paediatrics', 'PAED_ST4_18', 'Acquired HIV-associated rectal fistula, including rectovaginal fistula', 18),
(4, 'Paediatrics', 'PAED_ST4_19', 'HIV associated nephropathy', 19),
(4, 'Paediatrics', 'PAED_ST4_20', 'HIV associated cardiomyopathy', 20)
ON CONFLICT (condition_code) DO NOTHING;
WHOPAEDEOF

    # Seed ART Regimens
    echo -e "${YELLOW}   Seeding ART Regimens...${NC}"
    docker exec -i medicore-postgres-master psql -U $DB_USERNAME -d "$database" <<'REGIMENSEOF'
-- Adult 1st Line
INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
('1c', 'AZT+3TC+NVP', '1st Line', 'Adult', ARRAY['AZT', '3TC', 'NVP'], false, 1),
('1d', 'AZT+3TC+EFV', '1st Line', 'Adult', ARRAY['AZT', '3TC', 'EFV'], false, 2),
('1e', 'TDF+3TC+NVP', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'NVP'], false, 3),
('1f', 'TDF+3TC+EFV', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'EFV'], false, 4),
('1g', 'AZT+3TC+EFV400', '1st Line', 'Adult', ARRAY['AZT', '3TC', 'EFV400'], false, 5),
('1h', 'TDF+3TC+EFV400', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'EFV400'], false, 6),
('1i', 'TDF+3TC+DTG(TLD1)', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'DTG'], true, 7),
('1j', 'AZT+3TC+DTG', '1st Line', 'Adult', ARRAY['AZT', '3TC', 'DTG'], false, 8),
('1k', 'TDF+FTC+EFV400', '1st Line', 'Adult', ARRAY['TDF', 'FTC', 'EFV400'], false, 9),
('1l', 'TAF+FTC+EFV400', '1st Line', 'Adult', ARRAY['TAF', 'FTC', 'EFV400'], false, 10),
('1m', 'TDF+FTC+ATC/r', '1st Line', 'Adult', ARRAY['TDF', 'FTC', 'ATC/r'], false, 11),
('1n', 'TDF+3TC+ATC/r', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'ATC/r'], false, 12),
('1o', 'TDF+3TC+ATV/r', '1st Line', 'Adult', ARRAY['TDF', '3TC', 'ATV/r'], false, 13),
('1p', 'TAF+FTC+ATV/r', '1st Line', 'Adult', ARRAY['TAF', 'FTC', 'ATV/r'], false, 14),
('1q', 'TAF+3TC+ATV/r', '1st Line', 'Adult', ARRAY['TAF', '3TC', 'ATV/r'], false, 15),
('1r', 'ABC+3TC+DTG', '1st Line', 'Adult', ARRAY['ABC', '3TC', 'DTG'], false, 16),
('1s', 'Other, Specify', '1st Line', 'Adult', ARRAY['Other'], false, 17)
ON CONFLICT (code) DO NOTHING;

-- Adult 2nd Line
INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
('2a', 'AZT+3TC+ILPV/r', '2nd Line', 'Adult', ARRAY['AZT', '3TC', 'LPV/r'], false, 1),
('2b', 'TDF+3TC+LPV/r', '2nd Line', 'Adult', ARRAY['TDF', '3TC', 'LPV/r'], false, 2),
('2c', 'ABC+DDI250+LPV/r', '2nd Line', 'Adult', ARRAY['ABC', 'DDI250', 'LPV/r'], false, 3),
('2d', 'AZT+3TC+ATV/r', '2nd Line', 'Adult', ARRAY['AZT', '3TC', 'ATV/r'], false, 4),
('2e', 'TDF+3TC+ATV/r', '2nd Line', 'Adult', ARRAY['TDF', '3TC', 'ATV/r'], false, 5),
('2f', 'ABC+DDI250+ATV/r', '2nd Line', 'Adult', ARRAY['ABC', 'DDI250', 'ATV/r'], false, 6),
('2g', 'ABC+DDI400+LPV/r', '2nd Line', 'Adult', ARRAY['ABC', 'DDI400', 'LPV/r'], false, 7),
('2h', 'AZT+DDI250+LPV/r', '2nd Line', 'Adult', ARRAY['AZT', 'DDI250', 'LPV/r'], false, 8),
('2i', 'AZT+DDI400+LPV/r', '2nd Line', 'Adult', ARRAY['AZT', 'DDI400', 'LPV/r'], false, 9),
('2j', 'ABC+DDI400+ATV/r', '2nd Line', 'Adult', ARRAY['ABC', 'DDI400', 'ATV/r'], false, 10),
('2k', 'ABC+3TC+DTG', '2nd Line', 'Adult', ARRAY['ABC', '3TC', 'DTG'], false, 11),
('2l', 'AZT+3TC+DTG', '2nd Line', 'Adult', ARRAY['AZT', '3TC', 'DTG'], false, 12),
('2m', 'TDF+3TC+DTG(TLD2)', '2nd Line', 'Adult', ARRAY['TDF', '3TC', 'DTG'], true, 13),
('2n', 'TAF+3TC+DTG', '2nd Line', 'Adult', ARRAY['TAF', '3TC', 'DTG'], false, 14),
('2o', 'Other, Specify', '2nd Line', 'Adult', ARRAY['Other'], false, 15)
ON CONFLICT (code) DO NOTHING;

-- Adult 3rd Line
INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
('3a', 'RAL/DRV/RTV', '3rd Line', 'Adult', ARRAY['RAL', 'DRV', 'RTV'], false, 1),
('3b', 'Other, Specify', '3rd Line', 'Adult', ARRAY['Other'], false, 2)
ON CONFLICT (code) DO NOTHING;

-- Children 1st Line
INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
('4c', 'AZT+3TC+NVP', 'Children 1st Line', 'Paediatric', ARRAY['AZT', '3TC', 'NVP'], false, 1),
('4d', 'AZT+3TC+EFV', 'Children 1st Line', 'Paediatric', ARRAY['AZT', '3TC', 'EFV'], false, 2),
('4e', 'AZT+3TC+LPV/r', 'Children 1st Line', 'Paediatric', ARRAY['AZT', '3TC', 'LPV/r'], false, 3),
('4f', 'ABC+DDI+LPV/r', 'Children 1st Line', 'Paediatric', ARRAY['ABC', 'DDI', 'LPV/r'], false, 4),
('4g', 'ABC+3TC+LPV/r', 'Children 1st Line', 'Paediatric', ARRAY['ABC', '3TC', 'LPV/r'], false, 5),
('4h', 'ABC+3TC+EFV', 'Children 1st Line', 'Paediatric', ARRAY['ABC', '3TC', 'EFV'], false, 6),
('4i', 'AZT+3TC+RAL', 'Children 1st Line', 'Paediatric', ARRAY['AZT', '3TC', 'RAL'], false, 7),
('4j', 'ABC+3TC+DTG', 'Children 1st Line', 'Paediatric', ARRAY['ABC', '3TC', 'DTG'], false, 8),
('4k', 'TDF+3TC+DTG', 'Children 1st Line', 'Paediatric', ARRAY['TDF', '3TC', 'DTG'], false, 9)
ON CONFLICT (code) DO NOTHING;

-- Children 2nd Line
INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
('5a', 'ABC+DDI+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', 'DDI', 'LPV/r'], false, 1),
('5b', 'ABC+3TC+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', '3TC', 'LPV/r'], false, 2),
('5c', 'AZT+3TC+NPV', 'Children 2nd Line', 'Paediatric', ARRAY['AZT', '3TC', 'NVP'], false, 3),
('5e', 'ABC+DDI+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', 'DDI', 'LPV/r'], false, 4),
('5f', 'ABC+3TC+NPV', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', '3TC', 'NVP'], false, 5),
('5g', 'ABC+3TC+DTG', 'Children 2nd Line', 'Paediatric', ARRAY['ABC', '3TC', 'DTG'], false, 6),
('5h', 'TDF+3TC+ATV/r', 'Children 2nd Line', 'Paediatric', ARRAY['TDF', '3TC', 'ATV/r'], false, 7),
('5i', 'TDF+3TC+DTG', 'Children 2nd Line', 'Paediatric', ARRAY['TDF', '3TC', 'DTG'], false, 8),
('5j', 'AZT+3TC+DTG', 'Children 2nd Line', 'Paediatric', ARRAY['AZT', '3TC', 'DTG'], false, 9),
('5k', 'TDF+3TC+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['TDF', '3TC', 'LPV/r'], false, 10),
('5l', 'AZT+3TC+LPV/r', 'Children 2nd Line', 'Paediatric', ARRAY['AZT', '3TC', 'LPV/r'], false, 11),
('5m', 'Other, Specify', 'Children 2nd Line', 'Paediatric', ARRAY['Other'], false, 12)
ON CONFLICT (code) DO NOTHING;

-- Children 3rd Line
INSERT INTO hiv_art_regimens (code, name, line, category, components, is_preferred, display_order) VALUES
('6a', 'RAL/DRV/RTV', 'Children 3rd Line', 'Paediatric', ARRAY['RAL', 'DRV', 'RTV'], false, 1),
('6b', 'DTG+DRV+2NRTIs', 'Children 3rd Line', 'Paediatric', ARRAY['DTG', 'DRV', '2NRTIs'], false, 2),
('6c', 'Other, Specify', 'Children 3rd Line', 'Paediatric', ARRAY['Other'], false, 3)
ON CONFLICT (code) DO NOTHING;
REGIMENSEOF

    echo -e "${GREEN}✅ All lookup data seeded successfully${NC}"
}

# Main execution
TENANT_DBS=($(get_tenant_databases))

if [ ${#TENANT_DBS[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No active tenants found.${NC}"
    exit 0
fi

echo -e "${GREEN}📊 Found ${#TENANT_DBS[@]} tenant(s)${NC}"
echo ""

SUCCESS_COUNT=0
FAILED_DBS=()

for db in "${TENANT_DBS[@]}"; do
    if seed_lookup_data "$db"; then
        ((SUCCESS_COUNT++))
    else
        FAILED_DBS+=("$db")
    fi
    echo ""
done

echo -e "${BLUE}📊 Summary${NC}"
echo -e "${BLUE}=========${NC}"
echo -e "${GREEN}✅ Successfully seeded: $SUCCESS_COUNT tenant(s)${NC}"

if [ ${#FAILED_DBS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Failed: ${#FAILED_DBS[@]} tenant(s)${NC}"
    echo -e "${RED}   Failed databases: ${FAILED_DBS[*]}${NC}"
    exit 1
else
    echo -e "${GREEN}🎉 All lookup tables seeded successfully!${NC}"
fi

