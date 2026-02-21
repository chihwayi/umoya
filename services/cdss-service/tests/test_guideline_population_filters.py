import asyncio
from types import SimpleNamespace

import main


def test_build_guideline_population_filters_prioritizes_pregnancy():
    filters = main._build_guideline_population_filters(
        {"gender": "female", "age": 29, "is_pregnant": True}
    )
    assert filters == {"target_population": "pregnant_women"}


def test_build_guideline_population_filters_child_and_male_cases():
    assert main._build_guideline_population_filters({"age": 10}) == {"target_population": "children"}
    assert main._build_guideline_population_filters({"gender": "male"}) == {
        "target_population": {"$ne": "pregnant_women"}
    }


def test_filter_guideline_citations_excludes_pregnancy_for_male_context():
    citations = [
        {"source": "Pregnancy", "text": "maternal care", "metadata": {"target_population": "pregnant_women"}},
        {"source": "General", "text": "adult care", "metadata": {"target_population": "adults"}},
    ]
    filtered = main._filter_guideline_citations_by_population(citations, {"gender": "male", "age": 42})
    assert len(filtered) == 1
    assert filtered[0]["source"] == "General"


def test_guideline_search_applies_population_filters(monkeypatch):
    class _DummyRag:
        def __init__(self):
            self.last_filters = None

        def query(self, query, n_results=3, filters=None, tenant_id=None):
            self.last_filters = filters
            return [
                {"source": "Pregnancy", "text": "maternal guidance", "metadata": {"target_population": "pregnant_women"}},
                {"source": "Adult", "text": "general guidance", "metadata": {"target_population": "adults"}},
            ]

    rag = _DummyRag()
    monkeypatch.setattr(main, "diagnostic_assistant", SimpleNamespace(rag_engine=rag, llm_provider=None))

    req = SimpleNamespace(headers={"x-tenant-id": "tenant-a"}, state=SimpleNamespace())
    payload = main.GuidelineSearchRequest(query="hypertension", limit=5, patient_context={"gender": "male"})
    result = asyncio.run(main.search_guidelines(payload, req))

    assert rag.last_filters == {"target_population": {"$ne": "pregnant_women"}}
    assert result["applied_filters"] == {"target_population": {"$ne": "pregnant_women"}}
    assert all(
        str((c.get("metadata") or {}).get("target_population") or "").lower() != "pregnant_women"
        for c in result["citations"]
    )
