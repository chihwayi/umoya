
import sys
import os
import logging
from typing import Dict, Any

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_models.rag_engine import RAGEngine

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_sprint2_scenarios():
    print("🧪 Testing Sprint 2: Context-Aware Retrieval Scenarios...")
    
    rag = RAGEngine()
    
    if not rag.collection or rag.collection.count() == 0:
        print("⚠️  RAG DB is empty or not initialized. Cannot run scenarios.")
        return

    # Define a query that is ambiguous (could apply to general or pregnant population)
    # "Hypertension" is the classic example: General HTN vs Pre-eclampsia
    query = "treatment for hypertension"
    
    print(f"\n🔎 Query: '{query}'")

    # --- Scenario 1: Male Patient ---
    # Expectation: Should NOT return any documents tagged as "pregnant_women"
    print("\n--- Scenario 1: Male Patient (75yo) ---")
    print("    Context: Gender = Male")
    print("    Action: Applying filter {'target_population': {'$ne': 'pregnant_women'}}")
    
    filters_male = {"target_population": {"$ne": "pregnant_women"}}
    results_male = rag.query(query, filters=filters_male, n_results=10)
    
    pregnant_docs_male = [r for r in results_male if r['metadata'].get('target_population') == 'pregnant_women']
    
    if not pregnant_docs_male:
        print("✅ PASS: No pregnancy-related guidelines returned for Male patient.")
    else:
        print(f"❌ FAIL: Found {len(pregnant_docs_male)} pregnancy docs for Male patient!")
        for d in pregnant_docs_male:
             print(f"   - {d['metadata']['source']} (Target: {d['metadata'].get('target_population')})")

    # --- Scenario 2: Female Patient (Pregnant) ---
    # Expectation: SHOULD return pregnancy documents if relevant
    print("\n--- Scenario 2: Female Patient (Pregnant) ---")
    print("    Context: Gender = Female, Condition = Pregnant")
    print("    Action: No exclusion filter (or explicit inclusion)")
    
    # In a real scenario, we might boost pregnancy docs, but for now we just verify they are NOT excluded
    results_female = rag.query(query, n_results=10)
    
    pregnant_docs_female = [r for r in results_female if r['metadata'].get('target_population') == 'pregnant_women']
    
    if pregnant_docs_female:
        print(f"✅ PASS: Found {len(pregnant_docs_female)} pregnancy-related guidelines for Pregnant Female.")
        print("   Samples:")
        for d in pregnant_docs_female[:3]:
            print(f"   - {d['metadata']['source']} (Target: {d['metadata'].get('target_population')})")
    else:
        print("ℹ️  INFO: No pregnancy docs found in top 10. This might be due to ranking or lack of data, but filtering is not the cause.")

    # --- Verify General Population Docs ---
    general_docs = [r for r in results_male if r['metadata'].get('target_population') != 'pregnant_women']
    if general_docs:
        print(f"\n✅ PASS: Returned {len(general_docs)} general/adult guidelines for Male patient.")
    else:
        print("\n⚠️  WARNING: No general guidelines found for Male patient. DB might only have pregnancy docs?")

if __name__ == "__main__":
    test_sprint2_scenarios()
