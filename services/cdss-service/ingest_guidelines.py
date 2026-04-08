import os
import sys
import glob
import logging
import hashlib
import json
import time
import nltk
from typing import List, Dict, Any, Optional

# Ensure NLTK data is available for unstructured
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('tokenizers/punkt_tab/english')
except LookupError:
    nltk.download('punkt_tab')

try:
    nltk.data.find('taggers/averaged_perceptron_tagger')
except LookupError:
    nltk.download('averaged_perceptron_tagger')

try:
    nltk.data.find('taggers/averaged_perceptron_tagger_eng')
except LookupError:
    nltk.download('averaged_perceptron_tagger_eng')

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_models.rag_engine import RAGEngine

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

GUIDELINES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "who-smart-guidelines")
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

# Manifest tracks SHA256 of every successfully ingested file so re-runs skip
# already-ingested content and crashed runs resume from where they left off.
_MANIFEST_PATH = os.path.join(DATA_DIR, "ingest_manifest.json")
# Progress file is written per-file so the status endpoint can surface live state.
_PROGRESS_PATH = os.path.join(DATA_DIR, "ingest_progress.json")


# ---------------------------------------------------------------------------
# Manifest helpers
# ---------------------------------------------------------------------------

def _load_manifest() -> Dict[str, str]:
    """Returns {filename: sha256} for every file successfully ingested."""
    try:
        with open(_MANIFEST_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_manifest(manifest: Dict[str, str]) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(_MANIFEST_PATH, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, sort_keys=True)


# ---------------------------------------------------------------------------
# Progress helpers
# ---------------------------------------------------------------------------

def _write_progress(progress: Dict[str, Any]) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        with open(_PROGRESS_PATH, "w", encoding="utf-8") as fh:
            json.dump(progress, fh, indent=2)
    except Exception as e:
        logger.warning(f"Could not write progress file: {e}")


# ---------------------------------------------------------------------------
# Metadata quality report
# ---------------------------------------------------------------------------

def _metadata_quality_report(metadatas: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(metadatas or [])
    required_fields = ["source", "page", "type", "target_population", "clinical_domain"]
    if total == 0:
        return {
            "total_chunks": 0,
            "required_fields": required_fields,
            "field_coverage": {field: 0.0 for field in required_fields},
            "unknown_target_population_rate": 0.0,
            "unknown_clinical_domain_rate": 0.0,
        }

    field_counts = {field: 0 for field in required_fields}
    unknown_target_population = 0
    unknown_clinical_domain = 0
    target_population_dist: Dict[str, int] = {}
    clinical_domain_dist: Dict[str, int] = {}

    for meta in metadatas:
        for field in required_fields:
            value = (meta or {}).get(field)
            if value is None:
                continue
            raw = str(value).strip()
            if raw:
                field_counts[field] += 1

        target_population = str((meta or {}).get("target_population") or "").strip().lower()
        clinical_domain = str((meta or {}).get("clinical_domain") or "").strip().lower()
        target_population_dist[target_population or "missing"] = target_population_dist.get(target_population or "missing", 0) + 1
        clinical_domain_dist[clinical_domain or "missing"] = clinical_domain_dist.get(clinical_domain or "missing", 0) + 1

        if target_population in {"", "unknown", "other", "general", "missing"}:
            unknown_target_population += 1
        if clinical_domain in {"", "unknown", "other", "missing"}:
            unknown_clinical_domain += 1

    return {
        "total_chunks": total,
        "required_fields": required_fields,
        "field_coverage": {
            field: round(field_counts[field] / total, 4) for field in required_fields
        },
        "unknown_target_population_rate": round(unknown_target_population / total, 4),
        "unknown_clinical_domain_rate": round(unknown_clinical_domain / total, 4),
        "target_population_distribution": target_population_dist,
        "clinical_domain_distribution": clinical_domain_dist,
    }


def _write_metadata_quality_report(report: Dict[str, Any]) -> str:
    report_path = os.getenv("CDSS_INGEST_METADATA_REPORT_PATH", "").strip()
    if not report_path:
        report_path = os.path.join(DATA_DIR, "ingest_metadata_report.json")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, sort_keys=True)
    print(f"📊 Metadata quality report written: {report_path}")
    return report_path


# ---------------------------------------------------------------------------
# File hashing
# ---------------------------------------------------------------------------

def _sha256_file(file_path: str) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()


# ---------------------------------------------------------------------------
# Domain classifier
# ---------------------------------------------------------------------------

def _classify_domain(lower_file: str, lower_text: str) -> str:
    """Classify clinical domain from filename and text keywords."""
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


# ---------------------------------------------------------------------------
# PDF processing
# ---------------------------------------------------------------------------

def process_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Uses unstructured to partition PDF and chunk by title.
    Returns a list of dicts with 'text' and 'metadata'.
    """
    try:
        import importlib
        mod = importlib.import_module("unstructured.partition.pdf")
        partition_pdf = getattr(mod, "partition_pdf")

        logger.info(f"Partitioning PDF (Layout-Aware): {pdf_path}")

        elements = partition_pdf(
            filename=pdf_path,
            strategy="fast",
            infer_table_structure=False,
            chunking_strategy="by_title",
            max_characters=1500,
            new_after_n_chars=2000,
            combine_text_under_n_chars=500,
            extract_images_in_pdf=False
        )

        processed_chunks = []
        for element in elements:
            text = str(element).strip()
            if len(text) < 50:
                continue

            meta = element.metadata.to_dict() if hasattr(element.metadata, "to_dict") else {}
            page_number = meta.get("page_number", 1)
            filename = os.path.basename(pdf_path)

            lower_text = text.lower()
            lower_file = filename.lower()

            target_pop = "adults"
            if any(k in lower_file or k in lower_text for k in ["anc", "antenatal", "pregnancy", "pregnant", "maternal"]):
                target_pop = "pregnant_women"
            elif any(k in lower_file or k in lower_text for k in ["child", "pediatric", "infant", "adolescent"]):
                target_pop = "children"
            elif "elderly" in lower_text or "geriatric" in lower_text:
                target_pop = "elderly"

            domain = _classify_domain(lower_file, lower_text)

            processed_chunks.append({
                "text": text,
                "metadata": {
                    "source": filename,
                    "page": page_number,
                    "type": "guideline",
                    "target_population": target_pop,
                    "clinical_domain": domain
                }
            })

        return processed_chunks

    except ImportError as e:
        logger.warning(f"⚠️ 'unstructured' library missing: {e}. Falling back to pypdf.")
        return process_pdf_fallback(pdf_path)
    except Exception as e:
        logger.warning(f"Error processing PDF {pdf_path} with unstructured: {e}. Falling back to pypdf.")
        return process_pdf_fallback(pdf_path)


def process_pdf_fallback(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Fallback using pypdf when unstructured is not available.
    Simple text extraction with chunking.
    """
    try:
        from pypdf import PdfReader

        logger.info(f"Processing PDF with fallback (pypdf): {pdf_path}")
        reader = PdfReader(pdf_path)

        processed_chunks = []
        filename = os.path.basename(pdf_path)

        for page_num, page in enumerate(reader.pages):
            text = page.extract_text()
            if not text:
                continue

            raw_chunks = [c.strip() for c in text.split('\n\n') if len(c.strip()) > 50]

            for chunk in raw_chunks:
                lower_text = chunk.lower()
                lower_file = filename.lower()

                target_pop = "adults"
                if any(k in lower_file or k in lower_text for k in ["anc", "antenatal", "pregnancy", "pregnant", "maternal"]):
                    target_pop = "pregnant_women"
                elif any(k in lower_file or k in lower_text for k in ["child", "pediatric", "infant", "adolescent"]):
                    target_pop = "children"
                elif "elderly" in lower_text or "geriatric" in lower_text:
                    target_pop = "elderly"

                domain = _classify_domain(lower_file, lower_text)

                processed_chunks.append({
                    "text": chunk,
                    "metadata": {
                        "source": filename,
                        "page": page_num + 1,
                        "type": "guideline",
                        "target_population": target_pop,
                        "clinical_domain": domain
                    }
                })

        return processed_chunks

    except Exception as e:
        logger.error(f"Fallback processing failed for {pdf_path}: {e}")
        return []


# ---------------------------------------------------------------------------
# Main ingestion entry point
# ---------------------------------------------------------------------------

def ingest_guidelines(rag: Optional[RAGEngine] = None, job_id: Optional[str] = None) -> Dict[str, Any]:
    start_time = time.time()
    print(f"🚀 Starting Knowledge Ingestion from {GUIDELINES_DIR}...")

    rag = rag or RAGEngine()

    if not rag.collection:
        print("❌ RAG Engine not initialized correctly.")
        return {
            "ok": False,
            "message": "RAG engine not initialized",
            "processedFiles": [],
            "totalFiles": 0,
            "totalChunks": 0,
            "collectionCount": 0,
        }

    existing_count = rag.collection.count() if rag.collection else 0
    print(f"📦 Existing ChromaDB documents: {existing_count}. Running additive/upsert ingestion.")

    files = glob.glob(os.path.join(GUIDELINES_DIR, "**", "*.pdf"), recursive=True)

    target_files_env = os.getenv("CDSS_INGEST_TARGET_FILES", "").strip()
    if target_files_env:
        target_files = [name.strip() for name in target_files_env.split(",") if name.strip()]
        filtered_files = [f for f in files if any(t in os.path.basename(f) for t in target_files)]
        if filtered_files:
            print(f"🎯 Targeted ingestion mode enabled. Processing {len(filtered_files)} selected files.")
            files = filtered_files
        else:
            print("⚠️ CDSS_INGEST_TARGET_FILES is set but no matching files were found; ingesting full corpus.")
    else:
        print(f"📚 Full corpus ingestion mode. Processing {len(files)} files.")

    if not files:
        print("❌ No PDF guideline files found.")
        return {
            "ok": False,
            "message": "No guideline PDF files found",
            "processedFiles": [],
            "totalFiles": 0,
            "totalChunks": 0,
            "collectionCount": 0,
        }

    # Load SHA256 manifest — files whose hash matches are skipped (already ingested)
    manifest = _load_manifest()
    total_files = len(files)

    total_chunks = 0
    new_chunks = 0
    skipped_files = 0
    all_metadatas: List[Dict[str, Any]] = []
    processed_files: List[Dict[str, Any]] = []

    max_bytes_raw = os.getenv("CDSS_INGEST_MAX_FILE_BYTES", "0").strip()
    max_file_bytes = int(max_bytes_raw) if max_bytes_raw.isdigit() else 0

    # Write initial progress
    _write_progress({
        "job_id": job_id,
        "status": "running",
        "total_files": total_files,
        "processed_files": 0,
        "skipped_files": 0,
        "total_chunks": 0,
        "current_file": None,
        "started_at": start_time,
        "elapsed_seconds": 0,
    })

    for file_index, file_path in enumerate(files):
        filename = os.path.basename(file_path)
        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

        # Update live progress before processing
        _write_progress({
            "job_id": job_id,
            "status": "running",
            "total_files": total_files,
            "processed_files": file_index,
            "skipped_files": skipped_files,
            "total_chunks": total_chunks,
            "current_file": filename,
            "started_at": start_time,
            "elapsed_seconds": round(time.time() - start_time, 1),
        })

        print(f"📄 [{file_index + 1}/{total_files}] {filename} ({file_size // 1024}KB)...")

        if max_file_bytes > 0 and file_size > max_file_bytes:
            print(f"   ⏭️ Skipping — file exceeds size limit ({file_size} > {max_file_bytes} bytes).")
            processed_files.append({
                "fileName": filename,
                "filePath": file_path,
                "sizeBytes": file_size,
                "sha256": None,
                "chunkCount": 0,
                "pageCount": 0,
                "status": "skipped_too_large",
            })
            skipped_files += 1
            continue

        # SHA256 skip: if hash matches the stored manifest this file is already ingested
        file_sha256 = _sha256_file(file_path) if os.path.exists(file_path) else None
        if file_sha256 and manifest.get(filename) == file_sha256:
            print(f"   ✅ Already ingested (SHA256 match) — skipping.")
            processed_files.append({
                "fileName": filename,
                "filePath": file_path,
                "sizeBytes": file_size,
                "sha256": file_sha256,
                "chunkCount": 0,
                "pageCount": 0,
                "status": "skipped_already_ingested",
            })
            skipped_files += 1
            continue

        chunks = process_pdf_fallback(file_path)

        if not chunks:
            print("   ⚠️ No chunks extracted.")
            processed_files.append({
                "fileName": filename,
                "filePath": file_path,
                "sizeBytes": file_size,
                "sha256": file_sha256,
                "chunkCount": 0,
                "pageCount": 0,
                "status": "skipped_no_chunks",
            })
            continue

        max_chunks_raw = os.getenv("CDSS_INGEST_MAX_CHUNKS_PER_FILE", "0").strip()
        max_chunks = int(max_chunks_raw) if max_chunks_raw.isdigit() else 0
        if max_chunks > 0 and len(chunks) > max_chunks:
            print(f"   ⚠️ Chunk cap enabled. Limiting file to first {max_chunks} chunks.")
            chunks = chunks[:max_chunks]

        texts = [c["text"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]
        all_metadatas.extend(metadatas)
        ids = []

        for c in chunks:
            text_hash = hashlib.md5(c["text"].encode('utf-8')).hexdigest()
            ids.append(f"{c['metadata']['source']}_p{c['metadata']['page']}_{text_hash}")

        # rebuild_bm25=False — BM25 is rebuilt once at the end of the full job
        rag.add_documents(texts, metadatas, ids, upsert=True, rebuild_bm25=False)
        total_chunks += len(chunks)
        new_chunks += len(chunks)
        pages = {str((meta or {}).get("page") or "") for meta in metadatas}
        pages.discard("")
        print(f"   ✅ Added {len(chunks)} chunks. DB total: {rag.collection.count()}")

        # Record this file in the manifest now that it's successfully upserted
        if file_sha256:
            manifest[filename] = file_sha256

        processed_files.append({
            "fileName": filename,
            "filePath": file_path,
            "sizeBytes": file_size,
            "sha256": file_sha256,
            "chunkCount": len(chunks),
            "pageCount": len(pages),
            "status": "completed",
        })

    # Build BM25 once after all files are processed — avoids O(n²) per-file rebuilds
    if new_chunks > 0:
        print("🔧 Building BM25 index (single pass over full corpus)...")
        rag._build_bm25_index()
        print(f"   ✅ BM25 index built.")

    # Persist updated manifest
    _save_manifest(manifest)

    elapsed = round(time.time() - start_time, 1)
    print(f"🎉 Ingestion Complete! New chunks: {new_chunks}, Skipped files: {skipped_files}, Elapsed: {elapsed}s")

    report = _metadata_quality_report(all_metadatas)
    if all_metadatas:
        print(
            "📈 Metadata coverage:",
            json.dumps(
                {
                    "field_coverage": report.get("field_coverage", {}),
                    "unknown_target_population_rate": report.get("unknown_target_population_rate"),
                    "unknown_clinical_domain_rate": report.get("unknown_clinical_domain_rate"),
                },
                sort_keys=True,
            ),
        )
    report_path = _write_metadata_quality_report(report)

    collection_count = rag.collection.count() if rag.collection else total_chunks

    _write_progress({
        "job_id": job_id,
        "status": "completed",
        "total_files": total_files,
        "processed_files": len(processed_files),
        "skipped_files": skipped_files,
        "total_chunks": total_chunks,
        "new_chunks": new_chunks,
        "collection_count": collection_count,
        "current_file": None,
        "started_at": start_time,
        "elapsed_seconds": elapsed,
    })

    return {
        "ok": True,
        "message": "Ingestion completed",
        "processedFiles": processed_files,
        "totalFiles": len(processed_files),
        "totalChunks": total_chunks,
        "newChunks": new_chunks,
        "skippedFiles": skipped_files,
        "collectionCount": collection_count,
        "elapsedSeconds": elapsed,
        "metadataReportPath": report_path,
        "metadataQuality": {
            "unknownTargetPopulationRate": report.get("unknown_target_population_rate"),
            "unknownClinicalDomainRate": report.get("unknown_clinical_domain_rate"),
            "fieldCoverage": report.get("field_coverage", {}),
        },
    }


if __name__ == "__main__":
    ingest_guidelines()
