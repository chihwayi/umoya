"""
S268 (F8) — verifies intelligent_suggest() honestly reports whether guideline
retrieval actually grounded the generation, via the new grounding_status/
grounding_reason fields, instead of silently proceeding with empty context.

Deliberately imports only diagnostic_assistant (no heavy AI deps at module
level — see diagnostic_assistant.py's own lazy-import comment) so this runs
in the bare-pytest CI safety-gate venv, matching the pattern established for
test_diagnosis_discharge_safety_governor.py after the S262 CI break.
"""
import asyncio

from diagnostic_assistant import DiagnosticAssistant


class FakeLlmProvider:
    model_name = "fake-llm-v1"

    def __init__(self, json_response=None):
        self._json_response = json_response or {
            "reasoning": "test reasoning",
            "recommendation": "test recommendation",
            "evidence_level": "Moderate",
            "diagnoses": [{"name": "Influenza", "probability": 0.6, "reasoning": "matches symptoms"}],
            "recommended_tests": [],
            "red_flags": [],
            "action_items": [],
        }

    async def check_availability(self):
        return True

    async def generate_json(self, *args, **kwargs):
        return self._json_response


class FakeKnowledgeRegistry:
    def __init__(self, docs=None, raise_error=False):
        self._docs = docs or []
        self._raise_error = raise_error

    def search(self, query, limit=3, specialty=None, module=None):
        if self._raise_error:
            raise RuntimeError("registry search failed")
        return self._docs


def make_assistant(knowledge_registry=None, rag_engine=None, llm_provider=None):
    assistant = DiagnosticAssistant()
    assistant.llm_provider = llm_provider or FakeLlmProvider()
    assistant.knowledge_registry = knowledge_registry
    assistant.rag_engine = rag_engine
    return assistant


def run(coro):
    return asyncio.run(coro)


def test_grounded_when_knowledge_registry_returns_docs():
    assistant = make_assistant(
        knowledge_registry=FakeKnowledgeRegistry(docs=[
            {"title": "Flu guidance", "text": "Treat symptomatically", "source": "WHO"},
        ]),
    )
    result = run(assistant.intelligent_suggest(symptoms=["fever", "cough"]))

    assert result["grounding_status"] == "grounded"
    assert "1 guideline chunk" in result["grounding_reason"]
    assert len(result["guideline_citations"]) == 1


def test_not_attempted_when_no_retrieval_engine_configured():
    assistant = make_assistant(knowledge_registry=None, rag_engine=None)
    result = run(assistant.intelligent_suggest(symptoms=["fever", "cough"]))

    assert result["grounding_status"] == "not_attempted"


def test_ungrounded_no_results_when_retrieval_finds_nothing():
    assistant = make_assistant(knowledge_registry=FakeKnowledgeRegistry(docs=[]))
    result = run(assistant.intelligent_suggest(symptoms=["fever", "cough"]))

    assert result["grounding_status"] == "ungrounded_no_results"
    assert result["guideline_citations"] == []


def test_ungrounded_retrieval_failed_when_registry_raises():
    assistant = make_assistant(knowledge_registry=FakeKnowledgeRegistry(raise_error=True))
    result = run(assistant.intelligent_suggest(symptoms=["fever", "cough"]))

    assert result["grounding_status"] == "ungrounded_retrieval_failed"
    assert "exception" in result["grounding_reason"]


def test_grounding_status_present_on_rule_based_only_fallback():
    # No AI models and no LLM at all -> earliest return path in intelligent_suggest.
    assistant = DiagnosticAssistant()
    assistant.llm_provider = None
    result = run(assistant.intelligent_suggest(symptoms=["fever", "cough"]))

    assert result["grounding_status"] == "not_attempted"
    assert result["source"] == "rule_based_only"
