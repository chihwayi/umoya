
import sys
import os
import logging
import hashlib

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_models.rag_engine import RAGEngine

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_test_data():
    print("🌱 Seeding RAG DB with Controlled Test Data for Sprint 2 Verification...")
    
    rag = RAGEngine()
    
    # 1. Wipe Collection to ensure clean state for testing
    if rag.collection:
        print("   🧹 Clearing existing collection...")
        rag.chroma_client.delete_collection("medical_guidelines")
        rag.collection = rag.chroma_client.get_or_create_collection("medical_guidelines")
    
    # 2. Define Test Chunks
    # We need specific chunks to test the filtering logic:
    # - "pregnant_women" vs "adults" vs "elderly"
    
    test_data = [
        {
            "text": "In pregnant women with hypertension, Labetalol is the first-line treatment. ACE inhibitors are contraindicated.",
            "metadata": {
                "source": "Test_Guideline_Pregnancy",
                "page": 1,
                "type": "guideline",
                "target_population": "pregnant_women",
                "clinical_domain": "cardiology"
            }
        },
        {
            "text": "For general adult population with hypertension, Amlodipine or Thiazide diuretics are recommended as initial therapy.",
            "metadata": {
                "source": "Test_Guideline_Adults",
                "page": 5,
                "type": "guideline",
                "target_population": "adults",
                "clinical_domain": "cardiology"
            }
        },
        {
            "text": "In elderly patients (>75 years) with hypertension, start with lower doses to avoid orthostatic hypotension.",
            "metadata": {
                "source": "Test_Guideline_Elderly",
                "page": 10,
                "type": "guideline",
                "target_population": "elderly",
                "clinical_domain": "cardiology"
            }
        }
    ]
    
    texts = [d["text"] for d in test_data]
    metadatas = [d["metadata"] for d in test_data]
    ids = [f"test_id_{i}" for i in range(len(test_data))]
    
    # 3. Add to Chroma
    rag.add_documents(texts, metadatas, ids)
    print(f"   ✅ Added {len(test_data)} test documents.")
    print("🌱 Seeding Complete.")

if __name__ == "__main__":
    seed_test_data()
