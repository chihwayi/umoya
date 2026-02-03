
import os
import sys
import glob
import logging
from pathlib import Path
import pypdf

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_models.rag_engine import RAGEngine

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

GUIDELINES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "who-smart-guidelines")

def extract_text_from_pdf(pdf_path: str) -> list[tuple[str, int]]:
    """
    Extracts text from a PDF file.
    Returns a list of tuples: (text_content, page_number)
    """
    extracted_data = []
    try:
        reader = pypdf.PdfReader(pdf_path)
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text and len(text.strip()) > 50: # Skip empty/very short pages
                extracted_data.append((text, i + 1))
    except Exception as e:
        logger.error(f"Error reading PDF {pdf_path}: {e}")
    
    return extracted_data

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 100) -> list[str]:
    """
    Simple sliding window chunker.
    Increased chunk size for PDF content which is often denser.
    """
    chunks = []
    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = start + chunk_size
        chunks.append(text[start:end])
        start += (chunk_size - overlap)
        
    return chunks

def ingest_guidelines():
    print(f"🚀 Starting Knowledge Ingestion from {GUIDELINES_DIR}...")
    
    rag = RAGEngine()
    
    # 1. Find all Markdown/Text/PDF files (recursively)
    files = glob.glob(os.path.join(GUIDELINES_DIR, "**", "*.md"), recursive=True) + \
            glob.glob(os.path.join(GUIDELINES_DIR, "**", "*.txt"), recursive=True) + \
            glob.glob(os.path.join(GUIDELINES_DIR, "**", "*.pdf"), recursive=True)
    
    if not files:
        print("❌ No guideline files found.")
        return

    total_chunks = 0
    
    for file_path in files:
        filename = os.path.basename(file_path)
        print(f"📄 Processing {filename}...")
        
        try:
            # Handle PDFs
            if filename.lower().endswith('.pdf'):
                pages = extract_text_from_pdf(file_path)
                for page_text, page_num in pages:
                    chunks = chunk_text(page_text)
                    for chunk in chunks:
                        success = rag.add_document(
                            text=chunk,
                            source=filename,
                            page=page_num
                        )
                        if success:
                            total_chunks += 1
            
            # Handle Text/Markdown
            else:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                chunks = chunk_text(content)
                for chunk in chunks:
                    success = rag.add_document(
                        text=chunk,
                        source=filename,
                        page=1 
                    )
                    if success:
                        total_chunks += 1
                    
        except Exception as e:
            print(f"❌ Failed to process {filename}: {e}")

    print(f"\n✅ Ingestion Complete! Added {total_chunks} chunks to the Knowledge Base.")

def test_retrieval():
    print("\n🔎 Testing Retrieval...")
    rag = RAGEngine()
    
    queries = [
        "What is the first line regimen for HIV?",
        "When should ART be started?",
        "How to monitor viral load?"
    ]
    
    for q in queries:
        print(f"\nQuestion: {q}")
        results = rag.query(q, n_results=1)
        if results:
            print(f"Answer Context: {results[0]['text'][:300]}...") # Truncate for display
            print(f"Source: {results[0]['source']}")
        else:
            print("❌ No context found.")

if __name__ == "__main__":
    ingest_guidelines()
    test_retrieval()
