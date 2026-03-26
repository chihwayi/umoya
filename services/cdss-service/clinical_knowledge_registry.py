"""
Governed clinical knowledge registry.

This turns hardcoded guideline logic into a bounded fallback by loading
versioned first-party knowledge documents from disk and returning explicit
provenance/freshness metadata with every result.
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ClinicalKnowledgeRegistry:
    def __init__(
        self,
        knowledge_dir: Optional[str] = None,
        fallback_engine: Any = None,
        stale_after_days: int = 540,
    ) -> None:
        base_dir = Path(__file__).resolve().parent
        self.knowledge_dir = Path(knowledge_dir or (base_dir / "knowledge_registry"))
        self.fallback_engine = fallback_engine
        self.stale_after_days = stale_after_days
        self.entries: List[Dict[str, Any]] = []
        self.releases: List[Dict[str, Any]] = []
        self.active_release: Optional[Dict[str, Any]] = None
        self._load_entries()

    def _load_entries(self) -> None:
        self.entries = []
        self.releases = []
        self.active_release = None
        if not self.knowledge_dir.exists():
            logger.warning("Clinical knowledge registry directory does not exist: %s", self.knowledge_dir)
            return

        release_manifest = self.knowledge_dir / "releases.json"
        allowed_files: Optional[set[str]] = None
        if release_manifest.exists():
            try:
                release_payload = json.loads(release_manifest.read_text(encoding="utf-8"))
                self.releases = release_payload if isinstance(release_payload, list) else [release_payload]
                active = next(
                    (item for item in self.releases if str(item.get("status") or "").lower() == "active"),
                    None,
                )
                if active is None and self.releases:
                    active = self.releases[0]
                self.active_release = active
                if active and isinstance(active.get("files"), list):
                    allowed_files = {str(name) for name in active.get("files") if str(name).strip()}
            except Exception as exc:
                logger.warning("Failed to load clinical knowledge release manifest %s: %s", release_manifest, exc)

        for path in sorted(self.knowledge_dir.glob("*.json")):
            if path.name == "releases.json":
                continue
            if allowed_files is not None and path.name not in allowed_files:
                continue
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.warning("Failed to load clinical knowledge file %s: %s", path, exc)
                continue

            docs = payload if isinstance(payload, list) else [payload]
            for doc in docs:
                if not isinstance(doc, dict):
                    continue
                entry = dict(doc)
                entry["_file"] = path.name
                entry["_normalized_condition"] = self.normalize_condition(
                    str(entry.get("condition") or entry.get("knowledge_id") or "")
                )
                aliases = entry.get("aliases") or []
                entry["_normalized_aliases"] = [
                    self.normalize_condition(str(alias))
                    for alias in aliases
                    if str(alias or "").strip()
                ]
                if self.active_release:
                    entry["_release_id"] = self.active_release.get("release_id")
                    entry["_release_version"] = self.active_release.get("version")
                self.entries.append(entry)

        logger.info("Loaded %s governed clinical knowledge documents", len(self.entries))

    def normalize_condition(self, condition: str) -> str:
        raw = str(condition or "").strip()
        if not raw:
            return ""
        if self.fallback_engine and hasattr(self.fallback_engine, "normalize_condition"):
            try:
                return str(self.fallback_engine.normalize_condition(raw))
            except Exception:
                pass
        return raw.lower().replace(" ", "_")

    def _parse_date(self, raw: Any) -> Optional[date]:
        value = str(raw or "").strip()
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except Exception:
            try:
                return date.fromisoformat(value)
            except Exception:
                return None

    def _freshness(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        reviewed_at = self._parse_date(entry.get("reviewed_at") or entry.get("source_reviewed_at"))
        published_at = self._parse_date(entry.get("source_published_at"))
        today = datetime.now(timezone.utc).date()
        reference = reviewed_at or published_at
        if reference is None:
            return {
                "status": "unknown",
                "days_since_review": None,
                "is_stale": True,
            }

        days_since = (today - reference).days
        return {
            "status": "stale" if days_since > self.stale_after_days else "current",
            "days_since_review": days_since,
            "is_stale": days_since > self.stale_after_days,
        }

    def _normalize_scope_value(self, value: Any) -> Optional[str]:
        raw = str(value or "").strip().lower()
        return raw or None

    def _entry_matches_scope(
        self,
        entry: Dict[str, Any],
        specialty: Optional[str] = None,
        module: Optional[str] = None,
    ) -> bool:
        specialty_filter = self._normalize_scope_value(specialty)
        module_filter = self._normalize_scope_value(module)
        entry_specialty = self._normalize_scope_value(entry.get("specialty"))
        entry_module = self._normalize_scope_value(entry.get("module"))

        if specialty_filter and entry_specialty != specialty_filter:
            return False
        if module_filter and entry_module != module_filter:
            return False
        return True

    def _find_entry(
        self,
        condition: str,
        specialty: Optional[str] = None,
        module: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        normalized = self.normalize_condition(condition)
        if not normalized:
            return None

        scoped_entries = [entry for entry in self.entries if self._entry_matches_scope(entry, specialty=specialty, module=module)]
        entries = scoped_entries or self.entries

        for entry in entries:
            if entry.get("_normalized_condition") == normalized:
                return entry
        for entry in entries:
            if normalized in entry.get("_normalized_aliases", []):
                return entry
        for entry in entries:
            haystacks = [
                str(entry.get("title") or "").lower(),
                str(entry.get("condition") or "").lower(),
                " ".join(str(k).lower() for k in (entry.get("keywords") or [])),
            ]
            if any(normalized.replace("_", " ") in hay for hay in haystacks):
                return entry
        return None

    def check_guidelines(
        self,
        condition: str,
        patient_age: Optional[int] = None,
        patient_gender: Optional[str] = None,
        comorbidities: Optional[List[str]] = None,
        medications: Optional[List[str]] = None,
        specialty: Optional[str] = None,
        module: Optional[str] = None,
    ) -> Dict[str, Any]:
        entry = self._find_entry(condition, specialty=specialty, module=module)
        if entry:
            freshness = self._freshness(entry)
            contraindications: List[Dict[str, Any]] = []
            comorbidity_terms = [str(item or "").strip().lower() for item in (comorbidities or [])]
            for item in entry.get("contraindications") or []:
                if not isinstance(item, dict):
                    continue
                match_terms = [str(term).strip().lower() for term in (item.get("match_terms") or [])]
                if match_terms and not any(term in comorbidity_terms for term in match_terms):
                    continue
                contraindications.append(
                    {
                        "condition": item.get("label") or item.get("condition") or "clinical_factor",
                        "reason": item.get("reason") or "",
                        "severity": item.get("severity") or "moderate",
                    }
                )

            medication_warnings: List[str] = []
            medications_lower = [str(item or "").lower() for item in (medications or [])]
            for warning in entry.get("medication_warnings") or []:
                if not isinstance(warning, dict):
                    continue
                match_terms = [str(term).lower() for term in (warning.get("match_terms") or [])]
                if match_terms and not any(term in med for term in match_terms for med in medications_lower):
                    continue
                medication_warnings.append(str(warning.get("message") or warning.get("reason") or "").strip())

            recommendations = list(entry.get("recommendation_blocks") or [])
            if patient_age is not None and patient_age >= 65:
                recommendations.append("Consider age-related dose adjustments and polypharmacy review.")
            if patient_age is not None and patient_age < 18:
                recommendations.append("Confirm pediatric dosing and age-specific care pathway applicability.")
            if patient_gender and str(patient_gender).lower() in {"female", "f"} and patient_age and 15 <= patient_age <= 50:
                recommendations.append("Confirm pregnancy status when treatment choice could be pregnancy-sensitive.")

            source_name = str(entry.get("source_name") or "Governed Clinical Knowledge Registry")
            source_version = str(entry.get("source_version") or "unknown")
            confidence = "low" if freshness["is_stale"] else "high"

            return {
                "guidelines": [
                    {
                        "title": entry.get("title") or condition,
                        "source": source_name,
                        "source_version": source_version,
                        "condition": entry.get("_normalized_condition") or condition,
                        "reviewed_at": entry.get("reviewed_at"),
                        "specialty": entry.get("specialty"),
                    }
                ],
                "recommendations": recommendations,
                "contraindications": contraindications,
                "medication_warnings": medication_warnings,
                "evidence_level": entry.get("evidence_level") or ("low" if freshness["is_stale"] else "high"),
                "matched_condition": entry.get("_normalized_condition") or self.normalize_condition(condition),
                "knowledge_metadata": {
                    "knowledge_id": entry.get("knowledge_id"),
                    "release_id": entry.get("_release_id"),
                    "release_version": entry.get("_release_version"),
                    "source_name": source_name,
                    "source_version": source_version,
                        "source_published_at": entry.get("source_published_at"),
                    "reviewed_at": entry.get("reviewed_at"),
                    "specialty": entry.get("specialty"),
                    "module": entry.get("module"),
                    "requested_specialty": self._normalize_scope_value(specialty),
                    "requested_module": self._normalize_scope_value(module),
                    "local_adaptation": bool(entry.get("local_adaptation")),
                    "freshness": freshness,
                    "confidence": confidence,
                    "fallback_used": False,
                    "registry_file": entry.get("_file"),
                },
                "source": "governed_clinical_knowledge",
                "abstained": False,
                "abstain_reason": None,
            }

        fallback = self.fallback_engine.check_guidelines(
            condition=condition,
            patient_age=patient_age,
            patient_gender=patient_gender,
            comorbidities=comorbidities,
            medications=medications,
        ) if self.fallback_engine else {
            "guidelines": [],
            "recommendations": [f'No governed guideline found for "{condition}".'],
            "contraindications": [],
            "medication_warnings": [],
            "evidence_level": "unknown",
            "matched_condition": self.normalize_condition(condition),
        }

        abstained = len(fallback.get("guidelines") or []) == 0
        fallback["knowledge_metadata"] = {
            "knowledge_id": None,
            "release_id": self.active_release.get("release_id") if self.active_release else None,
            "release_version": self.active_release.get("version") if self.active_release else None,
            "source_name": "Legacy Clinical Guidelines Fallback",
            "source_version": "legacy-hardcoded",
            "source_published_at": None,
            "reviewed_at": None,
            "specialty": None,
            "module": None,
            "requested_specialty": self._normalize_scope_value(specialty),
            "requested_module": self._normalize_scope_value(module),
            "local_adaptation": False,
            "freshness": {"status": "fallback", "days_since_review": None, "is_stale": True},
            "confidence": "low",
            "fallback_used": True,
            "registry_file": None,
        }
        fallback["source"] = "legacy_guideline_fallback"
        fallback["abstained"] = abstained
        fallback["abstain_reason"] = "knowledge_missing" if abstained else None
        return fallback

    def search(
        self,
        query: str,
        limit: int = 5,
        specialty: Optional[str] = None,
        module: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        normalized_query = str(query or "").strip().lower()
        if not normalized_query:
            return []

        scoped_entries = [entry for entry in self.entries if self._entry_matches_scope(entry, specialty=specialty, module=module)]
        entries = scoped_entries or self.entries
        results: List[Dict[str, Any]] = []
        for entry in entries:
            score = 0.0
            title = str(entry.get("title") or "")
            condition = str(entry.get("condition") or "")
            keywords = [str(item).lower() for item in (entry.get("keywords") or [])]
            haystack = " ".join([title.lower(), condition.lower(), " ".join(keywords)])
            if normalized_query in title.lower():
                score += 2.0
            if normalized_query in condition.lower():
                score += 1.5
            if any(normalized_query in keyword for keyword in keywords):
                score += 1.0
            if score <= 0 and normalized_query not in haystack:
                continue

            freshness = self._freshness(entry)
            results.append(
                {
                    "title": title or condition or "Clinical guideline",
                    "text": "\n".join(entry.get("recommendation_blocks") or []),
                    "source": str(entry.get("source_name") or "Governed Clinical Knowledge Registry"),
                    "source_version": entry.get("source_version"),
                    "reviewed_at": entry.get("reviewed_at"),
                    "score": round(score + (0 if freshness["is_stale"] else 0.25), 2),
                    "knowledge_id": entry.get("knowledge_id"),
                    "release_id": entry.get("_release_id"),
                    "release_version": entry.get("_release_version"),
                    "metadata": {
                        "target_population": entry.get("target_population"),
                        "specialty": entry.get("specialty"),
                        "module": entry.get("module"),
                        "requested_specialty": self._normalize_scope_value(specialty),
                        "requested_module": self._normalize_scope_value(module),
                        "source_version": entry.get("source_version"),
                        "release_id": entry.get("_release_id"),
                        "release_version": entry.get("_release_version"),
                        "reviewed_at": entry.get("reviewed_at"),
                        "freshness_status": freshness["status"],
                        "governed_source": True,
                    },
                }
            )

        results.sort(key=lambda item: item.get("score", 0), reverse=True)
        return results[: max(1, limit)]

    def get_registry_status(self) -> Dict[str, Any]:
        conditions = sorted({entry.get("_normalized_condition") for entry in self.entries if entry.get("_normalized_condition")})
        modules = sorted({entry.get("module") for entry in self.entries if entry.get("module")})
        return {
            "knowledge_dir": str(self.knowledge_dir),
            "manifest_present": len(self.releases) > 0,
            "release_count": len(self.releases),
            "active_release": self.active_release,
            "document_count": len(self.entries),
            "condition_count": len(conditions),
            "module_count": len(modules),
            "modules": modules,
            "conditions": conditions,
        }

    def get_release_catalog(self) -> List[Dict[str, Any]]:
        return list(self.releases)
