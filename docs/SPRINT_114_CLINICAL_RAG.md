# Sprint 114 — Clinical RAG Knowledge Base
### Replace Hallucinated Citations with a Real, Grounded, Tenant-Configurable Knowledge Base

**Master Guide:** [AI_FIRST_MASTER_GUIDE.md](./AI_FIRST_MASTER_GUIDE.md) — Read first.
**Depends on:** Sprint 112 complete.
**Sprint type:** New module — backend (CDSS + EHR) + frontend upload UI.

---

## Objective

The current CDSS guideline retrieval either returns hardcoded text or calls a basic keyword search. There is no versioned, tenant-managed knowledge base. This sprint builds one using `pgvector` for semantic search alongside the existing `chromadb` as a fallback. After this sprint, every CDSS guideline citation comes from a real document stored in the system — no free-text hallucination.

---

## Architecture

```
Clinical Document (PDF/Word/Text)
    → Upload via EHR Frontend or Admin API
    → EHR Service: DocumentIngestService
        → Store raw file in MinIO (bucket: clinical-knowledge)
        → Parse text via CDSS /knowledge/ingest
    → CDSS Service: KnowledgeIngestService
        → Chunk document (512 tokens, 64 overlap)
        → Embed chunks via sentence-transformers (all-MiniLM-L6-v2)
        → Store chunks + embeddings in PostgreSQL pgvector table
        → BM25 index updated for keyword fallback

At inference time (any CDSS guideline call):
    → CDSS KnowledgeRetrievalService
        → Vector similarity search (top-10 chunks, cosine distance)
        → BM25 keyword rerank
        → Reciprocal Rank Fusion → top-5 chunks
        → Chunks injected as context into LLM prompt
        → Citations in response = actual document chunk references
```

---

## Step 1 — Enable pgvector in PostgreSQL

File: `scripts/provision-repair-all.sh` — this runs before provisioning; add at the top of Step 2:
```bash
# Enable pgvector extension on master DB and all tenant DBs
docker exec medicore-postgres-master psql -U postgres -d medicore \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Note: `pgvector` must be available in the postgres Docker image. If using `postgres:15-alpine`, install via:
```dockerfile
# In docker-compose or Dockerfile for postgres service:
RUN apk add --no-cache pgvector
```
Or use image: `pgvector/pgvector:pg15` — update `docker-compose.yml` postgres service image.

---

## Step 2 — Database: Add Knowledge Tables

**Provisioning** — Add to `getSchemaVersionBundles()`:
```typescript
{
  id: 'sprint114_clinical_rag',
  label: 'Sprint 114 - Clinical RAG Knowledge Base',
  version: '2026.03.28.1',
  description: 'clinical_knowledge_documents + clinical_knowledge_chunks (pgvector) for grounded RAG',
  statements: () => this.getSprint114ClinicalRagStatements(),
},
```

Add method:
```typescript
private getSprint114ClinicalRagStatements(): string[] {
  return [
    // Enable pgvector (idempotent)
    `CREATE EXTENSION IF NOT EXISTS vector`,

    // Master document registry (per-tenant)
    `CREATE TABLE IF NOT EXISTS clinical_knowledge_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(100) NOT NULL,
      title TEXT NOT NULL,
      document_type VARCHAR(50) NOT NULL,  -- guideline | protocol | formulary | policy | research
      specialty VARCHAR(100),
      source_organization VARCHAR(255),   -- e.g. WHO, MoHCC, NICE
      version VARCHAR(50),
      effective_date DATE,
      expiry_date DATE,
      language VARCHAR(10) NOT NULL DEFAULT 'en',
      minio_bucket VARCHAR(100) NOT NULL,
      minio_key TEXT NOT NULL,
      file_size_bytes INT,
      mime_type VARCHAR(100),
      chunk_count INT NOT NULL DEFAULT 0,
      embedding_model VARCHAR(100),        -- model used to embed
      ingestion_status VARCHAR(30) NOT NULL DEFAULT 'pending',
      ingestion_error TEXT,
      ingested_at TIMESTAMPTZ,
      uploaded_by UUID NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ckd_tenant ON clinical_knowledge_documents (tenant_id, is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_ckd_type ON clinical_knowledge_documents (document_type, specialty)`,
    `CREATE INDEX IF NOT EXISTS idx_ckd_status ON clinical_knowledge_documents (ingestion_status)`,

    // Vector chunks — one row per chunk per document
    `CREATE TABLE IF NOT EXISTS clinical_knowledge_chunks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES clinical_knowledge_documents(id) ON DELETE CASCADE,
      tenant_id VARCHAR(100) NOT NULL,
      chunk_index INT NOT NULL,
      chunk_text TEXT NOT NULL,
      chunk_tokens INT NOT NULL,
      -- pgvector column: 384 dimensions for all-MiniLM-L6-v2
      embedding vector(384),
      metadata JSONB NOT NULL DEFAULT '{}',  -- { page, section, heading }
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ckc_document ON clinical_knowledge_chunks (document_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ckc_tenant ON clinical_knowledge_chunks (tenant_id)`,
    // IVFFlat index for fast ANN search (build after first 1000 rows)
    `CREATE INDEX IF NOT EXISTS idx_ckc_embedding ON clinical_knowledge_chunks
     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50)`,

    // Search log for analytics + quality monitoring
    `CREATE TABLE IF NOT EXISTS rag_search_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(100) NOT NULL,
      query_text TEXT NOT NULL,
      query_embedding_model VARCHAR(100),
      surface VARCHAR(100),           -- which AI surface triggered the search
      patient_id UUID,
      top_chunk_ids UUID[],
      retrieval_latency_ms INT,
      chunks_returned INT,
      user_clicked_citation BOOLEAN,  -- did clinician click the citation?
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_rsl_tenant ON rag_search_logs (tenant_id, created_at DESC)`,
  ];
}
```

---

## Step 3 — EHR Service: TypeORM Entities

File: `services/ehr-service/src/entities/clinical-knowledge-document.entity.ts`
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('clinical_knowledge_documents')
export class ClinicalKnowledgeDocument {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', length: 100 }) tenantId: string;
  @Column({ type: 'text' }) title: string;
  @Column({ name: 'document_type', length: 50 }) documentType: string;
  @Column({ length: 100, nullable: true }) specialty?: string;
  @Column({ name: 'source_organization', length: 255, nullable: true }) sourceOrganization?: string;
  @Column({ length: 50, nullable: true }) version?: string;
  @Column({ name: 'effective_date', type: 'date', nullable: true }) effectiveDate?: Date;
  @Column({ name: 'expiry_date', type: 'date', nullable: true }) expiryDate?: Date;
  @Column({ length: 10, default: 'en' }) language: string;
  @Column({ name: 'minio_bucket', length: 100 }) minioBucket: string;
  @Column({ name: 'minio_key', type: 'text' }) minioKey: string;
  @Column({ name: 'chunk_count', default: 0 }) chunkCount: number;
  @Column({ name: 'embedding_model', length: 100, nullable: true }) embeddingModel?: string;
  @Column({ name: 'ingestion_status', length: 30, default: 'pending' }) ingestionStatus: string;
  @Column({ name: 'ingestion_error', type: 'text', nullable: true }) ingestionError?: string;
  @Column({ name: 'ingested_at', type: 'timestamptz', nullable: true }) ingestedAt?: Date;
  @Column({ name: 'uploaded_by', type: 'uuid' }) uploadedBy: string;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

Register in `tenant.service.ts` entities array:
```typescript
import { ClinicalKnowledgeDocument } from '../entities/clinical-knowledge-document.entity';
// Add to entities: [ ... ClinicalKnowledgeDocument, ... ]
```

---

## Step 4 — EHR Service: KnowledgeIngestService

File: `services/ehr-service/src/services/knowledge-ingest.service.ts` (create new)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalKnowledgeDocument } from '../entities/clinical-knowledge-document.entity';
import { CdssService } from './cdss.service';
import { MinioService } from './minio.service';

@Injectable()
export class KnowledgeIngestService {
  private readonly logger = new Logger(KnowledgeIngestService.name);

  constructor(
    @InjectRepository(ClinicalKnowledgeDocument)
    private readonly documentRepo: Repository<ClinicalKnowledgeDocument>,
    private readonly cdssService: CdssService,
    private readonly minioService: MinioService,
  ) {}

  async ingestDocument(
    file: Express.Multer.File,
    metadata: {
      title: string;
      documentType: string;
      specialty?: string;
      sourceOrganization?: string;
      version?: string;
      effectiveDate?: string;
      language?: string;
    },
    uploadedBy: string,
    tenantId: string,
  ): Promise<ClinicalKnowledgeDocument> {
    // 1. Store in MinIO
    const minioKey = `clinical-knowledge/${tenantId}/${Date.now()}-${file.originalname}`;
    await this.minioService.putObject('clinical-knowledge', minioKey, file.buffer, file.mimetype);

    // 2. Create document record
    const doc = await this.documentRepo.save({
      tenantId,
      title: metadata.title,
      documentType: metadata.documentType,
      specialty: metadata.specialty,
      sourceOrganization: metadata.sourceOrganization,
      version: metadata.version,
      effectiveDate: metadata.effectiveDate ? new Date(metadata.effectiveDate) : undefined,
      language: metadata.language || 'en',
      minioBucket: 'clinical-knowledge',
      minioKey,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
      ingestionStatus: 'pending',
      uploadedBy,
    });

    // 3. Kick off async ingestion via CDSS
    this.runIngestion(doc, file.buffer, tenantId).catch(err => {
      this.logger.error(`Ingestion failed for document ${doc.id}: ${err.message}`);
    });

    return doc;
  }

  private async runIngestion(doc: ClinicalKnowledgeDocument, fileBuffer: Buffer, tenantId: string) {
    try {
      await this.documentRepo.update(doc.id, { ingestionStatus: 'processing' });

      // Call CDSS ingest endpoint
      const result = await this.cdssService.ingestKnowledgeDocument({
        documentId: doc.id,
        tenantId,
        fileBase64: fileBuffer.toString('base64'),
        mimeType: doc.mimeType,
        metadata: {
          title: doc.title,
          documentType: doc.documentType,
          specialty: doc.specialty,
          sourceOrganization: doc.sourceOrganization,
        },
      });

      await this.documentRepo.update(doc.id, {
        ingestionStatus: 'completed',
        chunkCount: result.chunkCount,
        embeddingModel: result.embeddingModel,
        ingestedAt: new Date(),
      });
    } catch (err) {
      await this.documentRepo.update(doc.id, {
        ingestionStatus: 'failed',
        ingestionError: err.message,
      });
    }
  }
}
```

Add `ingestKnowledgeDocument` method to `CdssService`:
```typescript
// In services/ehr-service/src/services/cdss.service.ts
async ingestKnowledgeDocument(payload: {
  documentId: string;
  tenantId: string;
  fileBase64: string;
  mimeType: string;
  metadata: Record<string, any>;
}): Promise<{ chunkCount: number; embeddingModel: string }> {
  const response = await this.cdssPost('/knowledge/ingest', payload);
  return response;
}

async searchKnowledge(query: string, tenantId: string, filters?: {
  specialty?: string;
  documentType?: string;
  topK?: number;
}): Promise<KnowledgeSearchResult[]> {
  await this.recordGovernedPromptAudit({ surface: 'knowledge_search', task: 'rag_retrieval' });
  return this.cdssPost('/knowledge/search', { query, tenant_id: tenantId, filters, top_k: filters?.topK || 5 });
}
```

---

## Step 5 — CDSS Service: Knowledge Endpoints

File: `services/cdss-service/main.py`

Add knowledge ingestion and search endpoints. Add after imports:

```python
# ── RAG Knowledge Base ────────────────────────────────────────────────────────
import base64
import hashlib
from sentence_transformers import SentenceTransformer
import psycopg2
import psycopg2.extras

_embedding_model = None

def _get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        model_name = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        _embedding_model = SentenceTransformer(model_name)
    return _embedding_model

def _pg_conn():
    return psycopg2.connect(
        host=os.getenv("SERVICE_POSTGRES_HOST", "postgres-master"),
        port=int(os.getenv("PORT_POSTGRES", 5432)),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres"),
        dbname=os.getenv("POSTGRES_DB", "medicore"),
    )

def _chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> list[dict]:
    """Chunk text into overlapping windows. Returns list of {text, start, end}."""
    words = text.split()
    chunks = []
    i = 0
    idx = 0
    while i < len(words):
        chunk_words = words[i:i + chunk_size]
        chunks.append({
            "text": " ".join(chunk_words),
            "chunk_index": idx,
            "token_count": len(chunk_words),
        })
        i += chunk_size - overlap
        idx += 1
    return chunks


class KnowledgeIngestRequest(BaseModel):
    document_id: str
    tenant_id: str
    file_base64: str
    mime_type: str
    metadata: dict = {}

class KnowledgeIngestResponse(BaseModel):
    document_id: str
    chunk_count: int
    embedding_model: str
    status: str

@app.post("/knowledge/ingest", response_model=KnowledgeIngestResponse)
async def ingest_knowledge_document(req: KnowledgeIngestRequest):
    """
    Parse, chunk, embed, and store a clinical document in pgvector.
    Called by: EHR KnowledgeIngestService.runIngestion()
    """
    # 1. Decode file
    file_bytes = base64.b64decode(req.file_base64)

    # 2. Extract text
    try:
        from unstructured.partition.auto import partition
        import io
        elements = partition(file=io.BytesIO(file_bytes), content_type=req.mime_type)
        full_text = "\n".join([str(el) for el in elements if str(el).strip()])
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Text extraction failed: {e}")

    if not full_text.strip():
        raise HTTPException(status_code=422, detail="Document contains no extractable text")

    # 3. Chunk
    chunks = _chunk_text(full_text, chunk_size=512, overlap=64)

    # 4. Embed
    model = _get_embedding_model()
    model_name = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    texts = [c["text"] for c in chunks]
    embeddings = model.encode(texts, batch_size=32, show_progress_bar=False)

    # 5. Store in PostgreSQL pgvector
    conn = _pg_conn()
    try:
        psycopg2.extras.register_vector(conn)
        with conn.cursor() as cur:
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                cur.execute(
                    """INSERT INTO clinical_knowledge_chunks
                       (document_id, tenant_id, chunk_index, chunk_text, chunk_tokens, embedding, metadata)
                       VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                    (
                        req.document_id,
                        req.tenant_id,
                        chunk["chunk_index"],
                        chunk["text"],
                        chunk["token_count"],
                        embedding.tolist(),
                        psycopg2.extras.Json(req.metadata),
                    )
                )
        conn.commit()
    finally:
        conn.close()

    return KnowledgeIngestResponse(
        document_id=req.document_id,
        chunk_count=len(chunks),
        embedding_model=model_name,
        status="completed",
    )


class KnowledgeSearchRequest(BaseModel):
    query: str
    tenant_id: str
    filters: dict = {}
    top_k: int = 5

class KnowledgeSearchResult(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    chunk_text: str
    similarity_score: float
    metadata: dict

class KnowledgeSearchResponse(BaseModel):
    results: list[KnowledgeSearchResult]
    retrieval_latency_ms: int
    query: str

@app.post("/knowledge/search", response_model=KnowledgeSearchResponse)
async def search_knowledge(req: KnowledgeSearchRequest):
    """
    Semantic + keyword hybrid search over the clinical knowledge base.
    Called by: CdssService.searchKnowledge() — used in all guideline retrieval paths.
    """
    import time
    start = time.time()

    # 1. Embed the query
    model = _get_embedding_model()
    query_embedding = model.encode([req.query])[0]

    # 2. Vector similarity search
    conn = _pg_conn()
    try:
        psycopg2.extras.register_vector(conn)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            specialty_filter = req.filters.get("specialty")
            doc_type_filter = req.filters.get("documentType")

            cur.execute(
                """SELECT
                     c.id as chunk_id,
                     c.document_id,
                     d.title as document_title,
                     c.chunk_text,
                     1 - (c.embedding <=> %s::vector) as similarity_score,
                     c.metadata
                   FROM clinical_knowledge_chunks c
                   JOIN clinical_knowledge_documents d ON d.id = c.document_id
                   WHERE c.tenant_id = %s
                     AND d.is_active = true
                     AND d.ingestion_status = 'completed'
                     AND (%s IS NULL OR d.specialty = %s)
                     AND (%s IS NULL OR d.document_type = %s)
                   ORDER BY c.embedding <=> %s::vector
                   LIMIT %s""",
                (
                    query_embedding.tolist(),
                    req.tenant_id,
                    specialty_filter, specialty_filter,
                    doc_type_filter, doc_type_filter,
                    query_embedding.tolist(),
                    req.top_k * 2,  # over-fetch for reranking
                )
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    if not rows:
        return KnowledgeSearchResponse(results=[], retrieval_latency_ms=int((time.time()-start)*1000), query=req.query)

    # 3. BM25 rerank on top candidates
    from rank_bm25 import BM25Okapi
    corpus = [row["chunk_text"].lower().split() for row in rows]
    bm25 = BM25Okapi(corpus)
    bm25_scores = bm25.get_scores(req.query.lower().split())

    # 4. Reciprocal Rank Fusion
    vector_ranks = {i: rank for rank, i in enumerate(sorted(range(len(rows)), key=lambda x: -rows[x]["similarity_score"]))}
    bm25_ranks = {i: rank for rank, i in enumerate(sorted(range(len(rows)), key=lambda x: -bm25_scores[x]))}
    rrf_scores = {i: 1/(60+vector_ranks[i]) + 1/(60+bm25_ranks[i]) for i in range(len(rows))}
    top_indices = sorted(rrf_scores, key=lambda x: -rrf_scores[x])[:req.top_k]

    results = [
        KnowledgeSearchResult(
            chunk_id=str(rows[i]["chunk_id"]),
            document_id=str(rows[i]["document_id"]),
            document_title=rows[i]["document_title"],
            chunk_text=rows[i]["chunk_text"],
            similarity_score=float(rows[i]["similarity_score"]),
            metadata=dict(rows[i]["metadata"]) if rows[i]["metadata"] else {},
        )
        for i in top_indices
    ]

    return KnowledgeSearchResponse(
        results=results,
        retrieval_latency_ms=int((time.time()-start)*1000),
        query=req.query,
    )
```

Add `psycopg2-binary` and `psycopg2` to `requirements.txt`:
```
psycopg2-binary>=2.9.9
```

---

## Step 6 — Wire RAG into Guideline Search

File: `services/cdss-service/main.py`

Find the `/guidelines/search` endpoint. Replace or augment the existing keyword search with RAG retrieval:

```python
@app.post("/guidelines/search")
async def search_guidelines(req: GuidelineSearchRequest):
    """
    Hybrid RAG guideline search. Uses pgvector knowledge base if documents exist,
    falls back to hardcoded guidelines if knowledge base is empty.
    """
    # Try pgvector RAG first
    rag_results = await search_knowledge(KnowledgeSearchRequest(
        query=req.query,
        tenant_id=req.tenant_id,
        filters={"documentType": "guideline", "specialty": req.specialty},
        top_k=5,
    ))

    if rag_results.results:
        # Build LLM prompt grounded in retrieved chunks
        context = "\n\n---\n\n".join([
            f"[Source: {r.document_title}]\n{r.chunk_text}"
            for r in rag_results.results
        ])
        # Call LLM with grounded context
        # ... existing LLM call with context injected ...
        # Citations = rag_results.results (real document references, not hallucinated)
        pass
    else:
        # Fallback to existing keyword search
        pass
```

---

## Step 7 — EHR Controller: Knowledge Upload Endpoint

File: `services/ehr-service/src/controllers/knowledge.controller.ts` (create new)

```typescript
import { Controller, Post, Get, Delete, Param, Body, UseInterceptors, UploadedFile, Roles } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeIngestService } from '../services/knowledge-ingest.service';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeIngestService) {}

  @Post('documents')
  @Roles('admin', 'doctor', 'senior_clinician')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: {
      title: string;
      documentType: string;
      specialty?: string;
      sourceOrganization?: string;
      version?: string;
      effectiveDate?: string;
    },
  ) {
    return this.knowledgeService.ingestDocument(file, metadata, requestingUserId, tenantId);
  }

  @Get('documents')
  async listDocuments() {
    return this.knowledgeService.listDocuments(tenantId);
  }

  @Delete('documents/:id')
  @Roles('admin')
  async deleteDocument(@Param('id') id: string) {
    return this.knowledgeService.deactivateDocument(id, tenantId);
  }
}
```

Register in `app.module.ts`:
```typescript
// In providers: add KnowledgeIngestService
// In controllers: add KnowledgeController
```

---

## Step 8 — Frontend: Knowledge Upload UI

File: `ehr-frontend/src/pages/KnowledgeBasePage.tsx` (create new)

```tsx
import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { uploadKnowledgeDocument, listKnowledgeDocuments, deleteKnowledgeDocument } from '../services/api';

const DOCUMENT_TYPES = ['guideline', 'protocol', 'formulary', 'policy', 'research'];
const SPECIALTIES = ['general', 'cardiology', 'pharmacy', 'radiology', 'paediatrics', 'oncology', 'hiv', 'tb', 'mental_health'];

export const KnowledgeBasePage: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', documentType: 'guideline', specialty: '', sourceOrganization: '', version: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    listKnowledgeDocuments().then(setDocuments).catch(console.error);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile || !form.title) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    Object.entries(form).forEach(([k, v]) => v && formData.append(k, v));
    try {
      await uploadKnowledgeDocument(formData);
      setSelectedFile(null);
      setForm({ title: '', documentType: 'guideline', specialty: '', sourceOrganization: '', version: '' });
      const updated = await listKnowledgeDocuments();
      setDocuments(updated);
    } finally {
      setUploading(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle size={14} className="text-green-500" />;
    if (status === 'processing') return <Clock size={14} className="text-amber-500 animate-spin" />;
    if (status === 'failed') return <AlertCircle size={14} className="text-red-500" />;
    return <Clock size={14} className="text-slate-400" />;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-6">Clinical Knowledge Base</h1>
      <p className="text-sm text-slate-500 mb-6">
        Documents uploaded here are used by the AI to ground all clinical guideline recommendations.
        PDF, DOCX, and TXT files supported.
      </p>

      {/* Upload Form */}
      <div className="border border-slate-200 rounded-xl p-4 mb-6 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Upload New Document</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-slate-600">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
              className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. WHO Hypertension Guidelines 2023" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Type *</label>
            <select value={form.documentType} onChange={e => setForm(f => ({...f, documentType: e.target.value}))}
              className="w-full border rounded px-2 py-1.5 text-sm mt-0.5">
              {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Specialty</label>
            <select value={form.specialty} onChange={e => setForm(f => ({...f, specialty: e.target.value}))}
              className="w-full border rounded px-2 py-1.5 text-sm mt-0.5">
              <option value="">All specialties</option>
              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Source Organization</label>
            <input value={form.sourceOrganization} onChange={e => setForm(f => ({...f, sourceOrganization: e.target.value}))}
              className="w-full border rounded px-2 py-1.5 text-sm mt-0.5" placeholder="e.g. WHO, MoHCC, NICE" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 border rounded px-3 py-2 text-sm cursor-pointer hover:bg-white bg-white border-slate-300">
            <Upload size={14} />
            {selectedFile ? selectedFile.name : 'Choose file (PDF/DOCX/TXT)'}
            <input type="file" accept=".pdf,.docx,.txt" className="hidden"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
          </label>
          <button onClick={handleUpload} disabled={!selectedFile || !form.title || uploading}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload & Process'}
          </button>
        </div>
      </div>

      {/* Document List */}
      <div className="space-y-2">
        {documents.map(doc => (
          <div key={doc.id} className="flex items-center justify-between border rounded-lg p-3 bg-white">
            <div className="flex items-center gap-3">
              <FileText size={16} className="text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-800">{doc.title}</p>
                <p className="text-xs text-slate-400">
                  {doc.documentType} · {doc.specialty || 'all'} · {doc.sourceOrganization || 'unknown source'} · {doc.chunkCount} chunks
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                {statusIcon(doc.ingestionStatus)}
                <span>{doc.ingestionStatus}</span>
              </div>
              <button onClick={() => deleteKnowledgeDocument(doc.id)} className="text-slate-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {documents.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No documents yet. Upload your first clinical guideline.</p>
        )}
      </div>
    </div>
  );
};
```

Add route in `ehr-frontend/src/App.tsx` or router config:
```tsx
<Route path="/knowledge-base" element={<KnowledgeBasePage />} />
```

Add API calls to `ehr-frontend/src/services/api.ts`:
```typescript
export const uploadKnowledgeDocument = (formData: FormData) =>
  fetch(`${API_BASE_URL}/knowledge/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}`, 'X-Tenant-ID': getTenantId() },
    body: formData,
  }).then(r => r.json());

export const listKnowledgeDocuments = () =>
  fetch(`${API_BASE_URL}/knowledge/documents`, {
    headers: { Authorization: `Bearer ${getToken()}`, 'X-Tenant-ID': getTenantId() },
  }).then(r => r.json());

export const deleteKnowledgeDocument = (id: string) =>
  fetch(`${API_BASE_URL}/knowledge/documents/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}`, 'X-Tenant-ID': getTenantId() },
  });
```

---

## Sprint 114 — Acceptance Criteria

- [ ] `CREATE EXTENSION IF NOT EXISTS vector` succeeds on all tenant DBs
- [ ] `clinical_knowledge_documents` table provisioned on all tenants
- [ ] `clinical_knowledge_chunks` table with `vector(384)` column provisioned
- [ ] Upload a PDF via KnowledgeBasePage → status shows "processing" then "completed"
- [ ] `SELECT COUNT(*) FROM clinical_knowledge_chunks WHERE document_id = '<id>'` returns > 0
- [ ] `POST /knowledge/search` with a relevant query returns chunks from the uploaded document
- [ ] `POST /guidelines/search` returns results citing the uploaded document (not hallucinated text)
- [ ] TypeScript compiles without error
- [ ] `./scripts/provision-repair-all.sh` succeeds
- [ ] EMBEDDING_MODEL env var documented in `.env.example`
