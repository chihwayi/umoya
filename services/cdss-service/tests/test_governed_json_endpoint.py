import asyncio

import main


class _FakeLlmProvider:
    model_name = "fake-governed-json-model"

    async def generate_json(self, *args, **kwargs):
        return {
            "answer": "Use only the approved visit plan and call the clinic if symptoms worsen.",
            "citations_used": ["cit-1"],
            "urgent_signal": False,
            "abstain": False,
        }


def test_governed_json_endpoint_uses_registered_use_case(monkeypatch):
    monkeypatch.setattr(main, "LLMProvider", lambda: _FakeLlmProvider())
    monkeypatch.setattr(main, "_resolve_ai_policy", lambda policy, request: {"ai_enabled": True})
    monkeypatch.setattr(main, "_tenant_cache_key_from_request", lambda request: "tenant-a")

    req = main.GovernedJsonReq(
        use_case="post_visit_patient_answer",
        schema_description='{"answer":"string","citations_used":["string"],"urgent_signal":"boolean","abstain":"boolean"}',
        template_version="postvisit-answer-v1",
        messages=[
            main.GovernedJsonMessage(role="system", content="Answer only from approved post-visit context."),
            main.GovernedJsonMessage(role="user", content="What should I do next?"),
        ],
        patient_id="patient-1",
        session_id="session-1",
    )

    response = asyncio.run(main.governed_json(req, http_req=object(), ai_policy={}))

    assert response["json"]["answer"].startswith("Use only")
    assert response["model"] == "fake-governed-json-model"
    assert response["audit"]["templateVersion"] == "postvisit-answer-v1"
    assert response["governance"]["use_case"] == "post_visit_patient_answer"
    assert response["governance"]["tenant_context_present"] is True
