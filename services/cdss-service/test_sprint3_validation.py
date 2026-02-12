import unittest
import json
from unittest.mock import MagicMock, patch, AsyncMock
import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from diagnostic_assistant import DiagnosticAssistant
from ai_models.llm_provider import LLMProvider

class TestSprint3Validation(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # Initialize LLMProvider
        self.llm_provider = LLMProvider()
        # Mock check_availability with AsyncMock
        self.llm_provider.check_availability = AsyncMock(return_value=True)
        
    async def test_valid_json_parsing(self):
        """Test that valid JSON from LLM is correctly parsed."""
        valid_json = {
            "recommendation": "Monitor blood pressure daily.",
            "evidence_level": "High",
            "reasoning": "BP is consistently elevated (>140/90).",
            "action_items": ["Prescribe Lisinopril", "Dietary changes"]
        }
        
        # Mock generate_response to return stringified JSON
        self.llm_provider.generate_response = AsyncMock(return_value=json.dumps(valid_json))
        
        # Test generate_json
        result = await self.llm_provider.generate_json("prompt", "schema")
        
        self.assertEqual(result, valid_json)
        self.assertEqual(result['recommendation'], "Monitor blood pressure daily.")
        self.assertEqual(result['evidence_level'], "High")

    async def test_malformed_json_handling(self):
        """Test that malformed JSON returns None."""
        malformed_json_str = "{ 'recommendation': 'Invalid JSON because of single quotes' " # Missing closing brace
        
        # Mock generate_response
        self.llm_provider.generate_response = AsyncMock(return_value=malformed_json_str)
        
        # Test generate_json
        result = await self.llm_provider.generate_json("prompt", "schema")
        
        self.assertIsNone(result)

    async def test_markdown_json_cleaning(self):
        """Test that JSON wrapped in markdown code blocks is cleaned and parsed."""
        json_content = {
            "recommendation": "Clean me."
        }
        markdown_str = f"Here is the JSON:\n```json\n{json.dumps(json_content)}\n```"
        
        # Mock generate_response
        self.llm_provider.generate_response = AsyncMock(return_value=markdown_str)
        
        # Test generate_json
        result = await self.llm_provider.generate_json("prompt", "schema")
        
        self.assertEqual(result, json_content)

    @patch('diagnostic_assistant.LLMProvider')
    async def test_diagnostic_assistant_integration(self, MockLLMProvider):
        """Test how DiagnosticAssistant handles the parsed JSON."""
        # Setup Mock LLM Provider instance
        mock_llm_instance = MockLLMProvider.return_value
        mock_llm_instance.check_availability = AsyncMock(return_value=True)
        
        # Valid response
        valid_response = {
            "recommendation": "Start Metformin.",
            "evidence_level": "High",
            "reasoning": "HbA1c is 8.5%.",
            "action_items": ["Check renal function"],
            "diagnoses": [{"name": "Type 2 Diabetes", "probability": 0.9}]
        }
        mock_llm_instance.generate_json = AsyncMock(return_value=valid_response)
        
        # Initialize Assistant
        assistant = DiagnosticAssistant()
        
        # Run intelligent_suggest
        result = await assistant.intelligent_suggest(
            symptoms=["polyuria"],
            vitals={},
            age=50,
            gender="Male"
        )
        
        # Verify structure
        self.assertIn('clinical_recommendation', result)
        rec = result['clinical_recommendation']
        self.assertEqual(rec['text'], "Start Metformin.")
        self.assertEqual(rec['evidence_level'], "High")
        self.assertEqual(rec['reasoning'], "HbA1c is 8.5%.")

    @patch('diagnostic_assistant.LLMProvider')
    async def test_diagnostic_assistant_missing_fields(self, MockLLMProvider):
        """Test DiagnosticAssistant handling when optional fields are missing."""
        mock_llm_instance = MockLLMProvider.return_value
        mock_llm_instance.check_availability = AsyncMock(return_value=True)
        
        # Response missing evidence_level and reasoning
        partial_response = {
            "recommendation": "Lifestyle modification.",
            # evidence_level missing
            # reasoning missing
            "diagnoses": []
        }
        mock_llm_instance.generate_json = AsyncMock(return_value=partial_response)
        
        assistant = DiagnosticAssistant()
        
        result = await assistant.intelligent_suggest(
            symptoms=["obesity"],
            vitals={},
            age=40,
            gender="Female"
        )
        
        self.assertIn('clinical_recommendation', result)
        rec = result['clinical_recommendation']
        self.assertEqual(rec['text'], "Lifestyle modification.")
        self.assertEqual(rec['evidence_level'], "Low") # Default value
        self.assertEqual(rec['reasoning'], "") # Default value

if __name__ == '__main__':
    unittest.main()
