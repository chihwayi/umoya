
import sys
import os
import logging

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_models.rag_engine import RAGEngine

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_retrieval():
    print("🔎 Testing Retrieval Quality...")
    
    rag = RAGEngine()
    
    if not rag.collection:
        print("❌ RAG Engine not initialized.")
        return

    count = rag.collection.count()
    print(f"📊 Total Documents in DB: {count}")
    
    if count == 0:
        print("⚠️ DB is empty. Ingestion might still be running.")
        return

    queries = [
        "treatment for hypertension in pregnancy",
        "monitor blood pressure"
    ]
    
    for q in queries:
        print(f"\n❓ Query: '{q}'")
        results = rag.query(q, n_results=3)
        
        if not results:
            print("   (No results found)")
            continue
            
        for i, res in enumerate(results):
            print(f"   {i+1}. [{res['metadata']['source']}] (Score: {res['distance']:.4f})")
            print(f"      Target Pop: {res['metadata'].get('target_population', 'N/A')}")
            # Print a snippet of text to check for broken grammar
            snippet = res['text'][:200].replace('\n', ' ')
            print(f"      Text: {snippet}...")

if __name__ == "__main__":
    test_retrieval()
