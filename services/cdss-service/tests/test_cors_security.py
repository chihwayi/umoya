import pytest

import main


def test_cors_non_dev_requires_explicit_allowlist():
    with pytest.raises(RuntimeError, match="CORS_ORIGINS must be configured"):
        main._resolve_cors_origins(env="production", raw_origins="")


def test_cors_non_dev_blocks_wildcard_origin():
    with pytest.raises(RuntimeError, match="cannot include '\\*'"):
        main._resolve_cors_origins(env="production", raw_origins="*")


def test_cors_non_dev_blocks_invalid_origin_format():
    with pytest.raises(RuntimeError, match="Invalid CORS origin"):
        main._resolve_cors_origins(env="production", raw_origins="https://app.example.com/path")


def test_cors_non_dev_accepts_explicit_origins():
    origins = main._resolve_cors_origins(
        env="production",
        raw_origins="https://app.example.com, https://ops.example.com, https://app.example.com",
    )
    assert origins == ["https://app.example.com", "https://ops.example.com"]


def test_cors_dev_defaults_to_wildcard():
    origins = main._resolve_cors_origins(env="development", raw_origins="")
    assert origins == ["*"]
