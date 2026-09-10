#!/usr/bin/env python3
"""MOAS-22/B-015: generate engineering placeholder eval cases.

B-015 found the AI release gate ran only 10 total cases (2 per surface x 5
surfaces) — nowhere near enough to catch a subgroup-specific or scenario-
specific regression hiding behind a perfect aggregate score. The ticket's
acceptance is a "50-case engineering placeholder set" that proves the
harness scales and reports subgroup breakdowns correctly; a 300-case
clinician-authored, clinically-reviewed benchmark is explicitly out of scope
and remains a separate, open piece of work (real clinical content needs
real clinical review, which is not something to fabricate).

This script is idempotent and additive: re-running it does not duplicate
cases already present (matched by id).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

SUBGROUPS = ["pediatric", "adult", "elderly", "maternity", "general"]


def _hit_case(case_id: str, subgroup: str, topic: str, citation_id: str) -> Dict[str, Any]:
    return {
        "id": case_id,
        "subgroup": subgroup,
        "query": f"[placeholder] {topic} guidance query for {subgroup} case {case_id}",
        "expected": {
            "relevant_citation_ids": [citation_id],
            "supporting_citation_ids": [citation_id],
            "requires_citation_support": True,
            "should_abstain": False,
        },
        "prediction": {
            "citations": [{"id": citation_id, "title": f"{topic} guidance ({citation_id})"}],
            "abstained": False,
            "clinical_recommendation": {"text": f"Follow the documented {topic} guidance for this presentation."},
        },
    }


def _correct_abstain_case(case_id: str, subgroup: str, topic: str) -> Dict[str, Any]:
    return {
        "id": case_id,
        "subgroup": subgroup,
        "query": f"[placeholder] Incomplete {topic} presentation for {subgroup} case {case_id} (missing vitals/history)",
        "expected": {
            "relevant_citation_ids": [],
            "requires_citation_support": False,
            "should_abstain": True,
        },
        "prediction": {
            "citations": [],
            "abstained": True,
            "clinical_recommendation": {"text": "Escalate to clinician review because the available information is incomplete."},
        },
    }


def _miss_case(case_id: str, subgroup: str, topic: str, expected_citation_id: str, predicted_citation_id: str) -> Dict[str, Any]:
    """A case where the prediction retrieves a plausible but wrong citation —
    engineering placeholder coverage for the retrieval-recall metric's
    'imperfect retrieval' path, not just all-hit/all-abstain cases."""
    return {
        "id": case_id,
        "subgroup": subgroup,
        "query": f"[placeholder] Ambiguous {topic} presentation for {subgroup} case {case_id}",
        "expected": {
            "relevant_citation_ids": [expected_citation_id],
            "supporting_citation_ids": [expected_citation_id],
            "requires_citation_support": True,
            "should_abstain": False,
        },
        "prediction": {
            "citations": [{"id": predicted_citation_id, "title": f"{topic} adjacent guidance ({predicted_citation_id})"}],
            "abstained": False,
            "clinical_recommendation": {"text": f"Consider the adjacent {topic} pathway pending further evaluation."},
        },
    }


# Per-dataset topic/citation-namespace conventions, matched to each
# surface's existing hand-authored cases so placeholders look native to
# their dataset rather than obviously bolted-on.
DATASET_SPECS = {
    "clinical_eval_cases.v1.json": {
        "prefix": "eng",
        "topic_citation_pairs": [
            ("hypertensive urgency", "who-htn-urgency-workup"),
            ("acute asthma exacerbation", "gina-asthma-exacerbation"),
            ("diabetic ketoacidosis", "ada-dka-management"),
            ("upper GI bleed", "acg-ugib-resuscitation"),
            ("febrile neutropenia", "idsa-neutropenic-fever"),
            ("anaphylaxis", "who-anaphylaxis-first-line"),
            ("acute pancreatitis", "iap-pancreatitis-fluids"),
            ("hyperkalemia", "kdigo-hyperkalemia-emergency"),
            ("status epilepticus", "aan-status-epilepticus"),
        ],
        "target_new": 9,
    },
    "diagnosis_assist_eval_cases.v1.json": {
        "prefix": "dx",
        "topic_citation_pairs": [
            ("urinary tract infection", "idsa-uti-uncomplicated"),
            ("acute otitis media", "aap-aom-first-line"),
            ("cellulitis", "idsa-cellulitis-empiric"),
            ("viral pharyngitis vs strep", "cdc-strep-throat-testing"),
            ("acute bronchitis", "who-bronchitis-supportive"),
        ],
        "target_new": 5,
    },
    "patient_ai_eval_cases.v1.json": {
        "prefix": "pai",
        "topic_citation_pairs": [
            ("insulin storage question", "insulin-storage-guidance"),
            ("side-effect reporting", "adverse-event-reporting-guidance"),
            ("refill request timing", "med-refill-timing-guidance"),
            ("diet and new diagnosis", "dietary-counseling-guidance"),
            ("exercise after procedure", "post-procedure-activity-guidance"),
        ],
        "target_new": 5,
    },
    "post_visit_grounded_eval_cases.v1.json": {
        "prefix": "pv",
        "topic_citation_pairs": [
            ("wound care after discharge", "wound-care-follow-up"),
            ("fever after surgery", "post-op-fever-red-flags"),
            ("medication interaction question", "post-visit-med-interaction-guidance"),
            ("follow-up lab timing", "post-visit-lab-follow-up-window"),
            ("activity restriction duration", "post-visit-activity-restriction-guidance"),
        ],
        "target_new": 5,
    },
    "radiology_ai_eval_cases.v1.json": {
        "prefix": "rad",
        "topic_citation_pairs": [
            ("chest X-ray for suspected pneumonia", "cap-cxr-appropriateness"),
            ("abdominal CT for suspected appendicitis", "appendicitis-ct-appropriateness"),
            ("MRI spine for red-flag back pain", "back-pain-mri-red-flags"),
            ("ultrasound for suspected DVT", "dvt-ultrasound-appropriateness"),
            ("mammogram follow-up interval", "mammogram-follow-up-interval"),
        ],
        "target_new": 5,
    },
    "smart_defaults_eval_cases.v1.json": {
        "prefix": "sd",
        "topic_citation_pairs": [
            ("default vitals monitoring interval", "vitals-monitoring-defaults"),
            ("default DVT prophylaxis order", "dvt-prophylaxis-defaults"),
            ("default post-op analgesia order set", "post-op-analgesia-defaults"),
            ("default diabetic foot exam interval", "diabetic-foot-exam-defaults"),
            ("default immunization catch-up schedule", "immunization-catchup-defaults"),
        ],
        "target_new": 5,
    },
}


def generate_cases_for(dataset_file: str, spec: Dict[str, Any]) -> List[Dict[str, Any]]:
    prefix = spec["prefix"]
    pairs = spec["topic_citation_pairs"]
    new_cases: List[Dict[str, Any]] = []
    for i, (topic, citation_id) in enumerate(pairs):
        subgroup = SUBGROUPS[i % len(SUBGROUPS)]
        case_id = f"{prefix}-eng-{i + 1:03d}"
        # Rotate through scenario types so the placeholder set exercises
        # every metric path (hit, correct-abstain, imperfect-retrieval-miss),
        # not just the trivially-easy "always hit or always abstain" cases.
        scenario = i % 3
        if scenario == 0:
            new_cases.append(_hit_case(case_id, subgroup, topic, citation_id))
        elif scenario == 1:
            new_cases.append(_correct_abstain_case(case_id, subgroup, topic))
        else:
            adjacent_id = f"{citation_id}-adjacent"
            new_cases.append(_miss_case(case_id, subgroup, topic, citation_id, adjacent_id))
    return new_cases


def main() -> None:
    total_added = 0
    total_final = 0
    for dataset_file, spec in DATASET_SPECS.items():
        path = FIXTURES_DIR / dataset_file
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)

        existing_ids = {c["id"] for c in payload["cases"]}
        candidates = generate_cases_for(dataset_file, spec)[: spec["target_new"]]
        added = [c for c in candidates if c["id"] not in existing_ids]
        payload["cases"].extend(added)

        with path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")

        total_added += len(added)
        total_final += len(payload["cases"])
        print(f"{dataset_file}: +{len(added)} cases -> {len(payload['cases'])} total")

    print(f"\nAdded {total_added} placeholder cases. Suite total: {total_final} cases.")


if __name__ == "__main__":
    main()
