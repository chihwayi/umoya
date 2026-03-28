import asyncio

import pytest

from ai_models import llm_provider as llm_provider_module


class _FakeSettingsProvider:
    def __init__(self, use_case_policy=None, vendor=None):
        self.use_case_policy = use_case_policy or {}
        self.vendor = vendor or {}
        self.audit_events = []

    def get_ai_usecase_policy(self, use_case, tenant_id=None):
        return dict(self.use_case_policy)

    def get_ai_vendor_entry(self, vendor_id):
        return dict(self.vendor)

    def log_action(self, actor, action, payload=None):
        self.audit_events.append({"actor": actor, "action": action, "payload": payload or {}})


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload
        self.status_code = 200

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, json):
        return _FakeResponse({"response": "ok"})


def test_generate_response_requires_use_case():
    provider = llm_provider_module.LLMProvider(settings_provider=_FakeSettingsProvider())
    provider.enabled = False

    with pytest.raises(RuntimeError, match="use_case is required"):
        asyncio.run(provider.generate_response("hello"))


def test_generate_response_blocks_unregistered_policy():
    provider = llm_provider_module.LLMProvider(settings_provider=_FakeSettingsProvider())
    provider.enabled = False

    with pytest.raises(RuntimeError, match="No AI use-case policy"):
        asyncio.run(
            provider.generate_response(
                "hello",
                use_case="patient_summarization",
                tenant_id="tenant-a",
            )
        )


def test_generate_response_allows_registered_policy(monkeypatch):
    fake_settings = _FakeSettingsProvider(
        use_case_policy={
            "enabled": True,
            "vendor_id": "ollama",
            "allowed_model_names": ["medicore-llm"],
            "require_tenant_context": True,
        },
        vendor={
            "vendor_id": "ollama",
            "provider": "ollama",
            "status": "active",
            "config": {"required_env": []},
        },
    )
    provider = llm_provider_module.LLMProvider(settings_provider=fake_settings)
    provider.base_url = "http://llm.local"
    provider.model_name = "medicore-llm"
    provider.enabled = True

    async def _always_available():
        return True

    monkeypatch.setattr(provider, "check_availability", _always_available)
    monkeypatch.setattr(llm_provider_module.httpx, "AsyncClient", _FakeAsyncClient)
    monkeypatch.setattr(llm_provider_module, "assert_egress_allowed", lambda *args, **kwargs: None)
    monkeypatch.setattr(llm_provider_module, "assert_no_outbound_phi", lambda *args, **kwargs: None)

    response = asyncio.run(
        provider.generate_response(
            "Summarize the patient context.",
            use_case="patient_summarization",
            tenant_id="tenant-a",
        )
    )

    assert response == "ok"
    assert any(event["action"] == "llm_use_case_allowed" for event in fake_settings.audit_events)
