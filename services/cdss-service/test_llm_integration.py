import asyncio
import sys
import os
from unittest.mock import MagicMock, AsyncMock

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from diagnostic_assistant import DiagnosticAssistant
from ai_models.llm_provider import LLMProvider

async def test_integration():
    print("Initializing DiagnosticAssistant...")
    assistant = DiagnosticAssistant()
    
    # Mock LLM Provider to simulate a running Ollama instance
    print("Mocking LLM Provider...")
    mock_llm = MagicMock(spec=LLMProvider)
    mock_llm.check_availability = AsyncMock(return_value=True)
    mock_llm.generate_json = AsyncMock(return_value={
        "diagnoses": [
            {
                "name": "Mocked LLM Diagnosis", 
                "probability": 0.85, 
                "reasoning": "This is a test diagnosis from the mocked LLM."
            }
        ],
        "recommended_tests": ["Mocked Test A", "Mocked Test B"],
        "red_flags": ["Mocked Red Flag"]
    })
    
    # Inject the mock
    assistant.llm_provider = mock_llm
    
    print("Calling intelligent_suggest...")
    result = await assistant.intelligent_suggest(
        symptoms=["headache", "fever"],
        age=30,
        gender="male",
        clinical_notes="Patient complains of severe headache and high fever."
    )
    
    print("\n--- Result ---")
    print(result)
    
    # Verify LLM was called
    print("\n--- Verification ---")
    if mock_llm.generate_json.called:
        print("✅ LLM was called")
    else:
        print("❌ LLM was NOT called")
        
    # Verify merging happened
    diagnoses = [d['diagnosis'] for d in result.get('suggested_diagnoses', [])]
    if "Mocked LLM Diagnosis" in diagnoses:
        print("✅ LLM diagnosis merged successfully")
    else:
        print("❌ LLM diagnosis NOT found in result")
        
    # Verify source attribution
    sources = [d.get('source') for d in result.get('suggested_diagnoses', [])]
    if "llm" in sources:
        print("✅ Source 'llm' found")
    else:
        print("❌ Source 'llm' NOT found")

    # Test Summary Generation
    print("\n--- Testing Patient Summary ---")
    mock_llm.generate_response = AsyncMock(return_value="30yo Male with history of migraines presenting with fever and headache.")
    
    summary_result = await assistant.summarize_patient_history(
        clinical_notes=["Patient complains of severe headache and high fever."],
        demographics={"age": 30, "gender": "male"},
        recent_vitals={"temp": 38.5}
    )
    
    print("Summary Result:", summary_result)
    
    if summary_result.get("source") == "llm" and "30yo Male" in summary_result.get("summary", ""):
        print("✅ Summary generation successful")
    else:
        print("❌ Summary generation failed")

if __name__ == "__main__":
    asyncio.run(test_integration())
