import io
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile

import main


def _upload(filename: str, content: bytes, content_type: str) -> UploadFile:
    return UploadFile(
        file=io.BytesIO(content),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


def test_validate_upload_constraints_accepts_allowed_audio():
    upload = _upload("note.wav", b"RIFF....", "audio/wav")
    meta = main._validate_upload_constraints(
        upload,
        file_label="audio",
        max_bytes=1024,
        allowed_mime_types=main._ALLOWED_AUDIO_MIME_TYPES,
        allowed_extensions=main._ALLOWED_AUDIO_EXTENSIONS,
    )
    assert meta["safe_filename"] == "note.wav"
    assert meta["size_bytes"] > 0


def test_validate_upload_constraints_rejects_invalid_type():
    upload = _upload("payload.exe", b"abc", "application/x-msdownload")
    with pytest.raises(HTTPException) as err:
        main._validate_upload_constraints(
            upload,
            file_label="audio",
            max_bytes=1024,
            allowed_mime_types=main._ALLOWED_AUDIO_MIME_TYPES,
            allowed_extensions=main._ALLOWED_AUDIO_EXTENSIONS,
        )
    assert err.value.status_code == 400


def test_validate_upload_constraints_rejects_oversized_payload():
    upload = _upload("image.png", b"x" * 4096, "image/png")
    with pytest.raises(HTTPException) as err:
        main._validate_upload_constraints(
            upload,
            file_label="image",
            max_bytes=64,
            allowed_mime_types=main._ALLOWED_IMAGE_MIME_TYPES,
            allowed_extensions=main._ALLOWED_IMAGE_EXTENSIONS,
        )
    assert err.value.status_code == 413


def test_malware_scan_infected_file_blocks(monkeypatch):
    monkeypatch.setenv("CDSS_MALWARE_SCAN_ENABLED", "true")
    monkeypatch.setenv("CDSS_MALWARE_SCAN_FAIL_CLOSED", "true")
    monkeypatch.setattr(
        main.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=1, stderr="FOUND"),
    )
    with pytest.raises(HTTPException) as err:
        main._scan_file_for_malware("/tmp/example.bin", "audio")
    assert err.value.status_code == 400


def test_malware_scan_engine_error_blocks_when_fail_closed(monkeypatch):
    monkeypatch.setenv("CDSS_MALWARE_SCAN_ENABLED", "true")
    monkeypatch.setenv("CDSS_MALWARE_SCAN_FAIL_CLOSED", "true")
    monkeypatch.setattr(
        main.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=2, stderr="scanner unavailable"),
    )
    with pytest.raises(HTTPException) as err:
        main._scan_file_for_malware("/tmp/example.bin", "image")
    assert err.value.status_code == 503


def test_malware_scan_engine_error_can_fail_open(monkeypatch):
    monkeypatch.setenv("CDSS_MALWARE_SCAN_ENABLED", "true")
    monkeypatch.setenv("CDSS_MALWARE_SCAN_FAIL_CLOSED", "false")
    monkeypatch.setattr(
        main.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=2, stderr="scanner unavailable"),
    )
    main._scan_file_for_malware("/tmp/example.bin", "image")
