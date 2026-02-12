
import os
import logging
import hashlib
from typing import List, Dict, Any, Optional

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
        self.nlp = None
        self._initialize_components()

    def _initialize_components(self):
        """Initialize ChromaDB, Embedding Model, and NLP tools."""
        try:
            import chromadb
            from chromadb.config import Settings
            from sentence_transformers import SentenceTransformer
            import spacy
            
            # 1. Initialize Vector DB (Chroma)
            # Ensure directory exists
            os.makedirs(self.persistence_path, exist_ok=True)
            
            self.chroma_client = chromadb.PersistentClient(
                path=self.persistence_path,
                settings=Settings(anonymized_telemetry=False)
            )
            self.collection = self.chroma_client.get_or_create_collection(name="medical_guidelines")
            logger.info(f"ChromaDB initialized at {self.persistence_path} (Telemetry Disabled)")

            # 2. Initialize Embedding Model
            # Using all-MiniLM-L6-v2 for efficiency (lightweight, good performance)
            self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("SentenceTransformer (all-MiniLM-L6-v2) loaded.")

            # 3. Initialize NLP (scispaCy)
            # Fallback to standard en_core_web_sm if sci model missing
            try:
                self.nlp = spacy.load("en_core_sci_sm")
                logger.info("Loaded scispaCy model: en_core_sci_sm")
            except OSError:
                logger.warning("scispaCy model 'en_core_sci_sm' not found. Using basic entity extraction.")
                # We could load a default model or leave it None
                self.nlp = None
                
        except ImportError as e:
            logger.error(f"RAG dependencies missing: {e}. RAG features will be disabled.")
        except Exception as e:
            logger.error(f"Failed to initialize RAG Engine: {e}")

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
        Retrieve relevant guideline snippets from the Vector DB.
        Returns structured citations.
        """
        if not self.collection or not self.embedding_model:
            return []
            
        try:
            # Generate embedding for the query
            query_embedding = self.embedding_model.encode([query]).tolist()
            
            # Query Chroma
            results = self.collection.query(
                query_embeddings=query_embedding,
                n_results=n_results,
                where=filters,
                include=["documents", "metadatas", "distances"]
            )
            
            # Flatten results (Chroma returns list of lists)
            documents = results['documents'][0] if results['documents'] else []
            metadatas = results['metadatas'][0] if results['metadatas'] else []
            distances = results['distances'][0] if results['distances'] else []
            
            formatted_results = []
            seen_texts = set()
            seen_pages = set()
            
            for i, (doc, meta) in enumerate(zip(documents, metadatas)):
                # Deduplication logic: skip if we've seen this exact text before
                # Normalize text (strip whitespace) for comparison
                text_content = doc.strip() if doc else ""
                if text_content in seen_texts:
                    continue
                
                source = meta.get('source', 'Unknown Source')
                page = meta.get('page', '')
                
                # Page-level deduplication: Max 1 chunk per page per source
                # This prevents clustering of results from a single relevant page
                page_key = f"{source}_{page}"
                if page_key in seen_pages:
                    continue
                
                seen_texts.add(text_content)
                seen_pages.add(page_key)
                
                url = meta.get('url', '')
                
                # Calculate confidence (1 - distance for cosine distance)
                confidence = 0.0
                if i < len(distances):
                    confidence = max(0.0, 1.0 - distances[i])
                
                citation = {
                    "source": f"{source}{f' (p.{page})' if page else ''}",
                    "text": doc,
                    "confidence": round(confidence, 2),
                    "url": url,
                    "metadata": meta
                }
                formatted_results.append(citation)
                
            return formatted_results
            
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
            return True
        except Exception as e:
            logger.error(f"Failed to add documents batch: {e}")
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
