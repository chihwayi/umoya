import time

import jwt
from fastapi.testclient import TestClient

import main


def _service_token(secret: str, scope: str) -> str:
    now = int(time.time())
    payload = {
        "sub": "ehr-service",
        "iss": "issuer-test",
        "aud": "aud-test",
        "jti": f"jti-{now}-{scope.replace('.', '-')}",
        "iat": now,
        "exp": now + 120,
        "scope": scope,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def test_scope_strict_blocks_missing_scope(monkeypatch):
    monkeypatch.setattr(main, "SERVICE_AUTH_REQUIRED", True)
    monkeypatch.setattr(main, "SERVICE_AUTH_MODE", "jwt")
    monkeypatch.setattr(main, "SERVICE_AUTH_JWT_SECRET", "test_service_jwt_secret_0123456789")
    monkeypatch.setattr(main, "SERVICE_AUTH_ISSUER", "issuer-test")
    monkeypatch.setattr(main, "SERVICE_AUTH_AUDIENCE", "aud-test")
    monkeypatch.setattr(main, "SERVICE_AUTH_SCOPE_STRICT", True)
    monkeypatch.setattr(main, "_mark_service_jti_once", lambda claims: (True, None))

    token = _service_token("test_service_jwt_secret_0123456789", "cdss.api.invoke")

    with TestClient(main.app) as client:
        response = client.post(
            "/guidelines/search",
            json={"query": "hiv"},
            headers={"Authorization": f"Bearer {token}", "X-Tenant-ID": "tenant-a"},
        )

    assert response.status_code == 401
    details = str(response.json().get("details") or "")
    assert "Missing required service scope" in details


def test_scope_strict_allows_required_scope(monkeypatch):
    monkeypatch.setattr(main, "SERVICE_AUTH_REQUIRED", True)
    monkeypatch.setattr(main, "SERVICE_AUTH_MODE", "jwt")
    monkeypatch.setattr(main, "SERVICE_AUTH_JWT_SECRET", "test_service_jwt_secret_0123456789")
    monkeypatch.setattr(main, "SERVICE_AUTH_ISSUER", "issuer-test")
    monkeypatch.setattr(main, "SERVICE_AUTH_AUDIENCE", "aud-test")
    monkeypatch.setattr(main, "SERVICE_AUTH_SCOPE_STRICT", True)
    monkeypatch.setattr(main, "_mark_service_jti_once", lambda claims: (True, None))

    token = _service_token("test_service_jwt_secret_0123456789", "cdss.copilot.guidelines.read")

    with TestClient(main.app) as client:
        response = client.post(
            "/guidelines/search",
            json={"query": "hiv"},
            headers={"Authorization": f"Bearer {token}", "X-Tenant-ID": "tenant-a"},
        )

    assert response.status_code != 401
