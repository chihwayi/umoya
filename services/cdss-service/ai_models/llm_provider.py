import os
import logging
import json
import httpx
from typing import Optional, Dict, Any, List

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
                
        self.model_name = os.getenv("LLM_MODEL_NAME", "llama3")
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
                    logger.info(f"Connected to Local LLM at {self.base_url}")
                    return True
        except Exception as e:
            logger.warning(f"Local LLM not available at {self.base_url}: {e}")
            self._available = False
            
        return False

    async def generate_response(self, prompt: str, system_prompt: Optional[str] = None) -> Optional[str]:
        """
        Generate a text response from the LLM.
        """
        if not await self.check_availability():
            return None

        full_prompt = prompt
        if system_prompt:
            # Simple formatting for models that support it, or just prepend
            full_prompt = f"System: {system_prompt}\n\nUser: {prompt}"

        payload = {
            "model": self.model_name,
            "prompt": full_prompt,
            "stream": False,
            "options": {
                "temperature": 0.2, # Low temperature for clinical factualness
                "num_predict": 512
            }
        }

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
        
        response_text = await self.generate_response(prompt, system_prompt)
        if not response_text:
            return None

        try:
            # Clean up potential markdown code blocks
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            return json.loads(clean_text)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse LLM JSON response: {response_text}")
            return None
