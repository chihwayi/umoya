import unittest
from unittest.mock import MagicMock, patch, call
import sys
import os
import json

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Mock dependencies that might be missing or hard to instantiate
mock_st = MagicMock()
sys.modules['sentence_transformers'] = mock_st
mock_chroma = MagicMock()
sys.modules['chromadb'] = mock_chroma
sys.modules['chromadb.config'] = MagicMock()
mock_redis = MagicMock()
sys.modules['redis'] = mock_redis
mock_bm25 = MagicMock()
sys.modules['rank_bm25'] = mock_bm25

# Now import the class under test
from ai_models.rag_engine import RAGEngine

class TestSprint4HybridRedis(unittest.TestCase):
    
    def setUp(self):
        # Reset mocks
        mock_st.reset_mock()
        mock_chroma.reset_mock()
        mock_redis.reset_mock()
        mock_bm25.reset_mock()
        
    def test_hybrid_search_rrf(self):
        """Test that Hybrid Search merges Vector and BM25 results using RRF."""
        
        # Setup Mocks
        # 1. Embedding Model
        MockSentenceTransformer = mock_st.SentenceTransformer
        mock_bi_encoder = MockSentenceTransformer.return_value
        mock_bi_encoder.encode.return_value.tolist.return_value = [0.1, 0.2] # Query embedding
        
        # 2. Chroma (Vector Search)
        mock_collection = MagicMock()
        mock_client = mock_chroma.PersistentClient.return_value
        mock_client.get_or_create_collection.return_value = mock_collection
        
        # Vector returns Doc A (high score) and Doc B (med score)
        mock_collection.query.return_value = {
            'documents': [['Doc A', 'Doc B']],
            'metadatas': [[{'source': 'S1'}, {'source': 'S2'}]],
            'distances': [[0.1, 0.4]] # smaller distance = better
        }
        
        # 3. BM25 (Keyword Search)
        MockBM25Okapi = mock_bm25.BM25Okapi
        mock_bm25_instance = MockBM25Okapi.return_value
        # BM25 scores: Doc B (high), Doc C (med), Doc A (low/not found in top k)
        # Let's say Doc B is index 1, Doc C is index 2.
        # RAGEngine expects tokenized query.
        mock_bm25_instance.get_scores.return_value = [0.1, 0.9, 0.8] # Scores for [Doc A, Doc B, Doc C] assuming corpus order
        
        # 4. Redis (Cache Miss)
        MockRedis = mock_redis.Redis
        mock_redis_client = MockRedis.return_value
        mock_redis_client.get.return_value = None # Cache miss
        
        # Initialize Engine
        engine = RAGEngine()
        # Manually set BM25 docs to match the scores above
        engine.bm25_docs = ['Doc A', 'Doc B', 'Doc C']
        engine.bm25_metadatas = [{'source': 'S1'}, {'source': 'S2'}, {'source': 'S3'}]
        engine.bm25 = mock_bm25_instance
        
        # Disable CrossEncoder for this test to focus on RRF
        engine.cross_encoder = None
        
        # Execute Query
        results = engine.query("test query", n_results=3)
        
        # Verify Results
        # Doc B should be top: #2 in Vector, #1 in BM25 -> High RRF
        # Doc A: #1 in Vector, #3 in BM25 -> Good RRF
        # Doc C: Not in Vector, #2 in BM25 -> Some RRF
        
        # Check that we got results
        self.assertEqual(len(results), 3)
        
        # Check Redis setex was called (caching the result)
        self.assertTrue(mock_redis_client.setex.called)
        
        # Verify text content present
        texts = [r['text'] for r in results]
        self.assertIn('Doc A', texts)
        self.assertIn('Doc B', texts)
        self.assertIn('Doc C', texts)
        
        # Verify RRF sorting (Doc B likely winner)
        # Vector Rank: A=0, B=1
        # BM25 Rank: B=0, C=1, A=2
        # RRF(B) = 1/(60+1+1) + 1/(60+0+1) = 1/62 + 1/61
        # RRF(A) = 1/(60+0+1) + 1/(60+2+1) = 1/61 + 1/63
        # RRF(C) = 0          + 1/(60+1+1) = 1/62
        # So B > A > C
        self.assertEqual(results[0]['text'], 'Doc B')
        self.assertEqual(results[1]['text'], 'Doc A')
        self.assertEqual(results[2]['text'], 'Doc C')

    def test_redis_caching(self):
        """Test that Redis cache is hit and returns cached results."""
        
        # Setup Redis Mock for Cache HIT
        MockRedis = mock_redis.Redis
        mock_redis_client = MockRedis.return_value
        
        cached_data = [
            {"text": "Cached Doc", "confidence": 0.99, "source": "Cache"}
        ]
        mock_redis_client.get.return_value = json.dumps(cached_data)
        
        # Initialize Engine
        engine = RAGEngine()
        # Bypass component init issues
        engine.collection = MagicMock()
        engine.embedding_model = MagicMock()
        
        # Execute Query
        results = engine.query("test query", n_results=1)
        
        # Verify
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['text'], "Cached Doc")
        # Ensure no vector search happened
        engine.collection.query.assert_not_called()

if __name__ == '__main__':
    unittest.main()
