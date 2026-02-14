import os

from privacy_guard import assert_no_outbound_phi, contains_phi, redact_text


def test_contains_phi_detects_email():
    assert contains_phi("Patient contact: jane.doe@example.com") is True


def test_redact_text_masks_phone():
    masked = redact_text("Call me at +263 77 123 4567")
    assert "[REDACTED_PHONE]" in masked


def test_assert_no_outbound_phi_blocks_when_enabled():
    os.environ["CDSS_BLOCK_OUTBOUND_PHI"] = "true"
    try:
        blocked = False
        try:
            assert_no_outbound_phi("DOB: 1985-07-11", purpose="unit_test")
        except RuntimeError:
            blocked = True
        assert blocked is True
    finally:
        os.environ.pop("CDSS_BLOCK_OUTBOUND_PHI", None)


def test_assert_no_outbound_phi_allows_when_disabled():
    os.environ["CDSS_BLOCK_OUTBOUND_PHI"] = "false"
    try:
        assert_no_outbound_phi("DOB: 1985-07-11", purpose="unit_test_disabled")
    finally:
        os.environ.pop("CDSS_BLOCK_OUTBOUND_PHI", None)

