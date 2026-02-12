
import chromadb
from chromadb.config import Settings
import os
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def verify():
    persistence_path = "./data/chroma_db"
    
    try:
        client = chromadb.PersistentClient(
            path=persistence_path,
            settings=Settings(anonymized_telemetry=False)
        )
        collection = client.get_collection(name="medical_guidelines")
        
        count = collection.count()
        print(f"📊 Total Documents in DB: {count}")
        
        if count > 0:
            # Get a sample to verify metadata
            results = collection.get(limit=5, include=["metadatas", "documents"])
            print("\n🔍 Sample Metadata:")
            for meta in results['metadatas']:
                print(meta)
                
            # Check for specific tags we implemented
            pregnant_query = collection.query(
                query_texts=["pregnancy"],
                n_results=1,
                where={"target_population": "pregnant_women"}
            )
            
            if pregnant_query['ids'] and pregnant_query['ids'][0]:
                 print("\n✅ Verification Successful: Found content tagged with 'pregnant_women'")
            else:
                 print("\n⚠️ Verification Warning: No content tagged with 'pregnant_women' found (might be expected if no ANC docs ingested)")

        else:
            print("❌ Database is empty. Ingestion might have failed.")

    except Exception as e:
        print(f"❌ Error verifying DB: {e}")

if __name__ == "__main__":
    verify()
