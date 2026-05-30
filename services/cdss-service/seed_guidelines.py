"""
Fast seed script: populates ChromaDB with real WHO/evidence-based clinical guideline chunks.
Bypasses slow PDF parsing. Run once to make guideline search functional immediately.
Full PDF ingest (ingest_guidelines.py) can be run separately for comprehensive coverage.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from ai_models.rag_engine import RAGEngine

GUIDELINES = [
    # ── SEPSIS ──────────────────────────────────────────────────────────────────
    {
        "text": "Sepsis Hour-1 Bundle (Surviving Sepsis Campaign 2018): 1) Measure lactate — resample if initial >2 mmol/L. 2) Obtain blood cultures before antibiotics. 3) Administer broad-spectrum IV antibiotics. 4) Begin 30 mL/kg crystalloid bolus for hypotension or lactate ≥4 mmol/L. 5) Vasopressors (noradrenaline) for MAP <65 mmHg unresponsive to fluids. Initiate all within 1 hour of recognition.",
        "metadata": {"source": "Surviving Sepsis Campaign 2018", "type": "guideline", "clinical_domain": "critical_care", "target_population": "adults", "page": 1}
    },
    {
        "text": "Sepsis Antibiotic Guidance: Broad-spectrum IV antibiotics must be administered within 1 hour of sepsis recognition. De-escalate antibiotics once culture and sensitivity results are available. Recommended empirical regimens: piperacillin-tazobactam 4.5g IV q8h OR meropenem 1g IV q8h (for high-risk or ICU patients). Duration: 7–10 days unless source controlled earlier.",
        "metadata": {"source": "Surviving Sepsis Campaign 2018", "type": "guideline", "clinical_domain": "critical_care", "target_population": "adults", "page": 2}
    },
    {
        "text": "Septic Shock Vasopressor Protocol: Noradrenaline (norepinephrine) is the first-line vasopressor. Target MAP ≥65 mmHg. Add vasopressin 0.03 units/min to reduce noradrenaline dose or if noradrenaline >0.25 mcg/kg/min. Consider hydrocortisone 200mg/day IV if shock persists despite adequate fluids and vasopressors (septic shock refractory to resuscitation).",
        "metadata": {"source": "Surviving Sepsis Campaign 2018", "type": "guideline", "clinical_domain": "critical_care", "target_population": "adults", "page": 3}
    },
    {
        "text": "Sepsis Lactate Monitoring: Serum lactate >2 mmol/L indicates tissue hypoperfusion and is an independent predictor of mortality. Repeat lactate within 1–2 hours if initial >2 mmol/L. Target lactate normalisation as resuscitation goal. Elevated lactate (>4 mmol/L) mandates ICU-level care even without overt hypotension.",
        "metadata": {"source": "Surviving Sepsis Campaign 2018", "type": "guideline", "clinical_domain": "critical_care", "target_population": "adults", "page": 4}
    },
    {
        "text": "Neonatal Sepsis: Early-onset (<72h): IV ampicillin + gentamicin. Late-onset: vancomycin + gentamicin or piperacillin-tazobactam. Blood culture before starting. LP if clinically indicated. Duration: 10–14 days for confirmed sepsis, 36–48h if cultures negative and clinical improvement. Monitor CBC, CRP, procalcitonin. Maintain normoglycaemia and normothermia.",
        "metadata": {"source": "WHO Pocket Book of Hospital Care for Children 2013", "type": "guideline", "clinical_domain": "neonatology", "target_population": "neonates", "page": 1}
    },

    # ── INFECTION CONTROL ───────────────────────────────────────────────────────
    {
        "text": "Standard Precautions (WHO 2007): Apply to ALL patients regardless of diagnosis. Includes: hand hygiene (5 moments), PPE (gloves, gown, mask, eye protection based on risk), safe injection practices, respiratory hygiene, environmental cleaning, and safe handling of sharps and soiled linen. Hand hygiene is the single most effective infection prevention measure.",
        "metadata": {"source": "WHO Standard Precautions 2007", "type": "guideline", "clinical_domain": "infection_control", "target_population": "general", "page": 1}
    },
    {
        "text": "Transmission-Based Precautions: Contact precautions for MRSA, VRE, C. difficile — single room + gloves + gown. Droplet precautions for influenza, COVID-19, meningococcal meningitis — surgical mask within 1 metre. Airborne precautions for TB, measles, varicella — negative-pressure room + N95 respirator. Duration: until infection resolved or cultures negative.",
        "metadata": {"source": "WHO Infection Prevention and Control 2016", "type": "guideline", "clinical_domain": "infection_control", "target_population": "general", "page": 2}
    },
    {
        "text": "Catheter-Associated UTI (CAUTI) Prevention: Insert urinary catheters only when clinically necessary. Use aseptic technique for insertion. Maintain closed drainage system. Keep drainage bag below bladder level. Review catheter necessity daily and remove as soon as possible. Clean periurethral area with soap and water during routine hygiene. Avoid routine bladder irrigation.",
        "metadata": {"source": "WHO Core Components IPC Programmes 2016", "type": "guideline", "clinical_domain": "infection_control", "target_population": "adults", "page": 3}
    },
    {
        "text": "Surgical Site Infection (SSI) Prevention: Administer prophylactic antibiotics within 60 minutes before incision (within 30 min for fluoroquinolones and vancomycin). Avoid shaving — use clippers if hair removal necessary. Maintain normoglycaemia (target BGL <11 mmol/L) intraoperatively. Maintain normothermia. Use povidone-iodine or chlorhexidine-alcohol for skin preparation. Redose antibiotics for procedures >3 hours or >1500mL blood loss.",
        "metadata": {"source": "WHO Global Guidelines for SSI Prevention 2016", "type": "guideline", "clinical_domain": "infection_control", "target_population": "surgical", "page": 4}
    },

    # ── HYPERTENSION ────────────────────────────────────────────────────────────
    {
        "text": "Hypertension Classification (WHO/ISH 2020): Normal: SBP <130 & DBP <85. High-normal: SBP 130–139 or DBP 85–89. Grade 1: SBP 140–159 or DBP 90–99. Grade 2: SBP ≥160 or DBP ≥100. Isolated systolic: SBP ≥140 with DBP <90. Hypertensive urgency: SBP >180/DBP >120 without end-organ damage. Hypertensive emergency: same BP + end-organ damage (AKI, encephalopathy, cardiac failure, aortic dissection).",
        "metadata": {"source": "WHO/ISH Hypertension Guidelines 2020", "type": "guideline", "clinical_domain": "cardiology", "target_population": "adults", "page": 1}
    },
    {
        "text": "Hypertension Treatment: First-line: ACE inhibitors (e.g. enalapril 5–20mg OD) or ARBs for diabetes/CKD; long-acting CCBs (amlodipine 5–10mg OD) or thiazide diuretics (hydrochlorothiazide 12.5–25mg OD) for most others. Combination therapy recommended for Grade 2+ or BP >20/10 above target. Target BP <130/80 for most adults. Lifestyle: reduce sodium <5g/day, DASH diet, exercise ≥150 min/week, limit alcohol.",
        "metadata": {"source": "WHO/ISH Hypertension Guidelines 2020", "type": "guideline", "clinical_domain": "cardiology", "target_population": "adults", "page": 2}
    },
    {
        "text": "Hypertensive Emergency Management: Immediate IV therapy in ICU. Reduce MAP by no more than 20–25% in first hour. Labetalol IV 20mg bolus then infusion, or nicardipine IV 5mg/h titrated, or sodium nitroprusside for dissection. Exception: acute ischaemic stroke — do not lower BP unless >220/120 or thrombolysis planned. For pre-eclampsia: IV labetalol or hydralazine; prevent seizures with IV magnesium sulphate.",
        "metadata": {"source": "WHO/ISH Hypertension Guidelines 2020", "type": "guideline", "clinical_domain": "cardiology", "target_population": "adults", "page": 3}
    },

    # ── DIABETES ────────────────────────────────────────────────────────────────
    {
        "text": "Type 2 Diabetes Management (WHO 2023): HbA1c target <7% (53 mmol/mol) for most adults; <8% for elderly or complex patients. First-line: Metformin 500mg–2g/day with meals (if eGFR >30). Add SGLT-2 inhibitor (empagliflozin, dapagliflozin) for established CVD or heart failure. Add GLP-1 agonist (semaglutide, liraglutide) for obesity or ASCVD. Insulin if HbA1c >10% or symptoms. Monitor HbA1c every 3 months until stable, then 6-monthly.",
        "metadata": {"source": "WHO Diabetes Management Guidelines 2023", "type": "guideline", "clinical_domain": "endocrinology", "target_population": "adults", "page": 1}
    },
    {
        "text": "Diabetic Ketoacidosis (DKA) Management: Fluid resuscitation: 1L 0.9% NaCl in first hour, then 250–500mL/h based on clinical status. Insulin: fixed-rate IV infusion 0.1 units/kg/h. Add 10% glucose when BGL <14 mmol/L. Potassium replacement: only start insulin if K+ >3.5 mmol/L; replace K+ aggressively. Monitor BGL hourly, U&E 2-hourly. Bicarbonate only if pH <6.9. Aim for resolution: pH >7.3, BGL <11 mmol/L, bicarbonate >18 mmol/L.",
        "metadata": {"source": "Joint British Diabetes Societies DKA Guideline 2023", "type": "guideline", "clinical_domain": "endocrinology", "target_population": "adults", "page": 2}
    },
    {
        "text": "Hypoglycaemia Management: Conscious patient: 15–20g fast-acting carbohydrates (glucose tablets, 150mL juice, 3–4 sugar sachets). Recheck BGL in 15 minutes. Repeat if still <4.0 mmol/L. Follow with long-acting carbohydrate. Unconscious patient: IV 25–50mL of 50% glucose (or 10% glucose 125–250mL) OR IM/SC glucagon 1mg. Never give oral glucose to unconscious patient. Identify and address precipitating cause.",
        "metadata": {"source": "International Diabetes Federation Guidelines 2021", "type": "guideline", "clinical_domain": "endocrinology", "target_population": "adults", "page": 3}
    },

    # ── RESPIRATORY ─────────────────────────────────────────────────────────────
    {
        "text": "Community-Acquired Pneumonia (CAP) — CURB-65 Scoring: C=Confusion, U=Urea >7mmol/L, R=RR ≥30/min, B=BP SBP<90 or DBP≤60, 65=Age ≥65. Score 0–1: Outpatient (amoxicillin 1g PO TDS x 5 days). Score 2: Consider admission (amoxicillin + clarithromycin PO or IV). Score 3–5: Hospital admission required, IV antibiotics (co-amoxiclav + clarithromycin or ceftriaxone + clarithromycin for 7 days). Score 4–5: Consider ICU.",
        "metadata": {"source": "BTS CAP Guidelines 2009 (updated 2019)", "type": "guideline", "clinical_domain": "respiratory", "target_population": "adults", "page": 1}
    },
    {
        "text": "Oxygen Therapy Targets: Target SpO2 94–98% for most acutely unwell patients. Target SpO2 88–92% for COPD at risk of hypercapnia (type 2 respiratory failure). Hypoxaemia (SpO2 <90%) requires immediate supplemental oxygen. High-flow nasal oxygen (HFNO) at 40–60 L/min for severe hypoxaemia before NIV/intubation. Avoid excessive oxygen — hyperoxaemia worsens outcomes in AMI, stroke, and post-resuscitation.",
        "metadata": {"source": "BTS Emergency Oxygen Guidelines 2017", "type": "guideline", "clinical_domain": "respiratory", "target_population": "adults", "page": 2}
    },
    {
        "text": "COPD Acute Exacerbation Management: Controlled oxygen to SpO2 88–92%. Salbutamol 2.5–5mg nebulised + ipratropium 500mcg nebulised. Prednisolone 30–40mg PO for 5 days. Antibiotics if purulent sputum or CRP >20: amoxicillin 500mg TDS or doxycycline 200mg loading then 100mg OD x 5 days. NIV (CPAP/BiPAP) for pH 7.25–7.35 with PaCO2 >6.5 kPa. Intubation if pH <7.25 despite NIV.",
        "metadata": {"source": "GOLD COPD Guidelines 2024", "type": "guideline", "clinical_domain": "respiratory", "target_population": "adults", "page": 3}
    },

    # ── CARDIAC ─────────────────────────────────────────────────────────────────
    {
        "text": "STEMI Management: Dual antiplatelet therapy (aspirin 300mg + ticagrelor 180mg or clopidogrel 600mg) immediately. Primary PCI is treatment of choice if door-to-balloon time <120 min. Thrombolysis (alteplase or tenecteplase) if PCI not available within 120 min and no contraindications. Anticoagulation: IV heparin or enoxaparin. Transfer to PCI centre after thrombolysis. Morphine 2–4mg IV for pain; oxygen only if SpO2 <94%.",
        "metadata": {"source": "ESC STEMI Guidelines 2023", "type": "guideline", "clinical_domain": "cardiology", "target_population": "adults", "page": 1}
    },
    {
        "text": "Heart Failure Management (HFrEF, EF <40%): Four pillars of therapy: 1) ACE inhibitor or ARB or ARNI (sacubitril/valsartan) — reduce mortality by 20%. 2) Beta-blocker (carvedilol, bisoprolol, metoprolol succinate) — reduce mortality by 35%. 3) MRA (spironolactone or eplerenone) — add if symptomatic. 4) SGLT-2 inhibitor (dapagliflozin or empagliflozin) — reduce hospitalisations. Start low, titrate to maximum tolerated doses. Target: EF improvement, symptom control, reduced hospitalisations.",
        "metadata": {"source": "ESC Heart Failure Guidelines 2021", "type": "guideline", "clinical_domain": "cardiology", "target_population": "adults", "page": 2}
    },

    # ── MATERNAL HEALTH ─────────────────────────────────────────────────────────
    {
        "text": "Pre-eclampsia Management: Diagnosis: BP ≥140/90 mmHg after 20 weeks + proteinuria (≥300mg/24h). Severe features: BP ≥160/110, serum creatinine >100 µmol/L, platelets <100 ×10⁹/L, ALT/AST >2× ULN, pulmonary oedema, new headache/visual changes. Antihypertensives: labetalol 200mg PO BD or nifedipine LA 30mg OD. Seizure prophylaxis: IV magnesium sulphate 4g loading + 1g/h maintenance. Delivery is definitive treatment.",
        "metadata": {"source": "WHO Recommendations for Prevention of Pre-eclampsia 2011 / ISSHP 2021", "type": "guideline", "clinical_domain": "obstetrics", "target_population": "pregnant_women", "page": 1}
    },
    {
        "text": "Postpartum Haemorrhage (PPH) Prevention and Treatment: Prevention: oxytocin 10IU IM immediately after birth (all women). Treatment of PPH (>500mL vaginal / >1000mL CS): massage uterus, bimanual compression. Drugs: oxytocin 10IU IV over 10 min, then infusion 40IU in 500mL at 125mL/h. If inadequate: carbetocin or misoprostol 600mcg sublingual. Third-line: tranexamic acid 1g IV within 3h of birth. Blood transfusion for Hb <80g/L or haemodynamic instability.",
        "metadata": {"source": "WHO PPH Guidelines 2012 / FIGO 2022", "type": "guideline", "clinical_domain": "obstetrics", "target_population": "pregnant_women", "page": 2}
    },

    # ── HIV / AIDS ───────────────────────────────────────────────────────────────
    {
        "text": "HIV AIDS Antiretroviral Therapy (ART) — WHO 2021 Preferred Regimens: HIV human immunodeficiency virus / AIDS acquired immunodeficiency syndrome. Adults and adolescents: TDF + 3TC + DTG (tenofovir + lamivudine + dolutegravir) as first-line ART. Pregnant women: TDF + 3TC + DTG preferred. Children <20kg: ABC + 3TC + DTG. Start ART as soon as possible after HIV diagnosis regardless of CD4 count. Monitor viral load (VL) at 6 months and 12 months then annually. Target: viral load <1000 copies/mL at 6 months. CD4 <200: prophylaxis with cotrimoxazole.",
        "metadata": {"source": "WHO Consolidated HIV Guidelines 2021", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "adults", "page": 1}
    },
    {
        "text": "PEP Post-Exposure Prophylaxis for HIV AIDS: Start PEP within 72 hours of HIV exposure (sooner = better; ineffective after 72h). Preferred regimen: TDF/FTC (Truvada) + RAL (raltegravir 400mg BD) or DTG 50mg OD. Duration: 28 days. Baseline: HIV test, HBsAg, renal function, pregnancy test. Follow-up HIV testing at 6 weeks, 3 months. PrEP (pre-exposure prophylaxis): TDF/FTC daily for HIV prevention in high-risk individuals. Report occupational HIV exposure within 2 hours.",
        "metadata": {"source": "WHO PEP Guidelines 2014 / WHO Consolidated HIV Guidelines 2021", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "adults", "page": 2}
    },
    {
        "text": "HIV AIDS Opportunistic Infections: Cryptococcal meningitis: fluconazole 1200mg OD for 2 weeks induction, then 400mg OD 8 weeks consolidation, 200mg OD maintenance. PCP (Pneumocystis jirovecii pneumonia): high-dose cotrimoxazole (TMP-SMX) IV 15–20mg/kg/day TMP x 21 days; add steroids if PaO2 <70mmHg. CMV retinitis: IV ganciclovir 5mg/kg BD x 14–21 days induction. Toxoplasmosis: pyrimethamine + sulfadiazine + folinic acid x 6 weeks. Suppress all OIs with ART.",
        "metadata": {"source": "WHO Consolidated HIV Guidelines 2021 / BHIVA OI Guidelines 2023", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "adults", "page": 3}
    },

    # ── STI — SEXUALLY TRANSMITTED INFECTIONS ────────────────────────────────────
    {
        "text": "STI Sexually Transmitted Infections — WHO 2021 Treatment Guidelines: Gonorrhoea (Neisseria gonorrhoeae): ceftriaxone 500mg IM single dose (1g if weight >150kg). Do NOT use fluoroquinolones (high resistance). Chlamydia (Chlamydia trachomatis): azithromycin 1g PO single dose OR doxycycline 100mg BD x 7 days. Syphilis (Treponema pallidum) — Primary/Secondary: benzathine penicillin G 2.4 million IU IM single dose; Latent/unknown duration: 2.4 million IU IM weekly x 3. Genital herpes (HSV): aciclovir 400mg TDS x 5 days or valaciclovir 500mg BD x 5 days. All STI contacts should be tested and treated. HIV and STI co-testing recommended.",
        "metadata": {"source": "WHO STI Treatment Guidelines 2021", "type": "guideline", "clinical_domain": "sexual_health", "target_population": "adults", "page": 1}
    },
    {
        "text": "STI Screening and Partner Notification: Sexually transmitted infections (STI/STD) syndromic management when laboratory unavailable. Urethral discharge (male): treat gonorrhoea + chlamydia empirically. Vaginal discharge: treat bacterial vaginosis + Trichomonas (metronidazole 2g PO single dose or 400mg BD x 7d); add gonorrhoea/chlamydia treatment if cervicitis present. Genital ulcer: treat syphilis + herpes (aciclovir + benzathine penicillin). Scrotal swelling: epididymo-orchitis — treat gonorrhoea + chlamydia. Contact tracing: notify all sexual partners from past 3 months. Offer HIV, hepatitis B/C testing with every STI diagnosis.",
        "metadata": {"source": "WHO STI Guidelines 2021 / BASHH Syndromic Management 2023", "type": "guideline", "clinical_domain": "sexual_health", "target_population": "adults", "page": 2}
    },

    # ── MALARIA ─────────────────────────────────────────────────────────────────
    {
        "text": "Malaria Treatment (WHO 2023): Uncomplicated P. falciparum: ACT (artemether-lumefantrine or artesunate-amodiaquine) for 3 days. Severe malaria: IV artesunate 2.4mg/kg at 0h, 12h, 24h, then daily for 7 days. Switch to oral ACT when able to take oral meds. Add doxycycline 100mg BD x 7 days if IV artesunate unavailable use IV quinine. Blood transfusion if Hb <50g/L. Monitor blood glucose (hypoglycaemia common with quinine).",
        "metadata": {"source": "WHO Malaria Treatment Guidelines 2023", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "adults", "page": 1}
    },
    {
        "text": "Malaria in Pregnancy: All trimesters: artemether-lumefantrine for uncomplicated malaria (safer than other ACTs). Severe malaria in pregnancy: IV artesunate preferred in all trimesters. Intermittent preventive treatment in pregnancy (IPTp): sulfadoxine-pyrimethamine 3 tablets at each ANC visit from 13 weeks, at least 1 month apart, minimum 3 doses. Insecticide-treated bed nets (ITN) for all pregnant women in endemic areas.",
        "metadata": {"source": "WHO Malaria in Pregnancy Guidelines 2023", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "pregnant_women", "page": 2}
    },

    # ── PAEDIATRICS ─────────────────────────────────────────────────────────────
    {
        "text": "Paediatric Pneumonia (WHO IMCI): Fast breathing diagnosis: <2 months ≥60/min; 2–11 months ≥50/min; 1–5 years ≥40/min. Non-severe pneumonia: amoxicillin 40mg/kg/day PO in 2 divided doses x 5 days. Severe pneumonia (chest indrawing, danger signs): IV/IM ampicillin 50mg/kg q6h + IV/IM gentamicin 7.5mg/kg OD x 7–10 days. Oxygen if SpO2 <90%. Danger signs: convulsions, unable to drink, lethargy, stridor, severe undernutrition.",
        "metadata": {"source": "WHO IMCI Guidelines 2014", "type": "guideline", "clinical_domain": "paediatrics", "target_population": "children", "page": 1}
    },
    {
        "text": "Paediatric Diarrhoea Management (WHO ORS): Low-osmolarity ORS for all dehydrated children. Plan A (no dehydration): ORS after each loose stool (50–100mL <2y, 100–200mL ≥2y). Plan B (some dehydration): 75mL/kg ORS over 4h. Plan C (severe dehydration): IV Ringer's lactate 100mL/kg (30mL/kg fast then 70mL/kg over 2.5h for <12mo; 1h for ≥12mo). Zinc 10mg/day <6mo; 20mg/day ≥6mo for 10–14 days. Continue breastfeeding. Antibiotics only for bloody diarrhoea or cholera.",
        "metadata": {"source": "WHO Management of Diarrhoea in Children 2005", "type": "guideline", "clinical_domain": "paediatrics", "target_population": "children", "page": 2}
    },

    # ── MENTAL HEALTH ───────────────────────────────────────────────────────────
    {
        "text": "Depression Treatment (WHO mhGAP 2023): Mild-moderate: psychosocial support + structured physical activity + sleep hygiene. If no improvement in 4–8 weeks: SSRI (fluoxetine 20mg/day first-line due to safety profile). Severe depression: SSRI + psychological therapy. Duration: at least 6 months after remission; 2 years if recurrent. Suicidal ideation: assess risk, safety plan, consider hospitalisation. Avoid tricyclic antidepressants as first-line due to overdose risk.",
        "metadata": {"source": "WHO mhGAP Intervention Guide 2.0 2016 (updated 2023)", "type": "guideline", "clinical_domain": "mental_health", "target_population": "adults", "page": 1}
    },

    # ── PAIN MANAGEMENT ─────────────────────────────────────────────────────────
    {
        "text": "WHO Analgesic Ladder for Pain Management: Step 1 (mild pain VAS 1–3): Non-opioids — paracetamol 1g q4–6h (max 4g/day), NSAIDs (ibuprofen 400mg TDS with food) ± adjuvants. Step 2 (moderate pain VAS 4–6): Weak opioids — tramadol 50–100mg q6h or codeine 30–60mg q4h + Step 1. Step 3 (severe pain VAS 7–10): Strong opioids — morphine 5–10mg q4h PO (or 2.5–5mg IV/SC) ± Step 1. Titrate to effect. Treat constipation prophylactically with opioids.",
        "metadata": {"source": "WHO Cancer Pain Relief 1986 / WHO Palliative Care Guidelines 2018", "type": "guideline", "clinical_domain": "palliative_care", "target_population": "adults", "page": 1}
    },

    # ── STROKE ──────────────────────────────────────────────────────────────────
    {
        "text": "Acute Ischaemic Stroke Management: FAST recognition (Face droop, Arm weakness, Speech difficulty, Time to call). CT brain immediately to exclude haemorrhage. IV alteplase 0.9mg/kg (max 90mg) within 4.5h of symptom onset (10% bolus then 90% over 1h) — contraindicated if BP >185/110 (lower first), INR >1.7, or platelets <100. Mechanical thrombectomy for large vessel occlusion within 24h at eligible centres. Aspirin 300mg after 24h if no thrombolysis. Admit to stroke unit.",
        "metadata": {"source": "ESO Acute Ischaemic Stroke Guidelines 2021", "type": "guideline", "clinical_domain": "neurology", "target_population": "adults", "page": 1}
    },

    # ── VACCINATION ─────────────────────────────────────────────────────────────
    {
        "text": "Essential Immunisation Schedule (WHO EPI): Birth: BCG + OPV-0 + Hep B. 6 weeks: OPV-1 + IPV-1 + Penta-1 (DPT-HepB-Hib) + PCV-1 + Rota-1. 10 weeks: OPV-2 + Penta-2 + PCV-2 + Rota-2. 14 weeks: OPV-3 + IPV-2 + Penta-3 + PCV-3 + Rota-3. 9 months: MCV-1 + Yellow Fever (endemic areas). 15–18 months: MCV-2 + DPT booster. Annual influenza for high-risk groups. COVID-19 per national schedule.",
        "metadata": {"source": "WHO EPI Immunisation Schedule 2023", "type": "guideline", "clinical_domain": "preventive_care", "target_population": "children", "page": 1}
    },

    # ── ONCOLOGY ────────────────────────────────────────────────────────────────
    {
        "text": "Febrile Neutropenia Management: Fever ≥38.3°C (or ≥38.0°C sustained 1h) + ANC <500/µL or expected to fall <500/µL. MASCC score to stratify risk. High-risk (MASCC <21): IV piperacillin-tazobactam 4.5g q8h or cefepime 2g q8h; add vancomycin if catheter infection/skin infection/haemodynamic instability. Add antifungal (caspofungin or voriconazole) if fever persists >72h. G-CSF for high-risk patients. Blood cultures × 2 before antibiotics. Do NOT delay antibiotics pending cultures.",
        "metadata": {"source": "ASCO Febrile Neutropenia Guidelines 2018 / IDSA 2010", "type": "guideline", "clinical_domain": "oncology", "target_population": "adults", "page": 1}
    },
    {
        "text": "Chemotherapy-Induced Nausea & Vomiting (CINV) Prevention: High emetic risk (cisplatin, AC): 5-HT3 antagonist (ondansetron 8mg) + NK1 antagonist (aprepitant 125mg day 1, 80mg days 2–3) + dexamethasone 12mg day 1 (8mg days 2–4) ± olanzapine 10mg days 1–4. Moderate risk: 5-HT3 + dexamethasone ± NK1. Low risk: dexamethasone 8mg alone or metoclopramide. Breakthrough: add lorazepam 0.5–1mg PO q4–6h PRN. Maintain adequate hydration.",
        "metadata": {"source": "ASCO CINV Guidelines 2020 / MASCC/ESMO 2016", "type": "guideline", "clinical_domain": "oncology", "target_population": "adults", "page": 2}
    },
    {
        "text": "Cancer Pain — WHO Oncology Ladder: Assess pain using NRS 0–10 at every visit. Mild (1–3): paracetamol + NSAID. Moderate (4–6): low-dose strong opioid (morphine 5mg q4h PO, NOT codeine — inadequate in ~10% CYP2D6 poor metabolisers). Severe (7–10): titrate morphine — increase daily dose by 30–50% if pain uncontrolled. Prescribe laxative (lactulose or senna) with every opioid. Add dexamethasone for bone/nerve pain, gabapentinoids for neuropathic pain, bisphosphonates for bone metastases.",
        "metadata": {"source": "WHO Cancer Pain Ladder / ESMO Cancer Pain Guidelines 2018", "type": "guideline", "clinical_domain": "oncology", "target_population": "adults", "page": 3}
    },
    {
        "text": "Tumour Lysis Syndrome (TLS) Prevention and Treatment: High-risk: haematological malignancies with high burden (Burkitt lymphoma, ALL, AML with WBC >100,000). Prophylaxis: vigorous IV hydration 3L/m²/day, allopurinol 300mg/day starting 24–48h before chemotherapy. Very high risk: rasburicase 0.2mg/kg IV daily × 5 days (contraindicated in G6PD deficiency). Cairo-Bishop criteria for TLS: ≥2 of uric acid ≥476µmol/L, K ≥6mmol/L, phosphate ≥2.1mmol/L, calcium ≤1.75mmol/L. Monitor electrolytes q6–8h. Treat hyperkalaemia immediately.",
        "metadata": {"source": "ESMO TLS Guidelines 2016 / Cairo & Bishop 2004", "type": "guideline", "clinical_domain": "oncology", "target_population": "adults", "page": 4}
    },

    # ── RENAL / NEPHROLOGY ──────────────────────────────────────────────────────
    {
        "text": "Acute Kidney Injury (AKI) — KDIGO Staging: Stage 1: creatinine ×1.5–1.9 baseline or rise ≥26.5µmol/L within 48h or UO <0.5mL/kg/h for 6–12h. Stage 2: creatinine ×2.0–2.9 or UO <0.5mL/kg/h for ≥12h. Stage 3: creatinine ×3.0 or ≥353.6µmol/L or RRT or UO <0.3mL/kg/h for ≥24h. Management: identify/treat cause, optimise fluid status, avoid nephrotoxins (NSAIDs, contrast, aminoglycosides), monitor closely. RRT indications: refractory hyperkalaemia, acidosis, uraemia, fluid overload.",
        "metadata": {"source": "KDIGO AKI Guidelines 2012", "type": "guideline", "clinical_domain": "nephrology", "target_population": "adults", "page": 1}
    },
    {
        "text": "Chronic Kidney Disease (CKD) — KDIGO Management: GFR-based staging G1–G5 + albuminuria A1–A3. Targets: BP <130/80 (ACE-I or ARB as first-line for proteinuria); HbA1c <7% if diabetic; SGLT-2 inhibitor (dapagliflozin/empagliflozin) for CKD G2–G4 regardless of diabetes (reno-protective). Avoid NSAIDs. Dietary protein 0.6–0.8g/kg/day. Correct anaemia (Hb target 100–120g/L with ESA). CKD G4–G5: prepare for RRT (PD/HD/transplant). Refer to nephrology at eGFR <30.",
        "metadata": {"source": "KDIGO CKD Guidelines 2024", "type": "guideline", "clinical_domain": "nephrology", "target_population": "adults", "page": 2}
    },
    {
        "text": "Hyperkalaemia Management: K+ 5.5–6.0 mmol/L: dietary restriction, review medications (stop ACE-I/ARB/MRA if possible), add patiromer or sodium zirconium cyclosilicate. K+ 6.0–6.5 or ECG changes (peaked T waves, wide QRS, sine wave): immediate 10mL 10% calcium gluconate IV over 2–3 min (cardiac protection, repeat if no ECG improvement). Shift K+: insulin 10 units + 25g glucose IV. Excrete K+: salbutamol nebulised 10–20mg; frusemide 40–80mg IV if not oliguric; consider RRT for refractory cases.",
        "metadata": {"source": "UK Renal Association Hyperkalaemia Guidelines 2020", "type": "guideline", "clinical_domain": "nephrology", "target_population": "adults", "page": 3}
    },

    # ── SURGERY / PERIOPERATIVE ──────────────────────────────────────────────────
    {
        "text": "Enhanced Recovery After Surgery (ERAS): Pre-op: carbohydrate loading (400mL clear carbohydrate drink 2h before), avoid prolonged fasting (clear fluids up to 2h, solids up to 6h), multimodal premedication (paracetamol + celecoxib ± gabapentin). Intra-op: goal-directed fluid therapy (avoid excess crystalloid), avoid opioid-sparing (remifentanil target), normothermia. Post-op: early oral feeding within 4–6h, early mobilisation day 0–1, multimodal analgesia (regular paracetamol + NSAID + wound infiltration), avoid routine urinary catheters, VTE prophylaxis.",
        "metadata": {"source": "ERAS Society Guidelines 2019", "type": "guideline", "clinical_domain": "surgery", "target_population": "adults", "page": 1}
    },
    {
        "text": "Venous Thromboembolism (VTE) Prophylaxis: Assess all inpatients with Caprini or Padua score. Low risk: early ambulation only. Moderate-high surgical risk: LMWH (enoxaparin 40mg SC OD) or UFH 5000 units SC BD/TDS + mechanical compression (TED stockings + pneumatic compression devices). Major orthopaedic (hip/knee replacement, hip fracture): extend prophylaxis to 35 days post-discharge with LMWH or DOAC (rivaroxaban 10mg OD or apixaban 2.5mg BD). Contraindicated: active bleeding, thrombocytopenia <50, recent surgery to CNS/eye/spine.",
        "metadata": {"source": "NICE NG89 VTE Prevention 2019 / ACCP VTE Guidelines 2012", "type": "guideline", "clinical_domain": "surgery", "target_population": "adults", "page": 2}
    },

    # ── CRITICAL CARE / ICU ──────────────────────────────────────────────────────
    {
        "text": "Mechanical Ventilation — Lung-Protective Strategy (ARDS): Tidal volume 6mL/kg predicted body weight (PBW). Plateau pressure ≤30 cmH2O. PEEP: set per FiO2/PEEP table; avoid high FiO2 (target SpO2 88–95%, PaO2 55–80 mmHg). Driving pressure (Pplat − PEEP) ≤15 cmH2O target. Prone positioning ≥16h/day for P/F ratio <150. Neuromuscular blockade for first 48h if P/F <150. High-frequency oscillation NOT recommended. Conservative fluid strategy once shock resolved.",
        "metadata": {"source": "ARDS Network Protocol / ARMA Trial / PROSEVA Trial / ATS/ESICM 2017", "type": "guideline", "clinical_domain": "critical_care", "target_population": "adults", "page": 2}
    },
    {
        "text": "Nutrition in Critical Illness: Start enteral nutrition (EN) within 24–48h of ICU admission if haemodynamically stable. Prefer gastric route; post-pyloric if high gastric residuals (>250mL). Target 25–30 kcal/kg/day, protein 1.2–2.0g/kg/day. Avoid early parenteral nutrition (first 7 days if not tolerating EN). Permissive underfeeding (70% of target) acceptable in first week. Monitor for refeeding syndrome (check phosphate, potassium, magnesium and supplement). Avoid routine prokinetics but consider metoclopramide 10mg TDS for high residuals.",
        "metadata": {"source": "ESPEN Critical Care Nutrition Guidelines 2019 / SCCM/ASPEN 2016", "type": "guideline", "clinical_domain": "critical_care", "target_population": "adults", "page": 3}
    },
    {
        "text": "Glucose Management in ICU: Target BGL 7.8–10.0 mmol/L for most ICU patients. Start insulin infusion if BGL >10 mmol/L on 2 consecutive readings. Tight glycaemic control (4.5–6.0 mmol/L) is harmful — increases hypoglycaemia and mortality (NICE-SUGAR trial). Protocol: insulin infusion titration per validated hospital protocol; check BGL hourly when on insulin infusion. Treat hypoglycaemia (BGL <3.9 mmol/L) immediately: 25mL 50% dextrose IV or 10% dextrose 125mL IV.",
        "metadata": {"source": "NICE-SUGAR Trial 2009 / SCCM Glucose Management 2019", "type": "guideline", "clinical_domain": "critical_care", "target_population": "adults", "page": 4}
    },

    # ── NEUROLOGY ────────────────────────────────────────────────────────────────
    {
        "text": "Status Epilepticus Management: Phase 1 (0–5 min): benzodiazepine — IV lorazepam 0.1mg/kg (max 4mg) preferred; IM midazolam 10mg if no IV access; rectal diazepam 0.5mg/kg if IM/IV unavailable. Phase 2 (5–20 min, no response): levetiracetam 60mg/kg (max 4.5g) IV over 10 min OR valproate 40mg/kg (max 3g) IV over 5 min OR phenytoin 20mg/kg IV at max 50mg/min (fosphenytoin 20 PE/kg preferred — fewer infusion reactions). Phase 3 (>20 min, refractory): general anaesthesia — propofol, midazolam, or thiopentone infusion; intubation + ICU.",
        "metadata": {"source": "NICE CG137 Epilepsies 2022 / NCS Status Epilepticus Guidelines 2016", "type": "guideline", "clinical_domain": "neurology", "target_population": "adults", "page": 2}
    },
    {
        "text": "Meningitis Management: Immediate IV antibiotics — do NOT wait for LP if signs of raised ICP (papilloedema, focal neurology, consciousness <GCS 13). Empirical: ceftriaxone 2g IV q12h + dexamethasone 0.15mg/kg q6h × 4 days (reduce cerebral oedema). Add ampicillin 2g IV q4h for Listeria risk (age >50, immunocompromised, pregnancy). Adjunctive acyclovir 10mg/kg IV q8h until HSV excluded. CSF: WBC >10, protein >0.45g/L, glucose <60% serum. Notify public health; rifampicin or ciprofloxacin prophylaxis for close contacts (meningococcal).",
        "metadata": {"source": "ESCMID Meningitis Guidelines 2016 / IDSA Meningitis Guidelines 2004", "type": "guideline", "clinical_domain": "neurology", "target_population": "adults", "page": 3}
    },

    # ── GASTROINTESTINAL ─────────────────────────────────────────────────────────
    {
        "text": "Upper GI Bleeding — Risk Stratification & Management: Glasgow-Blatchford score (pre-endoscopy): ≥6 = high risk, requires hospitalisation. Resuscitate: 2 large-bore IV lines, type & crossmatch, IV fluids/blood (target Hb >70g/L; >80 in IHD). IV PPI: omeprazole 80mg bolus + 8mg/h infusion in suspected peptic ulcer. Endoscopy within 24h (within 12h if Rockall ≥3 or ongoing bleeding). Post-endoscopy high-risk (Forrest Ia/Ib/IIa/IIb): continue PPI infusion 72h, then PO 40mg BD × 4 weeks. H. pylori test and treat. Avoid NSAIDs/aspirin.",
        "metadata": {"source": "NICE CG141 UGIB 2016 / BSG UGIB Guidelines 2019", "type": "guideline", "clinical_domain": "gastroenterology", "target_population": "adults", "page": 1}
    },
    {
        "text": "Acute Liver Failure — Management Principles: Admit to ICU/HDU. Monitor for and treat: cerebral oedema (head elevation 30°, avoid stimulation; mannitol 0.5–1g/kg IV for ICH; target ICP <20 mmHg, CPP >50 mmHg), coagulopathy (FFP only for invasive procedures — not prophylactic), hypoglycaemia (10% dextrose infusion, BGL checks q1–4h), AKI (CVVH preferred over IHD), infection (broad-spectrum antibiotics if clinically suspected). N-acetylcysteine IV for paracetamol overdose (even late-presenting). Urgent liver transplant assessment for King's College Criteria fulfilment.",
        "metadata": {"source": "EASL ALF Guidelines 2017 / King's College Hospital Criteria", "type": "guideline", "clinical_domain": "gastroenterology", "target_population": "adults", "page": 2}
    },
    {
        "text": "Inflammatory Bowel Disease — Acute Severe Ulcerative Colitis (Truelove & Witts Criteria): Bloody diarrhoea ≥6/day + any of: pulse >90, temp >37.8°C, Hb <105g/L, ESR >30, CRP >30. Admit to hospital. IV hydrocortisone 100mg q6h. VTE prophylaxis (LMWH). Stool cultures. Flexible sigmoidoscopy within 24h. If no response to IV steroids by day 3: ciclosporin 2mg/kg IV or infliximab 5mg/kg IV (rescue therapy) OR surgical referral. Avoid opioids and anticholinergics (toxic megacolon risk). Response assessed daily (Oxford criteria).",
        "metadata": {"source": "BSG ASUC Guidelines 2019 / ECCO IBD Guidelines 2017", "type": "guideline", "clinical_domain": "gastroenterology", "target_population": "adults", "page": 3}
    },

    # ── ENDOCRINOLOGY ────────────────────────────────────────────────────────────
    {
        "text": "Thyroid Storm Management: Rare but life-threatening thyrotoxicosis. Burch-Wartofsky score ≥45 = thyroid storm. Treatment (all simultaneously): 1) Beta-blocker: propranolol 60–80mg q4h PO or 0.5–1mg IV slowly (controls tachycardia). 2) Thionamide: propylthiouracil (PTU) 200–250mg q4h PO (blocks synthesis + T4→T3 conversion) — use PTU not methimazole in storm. 3) Iodine (1h AFTER PTU): Lugol's iodine 8 drops q6h or potassium iodide. 4) Corticosteroids: hydrocortisone 100mg IV q8h. 5) Treat precipitant. HDU/ICU monitoring.",
        "metadata": {"source": "American Thyroid Association Thyroid Storm Guidelines 2016", "type": "guideline", "clinical_domain": "endocrinology", "target_population": "adults", "page": 4}
    },
    {
        "text": "Addisonian Crisis Management: Life-threatening adrenal insufficiency precipitated by illness/injury. Presentation: severe hypotension, vomiting, abdominal pain, confusion, hyponatraemia, hyperkalaemia, hypoglycaemia. Treatment: 1) IV hydrocortisone 100mg bolus IMMEDIATELY (do not wait for results). 2) IV 0.9% NaCl 1L over first hour (correct hypovolaemia). 3) 5–10% dextrose for hypoglycaemia. 4) Treat precipitant. Maintenance: hydrocortisone 50–100mg IV/IM q6–8h for 24h, then taper. Do NOT use dexamethasone if you want to do SST later (hydrocortisone doesn't cross-react with cortisol assay).",
        "metadata": {"source": "Endocrine Society Adrenal Insufficiency Guidelines 2016", "type": "guideline", "clinical_domain": "endocrinology", "target_population": "adults", "page": 5}
    },

    # ── HAEMATOLOGY ──────────────────────────────────────────────────────────────
    {
        "text": "Massive Transfusion Protocol (MTP): Activate for blood loss >150mL/min or anticipated transfusion >10 units pRBC in 24h (trauma, PPH, GI bleed, surgery). Target ratio: 1:1:1 (pRBC:FFP:platelets) or 2:1:1. Give tranexamic acid 1g IV STAT + 1g IV over 8h (trauma within 3h of injury). Target: Hb 70–90 g/L, platelets >50 (>100 if neuro/multiorgan), fibrinogen >1.5g/L (cryoprecipitate 2-pool if <1.5). Calcium replacement (ionised Ca²⁺ target >1.1 mmol/L). Avoid hypothermia and acidosis — the lethal triad with coagulopathy.",
        "metadata": {"source": "SHOT / British Society for Haematology MTP Guidelines 2015", "type": "guideline", "clinical_domain": "haematology", "target_population": "adults", "page": 1}
    },
    {
        "text": "Sickle Cell Disease — Vaso-occlusive Crisis (VOC): Assess pain using NRS; start analgesia within 30 min. Mild-moderate (NRS 4–6): ibuprofen 400mg TDS (avoid if renal impairment) + paracetamol 1g q6h + oral opioid (codeine or tramadol). Severe (NRS ≥7): IV morphine 0.1mg/kg q20–30 min titrated; IV fluids 2–3L/day (avoid excess — pulmonary sequestration risk). Oxygen only if SpO2 <95%. Incentive spirometry. Screen for acute chest syndrome (ACS): new chest symptoms/infiltrate + fever — treat with broad-spectrum antibiotics + exchange transfusion if severe.",
        "metadata": {"source": "BSH Sickle Cell Disease Guidelines 2021 / NHLBI SCD Evidence Review 2014", "type": "guideline", "clinical_domain": "haematology", "target_population": "adults", "page": 2}
    },

    # ── RHEUMATOLOGY ─────────────────────────────────────────────────────────────
    {
        "text": "Rheumatoid Arthritis — Treat to Target: Initiate csDMARDs within 3 months of diagnosis. Methotrexate 7.5–25mg weekly (with folic acid 5mg weekly) is anchor drug. If contraindicated: leflunomide 20mg OD or sulfasalazine 500mg–3g/day. Target: DAS28 <2.6 (remission) or <3.2 (low disease activity) within 6 months. Review and escalate at every visit if target not met. Add bDMARD (TNFi — adalimumab, etanercept, or IL-6 inhibitor — tocilizumab) if inadequate response to ≥2 csDMARDs. Monitor CBC, LFTs, creatinine every 3 months on methotrexate.",
        "metadata": {"source": "EULAR RA Management Recommendations 2022", "type": "guideline", "clinical_domain": "rheumatology", "target_population": "adults", "page": 1}
    },
    {
        "text": "Acute Gout Management: Joint aspiration for definitive diagnosis (negatively birefringent monosodium urate crystals). Acute attack: NSAIDs (naproxen 500mg BD × 5 days) OR colchicine 500mcg BD–TDS (max 6mg/course) OR prednisolone 30–35mg OD × 5 days if NSAIDs/colchicine contraindicated. Urate-lowering therapy (ULT): start allopurinol 100mg OD once acute attack fully resolved (not during acute attack), increase by 100mg every 4 weeks to target serum urate <360 µmol/L (<300 µmol/L for tophaceous gout). Cover ULT initiation with colchicine 500mcg OD × 6 months.",
        "metadata": {"source": "BSR Gout Guidelines 2017 / EULAR Gout Guidelines 2016", "type": "guideline", "clinical_domain": "rheumatology", "target_population": "adults", "page": 2}
    },

    # ── DERMATOLOGY ──────────────────────────────────────────────────────────────
    {
        "text": "Anaphylaxis Management: Recognise: acute onset, life-threatening airway/breathing/circulation compromise ± skin/mucosal changes after allergen exposure. ACTION 1: Adrenaline (epinephrine) 0.5mg (0.5mL 1:1000) IM anterolateral thigh IMMEDIATELY — this is the first and most important step. Repeat every 5 min if no improvement. ACTION 2: Lay patient flat (sitting if breathless), high-flow oxygen 15L/min via NRB mask, IV access. ACTION 3: Antihistamine (chlorphenamine 10mg IV/IM) + hydrocortisone 200mg IV (adjuncts only — do not replace adrenaline). IV fluid challenge 500mL–1L if hypotensive. Observe minimum 6h after recovery.",
        "metadata": {"source": "RCUK Anaphylaxis Algorithm 2021 / EAACI Anaphylaxis Guidelines 2014", "type": "guideline", "clinical_domain": "emergency_medicine", "target_population": "adults", "page": 1}
    },

    # ── WOMEN'S HEALTH ───────────────────────────────────────────────────────────
    {
        "text": "Cervical Cancer Screening (WHO 2021): Primary HPV testing preferred over cytology. Screen all women aged 30–49 in LMIC (or 25–65 in high-income settings). HPV test positive: visual inspection with acetic acid (VIA) or colposcopy. CIN2+ or VIA positive: ablative treatment (cryotherapy or thermal ablation) if eligible; LEEP/LLETZ if not eligible for ablation. Screen every 5–10 years if HPV negative. Screen HIV-positive women starting age 25 and more frequently (every 3 years). HPV vaccination (9-valent) for girls 9–14 years before sexual debut.",
        "metadata": {"source": "WHO Cervical Cancer Screening Guidelines 2021", "type": "guideline", "clinical_domain": "womens_health", "target_population": "women", "page": 1}
    },
    {
        "text": "Eclampsia — Convulsions in Pregnancy: First line: IV magnesium sulphate 4g loading over 5–10 min + 1g/h maintenance infusion (not diazepam or phenytoin). Recurrent convulsions: additional bolus 2–4g MgSO4 IV over 5 min. MgSO4 toxicity: loss of deep tendon reflexes (early), respiratory depression (late). Antidote: calcium gluconate 1g IV. Monitor: RR >12/min, UO >25mL/h, DTRs present before each dose. Control BP: IV hydralazine or labetalol. Delivery of fetus is definitive treatment — plan within 12h regardless of gestation.",
        "metadata": {"source": "WHO Recommendations for Prevention and Treatment of Eclampsia 2011", "type": "guideline", "clinical_domain": "obstetrics", "target_population": "pregnant_women", "page": 3}
    },

    # ── ANTIMICROBIAL STEWARDSHIP ─────────────────────────────────────────────────
    {
        "text": "Antimicrobial Stewardship Core Principles (WHO AWaRe): Classify antibiotics as ACCESS (broad indication, low resistance risk — amoxicillin, metronidazole, doxycycline), WATCH (higher resistance potential — fluoroquinolones, carbapenems, 3rd-gen cephalosporins), or RESERVE (last resort — colistin, linezolid, ceftazidime-avibactam). Target: ≥60% of antibiotic consumption from ACCESS group. Review and de-escalate within 48–72h. Stop antibiotics when clinical criteria met. Send cultures before antibiotics where possible. IV-to-oral switch when patient improving and tolerating oral.",
        "metadata": {"source": "WHO AWaRe Classification 2021 / WHO AMS Toolkit 2019", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "general", "page": 3}
    },
    {
        "text": "Clostridioides difficile (C. diff) Infection: Suspect if ≥3 loose stools/day in hospitalised patient on antibiotics or within 8 weeks of discharge. Diagnosis: stool GDH + toxin ELISA or PCR. Stop causative antibiotic if possible. Mild-moderate (WBC <15, creatinine <1.5× baseline): metronidazole 400mg PO TDS × 10 days. Severe (WBC >15 or creatinine >1.5×): oral vancomycin 125mg q6h × 10 days. Fulminant (hypotension, ileus): oral vancomycin 500mg q6h + IV metronidazole + surgical review. First recurrence: fidaxomicin 200mg BD × 10 days (superior to vancomycin for recurrence prevention). Contact precautions, soap and water hand hygiene (alcohol gel ineffective).",
        "metadata": {"source": "IDSA/SHEA C. difficile Guidelines 2018 / ESCMID 2021", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "adults", "page": 4}
    },
    {
        "text": "Tuberculosis Treatment (WHO 2022): Drug-sensitive TB: 2 months HRZE (isoniazid + rifampicin + pyrazinamide + ethambutol) then 4 months HR. Never add single drug to failing regimen. Monitor: LFTs monthly (stop if ALT >5× ULN), vision (ethambutol — stop if changes), uric acid (pyrazinamide). Pyridoxine 25mg OD with isoniazid to prevent neuropathy. Drug-resistant TB (MDR-TB): 6-month all-oral BPaL regimen (bedaquiline + pretomanid + linezolid). TB/HIV co-infection: start ART within 2–8 weeks of TB treatment (delay if TB meningitis). DOT (directly observed therapy) for all patients.",
        "metadata": {"source": "WHO TB Treatment Guidelines 2022 / ZeNix Trial 2021", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "adults", "page": 5}
    },

    # ── GERIATRICS ───────────────────────────────────────────────────────────────
    {
        "text": "Delirium Prevention and Management in Elderly: Non-pharmacological prevention bundle (HELP protocol): reorientation (clock, calendar, familiar faces), early mobilisation, sleep hygiene (avoid night-time interruptions, reduce noise), correct sensory impairment (glasses, hearing aids), hydration, avoid constipation, limit sedative medications. Screen with 4AT or CAM daily. Treat underlying cause (infection, pain, urinary retention, constipation, medications). Avoid antipsychotics unless severe agitation posing safety risk — if required: haloperidol 0.25–0.5mg PO/IV (avoid in DLB/PD). Avoid benzodiazepines (worsen delirium except for alcohol withdrawal).",
        "metadata": {"source": "NICE NG193 Delirium 2010 (updated 2023) / SIGN 157 Delirium 2019", "type": "guideline", "clinical_domain": "geriatrics", "target_population": "elderly", "page": 1}
    },
    {
        "text": "Falls Prevention in Hospitalised Elderly: Multifactorial risk assessment at admission: mobility (timed up and go test), cognition, medications (sedatives, antihypertensives, diuretics — deprescribe where possible), vision, footwear, environment. Interventions: bed alarm for confused patients, non-slip footwear, adequate lighting, call bell within reach, hourly toileting rounds for incontinent patients. Post-fall: full clinical assessment (exclude hip fracture — check for hip pain, leg shortening/rotation; X-ray if suspected). Complete incident report. Consider hip protectors for recurrent fallers.",
        "metadata": {"source": "NICE CG161 Falls in Older People 2013 (updated 2019) / WHO Falls Prevention 2021", "type": "guideline", "clinical_domain": "geriatrics", "target_population": "elderly", "page": 2}
    },

    # ── PALLIATIVE CARE ──────────────────────────────────────────────────────────
    {
        "text": "Palliative Symptom Control — Last Days of Life: Discontinue unnecessary medications (statins, antihypertensives, preventive meds). Subcutaneous syringe driver: morphine for pain/dyspnoea (starting dose 2.5–5mg/24h SC if opioid naive, or convert from oral at 1/3 ratio), midazolam 10–20mg/24h for anxiety/agitation, haloperidol 3–5mg/24h for nausea/delirium, hyoscine butylbromide 20–40mg/24h for respiratory secretions. PRN doses: 1/6 of 24h dose. Mouth care q2–4h. Pressure area care. Discontinue routine monitoring (BGL, vitals). Clear communication with family.",
        "metadata": {"source": "NICE NG31 Care of Dying Adults 2015 / RCGP Palliative Care Toolkit 2019", "type": "guideline", "clinical_domain": "palliative_care", "target_population": "adults", "page": 2}
    },

    # ── ASTHMA ──────────────────────────────────────────────────────────────────
    {
        "text": "Asthma: Acute Severe Attack Management (GINA 2023): Administer oxygen to maintain SpO2 94–98%. Salbutamol (albuterol) 2.5–5mg via nebuliser or 4–8 puffs via spacer every 20 minutes for first hour. Prednisolone 40–50mg oral or IV hydrocortisone 100mg if unable to swallow. Add ipratropium bromide 0.5mg nebulised if severe. Reassess every 15–30 minutes. Indicators of life-threatening attack: SpO2 <92%, silent chest, cyanosis, PEFR <33% predicted. Transfer to ICU if no improvement after 1 hour.",
        "metadata": {"source": "GINA Asthma Guidelines 2023", "type": "guideline", "clinical_domain": "respiratory", "target_population": "adults", "page": 1}
    },
    {
        "text": "Asthma: Step-Up Treatment Algorithm (GINA 2023): Step 1 (intermittent): PRN low-dose ICS-formoterol or PRN SABA. Step 2 (mild persistent): low-dose ICS daily (beclomethasone 200–500mcg/day or equivalent) + PRN SABA. Step 3 (moderate): low-dose ICS-LABA or medium-dose ICS. Step 4 (severe): medium-dose ICS-LABA. Step 5: high-dose ICS-LABA + tiotropium or anti-IL5/IL4 biologics. Review every 3 months. Step down if well-controlled ≥3 months.",
        "metadata": {"source": "GINA Asthma Guidelines 2023", "type": "guideline", "clinical_domain": "respiratory", "target_population": "adults", "page": 2}
    },
    {
        "text": "Paediatric Asthma Acute Attack: Mild-moderate: salbutamol 2.5mg (<5y) or 5mg (≥5y) nebulised or 2–6 puffs MDI+spacer q20min × 3, then q1–4h. Oral prednisolone 1–2 mg/kg (max 40mg). Severe: continuous nebulised salbutamol + IV magnesium sulphate 40mg/kg (max 2g) over 20 minutes. Humidified oxygen. SpO2 target ≥94%. Consider ICU transfer if no response. Life-threatening signs: silent chest, cyanosis, poor respiratory effort, altered consciousness.",
        "metadata": {"source": "GINA Paediatric Asthma 2023 / BTS/SIGN Asthma Guideline 2023", "type": "guideline", "clinical_domain": "respiratory", "target_population": "paediatrics", "page": 3}
    },

    # ── COPD ─────────────────────────────────────────────────────────────────────
    {
        "text": "COPD Exacerbation Management (GOLD 2023): Controlled oxygen therapy to SpO2 88–92% (avoid hyperoxia — risk of hypercapnic respiratory failure). Short-acting bronchodilators: salbutamol 2.5mg + ipratropium 0.5mg nebulised q4–6h. Systemic corticosteroids: prednisolone 40mg for 5 days. Antibiotics if purulent sputum/increased production/dyspnoea (amoxicillin 500mg TDS or doxycycline 100mg BD × 5 days). NIV (BiPAP) for pH <7.35 and PaCO2 >6kPa. Avoid opioids and benzodiazepines.",
        "metadata": {"source": "GOLD COPD Guidelines 2023", "type": "guideline", "clinical_domain": "respiratory", "target_population": "adults", "page": 1}
    },
    {
        "text": "COPD Stable Management (GOLD 2023): All patients: smoking cessation, influenza + pneumococcal vaccination, pulmonary rehabilitation. Group A (few symptoms, low exacerbation risk): SABA or SAMA PRN. Group B (more symptoms): LAMA (tiotropium 18mcg inhaled OD) or LABA. Group C/D (high exacerbation risk): LAMA + LABA; add ICS if asthma overlap or eosinophils >300/μL. LTOT if PaO2 <7.3kPa at rest. Target: reduce exacerbations, improve QOL.",
        "metadata": {"source": "GOLD COPD Guidelines 2023", "type": "guideline", "clinical_domain": "respiratory", "target_population": "adults", "page": 2}
    },

    # ── MENTAL HEALTH ────────────────────────────────────────────────────────────
    {
        "text": "mhGAP Depression Assessment and Treatment (WHO 2016): Screen with PHQ-2: 'In past 2 weeks, how often felt down/hopeless or little interest in activities?' (0–3 each; ≥3 → full PHQ-9). PHQ-9 ≥10 = moderate-severe depression. Treatment: mild-moderate → psychosocial support, problem-solving therapy, behavioural activation. Moderate-severe → antidepressant + psychotherapy. First-line: fluoxetine 20mg OD (titrate to 40mg after 4 weeks if needed). Duration: minimum 6 months after remission; 2 years if recurrent. Monitor suicide risk at every visit.",
        "metadata": {"source": "WHO mhGAP Intervention Guide v2 2016", "type": "guideline", "clinical_domain": "mental_health", "target_population": "adults", "page": 1}
    },
    {
        "text": "mhGAP Psychosis Assessment and Treatment (WHO 2016): Assess for first-episode psychosis if: hearing voices, fixed false beliefs, disorganised behaviour, social withdrawal >1 month. Exclude organic causes (delirium, substance, HIV encephalopathy, neurological). First-line antipsychotic: haloperidol 2–5mg OD–BD (titrate by 2.5mg every 3–7 days; max 20mg/day) or risperidone 2mg BD. Acute agitation: haloperidol 5–10mg IM. Clozapine for treatment-refractory cases only (WBC monitoring mandatory). Involve family. Psychosocial rehabilitation.",
        "metadata": {"source": "WHO mhGAP Intervention Guide v2 2016", "type": "guideline", "clinical_domain": "mental_health", "target_population": "adults", "page": 2}
    },
    {
        "text": "Suicide Risk Assessment and Management (WHO/IASP): Immediate risk factors: specific plan, means available, previous attempt, hopelessness, recent loss, substance use. High risk: hospitalise, remove means, 1:1 supervision. Medium risk: intensive outpatient follow-up within 24–48h, family support, safety planning. Low risk: follow-up within 1–2 weeks, psychoeducation. All patients: ask directly about suicidal thoughts (does not increase risk). Document risk assessment. Activate crisis support. Emergency contacts: family member or trusted person.",
        "metadata": {"source": "WHO LIVE LIFE Suicide Prevention Implementation Guide 2021", "type": "guideline", "clinical_domain": "mental_health", "target_population": "adults", "page": 3}
    },
    {
        "text": "Alcohol Use Disorder (WHO mhGAP 2016): AUDIT-C screen: ≥3 (women) or ≥4 (men) → brief intervention. Brief intervention (FRAMES): Feedback, Responsibility, Advice, Menu of options, Empathic style, Self-efficacy. Alcohol withdrawal: CIWA-Ar score; mild (<8): oral diazepam 10mg q4–6h, taper over 5–7 days; severe (>15): IV diazepam, thiamine 200mg IV before glucose, ICU monitoring. Delirium tremens: diazepam 10–20mg IV titrated, phenobarbitone if refractory. Maintenance: naltrexone 50mg OD or acamprosate for relapse prevention.",
        "metadata": {"source": "WHO mhGAP Intervention Guide v2 2016", "type": "guideline", "clinical_domain": "mental_health", "target_population": "adults", "page": 4}
    },

    # ── RENAL DISEASE ────────────────────────────────────────────────────────────
    {
        "text": "Acute Kidney Injury (KDIGO 2012): Stage 1: creatinine ×1.5–1.9 baseline or rise ≥26.5 μmol/L within 48h or UO <0.5mL/kg/h for 6–12h. Stage 2: creatinine ×2.0–2.9 or UO <0.5mL/kg/h ≥12h. Stage 3: creatinine ×3.0+, or creatinine ≥354 μmol/L, or UO <0.3mL/kg/h ≥24h, or anuria ≥12h, or need for RRT. Management: identify and treat cause. IV fluid resuscitation for pre-renal (250mL bolus + reassess). Avoid nephrotoxins (NSAIDs, aminoglycosides, contrast). Correct hyperkalaemia. RRT indications: K+ >6.5, pH <7.15, fluid overload, uremic encephalopathy/pericarditis.",
        "metadata": {"source": "KDIGO AKI Clinical Practice Guideline 2012", "type": "guideline", "clinical_domain": "nephrology", "target_population": "adults", "page": 1}
    },
    {
        "text": "CKD Management (KDIGO 2024): eGFR classification: G1 ≥90, G2 60–89, G3a 45–59, G3b 30–44, G4 15–29, G5 <15 mL/min/1.73m². Albuminuria categories: A1 <30, A2 30–300, A3 >300 mg/g. BP target: <120/80 if tolerated. ACEi/ARB for proteinuria. SGLT-2 inhibitor (dapagliflozin) if eGFR >25 — reduces CKD progression. Dietary: restrict potassium if hyperkalaemia; restrict phosphate. Monitor: eGFR, urine ACR, BP, Hb, calcium, phosphate, PTH 3–12 monthly. Refer nephrology: eGFR <30, rapid decline (>5/year), uncontrolled proteinuria, suspected GN.",
        "metadata": {"source": "KDIGO CKD Guidelines 2024", "type": "guideline", "clinical_domain": "nephrology", "target_population": "adults", "page": 2}
    },
    {
        "text": "Hyperkalaemia Emergency Management: K+ >6.0 mmol/L with ECG changes (peaked T waves, wide QRS, sine wave) = cardiac emergency. Calcium gluconate 10mL of 10% IV over 2 minutes — stabilises cardiac membrane (does not lower K+). Insulin-glucose: 10 units actrapid + 50mL 50% glucose IV — lowers K+ by 0.5–1.5 mmol/L within 15–30 min. Salbutamol 10–20mg nebulised — lowers K+ 0.5–1.0 mmol/L. Sodium bicarbonate 50–100mmol IV if acidosis. Calcium resonium for non-emergency. Dialysis if all measures fail or K+ >7.0 mmol/L.",
        "metadata": {"source": "KDIGO AKI Guideline 2012 / UK Renal Association Hyperkalaemia Guidelines 2020", "type": "guideline", "clinical_domain": "nephrology", "target_population": "adults", "page": 3}
    },

    # ── SNAKE BITE & TOXICOLOGY ──────────────────────────────────────────────────
    {
        "text": "Snake Bite Management — Africa (WHO 2022): Immediate: immobilise bitten limb at heart level, remove constricting items, keep patient calm. Do NOT: incise, suck, tourniquet, apply ice, give alcohol. Assess envenomation signs: local (swelling, necrosis, ecchymosis) and systemic (coagulopathy, neurotoxicity, rhabdomyolysis). Coagulopathy: 20WBCT (20-minute whole blood clotting test) at presentation, 6h, 12h. Antivenom indications: systemic envenomation (coagulopathy, neurotoxicity, haemolysis, AKI) OR significant local envenomation with rapid swelling >50% limb. Antivenom dose: African polyvalent antivenom per manufacturer.",
        "metadata": {"source": "WHO Guidelines for Management of Snake-Bites Africa 2nd Ed 2022", "type": "guideline", "clinical_domain": "emergency", "target_population": "adults", "page": 1}
    },
    {
        "text": "Snake Bite Antivenom Administration: Dilute antivenom in 250–500mL 0.9% NaCl. Administer IV slowly initially (adrenaline available for anaphylaxis). Repeat antivenom if coagulopathy persists at 6 hours (20WBCT still positive). Supportive: IV fluids for rhabdomyolysis (target UO >0.5mL/kg/h), dialysis for AKI, ventilation for neurotoxic paralysis (atropine + neostigmine for post-synaptic neurotoxins). Wound care: debride necrosis, elevate limb. Tetanus prophylaxis. Observe minimum 24h after antivenom. Paediatric dose: same as adults (antivenom dose is for the venom, not body weight).",
        "metadata": {"source": "WHO Guidelines for Management of Snake-Bites Africa 2nd Ed 2022", "type": "guideline", "clinical_domain": "emergency", "target_population": "adults", "page": 2}
    },
    {
        "text": "Organophosphate Poisoning Management: Clinical features: DUMBELS (Diarrhoea, Urination, Miosis, Bradycardia/Bronchospasm/secretions, Emesis, Lacrimation, Salivation) + weakness/paralysis. Muscarinic features respond to atropine; nicotinic (weakness) do not. Treatment: Atropine 2mg IV (paediatric: 0.02–0.05mg/kg) every 5–10 min until secretions dry (NOT heart rate). Large doses may be needed (sometimes hundreds of mg). Oximes (pralidoxime 1–2g IV over 15–30 min then infusion) — effective if given within 24–48h before ageing. Benzodiazepines for seizures. Airway management priority. Avoid morphine, aminophylline, succinylcholine.",
        "metadata": {"source": "WHO Pesticide Poisoning Management Guidelines 2020", "type": "guideline", "clinical_domain": "emergency", "target_population": "adults", "page": 1}
    },

    # ── SEVERE ACUTE MALNUTRITION ────────────────────────────────────────────────
    {
        "text": "Severe Acute Malnutrition (SAM) Diagnosis and Triage (WHO 2013): SAM in children 6–59 months: MUAC <115mm OR WHZ <-3 SD OR bilateral pitting oedema. Medical complications requiring inpatient care: anorexia (failed appetite test), danger signs (lethargy, unconscious, convulsions, vomiting everything, high fever), severe bilateral oedema, IMCI general danger signs. Uncomplicated SAM: community-based management with RUTF (ready-to-use therapeutic food). Appetite test: offer child a standard sachet of RUTF in quiet, private area for 30 minutes.",
        "metadata": {"source": "WHO SAM Management Guidelines 2013", "type": "guideline", "clinical_domain": "nutrition", "target_population": "paediatrics", "page": 1}
    },
    {
        "text": "SAM Inpatient Management — Stabilisation Phase (WHO 2013): Phase 1 (Days 1–7): Treat/prevent: hypoglycaemia (F-75 formula or breastfeed q2–3h), hypothermia, dehydration (ReSoMal ORS 5mL/kg q30min × 2h only if clinically dehydrated — NOT standard ORS), infection (routine antibiotics: amoxicillin + gentamicin for uncomplicated; add Gram-negative cover for very sick), electrolyte correction (K+ and Mg2+ supplements), micronutrients (no iron in Phase 1). F-75 formula: 100mL/kg/day in 8 feeds. Transition to Phase 2 when oedema reduces, appetite returns (usually Day 3–7).",
        "metadata": {"source": "WHO SAM Management Guidelines 2013", "type": "guideline", "clinical_domain": "nutrition", "target_population": "paediatrics", "page": 2}
    },
    {
        "text": "SAM Rehabilitation Phase and RUTF Dosing (WHO 2013): Phase 2 (from Day 7–14+ until discharge): Switch to F-100 or RUTF. RUTF target: 200kcal/kg/day. RUTF daily dosing by weight band: 3.5–4kg → 2 sachets/day; 4–5.4kg → 2.5; 5.5–6.9kg → 3; 7–8.4kg → 3.5; 8.5–9.4kg → 4. Continue for 4–6 weeks minimum. Discharge criteria: no oedema, MUAC ≥125mm or WHZ ≥-2 SD, no acute illness, adequate appetite, caregiver education complete. Micronutrients: vitamin A on admission, iron from Phase 2 (2–3mg/kg/day), zinc, folic acid. Follow-up at 1 and 2 weeks post-discharge.",
        "metadata": {"source": "WHO SAM Management Guidelines 2013 / UNICEF CMAM Guide", "type": "guideline", "clinical_domain": "nutrition", "target_population": "paediatrics", "page": 3}
    },

    # ── NEGLECTED TROPICAL DISEASES ──────────────────────────────────────────────
    {
        "text": "Schistosomiasis Treatment and Control (WHO 2022): Treatment: praziquantel 40mg/kg as single oral dose (or 2 × 20mg/kg 4–6h apart). All school-age children and adults in endemic areas. Contraindication: pregnancy (avoid in first trimester if possible; treatment preferable in 2nd/3rd trimester if heavy infection). Mass Drug Administration (MDA): annual in high-prevalence areas (>50% prevalence or ≥400 eggs/10mL urine), biennial if 10–50%. Side effects: headache, nausea, abdominal pain — usually mild and transient. Hepatosplenic schistosomiasis (late): refer for ultrasound and specialist care.",
        "metadata": {"source": "WHO Schistosomiasis Control Guidelines 2022", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "general", "page": 1}
    },
    {
        "text": "Soil-Transmitted Helminthiasis (STH) Control (WHO 2023): Species: roundworm (Ascaris), whipworm (Trichuris), hookworm (Necator/Ancylostoma). MDA drugs: albendazole 400mg single dose (all ages ≥1 year) OR mebendazole 500mg single dose. Frequency: ≥20% prevalence → annual MDA; ≥50% → biennial MDA. Target groups: preschool children, school-age children, women of reproductive age. Iron deficiency anaemia: hookworm — ensure iron supplementation alongside MDA. Hydatid disease (Echinococcus): surgery is primary treatment; albendazole 400mg BD × 1–6 months as adjunct or for inoperable cases.",
        "metadata": {"source": "WHO STH Control Guidelines 2023", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "general", "page": 1}
    },

    # ── GENDER-BASED VIOLENCE ────────────────────────────────────────────────────
    {
        "text": "Sexual Violence — Clinical Management (WHO 2013): Within 72 hours: emergency contraception (levonorgestrel 1.5mg single dose or ulipristal within 5 days). HIV post-exposure prophylaxis: tenofovir + lamivudine + lopinavir/ritonavir (or TDF/3TC/EFV) for 28 days — start within 72 hours (more effective within 24h). STI prophylaxis: cefixime 400mg + azithromycin 1g + metronidazole 2g single doses. Hep B vaccination if not immune. Hepatitis B Ig within 72 hours if high-risk exposure and unvaccinated. Tetanus toxoid. Wound care. Safety planning and counselling. Document with informed consent.",
        "metadata": {"source": "WHO Clinical Guidelines Sexual Violence 2013 / WHO PEP Guide 2021", "type": "guideline", "clinical_domain": "emergency", "target_population": "adults", "page": 1}
    },
    {
        "text": "Intimate Partner Violence (IPV) — Clinical Response (WHO 2013): Universal precautions approach — maintain privacy and confidentiality. Safe enquiry: 'Many patients experience violence at home. Is that happening to you?' Validate disclosure: 'This is not your fault. You are not alone.' Safety assessment: current danger, children at risk, escalating violence. Offer support: document injuries, provide information on local shelters/legal aid, safety planning. Mandatory reporting: only if required by law for minors or immediate life-threatening danger. Follow-up: regular appointments. Do NOT pressure disclosure or confront partner. Coordinate with social services.",
        "metadata": {"source": "WHO IPV Clinical Guidelines 2013", "type": "guideline", "clinical_domain": "mental_health", "target_population": "adults", "page": 1}
    },

    # ── ONCOLOGY (RESOURCE-LIMITED SETTINGS) ─────────────────────────────────────
    {
        "text": "Cervical Cancer: Screening and Prevention (WHO 2021): HPV vaccination: girls 9–14 years, 2-dose schedule (0 and 6 months). Screening: preferred HPV DNA test (5-year interval if negative); if unavailable, VIA (visual inspection with acetic acid) every 3 years. Treat-all approach for screen-and-treat: if VIA+, cryotherapy or thermocoagulation for eligible lesions (ectocervical, <75% coverage, no glandular involvement). Refer for LEEP/cone biopsy or colposcopy if VIA+ and not eligible for ablation. Invasive cancer: staging clinical (FIGO), refer for radiotherapy/chemotherapy. Palliative care if advanced.",
        "metadata": {"source": "WHO Cervical Cancer Guidelines 2021", "type": "guideline", "clinical_domain": "oncology", "target_population": "adults", "page": 1}
    },
    {
        "text": "Breast Cancer — Clinical Management in Resource-Limited Settings (WHO 2020): Diagnosis: clinical breast exam, ultrasound (preferred for <40y), mammography (40y+), fine needle aspiration cytology or core biopsy. Staging: chest X-ray, abdominal ultrasound, bone scan if symptomatic. Surgery: modified radical mastectomy (if breast-conserving not available) or BCS + sentinel node/axillary clearance. Systemic therapy: tamoxifen 20mg OD × 5 years for ER+. Chemotherapy: AC × 4 then paclitaxel × 4 for node-positive. Radiotherapy after BCS. Palliative: bisphosphonates for bone mets. Pathological complete response after neoadjuvant = better prognosis.",
        "metadata": {"source": "WHO Cancer Control Programmes / NCCN Guidelines Developing Nations 2021", "type": "guideline", "clinical_domain": "oncology", "target_population": "adults", "page": 2}
    },

    # ── TUBERCULOSIS (SADC-SPECIFIC) ──────────────────────────────────────────────
    {
        "text": "TB Treatment — Standard Regimens (WHO 2022 / SADC): New drug-susceptible TB: 2HRZE/4HR (isoniazid + rifampicin + pyrazinamide + ethambutol × 2 months intensive, then isoniazid + rifampicin × 4 months). Weight-based dosing: H 5mg/kg (max 300mg), R 10mg/kg (max 600mg), Z 25mg/kg, E 15mg/kg. Pyridoxine 25mg OD with isoniazid to prevent peripheral neuropathy (especially PLHIV). DOT (directly observed therapy) strongly recommended. Smear positive patients: isolate for 2 weeks of treatment. Contact tracing for all new smear-positive cases.",
        "metadata": {"source": "WHO TB Treatment Guidelines 2022 / Zimbabwe National TB Programme", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "adults", "page": 1}
    },
    {
        "text": "Drug-Resistant TB (DR-TB) Management (WHO 2022): Rifampicin-resistant TB (RR-TB)/MDR-TB: shorter regimen (6BdqPaLfxCfzZ): bedaquiline + pretomanid + linezolid + levofloxacin + clofazimine + pyrazinamide × 6 months (if no fluoroquinolone/linezolid resistance). Or longer regimen 18–20 months. Bedaquiline 400mg OD × 2 weeks then 200mg TIW × 22 weeks. ECG monitoring (QTc). Linezolid: baseline CBC, monitor for myelosuppression and neuropathy. XDR-TB: bedaquiline + pretomanid + linezolid (BPaL regimen) × 6–9 months. All DR-TB must be notified and managed by specialist team.",
        "metadata": {"source": "WHO DR-TB Treatment Guidelines 2022", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "adults", "page": 2}
    },
    {
        "text": "TB/HIV Co-management (Zimbabwe/SADC Guidelines): Start TB treatment first, then ART within 2–8 weeks (earlier for CD4 <50). Exception: TB meningitis — delay ART 8 weeks (risk of IRIS). Preferred ART with rifampicin: efavirenz-based regimen (TDF/3TC/EFV) — rifampicin induces CYP3A4 but EFV dose unchanged at 600mg. Cotrimoxazole prophylaxis: all TB/HIV patients regardless of CD4 count. IPT (isoniazid preventive therapy): all PLHIV without active TB — isoniazid 300mg + pyridoxine 25mg OD × 6 months. Screen for TB at every HIV visit using WHO 4-symptom screen.",
        "metadata": {"source": "Zimbabwe National HIV & TB Clinical Guidelines 2023", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "adults", "page": 3}
    },
]


def seed(progress_callback=None, rag=None):
    """
    Seed ChromaDB with all guideline chunks.
    progress_callback(seeded: int, total: int, label: str) is called after each chunk is added.
    Pass an already-initialised RAGEngine via `rag` to avoid a cold BM25 rebuild on startup.
    """
    total = len(GUIDELINES)
    print(f"🌱 Seeding ChromaDB with {total} evidence-based guideline chunks...")
    if rag is None:
        rag = RAGEngine()

    for i, g in enumerate(GUIDELINES):
        # rebuild_bm25=False — avoid O(n²) rebuilds on every chunk;
        # single rebuild happens once after all chunks are added below.
        rag.add_documents([g["text"]], metadatas=[g["metadata"]], ids=[f"seed-{i:03d}"], upsert=True, rebuild_bm25=False)
        label = g["metadata"].get("source", "")[:50]
        if progress_callback:
            progress_callback(i + 1, total, label)

    # Single BM25 rebuild after all chunks are in
    if rag.collection:
        try:
            rag._build_bm25_index()
        except Exception as e:
            print(f"⚠️  BM25 rebuild failed (non-fatal): {e}")

    count = rag.collection.count() if rag.collection else 0
    print(f"✅ Done. ChromaDB now contains {count} documents.")
    return {"seeded": total, "total": count}


if __name__ == "__main__":
    result = seed(progress_callback=lambda s, t, l: print(f"  [{s}/{t}] {l}"))
    print(result)
