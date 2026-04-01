import os
import sys
import glob
import logging
import hashlib
import json
import nltk
from typing import List, Dict, Any

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
        report_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "ingest_metadata_report.json")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, sort_keys=True)
    print(f"📊 Metadata quality report written: {report_path}")
    return report_path


def _sha256_file(file_path: str) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()

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
        
        # partition_pdf with "by_title" chunking strategy
        # "hi_res" strategy uses layout analysis to detect tables/images (requires tesseract/poppler)
        # Using "fast" for quicker ingestion during dev/fix
        elements = partition_pdf(
            filename=pdf_path,
            strategy="fast", 
            infer_table_structure=False,
            chunking_strategy="by_title",
            max_characters=1500,        # Slightly larger chunks for medical context
            new_after_n_chars=2000,
            combine_text_under_n_chars=500,
            extract_images_in_pdf=False
        )
        
        processed_chunks = []
        for element in elements:
            text = str(element).strip()
            if len(text) < 50:
                continue
                
            # Basic metadata extraction
            meta = element.metadata.to_dict() if hasattr(element.metadata, "to_dict") else {}
            page_number = meta.get("page_number", 1)
            filename = os.path.basename(pdf_path)
            
            # Heuristic Metadata Tagging (Sprint 1 Quick Win)
            lower_text = text.lower()
            lower_file = filename.lower()
            
            target_pop = "adults" # Default
            if any(k in lower_file or k in lower_text for k in ["anc", "antenatal", "pregnancy", "pregnant", "maternal"]):
                target_pop = "pregnant_women"
            elif any(k in lower_file or k in lower_text for k in ["child", "pediatric", "infant", "adolescent"]):
                target_pop = "children"
            elif "elderly" in lower_text or "geriatric" in lower_text:
                target_pop = "elderly"
                
            domain = "general"
            if "hypertension" in lower_file or "hypertension" in lower_text:
                domain = "cardiology"
            elif "hiv" in lower_file:
                domain = "infectious_disease"
            
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
                
            # Simple chunking by paragraphs
            raw_chunks = [c.strip() for c in text.split('\n\n') if len(c.strip()) > 50]
            
            for chunk in raw_chunks:
                 # Apply same heuristic tagging
                lower_text = chunk.lower()
                lower_file = filename.lower()
                
                target_pop = "adults"
                if any(k in lower_file or k in lower_text for k in ["anc", "antenatal", "pregnancy", "pregnant", "maternal"]):
                    target_pop = "pregnant_women"
                elif any(k in lower_file or k in lower_text for k in ["child", "pediatric", "infant", "adolescent"]):
                    target_pop = "children"
                elif "elderly" in lower_text or "geriatric" in lower_text:
                    target_pop = "elderly"
                    
                domain = "general"
                if "hypertension" in lower_file or "hypertension" in lower_text:
                    domain = "cardiology"
                elif "hiv" in lower_file:
                    domain = "infectious_disease"
                
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

        return []

def ingest_guidelines() -> Dict[str, Any]:
    print(f"🚀 Starting Advanced Knowledge Ingestion (Unstructured) from {GUIDELINES_DIR}...")
    
    rag = RAGEngine()
    
    # Check if RAG engine is ready
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

    # Wipe existing data (Data Hygiene)
    try:
        print("🧹 Wiping existing Vector DB for clean ingestion...")
        rag.chroma_client.delete_collection("medical_guidelines")
        rag.collection = rag.chroma_client.get_or_create_collection("medical_guidelines")
        print("   ✅ Collection wiped and recreated.")
    except Exception as e:
        logger.warning(f"Could not wipe DB (might be empty): {e}")

    files = glob.glob(os.path.join(GUIDELINES_DIR, "**", "*.pdf"), recursive=True)

    # Full corpus is the default behavior. Targeted ingest is explicit opt-in.
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

    total_chunks = 0
    all_metadatas: List[Dict[str, Any]] = []
    processed_files: List[Dict[str, Any]] = []
    
    for file_path in files:
        print(f"📄 Processing {os.path.basename(file_path)}...")
        
        # Use fallback for speed
        chunks = process_pdf_fallback(file_path)
        
        if not chunks:
            print("   ⚠️ No chunks extracted.")
            processed_files.append({
                "fileName": os.path.basename(file_path),
                "filePath": file_path,
                "sizeBytes": os.path.getsize(file_path) if os.path.exists(file_path) else 0,
                "sha256": _sha256_file(file_path) if os.path.exists(file_path) else None,
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
        
        # Generate stable IDs
        for c in chunks:
            # Create a deterministic hash of the text
            text_hash = hashlib.md5(c["text"].encode('utf-8')).hexdigest()
            # ID format: Source_Page_Hash
            ids.append(f"{c['metadata']['source']}_p{c['metadata']['page']}_{text_hash}")
            
        rag.add_documents(texts, metadatas, ids)
        total_chunks += len(chunks)
        print(f"   ✅ Added {len(chunks)} chunks. Total in DB: {rag.collection.count()}")
        pages = {str((meta or {}).get("page") or "") for meta in metadatas}
        pages.discard("")
        processed_files.append({
            "fileName": os.path.basename(file_path),
            "filePath": file_path,
            "sizeBytes": os.path.getsize(file_path) if os.path.exists(file_path) else 0,
            "sha256": _sha256_file(file_path) if os.path.exists(file_path) else None,
            "chunkCount": len(chunks),
            "pageCount": len(pages),
            "status": "completed",
        })
        
    print(f"🎉 Ingestion Complete! Total Chunks: {total_chunks}")
    report = _metadata_quality_report(all_metadatas)
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
    return {
        "ok": True,
        "message": "Ingestion completed",
        "processedFiles": processed_files,
        "totalFiles": len(processed_files),
        "totalChunks": total_chunks,
        "collectionCount": rag.collection.count() if rag.collection else total_chunks,
        "metadataReportPath": report_path,
        "metadataQuality": {
            "unknownTargetPopulationRate": report.get("unknown_target_population_rate"),
            "unknownClinicalDomainRate": report.get("unknown_clinical_domain_rate"),
            "fieldCoverage": report.get("field_coverage", {}),
        },
    }

if __name__ == "__main__":
    ingest_guidelines()
