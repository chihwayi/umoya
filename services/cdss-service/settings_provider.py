import os
import json
import logging
from typing import Any, Dict, Optional

import psycopg2
from psycopg2.extras import Json

logger = logging.getLogger(__name__)


class SettingsProvider:
    """
    Minimal master-DB backed settings store for CDSS.
    Creates required tables if they don't exist and persists a single
    JSON document under key 'cdss_settings'.
    """

    def __init__(self) -> None:
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
            return row[0]

    def set_settings(self, settings: Dict[str, Any], actor: str, action: str) -> Dict[str, Any]:
        # Merge with existing
        current = self.get_settings()
        merged = {**current, **settings}
        with self.conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO system_settings (key, value, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (key) DO UPDATE
                SET value = EXCLUDED.value, updated_at = NOW();
                """,
                ("cdss_settings", Json(merged)),
            )
            # Audit
            try:
                cur.execute(
                    """
                    INSERT INTO cdss_admin_audit_logs (actor, action, payload)
                    VALUES (%s, %s, %s);
                    """,
                    (actor, action, Json(settings)),
                )
            except Exception as e:
                logger.warning(f"Failed to write audit log: {e}")
        return merged

    def log_action(self, actor: str, action: str, payload: Optional[Dict[str, Any]] = None) -> None:
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO cdss_admin_audit_logs (actor, action, payload)
                    VALUES (%s, %s, %s);
                    """,
                    (actor, action, Json(payload or {})),
                )
        except Exception as e:
            logger.warning(f"Failed to write audit log: {e}")

    def get_audit_logs(self, limit: int = 50, offset: int = 0) -> list[dict]:
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT actor, action, payload, created_at
                    FROM cdss_admin_audit_logs
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s;
                    """,
                    (limit, offset),
                )
                rows = cur.fetchall()
                result = []
                for r in rows:
                    actor, action, payload, created_at = r
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
