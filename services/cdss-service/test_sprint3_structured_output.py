import asyncio
import logging
import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from diagnostic_assistant import DiagnosticAssistant
from ai_models.llm_provider import LLMProvider

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_structured_output():
    print("Initializing DiagnosticAssistant...")
    assistant = DiagnosticAssistant()
    
    # Check if LLM is available
    if not assistant.llm_provider:
        print("LLM Provider not initialized. Check environment variables.")
        return

    is_available = await assistant.llm_provider.check_availability()
    if not is_available:
        print("LLM Service not available. Skipping test.")
        return

    print("LLM Service available. Running test case...")
    
    # Test Case: 65yo Male with Hypertension symptoms
    symptoms = ["headache", "dizziness", "blurred vision"]
    vitals = {"systolic": 160, "diastolic": 100, "heartRate": 88}
    age = 65
    gender = "Male"
    
    result = await assistant.intelligent_suggest(
        symptoms=symptoms,
        vitals=vitals,
        age=age,
        gender=gender
    )
    
    print("\n=== Result Analysis ===")
    
    if 'clinical_recommendation' in result:
        rec = result['clinical_recommendation']
        print(f"✅ Recommendation Found: {rec.get('text')}")
        print(f"✅ Evidence Level: {rec.get('evidence_level')}")
        print(f"✅ Reasoning: {rec.get('reasoning')}")
        print(f"✅ Action Items: {rec.get('action_items')}")
        
        # Validation
        success = True
        if not rec.get('text'):
            print("❌ Error: Recommendation text is missing.")
            success = False
        if not rec.get('evidence_level'):
             print("❌ Error: Evidence level is missing.")
             success = False
        if not rec.get('reasoning'):
             print("❌ Error: Reasoning is missing.")
             success = False
        
        if success:
            print("\n✅ PASSED: Structured output received correctly.")
        else:
            print("\n❌ FAILED: Missing fields in structured output.")
             
        print("\nFull Result Keys:", result.keys())
    else:
        print("❌ Error: 'clinical_recommendation' key missing in result.")
        print("Full Result:", result)

if __name__ == "__main__":
    asyncio.run(test_structured_output())