# Post-Visit UX Parity Sprint Plan

**Goal:** Close the 3 UX gaps identified against postvisit.ai, plus lay API groundwork for the future patient mobile app.  
**Created:** 2026-03-07  
**Sprints:** 3 (Sprint 58, 59, 60)

---

## Table of Contents

- [Sprint 58 — Visit Recording Audio Storage & Playback](#sprint-58--visit-recording-audio-storage--playback)
- [Sprint 59 — Inline Clinical Entity Linking](#sprint-59--inline-clinical-entity-linking)
- [Sprint 60 — Per-Section Scoped "Ask" Q&A](#sprint-60--per-section-scoped-ask-qa)
- [Appendix A — Provisioning Checklist](#appendix-a--provisioning-checklist)
- [Appendix B — Mobile-App API Contract Summary](#appendix-b--mobile-app-api-contract-summary)

---

## Sprint 58 — Visit Recording Audio Storage & Playback

### Problem

After a visit is recorded and transcribed, the audio blob is discarded from memory. Neither the doctor workspace nor the patient companion portal can play it back. postvisit.ai shows a clean audio player so patients can re-listen to their visit.

### Goals

1. Persist the recording to object storage (MinIO/S3) after transcription.
2. Store the storage reference on `post_visit_sessions`.
3. Expose a time-limited signed-URL API for playback.
4. Add an audio player in the **Doctor Workspace** (so doctor can replay during review).
5. Expose a **patient-portal API** endpoint that returns a signed URL (groundwork for mobile app — no frontend implementation on patient side yet).

---

### Step 1: Database — Add audio columns to `post_visit_sessions`

#### 1.1 Migration file

**Create file:** `database/migrations/045-post-visit-audio-storage.sql`

```sql
-- Sprint 58: Post-visit audio recording storage
-- Adds columns to post_visit_sessions for persisting recorded audio

ALTER TABLE IF EXISTS post_visit_sessions
  ADD COLUMN IF NOT EXISTS recording_storage_key   VARCHAR(500),
  ADD COLUMN IF NOT EXISTS recording_bucket         VARCHAR(120)  DEFAULT 'post-visit-recordings',
  ADD COLUMN IF NOT EXISTS recording_mime_type       VARCHAR(60),
  ADD COLUMN IF NOT EXISTS recording_size_bytes      BIGINT,
  ADD COLUMN IF NOT EXISTS recording_duration_ms     INTEGER,
  ADD COLUMN IF NOT EXISTS recording_sha256          VARCHAR(64),
  ADD COLUMN IF NOT EXISTS recording_uploaded_at     TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN post_visit_sessions.recording_storage_key IS
  'Object storage key (path) for the recording file, e.g. tenant/<tenantId>/post-visit/<sessionId>/recording.webm';
COMMENT ON COLUMN post_visit_sessions.recording_bucket IS
  'Object storage bucket name';
```

#### 1.2 Provisioning bundle

**File to edit:** `services/tenant-service/src/services/database-provisioning.service.ts`

Inside `getProvisioningBundles()`, after the last post-visit bundle (currently `sprint57_...`), add:

```typescript
{
  id: 'sprint58_post_visit_audio_storage',
  label: 'Post-Visit Audio Storage',
  version: '2026.03.07',
  description: 'Adds recording storage columns to post_visit_sessions',
  statements: () => [
    `ALTER TABLE IF EXISTS post_visit_sessions
       ADD COLUMN IF NOT EXISTS recording_storage_key   VARCHAR(500),
       ADD COLUMN IF NOT EXISTS recording_bucket         VARCHAR(120)  DEFAULT 'post-visit-recordings',
       ADD COLUMN IF NOT EXISTS recording_mime_type       VARCHAR(60),
       ADD COLUMN IF NOT EXISTS recording_size_bytes      BIGINT,
       ADD COLUMN IF NOT EXISTS recording_duration_ms     INTEGER,
       ADD COLUMN IF NOT EXISTS recording_sha256          VARCHAR(64),
       ADD COLUMN IF NOT EXISTS recording_uploaded_at     TIMESTAMP WITH TIME ZONE;`,
  ],
},
```

#### 1.3 Provisioning script for existing tenants

**Create file:** `scripts/provision-sprint58-post-visit-audio-storage.ts`

Follow the exact pattern from `scripts/provision-sprint57-post-visit-intravisit-alerts.ts`:

```typescript
import { DataSource } from 'typeorm';

const BUNDLE_ID = 'sprint58_post_visit_audio_storage';
const BUNDLE_VERSION = '2026.03.07';

function getStatements(): string[] {
  return [
    `ALTER TABLE IF EXISTS post_visit_sessions
       ADD COLUMN IF NOT EXISTS recording_storage_key   VARCHAR(500),
       ADD COLUMN IF NOT EXISTS recording_bucket         VARCHAR(120)  DEFAULT 'post-visit-recordings',
       ADD COLUMN IF NOT EXISTS recording_mime_type       VARCHAR(60),
       ADD COLUMN IF NOT EXISTS recording_size_bytes      BIGINT,
       ADD COLUMN IF NOT EXISTS recording_duration_ms     INTEGER,
       ADD COLUMN IF NOT EXISTS recording_sha256          VARCHAR(64),
       ADD COLUMN IF NOT EXISTS recording_uploaded_at     TIMESTAMP WITH TIME ZONE;`,
  ];
}

async function applyToTenant(databaseName: string) {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'medicore',
    password: process.env.DB_PASSWORD || 'medicore_password',
    database: databaseName,
    synchronize: false,
  });
  await ds.initialize();
  try {
    await ds.query(`
      CREATE TABLE IF NOT EXISTS tenant_schema_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bundle_id VARCHAR(120) NOT NULL,
        version VARCHAR(40) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        applied_by VARCHAR(120) DEFAULT 'provision-script',
        UNIQUE(bundle_id)
      );
    `);
    const existing = await ds.query(
      `SELECT version FROM tenant_schema_versions WHERE bundle_id = $1`,
      [BUNDLE_ID],
    );
    if (existing.length > 0 && existing[0].version >= BUNDLE_VERSION) {
      console.log(`  [${databaseName}] already at ${existing[0].version} — skip`);
      return;
    }
    for (const stmt of getStatements()) {
      await ds.query(stmt);
    }
    await ds.query(
      `INSERT INTO tenant_schema_versions (bundle_id, version)
       VALUES ($1, $2)
       ON CONFLICT (bundle_id) DO UPDATE SET version = $2, applied_at = NOW()`,
      [BUNDLE_ID, BUNDLE_VERSION],
    );
    console.log(`  [${databaseName}] applied ${BUNDLE_ID}@${BUNDLE_VERSION}`);
  } finally {
    await ds.destroy();
  }
}

async function main() {
  const master = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'medicore',
    password: process.env.DB_PASSWORD || 'medicore_password',
    database: process.env.MASTER_DB || 'medicore_master',
    synchronize: false,
  });
  await master.initialize();
  const tenants = await master.query(
    `SELECT id, subdomain, "databaseName", database_name FROM tenants WHERE status = 'active'`,
  );
  await master.destroy();

  for (const t of tenants) {
    const dbName = t.databaseName || t.database_name;
    if (!dbName) { console.warn(`  [${t.subdomain}] no database name — skip`); continue; }
    await applyToTenant(dbName);
  }
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
```

**Run:** `npx ts-node scripts/provision-sprint58-post-visit-audio-storage.ts`

#### 1.4 Entity update

**File to edit:** `services/ehr-service/src/entities/post-visit-session.entity.ts`

Add columns after the existing `meta` column:

```typescript
@Column({ name: 'recording_storage_key', type: 'varchar', length: 500, nullable: true })
recordingStorageKey: string | null;

@Column({ name: 'recording_bucket', type: 'varchar', length: 120, nullable: true, default: 'post-visit-recordings' })
recordingBucket: string | null;

@Column({ name: 'recording_mime_type', type: 'varchar', length: 60, nullable: true })
recordingMimeType: string | null;

@Column({ name: 'recording_size_bytes', type: 'bigint', nullable: true })
recordingSizeBytes: number | null;

@Column({ name: 'recording_duration_ms', type: 'int', nullable: true })
recordingDurationMs: number | null;

@Column({ name: 'recording_sha256', type: 'varchar', length: 64, nullable: true })
recordingSha256: string | null;

@Column({ name: 'recording_uploaded_at', type: 'timestamp with time zone', nullable: true })
recordingUploadedAt: Date | null;
```

---

### Step 2: Backend — Audio upload service

#### 2.1 Create file storage helper (if not already existing for MinIO/S3)

**Check if exists:** `services/ehr-service/src/services/file-storage.service.ts`

If it does not exist, create it. If it already exists (used by document management), reuse it. The service needs these methods:

```typescript
// services/ehr-service/src/services/file-storage.service.ts

import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class FileStorageService {
  private client: S3Client;
  private defaultBucket: string;

  constructor() {
    this.client = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      region: process.env.MINIO_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      },
      forcePathStyle: true,
    });
    this.defaultBucket = process.env.MINIO_BUCKET || 'medicore';
  }

  async uploadBuffer(
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ key: string; bucket: string; size: number; sha256: string }> {
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    await this.client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }),
    );
    return { key, bucket, size: buffer.length, sha256 };
  }

  async getSignedDownloadUrl(bucket: string, key: string, expiresInSeconds = 900): Promise<string> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
```

If `FileStorageService` already exists, just make sure `uploadBuffer` and `getSignedDownloadUrl` methods exist.

#### 2.2 Modify PostVisitService — persist audio after transcription

**File to edit:** `services/ehr-service/src/services/post-visit.service.ts`

Find the method `transcribeSessionAudio` (or wherever the audio file is received). After the transcription succeeds:

```typescript
// After successful transcription, persist the audio file:
if (audioFile && audioFile.buffer) {
  const storageKey = `tenant/${tenantId}/post-visit/${sessionId}/recording${this.getExtension(audioFile.mimetype)}`;
  const bucket = 'post-visit-recordings';
  const uploadResult = await this.fileStorageService.uploadBuffer(
    bucket,
    storageKey,
    audioFile.buffer,
    audioFile.mimetype,
  );
  await sessionRepo.update(sessionId, {
    recordingStorageKey: uploadResult.key,
    recordingBucket: uploadResult.bucket,
    recordingMimeType: audioFile.mimetype,
    recordingSizeBytes: uploadResult.size,
    recordingSha256: uploadResult.sha256,
    recordingDurationMs: durationMs ?? null, // from transcription result if available
    recordingUploadedAt: new Date(),
  });
}
```

Add a private helper:

```typescript
private getExtension(mime: string): string {
  const map: Record<string, string> = {
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/mp3': '.mp3',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
  };
  return map[mime] || '.audio';
}
```

Inject `FileStorageService` into the constructor.

#### 2.3 New endpoint — get recording signed URL

**File to edit:** `services/ehr-service/src/controllers/post-visit.controller.ts`

Add this endpoint:

```typescript
@Get('sessions/:id/recording-url')
@Roles('doctor', 'nurse', 'admin')
async getSessionRecordingUrl(
  @Param('id') id: string,
  @Req() req: any,
): Promise<{ url: string; mimeType: string; durationMs: number | null } | { url: null }> {
  return this.postVisitService.getSessionRecordingUrl(id, req.tenantDb);
}
```

**File to edit:** `services/ehr-service/src/services/post-visit.service.ts`

Add method:

```typescript
async getSessionRecordingUrl(
  sessionId: string,
  tenantDb: DataSource,
): Promise<{ url: string; mimeType: string; durationMs: number | null } | { url: null }> {
  const repo = tenantDb.getRepository(PostVisitSession);
  const session = await repo.findOne({ where: { id: sessionId } });
  if (!session?.recordingStorageKey) {
    return { url: null };
  }
  const url = await this.fileStorageService.getSignedDownloadUrl(
    session.recordingBucket || 'post-visit-recordings',
    session.recordingStorageKey,
    900, // 15 min signed URL
  );
  return {
    url,
    mimeType: session.recordingMimeType || 'audio/webm',
    durationMs: session.recordingDurationMs,
  };
}
```

#### 2.4 Patient-portal API — recording URL (mobile-app groundwork)

**File to edit:** `services/ehr-service/src/controllers/patient-portal.controller.ts`

Add endpoint under the existing post-visit group:

```typescript
@Get('post-visit/sessions/:id/recording-url')
async getPatientRecordingUrl(
  @Param('id') id: string,
  @Req() req: any,
): Promise<{ url: string; mimeType: string; durationMs: number | null } | { url: null }> {
  // Verify session belongs to this patient and is published
  const session = await this.postVisitService.getSessionForPatient(id, req.patientId, req.tenantDb);
  if (!session || session.status !== 'published') {
    return { url: null };
  }
  return this.postVisitService.getSessionRecordingUrl(id, req.tenantDb);
}
```

Add helper in `PostVisitService`:

```typescript
async getSessionForPatient(
  sessionId: string,
  patientId: string,
  tenantDb: DataSource,
): Promise<PostVisitSession | null> {
  const repo = tenantDb.getRepository(PostVisitSession);
  return repo.findOne({ where: { id: sessionId, patientId } });
}
```

---

### Step 3: Frontend — Doctor Workspace audio player

**File to edit:** `ehr-frontend/src/pages/PostVisitDoctorWorkspace.tsx`

#### 3.1 Add state

```typescript
const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
const [recordingMime, setRecordingMime] = useState<string>('audio/webm');
```

#### 3.2 Fetch recording URL when a session is selected

Inside the session-detail-loading effect (where `summaryPayload` etc. are fetched), add:

```typescript
// Fetch recording URL
try {
  const rec = await ehrApi.getPostVisitRecordingUrl(selectedSessionId, token, tenantSlug);
  setRecordingUrl(rec?.url ?? null);
  setRecordingMime(rec?.mimeType ?? 'audio/webm');
} catch { setRecordingUrl(null); }
```

#### 3.3 Add API helper

**File to edit:** `ehr-frontend/src/services/ehr-api.ts` (or wherever `ehrApi` methods are)

```typescript
async getPostVisitRecordingUrl(sessionId: string, token: string, tenantSlug: string) {
  const res = await fetch(
    `${EHR_API_URL}/post-visit/sessions/${sessionId}/recording-url`,
    { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantSlug } },
  );
  return res.json();
}
```

#### 3.4 Render audio player

In the session detail area (near the transcript/diarization section), add:

```tsx
{recordingUrl && (
  <div className="bg-white rounded-xl border p-4 mb-4">
    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
      <span>🎙️</span> Visit Recording
    </h4>
    <audio controls preload="metadata" className="w-full">
      <source src={recordingUrl} type={recordingMime} />
      Your browser does not support audio playback.
    </audio>
  </div>
)}
```

---

### Step 4: Patient-portal API helper (mobile-app groundwork only)

**File to edit:** `ehr-frontend/src/services/patient-portal-api.ts` (or wherever `patientPortalApi` methods are)

Add for future mobile consumption:

```typescript
async getPostVisitRecordingUrl(sessionId: string, token: string, tenantSlug: string) {
  const res = await fetch(
    `${EHR_API_URL}/patient-portal/post-visit/sessions/${sessionId}/recording-url`,
    { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantSlug } },
  );
  return res.json();
}
```

> **NOTE:** No UI changes in `PostVisitCompanionPortal.tsx` — the audio player for patients will ship with the mobile app. The API is ready.

---

### Step 5: Tests

1. **Backend unit test:** `services/ehr-service/src/controllers/post-visit.controller.spec.ts` — add test for `GET /post-visit/sessions/:id/recording-url` returning signed URL when recording exists and `{ url: null }` when it does not.
2. **Integration smoke test:** `qa/tests/post-visit-audio-storage-smoke.ts` — create session, transcribe with audio, verify recording columns populated, verify signed URL returns 200.

---

### Sprint 58 Checklist

- [ ] `database/migrations/045-post-visit-audio-storage.sql` created.
- [ ] Bundle `sprint58_post_visit_audio_storage` added to `database-provisioning.service.ts`.
- [ ] `scripts/provision-sprint58-post-visit-audio-storage.ts` created and tested.
- [ ] `PostVisitSession` entity updated with recording columns.
- [ ] `FileStorageService` exists and has `uploadBuffer` + `getSignedDownloadUrl`.
- [ ] `PostVisitService.transcribeSessionAudio` persists audio to object storage after transcription.
- [ ] `GET /post-visit/sessions/:id/recording-url` endpoint added (doctor/nurse/admin).
- [ ] `GET /patient-portal/post-visit/sessions/:id/recording-url` endpoint added (patient, published only).
- [ ] `PostVisitDoctorWorkspace` fetches and renders `<audio>` player.
- [ ] `patientPortalApi.getPostVisitRecordingUrl` helper created (for mobile app).
- [ ] Unit and smoke tests pass.

---

## Sprint 59 — Inline Clinical Entity Linking

### Problem

postvisit.ai underlines and links clinical terms (e.g. "chest pain", "ECG", "cardiac enzymes") throughout the summary text, making them interactive. MediCore extracts entities (in `post_visit_extracted_entities`) but renders summary text as plain text.

### Goals

1. Backend: expose an endpoint that returns summary text with entity annotation spans.
2. Frontend (Doctor Workspace): render annotated summary with entity highlights.
3. Patient-portal API: expose annotated summary (mobile-app groundwork — no patient frontend change).

---

### Step 1: Backend — Entity annotation service

No database changes required. Entities and drafts already exist.

#### 1.1 Create annotation utility

**Create file:** `services/ehr-service/src/utils/entity-annotation.ts`

This utility takes plain text and a list of extracted entities, and returns an array of annotated spans:

```typescript
export interface AnnotatedSpan {
  text: string;
  isEntity: boolean;
  entityId?: string;
  entityType?: string;
  entityValue?: string;
  normalizedValue?: Record<string, any>;
  confidence?: number;
  startIndex: number;
  endIndex: number;
}

export function annotateTextWithEntities(
  text: string,
  entities: Array<{
    id: string;
    entityType: string;
    entityValue: string;
    normalizedValue?: Record<string, any>;
    confidence?: number;
  }>,
): AnnotatedSpan[] {
  if (!text || !entities?.length) {
    return [{ text, isEntity: false, startIndex: 0, endIndex: text?.length ?? 0 }];
  }

  // Find all entity occurrences in the text (case-insensitive)
  const matches: Array<{ start: number; end: number; entity: typeof entities[0] }> = [];

  for (const entity of entities) {
    const searchTerm = entity.entityValue.toLowerCase();
    if (searchTerm.length < 2) continue; // skip very short matches
    const textLower = text.toLowerCase();
    let pos = 0;
    while (pos < textLower.length) {
      const idx = textLower.indexOf(searchTerm, pos);
      if (idx === -1) break;
      // Only match on word boundaries
      const before = idx === 0 || /\W/.test(text[idx - 1]);
      const after = idx + searchTerm.length >= text.length || /\W/.test(text[idx + searchTerm.length]);
      if (before && after) {
        matches.push({ start: idx, end: idx + searchTerm.length, entity });
      }
      pos = idx + 1;
    }
  }

  // Sort by start position, prefer longer matches
  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Remove overlaps (greedy: first/longest wins)
  const filtered: typeof matches = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  // Build spans
  const spans: AnnotatedSpan[] = [];
  let cursor = 0;
  for (const m of filtered) {
    if (m.start > cursor) {
      spans.push({ text: text.slice(cursor, m.start), isEntity: false, startIndex: cursor, endIndex: m.start });
    }
    spans.push({
      text: text.slice(m.start, m.end),
      isEntity: true,
      entityId: m.entity.id,
      entityType: m.entity.entityType,
      entityValue: m.entity.entityValue,
      normalizedValue: m.entity.normalizedValue,
      confidence: m.entity.confidence,
      startIndex: m.start,
      endIndex: m.end,
    });
    cursor = m.end;
  }
  if (cursor < text.length) {
    spans.push({ text: text.slice(cursor), isEntity: false, startIndex: cursor, endIndex: text.length });
  }

  return spans;
}
```

#### 1.2 New endpoint — annotated draft

**File to edit:** `services/ehr-service/src/controllers/post-visit.controller.ts`

```typescript
@Get('sessions/:id/draft/annotated')
@Roles('doctor', 'nurse', 'admin')
async getAnnotatedDraft(
  @Param('id') id: string,
  @Req() req: any,
) {
  return this.postVisitService.getAnnotatedDraft(id, req.tenantDb);
}
```

**File to edit:** `services/ehr-service/src/services/post-visit.service.ts`

```typescript
import { annotateTextWithEntities, AnnotatedSpan } from '../utils/entity-annotation';

async getAnnotatedDraft(sessionId: string, tenantDb: DataSource) {
  const artifactRepo = tenantDb.getRepository(PostVisitDraftArtifact);
  const entityRepo = tenantDb.getRepository(PostVisitExtractedEntity);

  const artifacts = await artifactRepo.find({ where: { sessionId } });
  const entities = await entityRepo.find({ where: { sessionId } });

  const entityList = entities.map((e) => ({
    id: e.id,
    entityType: e.entityType,
    entityValue: e.entityValue,
    normalizedValue: e.normalizedValue,
    confidence: e.confidence,
  }));

  const annotated = artifacts.map((artifact) => {
    const content = artifact.content || {};
    const annotatedContent: Record<string, AnnotatedSpan[] | any> = {};

    // Annotate known text fields in content
    for (const [key, value] of Object.entries(content)) {
      if (typeof value === 'string' && value.length > 10) {
        annotatedContent[key] = {
          raw: value,
          spans: annotateTextWithEntities(value, entityList),
        };
      } else if (Array.isArray(value)) {
        // For arrays of strings (e.g. key_points, checklist items)
        annotatedContent[key] = value.map((item: any) => {
          if (typeof item === 'string') {
            return { raw: item, spans: annotateTextWithEntities(item, entityList) };
          }
          if (typeof item === 'object' && item !== null && typeof item.text === 'string') {
            return { ...item, spans: annotateTextWithEntities(item.text, entityList) };
          }
          return item;
        });
      } else {
        annotatedContent[key] = value;
      }
    }

    return {
      id: artifact.id,
      artifactType: artifact.artifactType,
      artifactStatus: artifact.artifactStatus,
      content: annotatedContent,
      citations: artifact.citations,
      confidence: artifact.confidence,
    };
  });

  return {
    sessionId,
    entities: entityList,
    artifacts: annotated,
  };
}
```

#### 1.3 Patient-portal API — annotated summary (mobile-app groundwork)

**File to edit:** `services/ehr-service/src/controllers/patient-portal.controller.ts`

```typescript
@Get('post-visit/sessions/:id/summary/annotated')
async getPatientAnnotatedSummary(
  @Param('id') id: string,
  @Req() req: any,
) {
  const session = await this.postVisitService.getSessionForPatient(id, req.patientId, req.tenantDb);
  if (!session || session.status !== 'published') {
    throw new NotFoundException('Session not found or not published');
  }
  return this.postVisitService.getAnnotatedDraft(id, req.tenantDb);
}
```

---

### Step 2: Frontend — Annotated text renderer component

#### 2.1 Create reusable component

**Create file:** `ehr-frontend/src/components/AnnotatedText.tsx`

```tsx
import React, { useState } from 'react';

export interface AnnotatedSpan {
  text: string;
  isEntity: boolean;
  entityId?: string;
  entityType?: string;
  entityValue?: string;
  normalizedValue?: Record<string, any>;
  confidence?: number;
  startIndex: number;
  endIndex: number;
}

interface Props {
  spans: AnnotatedSpan[];
  onEntityClick?: (entity: AnnotatedSpan) => void;
}

const TYPE_COLORS: Record<string, string> = {
  symptom: 'bg-red-100 text-red-800 border-red-300',
  medication: 'bg-blue-100 text-blue-800 border-blue-300',
  condition: 'bg-amber-100 text-amber-800 border-amber-300',
  procedure: 'bg-purple-100 text-purple-800 border-purple-300',
  anatomy: 'bg-teal-100 text-teal-800 border-teal-300',
  lab_test: 'bg-green-100 text-green-800 border-green-300',
  default: 'bg-gray-100 text-gray-800 border-gray-300',
};

export const AnnotatedText: React.FC<Props> = ({ spans, onEntityClick }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <span>
      {spans.map((span, i) => {
        if (!span.isEntity) {
          return <span key={i}>{span.text}</span>;
        }
        const colorClass = TYPE_COLORS[span.entityType || ''] || TYPE_COLORS.default;
        const isHovered = hoveredId === span.entityId;
        return (
          <span
            key={i}
            className={`relative inline cursor-pointer rounded px-0.5 border-b-2 ${colorClass} ${isHovered ? 'ring-2 ring-offset-1' : ''}`}
            onMouseEnter={() => setHoveredId(span.entityId ?? null)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onEntityClick?.(span)}
            title={`${span.entityType}: ${span.entityValue}${span.confidence ? ` (${Math.round(span.confidence * 100)}%)` : ''}`}
          >
            {span.text}
            {isHovered && (
              <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap shadow-lg">
                {span.entityType} {span.confidence ? `· ${Math.round(span.confidence * 100)}%` : ''}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
};
```

#### 2.2 Use in PostVisitDoctorWorkspace

**File to edit:** `ehr-frontend/src/pages/PostVisitDoctorWorkspace.tsx`

1. Import: `import { AnnotatedText, AnnotatedSpan } from '../components/AnnotatedText';`
2. Add state: `const [annotatedDraft, setAnnotatedDraft] = useState<any>(null);`
3. Fetch annotated draft after session is selected:

```typescript
try {
  const ad = await ehrApi.getPostVisitAnnotatedDraft(selectedSessionId, token, tenantSlug);
  setAnnotatedDraft(ad);
} catch { setAnnotatedDraft(null); }
```

4. Add API helper:

**File to edit:** `ehr-frontend/src/services/ehr-api.ts`

```typescript
async getPostVisitAnnotatedDraft(sessionId: string, token: string, tenantSlug: string) {
  const res = await fetch(
    `${EHR_API_URL}/post-visit/sessions/${sessionId}/draft/annotated`,
    { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantSlug } },
  );
  return res.json();
}
```

5. Render annotated text in artifact sections. Wherever artifact content text is shown (e.g. `content.plain_language_summary`, `content.assessment`, `content.plan`, etc.), replace:

```tsx
// BEFORE:
<p>{content.plain_language_summary}</p>

// AFTER:
{annotatedDraft?.artifacts?.find((a: any) => a.artifactType === artifactType)
  ?.content?.plain_language_summary?.spans ? (
  <AnnotatedText
    spans={annotatedDraft.artifacts.find((a: any) => a.artifactType === artifactType).content.plain_language_summary.spans}
  />
) : (
  <p>{content.plain_language_summary}</p>
)}
```

Repeat for each text field rendered: `subjective`, `objective`, `assessment`, `plan`, `key_points` items, recommendation items, etc.

#### 2.3 Patient-portal API helper (mobile-app groundwork only)

**File to edit:** `ehr-frontend/src/services/patient-portal-api.ts`

```typescript
async getPostVisitAnnotatedSummary(sessionId: string, token: string, tenantSlug: string) {
  const res = await fetch(
    `${EHR_API_URL}/patient-portal/post-visit/sessions/${sessionId}/summary/annotated`,
    { headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantSlug } },
  );
  return res.json();
}
```

> **NOTE:** No UI changes in `PostVisitCompanionPortal.tsx`. The annotated summary will be consumed by the mobile app using this API.

---

### Step 3: Tests

1. **Unit test** for `annotateTextWithEntities`:
   - Input: `"Patient presents with chest pain and requests ECG"`
   - Entities: `[{ id: '1', entityType: 'symptom', entityValue: 'chest pain' }, { id: '2', entityType: 'procedure', entityValue: 'ECG' }]`
   - Assert: 5 spans (text, entity, text, entity, text) with correct indices and types.

2. **Backend test:** `GET /post-visit/sessions/:id/draft/annotated` returns annotated content with spans.

---

### Sprint 59 Checklist

- [ ] `services/ehr-service/src/utils/entity-annotation.ts` created with `annotateTextWithEntities`.
- [ ] `GET /post-visit/sessions/:id/draft/annotated` endpoint added.
- [ ] `GET /patient-portal/post-visit/sessions/:id/summary/annotated` endpoint added.
- [ ] `ehr-frontend/src/components/AnnotatedText.tsx` component created.
- [ ] `PostVisitDoctorWorkspace` fetches and renders annotated artifact text.
- [ ] `patientPortalApi.getPostVisitAnnotatedSummary` helper created (for mobile app).
- [ ] Unit tests for annotation utility pass.
- [ ] Integration smoke test pass.

---

## Sprint 60 — Per-Section Scoped "Ask" Q&A

### Problem

postvisit.ai has an "Ask" button on each summary section (Chief Complaint, Assessment, Plan, etc.) that lets the patient ask questions scoped to that specific section. MediCore has a general chat without section context.

### Goals

1. Backend: modify `answerPatientQuestion` to accept an optional `sectionContext` parameter that scopes the grounding to a specific artifact section.
2. Backend: new endpoint for section-scoped questions.
3. Frontend (Doctor Workspace): add "Ask about this section" per artifact section (for doctor use).
4. Patient-portal API: expose section-scoped question endpoint (mobile-app groundwork — no patient frontend change).

---

### Step 1: Backend — Section-scoped grounded answer

No database changes required.

#### 1.1 Modify grounded LLM input to support section scope

**File to edit:** `services/ehr-service/src/services/post-visit-grounded-llm.service.ts`

Add optional fields to `PostVisitPatientAnswerInput`:

```typescript
export interface PostVisitPatientAnswerInput {
  sessionId: string;
  language?: string;
  question: string;
  summary: string;
  checklist: string[];
  memoryFacts?: string[];
  citations: GroundingCitation[];
  // NEW: optional section scope
  sectionType?: string;    // e.g. 'chief_complaint', 'assessment', 'plan', 'hpi', 'physical_exam', 'recommendations'
  sectionContent?: string; // the raw text of that section
}
```

In the `answerPatientQuestion` method, modify the user message JSON construction. After the line that builds the JSON payload, add:

```typescript
const payload: Record<string, any> = {
  task: 'patient_grounded_answer',
  constraints: {
    max_answer_chars: 1200,
    cite_using_allowed_ids_only: true,
    use_plain_language: true,
    include_emergency_warning_when_urgent_signal: true,
  },
  session_id: input.sessionId,
  language: input.language || 'en',
  question: input.question,
  approved_summary: input.summary,
  approved_checklist: input.checklist,
  companion_memory_facts: input.memoryFacts?.slice(0, 8) || [],
  allowed_citations: input.citations,
  output_schema: {
    abstain: 'boolean',
    abstain_reason: 'string|null',
    answer: 'string',
    citations_used: 'string[]',
    urgent_signal: 'boolean',
  },
};

// Add section scope if provided
if (input.sectionType && input.sectionContent) {
  payload.section_scope = {
    section_type: input.sectionType,
    section_content: input.sectionContent,
    instruction: `Focus your answer on the "${input.sectionType}" section of the visit summary. The content of this section is provided in "section_content". Answer the question specifically in the context of this section. If the question is not related to this section, say so and provide context from the full summary instead.`,
  };
}
```

#### 1.2 New endpoint — section-scoped question (clinician)

**File to edit:** `services/ehr-service/src/controllers/post-visit.controller.ts`

```typescript
@Post('sessions/:id/ask-section')
@Roles('doctor', 'nurse', 'admin')
async askAboutSection(
  @Param('id') id: string,
  @Body() body: {
    question: string;
    sectionType: string;      // e.g. 'chief_complaint', 'assessment', 'plan'
    artifactType?: string;     // e.g. 'visit_summary', 'soap_note'
  },
  @Req() req: any,
) {
  return this.postVisitService.askAboutSection(id, body, req.tenantDb);
}
```

**File to edit:** `services/ehr-service/src/services/post-visit.service.ts`

```typescript
async askAboutSection(
  sessionId: string,
  body: { question: string; sectionType: string; artifactType?: string },
  tenantDb: DataSource,
) {
  const artifactRepo = tenantDb.getRepository(PostVisitDraftArtifact);
  const entityRepo = tenantDb.getRepository(PostVisitExtractedEntity);

  // Find the artifact
  const targetType = body.artifactType || 'visit_summary';
  const artifact = await artifactRepo.findOne({
    where: { sessionId, artifactType: targetType },
  });
  if (!artifact) {
    return { answer: 'No summary artifact found for this session.', abstained: true };
  }

  // Extract section content from artifact
  const content = artifact.content || {};
  const sectionContent = this.extractSectionContent(content, body.sectionType);

  // Build full summary for context
  const fullSummary = typeof content.plain_language_summary === 'string'
    ? content.plain_language_summary
    : JSON.stringify(content);

  // Build checklist
  const checklist: string[] = [];
  const recArtifact = await artifactRepo.findOne({
    where: { sessionId, artifactType: 'recommendation_bundle' },
  });
  if (recArtifact?.content?.items) {
    for (const item of recArtifact.content.items) {
      checklist.push(typeof item === 'string' ? item : item.text || JSON.stringify(item));
    }
  }

  // Build citations
  const citations = (artifact.citations || []).map((c: any, i: number) => ({
    id: c.id || `cit-${i}`,
    label: c.label || c.source || `Citation ${i + 1}`,
    source: c.source || 'visit',
    excerpt: c.excerpt || '',
  }));

  const result = await this.groundedLlmService.answerPatientQuestion({
    sessionId,
    question: body.question,
    summary: fullSummary,
    checklist,
    citations,
    sectionType: body.sectionType,
    sectionContent,
  });

  return result || { answer: 'Unable to answer at this time.', abstained: true };
}

private extractSectionContent(content: Record<string, any>, sectionType: string): string {
  // Map section types to content keys
  const keyMap: Record<string, string[]> = {
    chief_complaint: ['chief_complaint', 'chiefComplaint'],
    hpi: ['history_of_present_illness', 'hpi', 'historyOfPresentIllness'],
    reported_symptoms: ['reported_symptoms', 'reportedSymptoms', 'symptoms'],
    physical_exam: ['physical_examination', 'physicalExamination', 'objective', 'physical_exam'],
    assessment: ['assessment'],
    plan: ['plan', 'treatment_plan', 'treatmentPlan'],
    recommendations: ['recommendations', 'items'],
    subjective: ['subjective'],
    objective: ['objective'],
    quick_summary: ['plain_language_summary', 'quick_summary', 'summary'],
    key_points: ['key_points', 'keyPoints'],
  };

  const keys = keyMap[sectionType] || [sectionType];
  for (const key of keys) {
    if (content[key]) {
      const val = content[key];
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return val.map((v: any) => typeof v === 'string' ? v : v.text || JSON.stringify(v)).join('\n');
      return JSON.stringify(val);
    }
  }
  return '';
}
```

#### 1.3 Patient-portal API — section-scoped question (mobile-app groundwork)

**File to edit:** `services/ehr-service/src/controllers/patient-portal.controller.ts`

```typescript
@Post('post-visit/sessions/:id/ask-section')
async patientAskAboutSection(
  @Param('id') id: string,
  @Body() body: { question: string; sectionType: string },
  @Req() req: any,
) {
  const session = await this.postVisitService.getSessionForPatient(id, req.patientId, req.tenantDb);
  if (!session || session.status !== 'published') {
    throw new NotFoundException('Session not found or not published');
  }
  return this.postVisitService.askAboutSection(
    id,
    { question: body.question, sectionType: body.sectionType },
    req.tenantDb,
  );
}
```

---

### Step 2: Frontend — "Ask about this" UI in Doctor Workspace

#### 2.1 Create section ask component

**Create file:** `ehr-frontend/src/components/SectionAskButton.tsx`

```tsx
import React, { useState } from 'react';

interface Props {
  sessionId: string;
  sectionType: string;
  sectionLabel: string;
  token: string;
  tenantSlug: string;
  onAnswer?: (answer: string) => void;
}

export const SectionAskButton: React.FC<Props> = ({
  sessionId, sectionType, sectionLabel, token, tenantSlug, onAnswer,
}) => {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer('');
    try {
      const res = await fetch(
        `${process.env.REACT_APP_EHR_API_URL}/post-visit/sessions/${sessionId}/ask-section`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Tenant-ID': tenantSlug,
          },
          body: JSON.stringify({ question, sectionType }),
        },
      );
      const data = await res.json();
      const ans = data?.answer || 'No answer available.';
      setAnswer(ans);
      onAnswer?.(ans);
    } catch {
      setAnswer('Failed to get answer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium transition"
        title={`Ask AI about ${sectionLabel}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Ask
      </button>

      {open && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 max-w-md">
          <p className="text-xs text-gray-500 mb-2">Ask about: <strong>{sectionLabel}</strong></p>
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              placeholder={`e.g. "What does this mean?"`}
              className="flex-1 text-sm border rounded px-2 py-1"
              disabled={loading}
            />
            <button
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="px-3 py-1 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? '...' : 'Ask'}
            </button>
          </div>
          {answer && (
            <div className="mt-2 p-2 bg-white rounded border text-sm text-gray-700">
              {answer}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

#### 2.2 Use in PostVisitDoctorWorkspace

**File to edit:** `ehr-frontend/src/pages/PostVisitDoctorWorkspace.tsx`

Import:

```typescript
import { SectionAskButton } from '../components/SectionAskButton';
```

Add `SectionAskButton` next to each section header in the draft view. For each artifact section header:

```tsx
// Example: Assessment section
<div className="flex items-center justify-between">
  <h4 className="font-semibold text-gray-800">Assessment</h4>
  {selectedSessionId && (
    <SectionAskButton
      sessionId={selectedSessionId}
      sectionType="assessment"
      sectionLabel="Assessment"
      token={token}
      tenantSlug={tenantSlug}
    />
  )}
</div>
```

Repeat for all sections that map to content keys:

| Section Label | `sectionType` value |
|---|---|
| Quick Summary | `quick_summary` |
| Chief Complaint | `chief_complaint` |
| History of Present Illness | `hpi` |
| Reported Symptoms | `reported_symptoms` |
| Physical Examination | `physical_exam` |
| Assessment | `assessment` |
| Plan | `plan` |
| Key Points | `key_points` |
| Subjective | `subjective` |
| Objective | `objective` |
| Recommendations | `recommendations` |

#### 2.3 Patient-portal API helper (mobile-app groundwork only)

**File to edit:** `ehr-frontend/src/services/patient-portal-api.ts`

```typescript
async askPostVisitSection(
  sessionId: string,
  question: string,
  sectionType: string,
  token: string,
  tenantSlug: string,
) {
  const res = await fetch(
    `${EHR_API_URL}/patient-portal/post-visit/sessions/${sessionId}/ask-section`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Tenant-ID': tenantSlug,
      },
      body: JSON.stringify({ question, sectionType }),
    },
  );
  return res.json();
}
```

> **NOTE:** No UI changes in `PostVisitCompanionPortal.tsx`. The per-section Ask for patients will ship with the mobile app. The API is ready.

---

### Step 3: Tests

1. **Unit test** for `extractSectionContent` — verify it resolves all key mappings.
2. **Backend test:** `POST /post-visit/sessions/:id/ask-section` with `{ question, sectionType }` returns answer.
3. **Patient-portal test:** `POST /patient-portal/post-visit/sessions/:id/ask-section` only works for published sessions and verified patient.

---

### Sprint 60 Checklist

- [ ] `PostVisitPatientAnswerInput` extended with `sectionType` and `sectionContent`.
- [ ] `answerPatientQuestion` LLM payload includes `section_scope` when provided.
- [ ] `extractSectionContent` helper added to `PostVisitService`.
- [ ] `POST /post-visit/sessions/:id/ask-section` endpoint added (doctor/nurse/admin).
- [ ] `POST /patient-portal/post-visit/sessions/:id/ask-section` endpoint added (patient, published only).
- [ ] `SectionAskButton` component created.
- [ ] `PostVisitDoctorWorkspace` renders `SectionAskButton` on all artifact sections.
- [ ] `patientPortalApi.askPostVisitSection` helper created (for mobile app).
- [ ] Unit and integration tests pass.

---

## Appendix A — Provisioning Checklist

Only Sprint 58 requires a database change. Here is the full provisioning flow:

### For existing tenants

```bash
npx ts-node scripts/provision-sprint58-post-visit-audio-storage.ts
```

### For new tenants

The bundle `sprint58_post_visit_audio_storage` in `getProvisioningBundles()` will run automatically when `applySchemaToTenant()` is called during tenant creation.

### Sprints 59 and 60

No database changes. No provisioning needed.

---

## Appendix B — Mobile-App API Contract Summary

These API endpoints are ready for the patient mobile app. No patient-side frontend changes were made; only the API + helpers exist.

### Sprint 58 — Audio Playback

```
GET /patient-portal/post-visit/sessions/:id/recording-url
Authorization: Bearer <patient-token>
X-Tenant-ID: <tenant-slug>

Response:
  { url: "<signed-url>", mimeType: "audio/webm", durationMs: 180000 }
  OR
  { url: null }
```

### Sprint 59 — Annotated Summary

```
GET /patient-portal/post-visit/sessions/:id/summary/annotated
Authorization: Bearer <patient-token>
X-Tenant-ID: <tenant-slug>

Response:
  {
    sessionId: "...",
    entities: [{ id, entityType, entityValue, normalizedValue, confidence }],
    artifacts: [{
      id, artifactType, artifactStatus,
      content: {
        plain_language_summary: {
          raw: "Patient presents with chest pain...",
          spans: [
            { text: "Patient presents with ", isEntity: false, startIndex: 0, endIndex: 22 },
            { text: "chest pain", isEntity: true, entityType: "symptom", entityId: "...", startIndex: 22, endIndex: 32 },
            ...
          ]
        },
        ...
      }
    }]
  }
```

### Sprint 60 — Section-Scoped Ask

```
POST /patient-portal/post-visit/sessions/:id/ask-section
Authorization: Bearer <patient-token>
X-Tenant-ID: <tenant-slug>
Content-Type: application/json

Body:
  { "question": "What does this mean?", "sectionType": "assessment" }

Response:
  {
    answer: "The assessment indicates...",
    citationsUsed: ["cit-1"],
    abstained: false,
    urgentSignal: false
  }
```

### Existing patient-portal endpoints (already implemented)

```
GET  /patient-portal/post-visit/sessions              — list published sessions
GET  /patient-portal/post-visit/sessions/:id/summary   — summary + checklist
GET  /patient-portal/post-visit/sessions/:id/messages   — companion messages
POST /patient-portal/post-visit/sessions/:id/messages   — send message
POST /patient-portal/post-visit/sessions/:id/acknowledgements — acknowledge
```

---

## Sprint Summary

| Sprint | Scope | DB Change | Files Modified | Files Created | Patient Frontend |
|--------|-------|-----------|----------------|---------------|-----------------|
| **58** | Audio storage & playback | Yes (ALTER `post_visit_sessions`) | `post-visit-session.entity.ts`, `post-visit.service.ts`, `post-visit.controller.ts`, `patient-portal.controller.ts`, `PostVisitDoctorWorkspace.tsx`, `ehr-api.ts`, `patient-portal-api.ts`, `database-provisioning.service.ts` | `045-post-visit-audio-storage.sql`, `provision-sprint58-post-visit-audio-storage.ts` | API only (mobile) |
| **59** | Inline entity linking | None | `post-visit.service.ts`, `post-visit.controller.ts`, `patient-portal.controller.ts`, `PostVisitDoctorWorkspace.tsx`, `ehr-api.ts`, `patient-portal-api.ts` | `entity-annotation.ts`, `AnnotatedText.tsx` | API only (mobile) |
| **60** | Per-section scoped Ask | None | `post-visit-grounded-llm.service.ts`, `post-visit.service.ts`, `post-visit.controller.ts`, `patient-portal.controller.ts`, `PostVisitDoctorWorkspace.tsx`, `patient-portal-api.ts` | `SectionAskButton.tsx` | API only (mobile) |
