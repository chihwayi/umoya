import os
import logging
import json
import hashlib
import httpx
from typing import Optional, Dict, Any, List
from privacy_guard import redact_text

logger = logging.getLogger(__name__)

class LLMProvider:
    """
    Provider for interacting with Local LLMs (via Ollama or compatible API).
    """
    
    def __init__(self):
        self.base_url = os.getenv("LLM_API_URL")
        self.enabled = os.getenv("LLM_ENABLED", "true").lower() == "true"
        
        if not self.base_url:
            if self.enabled:
                # Default to Docker internal host if not specified
                default_url = "http://host.docker.internal:11434"
                logger.info(f"LLM_API_URL not set, defaulting to {default_url}")
                self.base_url = default_url
            else:
                self.base_url = None
                
        self.model_name = os.getenv("LLM_MODEL_NAME")
        self.timeout = int(os.getenv("LLM_TIMEOUT_SECONDS", "30"))
        self._available = None

    async def check_availability(self) -> bool:
        """Check if the LLM service is reachable."""
        if not self.enabled:
            return False
            
        # Re-check availability every time to handle transient failures or restarts
        # if self._available is not None:
        #    return self._available

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Ollama has a /api/tags endpoint to list models
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    self._available = True
                    # Enforce strict model selection from environment
                    try:
                        if not self.model_name:
                            logger.error("LLM model not set. Please configure LLM_MODEL_NAME in environment.")
                            self._available = False
                            return False
                        data = response.json()
                        available = [m.get("name") for m in data.get("models", []) if m.get("name")]
                        if available and self.model_name not in available:
                            logger.error(f"Configured LLM model '{self.model_name}' not found in local tags: {available}.")
                            self._available = False
                            return False
                    except Exception as e:
                        logger.error(f"Failed to validate LLM model list: {e}")
                        self._available = False
                        return False
                    logger.info(f"Connected to Local LLM at {self.base_url}")
                    return True
        except Exception as e:
            logger.warning(f"Local LLM not available at {self.base_url}: {e}")
            self._available = False
            
        return False

    async def generate_response(self, prompt: str, system_prompt: Optional[str] = None, json_mode: bool = False) -> Optional[str]:
        """
        Generate a text response from the LLM.
        """
        if not await self.check_availability():
            return None

        safe_prompt = redact_text(prompt)
        safe_system_prompt = redact_text(system_prompt) if system_prompt else None

        full_prompt = safe_prompt
        if system_prompt:
            # Simple formatting for models that support it, or just prepend
            full_prompt = f"System: {safe_system_prompt}\n\nUser: {safe_prompt}"

        payload = {
            "model": self.model_name,
            "prompt": full_prompt,
            "stream": False,
            "options": {
                "temperature": 0.2, # Low temperature for clinical factualness
                "num_predict": 1024  # Increased for detailed JSON
            }
        }

        if json_mode:
            payload["format"] = "json"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(f"{self.base_url}/api/generate", json=payload)
                response.raise_for_status()
                result = response.json()
                return result.get("response", "")
        except Exception as e:
            logger.error(f"Error generating LLM response: {repr(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return None

    async def generate_json(self, prompt: str, schema_description: str) -> Optional[Dict[str, Any]]:
        """
        Generate a structured JSON response.
        """
        system_prompt = f"You are a medical AI assistant. Output ONLY valid JSON matching this schema: {schema_description}. Do not include markdown formatting or explanations."
        
        response_text = await self.generate_response(prompt, system_prompt, json_mode=True)
        if not response_text:
            return None

        try:
            # Attempt 1: Clean parse (if model obeyed "ONLY valid JSON")
            return json.loads(response_text)
        except json.JSONDecodeError:
            pass

        try:
            # Attempt 2: Extract from markdown code blocks
            import re
            code_block_pattern = r"```(?:json)?\s*(\{.*?\})\s*```"
            match = re.search(code_block_pattern, response_text, re.DOTALL)
            if match:
                return json.loads(match.group(1))
                
            # Attempt 3: Naive extraction from first { to last }
            start = response_text.find('{')
            end = response_text.rfind('}')
            if start != -1 and end != -1 and end > start:
                return json.loads(response_text[start:end+1])
                
            # If all fails, log only non-sensitive metadata
            digest = hashlib.sha256(response_text.encode("utf-8")).hexdigest()[:12]
            logger.error(f"Failed to parse LLM JSON response. len={len(response_text)} sha256={digest}")
            return None
        except json.JSONDecodeError:
            digest = hashlib.sha256(response_text.encode("utf-8")).hexdigest()[:12]
            logger.error(f"Failed to parse LLM JSON response after extraction. len={len(response_text)} sha256={digest}")
            return None
