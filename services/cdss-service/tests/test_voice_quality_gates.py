import asyncio

from ai_models.voice_scribe import VoiceScribe


class _DummyLLM:
    def __init__(self, payload):
        self.payload = payload

    async def generate_json(self, prompt, schema):
        return self.payload


def _scribe_with_payload(payload):
    scribe = VoiceScribe.__new__(VoiceScribe)
    scribe.llm_provider = _DummyLLM(payload)
    return scribe


def test_normalize_language_codes_for_supported_set():
    scribe = _scribe_with_payload({})
    assert scribe._normalize_language_code("English", "en") == "en"
    assert scribe._normalize_language_code("Shona", "en") == "sn"
    assert scribe._normalize_language_code("Ndebele", "en") == "nd"


def test_generate_soap_note_normalizes_schema_fields():
    scribe = _scribe_with_payload(
        {
            "subjective": "Patient reports headache",
            "objective": "",
            "assessment": None,
            "plan": "Hydration and review",
            "original_language_detected": "Shona",
        }
    )

    soap = asyncio.run(scribe.generate_soap_note("Murwere ane musoro", detected_language="sn"))
    assert soap["subjective"] == "Patient reports headache"
    assert soap["objective"] == "Not provided"
    assert soap["assessment"] == "Not provided"
    assert soap["plan"] == "Hydration and review"
    assert soap["original_language_detected"] == "sn"
