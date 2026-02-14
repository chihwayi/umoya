import pytest

from outbound_guard import assert_egress_allowed


def test_egress_allows_configured_host(monkeypatch):
    monkeypatch.setenv("CDSS_STRICT_EGRESS_ALLOWLIST", "true")
    monkeypatch.setenv("CDSS_EGRESS_ALLOWLIST", "api.safe.example:443")
    monkeypatch.setenv("LLM_API_URL", "")
    monkeypatch.setenv("EHR_SERVICE_URL", "")

    assert_egress_allowed("https://api.safe.example:443/v1/chat", purpose="llm_generate")


def test_egress_blocks_unlisted_host(monkeypatch):
    monkeypatch.setenv("CDSS_STRICT_EGRESS_ALLOWLIST", "true")
    monkeypatch.setenv("CDSS_EGRESS_ALLOWLIST", "api.safe.example:443")
    monkeypatch.setenv("LLM_API_URL", "")
    monkeypatch.setenv("EHR_SERVICE_URL", "")

    with pytest.raises(RuntimeError, match="not in CDSS allowlist"):
        assert_egress_allowed("https://malicious.example/steal", purpose="llm_generate")
