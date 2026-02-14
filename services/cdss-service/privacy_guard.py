import os
import re
from typing import Any


def is_phi_redaction_enabled() -> bool:
    return os.getenv("CDSS_PHI_REDACTION_ENABLED", "true").lower() == "true"


def _parse_bool(name: str, default: str) -> bool:
    raw = os.getenv(name, default)
    val = str(raw).strip().lower()
    if val not in ("true", "false"):
        raise RuntimeError(f"Invalid {name} value '{raw}'. Expected 'true' or 'false'.")
    return val == "true"


def is_outbound_phi_block_enabled() -> bool:
    return _parse_bool("CDSS_BLOCK_OUTBOUND_PHI", "true")


_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # Emails
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), "[REDACTED_EMAIL]"),
    # Phone numbers (international and local-ish forms)
    (re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{3,4}\b"), "[REDACTED_PHONE]"),
    # SSN style
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[REDACTED_ID]"),
    # National/passport-like long alnum IDs
    (re.compile(r"\b[A-Z0-9]{8,20}\b"), "[REDACTED_ID]"),
    # MRN labels
    (re.compile(r"\b(MRN|Patient\s*ID|PID)\s*[:#]?\s*[A-Za-z0-9\-_/]+\b", re.IGNORECASE), "[REDACTED_MRN]"),
    # DOB labels + date-like values
    (re.compile(r"\b(DOB|Date\s*of\s*Birth)\s*[:#]?\s*[0-9]{1,4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,4}\b", re.IGNORECASE), "[REDACTED_DOB]"),
]

_SENSITIVE_KEYS = {
    "name", "full_name", "patient_name", "first_name", "last_name", "surname",
    "email", "phone", "phone_number", "mobile", "address", "street", "city",
    "dob", "date_of_birth", "national_id", "passport", "mrn", "patient_id",
}


def redact_text(text: str) -> str:
    if not isinstance(text, str) or not text:
        return text
    if not is_phi_redaction_enabled():
        return text

    out = text
    for pattern, replacement in _PATTERNS:
        out = pattern.sub(replacement, out)
    return out


def contains_phi(text: str) -> bool:
    if not isinstance(text, str) or not text:
        return False
    for pattern, _ in _PATTERNS:
        if pattern.search(text):
            return True
    return False


def assert_no_outbound_phi(text: str, purpose: str = "outbound_payload") -> None:
    if not is_outbound_phi_block_enabled():
        return
    if contains_phi(text):
        raise RuntimeError(f"Outbound PHI policy blocked payload for {purpose}.")


def redact_value(value: Any) -> Any:
    if not is_phi_redaction_enabled():
        return value

    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, list):
        return [redact_value(v) for v in value]
    if isinstance(value, tuple):
        return tuple(redact_value(v) for v in value)
    if isinstance(value, dict):
        redacted = {}
        for k, v in value.items():
            key_norm = str(k).strip().lower()
            if key_norm in _SENSITIVE_KEYS:
                redacted[k] = "[REDACTED]"
            else:
                redacted[k] = redact_value(v)
        return redacted
    return value
