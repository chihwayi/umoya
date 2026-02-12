import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Pre-emptive mocking of broken dependencies
# We mock sentence_transformers completely to avoid ImportError from huggingface_hub
mock_st_module = MagicMock()
sys.modules['sentence_transformers'] = mock_st_module

# Mock chromadb as well since it's imported inside a function
mock_chroma_module = MagicMock()
sys.modules['chromadb'] = mock_chroma_module
sys.modules['chromadb.config'] = MagicMock()

from ai_models.rag_engine import RAGEngine

class TestSprint4ReRanking(unittest.TestCase):
    
    def setUp(self):
        # Reset mocks before each test
        mock_st_module.reset_mock()
        mock_chroma_module.reset_mock()
        
    def test_reranking_logic(self):
        """
        Test that RAGEngine.query() correctly uses the CrossEncoder to re-rank results.
        """
        # Setup SentenceTransformer Mocks (accessed via the global mock module)
        MockSentenceTransformer = mock_st_module.SentenceTransformer
        MockCrossEncoder = mock_st_module.CrossEncoder
        
        mock_bi_encoder = MockSentenceTransformer.return_value
        # Mock encode return value to support .tolist()
        mock_embedding = MagicMock()
        mock_embedding.tolist.return_value = [0.1, 0.2, 0.3]
        mock_bi_encoder.encode.return_value = mock_embedding
 
        
        mock_cross_encoder = MockCrossEncoder.return_value
        mock_cross_encoder.predict.side_effect = None # Clear any previous side effects
        mock_cross_encoder.predict.return_value = [0.1, 0.5, 0.9]
        
        # Setup Chroma Mocks
        MockChroma = mock_chroma_module
        mock_collection = MagicMock()
        mock_client = MockChroma.PersistentClient.return_value
        mock_client.get_or_create_collection.return_value = mock_collection
        
        mock_collection.query.return_value = {
            'documents': [['Doc A', 'Doc B', 'Doc C']],
            'metadatas': [[{'source': 'S1'}, {'source': 'S2'}, {'source': 'S3'}]],
            'distances': [[0.5, 0.4, 0.3]]
        }
        
        # Initialize Engine
        engine = RAGEngine()
        
        # Verify CrossEncoder was initialized
        MockCrossEncoder.assert_called_with('cross-encoder/ms-marco-MiniLM-L-6-v2')
        
        # Run Query
        results = engine.query("test query", n_results=3)
        
        # Assertions
        expected_pairs = [
            ['test query', 'Doc A'],
            ['test query', 'Doc B'],
            ['test query', 'Doc C']
        ]
        mock_cross_encoder.predict.assert_called_with(expected_pairs)
        
        self.assertEqual(len(results), 3)
        self.assertEqual(results[0]['text'], 'Doc C')
        self.assertEqual(results[1]['text'], 'Doc B')
        self.assertEqual(results[2]['text'], 'Doc A')
        self.assertEqual(results[0]['re_rank_score'], 0.9)

    def test_fallback_when_cross_encoder_fails(self):
        """
        Test that RAGEngine falls back to vector order if CrossEncoder fails.
        """
        MockSentenceTransformer = mock_st_module.SentenceTransformer
        MockCrossEncoder = mock_st_module.CrossEncoder
        MockChroma = mock_chroma_module
        
        mock_bi_encoder = MockSentenceTransformer.return_value
        # Mock encode return value to support .tolist()
        mock_embedding = MagicMock()
        mock_embedding.tolist.return_value = [0.1, 0.2]
        mock_bi_encoder.encode.return_value = mock_embedding
        
        mock_cross_encoder = MockCrossEncoder.return_value
        mock_cross_encoder.predict.side_effect = Exception("Model error")
        
        mock_collection = MagicMock()
        mock_client = MockChroma.PersistentClient.return_value
        mock_client.get_or_create_collection.return_value = mock_collection
        
        mock_collection.query.return_value = {
            'documents': [['Doc A', 'Doc B']],
            'metadatas': [[{'source': 'S1'}, {'source': 'S2'}]],
            'distances': [[0.1, 0.2]]
        }
        
        engine = RAGEngine()
        
        results = engine.query("test query", n_results=2)
        
        self.assertEqual(results[0]['text'], 'Doc A')
        self.assertEqual(results[1]['text'], 'Doc B')

if __name__ == '__main__':
    unittest.main()
