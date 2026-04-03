# WHO Smart Guidelines — PDF Placement Guide

All PDFs in this directory are excluded from git (`.gitignore`). Copy files here locally, then trigger ingestion.

## Folder Structure

```
who-smart-guidelines/
├── infectious-disease/   HIV, TB, Malaria, STI, Hepatitis, Cholera, Dengue, Typhoid
├── cardiology/           Hypertension, Heart Failure, CVD risk, Lipids, Stroke
├── obstetrics/           ANC, Labour & Delivery, Postpartum, Eclampsia, Safe Abortion
├── pediatrics/           IMCI, Neonatal care, Child growth, Immunization, EPI
├── endocrinology/        Diabetes, Thyroid, Obesity, Metabolic Syndrome
├── mental-health/        mhGAP, Depression, Psychosis, Substance Use, Dementia
├── nutrition/            Malnutrition, SAM/MAM, CMAM, Breastfeeding, Micronutrients
├── respiratory/          Asthma, COPD, Pneumonia, Oxygen Therapy
├── oncology/             Cancer (Cervical, Breast, Palliative Care)
├── surgery/              Surgical Safety, Perioperative, Anaesthesia, Wound Care
├── emergency/            Emergency Triage, Trauma, Resuscitation, Critical Care
├── reproductive-health/  Family Planning, Contraception, Sexual Health, GBV
├── neurology/            Epilepsy, Meningitis, Seizure, Neuropathy
├── ophthalmology/        Eye Care, Trachoma, Cataract, Glaucoma
├── dermatology/          Skin, Burns, Ulcers, Leprosy, Scabies
└── nephrology/           Renal Disease, CKD, Dialysis
```

## How to Ingest

1. **Copy PDFs into the matching subfolder** (or root if unsure — domain is auto-detected from text)
2. **Restart the CDSS container** (auto-seed runs if collection is empty)
   ```bash
   docker compose restart cdss-service
   ```
3. **Or trigger ingestion via API** (collection not empty → manual trigger needed):
   ```bash
   curl -X POST http://localhost:8000/admin/ingest
   ```

## Notes

- Ingestion is **additive/upsert** — re-ingesting the same PDF is safe and idempotent.
- Domain is auto-classified from PDF text content if filename is not descriptive (e.g., ISBN-named WHO PDFs).
- The `dak/` subfolder contains SMART Guidelines DAK packages — already excluded from git.
