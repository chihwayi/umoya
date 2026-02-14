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
            if self.crypto.enabled:
                cur.execute(
                    """
                    INSERT INTO cdss_encryption_keys (key_id, provider, key_fingerprint, is_active, rotated_at)
                    VALUES (%s, %s, %s, TRUE, NOW())
                    ON CONFLICT (key_id) DO UPDATE
                      SET provider = EXCLUDED.provider,
                          key_fingerprint = EXCLUDED.key_fingerprint,
                          is_active = TRUE,
                          rotated_at = NOW();
                    """,
                    (self.crypto.key_id, self.crypto.provider, self.crypto.key_fingerprint()),
                )

    def get_settings(self) -> Dict[str, Any]:
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT value FROM system_settings WHERE key = %s",
                ("cdss_settings",),
            )
            row = cur.fetchone()
            if not row:
                # Default baseline
                defaults = {
                    "llm_enabled": os.getenv("LLM_ENABLED", "true").lower() == "true",
                    "llm_api_url": os.getenv("LLM_API_URL"),
                    "llm_model_name": os.getenv("LLM_MODEL_NAME"),
                    "rag_enabled": True,
                    "cache_ttl_seconds": 300,
                    "cache_namespace": "cdss",
                    "allow_pdf_uploads": True,
                }
                self.set_settings(defaults, actor="system", action="init_defaults")
                return defaults
            return self.crypto.decrypt_json(row[0])

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

    def close(self) -> None:
        try:
            if self.conn:
                self.conn.close()
        except Exception:
            pass
