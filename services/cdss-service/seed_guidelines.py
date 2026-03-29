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

    # ── HIV ─────────────────────────────────────────────────────────────────────
    {
        "text": "HIV Antiretroviral Therapy (ART) — WHO 2021 Preferred Regimens: Adults and adolescents: TDF + 3TC + DTG (tenofovir + lamivudine + dolutegravir) as first-line. Pregnant women: TDF + 3TC + DTG preferred. Children <20kg: ABC + 3TC + DTG. Start ART as soon as possible after diagnosis regardless of CD4 count. Monitor VL at 6 months and 12 months then annually. Target: viral load <1000 copies/mL at 6 months.",
        "metadata": {"source": "WHO Consolidated HIV Guidelines 2021", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "adults", "page": 1}
    },
    {
        "text": "PEP (Post-Exposure Prophylaxis) for HIV: Start within 72 hours of exposure (sooner = better; ineffective after 72h). Preferred regimen: TDF/FTC (Truvada) + RAL (raltegravir 400mg BD) or DTG 50mg OD. Duration: 28 days. Baseline: HIV, HBsAg, renal function, pregnancy test. Follow-up HIV testing at 6 weeks, 3 months. Report occupational exposure within 2 hours.",
        "metadata": {"source": "WHO PEP Guidelines 2014 / WHO Consolidated HIV Guidelines 2021", "type": "guideline", "clinical_domain": "infectious_disease", "target_population": "adults", "page": 2}
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
]


def seed(progress_callback=None):
    """
    Seed ChromaDB with all guideline chunks.
    progress_callback(seeded: int, total: int, label: str) is called after each chunk is added.
    """
    total = len(GUIDELINES)
    print(f"🌱 Seeding ChromaDB with {total} evidence-based guideline chunks...")
    rag = RAGEngine()

    for i, g in enumerate(GUIDELINES):
        rag.add_documents([g["text"]], metadatas=[g["metadata"]], ids=[f"seed-{i:03d}"])
        label = g["metadata"].get("source", "")[:50]
        if progress_callback:
            progress_callback(i + 1, total, label)

    count = rag.collection.count() if rag.collection else 0
    print(f"✅ Done. ChromaDB now contains {count} documents.")
    return {"seeded": total, "total": count}


if __name__ == "__main__":
    result = seed(progress_callback=lambda s, t, l: print(f"  [{s}/{t}] {l}"))
    print(result)
