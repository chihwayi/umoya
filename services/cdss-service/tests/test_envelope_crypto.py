import pytest

from envelope_crypto import EnvelopeCrypto


FERNET_TEST_KEY = "4jjEsRfNuvF2fFf2C_w4ebxXVY4mKe6ylhS4iNlS_Bg="


def test_envelope_crypto_encrypt_decrypt_roundtrip(monkeypatch):
    monkeypatch.setenv("CDSS_ENCRYPTION_ENABLED", "true")
    monkeypatch.setenv("CDSS_ENCRYPTION_ALLOW_PLAINTEXT_READS", "true")
    monkeypatch.setenv("CDSS_ENCRYPTION_PROVIDER", "local")
    monkeypatch.setenv("CDSS_ENCRYPTION_KEY_ID", "test-key-v1")
    monkeypatch.setenv("CDSS_ENCRYPTION_KEY", FERNET_TEST_KEY)

    crypto = EnvelopeCrypto()
    payload = {"tenant": "t-1", "action": "ingest"}
    encrypted = crypto.encrypt_json(payload)

    assert "__enc_v1" in encrypted
    assert encrypted["__enc_v1"]["key_id"] == "test-key-v1"
    assert crypto.decrypt_json(encrypted) == payload


def test_envelope_crypto_blocks_plaintext_reads_when_disabled(monkeypatch):
    monkeypatch.setenv("CDSS_ENCRYPTION_ENABLED", "true")
    monkeypatch.setenv("CDSS_ENCRYPTION_ALLOW_PLAINTEXT_READS", "false")
    monkeypatch.setenv("CDSS_ENCRYPTION_KEY_ID", "test-key-v1")
    monkeypatch.setenv("CDSS_ENCRYPTION_KEY", FERNET_TEST_KEY)

    crypto = EnvelopeCrypto()
    with pytest.raises(RuntimeError, match="Plaintext payload read blocked"):
        crypto.decrypt_json({"plain": "payload"})


def test_envelope_crypto_decrypts_legacy_key_material(monkeypatch):
    legacy_key = "Wwxzj6M4xVNeBEYC_39vFImIw6IYJkMg4rYb53Lo9Ro="
    monkeypatch.setenv("CDSS_ENCRYPTION_ENABLED", "true")
    monkeypatch.setenv("CDSS_ENCRYPTION_ALLOW_PLAINTEXT_READS", "false")
    monkeypatch.setenv("CDSS_ENCRYPTION_PROVIDER", "local")
    monkeypatch.setenv("CDSS_ENCRYPTION_KEY_ID", "test-key-v2")
    monkeypatch.setenv("CDSS_ENCRYPTION_KEY", FERNET_TEST_KEY)
    monkeypatch.setenv(
        "CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON",
        '{"test-key-v1":"Wwxzj6M4xVNeBEYC_39vFImIw6IYJkMg4rYb53Lo9Ro="}',
    )

    monkeypatch.setenv("CDSS_ENCRYPTION_KEY_ID", "test-key-v1")
    monkeypatch.setenv("CDSS_ENCRYPTION_KEY", legacy_key)
    monkeypatch.delenv("CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON", raising=False)
    encrypted_legacy = EnvelopeCrypto().encrypt_json({"payload": "legacy"})

    monkeypatch.setenv("CDSS_ENCRYPTION_KEY_ID", "test-key-v2")
    monkeypatch.setenv("CDSS_ENCRYPTION_KEY", FERNET_TEST_KEY)
    monkeypatch.setenv(
        "CDSS_ENCRYPTION_PREVIOUS_KEYS_JSON",
        '{"test-key-v1":"Wwxzj6M4xVNeBEYC_39vFImIw6IYJkMg4rYb53Lo9Ro="}',
    )
    current_crypto = EnvelopeCrypto()
    assert current_crypto.decrypt_json(encrypted_legacy) == {"payload": "legacy"}
    assert len(current_crypto.key_metadata()) == 2


def test_envelope_crypto_sets_kms_metadata(monkeypatch):
    monkeypatch.setenv("CDSS_ENCRYPTION_ENABLED", "true")
    monkeypatch.setenv("CDSS_ENCRYPTION_ALLOW_PLAINTEXT_READS", "true")
    monkeypatch.setenv("CDSS_ENCRYPTION_PROVIDER", "kms")
    monkeypatch.setenv("CDSS_ENCRYPTION_KMS_KEY_ARN", "arn:aws:kms:us-east-1:123456789012:key/test")
    monkeypatch.setenv("CDSS_ENCRYPTION_KEY_ID", "kms-v1")
    monkeypatch.setenv("CDSS_ENCRYPTION_KEY", FERNET_TEST_KEY)

    crypto = EnvelopeCrypto()
    enc = crypto.encrypt_json({"ok": True})
    assert enc["__enc_v1"]["kms_key_arn"] == "arn:aws:kms:us-east-1:123456789012:key/test"
