import time

import jwt
import pytest

from service_auth import decode_service_jwt, extract_owner_claim_sets, is_owner_scope_allowed


def _token(secret: str, issuer: str = "issuer", audience: str = "aud", **overrides):
    payload = {
        "sub": "ehr-service",
        "iss": issuer,
        "aud": audience,
        "jti": "jti-1",
        "iat": int(time.time()),
        "exp": int(time.time()) + 300,
    }
    payload.update(overrides)
    return jwt.encode(payload, secret, algorithm="HS256")


def test_decode_service_jwt_accepts_valid_token():
    token = _token(secret="supersecret")
    claims = decode_service_jwt(token=token, secret="supersecret", audience="aud", issuer="issuer")
    assert claims["sub"] == "ehr-service"


def test_decode_service_jwt_rejects_invalid_issuer():
    token = _token(secret="supersecret", issuer="wrong-issuer")
    with pytest.raises(jwt.InvalidIssuerError):
        decode_service_jwt(token=token, secret="supersecret", audience="aud", issuer="issuer")


def test_decode_service_jwt_rejects_invalid_audience():
    token = _token(secret="supersecret", audience="wrong-aud")
    with pytest.raises(jwt.InvalidAudienceError):
        decode_service_jwt(token=token, secret="supersecret", audience="aud", issuer="issuer")


def test_decode_service_jwt_rejects_invalid_signature():
    token = _token(secret="wrong-secret")
    with pytest.raises(jwt.InvalidSignatureError):
        decode_service_jwt(token=token, secret="supersecret", audience="aud", issuer="issuer")


def test_extract_owner_claim_sets_and_scope_allowance():
    claims = extract_owner_claim_sets(
        {
            "roles": ["admin"],
            "scope": "cdss.admin.settings.read cdss.admin.jobs.write",
            "permissions": ["cdss.admin.metrics.*"],
        }
    )
    assert is_owner_scope_allowed(claims, "cdss.admin.settings.read")
    assert is_owner_scope_allowed(claims, "cdss.admin.metrics.read")
    assert not is_owner_scope_allowed(claims, "cdss.admin.audit.read")
