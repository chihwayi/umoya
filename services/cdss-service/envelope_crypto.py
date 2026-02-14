import hashlib
import os
from datetime import datetime, timezone
from typing import Any, Optional
import json

from cryptography.fernet import Fernet, InvalidToken


def _parse_bool(name: str, default: str) -> bool:
    raw = os.getenv(name, default)
    val = str(raw).strip().lower()
    if val not in ("true", "false"):
        raise RuntimeError(f"Invalid {name} value '{raw}'. Expected 'true' or 'false'.")
    return val == "true"


class EnvelopeCrypto:
    """
    KMS-ready envelope encryption abstraction.
    Current implementation uses local Fernet key material and stores key metadata
    to support auditable rotations.
    """

    def __init__(self) -> None:
        self.enabled = _parse_bool("CDSS_ENCRYPTION_ENABLED", "true")
        self.allow_plaintext_reads = _parse_bool("CDSS_ENCRYPTION_ALLOW_PLAINTEXT_READS", "true")
        self.provider = os.getenv("CDSS_ENCRYPTION_PROVIDER", "local").strip().lower() or "local"
        self.key_id = os.getenv("CDSS_ENCRYPTION_KEY_ID", "local-dev-v1").strip() or "local-dev-v1"
        self._fernet: Optional[Fernet] = None

        if not self.enabled:
            return

        key = os.getenv("CDSS_ENCRYPTION_KEY", "").strip()
        if not key:
            raise RuntimeError("CDSS_ENCRYPTION_ENABLED=true but CDSS_ENCRYPTION_KEY is missing.")
        try:
            # Validate key is acceptable for Fernet without altering source material.
            self._fernet = Fernet(key.encode("utf-8"))
        except Exception as exc:
            raise RuntimeError(f"Invalid CDSS_ENCRYPTION_KEY: {exc}") from exc

    def key_fingerprint(self) -> Optional[str]:
        if not self.enabled:
            return None
        key = os.getenv("CDSS_ENCRYPTION_KEY", "").encode("utf-8")
        if not key:
            return None
        return hashlib.sha256(key).hexdigest()[:16]

    def encrypt_json(self, payload: Any) -> Any:
        if not self.enabled:
            return payload
        if self._fernet is None:
            raise RuntimeError("Encryption is enabled but cipher is not initialized.")

        raw = json.dumps(payload).encode("utf-8")
        # Preserve JSON shape without forcing callers to change DB schema.
        token = self._fernet.encrypt(raw).decode("utf-8")
        return {
            "__enc_v1": {
                "provider": self.provider,
                "alg": "fernet",
                "key_id": self.key_id,
                "encrypted_at": datetime.now(timezone.utc).isoformat(),
                "ciphertext": token,
            }
        }

    def decrypt_json(self, payload: Any) -> Any:
        if not isinstance(payload, dict):
            return payload

        wrapper = payload.get("__enc_v1")
        if not isinstance(wrapper, dict):
            if self.enabled and not self.allow_plaintext_reads:
                raise RuntimeError("Plaintext payload read blocked by CDSS_ENCRYPTION_ALLOW_PLAINTEXT_READS=false.")
            return payload

        if self._fernet is None:
            raise RuntimeError("Encrypted payload cannot be decrypted because cipher is not initialized.")

        ciphertext = wrapper.get("ciphertext")
        if not isinstance(ciphertext, str) or not ciphertext:
            raise RuntimeError("Encrypted payload is missing ciphertext.")

        try:
            raw = self._fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
        except InvalidToken as exc:
            raise RuntimeError("Failed to decrypt payload with active key.") from exc

        # Payload is stored as stringified Python/JSON-compatible object.
        # Try JSON first; if decoding fails return raw string.
        try:
            return json.loads(raw)
        except Exception:
            # Fallback for stringified dicts from legacy callers; avoid eval.
            if raw.startswith("{") and raw.endswith("}"):
                try:
                    import ast

                    parsed = ast.literal_eval(raw)
                    if isinstance(parsed, dict):
                        return parsed
                except Exception:
                    pass
            return raw
