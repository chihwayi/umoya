
import os
import logging
import hashlib
import json
from typing import List, Dict, Any, Optional
import numpy as np

# Configure logger
logger = logging.getLogger(__name__)

class RAGEngine:
    """
    Retrieval-Augmented Generation Engine for MediCore.
    Handles Knowledge Base (Vector DB) interactions and Entity Extraction.
    """
    
    def __init__(self, persistence_path: str = "./data/chroma_db"):
        self.persistence_path = persistence_path
        self.chroma_client = None
        self.collection = None
        self.embedding_model = None
        self.cross_encoder = None
        self.nlp = None
        self.bm25 = None
        self.bm25_corpus = [] # List of tokenized texts
        self.bm25_docs = []   # List of raw texts (aligned with corpus)
        self.bm25_metadatas = [] # List of metadatas (aligned with corpus)
        self.redis_client = None
        self._initialize_components()

    def _initialize_components(self):
        """Initialize ChromaDB, Embedding Model, NLP tools, BM25, and Redis."""
        try:
            import chromadb
            from chromadb.config import Settings
            from sentence_transformers import SentenceTransformer, CrossEncoder
            import spacy
            from rank_bm25 import BM25Okapi
            import redis
            
            # 1. Initialize Vector DB (Chroma)
            # Ensure directory exists
            os.makedirs(self.persistence_path, exist_ok=True)
            
            self.chroma_client = chromadb.PersistentClient(
                path=self.persistence_path,
                settings=Settings(anonymized_telemetry=False)
            )
            self.collection = self.chroma_client.get_or_create_collection(name="medical_guidelines")
            logger.info(f"ChromaDB initialized at {self.persistence_path} (Telemetry Disabled)")

            # 2. Initialize Embedding Model & Cross-Encoder
            # Bi-Encoder for fast retrieval
            self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("SentenceTransformer (all-MiniLM-L6-v2) loaded.")

            # Cross-Encoder for precise re-ranking
            # Using a lightweight but effective model
            try:
                self.cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
                logger.info("CrossEncoder (ms-marco-MiniLM-L-6-v2) loaded for re-ranking.")
            except Exception as e:
                logger.warning(f"Failed to load CrossEncoder: {e}. Re-ranking will be disabled.")
                self.cross_encoder = None

            # 3. Initialize NLP (scispaCy)
            # Fallback to standard en_core_web_sm if sci model missing
            try:
                self.nlp = spacy.load("en_core_sci_sm")
                logger.info("Loaded scispaCy model: en_core_sci_sm")
            except OSError:
                logger.warning("scispaCy model 'en_core_sci_sm' not found. Using basic entity extraction.")
                # We could load a default model or leave it None
                self.nlp = None
                
            # 4. Initialize BM25 Index
            self._build_bm25_index()
            
            # 5. Initialize Redis Cache
            try:
                redis_url = os.getenv("REDIS_URL")
                if redis_url:
                    self.redis_client = redis.from_url(redis_url, decode_responses=True)
                    logger.info(f"Redis cache initialized from URL.")
                else:
                    redis_host = os.getenv("REDIS_HOST", "localhost")
                    redis_port = int(os.getenv("REDIS_PORT", 6379))
                    self.redis_client = redis.Redis(host=redis_host, port=redis_port, db=0, decode_responses=True)
                    logger.info(f"Redis cache initialized at {redis_host}:{redis_port}")
                
                self.redis_client.ping()
            except Exception as e:
                logger.warning(f"Redis cache not available: {e}. Caching disabled.")
                self.redis_client = None
                
        except ImportError as e:
            logger.error(f"RAG dependencies missing: {e}. RAG features will be disabled.")
        except Exception as e:
            logger.error(f"Failed to initialize RAG Engine: {e}")

    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenizer for BM25."""
        if self.nlp:
            return [token.text.lower() for token in self.nlp(text)]
        else:
            return text.lower().split()

    def _build_bm25_index(self):
        """Builds in-memory BM25 index from ChromaDB documents."""
        try:
            from rank_bm25 import BM25Okapi
            
            if not self.collection:
                return

            # Fetch all documents
            # Note: For large datasets, this should be paginated or cached
            all_docs = self.collection.get()
            texts = all_docs['documents']
            metadatas = all_docs['metadatas']
            
            if not texts:
                logger.info("No documents found in ChromaDB. BM25 index is empty.")
                return

            self.bm25_docs = texts
            self.bm25_metadatas = metadatas
            self.bm25_corpus = [self._tokenize(doc) for doc in texts]
            
            self.bm25 = BM25Okapi(self.bm25_corpus)
            logger.info(f"BM25 index built with {len(texts)} documents.")
            
        except Exception as e:
            logger.warning(f"Failed to build BM25 index: {e}")
            self.bm25 = None

    def extract_medical_entities(self, text: str) -> List[Dict[str, str]]:
        """
        Extract medical entities (Diseases, Chemicals) using scispaCy.
        Standardizes messy clinical notes.
        """
        if not self.nlp:
            return []
            
        doc = self.nlp(text)
        entities = []
        for ent in doc.ents:
            entities.append({
                "text": ent.text,
                "label": ent.label_,
                # In a real impl, we would map to UMLS/SNOMED here
                "normalized": ent.text.lower() 
            })
        return entities

    def query(self, query: str, n_results: int = 3, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Retrieve relevant guideline snippets using Hybrid Search (Vector + BM25) and RRF.
        Returns structured citations.
        """
        if not self.collection or not self.embedding_model:
            return []
            
        try:
            # 0. Check Cache
            cache_key = f"rag:query:{hashlib.md5(query.encode()).hexdigest()}:n{n_results}"
            if self.redis_client:
                try:
                    cached_results = self.redis_client.get(cache_key)
                    if cached_results:
                        logger.info(f"Cache hit for query: {query}")
                        return json.loads(cached_results)
                except Exception as e:
                    logger.warning(f"Cache read failed: {e}")

            # Retrieve more candidates for re-ranking (e.g., 5x desired results)
            # This improves recall before the precision step
            initial_k = n_results * 5 if self.cross_encoder else n_results
            
            # 1. Vector Search
            query_embedding = self.embedding_model.encode([query]).tolist()
            vector_res = self.collection.query(
                query_embeddings=query_embedding,
                n_results=initial_k,
                where=filters,
                include=["documents", "metadatas", "distances"]
            )
            v_docs = vector_res['documents'][0] if vector_res['documents'] else []
            v_metas = vector_res['metadatas'][0] if vector_res['metadatas'] else []
            v_dists = vector_res['distances'][0] if vector_res['distances'] else []
            
            # 2. BM25 Search
            bm25_indices = []
            if self.bm25:
                tokenized_query = self._tokenize(query)
                scores = self.bm25.get_scores(tokenized_query)
                # Get top indices (use numpy if available, else manual sort)
                bm25_indices = np.argsort(scores)[::-1][:initial_k]
            
            # 3. RRF Fusion
            k_const = 60
            candidates_map = {} # text -> {candidate data, rrf_score}
            
            # Process Vector Hits
            for rank, (doc, meta, dist) in enumerate(zip(v_docs, v_metas, v_dists)):
                text = doc.strip() if doc else ""
                if not text: continue
                
                if text not in candidates_map:
                    candidates_map[text] = {
                        "text": doc,
                        "metadata": meta,
                        "vector_confidence": max(0.0, 1.0 - dist),
                        "rrf_score": 0.0
                    }
                candidates_map[text]["rrf_score"] += 1 / (k_const + rank + 1)

            # Process BM25 Hits
            for rank, idx in enumerate(bm25_indices):
                if idx >= len(self.bm25_docs): continue
                text = self.bm25_docs[idx].strip()
                if not text: continue
                
                meta = self.bm25_metadatas[idx]
                if text not in candidates_map:
                    candidates_map[text] = {
                        "text": self.bm25_docs[idx],
                        "metadata": meta,
                        "vector_confidence": 0.0, # Not in vector results
                        "rrf_score": 0.0
                    }
                candidates_map[text]["rrf_score"] += 1 / (k_const + rank + 1)
            
            # Flatten and Sort by RRF
            all_candidates = list(candidates_map.values())
            all_candidates.sort(key=lambda x: x['rrf_score'], reverse=True)
            
            # 4. Deduplication & Formatting
            candidates = []
            seen_pages = set()
            
            for cand in all_candidates:
                meta = cand["metadata"]
                source = meta.get('source', 'Unknown Source')
                page = meta.get('page', '')
                
                # Page-level deduplication
                page_key = f"{source}_{page}"
                if page_key in seen_pages:
                    continue
                seen_pages.add(page_key)
                
                candidates.append({
                    "source": f"{source}{f' (p.{page})' if page else ''}",
                    "text": cand["text"],
                    "confidence": round(cand["vector_confidence"], 2),
                    "url": meta.get('url', ''),
                    "metadata": meta,
                    "rrf_score": cand["rrf_score"]
                })
                
                if len(candidates) >= initial_k:
                    break
            
            # 5. Re-Ranking Step
            if self.cross_encoder and candidates:
                try:
                    # Prepare pairs for Cross-Encoder: [[query, doc_text], ...]
                    pairs = [[query, c["text"]] for c in candidates]
                    
                    # Predict scores (logits)
                    scores = self.cross_encoder.predict(pairs)
                    
                    # Attach new scores and sort
                    for i, candidate in enumerate(candidates):
                        candidate["re_rank_score"] = float(scores[i])
                    
                    # Sort by re-rank score descending
                    candidates.sort(key=lambda x: x["re_rank_score"], reverse=True)
                    
                except Exception as e:
                    logger.warning(f"Re-ranking failed: {e}. Falling back to RRF order.")
            
            # Return top N results
            final_results = candidates[:n_results]
            
            # Cache Results
            if self.redis_client and final_results:
                try:
                    self.redis_client.setex(
                        cache_key,
                        3600, # Cache for 1 hour
                        json.dumps(final_results)
                    )
                except Exception as e:
                    logger.warning(f"Cache write failed: {e}")
            
            return final_results
            
        except Exception as e:
            logger.error(f"Context retrieval failed: {e}")
            return []

    def add_documents(self, texts: List[str], metadatas: List[Dict[str, Any]], ids: List[str]):
        """
        Batch ingest documents into the vector database.
        """
        if not self.collection or not self.embedding_model:
            return False
            
        try:
            embeddings = self.embedding_model.encode(texts).tolist()
            
            self.collection.add(
                documents=texts,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )
            
            # Rebuild BM25 index
            self._build_bm25_index()
            
            return True
        except Exception as e:
            logger.error(f"Failed to add documents: {e}")
            return False

    def add_document(self, text: str, source: str, page: int = 1):
        """
        Ingest a document chunk into the vector database.
        """
        if not self.collection or not self.embedding_model:
            return False
            
        try:
            embedding = self.embedding_model.encode([text]).tolist()
            # Use stable hash (MD5) instead of Python's hash() which is randomized per process
            text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()
            doc_id = f"{source}_{page}_{text_hash}"
            
            self.collection.add(
                documents=[text],
                embeddings=embedding,
                metadatas=[{"source": source, "page": page}],
                ids=[doc_id]
            )
            return True
        except Exception as e:
            logger.error(f"Failed to add document: {e}")
            return False
