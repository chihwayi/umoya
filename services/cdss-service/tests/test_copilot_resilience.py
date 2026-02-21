import asyncio
import sys
import types
import pytest

# Provide lightweight stubs so importing main.py does not require full cloud SDKs in test env.
if "boto3" not in sys.modules:
    boto3_stub = types.ModuleType("boto3")

    class _DummyS3Client:
        def head_bucket(self, **kwargs):
            return None

        def create_bucket(self, **kwargs):
            return None

        def upload_file(self, *args, **kwargs):
            return None

    class _DummySessionConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    boto3_stub.client = lambda *args, **kwargs: _DummyS3Client()
    boto3_stub.session = types.SimpleNamespace(Config=_DummySessionConfig)
    sys.modules["boto3"] = boto3_stub

if "botocore.exceptions" not in sys.modules:
    botocore_exceptions_stub = types.ModuleType("botocore.exceptions")

    class NoCredentialsError(Exception):
        pass

    class ClientError(Exception):
        def __init__(self, response=None):
            super().__init__("ClientError")
            self.response = response or {"Error": {"Code": "500"}}

    botocore_exceptions_stub.NoCredentialsError = NoCredentialsError
    botocore_exceptions_stub.ClientError = ClientError
    sys.modules["botocore.exceptions"] = botocore_exceptions_stub

_IMPORT_ERROR = None
try:
    import main as cdss_main
except ModuleNotFoundError as exc:
    cdss_main = None
    _IMPORT_ERROR = str(exc)


class _DummyRequest:
    def __init__(self, tenant_id: str = "tenant-a") -> None:
        self.headers = {"x-tenant-id": tenant_id}


def test_run_copilot_with_resilience_retries_then_succeeds(monkeypatch):
    if cdss_main is None:
        pytest.skip(f"cdss main dependencies unavailable in test env: {_IMPORT_ERROR}")
    monkeypatch.setattr(cdss_main, "COPILOT_RETRY_MAX", 1)
    monkeypatch.setattr(cdss_main, "COPILOT_TIMEOUT_SECONDS", 1.0)
    monkeypatch.setattr(cdss_main, "COPILOT_RETRY_BASE_SECONDS", 0.0)

    attempts = {"count": 0}

    async def _fn():
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise asyncio.TimeoutError()
        return {"ok": True}

    result = asyncio.run(cdss_main._run_copilot_with_resilience("unit_test", _fn))
    assert result == {"ok": True}
    assert attempts["count"] == 2


def test_intelligent_diagnosis_returns_safe_fallback(monkeypatch):
    if cdss_main is None:
        pytest.skip(f"cdss main dependencies unavailable in test env: {_IMPORT_ERROR}")
    class _FailingAssistant:
        async def intelligent_suggest(self, **kwargs):
            raise RuntimeError("service down")

    monkeypatch.setattr(cdss_main, "diagnostic_assistant", _FailingAssistant())
    monkeypatch.setattr(cdss_main, "settings_provider", None)
    monkeypatch.setattr(cdss_main, "COPILOT_RETRY_MAX", 0)

    payload = cdss_main.IntelligentDiagnosisRequest(symptoms=["fever"], age=10, gender="female")
    result = asyncio.run(cdss_main.intelligent_diagnosis(payload, _DummyRequest()))

    assert result["abstained"] is True
    assert result["abstain_reason"] == "service_unavailable"
    assert result["source"] == "safe_fallback"
    assert result["suggested_diagnoses"] == []
    assert result["model_trace"]["request_sha256"]
    assert result["input_policy"]["allowlist_applied"] is True


def test_patient_summarize_returns_safe_fallback(monkeypatch):
    if cdss_main is None:
        pytest.skip(f"cdss main dependencies unavailable in test env: {_IMPORT_ERROR}")
    class _FailingAssistant:
        async def summarize_patient_history(self, **kwargs):
            raise RuntimeError("summary backend unavailable")

    monkeypatch.setattr(cdss_main, "diagnostic_assistant", _FailingAssistant())
    monkeypatch.setattr(cdss_main, "settings_provider", None)
    monkeypatch.setattr(cdss_main, "COPILOT_RETRY_MAX", 0)

    payload = cdss_main.PatientSummaryRequest(
        clinical_notes=["Patient has cough and fever"],
        age=34,
        gender="male",
        recent_vitals={"heartRate": 90},
    )
    result = asyncio.run(cdss_main.summarize_patient_history(payload))

    assert result["source"] == "safe_fallback"
    assert result["summary"] == ""
    assert result["input_policy"]["phi_minimized"] is True
    assert len(result["warnings"]) == 1
