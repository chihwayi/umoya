import os
import logging
import json
import hashlib
import httpx
from typing import Optional, Dict, Any, List
from privacy_guard import redact_text, assert_no_outbound_phi
from outbound_guard import assert_egress_allowed

logger = logging.getLogger(__name__)

try:
    from settings_provider import SettingsProvider
except Exception:  # pragma: no cover - optional during isolated tests
    SettingsProvider = None  # type: ignore

_SETTINGS_PROVIDER_SINGLETON = None

class LLMProvider:
    """
    Provider for interacting with Local LLMs (via Ollama or compatible API).
    """
    
    def __init__(self, settings_provider=None):
        self.base_url = os.getenv("LLM_API_URL")
        self.enabled = os.getenv("LLM_ENABLED", "true").lower() == "true"
        if not self.base_url and self.enabled:
            logger.warning("LLM_ENABLED=true but LLM_API_URL is not configured; LLM calls will be disabled.")
        if not self.base_url:
            self.base_url = None
        self.model_name = os.getenv("LLM_MODEL_NAME")
        self.timeout = int(os.getenv("LLM_TIMEOUT_SECONDS", "30"))
        self.max_retries = max(0, int(os.getenv("LLM_MAX_RETRIES", "1")))
        self._available = None
        self.settings_provider = settings_provider if settings_provider is not None else self._load_settings_provider()

    def _load_settings_provider(self):
        global _SETTINGS_PROVIDER_SINGLETON
        if _SETTINGS_PROVIDER_SINGLETON is not None:
            return _SETTINGS_PROVIDER_SINGLETON
        if SettingsProvider is None:
            return None
        try:
            _SETTINGS_PROVIDER_SINGLETON = SettingsProvider()
        except Exception as exc:
            logger.warning("LLM governance settings unavailable: %s", exc)
            _SETTINGS_PROVIDER_SINGLETON = None
        return _SETTINGS_PROVIDER_SINGLETON

    def _resolve_use_case_policy(
        self,
        use_case: Optional[str],
        tenant_id: Optional[str],
        selected_model: Optional[str],
    ) -> Dict[str, Any]:
        normalized_use_case = str(use_case or "").strip()
        if not normalized_use_case:
            raise RuntimeError("LLM use_case is required for governed AI access")
        if self.settings_provider is None:
            raise RuntimeError("LLM governance settings provider is unavailable")

        policy = self.settings_provider.get_ai_usecase_policy(normalized_use_case, tenant_id=tenant_id)
        if not isinstance(policy, dict) or not policy:
            raise RuntimeError(f"No AI use-case policy is registered for '{normalized_use_case}'")
        if policy.get("enabled") is False:
            raise RuntimeError(
                f"AI use-case '{normalized_use_case}' is disabled"
                + (f" ({policy.get('disabled_reason')})" if policy.get("disabled_reason") else "")
            )
        if bool(policy.get("require_tenant_context")) and not str(tenant_id or "").strip():
            raise RuntimeError(f"AI use-case '{normalized_use_case}' requires tenant context")

        vendor_id = str(policy.get("vendor_id") or "").strip()
        if not vendor_id:
            raise RuntimeError(f"AI use-case '{normalized_use_case}' has no registered vendor")

        vendor = self.settings_provider.get_ai_vendor_entry(vendor_id)
        if not vendor:
            raise RuntimeError(f"AI vendor '{vendor_id}' is not registered")
        if str(vendor.get("status") or "").lower() != "active":
            raise RuntimeError(f"AI vendor '{vendor_id}' is not active")

        selected_provider = str(vendor.get("provider") or "").strip().lower()
        if selected_provider not in {"ollama", "local"}:
            raise RuntimeError(f"Unsupported AI vendor provider '{selected_provider}'")

        allowed_models = policy.get("allowed_model_names")
        normalized_allowed = [
            str(model).strip()
            for model in (allowed_models if isinstance(allowed_models, list) else [])
            if str(model).strip()
        ]
        if not normalized_allowed:
            raise RuntimeError(f"AI use-case '{normalized_use_case}' has no allowed models configured")
        if selected_model not in normalized_allowed:
            raise RuntimeError(
                f"Model '{selected_model}' is not allowed for AI use-case '{normalized_use_case}'"
            )

        required_env = vendor.get("config", {}).get("required_env")
        if isinstance(required_env, list):
            missing = [name for name in required_env if not str(os.getenv(str(name), "")).strip()]
            if missing:
                raise RuntimeError(
                    f"AI vendor '{vendor_id}' is missing required environment variables: {', '.join(missing)}"
                )

        return {
            "use_case": normalized_use_case,
            "policy": policy,
            "vendor": vendor,
        }

    def _log_policy_event(
        self,
        action: str,
        payload: Dict[str, Any],
    ) -> None:
        if self.settings_provider is None:
            return
        try:
            self.settings_provider.log_action(actor="llm_provider", action=action, payload=payload)
        except Exception as exc:
            logger.warning("Failed to write LLM policy audit event: %s", exc)

    async def check_availability(self) -> bool:
        """Check if the LLM service is reachable."""
        if not self.enabled or not self.base_url:
            return False
            
        # Re-check availability every time to handle transient failures or restarts
        # if self._available is not None:
        #    return self._available

        try:
            assert_egress_allowed(f"{self.base_url}/api/tags", purpose="llm_availability")
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

    async def generate_response(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        json_mode: bool = False,
        model_name: Optional[str] = None,
        use_case: Optional[str] = None,
        tenant_id: Optional[str] = None,
        max_tokens: Optional[int] = None,
    ) -> Optional[str]:
        """
        Generate a text response from the LLM. `max_tokens` caps the generated length
        (num_predict); a smaller cap is much faster for short summaries.
        """
        selected_model = model_name or self.model_name
        try:
            governance = self._resolve_use_case_policy(use_case, tenant_id, selected_model)
            self._log_policy_event(
                "llm_use_case_allowed",
                {
                    "use_case": governance["use_case"],
                    "tenant_id": tenant_id,
                    "model_name": selected_model,
                    "vendor_id": governance["vendor"].get("vendor_id"),
                    "json_mode": json_mode,
                },
            )
        except RuntimeError as exc:
            self._log_policy_event(
                "llm_use_case_denied",
                {
                    "use_case": use_case,
                    "tenant_id": tenant_id,
                    "model_name": selected_model,
                    "reason": str(exc),
                },
            )
            raise

        if not await self.check_availability():
            return None

        safe_prompt = redact_text(prompt)
        safe_system_prompt = redact_text(system_prompt) if system_prompt else None

        full_prompt = safe_prompt
        if safe_system_prompt:
            # Simple formatting for models that support it, or just prepend
            full_prompt = f"System: {safe_system_prompt}\n\nUser: {safe_prompt}"
        assert_no_outbound_phi(full_prompt, purpose="llm_generate")

        payload = {
            "model": selected_model,
            "prompt": full_prompt,
            "stream": False,
            "options": {
                "temperature": 0.2, # Low temperature for clinical factualness
                "num_predict": int(max_tokens) if max_tokens else 1024
            }
        }

        if json_mode:
            payload["format"] = "json"

        assert_egress_allowed(f"{self.base_url}/api/generate", purpose="llm_generate")
        last_error: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(f"{self.base_url}/api/generate", json=payload)
                    response.raise_for_status()
                    result = response.json()
                    return result.get("response", "")
            except Exception as e:
                last_error = e
                logger.warning(
                    "LLM generate attempt %s/%s failed: %s",
                    attempt + 1,
                    self.max_retries + 1,
                    repr(e),
                )

        logger.error(f"Error generating LLM response after retries: {repr(last_error)}")
        return None

    async def generate_json(
        self,
        prompt: str,
        schema_description: str,
        model_name: Optional[str] = None,
        use_case: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a structured JSON response.
        """
        system_prompt = f"You are a medical AI assistant. Output ONLY valid JSON matching this schema: {schema_description}. Do not include markdown formatting or explanations."
        
        response_text = await self.generate_response(
            prompt,
            system_prompt,
            json_mode=True,
            model_name=model_name,
            use_case=use_case,
            tenant_id=tenant_id,
        )
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
