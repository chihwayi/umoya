import io

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
