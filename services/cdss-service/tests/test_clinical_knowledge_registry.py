import asyncio
import json
from types import SimpleNamespace

import main
from clinical_knowledge_registry import ClinicalKnowledgeRegistry


def test_registry_returns_source_version_and_freshness(tmp_path):
    payload = [
        {
            "knowledge_id": "guideline-1",
            "condition": "hypertension",
            "title": "Hypertension Guidance",
            "source_name": "Governed Registry",
            "source_version": "2026.01",
            "source_published_at": "2026-01-01",
            "reviewed_at": "2026-03-01",
            "specialty": "primary_care",
            "module": "chronic_care",
            "local_adaptation": True,
            "evidence_level": "high",
            "recommendation_blocks": ["Treat persistent hypertension."],
            "contraindications": [],
            "medication_warnings": [],
        }
    ]
    (tmp_path / "guidelines.json").write_text(json.dumps(payload), encoding="utf-8")

    registry = ClinicalKnowledgeRegistry(knowledge_dir=str(tmp_path))
    result = registry.check_guidelines("hypertension")

    assert result["source"] == "governed_clinical_knowledge"
    assert result["knowledge_metadata"]["source_version"] == "2026.01"
    assert result["knowledge_metadata"]["freshness"]["status"] == "current"
    assert result["abstained"] is False


def test_registry_stale_or_missing_guidance_lowers_confidence(tmp_path):
    stale_payload = [
        {
            "knowledge_id": "guideline-2",
            "condition": "uti",
            "title": "UTI Guidance",
            "source_name": "Governed Registry",
            "source_version": "2023.05",
            "source_published_at": "2023-05-01",
            "reviewed_at": "2023-06-01",
            "specialty": "primary_care",
            "module": "infectious_disease",
            "local_adaptation": False,
            "evidence_level": "moderate",
            "recommendation_blocks": ["Use local susceptibility data when selecting therapy."],
            "contraindications": [],
            "medication_warnings": [],
        }
    ]
    (tmp_path / "guidelines.json").write_text(json.dumps(stale_payload), encoding="utf-8")

    registry = ClinicalKnowledgeRegistry(knowledge_dir=str(tmp_path))
    stale_result = registry.check_guidelines("uti")
    missing_result = registry.check_guidelines("rare_unknown_condition")

    assert stale_result["knowledge_metadata"]["freshness"]["status"] == "stale"
    assert stale_result["knowledge_metadata"]["confidence"] == "low"
    assert missing_result["abstained"] is True
    assert missing_result["knowledge_metadata"]["fallback_used"] is True
    assert missing_result["knowledge_metadata"]["confidence"] == "low"


def test_registry_uses_active_release_manifest_and_reports_status(tmp_path):
    payload = [
        {
            "knowledge_id": "guideline-3",
            "condition": "asthma",
            "title": "Asthma Guidance",
            "source_name": "Governed Registry",
            "source_version": "2026.02",
            "source_published_at": "2026-02-01",
            "reviewed_at": "2026-03-01",
            "specialty": "primary_care",
            "module": "respiratory_care",
            "local_adaptation": True,
            "evidence_level": "high",
            "recommendation_blocks": ["Step up inhaled corticosteroid therapy when control is poor."],
            "contraindications": [],
            "medication_warnings": [],
        }
    ]
    releases = [
        {
            "release_id": "release-1",
            "version": "2026.03.24.1",
            "status": "active",
            "released_at": "2026-03-24",
            "files": ["guidelines.json"],
        }
    ]
    (tmp_path / "guidelines.json").write_text(json.dumps(payload), encoding="utf-8")
    (tmp_path / "releases.json").write_text(json.dumps(releases), encoding="utf-8")

    registry = ClinicalKnowledgeRegistry(knowledge_dir=str(tmp_path))
    result = registry.check_guidelines("asthma")
    status = registry.get_registry_status()

    assert result["knowledge_metadata"]["release_id"] == "release-1"
    assert result["knowledge_metadata"]["release_version"] == "2026.03.24.1"
    assert status["manifest_present"] is True
    assert status["active_release"]["release_id"] == "release-1"
    assert status["document_count"] == 1


def test_guideline_search_prefers_governed_corpus(monkeypatch):
    class _DummyRegistry:
        def search(self, query, limit=5, specialty=None, module=None):
            return [
                {
                    "title": "Governed Hypertension Guidance",
                    "text": "Use the governed corpus first.",
                    "source": "Governed Registry",
                    "source_version": "2026.01",
                    "metadata": {"governed_source": True, "source_version": "2026.01"},
                    "score": 2.0,
                }
            ]

    class _DummyRag:
        def query(self, query, n_results=3, filters=None, tenant_id=None):
            return [
                {
                    "title": "Vector Result",
                    "text": "Secondary retrieval result.",
                    "source": "RAG Store",
                    "metadata": {"governed_source": False},
                    "score": 1.0,
                }
            ]

    original_registry = main.knowledge_registry
    original_assistant = main.diagnostic_assistant
    main.knowledge_registry = _DummyRegistry()
    main.diagnostic_assistant = SimpleNamespace(rag_engine=_DummyRag(), llm_provider=None)

    try:
        req = SimpleNamespace(headers={"x-tenant-id": "tenant-a"}, state=SimpleNamespace())
        payload = main.GuidelineSearchRequest(query="hypertension", limit=5, patient_context={"gender": "female"})
        result = asyncio.run(main.search_guidelines(payload, req))
        assert result["governed_corpus_used"] is True
        assert result["citations"][0]["source"] == "Governed Registry"
    finally:
        main.knowledge_registry = original_registry
        main.diagnostic_assistant = original_assistant


def test_knowledge_registry_status_endpoints(monkeypatch):
    original_registry = main.knowledge_registry
    fake_registry = SimpleNamespace(
        get_registry_status=lambda: {
            "manifest_present": True,
            "active_release": {"release_id": "release-1", "version": "2026.03.24.1"},
            "document_count": 4,
            "condition_count": 4,
            "module_count": 2,
            "modules": ["chronic_care", "respiratory_care"],
        },
        get_release_catalog=lambda: [
            {"release_id": "release-1", "version": "2026.03.24.1", "status": "active"}
        ],
    )
    main.knowledge_registry = fake_registry
    try:
        status = asyncio.run(main.knowledge_registry_status())
        releases = asyncio.run(main.knowledge_registry_releases())
        assert status["active_release"]["release_id"] == "release-1"
        assert releases["releases"][0]["version"] == "2026.03.24.1"
    finally:
        main.knowledge_registry = original_registry


def test_default_registry_covers_legacy_core_conditions():
    registry = ClinicalKnowledgeRegistry()

    for condition in [
        "hypertension",
        "diabetes_type2",
        "asthma",
        "copd",
        "heart_failure",
        "pneumonia",
        "uti",
    ]:
        result = registry.check_guidelines(condition)
        assert result["source"] == "governed_clinical_knowledge"
        assert result["knowledge_metadata"]["fallback_used"] is False


def test_default_registry_covers_high_risk_acute_care_conditions():
    registry = ClinicalKnowledgeRegistry()

    for condition in ["sepsis", "stroke", "diabetic_ketoacidosis", "hypertensive_emergency"]:
        result = registry.check_guidelines(condition)
        assert result["source"] == "governed_clinical_knowledge"
        assert result["knowledge_metadata"]["specialty"] == "acute_care"
        assert result["knowledge_metadata"]["fallback_used"] is False


def test_default_registry_reports_module_metadata():
    registry = ClinicalKnowledgeRegistry()
    result = registry.check_guidelines("antimicrobial_stewardship")
    status = registry.get_registry_status()

    assert result["knowledge_metadata"]["module"] == "medication_safety"
    assert "medication_safety" in status["modules"]
    assert status["module_count"] >= 1


def test_default_registry_covers_infectious_public_health_and_specialty_phrases():
    registry = ClinicalKnowledgeRegistry()

    for condition in [
        "malaria treatment protocol",
        "tuberculosis",
        "immunization catch-up schedule",
        "PEPFAR MER indicators PMTCT",
        "asthma step-up therapy GINA",
        "long-term oxygen therapy LTOT criteria",
        "dialysis adequacy Kt/V",
    ]:
        result = registry.check_guidelines(condition)
        assert result["source"] == "governed_clinical_knowledge"
        assert result["knowledge_metadata"]["fallback_used"] is False


def test_default_registry_covers_pediatrics_oncology_and_perioperative_phrases():
    registry = ClinicalKnowledgeRegistry()

    for condition in [
        "growth_assessment",
        "developmental_milestone_assessment",
        "oncology targeted therapy",
        "neutropenic fever oncology",
        "oncology survivorship care",
        "pre-anesthesia assessment",
        "postoperative pain management",
        "PONV prophylaxis",
    ]:
        result = registry.check_guidelines(condition)
        assert result["source"] == "governed_clinical_knowledge"
        assert result["knowledge_metadata"]["fallback_used"] is False


def test_default_registry_covers_neurology_mental_health_ntd_and_trials_phrases():
    registry = ClinicalKnowledgeRegistry()

    for condition in [
        "stroke triage",
        "seizure classification",
        "headache diagnosis",
        "mental health screening",
        "ntd screening",
        "clinical trial eligibility",
    ]:
        result = registry.check_guidelines(condition)
        assert result["source"] == "governed_clinical_knowledge"
        assert result["knowledge_metadata"]["fallback_used"] is False


def test_default_registry_covers_geriatrics_population_and_maternity_phrases():
    registry = ClinicalKnowledgeRegistry()

    for condition in [
        "frailty assessment",
        "fall risk",
        "chronic disease registry",
        "anc",
    ]:
        result = registry.check_guidelines(condition)
        assert result["source"] == "governed_clinical_knowledge"
        assert result["knowledge_metadata"]["fallback_used"] is False


def test_default_registry_covers_orchestrator_workflow_phrases():
    registry = ClinicalKnowledgeRegistry()

    for condition in [
        "patient portal health insights",
        "triage risk assessment",
        "vital sign surveillance",
    ]:
        result = registry.check_guidelines(condition)
        assert result["source"] == "governed_clinical_knowledge"
        assert result["knowledge_metadata"]["fallback_used"] is False


def test_default_registry_covers_specialty_risk_context_phrases():
    registry = ClinicalKnowledgeRegistry()

    for condition in [
        "malaria severity",
        "malaria contact risk",
        "tuberculosis contact",
        "ckd staging",
        "pmtct risk",
        "sofa score",
        "suicide risk",
        "cholera risk",
    ]:
        result = registry.check_guidelines(condition)
        assert result["source"] == "governed_clinical_knowledge"
        assert result["knowledge_metadata"]["fallback_used"] is False


def test_registry_search_prefers_requested_scope_when_available():
    registry = ClinicalKnowledgeRegistry()

    results = registry.search(
        "lung nodule",
        specialty="radiology",
        module="follow_up_tracking",
    )

    assert results
    assert all((item.get("metadata") or {}).get("module") == "follow_up_tracking" for item in results)
