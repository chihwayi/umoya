import hashlib
import os
from datetime import datetime, timezone
from typing import Any, Optional, Dict, List
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
        self.kms_key_arn = os.getenv("CDSS_ENCRYPTION_KMS_KEY_ARN", "").strip()
        self._fernet: Optional[Fernet] = None
        self._keyring: Dict[str, Fernet] = {}
        self._raw_keyring: Dict[str, bytes] = {}

        if not self.enabled:
            return

        key = os.getenv("CDSS_ENCRYPTION_KEY", "").strip()
        if not key:
            raise RuntimeError("CDSS_ENCRYPTION_ENABLED=true but CDSS_ENCRYPTION_KEY is missing.")
        try:
            self._fernet = Fernet(key.encode("utf-8"))
            self._keyring[self.key_id] = self._fernet
            self._raw_keyring[self.key_id] = key.encode("utf-8")
        except Exception as exc:
            raise RuntimeError(f"Invalid CDSS_ENCRYPTION_KEY: {exc}") from exc
        self._load_legacy_keys()

    def _load_legacy_keys(self) -> None:
        """
        Optional rotation keyring for decrypting older ciphertexts.
        Format: CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON='{"key-v1":"<fernet-key>","key-v0":"<fernet-key>"}'
        """
        raw = os.getenv("CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON", "").strip()
        if not raw:
            return
        try:
            parsed = json.loads(raw)
        except Exception as exc:
            raise RuntimeError(f"Invalid CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON: {exc}") from exc
        if not isinstance(parsed, dict):
            raise RuntimeError("CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON must be a JSON object.")
        for key_id, key_val in parsed.items():
            if not isinstance(key_id, str) or not key_id.strip():
                raise RuntimeError("CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON has invalid key id.")
            if not isinstance(key_val, str) or not key_val.strip():
                raise RuntimeError(f"CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON key '{key_id}' has empty key material.")
            normalized_key_id = key_id.strip()
            if normalized_key_id == self.key_id:
                continue
            try:
                f = Fernet(key_val.encode("utf-8"))
            except Exception as exc:
                raise RuntimeError(f"Invalid previous encryption key for '{normalized_key_id}': {exc}") from exc
            self._keyring[normalized_key_id] = f
            self._raw_keyring[normalized_key_id] = key_val.encode("utf-8")

    def key_fingerprint(self, key_id: Optional[str] = None) -> Optional[str]:
        if not self.enabled:
            return None
        selected = key_id or self.key_id
        key = self._raw_keyring.get(selected)
        if not key:
            return None
        return hashlib.sha256(key).hexdigest()[:16]

    def key_metadata(self) -> List[dict]:
        rows: List[dict] = []
        for key_id in self._keyring.keys():
            rows.append(
                {
                    "key_id": key_id,
                    "provider": self.provider,
                    "key_fingerprint": self.key_fingerprint(key_id),
                    "is_active": key_id == self.key_id,
                }
            )
        return rows

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
                "kms_key_arn": self.kms_key_arn if self.provider == "kms" and self.kms_key_arn else None,
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

        wrapped_key_id = wrapper.get("key_id")
        fernet = None
        if isinstance(wrapped_key_id, str) and wrapped_key_id.strip():
            fernet = self._keyring.get(wrapped_key_id.strip())
        if fernet is None:
            fernet = self._fernet

        try:
            raw = fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
        except InvalidToken as exc:
            key_label = wrapped_key_id if isinstance(wrapped_key_id, str) else self.key_id
            raise RuntimeError(f"Failed to decrypt payload with key_id='{key_label}'.") from exc

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
