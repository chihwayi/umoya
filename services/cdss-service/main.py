"""
MediCore Clinical Decision Support System (CDSS) Service
Python FastAPI microservice for advanced clinical reasoning
"""
from fastapi import FastAPI, HTTPException, Depends, Header, Form, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi.responses import JSONResponse
import time
import asyncio
import uvicorn
import httpx
import os
import hmac
import re
import shlex
import shutil
import tempfile
import hashlib
import json
import subprocess
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from fastapi import UploadFile, File, Form
from drug_interactions import DrugInteractionAnalyzer
from clinical_guidelines import ClinicalGuidelinesEngine
from risk_scoring import RiskScoringEngine
from dosing_calculator import DosingCalculator
from diagnostic_assistant import DiagnosticAssistant
from trend_analysis import TrendAnalysisEngine
from lab_interpreter import LabResultInterpreter
from duplicate_therapy import DuplicateTherapyDetector
from high_risk_medications import HighRiskMedicationDetector
from food_interactions import FoodInteractionChecker
from settings_provider import SettingsProvider
from privacy_guard import redact_text, redact_value
from ai_governance import assert_no_phi_in_payload, compute_request_hash
from service_auth import (
    decode_service_jwt,
    extract_service_claim_scopes,
    extract_owner_claim_sets,
    is_service_scope_allowed,
    is_owner_scope_allowed,
)
import jwt
import threading
import pathlib
import redis as redis_pkg
from uuid import uuid4
from threading import Lock

_DEV_LIKE_ENVIRONMENTS = {"dev", "development", "local", "test"}


def _is_dev_like_env(env: str) -> bool:
    return str(env or "").strip().lower() in _DEV_LIKE_ENVIRONMENTS


def _parse_cors_origins(raw_origins: Optional[str]) -> List[str]:
    if raw_origins is None:
        return []
    return [origin.strip() for origin in str(raw_origins).split(",") if origin.strip()]


def _validate_cors_origin_format(origin: str) -> None:
    if origin == "*":
        return
    if not re.match(r"^https?://[A-Za-z0-9.-]+(?::\d{1,5})?$", origin):
        raise RuntimeError(
            f"Invalid CORS origin '{origin}'. Use explicit origin format like https://app.example.com."
        )


def _resolve_cors_origins(env: Optional[str] = None, raw_origins: Optional[str] = None) -> List[str]:
    normalized_env = str(env or os.getenv("ENVIRONMENT", "development")).strip().lower() or "development"
    parsed_origins = _parse_cors_origins(os.getenv("CORS_ORIGINS") if raw_origins is None else raw_origins)
    if not parsed_origins:
        if _is_dev_like_env(normalized_env):
            return ["*"]
        raise RuntimeError("CORS_ORIGINS must be configured with explicit origins in non-development environment.")
    for origin in parsed_origins:
        _validate_cors_origin_format(origin)
    if not _is_dev_like_env(normalized_env) and "*" in parsed_origins:
        raise RuntimeError("CORS_ORIGINS cannot include '*' in non-development environment.")
    # Preserve declared order while removing duplicates.
    return list(dict.fromkeys(parsed_origins))


app = FastAPI(
    title="MediCore CDSS Service",
    description="Clinical Decision Support System API",
    version="1.0.0"
)

# CORS middleware
# Resolve and validate origins at import-time for fail-fast behavior.
allowed_origins = _resolve_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _get_bool_env_strict(name: str, default: str) -> bool:
    raw = os.getenv(name, default)
    if raw is None:
        raw = default
    val = str(raw).strip().lower()
    if val not in ("true", "false"):
        raise RuntimeError(f"Invalid {name} value '{raw}'. Expected 'true' or 'false'.")
    return val == "true"


def _validate_security_config() -> None:
    """
    Fail fast on critical security config drift.
    """
    env = os.getenv("ENVIRONMENT", "development").strip().lower()
    _resolve_cors_origins(env=env, raw_origins=os.getenv("CORS_ORIGINS"))

    # Strict boolean parsing for security switches
    service_auth_required = _get_bool_env_strict("CDSS_REQUIRE_SERVICE_AUTH", "false")
    _get_bool_env_strict(
        "CDSS_SERVICE_AUTH_JWT_REPLAY_STRICT",
        "false" if _is_dev_like_env(env) else "true",
    )
    _get_bool_env_strict("CDSS_PHI_REDACTION_ENABLED", "true")
    _get_bool_env_strict("CDSS_BLOCK_OUTBOUND_PHI", "true")
    strict_egress = _get_bool_env_strict("CDSS_STRICT_EGRESS_ALLOWLIST", "true")
    encryption_enabled = _get_bool_env_strict("CDSS_ENCRYPTION_ENABLED", "true")
    _get_bool_env_strict("CDSS_ENCRYPTION_ALLOW_PLAINTEXT_READS", "true")
    llm_enabled = _get_bool_env_strict("LLM_ENABLED", "true")

    service_auth_mode = os.getenv("CDSS_SERVICE_AUTH_MODE", "both").strip().lower() or "both"
    if service_auth_mode not in ("token", "jwt", "both"):
        raise RuntimeError("CDSS_SERVICE_AUTH_MODE must be one of: token, jwt, both.")

    service_token = os.getenv("CDSS_SERVICE_TOKEN", "").strip()
    if service_auth_required and service_auth_mode in ("token", "both") and not service_token:
        raise RuntimeError("CDSS_REQUIRE_SERVICE_AUTH=true but CDSS_SERVICE_TOKEN is missing.")
    if service_auth_required and service_auth_mode in ("token", "both") and len(service_token) < 24:
        raise RuntimeError("CDSS_SERVICE_TOKEN must be at least 24 characters when token service auth is enabled.")

    service_jwt_secret = os.getenv("CDSS_SERVICE_JWT_SECRET", "").strip()
    if service_auth_required and service_auth_mode in ("jwt", "both") and not service_jwt_secret:
        raise RuntimeError("CDSS_REQUIRE_SERVICE_AUTH=true but CDSS_SERVICE_JWT_SECRET is missing.")
    if service_auth_required and service_auth_mode in ("jwt", "both") and len(service_jwt_secret) < 24:
        raise RuntimeError("CDSS_SERVICE_JWT_SECRET must be at least 24 characters when JWT service auth is enabled.")

    # Prevent insecure default token outside dev-like environments.
    insecure_default = "dev_cdss_service_token_change_in_production"
    if not _is_dev_like_env(env) and service_auth_mode in ("token", "both") and service_token == insecure_default:
        raise RuntimeError("CDSS_SERVICE_TOKEN is using insecure default value in non-development environment.")
    insecure_jwt_secret_default = "dev_cdss_service_jwt_secret_change_in_production"
    if not _is_dev_like_env(env) and service_auth_mode in ("jwt", "both") and service_jwt_secret == insecure_jwt_secret_default:
        raise RuntimeError("CDSS_SERVICE_JWT_SECRET is using insecure default value in non-development environment.")

    jwt_secret = os.getenv("JWT_SECRET", "").strip()
    insecure_jwt_defaults = {
        "dev_secret_key_change_in_production",
        "medicore-super-secret-key",
        "ehr-super-secret-key",
    }
    if not jwt_secret:
        raise RuntimeError("JWT_SECRET is required for CDSS admin JWT verification.")
    if not _is_dev_like_env(env) and (jwt_secret in insecure_jwt_defaults or len(jwt_secret) < 24):
        raise RuntimeError("JWT_SECRET is insecure for non-development environment.")

    owner_emails = [e.strip().lower() for e in os.getenv("OWNER_EMAILS", "").split(",") if e.strip()]
    if not _is_dev_like_env(env) and not owner_emails:
        raise RuntimeError("OWNER_EMAILS must be configured in non-development environment.")
    if not _is_dev_like_env(env) and strict_egress:
        allowlist_raw = os.getenv("CDSS_EGRESS_ALLOWLIST", "").strip()
        if not allowlist_raw:
            raise RuntimeError("CDSS_STRICT_EGRESS_ALLOWLIST=true requires CDSS_EGRESS_ALLOWLIST in non-development environment.")
    if not _is_dev_like_env(env) and llm_enabled and not os.getenv("LLM_API_URL", "").strip():
        raise RuntimeError("LLM_ENABLED=true requires LLM_API_URL in non-development environment.")
    _get_bool_env_strict(
        "CDSS_OWNER_SCOPE_STRICT",
        "false" if _is_dev_like_env(env) else "true",
    )

    if encryption_enabled:
        provider = os.getenv("CDSS_ENCRYPTION_PROVIDER", "local").strip().lower() or "local"
        if provider not in ("local", "kms"):
            raise RuntimeError("CDSS_ENCRYPTION_PROVIDER must be one of: local, kms.")
        allow_plaintext_reads = _get_bool_env_strict("CDSS_ENCRYPTION_ALLOW_PLAINTEXT_READS", "true")
        encryption_key = os.getenv("CDSS_ENCRYPTION_KEY", "").strip()
        if not encryption_key:
            raise RuntimeError("CDSS_ENCRYPTION_ENABLED=true but CDSS_ENCRYPTION_KEY is missing.")
        encryption_key_id = os.getenv("CDSS_ENCRYPTION_KEY_ID", "").strip()
        if not encryption_key_id:
            raise RuntimeError("CDSS_ENCRYPTION_KEY_ID is required when CDSS_ENCRYPTION_ENABLED=true.")
        if provider == "kms":
            kms_key_arn = os.getenv("CDSS_ENCRYPTION_KMS_KEY_ARN", "").strip()
            if not kms_key_arn:
                raise RuntimeError("CDSS_ENCRYPTION_PROVIDER=kms requires CDSS_ENCRYPTION_KMS_KEY_ARN.")

        insecure_default_enc = "h7X7Tr_3k0-Tl3xw8tS9AqK3f7fjoGv0VGfT3d2i-9o="
        if not _is_dev_like_env(env) and encryption_key == insecure_default_enc:
            raise RuntimeError("CDSS_ENCRYPTION_KEY is using insecure default in non-development environment.")
        if not _is_dev_like_env(env) and allow_plaintext_reads:
            raise RuntimeError("CDSS_ENCRYPTION_ALLOW_PLAINTEXT_READS must be false in non-development environment.")


_validate_security_config()
SERVICE_AUTH_REQUIRED = _get_bool_env_strict("CDSS_REQUIRE_SERVICE_AUTH", "false")
SERVICE_AUTH_MODE = os.getenv("CDSS_SERVICE_AUTH_MODE", "both").strip().lower() or "both"
SERVICE_AUTH_TOKEN = os.getenv("CDSS_SERVICE_TOKEN", "")
SERVICE_AUTH_JWT_SECRET = os.getenv("CDSS_SERVICE_JWT_SECRET", "").strip()
SERVICE_AUTH_ISSUER = os.getenv("CDSS_SERVICE_AUTH_ISSUER", "medicore.ehr-service").strip() or "medicore.ehr-service"
SERVICE_AUTH_AUDIENCE = os.getenv("CDSS_SERVICE_AUTH_AUDIENCE", "medicore.cdss").strip() or "medicore.cdss"
ADMIN_JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
_SEC_ENV = os.getenv("ENVIRONMENT", "development").strip().lower()
OWNER_SCOPE_STRICT = _get_bool_env_strict(
    "CDSS_OWNER_SCOPE_STRICT",
    "false" if _is_dev_like_env(_SEC_ENV) else "true",
)
SERVICE_AUTH_JWT_REPLAY_STRICT = _get_bool_env_strict(
    "CDSS_SERVICE_AUTH_JWT_REPLAY_STRICT",
    "false" if _is_dev_like_env(_SEC_ENV) else "true",
)
SERVICE_AUTH_SCOPE_STRICT = _get_bool_env_strict(
    "CDSS_SERVICE_AUTH_SCOPE_STRICT",
    "false" if _is_dev_like_env(_SEC_ENV) else "true",
)
_PUBLIC_PATH_EXACT = {"/", "/health", "/openapi.json"}
_PUBLIC_PATH_PREFIXES = ("/docs", "/redoc")
_SERVICE_AUTH_EXEMPT_PREFIXES = _PUBLIC_PATH_PREFIXES + ("/admin",)
_TENANT_REQUIRED_EXEMPT_EXACT = set(_PUBLIC_PATH_EXACT)
_TENANT_REQUIRED_EXEMPT_PREFIXES = _PUBLIC_PATH_PREFIXES + ("/admin",)
COPILOT_TIMEOUT_SECONDS = float(os.getenv("CDSS_COPILOT_TIMEOUT_SECONDS", "20"))
COPILOT_RETRY_MAX = max(0, int(os.getenv("CDSS_COPILOT_RETRY_MAX", "1")))
COPILOT_RETRY_BASE_SECONDS = float(os.getenv("CDSS_COPILOT_RETRY_BASE_SECONDS", "0.25"))

def _status_code_to_code(sc: int) -> str:
    if sc == 400:
        return "BAD_REQUEST"
    if sc == 401:
        return "UNAUTHORIZED"
    if sc == 403:
        return "FORBIDDEN"
    if sc == 404:
        return "NOT_FOUND"
    if sc == 409:
        return "CONFLICT"
    if sc == 429:
        return "TOO_MANY_REQUESTS"
    if sc == 503:
        return "SERVICE_UNAVAILABLE"
    if sc >= 500:
        return "INTERNAL_ERROR"
    return "ERROR"


def _is_retryable_copilot_error(error: Exception) -> bool:
    if isinstance(error, asyncio.TimeoutError):
        return True
    message = str(error).lower()
    retry_markers = (
        "timeout",
        "tempor",
        "connection reset",
        "connection aborted",
        "503",
        "504",
        "service unavailable",
    )
    return any(marker in message for marker in retry_markers)


async def _run_copilot_with_resilience(action: str, fn):
    attempts = COPILOT_RETRY_MAX + 1
    last_error: Optional[Exception] = None
    for attempt in range(1, attempts + 1):
        try:
            return await asyncio.wait_for(fn(), timeout=COPILOT_TIMEOUT_SECONDS)
        except Exception as e:
            last_error = e
            if attempt < attempts and _is_retryable_copilot_error(e):
                delay = COPILOT_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
                await asyncio.sleep(delay)
                continue
            break
    raise RuntimeError(f"{action} unavailable: {str(last_error) if last_error else 'unknown error'}")


def _normalize_tenant_cache_key(raw_tenant_id: Optional[str]) -> str:
    if not raw_tenant_id:
        return "public"
    raw = str(raw_tenant_id).strip().lower()
    safe = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in raw)
    return safe[:120] if safe else "public"


def _tenant_cache_key_from_request(req: Request) -> str:
    try:
        state_tenant_id = getattr(req.state, "tenant_id", None)
        if state_tenant_id:
            return _normalize_tenant_cache_key(state_tenant_id)
    except Exception:
        pass
    tenant_id = req.headers.get("x-tenant-id")
    return _normalize_tenant_cache_key(tenant_id)


def _is_path_exempt(path: str, exact: set[str], prefixes: tuple[str, ...]) -> bool:
    return path in exact or any(path.startswith(prefix) for prefix in prefixes)


def _is_tenant_required_path(path: str) -> bool:
    return not _is_path_exempt(path, _TENANT_REQUIRED_EXEMPT_EXACT, _TENANT_REQUIRED_EXEMPT_PREFIXES)


def _require_tenant_cache_key_from_request(req: Request) -> str:
    tenant_key = _tenant_cache_key_from_request(req)
    raw = ""
    try:
        raw = str(req.headers.get("x-tenant-id") or "").strip()
    except Exception:
        raw = ""
    if not raw or tenant_key == "public":
        raise HTTPException(status_code=400, detail="X-Tenant-ID header is required")
    return tenant_key


def _job_owner_from_request(req: Request) -> str:
    try:
        identity = str(getattr(req.state, "service_identity", "") or "").strip()
        if identity:
            return identity[:200]
    except Exception:
        pass
    return "service"


_COPILOT_ALLOWLIST_DEFAULTS: Dict[str, List[str]] = {
    "symptoms": ["symptoms", "age", "gender"],
    "vitals": [
        "bloodPressure", "heartRate", "temperature", "oxygenSaturation",
        "respiratoryRate", "weight", "height", "bmi", "painLevel", "bloodGlucose",
        "age", "gender"
    ],
    "patient_data": ["age", "gender", "vitals", "labs", "conditions"],
    "summary": ["clinical_notes", "age", "gender", "recent_vitals"],
}

_MAX_CLINICAL_NOTES = 8
_MAX_SYMPTOMS = 25


def _get_copilot_allowlists() -> Dict[str, List[str]]:
    cfg = settings_provider.get_settings() if settings_provider else {}
    from_settings = cfg.get("copilot_input_allowlists") if isinstance(cfg, dict) else None
    out: Dict[str, List[str]] = {}
    if isinstance(from_settings, dict):
        for k, v in from_settings.items():
            if isinstance(v, list):
                out[str(k)] = [str(item) for item in v if isinstance(item, str) and item.strip()]
    for key, defaults in _COPILOT_ALLOWLIST_DEFAULTS.items():
        if key not in out or not out[key]:
            out[key] = list(defaults)
    return out


def _apply_allowlist(payload: Dict[str, Any], allowed_keys: List[str]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    allowed = set(allowed_keys or [])
    return {k: payload[k] for k in payload.keys() if k in allowed}



async def get_ai_policy(x_tenant_id: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Retrieve tenant-specific AI policy using header value (X-Tenant-ID).
    If no policy is set or the settings provider is unavailable, return empty dict.
    """
    if not settings_provider or not x_tenant_id:
        return {}
    return settings_provider.get_tenant_policy(x_tenant_id) or {}


def _resolve_ai_policy(ai_policy: Any, req: Optional[Request] = None) -> Dict[str, Any]:
    if isinstance(ai_policy, dict):
        return ai_policy
    if not settings_provider or req is None:
        return {}
    try:
        tenant_id = req.headers.get("x-tenant-id")
    except Exception:
        return {}
    if not tenant_id:
        return {}
    try:
        return settings_provider.get_tenant_policy(tenant_id) or {}
    except Exception:
        return {}


def _sanitize_summary_payload(request_payload: Dict[str, Any]) -> Dict[str, Any]:

    allowlists = _get_copilot_allowlists()
    safe_payload = _apply_allowlist(request_payload, allowlists.get("summary", []))

    raw_notes = safe_payload.get("clinical_notes")
    cleaned_notes: List[str] = []
    if isinstance(raw_notes, list):
        for note in raw_notes[:_MAX_CLINICAL_NOTES]:
            if isinstance(note, str) and note.strip():
                cleaned_notes.append(redact_text(note.strip())[:1200])
    safe_payload["clinical_notes"] = cleaned_notes

    safe_payload["recent_vitals"] = redact_value(_apply_allowlist(
        safe_payload.get("recent_vitals") if isinstance(safe_payload.get("recent_vitals"), dict) else {},
        allowlists.get("vitals", []),
    ))
    return safe_payload


def _sanitize_intelligent_diagnosis_payload(request_payload: Dict[str, Any]) -> Dict[str, Any]:
    allowlists = _get_copilot_allowlists()

    raw_symptoms = request_payload.get("symptoms")
    symptoms: List[str] = []
    if isinstance(raw_symptoms, list):
        for symptom in raw_symptoms[:_MAX_SYMPTOMS]:
            if isinstance(symptom, str) and symptom.strip():
                symptoms.append(redact_text(symptom.strip())[:180])

    cleaned = {
        "symptoms": symptoms,
        "age": request_payload.get("age"),
        "gender": request_payload.get("gender"),
        "clinical_notes": redact_text(str(request_payload.get("clinical_notes", ""))[:4000]) if request_payload.get("clinical_notes") else None,
    }

    safe_vitals = _apply_allowlist(
        request_payload.get("vitals") if isinstance(request_payload.get("vitals"), dict) else {},
        allowlists.get("vitals", []),
    )
    cleaned["vitals"] = redact_value(safe_vitals) if safe_vitals else None

    safe_patient_data = _apply_allowlist(
        request_payload.get("patient_data") if isinstance(request_payload.get("patient_data"), dict) else {},
        allowlists.get("patient_data", []),
    )
    if isinstance(request_payload.get("labs"), dict):
        safe_patient_data["labs"] = request_payload.get("labs")
    if isinstance(request_payload.get("conditions"), list):
        safe_patient_data["conditions"] = [str(v)[:120] for v in request_payload.get("conditions", []) if isinstance(v, (str, int, float))]
    if cleaned.get("age") is not None:
        safe_patient_data["age"] = cleaned["age"]
    if cleaned.get("gender"):
        safe_patient_data["gender"] = cleaned["gender"]
    if cleaned.get("vitals"):
        safe_patient_data["vitals"] = cleaned["vitals"]

    cleaned["patient_data"] = redact_value(safe_patient_data) if safe_patient_data else None
    return cleaned


def _coerce_int(value: Any) -> Optional[int]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    raw = str(value).strip()
    if raw.isdigit():
        return int(raw)
    return None


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    raw = str(value).strip().lower()
    return raw in {"1", "true", "yes", "y", "pregnant"}


def _build_guideline_population_filters(patient_context: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not isinstance(patient_context, dict):
        return None

    context = patient_context or {}
    explicit_population = str(context.get("target_population") or "").strip().lower()
    if explicit_population in {"children", "elderly", "pregnant_women", "adults"}:
        return {"target_population": explicit_population}

    age = _coerce_int(context.get("age") if context.get("age") is not None else context.get("patient_age"))
    gender = str(context.get("gender") if context.get("gender") is not None else context.get("patient_gender") or "").strip().lower()
    is_pregnant = (
        _coerce_bool(context.get("is_pregnant"))
        or _coerce_bool(context.get("pregnant"))
        or str(context.get("pregnancy_status") or "").strip().lower() in {"pregnant", "positive", "yes", "true"}
    )
    if not is_pregnant:
        notes_blob = str(context).lower()
        is_pregnant = "pregnan" in notes_blob

    if is_pregnant and gender in {"female", "f", "woman"}:
        return {"target_population": "pregnant_women"}
    if isinstance(age, int):
        if age < 18:
            return {"target_population": "children"}
        if age >= 65:
            return {"target_population": "elderly"}
    if gender in {"male", "m", "man", "boy"}:
        return {"target_population": {"$ne": "pregnant_women"}}
    return None


def _filter_guideline_citations_by_population(
    citations: List[Dict[str, Any]],
    patient_context: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    filters = _build_guideline_population_filters(patient_context)
    if not citations or not filters:
        return citations

    target_rule = filters.get("target_population")
    filtered: List[Dict[str, Any]] = []

    if isinstance(target_rule, dict) and target_rule.get("$ne") == "pregnant_women":
        for c in citations:
            meta = c.get("metadata") if isinstance(c, dict) else {}
            pop = str((meta or {}).get("target_population") or "").strip().lower()
            if pop == "pregnant_women":
                continue
            filtered.append(c)
        return filtered

    if isinstance(target_rule, str):
        incompatible = {
            "children": {"pregnant_women", "elderly"},
            "elderly": {"children", "pregnant_women"},
            "pregnant_women": {"children", "elderly"},
        }.get(target_rule, set())
        for c in citations:
            meta = c.get("metadata") if isinstance(c, dict) else {}
            pop = str((meta or {}).get("target_population") or "").strip().lower()
            if pop and pop in incompatible:
                continue
            filtered.append(c)
        return filtered

    return citations


def _copilot_transparency(
    action: str,
    confidence: Any,
    explanation: Optional[str],
    citations: Optional[List[Any]],
    source: str,
    model_trace: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    why_recommended = explanation or f"{action} recommendation generated from structured clinical context and available guideline evidence."
    return {
        "why_recommended": why_recommended,
        "confidence": confidence if confidence is not None else "unknown",
        "provenance": {
            "source": source,
            "citations_count": len(citations or []),
            "has_model_trace": bool(model_trace),
            "model_trace": model_trace or {},
        },
    }


def _copilot_model_trace_stub(
    action: str,
    request_payload: Optional[Dict[str, Any]] = None,
    model_registry: Optional[Dict[str, Any]] = None,
    *,
    llm_model: Optional[str] = None,
    llm_route: str = "fallback",
    canary_percent: int = 0,
) -> Dict[str, Any]:
    trace_payload = {
        "action": action,
        "llm_model": llm_model,
        "llm_route": llm_route,
        "canary_percent": canary_percent,
        "models": model_registry or {},
    }
    return {
        "trace_version": "2026.02",
        "request_sha256": compute_request_hash(request_payload or {}),
        "model_registry_sha256": hashlib.sha256(
            json.dumps(trace_payload, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest(),
        "llm_model": llm_model,
        "llm_route": llm_route,
        "canary_percent": canary_percent,
    }


def _safe_filename(filename: Optional[str], fallback: str = "upload.bin") -> str:
    base = os.path.basename(filename or "").strip()
    if not base:
        base = fallback
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    return safe[:180] or fallback


def _parse_positive_int_env(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        parsed = int(raw)
        return parsed if parsed > 0 else default
    except Exception:
        return default


_MAX_AUDIO_UPLOAD_BYTES = _parse_positive_int_env("CDSS_MAX_AUDIO_UPLOAD_BYTES", 25 * 1024 * 1024)
_MAX_IMAGE_UPLOAD_BYTES = _parse_positive_int_env("CDSS_MAX_IMAGE_UPLOAD_BYTES", 25 * 1024 * 1024)
_MAX_ADMIN_INGEST_UPLOAD_BYTES = _parse_positive_int_env("CDSS_MAX_ADMIN_INGEST_UPLOAD_BYTES", 50 * 1024 * 1024)

_ALLOWED_AUDIO_MIME_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/m4a",
    "audio/x-m4a",
    "audio/webm",
    "audio/ogg",
}
_ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".webm", ".ogg"}

_ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "application/dicom",
    "application/dicom+json",
}
_ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".dcm"}

_ALLOWED_ADMIN_INGEST_MIME_TYPES = {"application/pdf"}
_ALLOWED_ADMIN_INGEST_EXTENSIONS = {".pdf"}


def _measure_upload_size(file: UploadFile) -> int:
    try:
        file.file.seek(0, os.SEEK_END)
        size = int(file.file.tell() or 0)
        file.file.seek(0)
        return size
    except Exception:
        return 0


def _validate_upload_constraints(
    file: UploadFile,
    *,
    file_label: str,
    max_bytes: int,
    allowed_mime_types: set[str],
    allowed_extensions: set[str],
) -> Dict[str, Any]:
    safe_name = _safe_filename(getattr(file, "filename", None) or f"{file_label}.bin")
    ext = pathlib.Path(safe_name).suffix.lower()
    content_type = str(getattr(file, "content_type", "") or "").split(";")[0].strip().lower()
    allowed_by_mime = content_type in allowed_mime_types
    allowed_by_ext = ext in allowed_extensions if allowed_extensions else True

    if not allowed_by_mime and not allowed_by_ext:
        allowed_desc = ", ".join(sorted(allowed_mime_types))
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {file_label} file type '{content_type or 'unknown'}'. Allowed: {allowed_desc}",
        )

    size = _measure_upload_size(file)
    if size <= 0:
        raise HTTPException(status_code=400, detail=f"Invalid {file_label} upload: empty file")
    if size > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"{file_label.capitalize()} file exceeds max size of {max_bytes} bytes",
        )

    return {
        "safe_filename": safe_name,
        "content_type": content_type or "application/octet-stream",
        "size_bytes": size,
    }


def _parse_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "y", "on"}


def _parse_int_set(raw: str, default: set[int]) -> set[int]:
    parsed: set[int] = set()
    for item in str(raw or "").split(","):
        token = item.strip()
        if not token:
            continue
        try:
            parsed.add(int(token))
        except Exception:
            continue
    return parsed or set(default)


def _scan_file_for_malware(file_path: str, file_label: str) -> None:
    if not _parse_bool_env("CDSS_MALWARE_SCAN_ENABLED", False):
        return

    command = str(os.getenv("CDSS_MALWARE_SCAN_COMMAND", "clamscan") or "").strip()
    if not command:
        raise HTTPException(status_code=503, detail="Malware scanner command is not configured")

    args_raw = str(os.getenv("CDSS_MALWARE_SCAN_ARGS", "--no-summary") or "").strip()
    args = shlex.split(args_raw) if args_raw else []
    timeout_seconds = float(os.getenv("CDSS_MALWARE_SCAN_TIMEOUT_SECONDS", "15") or "15")
    fail_closed = _parse_bool_env("CDSS_MALWARE_SCAN_FAIL_CLOSED", True)
    infected_exit_codes = _parse_int_set(
        os.getenv("CDSS_MALWARE_SCAN_INFECTED_EXIT_CODES", "1"),
        {1},
    )

    try:
        result = subprocess.run(
            [command, *args, file_path],
            capture_output=True,
            text=True,
            timeout=max(1.0, timeout_seconds),
        )
    except FileNotFoundError:
        if fail_closed:
            raise HTTPException(status_code=503, detail="Malware scanner unavailable")
        return
    except Exception as e:
        if fail_closed:
            raise HTTPException(status_code=503, detail=f"Malware scan failed: {str(e)}")
        return

    if result.returncode in infected_exit_codes:
        raise HTTPException(status_code=400, detail=f"Malware detected in uploaded {file_label}")
    if result.returncode != 0 and fail_closed:
        stderr_text = (result.stderr or "").strip()
        message = f"Malware scan failed for uploaded {file_label}"
        if stderr_text:
            message = f"{message}: {stderr_text[:200]}"
        raise HTTPException(status_code=503, detail=message)


def _scan_upload_or_cleanup(file_path: str, file_label: str) -> None:
    try:
        _scan_file_for_malware(file_path, file_label)
    except HTTPException:
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass
        raise


def _tenant_temp_dir(tenant_key: str) -> str:
    root = os.getenv("CDSS_TMP_ROOT", "/tmp/medicore-cdss")
    path = os.path.join(root, tenant_key)
    os.makedirs(path, mode=0o700, exist_ok=True)
    return path


def _save_upload_to_tenant_temp(file: UploadFile, tenant_key: str) -> str:
    safe_name = _safe_filename(getattr(file, "filename", None))
    suffix = pathlib.Path(safe_name).suffix or ".tmp"
    temp_dir = _tenant_temp_dir(tenant_key)
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=temp_dir, prefix="upload_") as temp_file:
        file.file.seek(0)
        shutil.copyfileobj(file.file, temp_file)
        return temp_file.name

@app.middleware("http")
async def request_id_and_envelope_middleware(request: Request, call_next):
    rid = request.headers.get("x-request-id") or str(uuid4())
    request.state.request_id = rid
    start = time.monotonic()
    try:
        response = await call_next(request)
        try:
            response.headers["X-Request-ID"] = rid
        except Exception:
            pass
        return response
    except HTTPException as he:
        code = _status_code_to_code(he.status_code)
        payload = {
            "code": code,
            "message": he.detail if isinstance(he.detail, str) else str(he.detail),
            "details": None,
            "requestId": rid,
            "timestamp": datetime.utcnow().isoformat(),
        }
        resp = JSONResponse(status_code=he.status_code, content=payload)
        try:
            resp.headers["X-Request-ID"] = rid
        except Exception:
            pass
        return resp
    except Exception as e:
        payload = {
            "code": "INTERNAL_ERROR",
            "message": "Unexpected server error",
            "details": {"error": str(e)},
            "requestId": rid,
            "timestamp": datetime.utcnow().isoformat(),
        }
        resp = JSONResponse(status_code=500, content=payload)
        try:
            resp.headers["X-Request-ID"] = rid
        except Exception:
            pass
        return resp
    finally:
        duration_ms = int((time.monotonic() - start) * 1000)
        try:
            print(json.dumps({"requestId": rid, "path": str(request.url.path), "method": request.method, "duration_ms": duration_ms}))
        except Exception:
            pass


def _mark_service_jti_once(claims: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """
    Returns (allowed, error_message). Uses Redis SET NX EX to prevent JWT replay.
    """
    jti = str(claims.get("jti") or "").strip()
    if not jti:
        return (False, "Service JWT missing jti claim")

    exp_raw = claims.get("exp")
    now = int(time.time())
    ttl_seconds = 120
    try:
        exp_int = int(exp_raw)
        ttl_seconds = max(30, min(900, (exp_int - now) + 30))
    except Exception:
        ttl_seconds = 120

    try:
        redis_url = os.getenv("REDIS_URL", "").strip()
        if redis_url:
            r = redis_pkg.from_url(redis_url, decode_responses=True)
        else:
            host = os.getenv("REDIS_HOST", "localhost")
            port = int(os.getenv("REDIS_PORT", 6379))
            r = redis_pkg.Redis(host=host, port=port, db=0, decode_responses=True)
        key = f"auth:service:jti:{SERVICE_AUTH_ISSUER}:{SERVICE_AUTH_AUDIENCE}:{jti}"
        ok = r.set(key, "1", ex=ttl_seconds, nx=True)
        if ok:
            return (True, None)
        return (False, "Service JWT replay detected")
    except Exception:
        if SERVICE_AUTH_JWT_REPLAY_STRICT:
            return (False, "Replay protection unavailable")
        return (True, None)


def _required_service_scope_for_request(path: str, method: str) -> str:
    """
    Returns required service scope for route.
    Keep mapping explicit for copilot-sensitive routes.
    """
    m = method.upper()
    if path == "/diagnosis/suggest/intelligent" and m == "POST":
        return "cdss.copilot.diagnosis.write"
    if path == "/patient/summarize" and m == "POST":
        return "cdss.copilot.summary.write"
    if path == "/guidelines/search" and m == "POST":
        return "cdss.copilot.guidelines.read"
    if path.startswith("/admin/"):
        return "cdss.admin.*"
    return "cdss.api.invoke"


@app.middleware("http")
async def service_to_service_auth_middleware(request: Request, call_next):
    """
    Optional service-to-service authentication for non-admin CDSS routes.
    Enable via CDSS_REQUIRE_SERVICE_AUTH=true and configure CDSS_SERVICE_TOKEN.
    """
    if not SERVICE_AUTH_REQUIRED:
        return await call_next(request)

    path = request.url.path
    exempt_exact = _PUBLIC_PATH_EXACT
    exempt_prefixes = _SERVICE_AUTH_EXEMPT_PREFIXES

    if path in exempt_exact or any(path.startswith(prefix) for prefix in exempt_prefixes):
        return await call_next(request)

    auth_ok = False
    auth_errors: list[str] = []

    if SERVICE_AUTH_MODE in ("jwt", "both"):
        if not SERVICE_AUTH_JWT_SECRET:
            auth_errors.append("JWT service auth secret not configured")
        else:
            bearer = request.headers.get("authorization", "")
            service_jwt = ""
            if bearer.lower().startswith("bearer "):
                service_jwt = bearer.split(" ", 1)[1].strip()
            if not service_jwt:
                service_jwt = request.headers.get("x-service-jwt", "").strip()
            if service_jwt:
                try:
                    claims = decode_service_jwt(
                        token=service_jwt,
                        secret=SERVICE_AUTH_JWT_SECRET,
                        audience=SERVICE_AUTH_AUDIENCE,
                        issuer=SERVICE_AUTH_ISSUER,
                    )
                    replay_ok, replay_err = _mark_service_jti_once(claims)
                    if replay_ok:
                        required_scope = _required_service_scope_for_request(path, request.method)
                        scopes = extract_service_claim_scopes(claims)
                        if is_service_scope_allowed(scopes, required_scope):
                            request.state.service_identity = str(claims.get("sub") or "service")
                            request.state.service_scopes = sorted(scopes)
                            auth_ok = True
                        elif SERVICE_AUTH_SCOPE_STRICT:
                            auth_errors.append(f"Missing required service scope: {required_scope}")
                        else:
                            request.state.service_identity = str(claims.get("sub") or "service")
                            request.state.service_scopes = sorted(scopes)
                            auth_ok = True
                    else:
                        auth_errors.append(replay_err or "Service JWT replay validation failed")
                except Exception as e:
                    auth_errors.append(f"Invalid service JWT: {str(e)}")
            else:
                auth_errors.append("Missing service JWT")

    if not auth_ok and SERVICE_AUTH_MODE in ("token", "both"):
        if not SERVICE_AUTH_TOKEN:
            auth_errors.append("Token service auth not configured")
        else:
            provided_token = request.headers.get("x-service-token", "")
            if provided_token and hmac.compare_digest(provided_token, SERVICE_AUTH_TOKEN):
                auth_ok = True
            else:
                auth_errors.append("Invalid service authentication token")

    if not auth_ok:
        try:
            error_summary = ", ".join(auth_errors) if auth_errors else "unknown"
            print(f"[CDSS] Service auth failed for {path}: {error_summary}")
        except Exception:
            pass
        payload = {
            "code": "UNAUTHORIZED",
            "message": "Invalid service authentication credentials",
            "details": {"errors": auth_errors} if auth_errors else None,
            "requestId": getattr(request.state, "request_id", str(uuid4())),
            "timestamp": datetime.utcnow().isoformat(),
        }
        return JSONResponse(status_code=401, content=payload)

    return await call_next(request)


@app.middleware("http")
async def tenant_context_guard_middleware(request: Request, call_next):
    path = request.url.path
    if not _is_tenant_required_path(path):
        return await call_next(request)

    tenant_header = str(request.headers.get("x-tenant-id") or "").strip()
    tenant_key = _normalize_tenant_cache_key(tenant_header)
    if not tenant_header or tenant_key == "public":
        payload = {
            "code": "BAD_REQUEST",
            "message": "X-Tenant-ID header is required",
            "details": None,
            "requestId": getattr(request.state, "request_id", str(uuid4())),
            "timestamp": datetime.utcnow().isoformat(),
        }
        return JSONResponse(status_code=400, content=payload)

    request.state.tenant_id = tenant_key
    return await call_next(request)

# Request/Response Models
class DrugInteractionRequest(BaseModel):
    drug_ids: List[str] = Field(..., description="List of drug UUIDs to check")
    patient_id: Optional[str] = Field(None, description="Patient ID for context")
    drugs_data: Optional[List[Dict[str, Any]]] = Field(None, description="Optional: Pre-fetched drug data from EHR service")


class DrugInteractionResponse(BaseModel):
    interactions: List[Dict[str, Any]]
    severity_summary: Dict[str, int]
    recommendations: List[str]


class ClinicalGuidelineRequest(BaseModel):
    condition: str = Field(..., description="Diagnosis or condition code")
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    comorbidities: Optional[List[str]] = []
    medications: Optional[List[str]] = []


class RiskScoreRequest(BaseModel):
    patient_id: str
    vitals: Dict[str, Any]
    medications: List[str]
    diagnoses: List[str]
    lab_results: Optional[Dict[str, Any]] = None
    historical_vitals: Optional[List[Dict[str, Any]]] = None
    visit_history: Optional[List[Dict[str, Any]]] = None


class RiskScoreResponse(BaseModel):
    overall_score: float
    risk_level: str  # low, moderate, high, critical
    factors: List[Dict[str, Any]]
    recommendations: List[str]
    guideline_citations: List[Dict[str, Any]] = []


# Health Check
@app.get("/")
async def root():
    return {
        "service": "MediCore CDSS",
        "status": "healthy",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# Initialize analyzers
analyzer = DrugInteractionAnalyzer()
guidelines_engine = ClinicalGuidelinesEngine()
risk_scoring_engine = RiskScoringEngine()
dosing_calculator = DosingCalculator()
diagnostic_assistant = DiagnosticAssistant()  # Now includes AI models if available
trend_analysis_engine = TrendAnalysisEngine()

# Settings Provider (Master DB)
settings_provider = None
try:
    settings_provider = SettingsProvider()
except Exception as e:
    print(f"SettingsProvider initialization failed (will use env defaults only): {e}")

# Check for AI enablement
enable_ai = os.getenv("CDSS_ENABLE_AI", "false").lower() == "true"

# AI services are initialized lazily to avoid hard import failures for optional
# heavy dependencies during startup and non-AI test runs.
voice_scribe = None
medical_vision = None

if not enable_ai:
    print("AI features disabled via CDSS_ENABLE_AI=false")
else:
    print("AI features enabled via CDSS_ENABLE_AI=true (lazy initialization)")


def _ensure_voice_scribe_loaded() -> bool:
    global voice_scribe
    if voice_scribe:
        return True
    if not enable_ai:
        return False
    try:
        from ai_models.voice_scribe import VoiceScribe
        voice_scribe = VoiceScribe()
        return bool(voice_scribe)
    except Exception as e:
        print(f"Voice scribe lazy initialization failed: {e}")
        return False


def _ensure_medical_vision_loaded() -> bool:
    global medical_vision
    if medical_vision:
        return True
    if not enable_ai:
        return False
    try:
        from ai_models.medical_vision import MedicalVisionService
        medical_vision = MedicalVisionService()
        return bool(medical_vision)
    except Exception as e:
        print(f"Medical Vision lazy initialization failed: {e}")
        return False

# MinIO Configuration
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT")
if not MINIO_ENDPOINT:
    print("Warning: MINIO_ENDPOINT not set, defaulting to internal service name or requiring env var")
    # In docker, it might be 'http://minio:9000', locally 'http://localhost:9000'
    # We'll leave it empty to force configuration or handle it downstream

MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "medicore")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "medicore_password")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "medicore-documents")

# Initialize S3 Client
s3_client = boto3.client(
    's3',
    endpoint_url=MINIO_ENDPOINT,
    aws_access_key_id=MINIO_ACCESS_KEY,
    aws_secret_access_key=MINIO_SECRET_KEY,
    config=boto3.session.Config(signature_version='s3v4')
)

@app.on_event("startup")
async def startup_event():
    """Validate runtime security config and ensure MinIO bucket exists on startup."""
    # Startup guard so deployments fail closed if CORS env drifts after import.
    _resolve_cors_origins(env=os.getenv("ENVIRONMENT", "development"), raw_origins=os.getenv("CORS_ORIGINS"))
    try:
        try:
            s3_client.head_bucket(Bucket=MINIO_BUCKET)
            print(f"Bucket '{MINIO_BUCKET}' exists.")
        except ClientError as e:
            # If a client error is thrown, then check that it was a 404 error.
            # If it was a 404 error, then the bucket does not exist.
            error_code = e.response['Error']['Code']
            if error_code == '404':
                s3_client.create_bucket(Bucket=MINIO_BUCKET)
                print(f"Bucket '{MINIO_BUCKET}' created successfully.")
            else:
                print(f"Error checking bucket '{MINIO_BUCKET}': {e}")
    except Exception as e:
        print(f"Error checking MinIO connection: {e}")
    try:
        _start_job_worker()
        _rehydrate_queued_jobs_on_startup()
    except Exception as e:
        print(f"Error starting CDSS job worker: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    try:
        _JOB_WORKER_STOP.set()
        if _JOB_WORKER_THREAD and _JOB_WORKER_THREAD.is_alive():
            _JOB_WORKER_THREAD.join(timeout=2.0)
    except Exception:
        pass

lab_interpreter = LabResultInterpreter()
_ADMIN_JOBS: Dict[str, Dict[str, Any]] = {}
_ADMIN_JOBS_LOCK = Lock()
_MAX_ADMIN_JOB_ATTEMPTS = int(os.getenv("CDSS_MAX_JOB_ATTEMPTS", "3"))
_MAX_ADMIN_JOB_RECORDS = int(os.getenv("CDSS_MAX_JOB_RECORDS", "2000"))
_JOB_QUEUE_NAME = os.getenv("CDSS_JOB_QUEUE_NAME", "cdss:jobs:queue")
_JOB_DLQ_NAME = os.getenv("CDSS_JOB_DLQ_NAME", "cdss:jobs:dead_letter")
_JOB_WORKER_ENABLED = _get_bool_env_strict("CDSS_JOB_WORKER_ENABLED", "true")
_JOB_WORKER_POLL_SECONDS = int(os.getenv("CDSS_JOB_WORKER_POLL_SECONDS", "5"))
_JOB_QUEUE_REDIS: Optional[redis_pkg.Redis] = None
_JOB_WORKER_THREAD: Optional[threading.Thread] = None
_JOB_WORKER_STOP = threading.Event()
# Backward-compatible alias for existing ingest endpoints/UI paths.
_INGEST_JOBS = _ADMIN_JOBS
_INGEST_LOCK = _ADMIN_JOBS_LOCK


def _derive_version_label(filename: Optional[str]) -> Optional[str]:
    raw = str(filename or "").strip()
    if not raw:
        return None
    base = pathlib.Path(raw).stem
    patterns = [
        r"(v(?:ersion)?[\s._-]?\d+(?:\.\d+)*)",
        r"(rev(?:ision)?[\s._-]?\d+(?:\.\d+)*)",
        r"(20\d{2}[\s._-]?(?:0[1-9]|1[0-2])(?:[\s._-]?(?:0[1-9]|[12]\d|3[01]))?)",
    ]
    for pattern in patterns:
        match = re.search(pattern, base, flags=re.IGNORECASE)
        if match:
            return re.sub(r"[\s._-]+", " ", match.group(1)).strip()
    return None


def _create_job(
    *,
    job_type: str,
    owner: str,
    tenant_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
    retry_of: Optional[str] = None,
    attempt: int = 1,
) -> str:
    job_id = str(uuid4())
    with _ADMIN_JOBS_LOCK:
        if len(_ADMIN_JOBS) >= _MAX_ADMIN_JOB_RECORDS:
            # Drop oldest completed/failed jobs first to keep in-memory state bounded.
            candidates = sorted(
                _ADMIN_JOBS.values(),
                key=lambda j: j.get("started_at") or "",
            )
            removed = 0
            for j in candidates:
                if len(_ADMIN_JOBS) < _MAX_ADMIN_JOB_RECORDS:
                    break
                if j.get("status") in ("completed", "failed"):
                    _ADMIN_JOBS.pop(str(j.get("jobId")), None)
                    removed += 1
            if removed == 0 and candidates:
                _ADMIN_JOBS.pop(str(candidates[0].get("jobId")), None)
        _ADMIN_JOBS[job_id] = {
            "jobId": job_id,
            "type": job_type,
            "status": "queued",
            "started_at": datetime.utcnow().isoformat(),
            "finished_at": None,
            "message": None,
            "owner": owner,
            "tenant_id": tenant_id or "public",
            "attempt": attempt,
            "max_attempts": _MAX_ADMIN_JOB_ATTEMPTS,
            "retry_of": retry_of,
            "payload": payload or {},
            "result": None,
            "dead_lettered": False,
            "dead_letter_reason": None,
        }
        if settings_provider:
            try:
                settings_provider.upsert_job(_ADMIN_JOBS[job_id])
            except Exception:
                pass
    return job_id


def _update_job(job_id: str, **updates: Any) -> None:
    with _ADMIN_JOBS_LOCK:
        job = _ADMIN_JOBS.get(job_id)
        if not job:
            return
        job.update(updates)
        _ADMIN_JOBS[job_id] = job
        if settings_provider:
            try:
                settings_provider.upsert_job(job)
            except Exception:
                pass


def _get_queue_redis_client() -> Optional[redis_pkg.Redis]:
    global _JOB_QUEUE_REDIS
    if _JOB_QUEUE_REDIS is not None:
        return _JOB_QUEUE_REDIS
    try:
        redis_url = os.getenv("REDIS_URL", "").strip()
        if redis_url:
            _JOB_QUEUE_REDIS = redis_pkg.from_url(redis_url, decode_responses=True)
        else:
            host = os.getenv("REDIS_HOST", "localhost")
            port = int(os.getenv("REDIS_PORT", 6379))
            _JOB_QUEUE_REDIS = redis_pkg.Redis(host=host, port=port, db=0, decode_responses=True)
        _JOB_QUEUE_REDIS.ping()
        return _JOB_QUEUE_REDIS
    except Exception:
        _JOB_QUEUE_REDIS = None
        return None


def _push_dead_letter(job_id: str, reason: Optional[str] = None) -> None:
    _update_job(job_id, dead_lettered=True, dead_letter_reason=reason)
    client = _get_queue_redis_client()
    if not client:
        return
    try:
        client.lpush(_JOB_DLQ_NAME, json.dumps({"jobId": job_id, "reason": reason, "at": datetime.utcnow().isoformat()}))
    except Exception:
        pass


def _read_dead_letter(limit: int = 100) -> List[Dict[str, Any]]:
    limit_n = max(1, min(limit, 500))
    client = _get_queue_redis_client()
    if not client:
        return []
    try:
        items = client.lrange(_JOB_DLQ_NAME, 0, limit_n - 1)
    except Exception:
        return []
    out: List[Dict[str, Any]] = []
    for raw in items:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                out.append(parsed)
                continue
        except Exception:
            pass
        out.append({"raw": str(raw)})
    return out


def _drop_dead_letter_record(job_id: str) -> None:
    client = _get_queue_redis_client()
    if not client:
        return
    try:
        items = client.lrange(_JOB_DLQ_NAME, 0, -1)
        for raw in items:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict) and str(parsed.get("jobId")) == str(job_id):
                    client.lrem(_JOB_DLQ_NAME, 1, raw)
            except Exception:
                continue
    except Exception:
        return


def _dispatch_job(job_id: str) -> str:
    """
    Queue-first dispatch. Falls back to direct in-process execution if queue is unavailable.
    Returns backend: redis | thread
    """
    if _JOB_WORKER_ENABLED:
        client = _get_queue_redis_client()
        if client:
            try:
                client.lpush(_JOB_QUEUE_NAME, job_id)
                _update_job(job_id, queue_backend="redis", status="queued")
                return "redis"
            except Exception:
                pass

    # Fallback path for local/dev or redis outage
    t = threading.Thread(target=_run_job, args=(job_id,), daemon=True, name=f"cdss-job-fallback-{job_id[:8]}")
    t.start()
    _update_job(job_id, queue_backend="thread", status="running")
    return "thread"


def _job_worker_loop() -> None:
    """
    Dedicated worker loop for queued jobs.
    """
    last_requeue_at = 0.0
    while not _JOB_WORKER_STOP.is_set():
        client = _get_queue_redis_client()
        if not client:
            _JOB_WORKER_STOP.wait(timeout=max(1, _JOB_WORKER_POLL_SECONDS))
            continue
        try:
            item = client.brpop(_JOB_QUEUE_NAME, timeout=max(1, _JOB_WORKER_POLL_SECONDS))
            if not item:
                now = time.monotonic()
                if settings_provider and now - last_requeue_at > 30:
                    try:
                        queued_jobs = settings_provider.get_jobs(limit=200, status="queued")
                        _requeue_jobs_if_missing(queued_jobs)
                    except Exception:
                        pass
                    last_requeue_at = now
                continue
            _, job_id = item
            if not job_id:
                continue
            with _ADMIN_JOBS_LOCK:
                job = _ADMIN_JOBS.get(str(job_id))
            if not job and settings_provider:
                try:
                    persisted = settings_provider.get_job(str(job_id))
                    if persisted:
                        with _ADMIN_JOBS_LOCK:
                            _ADMIN_JOBS[str(job_id)] = persisted
                        job = persisted
                except Exception:
                    pass
            if not job:
                continue
            _run_job(str(job_id))
        except Exception:
            _JOB_WORKER_STOP.wait(timeout=max(1, _JOB_WORKER_POLL_SECONDS))


def _start_job_worker() -> None:
    global _JOB_WORKER_THREAD
    if not _JOB_WORKER_ENABLED:
        return
    if _JOB_WORKER_THREAD and _JOB_WORKER_THREAD.is_alive():
        return
    _JOB_WORKER_STOP.clear()
    _JOB_WORKER_THREAD = threading.Thread(target=_job_worker_loop, daemon=True, name="cdss-job-worker")
    _JOB_WORKER_THREAD.start()


def _rehydrate_queued_jobs_on_startup() -> None:
    if not settings_provider:
        return
    client = _get_queue_redis_client()
    if not client:
        return
    try:
        queued_jobs = settings_provider.get_jobs(limit=200, status="queued")
    except Exception:
        return
    for job in queued_jobs:
        job_id = str(job.get("jobId") or "")
        if not job_id:
            continue
        with _ADMIN_JOBS_LOCK:
            _ADMIN_JOBS[job_id] = job
        try:
            client.lpush(_JOB_QUEUE_NAME, job_id)
            _update_job(job_id, queue_backend="redis", status="queued")
        except Exception:
            continue


def _requeue_jobs_if_missing(jobs: list[dict]) -> None:
    if not jobs:
        return
    client = _get_queue_redis_client()
    if not client:
        return
    queued = [j for j in jobs if str(j.get("status")) == "queued" and str(j.get("jobId") or "")]
    if not queued:
        return
    try:
        if client.llen(_JOB_QUEUE_NAME) > 0:
            return
    except Exception:
        return
    for job in queued:
        job_id = str(job.get("jobId") or "")
        if not job_id:
            continue
        with _ADMIN_JOBS_LOCK:
            _ADMIN_JOBS[job_id] = job
        try:
            client.lpush(_JOB_QUEUE_NAME, job_id)
            _update_job(job_id, queue_backend="redis", status="queued")
        except Exception:
            continue


def _run_reindex_job() -> Dict[str, Any]:
    if not diagnostic_assistant or not diagnostic_assistant.rag_engine:
        raise RuntimeError("RAG engine unavailable")
    ce = diagnostic_assistant.rag_engine
    if ce.chroma_client:
        ce.chroma_client.delete_collection("medical_guidelines")
        ce.collection = ce.chroma_client.get_or_create_collection("medical_guidelines")
        ce._build_bm25_index()
    count = ce.collection.count() if ce.collection else 0
    return {"reindexed": True, "documents": count}


def _run_cache_flush_job() -> Dict[str, Any]:
    if not diagnostic_assistant or not diagnostic_assistant.rag_engine:
        return {"flushed": 0}
    ce = diagnostic_assistant.rag_engine
    if not ce.redis_client:
        return {"flushed": 0}
    namespace = "cdss"
    if settings_provider:
        try:
            namespace = settings_provider.get_settings().get("cache_namespace", "cdss")
        except Exception:
            pass
    pattern_list = [f"{namespace}:*", "rag:*", "llm:*"]
    deleted = 0
    for pattern in pattern_list:
        try:
            for key in ce.redis_client.scan_iter(match=pattern):
                ce.redis_client.delete(key)
                deleted += 1
        except Exception:
            continue
    return {"flushed": deleted}


def _run_reencrypt_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not settings_provider:
        raise RuntimeError("Settings provider unavailable")
    per_table_limit = int(payload.get("per_table_limit") or 500)
    dry_run = bool(payload.get("dry_run", False))
    return settings_provider.reencrypt_payloads(per_table_limit=per_table_limit, dry_run=dry_run)


def _run_transcribe_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not _ensure_voice_scribe_loaded():
        raise RuntimeError("Voice service unavailable")
    temp_path = str(payload.get("temp_path") or "")
    language = payload.get("language")
    generate_soap = bool(payload.get("generate_soap", True))
    filename = str(payload.get("filename") or "audio.wav")
    tenant_key = str(payload.get("tenant_id") or "public")

    if not temp_path:
        raise RuntimeError("Missing transcription temp file path")

    try:
        transcription_result = voice_scribe.transcribe_audio(temp_path, language=language)
        if "error" in transcription_result:
            raise RuntimeError(transcription_result["error"])
        result: Dict[str, Any] = {
            "transcription": transcription_result,
            "soap_note": None,
            "audio_url": None,
            "storage_key": None,
        }

        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = _safe_filename(filename)
            file_key = f"tenants/{tenant_key}/voice-consultations/{timestamp}_{safe_name}"
            s3_client.upload_file(temp_path, MINIO_BUCKET, file_key)
            result["storage_key"] = file_key
            result["audio_url"] = f"{MINIO_ENDPOINT}/{MINIO_BUCKET}/{file_key}"
        except Exception as e:
            print(f"MinIO upload failed: {e}")

        if generate_soap:
            result["soap_note"] = asyncio.run(
                voice_scribe.generate_soap_note(
                    transcription_result["text"],
                    transcription_result.get("language"),
                )
            )
        return result
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


def _run_image_analysis_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not _ensure_medical_vision_loaded():
        raise RuntimeError("Medical Vision service unavailable")
    temp_path = str(payload.get("temp_path") or "")
    filename = str(payload.get("filename") or "image.bin")
    if not temp_path:
        raise RuntimeError("Missing image temp file path")
    try:
        with open(temp_path, "rb") as f:
            content = f.read()
        result = medical_vision.analyze_image(content, filename)
        if "error" in result:
            raise RuntimeError(result["error"])
        return result
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


def _run_job(job_id: str) -> None:
    _update_job(job_id, status="running")
    ok = False
    err: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    action_name = "job"
    try:
        with _ADMIN_JOBS_LOCK:
            job = dict(_ADMIN_JOBS.get(job_id) or {})
        if not job:
            return
        job_type = str(job.get("type") or "")
        payload = job.get("payload") or {}
        action_name = job_type or action_name

        if job_type == "ingest":
            from ingest_guidelines import ingest_guidelines
            ingest_result = ingest_guidelines()
            if isinstance(ingest_result, dict):
                result = {"ingested": bool(ingest_result.get("ok", True)), **ingest_result}
            else:
                result = {"ingested": True}
        elif job_type == "reindex":
            result = _run_reindex_job()
        elif job_type == "cache_flush":
            result = _run_cache_flush_job()
        elif job_type == "reencrypt":
            result = _run_reencrypt_job(payload)
        elif job_type == "transcribe":
            result = _run_transcribe_job(payload)
        elif job_type == "analyze_image":
            result = _run_image_analysis_job(payload)
        else:
            raise RuntimeError(f"Unsupported job type: {job_type}")
        ok = True
    except Exception as e:
        err = str(e)
        ok = False
    finally:
        with _ADMIN_JOBS_LOCK:
            job_snapshot = dict(_ADMIN_JOBS.get(job_id) or {})
        _update_job(
            job_id,
            status="completed" if ok else "failed",
            finished_at=datetime.utcnow().isoformat(),
            message=None if ok else err,
            result=result if ok else None,
        )
        if (not ok) and int(job_snapshot.get("attempt") or 1) >= int(job_snapshot.get("max_attempts") or _MAX_ADMIN_JOB_ATTEMPTS):
            _push_dead_letter(job_id, reason=err)
        if settings_provider:
            try:
                with _ADMIN_JOBS_LOCK:
                    job = _ADMIN_JOBS.get(job_id) or {}
                settings_provider.log_action(
                    actor=job.get("owner", "system"),
                    action=f"{action_name}_{'completed' if ok else 'failed'}",
                    payload={
                        "jobId": job_id,
                        "type": job.get("type"),
                        "tenant_id": job.get("tenant_id"),
                        "attempt": job.get("attempt"),
                        "message": err,
                    },
                )
            except Exception:
                pass

def require_owner(request: Request, response: Response, authorization: str = Header(None)) -> str:
    """
    Owner gating with JWT verification only:
    - Requires Authorization: Bearer <token>
    - Extracts email from JWT and checks against OWNER_EMAILS
    """
    allow = os.getenv("OWNER_EMAILS", "")
    allowed = [e.strip().lower() for e in allow.split(",") if e.strip()]
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authorization bearer token required")

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=["HS256"])
        email_from_jwt = str(payload.get("email") or payload.get("sub") or "").lower()
        owner_claims = extract_owner_claim_sets(payload)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if not email_from_jwt:
        raise HTTPException(status_code=401, detail="Token missing required email/sub claim")
    # Rate limiting helper using Redis (if available)
    def _rate_limit(email: str):
        try:
            limit_per_min = int(os.getenv("ADMIN_RATE_LIMIT_PER_MIN", "60"))
            if limit_per_min <= 0:
                return
            # Use RAG engine's Redis if available, else try new client
            r = None
            try:
                if diagnostic_assistant and diagnostic_assistant.rag_engine and diagnostic_assistant.rag_engine.redis_client:
                    r = diagnostic_assistant.rag_engine.redis_client
                else:
                    redis_url = os.getenv("REDIS_URL")
                    if redis_url:
                        r = redis_pkg.from_url(redis_url, decode_responses=True)
                    else:
                        host = os.getenv("REDIS_HOST", "localhost")
                        port = int(os.getenv("REDIS_PORT", 6379))
                        r = redis_pkg.Redis(host=host, port=port, db=0, decode_responses=True)
            except Exception:
                r = None
            if not r:
                return
            path = request.url.path
            minute = datetime.utcnow().strftime("%Y%m%d%H%M")
            key = f"ratelimit:admin:{email}:{path}:{minute}"
            count = r.incr(key)
            if count == 1:
                r.expire(key, 60)
            try:
                ttl = r.ttl(key)
            except Exception:
                ttl = 60
            remaining = max(0, limit_per_min - count)
            try:
                response.headers["X-RateLimit-Limit"] = str(limit_per_min)
                response.headers["X-RateLimit-Remaining"] = str(remaining)
                response.headers["X-RateLimit-Reset"] = str(ttl if isinstance(ttl, int) and ttl >= 0 else 60)
            except Exception:
                pass
            if count > limit_per_min:
                raise HTTPException(status_code=429, detail="Rate limit exceeded")
        except HTTPException:
            raise
        except Exception:
            # Fail-open on rate limit errors
            return
    if email_from_jwt not in allowed:
        raise HTTPException(status_code=403, detail="Owner access required")

    request.state.owner_claims = owner_claims
    _rate_limit(email_from_jwt)
    return email_from_jwt


def require_owner_scope(required_scope: str):
    def _dep(request: Request, response: Response, authorization: str = Header(None)) -> str:
        owner = require_owner(request=request, response=response, authorization=authorization)
        claims = getattr(request.state, "owner_claims", {"roles": set(), "scopes": set(), "permissions": set()})
        has_explicit_claims = bool(claims.get("roles") or claims.get("scopes") or claims.get("permissions"))
        if not has_explicit_claims and not OWNER_SCOPE_STRICT:
            return owner
        if not is_owner_scope_allowed(claims, required_scope):
            raise HTTPException(status_code=403, detail=f"Missing required scope: {required_scope}")
        return owner

    return _dep

@app.get("/admin/status")
async def admin_status(owner: str = Depends(require_owner_scope("cdss.admin.read"))):
    llm = {
        "enabled": os.getenv("LLM_ENABLED", "true").lower() == "true",
        "model": os.getenv("LLM_MODEL_NAME"),
        "api_url": os.getenv("LLM_API_URL")
    }
    if diagnostic_assistant and diagnostic_assistant.llm_provider:
        try:
            llm["model"] = diagnostic_assistant.llm_provider.model_name
            llm["enabled"] = diagnostic_assistant.llm_provider.enabled
            llm["api_url"] = diagnostic_assistant.llm_provider.base_url
        except Exception:
            pass

    rag = {
        "enabled": diagnostic_assistant.rag_engine is not None,
        "documents": None,
        "cache_enabled": False
    }
    try:
        if diagnostic_assistant.rag_engine and diagnostic_assistant.rag_engine.collection:
            rag["documents"] = diagnostic_assistant.rag_engine.collection.count()
        if diagnostic_assistant.rag_engine and diagnostic_assistant.rag_engine.redis_client:
            rag["cache_enabled"] = True
    except Exception:
        pass

    return {"llm": llm, "rag": rag}

class SettingsPayload(BaseModel):
    llm_enabled: Optional[bool] = None
    llm_api_url: Optional[str] = None
    llm_model_name: Optional[str] = None
    llm_max_retries: Optional[int] = None
    rag_enabled: Optional[bool] = None
    cache_ttl_seconds: Optional[int] = None
    cache_namespace: Optional[str] = None
    allow_pdf_uploads: Optional[bool] = None
    copilot_transparency_enabled: Optional[bool] = None
    copilot_input_allowlists: Optional[Dict[str, List[str]]] = None
    ai_min_confidence_score: Optional[float] = None
    ai_require_citations: Optional[bool] = None
    ai_min_citation_count: Optional[int] = None
    ai_abstain_on_low_confidence: Optional[bool] = None
    ai_contradiction_check_enabled: Optional[bool] = None


class ModelRegistryEntryPayload(BaseModel):
    model_id: str
    model_type: Optional[str] = "custom"
    provider: Optional[str] = "custom"
    version: Optional[str] = "unknown"
    status: Optional[str] = "active"
    config: Optional[Dict[str, Any]] = None


class TenantAIPolicyPayload(BaseModel):
    ai_enabled: Optional[bool] = None
    max_requests_per_minute: Optional[int] = None
    allowed_models: Optional[List[str]] = None


class EncryptionReencryptPayload(BaseModel):
    async_job: bool = True
    dry_run: bool = False
    per_table_limit: int = 500

@app.get("/admin/settings")
async def get_admin_settings(owner: str = Depends(require_owner_scope("cdss.admin.settings.read"))):
    if not settings_provider:
        raise HTTPException(status_code=501, detail="Settings store unavailable")
    return settings_provider.get_settings()

@app.put("/admin/settings")
async def update_admin_settings(payload: SettingsPayload, owner: str = Depends(require_owner_scope("cdss.admin.settings.write"))):
    if not settings_provider:
        raise HTTPException(status_code=501, detail="Settings store unavailable")
    # Basic data validation
    data = {k: v for k, v in payload.dict().items() if v is not None}
    if "cache_ttl_seconds" in data and (not isinstance(data["cache_ttl_seconds"], int) or data["cache_ttl_seconds"] < 0):

        raise HTTPException(status_code=400, detail="cache_ttl_seconds must be a non-negative integer")
    if "llm_max_retries" in data and (not isinstance(data["llm_max_retries"], int) or data["llm_max_retries"] < 0 or data["llm_max_retries"] > 5):
        raise HTTPException(status_code=400, detail="llm_max_retries must be an integer between 0 and 5")
    if "copilot_input_allowlists" in data:
        allowlists = data["copilot_input_allowlists"]
        if not isinstance(allowlists, dict):
            raise HTTPException(status_code=400, detail="copilot_input_allowlists must be an object")
        for key, value in allowlists.items():
            if not isinstance(value, list) or not all(isinstance(item, str) and item.strip() for item in value):
                raise HTTPException(status_code=400, detail=f"copilot_input_allowlists.{key} must be a non-empty string array")
    updated = settings_provider.set_settings(data, actor=owner, action="update_settings")
    return {"settings": updated}


# Tenant AI policy management
@app.get("/admin/tenants/{tenant_id}/ai-policy")
async def get_tenant_ai_policy(tenant_id: str, owner: str = Depends(require_owner_scope("cdss.admin.settings.read"))):
    if not settings_provider:
        raise HTTPException(status_code=501, detail="Settings store unavailable")
    policy = settings_provider.get_tenant_policy(tenant_id)
    return {"tenant_id": tenant_id, "policy": policy}

@app.put("/admin/tenants/{tenant_id}/ai-policy")
async def set_tenant_ai_policy(tenant_id: str, payload: TenantAIPolicyPayload, owner: str = Depends(require_owner_scope("cdss.admin.settings.write"))):
    if not settings_provider:
        raise HTTPException(status_code=501, detail="Settings store unavailable")
    policy = {k: v for k, v in payload.dict().items() if v is not None}
    saved = settings_provider.upsert_tenant_policy(tenant_id, policy)
    return {"tenant_id": tenant_id, "policy": saved}


@app.get("/admin/models")
async def admin_models(owner: str = Depends(require_owner_scope("cdss.admin.settings.read"))):
    if not settings_provider:
        raise HTTPException(status_code=501, detail="Settings store unavailable")
    return {"models": settings_provider.get_model_registry(active_only=False)}


@app.post("/admin/models")
async def admin_models_upsert(payload: ModelRegistryEntryPayload, owner: str = Depends(require_owner_scope("cdss.admin.settings.write"))):
    if not settings_provider:
        raise HTTPException(status_code=501, detail="Settings store unavailable")
    try:
        saved = settings_provider.upsert_model_registry_entry(actor=owner, entry=payload.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True, "model": saved}


@app.post("/admin/encryption/reencrypt")
async def admin_encryption_reencrypt(
    payload: EncryptionReencryptPayload,
    owner: str = Depends(require_owner_scope("cdss.admin.settings.write")),
):
    if not settings_provider:
        raise HTTPException(status_code=501, detail="Settings store unavailable")
    if not settings_provider.crypto.enabled:
        raise HTTPException(status_code=409, detail="Encryption is disabled")

    per_table_limit = max(1, min(int(payload.per_table_limit or 500), 5000))
    job_payload = {
        "dry_run": bool(payload.dry_run),
        "per_table_limit": per_table_limit,
    }

    if payload.async_job:
        job_id = _create_job(job_type="reencrypt", owner=owner, payload=job_payload)
        _dispatch_job(job_id)
        return {"started": True, "jobId": job_id}

    try:
        result = _run_reencrypt_job(job_payload)
        settings_provider.log_action(
            actor=owner,
            action="encryption_reencrypt",
            payload={"mode": "sync", **job_payload, "summary": result},
        )
        return {"started": False, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/admin/ingest")
async def admin_ingest(file: Optional[UploadFile] = File(None), owner: str = Depends(require_owner_scope("cdss.admin.jobs.write"))):
    if settings_provider:
        s = settings_provider.get_settings()
        if not s.get("allow_pdf_uploads", True) and file is not None:
            raise HTTPException(status_code=403, detail="PDF uploads disabled")
    upload_meta: Dict[str, Any] = {}
    file_sha256: Optional[str] = None
    version_label: Optional[str] = None
    if file is not None:
        upload_meta = _validate_upload_constraints(
            file,
            file_label="guideline pdf",
            max_bytes=_MAX_ADMIN_INGEST_UPLOAD_BYTES,
            allowed_mime_types=_ALLOWED_ADMIN_INGEST_MIME_TYPES,
            allowed_extensions=_ALLOWED_ADMIN_INGEST_EXTENSIONS,
        )
        target_dir = pathlib.Path(__file__).resolve().parent / "who-smart-guidelines" / "dak"
        target_dir.mkdir(parents=True, exist_ok=True)
        dest = target_dir / upload_meta["safe_filename"]
        content = await file.read()
        file_sha256 = hashlib.sha256(content).hexdigest()
        version_label = _derive_version_label(upload_meta.get("safe_filename"))
        scan_tmp_path = ""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", prefix="ingest_scan_") as tmp:
                tmp.write(content)
                scan_tmp_path = tmp.name
            _scan_file_for_malware(scan_tmp_path, "guideline pdf")
            with open(dest, "wb") as f:
                f.write(content)
        finally:
            if scan_tmp_path and os.path.exists(scan_tmp_path):
                os.remove(scan_tmp_path)
    job_id = _create_job(
        job_type="ingest",
        owner=owner,
        payload={
            "source_mode": "uploaded_file" if file is not None else "corpus_sync",
            "filename": upload_meta["safe_filename"] if file is not None else None,
            "size_bytes": upload_meta["size_bytes"] if file is not None else None,
            "content_type": upload_meta["content_type"] if file is not None else None,
            "file_sha256": file_sha256,
            "version_label": version_label,
        },
    )
    _dispatch_job(job_id)
    if settings_provider:
        try:
            settings_provider.log_action(actor=owner, action="ingest_start", payload={"filename": getattr(file, 'filename', None), "jobId": job_id})
        except Exception:
            pass
    return {"started": True, "jobId": job_id}

@app.post("/admin/reindex")
async def admin_reindex(async_job: bool = True, owner: str = Depends(require_owner_scope("cdss.admin.jobs.write"))):
    if async_job:
        job_id = _create_job(job_type="reindex", owner=owner)
        _dispatch_job(job_id)
        return {"started": True, "jobId": job_id}
    try:
        result = _run_reindex_job()
        if settings_provider:
            try:
                settings_provider.log_action(actor=owner, action="reindex", payload=result)
            except Exception:
                pass
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/ingest/jobs")
async def admin_ingest_jobs(limit: int = 20, owner: str = Depends(require_owner_scope("cdss.admin.jobs.read"))):
    with _ADMIN_JOBS_LOCK:
        arr = [j for j in _ADMIN_JOBS.values() if j.get("type") == "ingest"]
    arr.sort(key=lambda x: x.get("started_at") or "", reverse=True)
    return {"jobs": arr[:limit], "limit": limit}


@app.get("/admin/ingest/history")
async def admin_ingest_history(
    limit: int = 100,
    query: Optional[str] = None,
    owner: str = Depends(require_owner_scope("cdss.admin.jobs.read")),
):
    capped = max(1, min(int(limit or 100), 500))
    if settings_provider:
        try:
            jobs = settings_provider.get_jobs(limit=2000, job_type="ingest")
        except Exception:
            jobs = []
    else:
        with _ADMIN_JOBS_LOCK:
            jobs = [dict(j) for j in _ADMIN_JOBS.values() if str(j.get("type")) == "ingest"]

    jobs.sort(key=lambda x: x.get("finished_at") or x.get("started_at") or "", reverse=True)

    normalized_query = str(query or "").strip().lower()
    seen_by_hash: Dict[str, int] = {}
    records: List[Dict[str, Any]] = []

    for job in jobs:
        if str(job.get("type") or "") != "ingest":
            continue
        payload = job.get("payload") if isinstance(job.get("payload"), dict) else {}
        result = job.get("result") if isinstance(job.get("result"), dict) else {}
        finished_at = job.get("finished_at") or job.get("started_at")
        owner_email = str(job.get("owner") or "system")
        source_mode = str(payload.get("source_mode") or "corpus_sync")
        processed_files = result.get("processedFiles") if isinstance(result.get("processedFiles"), list) else []

        def _append_record(row: Dict[str, Any]) -> None:
            nonlocal records
            file_name = str(row.get("fileName") or row.get("filename") or "").strip()
            version_label = str(row.get("versionLabel") or row.get("version_label") or payload.get("version_label") or _derive_version_label(file_name) or "").strip()
            file_sha = str(row.get("sha256") or row.get("fileSha256") or payload.get("file_sha256") or "").strip().lower()
            size_bytes = row.get("sizeBytes") if row.get("sizeBytes") is not None else payload.get("size_bytes")
            chunk_count = row.get("chunkCount") if row.get("chunkCount") is not None else result.get("totalChunks")
            page_count = row.get("pageCount")

            if normalized_query:
                haystack = " ".join(
                    [
                        file_name,
                        version_label,
                        file_sha,
                        str(job.get("jobId") or ""),
                        owner_email,
                        str(row.get("status") or job.get("status") or ""),
                    ]
                ).lower()
                if normalized_query not in haystack:
                    return

            duplicate_count = 0
            if file_sha:
                duplicate_count = seen_by_hash.get(file_sha, 0)
                seen_by_hash[file_sha] = duplicate_count + 1

            records.append(
                {
                    "jobId": job.get("jobId"),
                    "status": row.get("status") or job.get("status"),
                    "owner": owner_email,
                    "sourceMode": source_mode,
                    "fileName": file_name or (source_mode == "corpus_sync" and "WHO guideline corpus") or "Unknown",
                    "versionLabel": version_label or None,
                    "fileSha256": file_sha or None,
                    "sizeBytes": int(size_bytes) if isinstance(size_bytes, (int, float)) else None,
                    "chunkCount": int(chunk_count) if isinstance(chunk_count, (int, float)) else None,
                    "pageCount": int(page_count) if isinstance(page_count, (int, float)) else None,
                    "contentType": payload.get("content_type"),
                    "ingestedAt": finished_at,
                    "duplicate": duplicate_count > 0,
                    "duplicateCountBefore": duplicate_count,
                }
            )

        if processed_files:
            for f in processed_files:
                if isinstance(f, dict):
                    _append_record(f)
        else:
            _append_record({})

    records.sort(key=lambda x: str(x.get("ingestedAt") or ""), reverse=True)
    return {
        "records": records[:capped],
        "total": len(records),
        "limit": capped,
        "query": normalized_query or None,
    }

@app.get("/admin/ingest/status/{job_id}")
async def admin_ingest_status(job_id: str, owner: str = Depends(require_owner_scope("cdss.admin.jobs.read"))):
    with _ADMIN_JOBS_LOCK:
        job = _ADMIN_JOBS.get(job_id)
    if not job or job.get("type") != "ingest":
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.post("/admin/ingest/retry/{job_id}")
async def admin_ingest_retry(job_id: str, owner: str = Depends(require_owner_scope("cdss.admin.jobs.write"))):
    with _ADMIN_JOBS_LOCK:
        existing = _ADMIN_JOBS.get(job_id)
    if not existing or existing.get("type") != "ingest":
        raise HTTPException(status_code=404, detail="Job not found")
    if existing.get("status") == "running":
        raise HTTPException(status_code=409, detail="Job is still running")
    attempt = int(existing.get("attempt") or 1) + 1
    if attempt > int(existing.get("max_attempts") or _MAX_ADMIN_JOB_ATTEMPTS):
        raise HTTPException(status_code=409, detail="Job reached maximum retry attempts")
    new_id = _create_job(
        job_type="ingest",
        owner=owner,
        payload=existing.get("payload") or {},
        retry_of=job_id,
        attempt=attempt,
    )
    _dispatch_job(new_id)
    if settings_provider:
        try:
            settings_provider.log_action(actor=owner, action="ingest_retry", payload={"retry_of": job_id, "jobId": new_id})
        except Exception:
            pass
    return {"started": True, "jobId": new_id, "retry_of": job_id}


@app.get("/admin/jobs")
async def admin_jobs(
    limit: int = 50,
    type: Optional[str] = None,
    status: Optional[str] = None,
    owner: str = Depends(require_owner_scope("cdss.admin.jobs.read")),
):
    if settings_provider:
        try:
            arr = settings_provider.get_jobs(
                limit=max(1, min(limit, 200)),
                job_type=type,
                status=status,
            )
            _requeue_jobs_if_missing(arr)
            return {"jobs": arr, "limit": limit}
        except Exception:
            pass
    with _ADMIN_JOBS_LOCK:
        arr = list(_ADMIN_JOBS.values())
    if type:
        arr = [j for j in arr if str(j.get("type")) == str(type)]
    if status:
        arr = [j for j in arr if str(j.get("status")) == str(status)]
    arr.sort(key=lambda x: x.get("started_at") or "", reverse=True)
    return {"jobs": arr[: max(1, min(limit, 200))], "limit": limit}


@app.get("/admin/jobs/{job_id}")
async def admin_job_status(job_id: str, owner: str = Depends(require_owner_scope("cdss.admin.jobs.read"))):
    if settings_provider:
        try:
            job = settings_provider.get_job(job_id)
            if job:
                return job
        except Exception:
            pass
    with _ADMIN_JOBS_LOCK:
        job = _ADMIN_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/admin/jobs/retry/{job_id}")
async def admin_job_retry(job_id: str, owner: str = Depends(require_owner_scope("cdss.admin.jobs.write"))):
    with _ADMIN_JOBS_LOCK:
        existing = _ADMIN_JOBS.get(job_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Job not found")
    if existing.get("status") == "running":
        raise HTTPException(status_code=409, detail="Job is still running")
    attempt = int(existing.get("attempt") or 1) + 1
    max_attempts = int(existing.get("max_attempts") or _MAX_ADMIN_JOB_ATTEMPTS)
    if attempt > max_attempts:
        raise HTTPException(status_code=409, detail="Job reached maximum retry attempts")

    new_id = _create_job(
        job_type=str(existing.get("type") or ""),
        owner=owner,
        tenant_id=str(existing.get("tenant_id") or "public"),
        payload=existing.get("payload") or {},
        retry_of=job_id,
        attempt=attempt,
    )
    _dispatch_job(new_id)
    return {"started": True, "jobId": new_id, "retry_of": job_id}


@app.get("/admin/jobs/dead-letter")
async def admin_dead_letter_jobs(limit: int = 100, owner: str = Depends(require_owner_scope("cdss.admin.jobs.read"))):
    return {"jobs": _read_dead_letter(limit=limit), "limit": max(1, min(limit, 500))}


@app.post("/admin/jobs/dead-letter/requeue/{job_id}")
async def admin_dead_letter_requeue(job_id: str, owner: str = Depends(require_owner_scope("cdss.admin.jobs.write"))):
    existing = None
    if settings_provider:
        try:
            existing = settings_provider.get_job(job_id)
        except Exception:
            existing = None
    if not existing:
        with _ADMIN_JOBS_LOCK:
            existing = _ADMIN_JOBS.get(job_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Job not found")
    if not bool(existing.get("dead_lettered")):
        raise HTTPException(status_code=409, detail="Job is not in dead-letter state")

    new_id = _create_job(
        job_type=str(existing.get("type") or ""),
        owner=owner,
        tenant_id=str(existing.get("tenant_id") or "public"),
        payload=existing.get("payload") or {},
        retry_of=str(existing.get("jobId") or job_id),
        attempt=1,
    )
    _dispatch_job(new_id)
    _drop_dead_letter_record(job_id)
    return {"started": True, "jobId": new_id, "retry_of": job_id}


@app.post("/admin/cache/flush")
async def admin_cache_flush(async_job: bool = True, owner: str = Depends(require_owner_scope("cdss.admin.jobs.write"))):
    if async_job:
        job_id = _create_job(job_type="cache_flush", owner=owner)
        _dispatch_job(job_id)
        return {"started": True, "jobId": job_id}
    result = _run_cache_flush_job()
    if settings_provider:
        try:
            settings_provider.log_action(actor=owner, action="cache_flush", payload=result)
        except Exception:
            pass
    return result

@app.post("/admin/metrics/reset")
async def admin_metrics_reset(owner: str = Depends(require_owner_scope("cdss.admin.metrics.write"))):
    ce = diagnostic_assistant.rag_engine if diagnostic_assistant else None
    if not ce or not ce.redis_client:
        return {"reset": 0}
    keys = [
        "metrics:rag:cache_hit",
        "metrics:rag:cache_miss",
        "metrics:llm:cache_hit",
        "metrics:llm:cache_miss",
    ]
    reset = 0
    try:
        for k in keys:
            ce.redis_client.delete(k)
            reset += 1
    except Exception:
        pass
    if settings_provider:
        try:
            settings_provider.log_action(actor=owner, action="metrics_reset", payload={"reset": reset})
        except Exception:
            pass
    return {"reset": reset}

@app.get("/admin/metrics")
async def admin_metrics(owner: str = Depends(require_owner_scope("cdss.admin.metrics.read"))):
    docs = None
    cache_keys = 0
    rag_cache_hit = 0
    rag_cache_miss = 0
    llm_cache_hit = 0
    llm_cache_miss = 0
    ce = diagnostic_assistant.rag_engine if diagnostic_assistant else None
    if ce and ce.collection:
        try:
            docs = ce.collection.count()
        except Exception:
            docs = None
    if ce and ce.redis_client:
        try:
            cache_keys = len(list(ce.redis_client.scan_iter(match="*")))
            try:
                val = ce.redis_client.get("metrics:rag:cache_hit")
                rag_cache_hit = int(val or 0)
            except Exception:
                rag_cache_hit = 0
            try:
                val = ce.redis_client.get("metrics:rag:cache_miss")
                rag_cache_miss = int(val or 0)
            except Exception:
                rag_cache_miss = 0
            try:
                val = ce.redis_client.get("metrics:llm:cache_hit")
                llm_cache_hit = int(val or 0)
            except Exception:
                llm_cache_hit = 0
            try:
                val = ce.redis_client.get("metrics:llm:cache_miss")
                llm_cache_miss = int(val or 0)
            except Exception:
                llm_cache_miss = 0
        except Exception:
            cache_keys = 0
    if settings_provider:
        try:
            settings_provider.log_action(actor=owner, action="metrics_view", payload={"documents": docs, "cache_keys": cache_keys})
        except Exception:
            pass
    def _rate(h, m):
        total = h + m
        return round((h / total) * 100, 2) if total > 0 else 0.0
    return {
        "documents": docs,
        "cache_keys": cache_keys,
        "rag_cache": {"hit": rag_cache_hit, "miss": rag_cache_miss, "hit_rate_percent": _rate(rag_cache_hit, rag_cache_miss)},
        "llm_cache": {"hit": llm_cache_hit, "miss": llm_cache_miss, "hit_rate_percent": _rate(llm_cache_hit, llm_cache_miss)}
    }

class AuditQuery(BaseModel):
    limit: Optional[int] = 50
    offset: Optional[int] = 0

@app.get("/admin/audit")
async def admin_audit(
    limit: int = 50,
    offset: int = 0,
    actor: Optional[str] = None,
    action: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    sortKey: Optional[str] = "created_at",
    sortDir: Optional[str] = "desc",
    owner: str = Depends(require_owner_scope("cdss.admin.audit.read"))
):
    if not settings_provider:
        raise HTTPException(status_code=501, detail="Settings store unavailable")
    sk = sortKey if sortKey in ["created_at", "actor", "action"] else "created_at"
    sd = "asc" if (str(sortDir or "").lower() == "asc") else "desc"
    logs = settings_provider.get_audit_logs(
        limit=limit,
        offset=offset,
        actor=actor,
        action=action,
        start_date=startDate,
        end_date=endDate,
        sort_key=sk,
        sort_dir=sd.upper(),
    )
    return {"logs": logs, "limit": limit, "offset": offset}

@app.post("/transcribe")
async def transcribe_audio(
    req: Request,
    file: UploadFile = File(...),
    generate_soap: bool = True,
    language: Optional[str] = Form(None),
    async_job: bool = Form(False),
):
    """
    Transcribe audio file (English, Shona, Ndebele) and optionally generate SOAP note.
    Stores audio in MinIO.
    """
    if not _ensure_voice_scribe_loaded():
        raise HTTPException(status_code=503, detail="Voice service unavailable")
    if language and language not in {"en", "sn", "nd", "auto"}:
        raise HTTPException(status_code=400, detail="Invalid language. Allowed: en, sn, nd, auto")
    
    tenant_key = _require_tenant_cache_key_from_request(req)
    upload_meta = _validate_upload_constraints(
        file,
        file_label="audio",
        max_bytes=_MAX_AUDIO_UPLOAD_BYTES,
        allowed_mime_types=_ALLOWED_AUDIO_MIME_TYPES,
        allowed_extensions=_ALLOWED_AUDIO_EXTENSIONS,
    )
    temp_path = _save_upload_to_tenant_temp(file, tenant_key)
    _scan_upload_or_cleanup(temp_path, "audio")

    if async_job:
        owner = _job_owner_from_request(req)
        job_id = _create_job(
            job_type="transcribe",
            owner=owner,
            tenant_id=tenant_key,
            payload={
                "tenant_id": tenant_key,
                "temp_path": temp_path,
                "filename": upload_meta["safe_filename"],
                "content_type": upload_meta["content_type"],
                "size_bytes": upload_meta["size_bytes"],
                "language": language,
                "generate_soap": generate_soap,
            },
        )
        _dispatch_job(job_id)
        return {"started": True, "jobId": job_id}

    try:
        return await run_in_threadpool(
            _run_transcribe_job,
            {
                "tenant_id": tenant_key,
                "temp_path": temp_path,
                "filename": upload_meta["safe_filename"],
                "content_type": upload_meta["content_type"],
                "size_bytes": upload_meta["size_bytes"],
                "language": language,
                "generate_soap": generate_soap,
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-image")
async def analyze_medical_image(
    req: Request,
    file: UploadFile = File(...),
    async_job: bool = Form(False),
):
    """
    Analyze medical images (X-Ray, DICOM) using Computer Vision.
    Detects: Pneumonia, Tuberculosis, Pleural Effusion, etc.
    """
    if not _ensure_medical_vision_loaded():
        raise HTTPException(status_code=503, detail="Medical Vision service unavailable")

    tenant_key = _require_tenant_cache_key_from_request(req)
    upload_meta = _validate_upload_constraints(
        file,
        file_label="image",
        max_bytes=_MAX_IMAGE_UPLOAD_BYTES,
        allowed_mime_types=_ALLOWED_IMAGE_MIME_TYPES,
        allowed_extensions=_ALLOWED_IMAGE_EXTENSIONS,
    )
    temp_path = _save_upload_to_tenant_temp(file, tenant_key)
    _scan_upload_or_cleanup(temp_path, "image")
    if async_job:
        owner = _job_owner_from_request(req)
        job_id = _create_job(
            job_type="analyze_image",
            owner=owner,
            tenant_id=tenant_key,
            payload={
                "tenant_id": tenant_key,
                "temp_path": temp_path,
                "filename": upload_meta["safe_filename"],
                "content_type": upload_meta["content_type"],
                "size_bytes": upload_meta["size_bytes"],
            },
        )
        _dispatch_job(job_id)
        return {"started": True, "jobId": job_id}
    try:
        return await run_in_threadpool(
            _run_image_analysis_job,
            {
                "tenant_id": tenant_key,
                "temp_path": temp_path,
                "filename": upload_meta["safe_filename"],
                "content_type": upload_meta["content_type"],
                "size_bytes": upload_meta["size_bytes"],
            },
        )
    except Exception as e:
        print(f"Image analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


duplicate_detector = DuplicateTherapyDetector()
high_risk_detector = HighRiskMedicationDetector()
food_interaction_checker = FoodInteractionChecker()

# Advanced Drug Interaction Checking
@app.post("/drugs/interactions/advanced", response_model=DrugInteractionResponse)
async def check_drug_interactions_advanced(request: DrugInteractionRequest):
    """
    Advanced drug-drug interaction checking with:
    - Pharmacokinetic interactions (CYP450 enzyme interactions)
    - Pharmacodynamic interactions (receptor-based, synergistic effects)
    - Clinical significance scoring
    - Evidence-based management recommendations
    """
    if len(request.drug_ids) < 2:
        return DrugInteractionResponse(
            interactions=[],
            severity_summary={"critical": 0, "major": 0, "moderate": 0, "minor": 0},
            recommendations=["At least 2 drugs required for interaction checking"]
        )
    
    # Fetch drug data if not provided
    drugs_data = request.drugs_data
    if not drugs_data:
        # Optionally fetch from EHR service (if EHR_SERVICE_URL is set)
        ehr_api_url = os.getenv("EHR_SERVICE_URL")
        # For now, we'll use the drug_ids to infer names
        # In production, make HTTP call to EHR service to get drug details
        drugs_data = [{"id": drug_id, "name": drug_id} for drug_id in request.drug_ids]
    
    # Generate all drug pairs
    drug_pairs = []
    for i in range(len(drugs_data)):
        for j in range(i + 1, len(drugs_data)):
            drug_pairs.append({
                'drug1': drugs_data[i],
                'drug2': drugs_data[j]
            })
    
    # Analyze interactions
    interactions = analyzer.analyze_interactions(drug_pairs)
    
    # Calculate severity summary
    severity_counts = {"critical": 0, "major": 0, "moderate": 0, "minor": 0}
    recommendations = []
    
    for interaction in interactions:
        severity = interaction.get('severity', 'minor')
        if severity in severity_counts:
            severity_counts[severity] += 1
        
        # Generate recommendations
        if 'management' in interaction:
            recommendations.append(f"{interaction.get('drug1', 'Drug 1')} + {interaction.get('drug2', 'Drug 2')}: {interaction['management']}")
        elif 'risk' in interaction:
            recommendations.append(f"Monitor for {interaction['risk']}")
    
    if not interactions:
        recommendations.append("No significant interactions detected with current analysis")
    
    # Format interactions for response
    formatted_interactions = []
    for interaction in interactions:
        formatted_interactions.append({
            "drug1": interaction.get('drug1', 'Unknown'),
            "drug2": interaction.get('drug2', 'Unknown'),
            "severity": interaction.get('severity', 'minor'),
            "mechanism": interaction.get('mechanism', interaction.get('effect', 'Unknown mechanism')),
            "description": interaction.get('effect') or interaction.get('clinical_impact', ''),
            "management": interaction.get('management') or interaction.get('risk', ''),
            "source": interaction.get('source', 'cdss_analysis'),
            "clinical_significance": interaction.get('clinical_significance', 5.0)
        })
    
    return DrugInteractionResponse(
        interactions=formatted_interactions,
        severity_summary=severity_counts,
        recommendations=recommendations if recommendations else ["No interactions detected"]
    )


# Clinical Guidelines Engine
@app.post("/guidelines/check")
async def check_clinical_guidelines(request: ClinicalGuidelineRequest):
    """
    Check clinical guidelines and protocols based on:
    - Diagnosis/condition
    - Patient demographics
    - Comorbidities
    - Current medications
    
    Returns evidence-based recommendations from WHO, ADA, AHA, IDSA, etc.
    """
    result = guidelines_engine.check_guidelines(
        condition=request.condition,
        patient_age=request.patient_age,
        patient_gender=request.patient_gender,
        comorbidities=request.comorbidities,
        medications=request.medications
    )
    
    return {
        "guidelines": result.get('guidelines', []),
        "recommendations": result.get('recommendations', []),
        "contraindications": result.get('contraindications', []),
        "medication_warnings": result.get('medication_warnings', []),
        "evidence_level": result.get('evidence_level', 'moderate'),
        "matched_condition": result.get('matched_condition', request.condition)
    }


class GuidelineSearchRequest(BaseModel):
    query: str = Field(..., description="Search query for clinical guidelines")
    limit: int = Field(5, description="Maximum number of results to return")
    patient_context: Optional[Dict[str, Any]] = Field(None, description="Patient specific data (vitals, age, gender, conditions)")


@app.post("/guidelines/search")
async def search_guidelines(request: GuidelineSearchRequest, req: Request):
    """
    Search for clinical guidelines using RAG and optionally generate patient-specific analysis.
    """
    citations = []
    analysis = None
    tenant_cache_key = _tenant_cache_key_from_request(req)
    safe_query = redact_text(request.query)
    filters = _build_guideline_population_filters(request.patient_context)
    
    # 1. Retrieve relevant guidelines (RAG)
    if diagnostic_assistant.rag_engine:
        try:
            print("[CDSS] Searching guidelines")

            if filters:
                print(f"[CDSS] Applying RAG population filters: {filters}")

            citations = diagnostic_assistant.rag_engine.query(
                safe_query,
                n_results=request.limit,
                filters=filters if filters else None,
                tenant_id=tenant_cache_key
            )
            citations = _filter_guideline_citations_by_population(citations, request.patient_context)
        except Exception as e:
            print(f"[CDSS] Guideline search failed: {e}")
            
    # 2. Generate Patient-Specific Analysis (LLM) with caching
    if diagnostic_assistant.llm_provider:
        try:
            # Construct context-aware prompt
            context_str = ""
            if request.patient_context:
                safe_patient_context = redact_value(request.patient_context)
                context_str = "\n".join([f"{k}: {v}" for k, v in safe_patient_context.items()])
            else:
                context_str = "No specific patient context provided. Answer generally."

            guidelines_str = "\n\n".join([f"Source: {c['source']}\n{c['text']}" for c in citations])
            
            prompt = f"""
            You are a clinical decision support assistant. 
            Analyze the following patient case against the provided clinical guidelines.
            
            PATIENT CONTEXT:
            {context_str}
            
            RELEVANT GUIDELINES:
            {guidelines_str[:12000]}
            
            USER QUERY: {safe_query}
            
            INSTRUCTIONS:
            1. FIRST, think step-by-step: Analyze the patient's vitals/demographics against the guidelines.
            2. THEN, provide specific recommendations for THIS patient.
            3. Cite the guidelines where appropriate.
            4. Highlight any red flags or immediate actions needed.
            5. Keep it concise and clinically actionable.
            6. If the guidelines provided are not relevant, state that clearly.
            
            FORMAT YOUR RESPONSE AS:
            **Clinical Reasoning:**
            [Step-by-step analysis]
            
            **Recommendation:**
            [Actionable advice]
            """
            analysis = None
            # Cache layer
            cache_client = None
            cache_ttl = 600
            try:
                if settings_provider:
                    cache_ttl = int(settings_provider.get_settings().get("cache_ttl_seconds", 600))
            except Exception:
                cache_ttl = 600
            if diagnostic_assistant.rag_engine and diagnostic_assistant.rag_engine.redis_client:
                cache_client = diagnostic_assistant.rag_engine.redis_client
            cache_key = f"llm:analysis:{tenant_cache_key}:{hashlib.md5(prompt.encode()).hexdigest()}"
            if cache_client:
                try:
                    cached = cache_client.get(cache_key)
                    if cached:
                        try:
                            cache_client.incr("metrics:llm:cache_hit")
                        except Exception:
                            pass
                        analysis = json.loads(cached)
                except Exception:
                    analysis = None
            if analysis is None:
                print(f"[CDSS] Generating analysis for patient context...")
                analysis = await diagnostic_assistant.llm_provider.generate_response(prompt)
                try:
                    if cache_client:
                        cache_client.incr("metrics:llm:cache_miss")
                except Exception:
                    pass
                # Persist to cache
                if cache_client and analysis:
                    try:
                        cache_client.setex(cache_key, cache_ttl, json.dumps(analysis))
                    except Exception:
                        pass
            
        except Exception as e:
            print("[CDSS] LLM analysis failed")
            analysis = f"Analysis generation failed due to a temporary error: {str(e)}. Please try again."

    return {
        "query": request.query,
        "citations": citations,
        "analysis": analysis,
        "count": len(citations),
        "applied_filters": filters or {},
    }


# Risk Scoring Algorithms
@app.post("/risk/calculate")  # Removed response_model to allow additional fields (trends, visit_patterns)
async def calculate_risk_score(request: RiskScoreRequest, req: Request):
    """
    Calculate patient risk scores:
    - Cardiovascular risk (Framingham)
    - Medication adherence risk
    - Readmission risk
    
    Combines multiple risk factors from vitals, medications, diagnoses, and lab results
    """
    factors = []
    recommendations = []
    risk_scores = []
    
    # Extract data from request
    vitals = request.vitals or {}
    age = vitals.get('age') or vitals.get('patient_age')
    gender = vitals.get('gender') or vitals.get('patient_gender', '').lower()
    systolic_bp = None
    if vitals.get('bloodPressure'):
        bp_parts = str(vitals['bloodPressure']).split('/')
        if len(bp_parts) >= 1:
            try:
                systolic_bp = int(bp_parts[0])
            except (ValueError, TypeError):
                systolic_bp = None
    
    # 1. Cardiovascular Risk (Framingham)
    if age and systolic_bp and vitals.get('totalCholesterol') and vitals.get('hdlCholesterol'):
        cv_risk = risk_scoring_engine.calculate_framingham_risk(
            age=int(age),
            gender=gender or 'unknown',
            total_cholesterol=float(vitals.get('totalCholesterol', 0)),
            hdl_cholesterol=float(vitals.get('hdlCholesterol', 0)),
            systolic_bp=int(systolic_bp),
            smoker=vitals.get('smoker', False),
            diabetes=any('diabetes' in d.lower() for d in request.diagnoses),
            on_bp_medication=any('ace' in m.lower() or 'arb' in m.lower() or 'beta' in m.lower() for m in request.medications)
        )
        risk_scores.append(cv_risk)
        factors.append({
            'category': 'cardiovascular',
            'score': cv_risk['overall_score'],
            'level': cv_risk['risk_level'],
            'model': cv_risk['model']
        })
        recommendations.extend(cv_risk['recommendations'])
    
    # 2. Readmission Risk
    if age:
        readmission_risk = risk_scoring_engine.calculate_readmission_risk(
            age=int(age),
            number_of_medications=len(request.medications),
            number_of_comorbidities=len(request.diagnoses),
            previous_admissions=vitals.get('previousAdmissions', 0),
            emergency_department_visits=vitals.get('edVisits', 0)
        )
        risk_scores.append(readmission_risk)
        factors.append({
            'category': 'readmission',
            'score': readmission_risk['overall_score'],
            'level': readmission_risk['risk_level'],
            'model': readmission_risk['model']
        })
        recommendations.extend(readmission_risk['recommendations'])
    
    # 3. Medication Adherence Risk
    if request.medications:
        medication_frequencies = [vitals.get(f'med_{i}_frequency', 'once daily') for i in range(len(request.medications))]
        adherence_risk = risk_scoring_engine.calculate_adherence_risk(
            number_of_medications=len(request.medications),
            medication_frequency=medication_frequencies,
            patient_age=int(age) if age else None,
            cognitive_impairment=any('dementia' in d.lower() or 'alzheimers' in d.lower() for d in request.diagnoses),
            cost_concerns=vitals.get('costConcerns', False)
        )
        risk_scores.append(adherence_risk)
        factors.append({
            'category': 'adherence',
            'score': adherence_risk['overall_score'],
            'level': adherence_risk['risk_level'],
            'model': adherence_risk['model']
        })
        recommendations.extend(adherence_risk['recommendations'])
    
    # Calculate overall risk (average of all scores, weighted)
    if risk_scores:
        overall_score = sum(r['overall_score'] for r in risk_scores) / len(risk_scores)
        
        # Determine overall risk level
        risk_levels = [r['risk_level'] for r in risk_scores]
        if 'critical' in risk_levels:
            overall_risk_level = 'critical'
        elif 'high' in risk_levels:
            overall_risk_level = 'high'
        elif 'moderate' in risk_levels:
            overall_risk_level = 'moderate'
        else:
            overall_risk_level = 'low'
    else:
        overall_score = 0.0
        overall_risk_level = 'unknown'
        recommendations.append('Insufficient data for risk calculation - provide age, vitals, medications, and diagnoses')
    
    # Perform trend analysis if historical data available
    trends = None
    print(f"[CDSS] Trend analysis check - historical_vitals: {len(request.historical_vitals) if request.historical_vitals else 0}")
    if request.historical_vitals and len(request.historical_vitals) > 0:
        try:
            current_vitals_with_date = {
                **request.vitals,
                'recordedAt': datetime.now().isoformat()
            }
            print(f"[CDSS] Calling analyze_vital_trends with {len(request.historical_vitals)} historical vitals")
            vital_trends = trend_analysis_engine.analyze_vital_trends(
                current_vitals_with_date,
                request.historical_vitals
            )
            print(f"[CDSS] analyze_vital_trends returned: has_trends={vital_trends.get('has_trends')}, trends_count={len(vital_trends.get('trends', {}))}")
            # Always include trends if we have any trend data
            if vital_trends.get('trends') and len(vital_trends.get('trends', {})) > 0:
                trends = vital_trends
                print(f"[CDSS] ✅ Setting trends - {len(vital_trends.get('trends', {}))} trend entries")
                # Add trend-based recommendations
                if vital_trends.get('alerts'):
                    recommendations.extend(vital_trends['alerts'])
            elif vital_trends.get('has_trends'):
                trends = vital_trends
                print(f"[CDSS] ✅ Setting trends (has_trends=True)")
                if vital_trends.get('alerts'):
                    recommendations.extend(vital_trends['alerts'])
            else:
                print(f"[CDSS] ⚠️ No trends detected - has_trends={vital_trends.get('has_trends')}, trends keys: {list(vital_trends.get('trends', {}).keys())}")
        except Exception as e:
            print(f"[CDSS] ❌ Error in trend analysis: {e}")
            import traceback
            traceback.print_exc()
    
    # Analyze visit patterns
    visit_patterns = None
    print(f"[CDSS] Visit pattern check - visit_history: {len(request.visit_history) if request.visit_history else 0}")
    if request.visit_history and len(request.visit_history) > 0:
        try:
            print(f"[CDSS] Calling analyze_visit_patterns with {len(request.visit_history)} visits")
            visit_patterns = trend_analysis_engine.analyze_visit_patterns(request.visit_history)
            print(f"[CDSS] analyze_visit_patterns returned: has_patterns={visit_patterns.get('has_patterns')}")
            if visit_patterns.get('has_patterns'):
                patterns = visit_patterns.get('patterns', {})
                print(f"[CDSS] ✅ Setting visit_patterns")
                if patterns.get('visit_frequency', {}).get('alert'):
                    recommendations.append(patterns['visit_frequency']['alert'])
            else:
                print(f"[CDSS] ⚠️ No visit patterns detected")
        except Exception as e:
            print(f"[CDSS] ❌ Error in visit pattern analysis: {e}")
            import traceback
            traceback.print_exc()
    
    # RAG-enhanced Guideline Citations
    guideline_citations = []
    tenant_cache_key = _tenant_cache_key_from_request(req)
    if diagnostic_assistant.rag_engine:
        # Collect terms to search for based on high risks and diagnoses
        search_terms = []
        # Add high risk diagnoses/conditions
        for d in request.diagnoses:
            search_terms.append(d)
        
        # Add high risk factors
        for f in factors:
            if f.get('level') in ['high', 'critical'] or f.get('impact') in ['major', 'critical']:
                # Extract simplified term from factor text if possible
                factor_text = f.get('factor', '')
                if 'Hypertension' in factor_text:
                    search_terms.append('Hypertension management')
                elif 'Diabetes' in factor_text:
                    search_terms.append('Diabetes management')
                elif 'Cholesterol' in factor_text:
                    search_terms.append('Dyslipidemia management')
                elif 'Adherence' in factor_text:
                    search_terms.append('Medication adherence strategies')
                else:
                    search_terms.append(factor_text)
        
        # Deduplicate terms
        search_terms = list(dict.fromkeys(search_terms))
        
        if search_terms:
            # Query for the top 3 most relevant terms
            query_terms = search_terms[:3]
            query = f"Clinical guidelines for {', '.join(query_terms)}"
            try:
                print("[CDSS] Querying RAG for risk guidelines")
                retrieved_docs = diagnostic_assistant.rag_engine.query(
                    redact_text(query),
                    n_results=3,
                    tenant_id=tenant_cache_key
                )
                if retrieved_docs:
                    guideline_citations = retrieved_docs
                    # Also add a general recommendation if we found citations
                    recommendations.append("Review AI-retrieved clinical guidelines for high-risk factors")
            except Exception as e:
                print(f"[CDSS] RAG query for risk guidelines failed: {e}")

    # Remove duplicates from recommendations
    unique_recommendations = list(dict.fromkeys(recommendations))
    
    # Build response with trend data
    response_data = {
        'overall_score': round(overall_score, 2),
        'risk_level': overall_risk_level,
        'factors': factors,
        'recommendations': unique_recommendations,
        'guideline_citations': guideline_citations
    }
    
    # Add trend data if available (as additional fields not in response model)
    print(f"[CDSS] Before adding to response - trends: {trends is not None}, visit_patterns: {visit_patterns is not None}")
    if trends:
        response_data['trends'] = trends
        print(f"[CDSS] ✅ Added trends to response_data")
    if visit_patterns:
        response_data['visit_patterns'] = visit_patterns
        print(f"[CDSS] ✅ Added visit_patterns to response_data")
    
    print(f"[CDSS] Final response_data keys: {list(response_data.keys())}")
    print(f"[CDSS] response_data has trends: {'trends' in response_data}")
    print(f"[CDSS] response_data has visit_patterns: {'visit_patterns' in response_data}")
    
    # Return as dict to include trend data (will be validated separately)
    return response_data


# Dosing Recommendations
class DosingRequest(BaseModel):
    drug_name: str = Field(..., description="Drug name or ID")
    patient_age: int = Field(..., description="Patient age in years")
    patient_weight_kg: Optional[float] = Field(None, description="Patient weight in kg")
    patient_gender: Optional[str] = Field(None, description="Patient gender")
    eGFR: Optional[float] = Field(None, description="Estimated GFR (mL/min/1.73m²)")
    serum_creatinine: Optional[float] = Field(None, description="Serum creatinine (mg/dL)")
    crCl: Optional[float] = Field(None, description="Creatinine clearance (mL/min)")
    hepatic_function: Optional[str] = Field(None, description="Hepatic function status")
    standard_dose: Optional[float] = Field(None, description="Standard dose to adjust from")


@app.post("/dosing/recommend")
async def recommend_dosing(request: DosingRequest):
    """
    Provide dosing recommendations based on:
    - Patient demographics (age, weight, gender)
    - Organ function (renal, hepatic)
    - Drug pharmacokinetics
    
    Calculates optimal dose considering:
    - Weight-based dosing
    - Renal function adjustments (Cockcroft-Gault)
    - Age-based adjustments (pediatric/geriatric)
    - Hepatic function considerations
    """
    result = dosing_calculator.recommend_dosing(
        drug_name=request.drug_name,
        patient_age=request.patient_age,
        patient_weight_kg=request.patient_weight_kg,
        patient_gender=request.patient_gender,
        eGFR=request.eGFR,
        serum_creatinine=request.serum_creatinine,
        crCl=request.crCl,
        hepatic_function=request.hepatic_function,
        standard_dose=request.standard_dose
    )
    
    return {
        "recommended_dose": result['recommended_dose'],
        "frequency": result['frequency'],
        "adjustments": result['adjustments'],
        "warnings": result['warnings'],
        "monitoring": result['monitoring'],
        "drug_name": result['drug_name']
    }


# Diagnostic Assistance
class DiagnosisRequest(BaseModel):
    symptoms: List[str] = Field(..., description="List of presenting symptoms")
    vitals: Optional[Dict[str, Any]] = Field(None, description="Vital signs")
    age: Optional[int] = Field(None, description="Patient age")
    gender: Optional[str] = Field(None, description="Patient gender")

    class Config:
        extra = "forbid"


class IntelligentDiagnosisRequest(BaseModel):
    symptoms: List[str] = Field(..., description="List of presenting symptoms")
    vitals: Optional[Dict[str, Any]] = Field(None, description="Vital signs")
    clinical_notes: Optional[str] = Field(None, description="Free-text clinical notes, chief complaint, history")
    patient_data: Optional[Dict[str, Any]] = Field(None, description="Structured patient data (for MedBERT)")
    age: Optional[int] = Field(None, description="Patient age")
    gender: Optional[str] = Field(None, description="Patient gender")
    labs: Optional[Dict[str, Any]] = Field(None, description="Lab results")
    conditions: Optional[List[str]] = Field(None, description="Existing conditions")

    class Config:
        extra = "forbid"


class PatientSummaryRequest(BaseModel):
    clinical_notes: List[str] = Field(..., description="List of historical clinical notes")
    age: int = Field(..., description="Patient age")
    gender: str = Field(..., description="Patient gender")
    recent_vitals: Optional[Dict[str, Any]] = Field(None, description="Most recent vital signs")

    class Config:
        extra = "forbid"


@app.post("/diagnosis/suggest")
async def suggest_diagnosis(request: DiagnosisRequest):
    """
    Diagnostic assistance based on:
    - Presenting symptoms (pattern matching)
    - Vital signs analysis
    - Patient demographics
    
    Returns differential diagnoses with probability scores, recommended tests, and clinical red flags
    
    Note: This endpoint uses rule-based CDSS only. For AI-enhanced diagnostics, use /diagnosis/suggest/intelligent
    """
    result = diagnostic_assistant.suggest_diagnosis(
        symptoms=request.symptoms,
        vitals=request.vitals,
        age=request.age,
        gender=request.gender
    )
    
    return {
        "suggested_diagnoses": result['suggested_diagnoses'],
        "confidence_scores": result['confidence_scores'],
        "recommended_tests": result['recommended_tests'],
        "red_flags": result['red_flags'],
        "vitals_clues": result.get('vitals_clues', []),
        "source": "rule_based_cdss"
    }


@app.post("/diagnosis/suggest/intelligent")
async def intelligent_diagnosis(request: IntelligentDiagnosisRequest, req: Request, ai_policy: Dict[str, Any] = Depends(get_ai_policy)):
    """
    Intelligent diagnostic assistance combining:
    - Rule-based CDSS (pattern matching, guidelines)
    - MedBERT (structured EHR data analysis)
    - ClinicalBERT (clinical notes analysis)
    
    Returns fused recommendations with confidence scores, source attribution, and explanations
    
    This is the "thinking" CDSS that combines rule-based logic with AI models for enhanced accuracy.
    """
    # scan request payload for PHI before proceeding
    try:
        assert_no_phi_in_payload(request.dict())
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    effective_ai_policy = _resolve_ai_policy(ai_policy, req)
    sanitized = _sanitize_intelligent_diagnosis_payload(request.dict())
    patient_data = sanitized.get("patient_data") or {}
    trace_payload = {
        "symptoms": sanitized.get("symptoms") or [],
        "vitals": sanitized.get("vitals"),
        "age": sanitized.get("age"),
        "gender": sanitized.get("gender"),
        "patient_data": patient_data if patient_data else None,
    }
    cfg = settings_provider.get_settings() if settings_provider else {}
    model_registry = settings_provider.get_runtime_model_registry_map() if settings_provider else {}

    # enforce tenant-specific AI policy
    if effective_ai_policy.get("ai_enabled") is False:
        # perform rule-based diagnosis and return a safe response
        rb = diagnostic_assistant.suggest_diagnosis(
            symptoms=request.symptoms,
            vitals=request.vitals,
            age=request.age,
            gender=request.gender,
        )
        disabled_trace = _copilot_model_trace_stub(
            "intelligent_diagnosis",
            request_payload=trace_payload,
            model_registry=model_registry,
            llm_route="policy_disabled",
        )
        return {
            "suggested_diagnoses": rb['suggested_diagnoses'],
            "confidence_scores": rb.get('confidence_scores', []),
            "recommended_tests": rb.get('recommended_tests', []),
            "red_flags": rb.get('red_flags', []),
            "vitals_clues": rb.get('vitals_clues', []),
            "source": "rule_based_cdss_policy_disabled",
            "ai_enabled": False,
            "ai_models_used": {},
            "explanation": "AI disabled for tenant by policy",
            "safety_gate": {"status": "policy_disabled", "passed": True, "reasons": []},
            "abstained": False,
            "abstain_reason": None,
            "model_registry": model_registry,
            "model_trace": disabled_trace,
            "input_policy": {
                "allowlist_applied": True,
                "phi_minimized": True,
                "symptoms_count": len(sanitized.get("symptoms") or []),
            },
        }
    governance_policy = {
        "min_confidence_score": cfg.get("ai_min_confidence_score", 0.55),
        "require_citations": cfg.get("ai_require_citations", True),
        "min_citation_count": cfg.get("ai_min_citation_count", 1),
        "abstain_on_low_confidence": cfg.get("ai_abstain_on_low_confidence", True),
        "contradiction_check_enabled": cfg.get("ai_contradiction_check_enabled", True),
    }
    
    try:
        result = await _run_copilot_with_resilience(
            "intelligent_diagnosis",
            lambda: diagnostic_assistant.intelligent_suggest(
                symptoms=sanitized.get("symptoms") or [],
                vitals=sanitized.get("vitals"),
                clinical_notes=sanitized.get("clinical_notes"),
                patient_data=patient_data if patient_data else None,
                age=sanitized.get("age"),
                gender=sanitized.get("gender"),
                tenant_id=_tenant_cache_key_from_request(req),
                governance_policy=governance_policy,
                model_registry=model_registry,
            ),
        )
    except Exception as e:
        fallback_trace = _copilot_model_trace_stub(
            "intelligent_diagnosis",
            request_payload=trace_payload,
            model_registry=model_registry,
            llm_route="fallback",
        )
        transparency = _copilot_transparency(
            action="intelligent_diagnosis",
            confidence="low",
            explanation="Intelligent diagnosis assistant unavailable; returned safe abstained response.",
            citations=[],
            source="safe_fallback",
            model_trace=fallback_trace,
        )
        return {
            "suggested_diagnoses": [],
            "confidence": transparency["confidence"],
            "recommended_tests": [],
            "red_flags": [],
            "vitals_clues": [],
            "guideline_citations": [],
            "source": "safe_fallback",
            "ai_enabled": False,
            "ai_models_used": {},
            "rule_based_contributions": 0,
            "ai_contributions": 0,
            "total_sources": 0,
            "explanation": "Intelligent diagnosis unavailable at this time. Use manual clinical workflow.",
            "safety_gate": {
                "status": "fallback",
                "passed": False,
                "reasons": ["service_unavailable"],
            },
            "abstained": True,
            "abstain_reason": "service_unavailable",
            "model_registry": model_registry,
            "model_trace": fallback_trace,
            "why_recommended": transparency["why_recommended"],
            "provenance": transparency["provenance"],
            "warnings": [str(e)],
            "input_policy": {
                "allowlist_applied": True,
                "phi_minimized": True,
                "symptoms_count": len(sanitized.get("symptoms") or []),
            },
        }

    explanation = result.get('explanation') or (
        result.get('clinical_recommendation', {}) or {}
    ).get('reasoning')
    transparency = _copilot_transparency(
        action="intelligent_diagnosis",
        confidence=result.get('confidence', 'moderate'),
        explanation=explanation,
        citations=result.get('guideline_citations', []),
        source=result.get('source', 'hybrid_cdss_ai'),
        model_trace=result.get("model_trace", {}),
    )

    return {
        "suggested_diagnoses": result.get('suggested_diagnoses', []),
        "confidence": transparency["confidence"],
        "recommended_tests": result.get('recommended_tests', []),
        "red_flags": result.get('red_flags', []),
        "vitals_clues": result.get('vitals_clues', []),
        "guideline_citations": result.get('guideline_citations', []),
        "source": result.get('source', 'hybrid_cdss_ai'),
        "ai_enabled": result.get('ai_enabled', False),
        "ai_models_used": result.get('ai_models_used', {}),
        "rule_based_contributions": result.get('rule_based_contributions', 0),
        "ai_contributions": result.get('ai_contributions', 0),
        "total_sources": result.get('total_sources', 1),
        "explanation": result.get('explanation', 'Combined results from rule-based CDSS and AI models'),
        "safety_gate": result.get("safety_gate", {}),
        "abstained": result.get("abstained", False),
        "abstain_reason": result.get("abstain_reason"),
        "model_registry": result.get("model_registry", {}),
        "model_trace": result.get("model_trace")
        or _copilot_model_trace_stub(
            "intelligent_diagnosis",
            request_payload=trace_payload,
            model_registry=result.get("model_registry", model_registry),
            llm_route="unknown",
        ),
        "why_recommended": transparency["why_recommended"],
        "provenance": transparency["provenance"],
        "input_policy": {
            "allowlist_applied": True,
            "phi_minimized": True,
            "symptoms_count": len(sanitized.get("symptoms") or []),
        },
    }


@app.post("/patient/summarize")
async def summarize_patient_history(request: PatientSummaryRequest, ai_policy: Dict[str, Any] = Depends(get_ai_policy)):
    """
    Generate a concise "One-Liner" summary of the patient's history using LLM.
    Useful for patient headers and quick context.
    """
    # scan for PHI
    try:
        assert_no_phi_in_payload(request.dict())
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    effective_ai_policy = _resolve_ai_policy(ai_policy)

    # policy may disable LLM
    if effective_ai_policy.get("ai_enabled") is False:
        raise HTTPException(status_code=403, detail="AI/LLM use disabled for tenant by policy")

    sanitized = _sanitize_summary_payload(request.dict())
    demographics = {"age": sanitized.get("age"), "gender": sanitized.get("gender")}

    try:
        result = await _run_copilot_with_resilience(
            "patient_summarization",
            lambda: diagnostic_assistant.summarize_patient_history(
                clinical_notes=sanitized.get("clinical_notes") or [],
                demographics=demographics,
                recent_vitals=sanitized.get("recent_vitals"),
            ),
        )
    except Exception as e:
        fallback_result = {
            "summary": "",
            "one_liner": "",
            "source": "safe_fallback",
            "warnings": [f"Patient summary unavailable: {str(e)}"],
        }
        transparency = _copilot_transparency(
            action="patient_summarization",
            confidence="low",
            explanation="Summary assistant unavailable; returned safe empty summary.",
            citations=[],
            source="safe_fallback",
        )
        return {
            **fallback_result,
            "why_recommended": transparency["why_recommended"],
            "confidence": transparency["confidence"],
            "provenance": {
                **transparency["provenance"],
                "notes_used": len(sanitized.get("clinical_notes") or []),
                "vitals_context": bool(sanitized.get("recent_vitals")),
            },
            "input_policy": {
                "allowlist_applied": True,
                "phi_minimized": True,
            },
        }
    transparency = _copilot_transparency(
        action="patient_summarization",
        confidence="moderate" if result.get("source") == "llm" else "low",
        explanation="Summary generated from recent de-identified nursing context and vitals.",
        citations=[],
        source=result.get("source", "unknown"),
    )
    return {
        **result,
        "why_recommended": transparency["why_recommended"],
        "confidence": transparency["confidence"],
        "provenance": {
            **transparency["provenance"],
            "notes_used": len(sanitized.get("clinical_notes") or []),
            "vitals_context": bool(sanitized.get("recent_vitals")),
        },
        "input_policy": {
            "allowlist_applied": True,
            "phi_minimized": True,
        },
    }


# Forecast Glucose Endpoint
@app.post("/forecast/glucose")
async def forecast_glucose(request: Dict[str, Any]):
    """
    Forecast future glucose levels using Exponential Smoothing (Holt-Winters).
    Requires at least 5 historical data points.
    """
    try:
        historical_glucose = request.get('historical_glucose', [])
        days = request.get('days', 7)
        
        return trend_analysis_engine.analyze_glucose_forecast(
            historical_glucose=historical_glucose,
            days_to_forecast=days
        )
    except Exception as e:
        print(f"Error in glucose forecasting: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Trend Analysis Endpoint
@app.post("/trends/analyze")
async def analyze_trends(request: Dict[str, Any]):
    """
    Analyze trends in patient data:
    - Vital sign trends
    - Visit patterns
    - Care gaps
    - Treatment response
    - Lab trends (Viral Load, CD4)
    """
    try:
        current_vitals = request.get('current_vitals', {})
        historical_vitals = request.get('historical_vitals', [])
        visit_history = request.get('visit_history', [])
        patient_age = request.get('patient_age')
        patient_gender = request.get('patient_gender')
        diagnoses = request.get('diagnoses', [])
        current_condition = request.get('current_condition')
        lab_history = request.get('lab_history', []) # New field
        
        results = {}
        
        # Vital trends
        if current_vitals and historical_vitals:
            results['vital_trends'] = trend_analysis_engine.analyze_vital_trends(
                current_vitals, historical_vitals
            )
        
        # Lab Trends (specifically for HIV/TB)
        if lab_history:
            results['lab_trends'] = {}
            for lab_type in ['cd4', 'viral_load']:
                trend = trend_analysis_engine.analyze_lab_trends(lab_history, lab_type)
                if trend.get('has_trend'):
                    results['lab_trends'][lab_type] = trend
        
        # Visit patterns
        if visit_history:
            results['visit_patterns'] = trend_analysis_engine.analyze_visit_patterns(visit_history)
        
        # Care gaps
        if visit_history:
            results['care_gaps'] = trend_analysis_engine.detect_care_gaps(
                patient_age, patient_gender, visit_history, diagnoses
            )
        
        # Treatment response
        if current_condition and visit_history:
            results['treatment_response'] = trend_analysis_engine.analyze_treatment_response(
                current_condition, visit_history
            )
        
        return results
    except Exception as e:
        print(f"Error in trend analysis: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Care Gap Detection Endpoint
@app.post("/care-gaps/detect")
async def detect_care_gaps(request: Dict[str, Any]):
    """
    Detect care gaps:
    - Missing screenings
    - Overdue vaccinations
    - Missing follow-ups
    - Preventive care reminders
    """
    try:
        patient_age = request.get('patient_age')
        patient_gender = request.get('patient_gender')
        visit_history = request.get('visit_history', [])
        diagnoses = request.get('diagnoses', [])
        
        gaps = trend_analysis_engine.detect_care_gaps(
            patient_age, patient_gender, visit_history, diagnoses
        )
        
        return gaps
    except Exception as e:
        print(f"Error in care gap detection: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Lab Result Interpreter Endpoint
class LabResultsRequest(BaseModel):
    lab_results: Dict[str, Any] = Field(..., description="Current lab results {test_name: value}")
    historical_labs: Optional[List[Dict[str, Any]]] = Field(None, description="Historical lab results for trend analysis")
    patient_id: Optional[str] = Field(None, description="Patient ID")


@app.post("/labs/interpret")
async def interpret_lab_results(request: LabResultsRequest):
    """
    Interpret lab results:
    - Abnormal value detection
    - Critical alerts
    - Trend analysis
    - Reference range checking
    """
    try:
        result = lab_interpreter.analyze_lab_results(
            lab_results=request.lab_results,
            historical_labs=request.historical_labs
        )
        
        return result
    except Exception as e:
        print(f"Error in lab interpretation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Duplicate Therapy Detection Endpoint
class DuplicateTherapyRequest(BaseModel):
    medications: List[Dict[str, Any]] = Field(..., description="List of current medications")
    prescriptions: Optional[List[Dict[str, Any]]] = Field(None, description="Prescription history for overlap checking")


@app.post("/medications/duplicates")
async def detect_duplicate_therapy(request: DuplicateTherapyRequest):
    """
    Detect duplicate therapy:
    - Exact duplicates
    - Same-class duplicates
    - Therapeutic duplications
    - Overlapping prescriptions
    """
    try:
        result = duplicate_detector.detect_duplicates(request.medications)
        
        # Check for overlapping prescriptions if provided
        if request.prescriptions:
            overlap_result = duplicate_detector.check_overlapping_prescriptions(request.prescriptions)
            result['overlapping_prescriptions'] = overlap_result
        
        return result
    except Exception as e:
        print(f"Error in duplicate therapy detection: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# High-Risk Medication Flags Endpoint
class HighRiskMedicationRequest(BaseModel):
    medications: List[Dict[str, Any]] = Field(..., description="List of medications to check")
    patient_age: Optional[int] = Field(None, description="Patient age")
    patient_gender: Optional[str] = Field(None, description="Patient gender")
    diagnoses: Optional[List[str]] = Field(None, description="Patient diagnoses")
    renal_function: Optional[float] = Field(None, description="eGFR or CrCl (mL/min)")


@app.post("/medications/high-risk")
async def check_high_risk_medications(request: HighRiskMedicationRequest):
    """
    Check medications against:
    - Beers Criteria (elderly inappropriate medications)
    - STOPP Criteria (potentially inappropriate prescriptions)
    - High-alert medication flags
    """
    try:
        result = high_risk_detector.check_high_risk_medications(
            medications=request.medications,
            patient_age=request.patient_age,
            patient_gender=request.patient_gender,
            diagnoses=request.diagnoses or [],
            renal_function=request.renal_function
        )
        
        return result
    except Exception as e:
        print(f"Error in high-risk medication checking: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


class FoodInteractionRequest(BaseModel):
    medications: List[Dict[str, Any]] = Field(..., description="List of current medications")


@app.post("/hiv/testing/algorithm")
async def process_hiv_testing_algorithm(request: Dict[str, Any]):
    """
    Process HIV test results through Zimbabwe National HIV Testing Algorithm.
    """
    try:
        from hiv_testing_algorithm import hiv_testing_algorithm
        tests = request.get('tests', [])
        result = hiv_testing_algorithm.process_test_sequence(tests)
        return result
    except Exception as e:
        print(f"Error in HIV testing algorithm: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/medications/food-interactions")
async def check_food_interactions(request: FoodInteractionRequest):
    """
    Check for common drug–food interactions:
    - Grapefruit juice (CYP3A4 inhibition)
    - Warfarin–vitamin K foods
    - MAOI–tyramine foods
    - Alcohol cautions
    """
    try:
        return food_interaction_checker.check(request.medications)
    except Exception as e:
        print(f"Error in food interaction checking: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/transcribe/basic")
async def transcribe_audio_basic(
    req: Request,
    file: UploadFile = File(...),
    generate_soap: bool = True
):
    """
    Transcribe audio (voice consultation) and optionally generate SOAP notes.
    Supports English, Shona, and Ndebele.
    """
    if not _ensure_voice_scribe_loaded():
        raise HTTPException(status_code=503, detail="Voice service unavailable")
    
    # Save uploaded file to temp
    tenant_key = _require_tenant_cache_key_from_request(req)
    _validate_upload_constraints(
        file,
        file_label="audio",
        max_bytes=_MAX_AUDIO_UPLOAD_BYTES,
        allowed_mime_types=_ALLOWED_AUDIO_MIME_TYPES,
        allowed_extensions=_ALLOWED_AUDIO_EXTENSIONS,
    )
    temp_path = _save_upload_to_tenant_temp(file, tenant_key)
    _scan_upload_or_cleanup(temp_path, "audio")
    
    try:
        # Transcribe
        transcription_result = voice_scribe.transcribe_audio(temp_path)
        
        if "error" in transcription_result:
             raise HTTPException(status_code=500, detail=transcription_result["error"])
        
        result = {
            "transcription": transcription_result,
            "soap_note": None
        }
        
        # Generate SOAP if requested
        if generate_soap:
            soap_result = await voice_scribe.generate_soap_note(
                transcription_result["text"],
                transcription_result.get("language"),
            )
            result["soap_note"] = soap_result
            
        return result
        
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 63 — Ambient AI transcription streaming endpoint
# ─────────────────────────────────────────────────────────────────────────────

class AmbientChunkRequest(BaseModel):
    audio: str = Field(..., description="Base64-encoded audio chunk")
    session_id: str
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)


@app.post("/transcription/stream")
async def transcription_stream(request: AmbientChunkRequest):
    """
    Process a single audio chunk from an ambient AI session.
    Returns structured entities extracted from the transcribed text.

    Entity types returned:
      diagnoses, medications, allergies, orders, vitals, alerts
    """
    transcript_text = ""
    entities = {
        "diagnoses":   [],
        "medications": [],
        "allergies":   [],
        "orders":      [],
        "vitals":      [],
        "alerts":      [],
    }
    draft_note = {"subjective": "", "objective": "", "assessment": "", "plan": ""}

    # Transcribe the audio chunk via the existing Whisper voice scribe
    try:
        import base64, tempfile, os as _os
        audio_bytes = base64.b64decode(request.audio)
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            result = voice_scribe.transcribe_audio(tmp_path)
            transcript_text = result.get("text", "") if isinstance(result, dict) else str(result)
        finally:
            if _os.path.exists(tmp_path):
                _os.remove(tmp_path)
    except Exception as e:
        print(f"[AmbientStream] transcription error: {e}")
        transcript_text = ""

    # Run entity extraction if we got a transcript
    if transcript_text.strip():
        try:
            # Use the diagnosis engine to extract clinical entities
            diag_result = await run_in_threadpool(
                diagnostic_assistant.suggest_diagnoses,
                symptoms=transcript_text,
                context=request.context or {},
            )
            raw_diagnoses = diag_result.get("diagnoses", []) if isinstance(diag_result, dict) else []
            entities["diagnoses"] = [
                {"text": d.get("name", ""), "icd": d.get("icd_code"), "confidence": d.get("confidence", 0.5)}
                for d in raw_diagnoses[:5]
            ]
        except Exception as e:
            print(f"[AmbientStream] entity extraction error: {e}")

        # Simple keyword-based draft note update (production would use LLM)
        lower = transcript_text.lower()
        if any(w in lower for w in ["complain", "present", "feeling", "pain", "symptom"]):
            draft_note["subjective"] = transcript_text.strip()
        if any(w in lower for w in ["exam", "appears", "vital", "blood pressure", "temperature"]):
            draft_note["objective"] = transcript_text.strip()
        if any(w in lower for w in ["diagnosis", "assess", "impression", "likely", "consistent"]):
            draft_note["assessment"] = transcript_text.strip()
        if any(w in lower for w in ["prescribe", "order", "refer", "follow", "plan", "recommend"]):
            draft_note["plan"] = transcript_text.strip()

    return {
        "transcript": transcript_text,
        "entities":   entities,
        "draftNote":  draft_note,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 61 — CDSS Outcome Feedback Loop
# ─────────────────────────────────────────────────────────────────────────────

class FeedbackEntry(BaseModel):
    logId: str
    patientId: str
    decisionType: str
    topRecommendation: Optional[str] = None
    confidenceScore: Optional[float] = None
    clinicianAction: Optional[str] = None  # accepted | modified | overridden | ignored
    overrideReason: Optional[str] = None
    outcomeAt30Days: Optional[Dict[str, Any]] = None
    outcomeAt90Days: Optional[Dict[str, Any]] = None
    createdAt: Optional[str] = None


class OutcomeFeedbackRequest(BaseModel):
    entries: List[FeedbackEntry]


@app.post("/feedback/outcome")
async def receive_outcome_feedback(payload: OutcomeFeedbackRequest):
    """
    Receives batched outcome feedback from the EHR service (weekly cron job).
    Each entry contains a CDSS recommendation that has been acted upon by a
    clinician, plus any linked 30/90-day outcome data.

    In production this feeds a retraining pipeline or writes to a feedback store.
    Currently logs to stdout and persists to Redis if available so the data is not
    lost while a full ML pipeline is wired in.
    """
    received_at = datetime.utcnow().isoformat()
    accepted  = sum(1 for e in payload.entries if e.clinicianAction == "accepted")
    modified  = sum(1 for e in payload.entries if e.clinicianAction == "modified")
    overridden = sum(1 for e in payload.entries if e.clinicianAction == "overridden")
    ignored   = sum(1 for e in payload.entries if e.clinicianAction == "ignored")
    with_outcomes = sum(
        1 for e in payload.entries
        if e.outcomeAt30Days or e.outcomeAt90Days
    )

    # Persist to Redis feedback queue when available (non-blocking)
    try:
        import redis as _redis
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        r = _redis.from_url(redis_url, socket_connect_timeout=2)
        for entry in payload.entries:
            r.lpush(
                "cdss:feedback:queue",
                json.dumps({
                    **entry.model_dump(),
                    "receivedAt": received_at,
                })
            )
    except Exception:
        pass  # Redis unavailable — entries are logged below

    print(
        f"[CDSS Feedback] received_at={received_at} total={len(payload.entries)} "
        f"accepted={accepted} modified={modified} overridden={overridden} "
        f"ignored={ignored} with_outcomes={with_outcomes}"
    )

    return {
        "status": "received",
        "total": len(payload.entries),
        "summary": {
            "accepted": accepted,
            "modified": modified,
            "overridden": overridden,
            "ignored": ignored,
            "withOutcomes": with_outcomes,
        },
        "receivedAt": received_at,
    }


class PediatricDosingRequest(BaseModel):
    drug_name: str
    weight_kg: float
    age_months: Optional[int] = None
    dose_mg_per_kg: Optional[float] = None
    indication: Optional[str] = None
    route: Optional[str] = "oral"


class GrowthAssessRequest(BaseModel):
    patient_id: Optional[str] = None
    age_months: Optional[float] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    head_circ_cm: Optional[float] = None
    muac_cm: Optional[float] = None
    gender: Optional[str] = None  # male | female


class MilestoneAssessRequest(BaseModel):
    patient_id: Optional[str] = None
    age_months: int
    milestones: List[Dict[str, Any]]  # [{domain, milestone, status}]


# WHO weight-based dosing reference (mg/kg doses, max doses)
_DOSING_REF: Dict[str, Dict[str, Any]] = {
    "amoxicillin":       {"mg_per_kg": 25,  "max_mg": 500,  "frequency": "TDS", "route": "oral"},
    "paracetamol":       {"mg_per_kg": 15,  "max_mg": 1000, "frequency": "QDS", "route": "oral"},
    "ibuprofen":         {"mg_per_kg": 10,  "max_mg": 400,  "frequency": "TDS", "route": "oral"},
    "cotrimoxazole":     {"mg_per_kg": 6,   "max_mg": 480,  "frequency": "BD",  "route": "oral", "note": "TMP component"},
    "metronidazole":     {"mg_per_kg": 7.5, "max_mg": 400,  "frequency": "TDS", "route": "oral"},
    "azithromycin":      {"mg_per_kg": 10,  "max_mg": 500,  "frequency": "OD",  "route": "oral"},
    "artemether_lumefantrine": {"mg_per_kg": None, "note": "Use weight-band AL dosing table (WHO)"},
}


@app.post("/dosing/pediatric")
async def pediatric_dosing(request: PediatricDosingRequest):
    """Weight-based pediatric dosing calculator with safe-range validation."""
    drug_key = request.drug_name.lower().replace(" ", "_").replace("-", "_")
    ref = _DOSING_REF.get(drug_key)

    warnings = []
    if request.weight_kg < 3:
        warnings.append("Weight <3 kg — use neonatal dosing protocols; consult specialist")
    if request.weight_kg > 70:
        warnings.append("Weight >70 kg — use adult dose ceiling")

    if ref is None:
        # Generic calculation using provided mg/kg
        if request.dose_mg_per_kg:
            calculated = round(request.dose_mg_per_kg * request.weight_kg, 1)
            return {
                "drug": request.drug_name,
                "weight_kg": request.weight_kg,
                "dose_mg_per_kg": request.dose_mg_per_kg,
                "calculated_dose_mg": calculated,
                "route": request.route,
                "warnings": warnings,
                "note": "Drug not in reference table — using provided mg/kg; verify against local formulary",
            }
        return {"error": f"Drug '{request.drug_name}' not in reference table and no mg/kg provided"}

    if ref.get("mg_per_kg") is None:
        return {"drug": request.drug_name, "note": ref.get("note"), "warnings": warnings}

    calculated = round(ref["mg_per_kg"] * request.weight_kg, 1)
    max_mg     = ref.get("max_mg")
    capped     = min(calculated, max_mg) if max_mg else calculated
    if max_mg and calculated > max_mg:
        warnings.append(f"Calculated dose {calculated} mg exceeds maximum {max_mg} mg — capped at {max_mg} mg")

    return {
        "drug":               request.drug_name,
        "weight_kg":          request.weight_kg,
        "dose_mg_per_kg":     ref["mg_per_kg"],
        "calculated_dose_mg": calculated,
        "recommended_dose_mg": capped,
        "maximum_dose_mg":    max_mg,
        "frequency":          ref.get("frequency"),
        "route":              ref.get("route", request.route),
        "warnings":           warnings,
        "note":               ref.get("note"),
    }


@app.post("/growth/assess")
async def assess_growth(request: GrowthAssessRequest):
    """
    WHO 2006 growth standard Z-score assessment.
    Returns nutritional status flags: stunting, wasting, underweight, overweight.
    Full LMS tables not embedded — uses simplified boundary thresholds for demo;
    replace with full WHO LMS lookup in production.
    """
    if request.age_months is None or (request.weight_kg is None and request.height_cm is None):
        return {"error": "age_months and at least one measurement required"}

    age = request.age_months
    flags = []
    nutritional_status = "normal"
    weight_for_age_z = None
    height_for_age_z = None
    weight_for_height_z = None
    bmi_for_age_z = None

    # Simplified Z-score estimation (WHO median weight/height by age)
    # These are rough medians — production should use full LMS tables
    median_weight = 3.3 + (age * 0.25) if age <= 12 else 9 + (age - 12) * 0.15
    median_height = 50 + (age * 2.5)   if age <= 12 else 80 + (age - 12) * 0.6
    sd_weight = max(0.5, median_weight * 0.1)
    sd_height = max(1.5, median_height * 0.05)

    if request.weight_kg is not None:
        weight_for_age_z = round((request.weight_kg - median_weight) / sd_weight, 2)
        if weight_for_age_z < -3:
            flags.append("Severely underweight (WAZ < -3)")
            nutritional_status = "severely_underweight"
        elif weight_for_age_z < -2:
            flags.append("Underweight (WAZ < -2)")
            if nutritional_status == "normal":
                nutritional_status = "underweight"
        elif weight_for_age_z > 2:
            flags.append("Overweight (WAZ > +2)")
            nutritional_status = "overweight"

    if request.height_cm is not None:
        height_for_age_z = round((request.height_cm - median_height) / sd_height, 2)
        if height_for_age_z < -3:
            flags.append("Severely stunted (HAZ < -3)")
            if "severely" not in nutritional_status:
                nutritional_status = "severely_stunted"
        elif height_for_age_z < -2:
            flags.append("Stunted (HAZ < -2)")
            if nutritional_status == "normal":
                nutritional_status = "stunted"

    if request.muac_cm is not None:
        if request.muac_cm < 11.5:
            flags.append("SAM: MUAC <11.5 cm — severe acute malnutrition")
            nutritional_status = "sam"
        elif request.muac_cm < 12.5:
            flags.append("MAM: MUAC 11.5–12.5 cm — moderate acute malnutrition")
            if "sam" not in nutritional_status:
                nutritional_status = "mam"

    if request.weight_kg and request.height_cm:
        bmi = request.weight_kg / ((request.height_cm / 100) ** 2)
        # Very rough BMI-for-age Z
        median_bmi = 15.5 + (age * 0.01)
        bmi_for_age_z = round((bmi - median_bmi) / 1.5, 2)
        if bmi_for_age_z > 2:
            flags.append("Obese (BMI-for-age Z > +2)")
            nutritional_status = "obese"

    percentile = None
    if weight_for_age_z is not None:
        # Approximate percentile from Z-score (standard normal CDF approximation)
        import math
        z = weight_for_age_z
        percentile = round(50 * (1 + math.erf(z / math.sqrt(2))), 1)

    return {
        "age_months":          age,
        "weight_for_age_z":    weight_for_age_z,
        "height_for_age_z":    height_for_age_z,
        "weight_for_height_z": weight_for_height_z,
        "bmi_for_age_z":       bmi_for_age_z,
        "growth_chart_percentile": percentile,
        "nutritional_status":  nutritional_status,
        "flags":               flags,
        "who_standard":        "WHO 2006 Child Growth Standards (simplified)",
        "action_required":     len(flags) > 0,
    }


@app.post("/milestone/assess")
async def assess_milestones(request: MilestoneAssessRequest):
    """Flag developmental delays against WHO age norms."""
    age = request.age_months
    delayed = []
    on_track = []
    referrals = []

    for m in request.milestones:
        expected = m.get("expected_age_months")
        status   = m.get("status", "pending")
        domain   = m.get("domain", "")
        name     = m.get("milestone", "")

        if status == "achieved":
            on_track.append({"domain": domain, "milestone": name})
            continue

        if expected and age > expected + 2:
            delayed.append({"domain": domain, "milestone": name, "expected_months": expected, "current_age_months": age})
            if age > expected + 4:
                referrals.append(f"Refer for {domain} assessment: '{name}' expected by {expected} months")

    overall_status = "normal"
    if len(delayed) >= 3 or (len(delayed) >= 1 and any("language" in d["domain"] or "cognitive" in d["domain"] for d in delayed)):
        overall_status = "global_delay_suspected"
        referrals.append("Multiple domains delayed — refer for comprehensive developmental assessment")
    elif len(delayed) >= 1:
        overall_status = "delay_in_one_or_more_domains"

    return {
        "age_months":      age,
        "on_track_count":  len(on_track),
        "delayed_count":   len(delayed),
        "delayed":         delayed,
        "overall_status":  overall_status,
        "referrals":       referrals,
        "action_required": len(referrals) > 0,
    }


class TbRegimenRequest(BaseModel):
    case_type: str  # pulmonary | extrapulmonary | mdr | xdr
    treatment_category: str  # new | relapse | treatment_after_failure | ...
    hiv_status: Optional[str] = "unknown"
    dst_results: Optional[Dict[str, Any]] = None
    patient_weight_kg: Optional[float] = None


class TbContactRiskRequest(BaseModel):
    index_case_type: str
    index_genexpert_result: Optional[str] = None
    contact_age: Optional[int] = None
    contact_hiv_status: Optional[str] = "unknown"
    exposure_duration_weeks: Optional[int] = None
    shared_bedroom: Optional[bool] = False


class TbAdherenceRequest(BaseModel):
    tb_patient_id: str
    dot_records: List[Dict[str, Any]]
    episode_start_date: Optional[str] = None
    expected_doses: Optional[int] = None


@app.post("/tb/regimen/recommend")
async def recommend_tb_regimen(request: TbRegimenRequest):
    """Recommend a TB treatment regimen based on case type and DST results."""
    dst = request.dst_results or {}
    rifampicin_resistant = str(dst.get("rifampicin", "")).lower() == "resistant"
    isoniazid_resistant  = str(dst.get("isoniazid", "")).lower() == "resistant"
    fluoro_resistant     = str(dst.get("fluoroquinolone", "")).lower() == "resistant"

    regimen_code  = "2HRZE/4HR"
    regimen_label = "Standard first-line: 2 months HRZE + 4 months HR"
    notes         = []
    monitoring    = []

    case = request.case_type.lower()
    cat  = request.treatment_category.lower()

    if case in ("mdr", "xdr") or rifampicin_resistant:
        if fluoro_resistant or case == "xdr":
            regimen_code  = "BPaL"
            regimen_label = "Bedaquiline + Pretomanid + Linezolid (XDR/pre-XDR)"
            notes.append("XDR/pre-XDR regimen — refer to specialist MDR-TB unit")
            monitoring = ["Monthly ECG (QTc)", "Monthly LFTs", "CBC", "Audiometry"]
        else:
            regimen_code  = "6BdqLfxCfzCs/12LfxCfzCs"
            regimen_label = "MDR-TB regimen: Bdq/Lfx/Cfz/Cs"
            notes.append("MDR-TB regimen — refer to specialist unit; notify national TB programme")
            monitoring = ["Monthly ECG (QTc for Bdq/Cfz)", "Monthly LFTs", "Weekly TSH (Cs)"]
    elif isoniazid_resistant and not rifampicin_resistant:
        regimen_code  = "6RZELfx"
        regimen_label = "Isoniazid-resistant DS-TB: 6 months RZELfx"
        notes.append("Isoniazid mono-resistance confirmed — do NOT use INH")
    elif cat in ("relapse", "treatment_after_failure", "treatment_after_ltfu"):
        regimen_code  = "2HRZES/1HRZE/5HRE"
        regimen_label = "Re-treatment: 2 months HRZES + 1 month HRZE + 5 months HRE"
        notes.append("Await DST results; switch to MDR regimen if rifampicin resistance found")

    if request.hiv_status == "positive":
        notes.append("HIV positive — ensure ART started; cotrimoxazole prophylaxis required")
        monitoring.append("CD4 count and viral load monitoring")

    weight_note = None
    if request.patient_weight_kg:
        weight_note = f"Dose banding for {request.patient_weight_kg}kg — use standard WHO weight band dosing tables"

    return {
        "regimen_code":  regimen_code,
        "regimen_label": regimen_label,
        "intensive_phase_months": 2 if "BPa" not in regimen_code else 6,
        "continuation_phase_months": 4 if regimen_code == "2HRZE/4HR" else 12,
        "dot_required": True,
        "notes": notes,
        "monitoring_required": monitoring,
        "weight_banding_note": weight_note,
    }


@app.post("/tb/contact/risk")
async def assess_tb_contact_risk(request: TbContactRiskRequest):
    """Risk-stratify a TB household contact."""
    score = 0
    factors = []

    if request.index_genexpert_result in ("mtb_detected", "mtb_detected_rif_resistant"):
        score += 30
        factors.append("Index case bacteriologically confirmed (GeneXpert positive)")

    if request.index_case_type in ("pulmonary", "mdr", "xdr"):
        score += 20
        factors.append("Pulmonary TB index case (higher transmission risk)")

    if request.shared_bedroom:
        score += 20
        factors.append("Shared sleeping space with index case")

    exposure_weeks = request.exposure_duration_weeks or 0
    if exposure_weeks >= 12:
        score += 15
        factors.append(f"Prolonged exposure ≥12 weeks ({exposure_weeks} weeks reported)")
    elif exposure_weeks >= 4:
        score += 8
        factors.append(f"Moderate exposure {exposure_weeks} weeks")

    age = request.contact_age or 99
    if age < 5:
        score += 25
        factors.append("Age <5 years — very high risk of progression to disease")
    elif age < 15:
        score += 10
        factors.append("Age <15 years — elevated risk")

    if request.contact_hiv_status == "positive":
        score += 25
        factors.append("HIV positive contact — high risk of TB progression")

    score = min(score, 100)
    if score >= 70:
        risk_level = "high"
        recommendation = "Immediate TB evaluation (symptoms, CXR, sputum if productive cough); start TPT if TB disease excluded"
    elif score >= 40:
        risk_level = "moderate"
        recommendation = "TB symptom screen + TST/IGRA; start TPT if LTBI confirmed and TB excluded"
    else:
        risk_level = "low"
        recommendation = "TB symptom screen; TPT if age <5 regardless of TST"

    return {
        "risk_level": risk_level,
        "risk_score": score,
        "risk_factors": factors,
        "recommendation": recommendation,
        "tpt_indicated": score >= 40 or (age < 5) or request.contact_hiv_status == "positive",
    }


@app.post("/tb/dot/adherence")
async def analyse_dot_adherence(request: TbAdherenceRequest):
    """Analyse DOT adherence and predict default risk."""
    records = request.dot_records or []
    if not records:
        return {"adherence_rate": None, "default_risk": "unknown", "message": "No DOT records provided"}

    total     = len(records)
    observed  = sum(1 for r in records if r.get("observed"))
    missed    = total - observed
    rate      = round(observed / total * 100, 1) if total else 0

    # Consecutive misses
    max_consecutive = 0
    current_streak  = 0
    recent_missed   = 0
    for i, r in enumerate(records):
        if not r.get("observed"):
            current_streak += 1
            max_consecutive = max(max_consecutive, current_streak)
            if i >= len(records) - 7:
                recent_missed += 1
        else:
            current_streak = 0

    # Default risk
    if rate < 80 or max_consecutive >= 7 or recent_missed >= 4:
        default_risk = "high"
        alert = "Patient at HIGH risk of treatment default — immediate follow-up required"
    elif rate < 90 or max_consecutive >= 3 or recent_missed >= 2:
        default_risk = "moderate"
        alert = "Adherence suboptimal — enhanced support recommended"
    else:
        default_risk = "low"
        alert = None

    return {
        "total_doses_expected": total,
        "doses_observed": observed,
        "doses_missed": missed,
        "adherence_rate_percent": rate,
        "max_consecutive_missed": max_consecutive,
        "missed_last_7_records": recent_missed,
        "default_risk": default_risk,
        "alert": alert,
        "who_threshold_met": rate >= 85,
    }


class InboxTriageRequest(BaseModel):
    source_type: str  # lab_result | imaging_result | patient_message | critical_alert | task | referral_response
    title: str
    content: str
    patient_id: Optional[str] = None


@app.post("/inbox/triage")
async def triage_inbox_item(request: InboxTriageRequest):
    """
    AI-triage an incoming inbox item and return a priority + reasoning.

    Priority levels: critical | urgent | routine | informational
    Triage score: 0–100 (higher = more urgent)

    Rules applied:
      - critical_alert source        → critical  (score 95)
      - lab_result with critical/H/L  → urgent    (score 80)
      - imaging_result with findings  → urgent    (score 75)
      - patient_message               → routine   (score 40), draft_reply generated
      - task / referral_response      → routine   (score 30)
      - keyword detection supplements score
    """
    content_lower = (request.title + " " + request.content).lower()
    source = request.source_type

    # Base scoring
    if source == "critical_alert":
        priority, score = "critical", 95
        reason = "Critical clinical alert requires immediate attention."
    elif source == "lab_result":
        critical_keywords = ["critical", "panic", "high", "low", " h ", " l ", "abnormal", "flagged"]
        if any(kw in content_lower for kw in critical_keywords):
            priority, score = "urgent", 80
            reason = "Lab result contains abnormal or critical value flags."
        else:
            priority, score = "routine", 35
            reason = "Lab result within expected parameters."
    elif source == "imaging_result":
        urgent_keywords = ["mass", "lesion", "fracture", "hemorrhage", "stroke", "embolism", "pneumothorax", "finding", "abnormal"]
        if any(kw in content_lower for kw in urgent_keywords):
            priority, score = "urgent", 75
            reason = "Imaging result contains clinically significant findings."
        else:
            priority, score = "routine", 30
            reason = "Imaging result appears unremarkable."
    elif source == "patient_message":
        emergency_keywords = ["chest pain", "can't breathe", "emergency", "severe", "bleeding", "unconscious", "stroke", "urgent"]
        if any(kw in content_lower for kw in emergency_keywords):
            priority, score = "urgent", 70
            reason = "Patient message contains possible emergency keywords."
        else:
            priority, score = "routine", 40
            reason = "Routine patient message."
    elif source == "referral_response":
        priority, score = "routine", 35
        reason = "Referral response received — review when convenient."
    else:
        priority, score = "routine", 30
        reason = "Standard inbox item."

    # Boost score for high-risk keywords anywhere
    boost_keywords = ["sepsis", "mi", "infarction", "anaphylaxis", "overdose", "suicide", "bp 180", "glucose 4", "k+ >6", "k+ <2"]
    if any(kw in content_lower for kw in boost_keywords):
        score = min(score + 20, 100)
        if priority not in ("critical", "urgent"):
            priority = "urgent"
        reason += " High-risk clinical keyword detected."

    # Draft reply for messages
    draft_reply = None
    if source == "patient_message":
        draft_reply = (
            "Thank you for your message. I have reviewed your concern and will follow up with you shortly. "
            "If you are experiencing a medical emergency, please call emergency services immediately."
        )

    # Due-by suggestion (hours)
    due_by_hours = None
    if priority == "critical":
        due_by_hours = 1
    elif priority == "urgent":
        due_by_hours = 4

    return {
        "priority":        priority,
        "priority_reason": reason,
        "triage_score":    score,
        "triage_model":    "rules_v1",
        "due_by_hours":    due_by_hours,
        "draft_reply":     draft_reply,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 68 — Mental Health CDSS
# ─────────────────────────────────────────────────────────────────────────────

class ScreeningRequest(BaseModel):
    tool: str
    responses: Dict[str, int]

class SuicideRiskRequest(BaseModel):
    ideation_type: Optional[str] = None          # passive / active_no_plan / active_with_plan / active_with_intent
    lethality: Optional[str] = None              # low / medium / high
    means_access: bool = False
    prior_attempts: int = 0
    protective_factors: List[str] = []
    substance_use: bool = False
    recent_loss: bool = False
    hopelessness_score: Optional[int] = None     # 0-20 Beck
    cssrs_score: Optional[int] = None

class MedicationMonitorRequest(BaseModel):
    drug_name: str
    drug_class: str
    dose_mg: Optional[float] = None
    last_level_value: Optional[float] = None
    last_level_unit: Optional[str] = None
    last_level_date: Optional[str] = None
    weight_kg: Optional[float] = None
    renal_function: Optional[str] = None         # normal / mild / moderate / severe
    hepatic_function: Optional[str] = None       # normal / mild / moderate / severe
    adverse_effects: Optional[str] = None

@app.post("/mental-health/screen")
async def score_screening(req: ScreeningRequest):
    tool = req.tool
    r = req.responses

    if tool == "PHQ-9":
        score = sum(r.get(str(i), 0) for i in range(1, 10))
        if score <= 4:   severity, action = "minimal",           "Monitor, routine follow-up"
        elif score <= 9: severity, action = "mild",              "Watchful waiting, repeat PHQ-9 in 2–4 weeks"
        elif score <= 14:severity, action = "moderate",          "Treatment plan, consider antidepressant or psychotherapy"
        elif score <= 19:severity, action = "moderately_severe", "Active treatment, antidepressant + psychotherapy"
        else:            severity, action = "severe",            "Immediate initiation of pharmacotherapy; consider psychiatric referral"
        risk = "high" if r.get("9", 0) >= 1 else ("moderate" if score >= 15 else "low")

    elif tool == "PHQ-2":
        score = sum(r.get(str(i), 0) for i in range(1, 3))
        severity = "minimal" if score < 3 else "moderate"
        action = "No action needed" if score < 3 else "Administer PHQ-9 for full assessment"
        risk = "low"

    elif tool == "GAD-7":
        score = sum(r.get(str(i), 0) for i in range(1, 8))
        if score <= 4:   severity, action = "minimal",  "Monitor"
        elif score <= 9: severity, action = "mild",     "Consider watchful waiting"
        elif score <= 14:severity, action = "moderate", "Consider medication or psychotherapy"
        else:            severity, action = "severe",   "Active treatment; consider psychiatric referral"
        risk = "moderate" if score >= 15 else "low"

    elif tool in ("AUDIT", "AUDIT-C"):
        score = sum(r.get(str(i), 0) for i in range(1, len(r) + 1))
        if tool == "AUDIT-C":
            if score <= 2:   severity, action = "minimal", "No intervention needed"
            elif score <= 4: severity, action = "mild",    "Brief advice on reducing intake"
            else:            severity, action = "moderate","Full AUDIT assessment recommended"
        else:
            if score <= 7:   severity, action = "minimal",  "Low risk — health education"
            elif score <= 15:severity, action = "mild",     "Simple advice at point of care"
            elif score <= 19:severity, action = "moderate", "Brief counselling and monitoring"
            else:            severity, action = "severe",   "Referral to specialist"
        risk = "high" if score >= 20 else ("moderate" if score >= 8 else "low")

    elif tool == "CSSRS":
        score = sum(r.get(str(i), 0) for i in range(1, len(r) + 1))
        if score == 0:   severity, action = "minimal", "No current ideation detected"
        elif score <= 2: severity, action = "mild",    "Safety planning, outpatient monitoring"
        elif score <= 4: severity, action = "moderate","Urgent psychiatric evaluation"
        else:            severity, action = "severe",  "Emergency psychiatric evaluation"
        risk = "imminent" if score >= 5 else ("high" if score >= 3 else ("moderate" if score >= 1 else "low"))

    elif tool == "EPDS":
        score = sum(r.get(str(i), 0) for i in range(1, 11))
        if score <= 9:   severity, action = "minimal",  "Routine postnatal care"
        elif score <= 12:severity, action = "mild",     "Supportive counselling"
        elif score <= 14:severity, action = "moderate", "Further assessment; consider treatment"
        else:            severity, action = "severe",   "Urgent psychiatric referral"
        risk = "high" if r.get("10", 0) >= 1 else ("moderate" if score >= 13 else "low")

    else:
        score = sum(r.values())
        severity, action, risk = "minimal", "Review with clinician", "low"

    return {
        "tool": tool,
        "total_score": score,
        "severity": severity,
        "risk_level": risk,
        "recommended_action": action,
    }


@app.post("/mental-health/risk")
async def assess_suicide_risk(req: SuicideRiskRequest):
    score = 0

    ideation_weights = {
        "passive": 10,
        "active_no_plan": 25,
        "active_with_plan": 50,
        "active_with_intent": 70,
    }
    score += ideation_weights.get(req.ideation_type or "", 0)

    lethality_weights = {"low": 5, "medium": 15, "high": 30}
    score += lethality_weights.get(req.lethality or "", 0)

    if req.means_access:   score += 20
    if req.prior_attempts > 0: score += min(req.prior_attempts * 10, 30)
    if req.substance_use:  score += 10
    if req.recent_loss:    score += 8

    if req.hopelessness_score is not None:
        score += min(int(req.hopelessness_score / 20 * 15), 15)

    protective_deduction = min(len(req.protective_factors) * 5, 20)
    score = max(0, score - protective_deduction)
    score = min(score, 100)

    if score >= 70:
        risk_level = "imminent"
        disposition = "emergency"
        actions = [
            "Do not leave patient alone",
            "Remove access to means immediately",
            "Emergency psychiatric evaluation",
            "Consider inpatient admission",
            "Notify next of kin",
        ]
    elif score >= 45:
        risk_level = "high"
        disposition = "urgent_referral"
        actions = [
            "Safety planning (Stanley-Brown)",
            "Means restriction counselling",
            "Urgent psychiatric referral (24–48h)",
            "Increase contact frequency",
            "Crisis line numbers provided",
        ]
    elif score >= 20:
        risk_level = "moderate"
        disposition = "outpatient_monitoring"
        actions = [
            "Safety planning documented",
            "Schedule follow-up within 1 week",
            "Psychoeducation for patient and family",
            "Review psychotropic medications",
        ]
    else:
        risk_level = "low"
        disposition = "routine_follow_up"
        actions = [
            "Routine monitoring",
            "Psychoeducation on warning signs",
            "Provide crisis line numbers",
        ]

    return {
        "risk_score": score,
        "risk_level": risk_level,
        "disposition": disposition,
        "recommended_actions": actions,
        "safety_plan_indicated": score >= 20,
        "inpatient_indicated": score >= 70,
    }


@app.post("/mental-health/medication/monitor")
async def monitor_psychotropic(req: MedicationMonitorRequest):
    alerts = []
    monitoring_due = []

    drug_lower = req.drug_name.lower()

    # Clozapine monitoring
    if "clozapin" in drug_lower:
        monitoring_due.append("FBC (weekly for 18 weeks, then fortnightly)")
        monitoring_due.append("Fasting glucose and lipids (baseline, 3, 6, 12 months)")
        monitoring_due.append("ECG at baseline")
        monitoring_due.append("Body weight monthly")
        if req.last_level_value is not None:
            if req.last_level_value < 350:
                alerts.append({"severity": "warning", "message": f"Clozapine level {req.last_level_value} ng/mL is sub-therapeutic (target 350–600 ng/mL). Consider dose increase."})
            elif req.last_level_value > 600:
                alerts.append({"severity": "danger", "message": f"Clozapine level {req.last_level_value} ng/mL is above therapeutic range (target 350–600 ng/mL). Toxicity risk."})

    # Lithium monitoring
    elif "lithium" in drug_lower:
        monitoring_due.append("Serum lithium (12h post-dose; every 3–6 months when stable)")
        monitoring_due.append("Renal function (eGFR, urea, creatinine) every 6 months")
        monitoring_due.append("Thyroid function (TSH) every 6 months")
        monitoring_due.append("Calcium annually")
        if req.last_level_value is not None:
            if req.last_level_value < 0.6:
                alerts.append({"severity": "warning", "message": f"Lithium level {req.last_level_value} mmol/L is sub-therapeutic (target 0.6–1.0 mmol/L acute; 0.4–0.8 mmol/L maintenance)."})
            elif req.last_level_value > 1.2:
                alerts.append({"severity": "danger", "message": f"Lithium level {req.last_level_value} mmol/L — TOXICITY THRESHOLD EXCEEDED. Symptoms: tremor, confusion, vomiting. Withhold dose and review urgently."})

    # Valproate monitoring
    elif "valproat" in drug_lower or "depakote" in drug_lower or "epival" in drug_lower:
        monitoring_due.append("Valproate level (trough; target 50–125 mg/L)")
        monitoring_due.append("LFTs and FBC at baseline and 6 months")
        monitoring_due.append("Weight and BMI monthly")
        monitoring_due.append("Pregnancy test if female of childbearing age (teratogen)")
        if req.last_level_value is not None:
            if req.last_level_value < 50:
                alerts.append({"severity": "warning", "message": f"Valproate level {req.last_level_value} mg/L is sub-therapeutic (target 50–125 mg/L)."})
            elif req.last_level_value > 125:
                alerts.append({"severity": "danger", "message": f"Valproate level {req.last_level_value} mg/L exceeds therapeutic range. Hepatotoxicity and encephalopathy risk."})

    # Carbamazepine
    elif "carbamazep" in drug_lower:
        monitoring_due.append("Carbamazepine level (target 4–12 mg/L)")
        monitoring_due.append("FBC and LFTs at baseline then every 6 months")
        monitoring_due.append("Na+ — SIADH risk")
        if req.last_level_value and req.last_level_value > 12:
            alerts.append({"severity": "danger", "message": f"Carbamazepine level {req.last_level_value} mg/L above therapeutic range (4–12 mg/L). Diplopia, ataxia risk."})

    # Antipsychotics
    elif req.drug_class == "antipsychotic":
        monitoring_due.append("Fasting glucose and HbA1c (baseline, 3, 6, 12 months)")
        monitoring_due.append("Fasting lipid profile annually")
        monitoring_due.append("BMI and waist circumference monthly for 3 months, then quarterly")
        monitoring_due.append("Blood pressure baseline and after dose changes")
        monitoring_due.append("AIMS (Abnormal Involuntary Movement Scale) every 6 months")
        monitoring_due.append("Prolactin if symptomatic")

    # Antidepressants
    elif req.drug_class == "antidepressant":
        monitoring_due.append("Suicide risk assessment at every appointment for first 4 weeks")
        monitoring_due.append("Monitor for activation syndrome (especially in youth)")
        if "ssri" in drug_lower or any(x in drug_lower for x in ["fluoxetin","sertral","escitalopram","citalopram","paroxetin"]):
            monitoring_due.append("Na+ if elderly (SIADH risk)")

    # Renal adjustment alerts
    if req.renal_function in ("moderate", "severe"):
        renally_cleared = ["lithium", "gabapentin", "pregabalin", "topiramate", "amisulpride"]
        if any(d in drug_lower for d in renally_cleared):
            alerts.append({"severity": "warning", "message": f"Renal impairment ({req.renal_function}): dose adjustment required for {req.drug_name}. Review renal dosing guidelines."})

    return {
        "drug": req.drug_name,
        "alerts": alerts,
        "monitoring_due": monitoring_due,
        "alert_count": len(alerts),
        "has_critical_alert": any(a["severity"] == "danger" for a in alerts),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 69 — Malaria CDSS
# ─────────────────────────────────────────────────────────────────────────────

class MalariaTreatmentRequest(BaseModel):
    species: str                               # falciparum / vivax / malariae / ovale / mixed / unknown
    case_type: str                             # uncomplicated / severe
    age_years: Optional[float] = None
    weight_kg: Optional[float] = None
    pregnant: bool = False
    trimester: Optional[int] = None            # 1 / 2 / 3
    g6pd_deficient: Optional[bool] = None
    prior_treatment_failure: bool = False
    country: Optional[str] = None             # for CQ-resistant vivax regions

class MalariaSeverityRequest(BaseModel):
    # Clinical features
    impaired_consciousness: bool = False       # GCS < 11
    prostration: bool = False
    multiple_convulsions: bool = False         # >2 in 24h
    respiratory_distress: bool = False
    abnormal_bleeding: bool = False
    jaundice: bool = False
    haemoglobinuria: bool = False
    # Lab features
    haemoglobin: Optional[float] = None        # g/dL
    blood_glucose: Optional[float] = None      # mmol/L
    creatinine: Optional[float] = None         # µmol/L
    bilirubin: Optional[float] = None          # µmol/L
    parasitaemia_percent: Optional[float] = None
    # Context
    age_years: Optional[float] = None
    species: Optional[str] = None

@app.post("/malaria/treatment")
async def malaria_treatment_recommendation(req: MalariaTreatmentRequest):
    regimen = None
    regimen_label = None
    notes = []
    warnings = []
    duration_days = 3
    follow_up_days = [3, 7, 14, 28]

    is_falciparum = req.species in ("falciparum", "mixed", "unknown")
    is_vivax = req.species == "vivax"

    # ── SEVERE MALARIA (any species) ───────────────────────────────────────
    if req.case_type == "severe":
        regimen = "IV_artesunate"
        regimen_label = "IV Artesunate 2.4 mg/kg at 0, 12, 24h then daily"
        duration_days = 7
        notes.append("Switch to oral ACT once patient can tolerate oral medication (usually day 3).")
        notes.append("Monitor for post-artesunate delayed haemolysis (PADH) up to 4 weeks.")
        if req.pregnant and req.trimester == 1:
            regimen = "quinine_IV"
            regimen_label = "IV Quinine + Clindamycin (1st trimester: avoid artesunate)"
            warnings.append("1st trimester: IV artesunate avoided — use IV Quinine + Clindamycin.")
        return {
            "regimen": regimen,
            "regimen_label": regimen_label,
            "duration_days": duration_days,
            "follow_up_days": follow_up_days,
            "notes": notes,
            "warnings": warnings,
        }

    # ── UNCOMPLICATED FALCIPARUM ───────────────────────────────────────────
    if is_falciparum:
        if req.pregnant:
            if req.trimester == 1:
                regimen = "quinine_oral"
                regimen_label = "Quinine + Clindamycin × 7 days (1st trimester)"
                warnings.append("Avoid ACTs in 1st trimester — use Quinine + Clindamycin.")
            else:
                regimen = "AL"
                regimen_label = "Artemether-Lumefantrine (AL) × 3 days (2nd/3rd trimester)"
                notes.append("Weight-based dosing: use 4-tablet dose for adults.")
        elif req.age_years is not None and req.age_years < 0.5:
            regimen = "AL"
            regimen_label = "Artemether-Lumefantrine (AL) — weight-based paediatric dose"
            notes.append("Use paediatric dispersible tablet formulation.")
        elif req.prior_treatment_failure:
            regimen = "ASAQ"
            regimen_label = "Artesunate-Amodiaquine (ASAQ) × 3 days (after AL failure)"
            notes.append("Consider artemisinin partial resistance if day-3 parasitaemia persists.")
        else:
            regimen = "AL"
            regimen_label = "Artemether-Lumefantrine (AL) × 3 days"
            notes.append("Take with food or milk to maximise lumefantrine absorption.")
            notes.append("Day-1 dose must be directly observed.")

    # ── UNCOMPLICATED VIVAX / OVALE / MALARIAE ─────────────────────────────
    elif is_vivax or req.species in ("ovale", "malariae"):
        regimen = "AL"
        regimen_label = "Artemether-Lumefantrine (AL) × 3 days"
        duration_days = 3

        # Primaquine radical cure for vivax/ovale (prevents relapse)
        if req.species in ("vivax", "ovale"):
            if req.g6pd_deficient:
                notes.append("G6PD deficiency: use Primaquine 0.75 mg/kg once weekly × 8 weeks (supervised).")
                warnings.append("Screen for G6PD before Primaquine. Haemolysis risk in deficiency.")
            elif req.pregnant:
                notes.append("Primaquine contraindicated in pregnancy. Give after delivery / breastfeeding cessation.")
            else:
                notes.append("Add Primaquine 0.25 mg/kg/day × 14 days for radical cure (relapse prevention).")

        # CQ-resistant vivax regions
        if is_vivax and req.country in ("Papua New Guinea", "Indonesia", "Solomon Islands", "Ethiopia"):
            notes.append(f"Chloroquine-resistant P. vivax documented in {req.country}. AL preferred over CQ.")

    else:
        regimen = "AL"
        regimen_label = "Artemether-Lumefantrine (AL) × 3 days (empirical)"

    return {
        "regimen": regimen,
        "regimen_label": regimen_label,
        "duration_days": duration_days,
        "follow_up_days": follow_up_days,
        "notes": notes,
        "warnings": warnings,
    }


@app.post("/malaria/severity")
async def malaria_severity_score(req: MalariaSeverityRequest):
    criteria_met = []
    score = 0

    # WHO 2015 severe malaria criteria
    if req.impaired_consciousness:
        criteria_met.append("Impaired consciousness / cerebral malaria (GCS < 11)")
        score += 3
    if req.prostration:
        criteria_met.append("Prostration / extreme weakness")
        score += 2
    if req.multiple_convulsions:
        criteria_met.append("Multiple convulsions (>2 in 24h)")
        score += 2
    if req.respiratory_distress:
        criteria_met.append("Respiratory distress / acidosis")
        score += 3
    if req.abnormal_bleeding:
        criteria_met.append("Abnormal bleeding")
        score += 2
    if req.jaundice:
        criteria_met.append("Jaundice (clinical)")
        score += 1
    if req.haemoglobinuria:
        criteria_met.append("Haemoglobinuria (blackwater fever)")
        score += 2

    # Lab criteria
    if req.haemoglobin is not None and req.haemoglobin < 7.0:
        hb_label = "Severe anaemia (Hb < 7 g/dL)"
        if req.age_years is not None and req.age_years < 12 and req.haemoglobin < 5.0:
            hb_label = "Severe anaemia in child (Hb < 5 g/dL)"
            score += 3
        else:
            score += 2
        criteria_met.append(hb_label)

    if req.blood_glucose is not None and req.blood_glucose < 2.2:
        criteria_met.append(f"Hypoglycaemia (BG {req.blood_glucose:.1f} mmol/L < 2.2)")
        score += 3

    if req.creatinine is not None and req.creatinine > 265:
        criteria_met.append(f"Acute kidney injury (Creatinine {req.creatinine:.0f} µmol/L > 265)")
        score += 2

    if req.bilirubin is not None and req.bilirubin > 50:
        criteria_met.append(f"Hyperbilirubinaemia (Bilirubin {req.bilirubin:.0f} µmol/L > 50)")
        score += 1

    if req.parasitaemia_percent is not None and req.parasitaemia_percent > 5:
        criteria_met.append(f"Hyperparasitaemia (parasitaemia {req.parasitaemia_percent:.1f}% > 5%)")
        score += 2
        if req.parasitaemia_percent > 10:
            criteria_met.append("Extreme hyperparasitaemia (>10%) — exchange transfusion may be considered")
            score += 1

    is_severe = score >= 2 or len(criteria_met) >= 1
    severity_class = "severe" if is_severe else "uncomplicated"

    recommendations = []
    if is_severe:
        recommendations.append("Admit to hospital — IV therapy required")
        recommendations.append("IV Artesunate 2.4 mg/kg at 0, 12, 24h then daily")
        recommendations.append("Monitor blood glucose every 4h")
        recommendations.append("Monitor renal function, fluid balance, consciousness level")
        if req.blood_glucose and req.blood_glucose < 2.2:
            recommendations.append("URGENT: IV Dextrose 50% — 50mL bolus now")
        if req.haemoglobin and req.haemoglobin < 5:
            recommendations.append("Consider blood transfusion (Hb < 5 g/dL)")
    else:
        recommendations.append("Oral ACT appropriate — see treatment protocol")
        recommendations.append("Observe for clinical deterioration, review at 24h")

    return {
        "severity_class": severity_class,
        "severity_score": score,
        "criteria_met": criteria_met,
        "criteria_count": len(criteria_met),
        "recommendations": recommendations,
        "inpatient_required": is_severe,
        "icu_consider": score >= 6,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 70 — Geriatrics CDSS
# ─────────────────────────────────────────────────────────────────────────────

class FrailtyRequest(BaseModel):
    clinical_frailty_scale: int            # 1–9
    barthel_index: Optional[int] = None    # 0–100
    mmse_score: Optional[int] = None       # 0–30
    moca_score: Optional[int] = None       # 0–30
    age_years: Optional[int] = None

class PolypharmacyRequest(BaseModel):
    medications: List[Dict[str, Any]]      # [{name, drug_class, dose_mg, frequency}]
    age_years: int
    renal_function: Optional[str] = None   # normal/mild/moderate/severe
    has_dementia: bool = False
    has_falls_risk: bool = False
    has_peptic_ulcer: bool = False
    has_bleeding_risk: bool = False

class FallRiskRequest(BaseModel):
    fall_history_count: int = 0
    secondary_diagnosis: bool = False
    ambulatory_aid: str = "none"           # none/crutches/cane/walker/furniture
    iv_therapy: bool = False
    gait: str = "normal"                   # normal/weak/impaired
    mental_status: str = "oriented"        # oriented/confused
    tinnetti_gait: Optional[int] = None    # 0–12
    tinnetti_balance: Optional[int] = None # 0–16
    age_years: Optional[int] = None

CFS_DESCRIPTIONS = {
    1: ("Very Fit", "Robust, active, energetic. Exercises regularly. Among the fittest for their age."),
    2: ("Well", "No active disease symptoms but less fit than CFS 1. Exercises occasionally."),
    3: ("Managing Well", "Medical problems well controlled but not regularly active beyond walking."),
    4: ("Living With Very Mild Frailty", "Not dependent, but symptoms limit activities. Often slows down or tires during the day."),
    5: ("Living With Mild Frailty", "More evident slowing. Dependent on others for IADLs. Typically not dependent for personal care."),
    6: ("Living With Moderate Frailty", "Needs help with all outside activities and housekeeping. Difficulty with stairs. May need help bathing; minimal assistance dressing."),
    7: ("Living With Severe Frailty", "Completely dependent for personal care from any cause. Stable and not at high risk of dying within 6 months."),
    8: ("Living With Very Severe Frailty", "Completely dependent, approaching end of life. Could survive a minor illness but not a major one."),
    9: ("Terminally Ill", "Approaching end of life. This category applies even if otherwise living with moderate or severe frailty."),
}

@app.post("/geriatrics/frailty")
async def assess_frailty(req: FrailtyRequest):
    cfs = req.clinical_frailty_scale
    label, description = CFS_DESCRIPTIONS.get(cfs, ("Unknown", ""))

    care_implications = []
    resuscitation_note = None

    if cfs <= 3:
        frailty_category = "non_frail"
        care_implications = [
            "Standard care pathway appropriate",
            "Encourage physical activity and preventive health",
            "Annual review recommended",
        ]
    elif cfs <= 5:
        frailty_category = "mildly_frail"
        care_implications = [
            "Comprehensive geriatric assessment (CGA) recommended",
            "Optimise management of chronic conditions",
            "Assess and address modifiable frailty factors",
            "Falls prevention programme",
            "Nutritional assessment",
            "Medication review for polypharmacy",
        ]
    elif cfs <= 7:
        frailty_category = "moderately_to_severely_frail"
        care_implications = [
            "Urgent CGA and multidisciplinary team (MDT) involvement",
            "Advance care planning discussion",
            "Carer support assessment",
            "Hospital admission carries high risk of deconditioning",
            "Prefer community/home-based care when safe",
            "High risk of adverse outcomes from surgery/procedures — discuss risk/benefit",
            "Medication deprescribing review",
        ]
        resuscitation_note = "Consider DNACPR discussion given frailty level. Document patient wishes."
    else:
        frailty_category = "very_severely_frail_or_terminal"
        care_implications = [
            "Palliative/comfort-focused care discussion",
            "DNACPR strongly recommended — document and communicate",
            "Prioritise symptom control and dignity",
            "Avoid burdensome investigations unless they change management",
            "Involve family/health proxy in decision-making",
        ]
        resuscitation_note = "DNACPR recommended. Focus on comfort care and dignity."

    cognitive_flag = None
    if req.mmse_score is not None and req.mmse_score < 24:
        sev = "mild" if req.mmse_score >= 18 else ("moderate" if req.mmse_score >= 10 else "severe")
        cognitive_flag = f"MMSE {req.mmse_score}/30 — {sev} cognitive impairment. Consider formal dementia workup."
    elif req.moca_score is not None and req.moca_score < 26:
        cognitive_flag = f"MoCA {req.moca_score}/30 — below normal threshold (26). Consider memory clinic referral."

    functional_flag = None
    if req.barthel_index is not None:
        if req.barthel_index < 20:
            functional_flag = f"Barthel {req.barthel_index}/100 — total dependence. Full nursing care required."
        elif req.barthel_index < 60:
            functional_flag = f"Barthel {req.barthel_index}/100 — significant dependence. Rehabilitation input needed."
        elif req.barthel_index < 85:
            functional_flag = f"Barthel {req.barthel_index}/100 — moderate independence. OT/PT assessment recommended."

    return {
        "cfs": cfs,
        "label": label,
        "description": description,
        "frailty_category": frailty_category,
        "care_implications": care_implications,
        "resuscitation_note": resuscitation_note,
        "cognitive_flag": cognitive_flag,
        "functional_flag": functional_flag,
    }


# Beers Criteria 2023 — selected high-risk drugs in elderly
BEERS_FLAGS = [
    # Anticholinergics
    {"drugs": ["amitriptyline","nortriptyline","imipramine","clomipramine","doxepin"], "category": "Anticholinergic TCA", "concern": "High anticholinergic burden — confusion, constipation, urinary retention, falls", "severity": "high"},
    {"drugs": ["diphenhydramine","promethazine","hydroxyzine","chlorphenamine"], "category": "Anticholinergic antihistamine", "concern": "Highly anticholinergic — sedation, delirium, urinary retention in elderly", "severity": "high"},
    {"drugs": ["oxybutynin","tolterodine","solifenacin","darifenacin"], "category": "Anticholinergic bladder agents", "concern": "Anticholinergic burden — avoid in dementia patients; prefer mirabegron", "severity": "moderate"},
    # CNS
    {"drugs": ["diazepam","lorazepam","clonazepam","alprazolam","temazepam","nitrazepam"], "category": "Benzodiazepine", "concern": "Increased risk of falls, cognitive impairment, MVA in elderly. Avoid unless on stable regimen with documented rationale.", "severity": "high"},
    {"drugs": ["zolpidem","zopiclone","zaleplon"], "category": "Z-drug hypnotic", "concern": "Falls and fracture risk. Short-term use only. Prefer sleep hygiene interventions.", "severity": "high"},
    {"drugs": ["haloperidol","chlorpromazine","thioridazine"], "category": "First-generation antipsychotic", "concern": "EPS, sedation, falls. Use second-generation with lowest effective dose if required.", "severity": "high"},
    {"drugs": ["meperidine","pethidine"], "category": "Opioid (meperidine)", "concern": "Neurotoxic metabolite — avoid entirely in elderly. Use alternative opioid.", "severity": "high"},
    # Cardiovascular
    {"drugs": ["digoxin"], "category": "Cardiac glycoside", "concern": "Narrow therapeutic index — renal excretion reduced in elderly. Max 0.125mg/day unless AF rate control needed.", "severity": "moderate"},
    {"drugs": ["amiodarone"], "category": "Antiarrhythmic", "concern": "High toxicity (thyroid, pulmonary, hepatic, neuropathy). Avoid as first-line in elderly unless no alternative.", "severity": "moderate"},
    {"drugs": ["nifedipine"], "category": "Short-acting CCB", "concern": "Hypotension and falls risk. Use long-acting formulations only.", "severity": "moderate"},
    # NSAIDs
    {"drugs": ["ibuprofen","naproxen","diclofenac","indomethacin","ketorolac","piroxicam","meloxicam"], "category": "NSAID", "concern": "GI bleeding, acute kidney injury, fluid retention, worsening heart failure. Avoid if possible; use paracetamol instead.", "severity": "high"},
    {"drugs": ["aspirin"], "category": "Aspirin (high-dose)", "concern": "GI bleeding risk increases with age. Only for established CVD — doses >100mg rarely indicated.", "severity": "moderate"},
    # Hypoglycaemics
    {"drugs": ["glibenclamide","glyburide","chlorpropamide"], "category": "Long-acting sulphonylurea", "concern": "Prolonged hypoglycaemia — particularly dangerous in elderly. Use shorter-acting agents.", "severity": "high"},
    {"drugs": ["glimepiride","glipizide"], "category": "Sulphonylurea", "concern": "Hypoglycaemia risk. Prefer agents with lower hypoglycaemia risk (DPP-4i, SGLT2i).", "severity": "moderate"},
    # Muscle relaxants
    {"drugs": ["baclofen","methocarbamol","carisoprodol","cyclobenzaprine"], "category": "Muscle relaxant", "concern": "Poorly tolerated in elderly — sedation, anticholinergic effects, falls. Questionable efficacy.", "severity": "moderate"},
    # Proton pump inhibitors
    {"drugs": ["omeprazole","lansoprazole","pantoprazole","esomeprazole","rabeprazole"], "category": "PPI (long-term)", "concern": "Long-term use (>8 weeks without indication) — risk of C. diff, Mg deficiency, fracture. Review indication.", "severity": "low"},
]

@app.post("/geriatrics/polypharmacy")
async def check_polypharmacy(req: PolypharmacyRequest):
    flags = []
    deprescribing_recs = []
    drug_names_lower = [m.get("name", "").lower() for m in req.medications]

    for rule in BEERS_FLAGS:
        for drug_lower in drug_names_lower:
            if any(beers in drug_lower for beers in rule["drugs"]):
                matched_med = next((m for m in req.medications if any(b in m.get("name","").lower() for b in rule["drugs"])), {})
                flags.append({
                    "drug": matched_med.get("name", drug_lower),
                    "category": rule["category"],
                    "concern": rule["concern"],
                    "severity": rule["severity"],
                    "source": "Beers Criteria 2023",
                })
                if rule["severity"] == "high":
                    deprescribing_recs.append(f"Consider deprescribing {matched_med.get('name', drug_lower)} — {rule['concern'][:80]}")

    # Additional context-based flags
    nsaid_names = ["ibuprofen","naproxen","diclofenac","indomethacin","ketorolac","piroxicam","meloxicam","aspirin"]
    has_nsaid = any(any(n in d for n in nsaid_names) for d in drug_names_lower)

    if has_nsaid and req.has_peptic_ulcer:
        flags.append({"drug": "NSAID", "category": "DDI/Contraindication", "concern": "NSAID contraindicated with peptic ulcer history", "severity": "high", "source": "Clinical guidelines"})
    if has_nsaid and req.has_bleeding_risk:
        flags.append({"drug": "NSAID", "category": "DDI/Contraindication", "concern": "NSAID increases bleeding risk", "severity": "high", "source": "Clinical guidelines"})
    if req.has_dementia:
        anticholinergic_in_list = [m for m in req.medications if any(a in m.get("name","").lower() for a in ["amitriptyline","nortriptyline","oxybutynin","diphenhydramine","promethazine","haloperidol"])]
        for m in anticholinergic_in_list:
            deprescribing_recs.append(f"URGENT: {m.get('name')} is anticholinergic — worsens dementia and cognition. Deprescribe.")

    total = len(req.medications)
    polypharmacy_flag = total >= 5
    excessive_flag = total >= 10

    return {
        "total_medications": total,
        "polypharmacy": polypharmacy_flag,
        "excessive_polypharmacy": excessive_flag,
        "beers_flags": flags,
        "high_severity_count": sum(1 for f in flags if f["severity"] == "high"),
        "deprescribing_recommendations": deprescribing_recs,
        "review_recommended": len(flags) > 0 or polypharmacy_flag,
    }


@app.post("/geriatrics/fall-risk")
async def assess_fall_risk(req: FallRiskRequest):
    # Morse Fall Scale
    morse = 0
    morse += 25 if req.fall_history_count > 0 else 0
    morse += 15 if req.secondary_diagnosis else 0
    aid_scores = {"none": 0, "crutches": 15, "cane": 15, "walker": 15, "furniture": 30}
    morse += aid_scores.get(req.ambulatory_aid, 0)
    morse += 20 if req.iv_therapy else 0
    gait_scores = {"normal": 0, "weak": 10, "impaired": 20}
    morse += gait_scores.get(req.gait, 0)
    morse += 15 if req.mental_status == "confused" else 0

    if morse < 25:
        morse_risk = "low"
    elif morse < 45:
        morse_risk = "medium"
    else:
        morse_risk = "high"

    # Tinetti score (lower = higher risk)
    tinnetti_total = None
    tinnetti_risk = None
    if req.tinnetti_gait is not None and req.tinnetti_balance is not None:
        tinnetti_total = req.tinnetti_gait + req.tinnetti_balance
        if tinnetti_total < 19:
            tinnetti_risk = "high"
        elif tinnetti_total < 24:
            tinnetti_risk = "medium"
        else:
            tinnetti_risk = "low"

    # Combined
    risk_levels = [morse_risk]
    if tinnetti_risk:
        risk_levels.append(tinnetti_risk)
    overall_risk = "high" if "high" in risk_levels else ("medium" if "medium" in risk_levels else "low")

    prevention_plan = []
    if overall_risk == "high":
        prevention_plan = [
            "Bed/chair alarm activated",
            "Non-slip footwear at all times",
            "Hourly rounding by nursing staff",
            "Bed in lowest position, brakes locked",
            "Clear call bell within reach",
            "Physiotherapy assessment for gait/strength",
            "Occupational therapy — home hazard assessment",
            "Medication review — withhold sedatives/hypotensives where possible",
            "Vitamin D supplementation if deficient",
            "Hip protectors if appropriate",
        ]
    elif overall_risk == "medium":
        prevention_plan = [
            "Non-slip footwear",
            "2-hourly rounding",
            "Ensure bed in lowest position",
            "Call bell within reach",
            "Exercise programme to improve balance and strength",
            "Review medications for contributors to falls",
            "Vitamin D supplementation",
        ]
    else:
        prevention_plan = [
            "Standard falls education provided",
            "Encourage regular physical activity",
            "Annual review of fall risk",
        ]

    return {
        "morse_score": morse,
        "morse_risk": morse_risk,
        "tinnetti_total": tinnetti_total,
        "tinnetti_risk": tinnetti_risk,
        "overall_risk": overall_risk,
        "prevention_plan": prevention_plan,
        "physiotherapy_referral": overall_risk in ("medium", "high"),
        "occupational_therapy_referral": overall_risk == "high",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Sprint 71 — Neurology CDSS
# ─────────────────────────────────────────────────────────────────────────────

class StrokeTriageRequest(BaseModel):
    stroke_type: str                          # ischemic / hemorrhagic / TIA / unknown
    onset_time: Optional[str] = None          # ISO datetime
    last_known_well: Optional[str] = None     # ISO datetime
    nihss_score: Optional[int] = None
    age_years: Optional[int] = None
    weight_kg: Optional[float] = None
    prior_stroke: bool = False
    prior_tia: bool = False
    anticoagulant_use: bool = False
    anticoagulant_name: Optional[str] = None
    recent_surgery_days: Optional[int] = None
    recent_bleed: bool = False
    bp_systolic: Optional[int] = None
    platelet_count: Optional[int] = None
    inr: Optional[float] = None
    blood_glucose: Optional[float] = None
    ct_findings: Optional[str] = None        # normal / hemorrhage / early_ischemia / unknown

class SeizureClassifyRequest(BaseModel):
    seizure_type: str                         # focal_aware / focal_impaired / focal_to_bilateral / generalised_tonic_clonic / absence / myoclonic / atonic / unknown
    age_years: Optional[int] = None
    first_seizure: bool = False
    cluster_event: bool = False
    status_epilepticus: bool = False
    current_aed: List[str] = []
    eeg_findings: Optional[str] = None       # normal / focal / generalised / not_done
    mri_findings: Optional[str] = None       # normal / structural / not_done
    trigger_identified: bool = False
    pregnancy: bool = False
    renal_impairment: bool = False
    hepatic_impairment: bool = False

class HeadacheDiagnoseRequest(BaseModel):
    duration_hours: Optional[float] = None
    severity_vas: Optional[int] = None        # 0-10
    location: Optional[str] = None            # unilateral / bilateral / occipital / frontal
    quality: Optional[str] = None             # throbbing / pressing / stabbing / burning
    aura_present: bool = False
    aura_features: List[str] = []             # visual / sensory / motor / speech / brainstem / retinal
    nausea_vomiting: bool = False
    photo_phonophobia: bool = False
    worse_with_activity: bool = False
    autonomic_features: bool = False          # lacrimation, rhinorrhoea, ptosis, miosis
    timing: Optional[str] = None             # episodic / daily / nocturnal
    triggers: List[str] = []
    frequency_per_month: Optional[int] = None
    medication_use_days_per_month: Optional[int] = None
    thunderclap: bool = False
    fever_present: bool = False
    neck_stiffness: bool = False
    papilloedema: bool = False
    new_onset_over_50: bool = False
    progressive_worsening: bool = False

@app.post("/neurology/stroke/triage")
async def stroke_triage(req: StrokeTriageRequest):
    alerts = []
    actions = []
    tpa_eligible = False
    tpa_contraindications = []
    door_to_needle_target = None

    # Parse times
    minutes_from_onset = None
    reference_time = req.onset_time or req.last_known_well
    if reference_time:
        try:
            from datetime import timezone
            onset_dt = datetime.fromisoformat(reference_time.replace('Z', '+00:00'))
            now_dt = datetime.now(timezone.utc)
            minutes_from_onset = int((now_dt - onset_dt).total_seconds() / 60)
        except Exception:
            pass

    # ── tPA eligibility (ischemic only) ──────────────────────────────────────
    if req.stroke_type == "ischemic":
        door_to_needle_target = 60  # minutes

        # Time window
        if minutes_from_onset is not None:
            if minutes_from_onset <= 270:  # 4.5h
                tpa_eligible = True
                alerts.append(f"ALERT: {minutes_from_onset} minutes from onset — within 4.5h tPA window.")
                actions.append("Activate stroke team immediately")
                actions.append("Urgent non-contrast CT head")
                actions.append(f"Door-to-needle target: {door_to_needle_target} minutes")
            elif minutes_from_onset <= 360 and req.nihss_score and req.nihss_score >= 6:
                tpa_eligible = False
                alerts.append(f"Outside standard 4.5h window ({minutes_from_onset} min). Consider thrombectomy if large vessel occlusion confirmed.")
                actions.append("Urgent CTA/MRA to assess vessel patency")
            else:
                alerts.append(f"Beyond treatment window ({minutes_from_onset} min). Focus on secondary prevention.")
        else:
            alerts.append("Onset time unknown — use last-known-well time. Consider MR diffusion/perfusion mismatch for late window.")

        # tPA contraindications
        if req.ct_findings == "hemorrhage":
            tpa_eligible = False
            tpa_contraindications.append("Haemorrhage on CT — absolute contraindication to tPA")
        if req.anticoagulant_use:
            tpa_eligible = False
            tpa_contraindications.append(f"Anticoagulant use ({req.anticoagulant_name or 'unknown'}) — contraindication; check levels")
        if req.inr and req.inr > 1.7:
            tpa_eligible = False
            tpa_contraindications.append(f"INR {req.inr} > 1.7 — contraindication")
        if req.platelet_count and req.platelet_count < 100000:
            tpa_eligible = False
            tpa_contraindications.append(f"Platelet count {req.platelet_count} < 100,000 — contraindication")
        if req.bp_systolic and req.bp_systolic > 185:
            tpa_contraindications.append(f"BP {req.bp_systolic} systolic > 185 — lower BP before tPA (labetalol/nicardipine)")
            actions.append("Lower BP to <185/110 before tPA administration")
        if req.recent_surgery_days and req.recent_surgery_days < 14:
            tpa_eligible = False
            tpa_contraindications.append(f"Recent surgery {req.recent_surgery_days} days ago — contraindication")
        if req.recent_bleed:
            tpa_eligible = False
            tpa_contraindications.append("Recent major bleeding — contraindication")
        if req.blood_glucose and (req.blood_glucose < 2.7 or req.blood_glucose > 22.2):
            tpa_contraindications.append(f"Blood glucose {req.blood_glucose} mmol/L out of range — correct before tPA")

        if tpa_eligible and not tpa_contraindications:
            actions.append("Prepare tPA (alteplase 0.9 mg/kg, max 90 mg; 10% IV bolus, 90% over 60 min)")
            actions.append("Neurosurgery on standby")
        elif not tpa_eligible and minutes_from_onset and minutes_from_onset <= 360:
            actions.append("Assess for mechanical thrombectomy (large vessel occlusion, ASPECTS ≥6)")

        # NIHSS severity
        if req.nihss_score is not None:
            if req.nihss_score >= 21:
                actions.append(f"NIHSS {req.nihss_score} — severe stroke. ICU admission.")
            elif req.nihss_score >= 5:
                actions.append(f"NIHSS {req.nihss_score} — moderate stroke. Stroke unit admission.")
            else:
                actions.append(f"NIHSS {req.nihss_score} — mild stroke. Monitor for deterioration.")

    elif req.stroke_type == "TIA":
        abcd2 = 0
        if req.age_years and req.age_years >= 60: abcd2 += 1
        if req.bp_systolic and req.bp_systolic >= 140: abcd2 += 1
        if req.nihss_score and req.nihss_score >= 1: abcd2 += 2
        actions = [
            f"ABCD2 score estimated (limited data): {abcd2}/7",
            "Start aspirin 300mg immediately if not on anticoagulant",
            "Urgent brain imaging (MRI DWI preferred)",
            "Carotid imaging within 24h if anterior circulation TIA",
            "Cardiac monitoring (12-lead ECG, Holter if paroxysmal AF suspected)",
            "Fasting lipids, glucose, FBC, coagulation",
            "Neurology review within 24h (high-risk TIA) or 7 days (low-risk)",
        ]
        alerts.append("TIA: 2-day stroke risk up to 10% — treat as emergency.")

    elif req.stroke_type == "hemorrhagic":
        actions = [
            "Urgent neurosurgery consult",
            "Reverse anticoagulation immediately if applicable",
            "Blood pressure control (target SBP <140 if lobar; individualise for deep)",
            "CT angiography to exclude underlying vascular malformation",
            "Avoid antiplatelets and anticoagulants acutely",
            "ICP monitoring if GCS ≤8",
        ]
        alerts.append("Haemorrhagic stroke — tPA absolutely contraindicated.")

    # Universal actions
    actions += [
        "NPO until formal swallow screen",
        "Supplemental O2 if SpO2 <94%",
        "Avoid hyperthermia — treat fever aggressively",
        "Avoid hyperglycaemia — target BG 6–10 mmol/L",
        "DVT prophylaxis (compression stockings acutely)",
    ]

    return {
        "stroke_type": req.stroke_type,
        "minutes_from_onset": minutes_from_onset,
        "tpa_eligible": tpa_eligible,
        "tpa_contraindications": tpa_contraindications,
        "door_to_needle_target_minutes": door_to_needle_target,
        "alerts": alerts,
        "actions": actions,
        "thrombectomy_window": req.stroke_type == "ischemic" and (minutes_from_onset or 0) <= 360,
    }


@app.post("/neurology/seizure/classify")
async def classify_seizure(req: SeizureClassifyRequest):
    # Status epilepticus is always a medical emergency
    if req.status_epilepticus:
        return {
            "classification": "Status Epilepticus",
            "emergency": True,
            "immediate_actions": [
                "ABCDE assessment",
                "IV access x2 — draw bloods (glucose, electrolytes, AED levels, FBC, LFTs, CRP, cultures)",
                "IV Lorazepam 0.1 mg/kg (max 4 mg) — repeat after 5 min if seizure continues",
                "If no IV access: IM Midazolam 10 mg (adult) or buccal midazolam",
                "After 10 min without response: IV Levetiracetam 60 mg/kg (max 4500 mg) OR IV Valproate 40 mg/kg",
                "After 20 min without response: Anaesthetic induction — Propofol / Thiopental",
                "Urgent CT head and LP (when safe)",
                "Treat underlying cause (hypoglycaemia, meningitis, toxin)",
            ],
            "aed_recommendations": [],
            "monitoring": ["EEG monitoring if intubated", "ICU admission"],
        }

    # Classification
    classification = req.seizure_type.replace('_', ' ').title()
    aed_first_line = []
    aed_second_line = []
    monitoring = []
    notes = []

    is_generalised = req.seizure_type in ("generalised_tonic_clonic", "absence", "myoclonic", "atonic")
    is_focal = req.seizure_type.startswith("focal")

    if req.first_seizure:
        notes.append("Single unprovoked seizure: discuss risk/benefit of AED initiation. Many clinicians defer unless structural cause or high recurrence risk.")

    if req.cluster_event:
        notes.append("Cluster seizures: consider rescue medication (buccal midazolam or rectal diazepam) for home use.")

    # AED selection
    if is_generalised:
        if req.pregnancy:
            aed_first_line = ["Lamotrigine (lowest teratogenic risk for generalised epilepsy)", "Levetiracetam (consider with folate supplementation)"]
            notes.append("AVOID Valproate in women of childbearing age — highly teratogenic (SANAD II / MHRA).")
        elif req.seizure_type == "absence":
            aed_first_line = ["Ethosuximide (absence seizures only)", "Valproate (if not female of childbearing age)", "Lamotrigine"]
        elif req.seizure_type == "myoclonic":
            aed_first_line = ["Valproate (if male or post-menopausal)", "Levetiracetam", "Clonazepam"]
            notes.append("Avoid Carbamazepine, Oxcarbazepine, Phenytoin — may worsen myoclonic epilepsy.")
        else:
            aed_first_line = ["Valproate (males/post-menopausal women)", "Lamotrigine", "Levetiracetam"]
            aed_second_line = ["Topiramate", "Clobazam (adjunct)", "Perampanel (adjunct)"]

    elif is_focal:
        if req.pregnancy:
            aed_first_line = ["Lamotrigine", "Levetiracetam"]
        else:
            aed_first_line = ["Lamotrigine", "Levetiracetam", "Carbamazepine (controlled release)"]
            aed_second_line = ["Oxcarbazepine", "Zonisamide", "Lacosamide", "Eslicarbazepine"]

    if req.renal_impairment:
        notes.append("Renal impairment: reduce Levetiracetam dose. Avoid Gabapentin/Pregabalin accumulation. Oxcarbazepine may cause hyponatraemia.")
    if req.hepatic_impairment:
        notes.append("Hepatic impairment: avoid Valproate. Use Lamotrigine with caution (slower titration).")

    # Current AED breakthrough
    if req.current_aed:
        notes.append(f"Breakthrough seizure on: {', '.join(req.current_aed)}. Check compliance and drug levels before adding second AED.")

    monitoring = [
        "EEG (ideally within 24h for first seizure, or inter-ictal)",
        "MRI brain (unless known epilepsy with no change in semiology)",
        "Bloods: glucose, electrolytes, calcium, magnesium, FBC, renal/hepatic function, AED levels",
        "ECG (exclude cardiac arrhythmia masquerading as seizure)",
    ]

    driving_advice = "Patient must not drive — notify appropriate authority. Seizure-free period required (varies by jurisdiction: typically 1 year for group 1, longer for commercial)."

    return {
        "classification": classification,
        "emergency": False,
        "aed_first_line": aed_first_line,
        "aed_second_line": aed_second_line,
        "monitoring": monitoring,
        "notes": notes,
        "driving_advice": driving_advice,
        "neurology_referral": True,
    }


@app.post("/neurology/headache/diagnose")
async def diagnose_headache(req: HeadacheDiagnoseRequest):
    # Red flags — always check first
    red_flags = []
    if req.thunderclap:
        red_flags.append("THUNDERCLAP ONSET — exclude subarachnoid haemorrhage (non-contrast CT then LP if CT negative)")
    if req.fever_present and req.neck_stiffness:
        red_flags.append("Fever + neck stiffness — exclude meningitis (LP urgently)")
    if req.papilloedema:
        red_flags.append("Papilloedema — raised ICP. Urgent neuroimaging.")
    if req.new_onset_over_50:
        red_flags.append("New onset headache >50 years — exclude giant cell arteritis (ESR/CRP/temporal artery biopsy) and space-occupying lesion")
    if req.progressive_worsening:
        red_flags.append("Progressive worsening pattern — exclude space-occupying lesion or chronic subdural haematoma")

    if red_flags:
        return {
            "diagnosis": "Red Flag Headache — urgent investigation required",
            "red_flags": red_flags,
            "ichd3_code": None,
            "treatment": [],
            "preventive": [],
            "notes": ["Do not diagnose primary headache disorder until secondary causes excluded."],
        }

    # ICHD-3 classification
    diagnosis = "Unclassified headache"
    ichd3_code = None
    treatment = []
    preventive = []
    notes = []

    # Cluster headache
    if req.autonomic_features and req.duration_hours and req.duration_hours < 3 and req.severity_vas and req.severity_vas >= 7:
        diagnosis = "Cluster Headache"
        ichd3_code = "3.1"
        treatment = [
            "100% O2 via non-rebreather mask 12–15 L/min × 15–20 min (abort attack)",
            "SC Sumatriptan 6mg (fastest onset) or nasal Zolmitriptan 5mg",
            "Avoid oral triptans — too slow for cluster",
        ]
        preventive = [
            "Verapamil 240–960 mg/day (first-line preventive)",
            "Short course oral prednisolone as bridge",
            "Lithium (refractory cases)",
        ]
        notes.append("Episodic cluster: bouts last 6–12 weeks. Chronic: >1 year without remission.")

    # Migraine with aura
    elif req.aura_present and req.nausea_vomiting:
        diagnosis = "Migraine with Aura"
        ichd3_code = "1.2"
        treatment = [
            "Triptan (e.g. Sumatriptan 50–100 mg oral / 6 mg SC) + NSAID/paracetamol at onset",
            "Domperidone 10 mg or Metoclopramide for nausea",
            "Avoid opioids — increase chronification risk",
        ]
        if req.frequency_per_month and req.frequency_per_month >= 4:
            preventive = [
                "Topiramate 50–200 mg/day",
                "Propranolol 80–240 mg/day",
                "Amitriptyline 10–75 mg nocte",
                "CGRP monoclonal antibodies (Erenumab/Fremanezumab) — if 4+ migraine days/month and 2+ preventives failed",
            ]

    # Migraine without aura
    elif req.nausea_vomiting and req.worse_with_activity and req.photo_phonophobia and not req.autonomic_features:
        diagnosis = "Migraine without Aura"
        ichd3_code = "1.1"
        treatment = [
            "Triptan + NSAID combination at headache onset (not during aura)",
            "Naproxen 500 mg or Ibuprofen 400 mg ± antiemetic",
        ]
        if req.frequency_per_month and req.frequency_per_month >= 4:
            preventive = [
                "Topiramate 50–200 mg/day",
                "Propranolol 80–240 mg/day",
                "Candesartan 16 mg/day",
                "CGRP antagonists if refractory",
            ]

    # Tension type
    elif not req.nausea_vomiting and not req.photo_phonophobia and not req.worse_with_activity:
        quality_match = req.quality == "pressing"
        bilateral_match = req.location == "bilateral"
        if quality_match or bilateral_match:
            diagnosis = "Tension-Type Headache"
            ichd3_code = "2.2" if (req.frequency_per_month and req.frequency_per_month >= 15) else "2.1"
            treatment = [
                "Simple analgesia: Paracetamol 1g or Ibuprofen 400 mg at onset",
                "Avoid opioids and combination analgesics (overuse risk)",
                "Relaxation techniques, CBT for chronic TTH",
            ]
            if req.frequency_per_month and req.frequency_per_month >= 15:
                preventive = ["Amitriptyline 25–75 mg nocte (first-line for chronic TTH)"]
                notes.append("Chronic TTH (≥15 days/month): exclude medication overuse headache (MOH).")

    # MOH
    if req.medication_use_days_per_month and req.medication_use_days_per_month >= 10:
        notes.append(f"MEDICATION OVERUSE HEADACHE suspected — analgesic use {req.medication_use_days_per_month} days/month ≥10. Withdrawal essential (guided detoxification).")
        if not any("MOH" in n for n in notes):
            diagnosis = f"{diagnosis} + Medication Overuse Headache"
            ichd3_code = "8.2"

    return {
        "diagnosis": diagnosis,
        "ichd3_code": ichd3_code,
        "red_flags": red_flags,
        "treatment": treatment,
        "preventive": preventive,
        "notes": notes,
        "diary_recommended": True,
        "neurology_referral": req.frequency_per_month and req.frequency_per_month >= 8,
    }


# ─────────────────────────────────────────────────────────────────────────────
# SPRINT 72 — PULMONOLOGY CDSS
# ─────────────────────────────────────────────────────────────────────────────

class SpirometryInterpretRequest(BaseModel):
    fev1: Optional[float] = None           # litres
    fvc: Optional[float] = None            # litres
    fev1_fvc_ratio: Optional[float] = None
    fev1_percent_predicted: Optional[float] = None
    fvc_percent_predicted: Optional[float] = None
    tlc_percent_predicted: Optional[float] = None
    dlco_percent_predicted: Optional[float] = None
    pre_post_bronchodilator: bool = False
    reversibility_percent: Optional[float] = None  # % improvement post-BD
    age: Optional[int] = None
    smoking_pack_years: Optional[float] = None

@app.post("/pulmonology/spirometry/interpret")
async def interpret_spirometry(req: SpirometryInterpretRequest):
    """GOLD staging, spirometric pattern classification, reversibility."""

    ratio = req.fev1_fvc_ratio
    fev1pp = req.fev1_percent_predicted or 0
    fvcpp = req.fvc_percent_predicted or 0
    tlcpp = req.tlc_percent_predicted
    dlcopp = req.dlco_percent_predicted
    rev = req.reversibility_percent or 0

    # Determine pattern
    if ratio is None:
        pattern = "indeterminate"
        pattern_detail = "FEV1/FVC ratio not provided."
    elif ratio < 0.70:
        pattern = "obstructive"
        pattern_detail = "FEV1/FVC < 0.70 consistent with airflow obstruction."
    elif fvcpp < 80 and (tlcpp is None or tlcpp < 80):
        pattern = "restrictive"
        pattern_detail = "FVC reduced with preserved or elevated ratio; restriction likely."
    elif fvcpp < 80 and ratio < 0.70:
        pattern = "mixed"
        pattern_detail = "Reduced FVC and reduced ratio; mixed obstructive-restrictive pattern."
    else:
        pattern = "normal"
        pattern_detail = "FEV1/FVC ≥ 0.70 and FVC ≥ 80% predicted."

    # GOLD staging (obstructive only)
    gold_stage = None
    gold_label = None
    if pattern == "obstructive":
        if fev1pp >= 80:
            gold_stage = 1; gold_label = "GOLD 1 — Mild"
        elif fev1pp >= 50:
            gold_stage = 2; gold_label = "GOLD 2 — Moderate"
        elif fev1pp >= 30:
            gold_stage = 3; gold_label = "GOLD 3 — Severe"
        else:
            gold_stage = 4; gold_label = "GOLD 4 — Very Severe"

    # Reversibility
    reversible = False
    reversibility_note = None
    if req.pre_post_bronchodilator and rev >= 12:
        reversible = True
        reversibility_note = f"Significant bronchodilator reversibility ({rev:.1f}%). Consider asthma-COPD overlap."

    # DLCO comment
    dlco_note = None
    if dlcopp is not None:
        if dlcopp < 40:
            dlco_note = "Severely reduced DLCO — significant parenchymal disease or pulmonary vascular involvement."
        elif dlcopp < 60:
            dlco_note = "Moderately reduced DLCO."
        elif dlcopp < 80:
            dlco_note = "Mildly reduced DLCO."

    # Recommendations
    recommendations = []
    if pattern == "obstructive":
        if gold_stage and gold_stage >= 2:
            recommendations.append("Prescribe LAMA ± LABA per GOLD guidelines.")
        if gold_stage and gold_stage >= 3:
            recommendations.append("Consider ICS combination therapy (LABA/ICS or triple).")
            recommendations.append("Refer for pulmonary rehabilitation.")
        if gold_stage == 4:
            recommendations.append("Assess for long-term oxygen therapy (LTOT).")
            recommendations.append("Discuss lung volume reduction or transplantation referral.")
    elif pattern == "restrictive":
        recommendations.append("Investigate cause: ILD, chest wall, neuromuscular, obesity.")
        recommendations.append("Consider HRCT thorax and rheumatology/ILD referral.")
    elif pattern == "mixed":
        recommendations.append("Address both obstructive and restrictive components.")

    if req.smoking_pack_years and req.smoking_pack_years > 10:
        recommendations.append("Smoking cessation is the single most effective intervention to slow FEV1 decline.")

    return {
        "pattern": pattern,
        "pattern_detail": pattern_detail,
        "gold_stage": gold_stage,
        "gold_label": gold_label,
        "reversible": reversible,
        "reversibility_note": reversibility_note,
        "dlco_note": dlco_note,
        "recommendations": recommendations,
    }


class AsthmaStepUpRequest(BaseModel):
    current_gina_step: int = Field(..., ge=1, le=5)
    act_score: Optional[int] = None        # 5–25
    control: str = "uncontrolled"          # controlled | partly_controlled | uncontrolled
    reliever_puffs_per_week: Optional[int] = None
    oral_steroid_courses_last_year: Optional[int] = None
    eosinophil_count: Optional[float] = None   # cells × 10⁹/L
    ige_total: Optional[float] = None          # IU/mL
    age_years: Optional[int] = None
    pregnancy: bool = False
    smoking: bool = False
    adherence_confirmed: bool = True

GINA_STEPS = {
    1: "SABA reliever only (as-needed low-dose ICS-formoterol or SABA)",
    2: "Low-dose ICS + as-needed SABA",
    3: "Low-dose ICS-LABA (preferred) OR medium-dose ICS",
    4: "Medium-dose ICS-LABA",
    5: "High-dose ICS-LABA + tiotropium; consider biologics",
}

@app.post("/pulmonology/asthma/stepup")
async def asthma_step_up(req: AsthmaStepUpRequest):
    """GINA 2023 step-up / step-down recommendations."""

    # Check adherence before stepping up
    if not req.adherence_confirmed and req.current_gina_step < 5:
        return {
            "action": "check_adherence",
            "current_step": req.current_gina_step,
            "recommended_step": req.current_gina_step,
            "current_regimen": GINA_STEPS[req.current_gina_step],
            "recommended_regimen": GINA_STEPS[req.current_gina_step],
            "rationale": "Confirm inhaler technique and adherence before escalating therapy.",
            "biologics": [],
            "notes": [],
        }

    act = req.act_score or 0
    ctrl = req.control

    # Step direction
    if ctrl == "controlled" and (act == 0 or act >= 20):
        new_step = max(1, req.current_gina_step - 1)
        action = "step_down"
    elif ctrl in ("partly_controlled", "uncontrolled") or (act > 0 and act < 20):
        new_step = min(5, req.current_gina_step + 1)
        action = "step_up"
    else:
        new_step = req.current_gina_step
        action = "maintain"

    # Biologic eligibility (Step 5)
    biologics = []
    if new_step == 5:
        eos = req.eosinophil_count or 0
        ige = req.ige_total or 0
        if eos >= 0.3:
            biologics.append("Mepolizumab or Benralizumab (anti-IL-5/IL-5Rα) — eosinophilic asthma")
        if eos >= 0.25 and req.oral_steroid_courses_last_year and req.oral_steroid_courses_last_year >= 2:
            biologics.append("Dupilumab (anti-IL-4Rα) — type-2 inflammation")
        if ige >= 30 and req.age_years and req.age_years >= 6:
            biologics.append("Omalizumab (anti-IgE) — allergic asthma with elevated IgE")
        if not biologics:
            biologics.append("Assess phenotype/endotype to select biologic agent")

    notes = []
    if req.pregnancy:
        notes.append("In pregnancy: maintain current ICS; LABA considered safe; avoid systemic steroids unless essential.")
    if req.smoking:
        notes.append("Smoking impairs ICS response. Prioritise smoking cessation. Consider higher ICS doses.")
    if req.reliever_puffs_per_week and req.reliever_puffs_per_week >= 3:
        notes.append("Frequent reliever use (≥3 puffs/week) indicates poor control — escalate.")
    if req.oral_steroid_courses_last_year and req.oral_steroid_courses_last_year >= 2:
        notes.append("≥2 OCS courses last year = severe asthma — pursue biologic evaluation.")

    return {
        "action": action,
        "current_step": req.current_gina_step,
        "recommended_step": new_step,
        "current_regimen": GINA_STEPS[req.current_gina_step],
        "recommended_regimen": GINA_STEPS[new_step],
        "rationale": f"ACT {act}, control: {ctrl} → {action} to Step {new_step}.",
        "biologics": biologics,
        "notes": notes,
    }


class OxygenPrescribeRequest(BaseModel):
    indication: str                        # hypoxaemia | cluster_headache | palliative | procedural | copd_ltot
    spo2_resting: Optional[float] = None   # %
    pao2_resting: Optional[float] = None   # kPa or mmHg
    paco2_resting: Optional[float] = None
    copd_diagnosis: bool = False
    type2_respiratory_failure: bool = False
    target_high_spo2: bool = False         # e.g. post-cardiac arrest neuroprotection

DEVICE_FIO2 = {
    "nasal_cannula_1lpm": ("Nasal Cannula @ 1 L/min", 0.24),
    "nasal_cannula_2lpm": ("Nasal Cannula @ 2 L/min", 0.28),
    "nasal_cannula_4lpm": ("Nasal Cannula @ 4 L/min", 0.36),
    "simple_mask_6lpm":   ("Simple Face Mask @ 6 L/min", 0.40),
    "venturi_24pct":      ("Venturi Mask 24%", 0.24),
    "venturi_28pct":      ("Venturi Mask 28%", 0.28),
    "venturi_35pct":      ("Venturi Mask 35%", 0.35),
    "non_rebreather":     ("Non-Rebreather Mask @ 15 L/min", 0.90),
    "high_flow_nasal":    ("High-Flow Nasal Cannula (titrate FiO2)", None),
}

@app.post("/pulmonology/oxygen/prescribe")
async def prescribe_oxygen(req: OxygenPrescribeRequest):
    """Evidence-based oxygen prescription: target SpO2, device, flow rate."""

    alerts = []
    device = None
    flow_lpm = None
    fio2 = None
    target_spo2_min = 94
    target_spo2_max = 98

    indication = req.indication.lower()

    if indication == "copd_ltot":
        # BTS LTOT criteria
        target_spo2_min = 88
        target_spo2_max = 92
        if req.type2_respiratory_failure:
            device = "Venturi Mask 28%"; flow_lpm = 2.0; fio2 = 0.28
            alerts.append("Type II RF: controlled oxygen. Target SpO2 88-92%. Monitor for CO2 retention.")
        else:
            device = "Nasal Cannula @ 2 L/min"; flow_lpm = 2.0; fio2 = 0.28
        if req.pao2_resting and req.pao2_resting > 7.3:
            alerts.append("PaO2 > 7.3 kPa at rest — does not yet meet LTOT threshold. Reassess after optimising therapy.")

    elif indication == "cluster_headache":
        target_spo2_min = 94
        target_spo2_max = 99
        device = "Non-Rebreather Mask @ 15 L/min"; flow_lpm = 15.0; fio2 = 0.90
        alerts.append("100% O2 via NRM at 15 L/min for 15–20 minutes at cluster headache onset — high-level evidence.")

    elif indication == "palliative":
        target_spo2_min = 88
        target_spo2_max = 95
        device = "Nasal Cannula @ 2 L/min"; flow_lpm = 2.0; fio2 = 0.28
        alerts.append("Palliation: only continue if patient-perceived benefit. Discontinue if no symptomatic relief.")

    elif indication == "procedural":
        target_spo2_min = 94
        target_spo2_max = 98
        device = "Nasal Cannula @ 4 L/min"; flow_lpm = 4.0; fio2 = 0.36

    else:
        # General hypoxaemia / acute illness
        if req.copd_diagnosis and not req.target_high_spo2:
            target_spo2_min = 88
            target_spo2_max = 92
            device = "Venturi Mask 28%"; flow_lpm = 2.0; fio2 = 0.28
            alerts.append("COPD: target SpO2 88-92% to avoid hypercapnic drive suppression.")
        else:
            target_spo2_min = 94
            target_spo2_max = 98
            if req.spo2_resting and req.spo2_resting < 85:
                device = "Non-Rebreather Mask @ 15 L/min"; flow_lpm = 15.0; fio2 = 0.90
                alerts.append("Severe hypoxaemia — NRM. Reassess for intubation if no improvement.")
            elif req.spo2_resting and req.spo2_resting < 90:
                device = "High-Flow Nasal Cannula (titrate FiO2)"; flow_lpm = 40.0
                alerts.append("Consider HFNC. Titrate FiO2 to achieve SpO2 ≥ 94%.")
            else:
                device = "Nasal Cannula @ 2 L/min"; flow_lpm = 2.0; fio2 = 0.28

    if req.paco2_resting and req.paco2_resting > 6.0:
        alerts.append(f"Elevated PaCO2 ({req.paco2_resting} kPa) — caution with high-flow oxygen. Use controlled delivery.")

    return {
        "indication": req.indication,
        "recommended_device": device,
        "flow_rate_lpm": flow_lpm,
        "fio2_approximate": fio2,
        "target_spo2_min": target_spo2_min,
        "target_spo2_max": target_spo2_max,
        "alerts": alerts,
        "monitoring": [
            "Measure SpO2 continuously during titration.",
            "ABG within 30–60 min if type II RF risk or SpO2 not improving.",
            "Reassess device and flow rate at each clinical review.",
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# SPRINT 73 — NEPHROLOGY CDSS
# ─────────────────────────────────────────────────────────────────────────────

class CkdStageRequest(BaseModel):
    egfr: Optional[float] = None
    acr: Optional[float] = None          # albumin:creatinine ratio mg/mmol
    serum_potassium: Optional[float] = None
    serum_phosphate: Optional[float] = None
    serum_bicarbonate: Optional[float] = None
    haemoglobin: Optional[float] = None
    bp_systolic: Optional[int] = None
    on_ras_blockade: bool = False
    diabetes: bool = False
    prior_egfr: Optional[float] = None   # previous eGFR for slope calculation
    months_between: Optional[float] = None

def _ckd_g_stage(egfr: float) -> str:
    if egfr >= 90: return "G1"
    if egfr >= 60: return "G2"
    if egfr >= 45: return "G3a"
    if egfr >= 30: return "G3b"
    if egfr >= 15: return "G4"
    return "G5"

def _acr_category(acr: float) -> str:
    if acr < 3: return "A1"
    if acr < 30: return "A2"
    return "A3"

KDIGO_RISK = {
    # (G_stage, A_category) → risk
    ("G1","A1"): "low", ("G1","A2"): "moderate", ("G1","A3"): "high",
    ("G2","A1"): "low", ("G2","A2"): "moderate", ("G2","A3"): "high",
    ("G3a","A1"): "moderate", ("G3a","A2"): "high", ("G3a","A3"): "very_high",
    ("G3b","A1"): "high", ("G3b","A2"): "very_high", ("G3b","A3"): "very_high",
    ("G4","A1"): "very_high", ("G4","A2"): "very_high", ("G4","A3"): "very_high",
    ("G5","A1"): "very_high", ("G5","A2"): "very_high", ("G5","A3"): "very_high",
}

@app.post("/nephrology/ckd/stage")
async def stage_ckd(req: CkdStageRequest):
    """KDIGO CKD staging, progression risk, metabolic complication alerts, RAS dosing."""

    g_stage = _ckd_g_stage(req.egfr) if req.egfr is not None else None
    a_cat = _acr_category(req.acr) if req.acr is not None else None
    risk = KDIGO_RISK.get((g_stage, a_cat)) if g_stage and a_cat else None

    # GFR slope
    slope = None
    rapid_progresser = False
    if req.prior_egfr and req.months_between and req.egfr is not None and req.months_between > 0:
        slope = (req.egfr - req.prior_egfr) / req.months_between
        if slope < -5:  # >5 ml/min/1.73m² per year loss
            rapid_progresser = True

    alerts = []
    recommendations = []

    # Metabolic complications
    if req.serum_potassium and req.serum_potassium > 5.5:
        alerts.append(f"Hyperkalaemia (K {req.serum_potassium} mmol/L) — restrict dietary K, review RAS/NSAIDs/TMP-SMX.")
    if req.serum_phosphate and req.serum_phosphate > 1.5:
        alerts.append(f"Hyperphosphataemia ({req.serum_phosphate} mmol/L) — phosphate binders, dietary restriction.")
    if req.serum_bicarbonate and req.serum_bicarbonate < 22:
        alerts.append(f"Metabolic acidosis (HCO3 {req.serum_bicarbonate}) — sodium bicarbonate supplementation; target ≥22 mmol/L.")
    if req.haemoglobin and req.haemoglobin < 10:
        alerts.append(f"Anaemia of CKD (Hb {req.haemoglobin}) — check iron stores; consider ESA if Hb <10 and symptomatic.")
    if req.bp_systolic and req.bp_systolic > 130:
        alerts.append(f"BP {req.bp_systolic} mmHg exceeds target (<130/80 in CKD). Optimise RAS blockade.")
    if rapid_progresser:
        alerts.append(f"Rapid CKD progression: eGFR slope {slope:.1f} ml/min/1.73m²/month — urgent nephrology referral.")

    # Stage-specific recommendations
    if g_stage in ("G4", "G5"):
        recommendations.append("Nephrology referral for RRT planning (haemodialysis, peritoneal dialysis, transplantation).")
        recommendations.append("Vaccinate: Hepatitis B, Pneumococcal, Influenza.")
        recommendations.append("Avoid nephrotoxins: NSAIDs, contrast media, aminoglycosides.")
    if g_stage in ("G3a", "G3b", "G4", "G5"):
        recommendations.append("Avoid SGLT2 inhibitors below eGFR 45 (check product-specific threshold).")
        recommendations.append("Dose-adjust metformin: reduce at eGFR <45, stop at <30.")
        recommendations.append("Dietary protein restriction 0.6-0.8 g/kg/day.")
    if not req.on_ras_blockade and req.acr and req.acr >= 3:
        recommendations.append("ACE inhibitor or ARB indicated: albuminuria A2/A3 — target ACR reduction ≥30%.")
    recommendations.append("BP target <130/80 mmHg in all CKD patients.")
    recommendations.append("Optimise CVD risk: statin, aspirin as indicated, smoking cessation.")

    return {
        "g_stage": g_stage,
        "a_category": a_cat,
        "kdigo_risk": risk,
        "egfr_slope_per_month": round(slope, 3) if slope is not None else None,
        "rapid_progresser": rapid_progresser,
        "alerts": alerts,
        "recommendations": recommendations,
    }


class DialysisAdequacyRequest(BaseModel):
    dialysis_type: str = "haemodialysis"   # haemodialysis | peritoneal
    ktv: Optional[float] = None            # for HD
    pre_bun: Optional[float] = None        # mg/dL — for URR
    post_bun: Optional[float] = None
    session_duration_min: Optional[int] = None
    blood_flow_rate: Optional[int] = None  # ml/min
    ultrafiltration_vol_ml: Optional[int] = None
    pre_weight_kg: Optional[float] = None
    post_weight_kg: Optional[float] = None
    weekly_kt_v: Optional[float] = None    # for PD

@app.post("/nephrology/dialysis/adequacy")
async def dialysis_adequacy(req: DialysisAdequacyRequest):
    """KDOQI Kt/V and URR adequacy assessment with recommendations."""

    adequate = None
    urr = None
    uf_rate = None
    recommendations = []
    alerts = []

    if req.dialysis_type == "haemodialysis":
        # URR
        if req.pre_bun and req.post_bun and req.pre_bun > 0:
            urr = round((1 - req.post_bun / req.pre_bun) * 100, 1)

        # Adequacy assessment
        if req.ktv is not None:
            if req.ktv >= 1.4:
                adequate = True
            else:
                adequate = False
                alerts.append(f"Kt/V {req.ktv} < 1.4 (KDOQI minimum). Inadequate dialysis dose.")
                if req.session_duration_min and req.session_duration_min < 240:
                    recommendations.append("Extend session duration to ≥4 hours.")
                if req.blood_flow_rate and req.blood_flow_rate < 350:
                    recommendations.append(f"Increase blood flow rate (current {req.blood_flow_rate} ml/min; target 350-450 ml/min).")
                recommendations.append("Check access recirculation. Consider higher-flux dialyser.")

        if urr is not None and urr < 65:
            alerts.append(f"URR {urr}% < 65% (KDOQI target ≥65%).")

        # Ultrafiltration rate
        if req.ultrafiltration_vol_ml and req.session_duration_min and req.pre_weight_kg:
            uf_rate = round((req.ultrafiltration_vol_ml / req.pre_weight_kg) / (req.session_duration_min / 60), 1)
            if uf_rate > 13:
                alerts.append(f"High UF rate {uf_rate} ml/kg/h > 13 ml/kg/h — associated with increased mortality. Extend session or reduce interdialytic weight gain.")

        weight_loss = None
        if req.pre_weight_kg and req.post_weight_kg:
            weight_loss = round(req.pre_weight_kg - req.post_weight_kg, 2)

        return {
            "dialysis_type": "haemodialysis",
            "ktv": req.ktv,
            "urr_percent": urr,
            "uf_rate_ml_kg_h": uf_rate,
            "weight_loss_kg": weight_loss,
            "adequate": adequate,
            "alerts": alerts,
            "recommendations": recommendations,
        }

    else:  # peritoneal
        weekly_ktv = req.weekly_kt_v
        pd_adequate = weekly_ktv >= 1.7 if weekly_ktv is not None else None
        if weekly_ktv is not None and not pd_adequate:
            alerts.append(f"Weekly Kt/V {weekly_ktv} < 1.7 (KDOQI PD target). Increase exchanges or volume.")
        return {
            "dialysis_type": "peritoneal",
            "weekly_ktv": weekly_ktv,
            "adequate": pd_adequate,
            "alerts": alerts,
            "recommendations": ["Consider increasing number of exchanges or dwell volume.", "Assess residual renal function contribution."] if not pd_adequate else [],
        }


# Renal drug dose adjustment — common medications
RENAL_DOSING: Dict[str, Dict] = {
    "metformin": {
        "normal": "500-1000mg BD",
        "G3a_45_60": "Use with caution; reduce dose",
        "G3b_30_45": "Halve dose; monitor lactate",
        "below_30": "CONTRAINDICATED",
        "dialysis": "CONTRAINDICATED",
    },
    "atenolol": {
        "normal": "50-100mg daily",
        "G3b_30_45": "50mg daily",
        "below_30": "25mg daily",
        "dialysis": "25mg post-dialysis (dialysable)",
    },
    "ramipril": {
        "normal": "Up to 10mg daily",
        "below_30": "Start 1.25mg daily, titrate carefully; monitor K+",
        "dialysis": "1.25mg daily; monitor BP and K+",
    },
    "digoxin": {
        "normal": "125-250mcg daily",
        "G3b_30_45": "62.5-125mcg daily; monitor levels",
        "below_30": "62.5mcg on alternate days",
        "dialysis": "62.5mcg on non-dialysis days",
    },
    "gabapentin": {
        "normal": "300-1200mg TDS",
        "G3a_45_60": "300-600mg BD",
        "G3b_30_45": "300mg BD",
        "below_30": "300mg daily",
        "dialysis": "200-300mg post-dialysis",
    },
    "amoxicillin": {
        "normal": "250-500mg TDS",
        "below_30": "250-500mg BD",
        "dialysis": "250-500mg; give dose post-dialysis",
    },
    "ciprofloxacin": {
        "normal": "250-750mg BD",
        "G3b_30_45": "250-500mg BD",
        "below_30": "250-500mg daily",
        "dialysis": "250-500mg post-dialysis",
    },
    "trimethoprim": {
        "normal": "200mg BD",
        "G3b_30_45": "200mg daily",
        "below_30": "AVOID (hyperkalaemia risk)",
        "dialysis": "AVOID",
    },
    "allopurinol": {
        "normal": "100-300mg daily",
        "G3b_30_45": "100mg daily",
        "below_30": "50mg daily or on alternate days",
        "dialysis": "100mg post-dialysis",
    },
    "spironolactone": {
        "normal": "25-100mg daily",
        "below_30": "AVOID (hyperkalaemia risk)",
        "dialysis": "AVOID",
    },
}

def _egfr_band(egfr: float) -> str:
    if egfr >= 60: return "normal"
    if egfr >= 45: return "G3a_45_60"
    if egfr >= 30: return "G3b_30_45"
    return "below_30"

class RenalDrugRequest(BaseModel):
    drug_name: str
    egfr: Optional[float] = None
    on_dialysis: bool = False
    dialysis_type: Optional[str] = None  # haemodialysis | peritoneal

@app.post("/nephrology/drug-dosing/renal-adjust")
async def renal_drug_dosing(req: RenalDrugRequest):
    """Renal dose adjustment for common medications based on eGFR / dialysis status."""

    drug = req.drug_name.lower().strip()
    dosing = RENAL_DOSING.get(drug)

    if not dosing:
        return {
            "drug": req.drug_name,
            "found": False,
            "message": f"No specific renal dosing guidance found for '{req.drug_name}'. Consult BNF/Renal Drug Handbook.",
            "recommended_dose": None,
            "alerts": [],
        }

    alerts = []
    if req.on_dialysis:
        band = "dialysis"
    elif req.egfr is not None:
        band = _egfr_band(req.egfr)
    else:
        band = "normal"

    recommended = dosing.get(band) or dosing.get("normal", "Standard dose — no specific adjustment found")

    if "CONTRAINDICATED" in recommended or "AVOID" in recommended:
        alerts.append(f"{req.drug_name} should be avoided at eGFR {req.egfr} ml/min.")

    return {
        "drug": req.drug_name,
        "found": True,
        "egfr": req.egfr,
        "on_dialysis": req.on_dialysis,
        "egfr_band": band,
        "recommended_dose": recommended,
        "normal_dose": dosing.get("normal"),
        "alerts": alerts,
        "source": "Renal Drug Handbook / BNF 2023",
    }


# ─────────────────────────────────────────────────────────────────────────────
# SPRINT 74 — DERMATOLOGY CDSS
# ─────────────────────────────────────────────────────────────────────────────

class LesionClassifyRequest(BaseModel):
    morphology: Optional[str] = None        # macule | papule | nodule | plaque | vesicle | pustule | ulcer etc.
    colour: Optional[str] = None
    borders: Optional[str] = None           # well_defined | ill_defined | irregular | scalloped
    diameter_mm: Optional[float] = None
    evolution: Optional[str] = None         # static | growing | changing_colour | ulcerating
    location: Optional[str] = None          # sun_exposed | covered | acral | mucosal
    patient_age: Optional[int] = None
    duration_months: Optional[float] = None
    itching: bool = False
    bleeding: bool = False
    personal_hx_melanoma: bool = False
    family_hx_melanoma: bool = False
    immunosuppressed: bool = False

# ABCDE criteria helpers
def _abcde_score(req: LesionClassifyRequest) -> int:
    score = 0
    if req.borders in ('irregular', 'scalloped', 'ill_defined'): score += 1
    if req.colour and any(w in req.colour.lower() for w in ['multiple', 'varied', 'different', 'uneven']): score += 1
    if req.diameter_mm and req.diameter_mm > 6: score += 1
    if req.evolution and req.evolution in ('growing', 'changing_colour', 'ulcerating'): score += 1
    return score

@app.post("/dermatology/lesion/classify")
async def classify_lesion(req: LesionClassifyRequest):
    """Rule-based dermoscopic ABCDE risk stratification for skin lesions."""

    red_flags = []
    differentials = []
    urgency = "routine"
    biopsy_recommended = False

    abcde = _abcde_score(req)

    # Red flags
    if req.bleeding: red_flags.append("Bleeding lesion — urgent referral.")
    if req.evolution in ('growing', 'ulcerating', 'changing_colour'): red_flags.append("Changing/evolving lesion.")
    if req.personal_hx_melanoma: red_flags.append("Personal history of melanoma.")
    if req.family_hx_melanoma: red_flags.append("Family history of melanoma.")
    if req.immunosuppressed: red_flags.append("Immunosuppression increases malignancy risk.")

    # Morphology-based classification
    morph = (req.morphology or '').lower()
    loc = (req.location or '').lower()

    if morph in ('nodule', 'plaque') and req.borders == 'irregular':
        differentials.append("Squamous cell carcinoma (SCC)")
        differentials.append("Basal cell carcinoma (BCC) — nodular")
        biopsy_recommended = True
        urgency = "urgent"

    if abcde >= 3:
        differentials.insert(0, "Melanoma — high ABCDE score")
        urgency = "urgent"
        biopsy_recommended = True
        red_flags.append(f"ABCDE score {abcde}/4 — suspicious for malignancy.")

    if morph == 'macule' and 'sun_exposed' in loc:
        differentials.append("Solar lentigo / lentigo maligna")
        if req.patient_age and req.patient_age > 60:
            differentials.append("Lentigo maligna melanoma (consider if growing)")

    if morph in ('vesicle', 'pustule'):
        differentials.append("Herpes zoster (dermatomal) / herpes simplex")
        differentials.append("Bullous impetigo")
        urgency = "semi_urgent"

    if morph == 'papule' and req.itching:
        differentials.append("Eczema / dermatitis")
        differentials.append("Lichen planus")
        differentials.append("Psoriasis")

    if morph == 'ulcer':
        differentials.append("Venous leg ulcer")
        differentials.append("Arterial ulcer")
        differentials.append("Squamous cell carcinoma (Marjolin's ulcer if chronic)")
        biopsy_recommended = True
        urgency = "semi_urgent"

    if not differentials:
        differentials = ["Benign skin lesion — correlate clinically"]

    management = []
    if biopsy_recommended:
        management.append("Skin biopsy (punch or excisional) for histopathological diagnosis.")
    if urgency == "urgent":
        management.append("Refer to dermatology / plastic surgery within 2 weeks (2-week-wait pathway).")
    elif urgency == "semi_urgent":
        management.append("Dermatology review within 4 weeks.")
    else:
        management.append("Routine dermatology review. Patient education on sun protection and self-monitoring.")

    management.append("Full skin examination (total body skin survey) recommended.")
    if req.personal_hx_melanoma or req.family_hx_melanoma:
        management.append("6–12 monthly surveillance dermatoscopy given melanoma risk factors.")

    return {
        "abcde_score": abcde,
        "urgency": urgency,
        "biopsy_recommended": biopsy_recommended,
        "differentials": differentials,
        "red_flags": red_flags,
        "management": management,
    }


class BurnFluidRequest(BaseModel):
    weight_kg: float
    tbsa_percent: float                     # Total Body Surface Area burned (%)
    age_years: Optional[int] = None
    burn_depth: Optional[str] = None        # superficial | partial | full
    inhalation_injury: bool = False
    time_since_burn_hours: Optional[float] = None

@app.post("/dermatology/burn/fluid")
async def burn_fluid(req: BurnFluidRequest):
    """Parkland formula burn fluid resuscitation + referral criteria."""

    # Parkland: 4 mL × weight (kg) × TBSA%
    parkland_total = 4 * req.weight_kg * req.tbsa_percent
    first_8h = parkland_total / 2
    next_16h = parkland_total / 2

    # Adjust for time elapsed
    time_remaining_first_8h = None
    rate_first_8h = None
    if req.time_since_burn_hours is not None and req.time_since_burn_hours < 8:
        remaining = 8 - req.time_since_burn_hours
        time_remaining_first_8h = round(remaining, 1)
        rate_first_8h = round(first_8h / remaining, 0) if remaining > 0 else 0

    alerts = []
    referral_criteria = []

    if req.tbsa_percent >= 15:
        referral_criteria.append("TBSA ≥15% in adults — transfer to burns unit.")
    if req.tbsa_percent >= 10 and req.age_years and (req.age_years < 10 or req.age_years > 50):
        referral_criteria.append("TBSA ≥10% in children <10 or adults >50 — transfer to burns unit.")
    if req.inhalation_injury:
        referral_criteria.append("Inhalation injury — immediate anaesthesia/ICU involvement; early intubation.")
        alerts.append("Inhalation injury detected — airway at risk. Prepare RSI.")
    if req.burn_depth == 'full' and req.tbsa_percent >= 5:
        referral_criteria.append("Full thickness burns ≥5% TBSA — burns unit.")
    if req.tbsa_percent >= 30:
        alerts.append(f"Massive burn ({req.tbsa_percent}% TBSA). Parkland formula is a guide — titrate to urine output 0.5–1 ml/kg/h.")

    fluid_type = "Lactated Ringer's solution (preferred) or 0.9% Normal Saline"
    monitoring = [
        "Insert urinary catheter — target urine output 0.5 ml/kg/h (adult) or 1 ml/kg/h (child <30 kg).",
        "Avoid over-resuscitation: adjust rate based on clinical response.",
        "Colloid (albumin 5%) after 12h for burns >40% TBSA.",
        "Wound care: cool with tepid water for 20 min, then cover with cling film.",
        "Analgesia: IV morphine titrated to pain score.",
        "Tetanus prophylaxis as indicated.",
    ]

    return {
        "weight_kg": req.weight_kg,
        "tbsa_percent": req.tbsa_percent,
        "parkland_total_ml": round(parkland_total, 0),
        "first_8h_from_injury_ml": round(first_8h, 0),
        "next_16h_ml": round(next_16h, 0),
        "rate_first_8h_ml_per_h": round(first_8h / 8, 0),
        "rate_next_16h_ml_per_h": round(next_16h / 16, 0),
        "time_remaining_first_8h": time_remaining_first_8h,
        "adjusted_rate_ml_per_h": rate_first_8h,
        "fluid_type": fluid_type,
        "referral_criteria": referral_criteria,
        "alerts": alerts,
        "monitoring": monitoring,
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
