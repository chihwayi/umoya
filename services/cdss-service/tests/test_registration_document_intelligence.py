import asyncio

import main


class _FakeLlmProvider:
    async def generate_json(self, *args, **kwargs):
        return {
            "structured_payload": {
                "requestedSpecialty": "Oncology",
                "medicationCandidates": ["Tamoxifen"],
            },
            "summary": "Urgent oncology referral.",
            "flags": ["llm_enhanced"],
            "confidence": 0.92,
        }


def test_registration_document_analyze_merges_llm_and_fallback(monkeypatch):
    monkeypatch.setattr(main, "LLMProvider", lambda: _FakeLlmProvider())
    monkeypatch.setattr(main, "_resolve_ai_policy", lambda policy, request: {"ai_enabled": True})
    monkeypatch.setattr(main, "_tenant_cache_key_from_request", lambda request: "tenant-a")

    req = main.RegistrationDocumentAnalyzeReq(
        document_type="referral_letter",
        extracted_text=(
            "Referred by: Dr Nyathi\n"
            "Urgency: Urgent\n"
            "Please arrange biopsy within 2 weeks.\n"
        ),
        file_name="referral.txt",
        language="en",
    )

    response = asyncio.run(main.registration_document_analyze(req, http_req=object(), ai_policy={}))

    assert response["structured_payload"]["requestedSpecialty"] == "Oncology"
    assert "biopsy" in response["structured_payload"]["requestedInvestigations"]
    assert "Tamoxifen" in response["structured_payload"]["medicationCandidates"]
    assert response["governance"]["use_case"] == "registration_document_intelligence"
    assert response["governance"]["llm_enhanced"] is True
