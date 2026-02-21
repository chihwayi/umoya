import os
import logging
from typing import Any, Dict, Optional

import psycopg2
from psycopg2.extras import Json
from envelope_crypto import EnvelopeCrypto

logger = logging.getLogger(__name__)


class SettingsProvider:
    """
    Minimal master-DB backed settings store for CDSS.
    Creates required tables if they don't exist and persists a single
    JSON document under key 'cdss_settings'.
    """

    def __init__(self) -> None:
        self.crypto = EnvelopeCrypto()
        self.conn = None
        self._connect()
        self._ensure_tables()

    def _connect(self) -> None:
        url = os.getenv("MASTER_DATABASE_URL")
        if url:
            self.conn = psycopg2.connect(url)
            self.conn.autocommit = True
            logger.info("Connected to master DB via MASTER_DATABASE_URL")
            return

        host = os.getenv("DB_HOST", "postgres-master")
        port = int(os.getenv("DB_PORT", "5432"))
        user = os.getenv("DB_USERNAME", "medicore")
        password = os.getenv("DB_PASSWORD", "medicore_password")
        database = os.getenv("POSTGRES_DB", "medicore")

        self.conn = psycopg2.connect(
            host=host, port=port, user=user, password=password, dbname=database
        )
        self.conn.autocommit = True
        logger.info(f"Connected to master DB at {host}:{port}/{database}")

    def _ensure_tables(self) -> None:
        with self.conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS system_settings (
                  key TEXT PRIMARY KEY,
                  value JSONB NOT NULL,
                  updated_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS cdss_admin_audit_logs (
                  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                  actor TEXT NOT NULL,
                  action TEXT NOT NULL,
                  payload JSONB,
                  created_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS cdss_encryption_keys (
                  key_id TEXT PRIMARY KEY,
                  provider TEXT NOT NULL,
                  key_fingerprint TEXT,
                  is_active BOOLEAN NOT NULL DEFAULT TRUE,
                  rotated_at TIMESTAMPTZ DEFAULT NOW(),
                  created_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS cdss_admin_jobs (
                  job_id TEXT PRIMARY KEY,
                  job_type TEXT NOT NULL,
                  status TEXT NOT NULL,
                  owner TEXT NOT NULL,
                  tenant_id TEXT NOT NULL,
                  attempt INTEGER NOT NULL DEFAULT 1,
                  max_attempts INTEGER NOT NULL DEFAULT 3,
                  retry_of TEXT,
                  payload JSONB,
                  result JSONB,
                  message TEXT,
                  dead_lettered BOOLEAN NOT NULL DEFAULT FALSE,
                  dead_letter_reason TEXT,
                  started_at TIMESTAMPTZ NOT NULL,
                  finished_at TIMESTAMPTZ,
                  created_at TIMESTAMPTZ DEFAULT NOW(),
                  updated_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS cdss_model_registry (
                  model_id TEXT PRIMARY KEY,
                  model_type TEXT NOT NULL,
                  provider TEXT NOT NULL,
                  version TEXT NOT NULL,
                  status TEXT NOT NULL DEFAULT 'active',
                  config JSONB NOT NULL DEFAULT '{}'::jsonb,
                  created_at TIMESTAMPTZ DEFAULT NOW(),
                  updated_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            # Tenant-specific configuration policies (e.g., AI enablement)
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS cdss_tenant_policies (
                  tenant_id TEXT PRIMARY KEY,
                  policy JSONB NOT NULL,
                  updated_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_cdss_model_registry_status ON cdss_model_registry(status);"
            )
            cur.execute(
                "ALTER TABLE cdss_admin_jobs ADD COLUMN IF NOT EXISTS dead_lettered BOOLEAN NOT NULL DEFAULT FALSE;"
            )
            cur.execute(
                "ALTER TABLE cdss_admin_jobs ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT;"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_cdss_admin_jobs_started_at ON cdss_admin_jobs(started_at DESC);"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_cdss_admin_jobs_status ON cdss_admin_jobs(status);"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_cdss_admin_jobs_type ON cdss_admin_jobs(job_type);"
            )
            if self.crypto.enabled:
                key_rows = self.crypto.key_metadata()
                for row in key_rows:
                    cur.execute(
                        """
                        INSERT INTO cdss_encryption_keys (key_id, provider, key_fingerprint, is_active, rotated_at)
                        VALUES (%s, %s, %s, %s, NOW())
                        ON CONFLICT (key_id) DO UPDATE
                          SET provider = EXCLUDED.provider,
                              key_fingerprint = EXCLUDED.key_fingerprint,
                              is_active = EXCLUDED.is_active,
                              rotated_at = CASE
                                WHEN cdss_encryption_keys.is_active IS DISTINCT FROM EXCLUDED.is_active
                                  THEN NOW()
                                ELSE cdss_encryption_keys.rotated_at
                              END;
                        """,
                        (
                            row.get("key_id"),
                            row.get("provider"),
                            row.get("key_fingerprint"),
                            bool(row.get("is_active")),
                        ),
                    )
            self._seed_model_registry(cur)

    def _seed_model_registry(self, cur) -> None:
        seeds = [
            ("rule_engine", "rules", "cdss", "2026.02", "active", {"always_on": True}),
            ("rag", "retrieval", "chromadb", "v1", "active", {"collection": "medical_guidelines"}),
            (
                "llm_primary",
                "llm",
                "ollama",
                os.getenv("LLM_MODEL_NAME", "unset"),
                "active",
                {"base_url": os.getenv("LLM_API_URL"), "model_name": os.getenv("LLM_MODEL_NAME", "unset")},
            ),
            (
                "llm_canary",
                "llm",
                "ollama",
                os.getenv("LLM_MODEL_NAME", "unset"),
                "disabled",
                {"base_url": os.getenv("LLM_API_URL"), "model_name": os.getenv("LLM_MODEL_NAME", "unset"), "canary_percent": 0},
            ),
            ("medbert_local", "classifier", "medbert", "local", "active", {}),
            ("clinicalbert_local", "classifier", "clinicalbert", "local", "active", {}),
            ("fusion_engine", "ensemble", "fusion", "local", "active", {}),
        ]
        for model_id, model_type, provider, version, status, config in seeds:
            cur.execute(
                """
                INSERT INTO cdss_model_registry (model_id, model_type, provider, version, status, config, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (model_id) DO UPDATE
                SET model_type = EXCLUDED.model_type,
                    provider = EXCLUDED.provider,
                    version = EXCLUDED.version,
                    status = EXCLUDED.status,
                    config = EXCLUDED.config,
                    updated_at = NOW();
                """,
                (model_id, model_type, provider, version, status, Json(config)),
            )

    def get_tenant_policy(self, tenant_id: str) -> Dict[str, Any]:
        """Retrieve the JSON policy associated with a tenant.
        Returns an empty dict if no policy exists.
        """
        if not tenant_id:
            return {}
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT policy FROM cdss_tenant_policies WHERE tenant_id = %s",
                (tenant_id,),
            )
            row = cur.fetchone()
            if not row:
                return {}
            return row[0] or {}

    def upsert_tenant_policy(self, tenant_id: str, policy: Dict[str, Any]) -> Dict[str, Any]:
        """Insert or update a tenant's policy."""
        if not tenant_id:
            raise ValueError("tenant_id is required")
        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO cdss_tenant_policies (tenant_id, policy, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (tenant_id) DO UPDATE
                  SET policy = EXCLUDED.policy,
                      updated_at = NOW();
                """,
                (tenant_id, Json(policy)),
            )
        return policy

    def get_settings(self) -> Dict[str, Any]:
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT value FROM system_settings WHERE key = %s",
                ("cdss_settings",),
            )
            row = cur.fetchone()
            if not row:
                defaults = {
                    "llm_enabled": os.getenv("LLM_ENABLED", "true").lower() == "true",
                    "llm_api_url": os.getenv("LLM_API_URL"),
                    "llm_model_name": os.getenv("LLM_MODEL_NAME"),
                    "llm_max_retries": int(os.getenv("LLM_MAX_RETRIES", "1")),
                    "rag_enabled": True,
                    "cache_ttl_seconds": 300,
                    "cache_namespace": "cdss",
                    "allow_pdf_uploads": True,
                    "copilot_transparency_enabled": True,
                    "copilot_input_allowlists": {
                        "symptoms": ["symptoms", "age", "gender"],
                        "vitals": [
                            "bloodPressure", "heartRate", "temperature", "oxygenSaturation",
                            "respiratoryRate", "weight", "height", "bmi", "painLevel", "bloodGlucose",
                            "age", "gender"
                        ],
                        "patient_data": ["age", "gender", "vitals", "labs", "conditions"],
                        "summary": ["clinical_notes", "age", "gender", "recent_vitals"],
                    },
                    "ai_min_confidence_score": 0.55,
                    "ai_require_citations": True,
                    "ai_min_citation_count": 1,
                    "ai_abstain_on_low_confidence": True,
                    "ai_contradiction_check_enabled": True,
                }
                try:
                    encrypted_payload = self.crypto.encrypt_json(defaults)
                    cur.execute(
                        """
                        INSERT INTO system_settings (key, value, updated_at)
                        VALUES (%s, %s, NOW())
                        ON CONFLICT (key) DO UPDATE
                        SET value = EXCLUDED.value, updated_at = NOW();
                        """,
                        ("cdss_settings", Json(encrypted_payload)),
                    )
                    try:
                        audit_payload = self.crypto.encrypt_json({"seed": True})
                        cur.execute(
                            """
                            INSERT INTO cdss_admin_audit_logs (actor, action, payload)
                            VALUES (%s, %s, %s);
                            """,
                            ("system", "init_defaults", Json(audit_payload)),
                        )
                    except Exception as e:
                        logger.warning(f"Failed to write default settings audit log: {e}")
                except Exception as e:
                    logger.warning(f"Failed to persist default settings: {e}")
                return defaults
            try:
                return self.crypto.decrypt_json(row[0])
            except Exception as e:
                logger.warning(f"Failed to decrypt settings; resetting to defaults: {e}")
                defaults = {
                    "llm_enabled": os.getenv("LLM_ENABLED", "true").lower() == "true",
                    "llm_api_url": os.getenv("LLM_API_URL"),
                    "llm_model_name": os.getenv("LLM_MODEL_NAME"),
                    "llm_max_retries": int(os.getenv("LLM_MAX_RETRIES", "1")),
                    "rag_enabled": True,
                    "cache_ttl_seconds": 300,
                    "cache_namespace": "cdss",
                    "allow_pdf_uploads": True,
                    "copilot_transparency_enabled": True,
                    "copilot_input_allowlists": {
                        "symptoms": ["symptoms", "age", "gender"],
                        "vitals": [
                            "bloodPressure", "heartRate", "temperature", "oxygenSaturation",
                            "respiratoryRate", "weight", "height", "bmi", "painLevel", "bloodGlucose",
                            "age", "gender"
                        ],
                        "patient_data": ["age", "gender", "vitals", "labs", "conditions"],
                        "summary": ["clinical_notes", "age", "gender", "recent_vitals"],
                    },
                    "ai_min_confidence_score": 0.55,
                    "ai_require_citations": True,
                    "ai_min_citation_count": 1,
                    "ai_abstain_on_low_confidence": True,
                    "ai_contradiction_check_enabled": True,
                }
                try:
                    encrypted_payload = self.crypto.encrypt_json(defaults)
                    cur.execute(
                        """
                        INSERT INTO system_settings (key, value, updated_at)
                        VALUES (%s, %s, NOW())
                        ON CONFLICT (key) DO UPDATE
                        SET value = EXCLUDED.value, updated_at = NOW();
                        """,
                        ("cdss_settings", Json(encrypted_payload)),
                    )
                    try:
                        audit_payload = self.crypto.encrypt_json({"reset": True})
                        cur.execute(
                            """
                            INSERT INTO cdss_admin_audit_logs (actor, action, payload)
                            VALUES (%s, %s, %s);
                            """,
                            ("system", "reset_defaults", Json(audit_payload)),
                        )
                    except Exception as e2:
                        logger.warning(f"Failed to write reset settings audit log: {e2}")
                except Exception as e2:
                    logger.warning(f"Failed to persist reset default settings: {e2}")
                return defaults

    def get_model_registry(self, active_only: bool = False) -> list[dict]:
        try:
            with self.conn.cursor() as cur:
                where = "WHERE status = 'active'" if active_only else ""
                cur.execute(
                    f"""
                    SELECT model_id, model_type, provider, version, status, config, updated_at
                    FROM cdss_model_registry
                    {where}
                    ORDER BY model_type, model_id;
                    """
                )
                rows = cur.fetchall()
                out: list[dict] = []
                for r in rows:
                    model_id, model_type, provider, version, status, config, updated_at = r
                    out.append(
                        {
                            "model_id": model_id,
                            "model_type": model_type,
                            "provider": provider,
                            "version": version,
                            "status": status,
                            "config": config or {},
                            "updated_at": updated_at.isoformat() if hasattr(updated_at, "isoformat") else str(updated_at),
                        }
                    )
                return out
        except Exception as e:
            logger.warning(f"Failed to fetch model registry: {e}")
            return []

    def get_active_model_registry_map(self) -> Dict[str, Any]:
        rows = self.get_model_registry(active_only=True)
        out: Dict[str, Any] = {}
        for row in rows:
            out[row.get("model_id")] = {
                "model_type": row.get("model_type"),
                "provider": row.get("provider"),
                "version": row.get("version"),
                "status": row.get("status"),
                "config": row.get("config") or {},
            }
        return out

    def get_runtime_model_registry_map(self) -> Dict[str, Any]:
        rows = self.get_model_registry(active_only=False)
        out: Dict[str, Any] = {}
        for row in rows:
            status = str(row.get("status") or "").lower()
            if status not in ("active", "canary"):
                continue
            out[row.get("model_id")] = {
                "model_type": row.get("model_type"),
                "provider": row.get("provider"),
                "version": row.get("version"),
                "status": row.get("status"),
                "config": row.get("config") or {},
            }
        return out

    def upsert_model_registry_entry(self, actor: str, entry: Dict[str, Any]) -> Dict[str, Any]:
        model_id = str(entry.get("model_id") or "").strip()
        if not model_id:
            raise ValueError("model_id is required")

        model_type = str(entry.get("model_type") or "custom").strip()
        provider = str(entry.get("provider") or "custom").strip()
        version = str(entry.get("version") or "unknown").strip()
        status = str(entry.get("status") or "active").strip().lower()
        if status not in ("active", "canary", "disabled"):
            raise ValueError("status must be one of: active, canary, disabled")
        config = entry.get("config") if isinstance(entry.get("config"), dict) else {}

        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO cdss_model_registry (model_id, model_type, provider, version, status, config, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (model_id) DO UPDATE
                SET model_type = EXCLUDED.model_type,
                    provider = EXCLUDED.provider,
                    version = EXCLUDED.version,
                    status = EXCLUDED.status,
                    config = EXCLUDED.config,
                    updated_at = NOW();
                """,
                (model_id, model_type, provider, version, status, Json(config)),
            )
        self.log_action(actor=actor, action="model_registry_upsert", payload={"model_id": model_id, "status": status})
        return {
            "model_id": model_id,
            "model_type": model_type,
            "provider": provider,
            "version": version,
            "status": status,
            "config": config,
        }

    def set_settings(self, settings: Dict[str, Any], actor: str, action: str) -> Dict[str, Any]:
        # Merge with existing
        current = self.get_settings()
        merged = {**current, **settings}
        with self.conn.cursor() as cur:
            encrypted_payload = self.crypto.encrypt_json(merged)
            cur.execute(
                """
                INSERT INTO system_settings (key, value, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (key) DO UPDATE
                SET value = EXCLUDED.value, updated_at = NOW();
                """,
                ("cdss_settings", Json(encrypted_payload)),
            )
            # Audit
            try:
                audit_payload = self.crypto.encrypt_json(settings)
                cur.execute(
                    """
                    INSERT INTO cdss_admin_audit_logs (actor, action, payload)
                    VALUES (%s, %s, %s);
                    """,
                    (actor, action, Json(audit_payload)),
                )
            except Exception as e:
                logger.warning(f"Failed to write audit log: {e}")
        return merged

    def log_action(self, actor: str, action: str, payload: Optional[Dict[str, Any]] = None) -> None:
        try:
            with self.conn.cursor() as cur:
                audit_payload = self.crypto.encrypt_json(payload or {})
                cur.execute(
                    """
                    INSERT INTO cdss_admin_audit_logs (actor, action, payload)
                    VALUES (%s, %s, %s);
                    """,
                    (actor, action, Json(audit_payload)),
                )
        except Exception as e:
            logger.warning(f"Failed to write audit log: {e}")

    def get_audit_logs(
        self,
        limit: int = 50,
        offset: int = 0,
        actor: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        sort_key: str = "created_at",
        sort_dir: str = "DESC",
    ) -> list[dict]:
        try:
            with self.conn.cursor() as cur:
                allowed_sort_keys = {"created_at", "actor", "action"}
                sk = sort_key if sort_key in allowed_sort_keys else "created_at"
                sd = "ASC" if str(sort_dir).upper() == "ASC" else "DESC"
                conditions = []
                params = []
                if actor:
                    conditions.append("actor ILIKE %s")
                    params.append(f"%{actor}%")
                if action:
                    conditions.append("action ILIKE %s")
                    params.append(f"%{action}%")
                if start_date:
                    conditions.append("created_at >= %s")
                    params.append(start_date)
                if end_date:
                    conditions.append("created_at <= %s")
                    params.append(end_date)
                where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
                query = f"""
                    SELECT actor, action, payload, created_at
                    FROM cdss_admin_audit_logs
                    {where_clause}
                    ORDER BY {sk} {sd}
                    LIMIT %s OFFSET %s;
                """
                params.extend([limit, offset])
                cur.execute(query, params)
                rows = cur.fetchall()
                result = []
                for r in rows:
                    actor, action, payload, created_at = r
                    try:
                        payload = self.crypto.decrypt_json(payload)
                    except Exception:
                        payload = {"_error": "payload_decrypt_failed"}
                    result.append({
                        "actor": actor,
                        "action": action,
                        "payload": payload,
                        "created_at": created_at.isoformat() if hasattr(created_at, 'isoformat') else str(created_at)
                    })
                return result
        except Exception as e:
            logger.warning(f"Failed to fetch audit logs: {e}")
            return []

    def upsert_job(self, job: Dict[str, Any]) -> None:
        try:
            with self.conn.cursor() as cur:
                payload = self.crypto.encrypt_json(job.get("payload") or {})
                result = self.crypto.encrypt_json(job.get("result") or {}) if job.get("result") is not None else None
                cur.execute(
                    """
                    INSERT INTO cdss_admin_jobs (
                      job_id, job_type, status, owner, tenant_id,
                      attempt, max_attempts, retry_of, payload, result, message, dead_lettered, dead_letter_reason,
                      started_at, finished_at, created_at, updated_at
                    ) VALUES (
                      %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, NOW(), NOW()
                    )
                    ON CONFLICT (job_id) DO UPDATE SET
                      job_type = EXCLUDED.job_type,
                      status = EXCLUDED.status,
                      owner = EXCLUDED.owner,
                      tenant_id = EXCLUDED.tenant_id,
                      attempt = EXCLUDED.attempt,
                      max_attempts = EXCLUDED.max_attempts,
                      retry_of = EXCLUDED.retry_of,
                      payload = EXCLUDED.payload,
                      result = EXCLUDED.result,
                      message = EXCLUDED.message,
                      dead_lettered = EXCLUDED.dead_lettered,
                      dead_letter_reason = EXCLUDED.dead_letter_reason,
                      started_at = EXCLUDED.started_at,
                      finished_at = EXCLUDED.finished_at,
                      updated_at = NOW();
                    """,
                    (
                        job.get("jobId"),
                        job.get("type"),
                        job.get("status"),
                        job.get("owner"),
                        job.get("tenant_id", "public"),
                        int(job.get("attempt") or 1),
                        int(job.get("max_attempts") or 3),
                        job.get("retry_of"),
                        Json(payload),
                        Json(result) if result is not None else None,
                        job.get("message"),
                        bool(job.get("dead_lettered") or False),
                        job.get("dead_letter_reason"),
                        job.get("started_at"),
                        job.get("finished_at"),
                    ),
                )
        except Exception as e:
            logger.warning(f"Failed to upsert admin job: {e}")

    def get_jobs(self, limit: int = 50, job_type: Optional[str] = None, status: Optional[str] = None) -> list[dict]:
        try:
            with self.conn.cursor() as cur:
                conditions = []
                params: list[Any] = []
                if job_type:
                    conditions.append("job_type = %s")
                    params.append(job_type)
                if status:
                    conditions.append("status = %s")
                    params.append(status)
                where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
                params.append(max(1, min(limit, 200)))
                cur.execute(
                    f"""
                    SELECT
                      job_id, job_type, status, owner, tenant_id,
                      attempt, max_attempts, retry_of, payload, result, message,
                      dead_lettered, dead_letter_reason,
                      started_at, finished_at
                    FROM cdss_admin_jobs
                    {where_clause}
                    ORDER BY started_at DESC
                    LIMIT %s;
                    """,
                    params,
                )
                rows = cur.fetchall()
                out: list[dict] = []
                for r in rows:
                    (
                        job_id, jt, st, owner, tenant_id,
                        attempt, max_attempts, retry_of, payload, result, message,
                        dead_lettered, dead_letter_reason,
                        started_at, finished_at,
                    ) = r
                    try:
                        payload = self.crypto.decrypt_json(payload)
                    except Exception:
                        payload = {"_error": "payload_decrypt_failed"}
                    try:
                        result = self.crypto.decrypt_json(result) if result is not None else None
                    except Exception:
                        result = {"_error": "result_decrypt_failed"}
                    out.append(
                        {
                            "jobId": job_id,
                            "type": jt,
                            "status": st,
                            "owner": owner,
                            "tenant_id": tenant_id,
                            "attempt": attempt,
                            "max_attempts": max_attempts,
                            "retry_of": retry_of,
                            "payload": payload,
                            "result": result,
                            "message": message,
                            "dead_lettered": dead_lettered,
                            "dead_letter_reason": dead_letter_reason,
                            "started_at": started_at.isoformat() if hasattr(started_at, "isoformat") else str(started_at),
                            "finished_at": finished_at.isoformat() if hasattr(finished_at, "isoformat") else (str(finished_at) if finished_at else None),
                        }
                    )
                return out
        except Exception as e:
            logger.warning(f"Failed to fetch admin jobs: {e}")
            return []

    def get_job(self, job_id: str) -> Optional[dict]:
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                      job_id, job_type, status, owner, tenant_id,
                      attempt, max_attempts, retry_of, payload, result, message,
                      dead_lettered, dead_letter_reason,
                      started_at, finished_at
                    FROM cdss_admin_jobs
                    WHERE job_id = %s
                    LIMIT 1;
                    """,
                    (job_id,),
                )
                r = cur.fetchone()
                if not r:
                    return None
                (
                    job_id_v, jt, st, owner, tenant_id,
                    attempt, max_attempts, retry_of, payload, result, message,
                    dead_lettered, dead_letter_reason,
                    started_at, finished_at,
                ) = r
                try:
                    payload = self.crypto.decrypt_json(payload)
                except Exception:
                    payload = {"_error": "payload_decrypt_failed"}
                try:
                    result = self.crypto.decrypt_json(result) if result is not None else None
                except Exception:
                    result = {"_error": "result_decrypt_failed"}
                return {
                    "jobId": job_id_v,
                    "type": jt,
                    "status": st,
                    "owner": owner,
                    "tenant_id": tenant_id,
                    "attempt": attempt,
                    "max_attempts": max_attempts,
                    "retry_of": retry_of,
                    "payload": payload,
                    "result": result,
                    "message": message,
                    "dead_lettered": dead_lettered,
                    "dead_letter_reason": dead_letter_reason,
                    "started_at": started_at.isoformat() if hasattr(started_at, "isoformat") else str(started_at),
                    "finished_at": finished_at.isoformat() if hasattr(finished_at, "isoformat") else (str(finished_at) if finished_at else None),
                }
        except Exception as e:
            logger.warning(f"Failed to fetch admin job {job_id}: {e}")
            return None

    def reencrypt_payloads(self, per_table_limit: int = 500, dry_run: bool = False) -> Dict[str, Any]:
        """
        Re-encrypt encrypted JSON payloads that are still wrapped with a non-active key_id.
        This migrates existing ciphertext to the currently active key.
        """
        if not self.crypto.enabled:
            raise RuntimeError("Encryption is disabled; re-encryption is not applicable.")

        limit = max(1, min(int(per_table_limit or 500), 5000))
        active_key_id = self.crypto.key_id

        specs = [
            ("system_settings", "key", "value"),
            ("cdss_admin_audit_logs", "id", "payload"),
            ("cdss_admin_jobs", "job_id", "payload"),
            ("cdss_admin_jobs", "job_id", "result"),
        ]
        summary: Dict[str, Any] = {
            "active_key_id": active_key_id,
            "dry_run": bool(dry_run),
            "tables": {},
            "totals": {"scanned": 0, "reencrypted": 0, "errors": 0},
        }

        for table_name, id_col, json_col in specs:
            stats = self._reencrypt_column(
                table_name=table_name,
                id_col=id_col,
                json_col=json_col,
                active_key_id=active_key_id,
                limit=limit,
                dry_run=bool(dry_run),
            )
            summary["tables"][f"{table_name}.{json_col}"] = stats
            summary["totals"]["scanned"] += stats["scanned"]
            summary["totals"]["reencrypted"] += stats["reencrypted"]
            summary["totals"]["errors"] += stats["errors"]

        return summary

    def _reencrypt_column(
        self,
        *,
        table_name: str,
        id_col: str,
        json_col: str,
        active_key_id: str,
        limit: int,
        dry_run: bool,
    ) -> Dict[str, Any]:
        scanned = 0
        reencrypted = 0
        errors = 0

        with self.conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT {id_col}, {json_col}
                FROM {table_name}
                WHERE {json_col} IS NOT NULL
                  AND jsonb_typeof({json_col}) = 'object'
                  AND {json_col} ? '__enc_v1'
                  AND COALESCE({json_col}->'__enc_v1'->>'key_id', '') <> %s
                ORDER BY {id_col}
                LIMIT %s;
                """,
                (active_key_id, limit),
            )
            rows = cur.fetchall()

            for row_id, row_payload in rows:
                scanned += 1
                try:
                    decrypted = self.crypto.decrypt_json(row_payload)
                    updated = self.crypto.encrypt_json(decrypted)
                    if not dry_run:
                        cur.execute(
                            f"UPDATE {table_name} SET {json_col} = %s WHERE {id_col} = %s;",
                            (Json(updated), row_id),
                        )
                    reencrypted += 1
                except Exception as exc:
                    errors += 1
                    logger.warning(
                        "Failed to re-encrypt %s.%s row %s: %s",
                        table_name,
                        json_col,
                        row_id,
                        exc,
                    )

        return {
            "scanned": scanned,
            "reencrypted": reencrypted,
            "errors": errors,
            "dry_run": bool(dry_run),
        }

    def close(self) -> None:
        try:
            if self.conn:
                self.conn.close()
        except Exception:
            pass
