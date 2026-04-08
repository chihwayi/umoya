#!/usr/bin/env python3
"""
One-shot script: classify each PDF in the who-smart-guidelines root and move
it to the appropriate domain subfolder.

Domain → folder mapping:
  infectious_disease  → infectious-disease
  mental_health       → mental-health
  reproductive_health → reproductive-health
  general             → general
  <all others>        → same name as domain (cardiology, obstetrics, etc.)
"""

import os
import shutil
import sys

GUIDELINES_DIR = os.path.join(os.path.dirname(__file__), "who-smart-guidelines")

DOMAIN_TO_FOLDER = {
    "infectious_disease": "infectious-disease",
    "mental_health": "mental-health",
    "reproductive_health": "reproductive-health",
    "cardiology": "cardiology",
    "obstetrics": "obstetrics",
    "pediatrics": "pediatrics",
    "endocrinology": "endocrinology",
    "oncology": "oncology",
    "respiratory": "respiratory",
    "nutrition": "nutrition",
    "surgery": "surgery",
    "nephrology": "nephrology",
    "neurology": "neurology",
    "ophthalmology": "ophthalmology",
    "dermatology": "dermatology",
    "emergency": "emergency",
    "general": "general",
}


def _classify_domain(lower_file: str, lower_text: str) -> str:
    """Mirror of ingest_guidelines._classify_domain."""
    combined = lower_file + " " + lower_text[:500]

    if any(k in combined for k in ["hiv", "aids", "antiretroviral", "art ", "tuberculosis", " tb ", "malaria", "cholera",
                                    "typhoid", "dengue", "ebola", "sti ", "sexually transmitted", "gonorrhoea",
                                    "gonorrhea", "syphilis", "chlamydia", "hepatitis b", "hepatitis c",
                                    "leishmaniasis", "trypanosomiasis", "schistosomiasis", "helminth",
                                    "meningococcal", "pneumococcal", "antifungal", "antimicrobial"]):
        return "infectious_disease"
    if any(k in combined for k in ["hypertension", "cardiac", "cardiovascular", "heart failure", "myocardial",
                                    "coronary", "arrhythmia", "atrial fibrillation", "stroke", "angina",
                                    "dyslipidaemia", "dyslipidemia", "lipid-lowering"]):
        return "cardiology"
    if any(k in combined for k in ["antenatal", "anc ", "maternal", "pregnancy", "pregnant", "postpartum",
                                    "eclampsia", "preeclampsia", "labour", "labor ", "caesarean", "cesarean",
                                    "obstetric", "midwif", "perinatal"]):
        return "obstetrics"
    if any(k in combined for k in ["child", "pediatric", "paediatric", "infant", "neonatal", "neonate",
                                    "newborn", "adolescent", "imci", "growth monitoring", "immunization",
                                    "vaccination", "epi ", "under-five"]):
        return "pediatrics"
    if any(k in combined for k in ["diabetes", "insulin", "glycaemic", "glycemic", "hyperglycaemia",
                                    "hyperglycemia", "thyroid", "hypothyroid", "hyperthyroid", "endocrine",
                                    "obesity", "metabolic syndrome"]):
        return "endocrinology"
    if any(k in combined for k in ["cancer", "oncology", "tumour", "tumor", "chemotherapy", "radiotherapy",
                                    "malignancy", "palliative", "cervical cancer", "breast cancer"]):
        return "oncology"
    if any(k in combined for k in ["asthma", "copd", "respiratory", "pneumonia", "bronchitis", "pulmonary",
                                    "oxygen therapy", "ventilation", "spirometry"]):
        return "respiratory"
    if any(k in combined for k in ["mental health", "psychiatric", "depression", "anxiety", "schizophrenia",
                                    "bipolar", "psychosis", "substance use", "alcohol use", "drug use",
                                    "dementia", "delirium", "mhgap", "mhpss"]):
        return "mental_health"
    if any(k in combined for k in ["nutrition", "malnutrition", "stunting", "wasting", "acute malnutrition",
                                    "breastfeeding", "infant feeding", "cmam", "therapeutic feeding",
                                    "micronutrient", "vitamin a", "zinc supplementation"]):
        return "nutrition"
    if any(k in combined for k in ["surgery", "surgical", "operative", "perioperative", "anaesthesia",
                                    "anesthesia", "wound management", "trauma surgery"]):
        return "surgery"
    if any(k in combined for k in ["kidney", "renal", "dialysis", "nephropathy", "nephrotic", "glomerular",
                                    "chronic kidney"]):
        return "nephrology"
    if any(k in combined for k in ["epilepsy", "seizure", "neurolog", "meningitis", "encephalitis",
                                    "cerebral malaria", "neuropathy", "spinal cord"]):
        return "neurology"
    if any(k in combined for k in ["eye", "ophthalm", "vision", "cataract", "glaucoma", "trachoma",
                                    "blindness", "low vision"]):
        return "ophthalmology"
    if any(k in combined for k in ["skin", "dermatitis", "dermatology", "leprosy", "scabies", "wound",
                                    "burn", "ulcer", "fungal skin"]):
        return "dermatology"
    if any(k in combined for k in ["emergency", "trauma", "resuscitation", "cpr", "acute care",
                                    "triage", "shock", "critical care", "icu ", "first aid"]):
        return "emergency"
    if any(k in combined for k in ["reproductive", "family planning", "contraception", "fertility",
                                    "sexual health", "gender-based violence", "gbv"]):
        return "reproductive_health"
    return "general"


def extract_first_page_text(pdf_path: str) -> str:
    """Extract text from the first page of a PDF for classification."""
    try:
        import pypdf
        with open(pdf_path, "rb") as f:
            reader = pypdf.PdfReader(f)
            if reader.pages:
                return reader.pages[0].extract_text() or ""
    except Exception:
        pass
    # Fallback: try pdfminer
    try:
        from pdfminer.high_level import extract_text_to_fp
        from pdfminer.layout import LAParams
        import io
        buf = io.StringIO()
        with open(pdf_path, "rb") as f:
            extract_text_to_fp(f, buf, laparams=LAParams(), page_numbers=[0])
        return buf.getvalue()
    except Exception:
        pass
    return ""


def main():
    dry_run = "--dry-run" in sys.argv

    pdf_files = [
        f for f in os.listdir(GUIDELINES_DIR)
        if f.lower().endswith(".pdf") and os.path.isfile(os.path.join(GUIDELINES_DIR, f))
    ]

    print(f"Found {len(pdf_files)} PDFs to classify and move.")
    if dry_run:
        print("DRY RUN — no files will be moved.\n")

    # Ensure all destination folders exist
    for folder in set(DOMAIN_TO_FOLDER.values()):
        dest = os.path.join(GUIDELINES_DIR, folder)
        if not os.path.exists(dest):
            os.makedirs(dest, exist_ok=True)
            print(f"  Created folder: {folder}/")

    moved: dict[str, list[str]] = {f: [] for f in DOMAIN_TO_FOLDER.values()}
    errors = []

    for filename in sorted(pdf_files):
        pdf_path = os.path.join(GUIDELINES_DIR, filename)
        lower_file = filename.lower()
        first_page = extract_first_page_text(pdf_path)
        lower_text = first_page.lower()

        domain = _classify_domain(lower_file, lower_text)
        folder = DOMAIN_TO_FOLDER.get(domain, "general")
        dest_dir = os.path.join(GUIDELINES_DIR, folder)
        dest_path = os.path.join(dest_dir, filename)

        print(f"  [{domain:20s}] {filename[:60]}")

        if not dry_run:
            try:
                shutil.move(pdf_path, dest_path)
                moved[folder].append(filename)
            except Exception as e:
                print(f"    ERROR moving {filename}: {e}")
                errors.append(filename)
        else:
            moved[folder].append(filename)

    print("\n--- Summary ---")
    for folder, files in sorted(moved.items()):
        if files:
            print(f"  {folder}/  ({len(files)} files)")

    if errors:
        print(f"\nERRORS ({len(errors)}):")
        for f in errors:
            print(f"  {f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
