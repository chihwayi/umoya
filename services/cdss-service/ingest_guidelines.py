import os
import sys
import glob
import logging
import hashlib
import nltk
from typing import List, Dict, Any

# Ensure NLTK data is available for unstructured
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')
try:
    nltk.data.find('taggers/averaged_perceptron_tagger')
except LookupError:
    nltk.download('averaged_perceptron_tagger')

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_models.rag_engine import RAGEngine

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

GUIDELINES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "who-smart-guidelines")

def process_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Uses unstructured to partition PDF and chunk by title.
    Returns a list of dicts with 'text' and 'metadata'.
    """
    try:
        from unstructured.partition.pdf import partition_pdf
        
        logger.info(f"Partitioning PDF (Layout-Aware): {pdf_path}")
        
        # partition_pdf with "by_title" chunking strategy
        # "hi_res" strategy uses layout analysis to detect tables/images (requires tesseract/poppler)
        elements = partition_pdf(
            filename=pdf_path,
            strategy="hi_res", 
            infer_table_structure=True,
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
        logger.error(f"❌ 'unstructured' library import failed: {e}")
        return []
    except Exception as e:
        logger.error(f"Error processing PDF {pdf_path}: {e}")
        # Fallback?
        return []

def ingest_guidelines():
    print(f"🚀 Starting Advanced Knowledge Ingestion (Unstructured) from {GUIDELINES_DIR}...")
    
    rag = RAGEngine()
    
    # Check if RAG engine is ready
    if not rag.collection:
        print("❌ RAG Engine not initialized correctly.")
        return

    # Wipe existing data (Data Hygiene)
    try:
        print("🧹 Wiping existing Vector DB for clean ingestion...")
        rag.chroma_client.delete_collection("medical_guidelines")
        rag.collection = rag.chroma_client.get_or_create_collection("medical_guidelines")
        print("   ✅ Collection wiped and recreated.")
    except Exception as e:
        logger.warning(f"Could not wipe DB (might be empty): {e}")

    files = glob.glob(os.path.join(GUIDELINES_DIR, "**", "*.pdf"), recursive=True)
    
    if not files:
        print("❌ No PDF guideline files found.")
        return

    total_chunks = 0
    
    for file_path in files:
        print(f"📄 Processing {os.path.basename(file_path)}...")
        
        chunks = process_pdf(file_path)
        
        if not chunks:
            print("   ⚠️ No chunks extracted.")
            continue
            
        texts = [c["text"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]
        ids = []
        
        # Generate stable IDs
        for c in chunks:
            # Create a deterministic hash of the text
            text_hash = hashlib.md5(c["text"].encode('utf-8')).hexdigest()
            # ID format: Source_Page_Hash
            ids.append(f"{c['metadata']['source']}_p{c['metadata']['page']}_{text_hash}")
            
        rag.add_documents(texts, metadatas, ids)
        total_chunks += len(chunks)
        print(f"   ✅ Added {len(chunks)} chunks.")
        
    print(f"🎉 Ingestion Complete! Total Chunks: {total_chunks}")

if __name__ == "__main__":
    ingest_guidelines()
