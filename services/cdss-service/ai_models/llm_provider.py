import asyncio
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

try:
    import anthropic as _anthropic_sdk
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _anthropic_sdk = None  # type: ignore
    _ANTHROPIC_AVAILABLE = False

try:
    import openai as _openai_sdk
    _OPENAI_AVAILABLE = True
except ImportError:
    _openai_sdk = None  # type: ignore
    _OPENAI_AVAILABLE = False

try:
    import google.genai as _genai_sdk
    import google.genai.types as _genai_types
    _GEMINI_AVAILABLE = True
except ImportError:
    _genai_sdk = None  # type: ignore
    _genai_types = None  # type: ignore
    _GEMINI_AVAILABLE = False

_SETTINGS_PROVIDER_SINGLETON = None

_PROVIDER_PRIORITY = ["anthropic", "openai", "gemini", "ollama"]


def _detect_active_provider() -> str:
    """Auto-detect the best available provider based on configured API keys."""
    if os.getenv("ANTHROPIC_API_KEY", "").strip():
        return "anthropic"
    if os.getenv("OPENAI_API_KEY", "").strip():
        return "openai"
    if os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip():
        return "gemini"
    return "ollama"


ACTIVE_PROVIDER = _detect_active_provider()


class LLMProvider:
    """
    Multi-provider LLM client supporting:
    - Anthropic Claude (ANTHROPIC_API_KEY)
    - OpenAI / ChatGPT (OPENAI_API_KEY)
    - Google Gemini (GEMINI_API_KEY or GOOGLE_API_KEY)
    - Local Ollama (LLM_API_URL)

    Provider selection: first key found wins (priority: Anthropic > OpenAI > Gemini > Ollama).
    Override with LLM_PROVIDER env var.
    """

    def __init__(self, settings_provider=None):
        explicit = os.getenv("LLM_PROVIDER", "").strip().lower()
        self.provider = explicit if explicit in ("anthropic", "openai", "gemini", "ollama") else ACTIVE_PROVIDER
        self.enabled = os.getenv("LLM_ENABLED", "true").lower() == "true"
        self.timeout = int(os.getenv("LLM_TIMEOUT_SECONDS", "30"))
        self.max_retries = max(0, int(os.getenv("LLM_MAX_RETRIES", "1")))
        self._available = None

        # Provider-specific config
        self.base_url = os.getenv("LLM_API_URL")  # Ollama
        if not self.base_url:
            self.base_url = None

        if self.provider == "anthropic":
            self.model_name = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
        elif self.provider == "openai":
            self.model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        elif self.provider == "gemini":
            self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        else:
            self.model_name = os.getenv("LLM_MODEL_NAME", "llama3.1:latest")

        self.settings_provider = settings_provider if settings_provider is not None else self._load_settings_provider()

        if self.provider == "anthropic":
            logger.info("LLMProvider: Anthropic Claude (%s)", self.model_name)
        elif self.provider == "openai":
            logger.info("LLMProvider: OpenAI (%s)", self.model_name)
        elif self.provider == "gemini":
            logger.info("LLMProvider: Google Gemini (%s)", self.model_name)
        else:
            logger.info("LLMProvider: Ollama (%s @ %s)", self.model_name, self.base_url)

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
        if selected_provider not in {"ollama", "local", "anthropic", "openai", "gemini"}:
            raise RuntimeError(f"Unsupported AI vendor provider '{selected_provider}'")

        allowed_models = policy.get("allowed_model_names")
        normalized_allowed = [
            str(model).strip()
            for model in (allowed_models if isinstance(allowed_models, list) else [])
            if str(model).strip()
        ]
        # Cloud providers: allow any model from that family
        cloud_prefixes = {
            "anthropic": "claude-",
            "openai": ("gpt-", "o1", "o3"),
            "gemini": "gemini-",
        }
        prefix = cloud_prefixes.get(self.provider)
        if prefix and selected_model:
            if isinstance(prefix, tuple):
                if any(str(selected_model).startswith(p) for p in prefix):
                    pass  # allow
                elif normalized_allowed and selected_model not in normalized_allowed:
                    raise RuntimeError(
                        f"Model '{selected_model}' is not allowed for AI use-case '{normalized_use_case}'"
                    )
            elif str(selected_model).startswith(prefix):
                pass  # allow
            elif normalized_allowed and selected_model not in normalized_allowed:
                raise RuntimeError(
                    f"Model '{selected_model}' is not allowed for AI use-case '{normalized_use_case}'"
                )
        elif normalized_allowed and selected_model not in normalized_allowed:
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

    def _log_policy_event(self, action: str, payload: Dict[str, Any]) -> None:
        if self.settings_provider is None:
            return
        try:
            self.settings_provider.log_action(actor="llm_provider", action=action, payload=payload)
        except Exception as exc:
            logger.warning("Failed to write LLM policy audit event: %s", exc)

    async def check_availability(self) -> bool:
        if not self.enabled:
            return False

        if self.provider == "anthropic":
            if not os.getenv("ANTHROPIC_API_KEY", "").strip() or not _ANTHROPIC_AVAILABLE:
                logger.warning("Anthropic SDK or ANTHROPIC_API_KEY not available.")
                return False
            self._available = True
            return True

        if self.provider == "openai":
            if not os.getenv("OPENAI_API_KEY", "").strip() or not _OPENAI_AVAILABLE:
                logger.warning("OpenAI SDK or OPENAI_API_KEY not available.")
                return False
            self._available = True
            return True

        if self.provider == "gemini":
            if not _GEMINI_AVAILABLE:
                logger.warning("Gemini SDK (google-genai) not installed.")
                return False
            has_vertex = bool(os.getenv("GOOGLE_CLOUD_PROJECT", "").strip())
            has_api_key = bool(os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip())
            if not has_vertex and not has_api_key:
                logger.warning("Gemini: neither GOOGLE_CLOUD_PROJECT nor GEMINI_API_KEY is set.")
                return False
            self._available = True
            return True

        # Ollama
        if not self.base_url:
            return False
        try:
            assert_egress_allowed(f"{self.base_url}/api/tags", purpose="llm_availability")
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    if not self.model_name:
                        logger.error("LLM model not set. Please configure LLM_MODEL_NAME.")
                        return False
                    try:
                        data = response.json()
                        available = [m.get("name") for m in data.get("models", []) if m.get("name")]
                        if available and self.model_name not in available:
                            logger.error(
                                "Configured LLM model '%s' not found in local tags: %s.",
                                self.model_name,
                                available,
                            )
                            return False
                    except Exception as e:
                        logger.error("Failed to validate LLM model list: %s", e)
                        return False
                    self._available = True
                    logger.info("Connected to Local LLM at %s", self.base_url)
                    return True
        except Exception as e:
            logger.warning("Local LLM not available at %s: %s", self.base_url, e)
        return False

    # ---- Synchronous backend calls (run in threadpool to avoid blocking event loop) ----

    def _sync_anthropic(self, prompt: str, system_prompt: Optional[str], json_mode: bool, max_tokens: int) -> Optional[str]:
        api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        if not api_key or not _ANTHROPIC_AVAILABLE:
            return None
        assert_egress_allowed("https://api.anthropic.com", purpose="llm_generate")
        try:
            client = _anthropic_sdk.Anthropic(api_key=api_key)
            sys = system_prompt or ""
            if json_mode and "json" not in sys.lower():
                sys = (sys + "\n\nRespond with ONLY valid JSON. No markdown, no explanation.").strip()
            response = client.messages.create(
                model=self.model_name,
                max_tokens=max_tokens,
                system=sys,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text if response.content else None
        except Exception as e:
            logger.error("Anthropic API error: %s", repr(e))
            return None

    def _sync_openai(self, prompt: str, system_prompt: Optional[str], json_mode: bool, max_tokens: int) -> Optional[str]:
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key or not _OPENAI_AVAILABLE:
            return None
        assert_egress_allowed("https://api.openai.com", purpose="llm_generate")
        try:
            client = _openai_sdk.OpenAI(api_key=api_key)
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            kwargs: Dict[str, Any] = {
                "model": self.model_name,
                "messages": messages,
                "max_tokens": max_tokens,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            response = client.chat.completions.create(**kwargs)
            return response.choices[0].message.content if response.choices else None
        except Exception as e:
            logger.error("OpenAI API error: %s", repr(e))
            return None

    def _sync_gemini(self, prompt: str, system_prompt: Optional[str], json_mode: bool, max_tokens: int) -> Optional[str]:
        if not _GEMINI_AVAILABLE:
            return None
        gcp_project = os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
        gcp_location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1").strip()
        gemini_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()

        if gcp_project:
            # Vertex AI mode — HIPAA-eligible, uses GOOGLE_APPLICATION_CREDENTIALS (SA JSON)
            assert_egress_allowed(
                f"https://{gcp_location}-aiplatform.googleapis.com", purpose="llm_generate"
            )
            try:
                client = _genai_sdk.Client(vertexai=True, project=gcp_project, location=gcp_location)
            except Exception as e:
                logger.error("Vertex AI client init error: %s", repr(e))
                return None
        elif gemini_key:
            # Fallback: standard Gemini API key
            assert_egress_allowed("https://generativelanguage.googleapis.com", purpose="llm_generate")
            try:
                client = _genai_sdk.Client(api_key=gemini_key)
            except Exception as e:
                logger.error("Gemini API key client init error: %s", repr(e))
                return None
        else:
            logger.error("Gemini: no credentials configured.")
            return None

        try:
            cfg = _genai_types.GenerateContentConfig(
                system_instruction=system_prompt or None,
                max_output_tokens=max_tokens,
                response_mime_type="application/json" if json_mode else "text/plain",
            )
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=cfg,
            )
            return response.text if response.text else None
        except Exception as e:
            logger.error("Gemini API error: %s", repr(e))
            return None

    # ---- Async wrappers (run sync calls in threadpool) ----

    async def _generate_anthropic(self, prompt: str, system_prompt: Optional[str], json_mode: bool, max_tokens: int) -> Optional[str]:
        return await asyncio.to_thread(self._sync_anthropic, prompt, system_prompt, json_mode, max_tokens)

    async def _generate_openai(self, prompt: str, system_prompt: Optional[str], json_mode: bool, max_tokens: int) -> Optional[str]:
        return await asyncio.to_thread(self._sync_openai, prompt, system_prompt, json_mode, max_tokens)

    async def _generate_gemini(self, prompt: str, system_prompt: Optional[str], json_mode: bool, max_tokens: int) -> Optional[str]:
        return await asyncio.to_thread(self._sync_gemini, prompt, system_prompt, json_mode, max_tokens)

    async def _generate_ollama(self, full_prompt: str, json_mode: bool, max_tokens: int) -> Optional[str]:
        payload: Dict[str, Any] = {
            "model": self.model_name,
            "prompt": full_prompt,
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": max_tokens},
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
                    return response.json().get("response", "")
            except Exception as e:
                last_error = e
                logger.warning("LLM generate attempt %s/%s failed: %s", attempt + 1, self.max_retries + 1, repr(e))
        logger.error("Error generating LLM response after retries: %s", repr(last_error))
        return None

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
                    "provider": self.provider,
                },
            )
        except RuntimeError as exc:
            self._log_policy_event(
                "llm_use_case_denied",
                {"use_case": use_case, "tenant_id": tenant_id, "model_name": selected_model, "reason": str(exc)},
            )
            raise

        if not await self.check_availability():
            return None

        safe_prompt = redact_text(prompt)
        safe_system = redact_text(system_prompt) if system_prompt else None
        assert_no_outbound_phi(safe_prompt, purpose="llm_generate")

        tokens = int(max_tokens) if max_tokens else 1024

        if self.provider == "anthropic":
            return await self._generate_anthropic(safe_prompt, safe_system, json_mode, tokens)
        if self.provider == "openai":
            return await self._generate_openai(safe_prompt, safe_system, json_mode, tokens)
        if self.provider == "gemini":
            return await self._generate_gemini(safe_prompt, safe_system, json_mode, tokens)

        # Ollama
        full_prompt = safe_prompt
        if safe_system:
            full_prompt = f"System: {safe_system}\n\nUser: {safe_prompt}"
        return await self._generate_ollama(full_prompt, json_mode, tokens)

    async def generate_json(
        self,
        prompt: str,
        schema_description: str,
        model_name: Optional[str] = None,
        use_case: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        system_prompt = (
            f"You are a medical AI assistant. Output ONLY valid JSON matching this schema: "
            f"{schema_description}. Do not include markdown formatting or explanations."
        )
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
            return json.loads(response_text)
        except json.JSONDecodeError:
            pass

        try:
            import re
            match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response_text, re.DOTALL)
            if match:
                return json.loads(match.group(1))
            start = response_text.find("{")
            end = response_text.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(response_text[start : end + 1])
            digest = hashlib.sha256(response_text.encode("utf-8")).hexdigest()[:12]
            logger.error("Failed to parse LLM JSON response. len=%d sha256=%s", len(response_text), digest)
            return None
        except json.JSONDecodeError:
            digest = hashlib.sha256(response_text.encode("utf-8")).hexdigest()[:12]
            logger.error("Failed to parse LLM JSON after extraction. len=%d sha256=%s", len(response_text), digest)
            return None
