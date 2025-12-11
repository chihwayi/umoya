"""
Model Loader - Lazy loading and caching for AI models
Prevents loading models on every request (expensive operation)
"""

import os
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Global model cache
_model_cache = {}

def get_model_cache():
    """Get the global model cache"""
    return _model_cache

def clear_model_cache():
    """Clear the model cache (useful for testing or memory management)"""
    global _model_cache
    _model_cache = {}
    logger.info("Model cache cleared")

def is_ai_enabled() -> bool:
    """Check if AI models are enabled via environment variable"""
    return os.getenv('CDSS_ENABLE_AI', 'true').lower() == 'true'
