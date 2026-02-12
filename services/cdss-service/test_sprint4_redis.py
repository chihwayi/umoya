
import unittest
import json
import os
from unittest.mock import MagicMock, patch
from ai_models.rag_engine import RAGEngine

class TestRedisCaching(unittest.TestCase):
    
    def setUp(self):
        # Mock environment variables
        self.env_patcher = patch.dict(os.environ, {
            "REDIS_URL": "redis://localhost:6379",
            "REDIS_HOST": "localhost",
            "REDIS_PORT": "6379"
        })
        self.env_patcher.start()
        
        # Mock dependencies
        self.chroma_patcher = patch('chromadb.PersistentClient')
        self.mock_chroma = self.chroma_patcher.start()
        
        self.st_patcher = patch('sentence_transformers.SentenceTransformer')
        self.mock_st = self.st_patcher.start()
        
        self.ce_patcher = patch('sentence_transformers.CrossEncoder')
        self.mock_ce = self.ce_patcher.start()
        
        self.redis_patcher = patch('redis.from_url')
        self.mock_redis_from_url = self.redis_patcher.start()
        
        self.redis_client_mock = MagicMock()
        self.mock_redis_from_url.return_value = self.redis_client_mock
        
        # Initialize RAGEngine
        with patch('ai_models.rag_engine.RAGEngine._build_bm25_index'): # Skip BM25 build
            self.engine = RAGEngine()
            
        # Mock embedding model encode
        mock_embedding = MagicMock()
        mock_embedding.tolist.return_value = [[0.1, 0.2, 0.3]]
        self.engine.embedding_model.encode.return_value = mock_embedding
        
        # Mock collection query
        self.engine.collection = MagicMock()
        self.engine.collection.query.return_value = {
            'documents': [['doc1', 'doc2']],
            'metadatas': [[{'source': 's1', 'page': 1}, {'source': 's2', 'page': 2}]],
            'distances': [[0.1, 0.2]]
        }

    def tearDown(self):
        self.env_patcher.stop()
        self.chroma_patcher.stop()
        self.st_patcher.stop()
        self.ce_patcher.stop()
        self.redis_patcher.stop()

    def test_cache_hit(self):
        """Test that cached results are returned without querying vector DB"""
        query = "hypertension"
        cached_data = [{"text": "cached doc", "source": "cache"}]
        
        # Setup Redis mock to return data
        self.redis_client_mock.get.return_value = json.dumps(cached_data)
        
        # Execute query
        results = self.engine.query(query)
        
        # Verify
        self.redis_client_mock.get.assert_called_once()
        self.assertEqual(results, cached_data)
        self.engine.collection.query.assert_not_called() # Should NOT query Vector DB

    def test_cache_miss_and_set(self):
        """Test that cache miss triggers DB query and sets cache"""
        query = "diabetes"
        
        # Setup Redis mock to return None (miss)
        self.redis_client_mock.get.return_value = None
        
        # Setup CrossEncoder mock
        self.engine.cross_encoder.predict.return_value = [0.9, 0.8]
        
        # Execute query
        results = self.engine.query(query)
        
        # Verify
        self.redis_client_mock.get.assert_called_once()
        self.engine.collection.query.assert_called_once()
        
        # Verify cache set was called
        self.redis_client_mock.setex.assert_called_once()
        args, _ = self.redis_client_mock.setex.call_args
        self.assertEqual(args[1], 3600) # Expiry
        self.assertTrue(args[0].startswith("rag:query:")) # Key prefix check
        
        # Verify results
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]['text'], 'doc1')

if __name__ == '__main__':
    unittest.main()
