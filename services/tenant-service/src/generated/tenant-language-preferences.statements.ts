export const TENANT_LANGUAGE_PREFS_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_LANGUAGE_PREFS_STATEMENTS: string[] = [

  `CREATE TABLE IF NOT EXISTS user_language_preferences (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL UNIQUE,
    preferred_language     TEXT NOT NULL DEFAULT 'en',
    -- ISO 639-1: 'en' | 'pt' | 'fr' | 'sw' | 'zu' | 'af' | 'sn' | 'nd'
    secondary_language     TEXT,
    -- fallback if key missing in primary language
    clinical_note_language TEXT NOT NULL DEFAULT 'en',
    -- language for AI-generated clinical notes
    ui_language            TEXT NOT NULL DEFAULT 'en',
    last_updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_user_lang_prefs_user ON user_language_preferences (user_id)`,

  -- Seed a system default row so the table is not empty after provision
  `INSERT INTO user_language_preferences (id, user_id, preferred_language, ui_language, last_updated_at)
   VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'en', 'en', NOW())
   ON CONFLICT (user_id) DO NOTHING`,

];
