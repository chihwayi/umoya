import os
from urllib.parse import urlparse


def _parse_bool_strict(name: str, default: str) -> bool:
    raw = os.getenv(name, default)
    val = str(raw).strip().lower()
    if val not in ("true", "false"):
        raise RuntimeError(f"Invalid {name} value '{raw}'. Expected 'true' or 'false'.")
    return val == "true"


def _normalize_host_entry(value: str) -> tuple[str, str]:
    """
    Returns (host, host_with_optional_port), both lowercase.
    """
    v = (value or "").strip()
    if not v:
        return ("", "")

    if "://" in v:
        parsed = urlparse(v)
        host = (parsed.hostname or "").lower()
        if not host:
            return ("", "")
        if parsed.port:
            return (host, f"{host}:{parsed.port}")
        return (host, host)

    token = v.lower()
    # host:port or host
    if ":" in token:
        host, port = token.rsplit(":", 1)
        if host and port.isdigit():
            return (host, f"{host}:{port}")
    return (token, token)


def is_strict_egress_enabled() -> bool:
    return _parse_bool_strict("CDSS_STRICT_EGRESS_ALLOWLIST", "true")


def _build_allowlist() -> set[str]:
    raw = os.getenv("CDSS_EGRESS_ALLOWLIST", "")
    allowlist = set()

    # Explicit allowlist entries
    if raw.strip():
        for item in raw.split(","):
            host, host_port = _normalize_host_entry(item)
            if host:
                allowlist.add(host)
            if host_port:
                allowlist.add(host_port)

    # Derive allowlist from explicitly configured internal service URLs only.
    # No hardcoded hosts/ports to avoid accidental open egress drift.
    configured_targets = [
        os.getenv("LLM_API_URL", "").strip(),
        os.getenv("EHR_SERVICE_URL", "").strip(),
    ]
    for item in configured_targets:
        if not item:
            continue
        host, host_port = _normalize_host_entry(item)
        if host:
            allowlist.add(host)
        if host_port:
            allowlist.add(host_port)

    return allowlist


def assert_egress_allowed(target_url: str, purpose: str = "outbound_call") -> None:
    if not is_strict_egress_enabled():
        return

    parsed = urlparse(target_url)
    host = (parsed.hostname or "").lower()
    if not host:
        raise RuntimeError(f"Egress blocked ({purpose}): invalid target URL '{target_url}'")

    host_port = f"{host}:{parsed.port}" if parsed.port else host
    allowlist = _build_allowlist()
    if host in allowlist or host_port in allowlist:
        return

    raise RuntimeError(f"Egress blocked ({purpose}): target '{host_port}' not in CDSS allowlist")
