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
