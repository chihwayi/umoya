import unittest
from unittest.mock import patch, MagicMock

import main
from main import IntelligentDiagnosisRequest


class TestIntelligentPolicy(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # ensure diagnostic assistant returns a known rule-based output
        self.rule_output = {
            'suggested_diagnoses': [{'diagnosis': 'Test', 'probability': 0.5}],
            'confidence_scores': [],
            'recommended_tests': [],
            'red_flags': [],
            'vitals_clues': []
        }
        patcher = patch('main.diagnostic_assistant')
        self.mock_da = patcher.start()
        self.addAsyncCleanup(patcher.stop)
        self.mock_da.suggest_diagnosis.return_value = self.rule_output

    async def test_intelligent_fallback_when_policy_disabled(self):
        req = IntelligentDiagnosisRequest(symptoms=['fever'])
        # call directly supply ai_policy disable
        resp = await main.intelligent_diagnosis(req, req=None, ai_policy={'ai_enabled': False})
        self.assertEqual(resp['source'], 'rule_based_cdss_policy_disabled')
        self.assertFalse(resp.get('ai_enabled', True))
        self.assertEqual(resp['suggested_diagnoses'], self.rule_output['suggested_diagnoses'])
        self.assertIn('model_trace', resp)
        self.assertIn('safety_gate', resp)
        self.assertFalse(resp.get('abstained', True))
        self.assertIsNone(resp.get('abstain_reason'))

    async def test_phi_rejection(self):
        req = IntelligentDiagnosisRequest(symptoms=['Patient name John Doe'])
        with self.assertRaises(Exception):
            await main.intelligent_diagnosis(req, req=None, ai_policy={'ai_enabled': True})


if __name__ == '__main__':
    unittest.main()
