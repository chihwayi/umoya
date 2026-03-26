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


def test_extract_guideline_scope_filters_prefers_explicit_values():
    filters = main._extract_guideline_scope_filters(
        {"specialty": "radiology", "module": "follow_up_tracking"},
        specialty="pharmacy",
        module="medication_safety",
    )
    assert filters == {"specialty": "pharmacy", "module": "medication_safety"}


def test_extract_guideline_scope_filters_uses_patient_context_when_explicit_missing():
    filters = main._extract_guideline_scope_filters(
        {"specialty": "radiology", "module": "follow_up_tracking"},
    )
    assert filters == {"specialty": "radiology", "module": "follow_up_tracking"}


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


def test_guideline_search_applies_governed_scope_filters(monkeypatch):
    class _DummyRegistry:
        def __init__(self):
            self.calls = []

        def search(self, query, limit=5, specialty=None, module=None):
            self.calls.append(
                {
                    "query": query,
                    "limit": limit,
                    "specialty": specialty,
                    "module": module,
                }
            )
            return [
                {
                    "source": "Governed",
                    "text": "module-aware guidance",
                    "metadata": {"governed_source": True, "specialty": specialty, "module": module},
                }
            ]

    registry = _DummyRegistry()
    monkeypatch.setattr(main, "knowledge_registry", registry)
    monkeypatch.setattr(main, "diagnostic_assistant", SimpleNamespace(rag_engine=None, llm_provider=None))

    req = SimpleNamespace(headers={"x-tenant-id": "tenant-a"}, state=SimpleNamespace())
    payload = main.GuidelineSearchRequest(
        query="warfarin review",
        limit=4,
        patient_context={"specialty": "pharmacy", "module": "medication_safety"},
    )
    result = asyncio.run(main.search_guidelines(payload, req))

    assert registry.calls == [
        {
            "query": "warfarin review",
            "limit": 4,
            "specialty": "pharmacy",
            "module": "medication_safety",
        }
    ]
    assert result["applied_governed_filters"] == {"specialty": "pharmacy", "module": "medication_safety"}


def test_risk_calculate_applies_governed_scope_filters(monkeypatch):
    class _DummyRegistry:
        def __init__(self):
            self.calls = []

        def search(self, query, limit=5, specialty=None, module=None):
            self.calls.append(
                {
                    "query": query,
                    "limit": limit,
                    "specialty": specialty,
                    "module": module,
                }
            )
            return [
                {
                    "source": "Governed Registry",
                    "text": "frailty guidance",
                    "metadata": {"governed_source": True, "specialty": specialty, "module": module},
                }
            ]

    registry = _DummyRegistry()
    monkeypatch.setattr(main, "knowledge_registry", registry)
    monkeypatch.setattr(main, "diagnostic_assistant", SimpleNamespace(rag_engine=None, llm_provider=None))

    req = SimpleNamespace(headers={"x-tenant-id": "tenant-a"}, state=SimpleNamespace())
    payload = main.RiskScoreRequest(
        patient_id="patient-1",
        vitals={"age": 82, "gender": "female"},
        medications=[],
        diagnoses=["frailty syndrome"],
        context="frailty_assessment",
        specialty="geriatrics",
        module="frailty_and_cga",
        patient_context={"age": 82, "gender": "female"},
    )
    result = asyncio.run(main.calculate_risk_score(payload, req))

    assert registry.calls == [
        {
            "query": "frailty assessment",
            "limit": 3,
            "specialty": "geriatrics",
            "module": "frailty_and_cga",
        }
    ]
    assert result["applied_governed_filters"] == {"specialty": "geriatrics", "module": "frailty_and_cga"}
    assert result["governed_corpus_used"] is True


def test_care_gaps_detect_applies_governed_scope_filters(monkeypatch):
    class _DummyRegistry:
        def __init__(self):
            self.calls = []

        def search(self, query, limit=5, specialty=None, module=None):
            self.calls.append(
                {
                    "query": query,
                    "limit": limit,
                    "specialty": specialty,
                    "module": module,
                }
            )
            return [
                {
                    "source": "Governed Registry",
                    "text": "patient self-service follow-up guidance",
                    "metadata": {"governed_source": True, "specialty": specialty, "module": module},
                }
            ]

    class _DummyTrendEngine:
        def detect_care_gaps(self, patient_age, patient_gender, visit_history, diagnoses):
            return {
                "has_gaps": True,
                "gaps": [{"type": "follow_up", "description": "Follow-up needed"}],
                "recommendations": [],
            }

    registry = _DummyRegistry()
    monkeypatch.setattr(main, "knowledge_registry", registry)
    monkeypatch.setattr(main, "trend_analysis_engine", _DummyTrendEngine())

    result = asyncio.run(
        main.detect_care_gaps(
            {
                "patient_age": 44,
                "patient_gender": "female",
                "visit_history": [],
                "diagnoses": ["Hypertension"],
                "context": "patient_portal_health_insights",
                "specialty": "primary_care",
                "module": "patient_self_service",
                "patient_context": {"age": 44, "gender": "female"},
            }
        )
    )

    assert registry.calls == [
        {
            "query": "patient portal health insights",
            "limit": 3,
            "specialty": "primary_care",
            "module": "patient_self_service",
        }
    ]
    assert result["applied_governed_filters"] == {"specialty": "primary_care", "module": "patient_self_service"}
    assert result["governed_corpus_used"] is True
