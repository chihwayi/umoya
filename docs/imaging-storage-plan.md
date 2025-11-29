# Imaging Storage Refactor Plan

## Goals

1. **Reduce database bloat** – move binary DICOM/JPEG/PDF data out of Postgres to an object store (MinIO/S3 compatible).
2. **Improve streaming UX** – serve signed URLs so the viewer can fetch large studies incrementally instead of embedding base64 blobs in API payloads.
3. **Keep PHI secure** – encrypt at rest, scoped buckets per environment, all URLs short-lived and auditable.
4. **Zero-downtime migration** – existing studies continue to load while we backfill files to object storage.

## Target Architecture

| Component          | Responsibility                                                                 |
|--------------------|-------------------------------------------------------------------------------|
| MinIO/S3 bucket    | `imaging-artifacts/<tenant>/<studyId>/<uuid>.dcm` (private, versioned).       |
| `imaging_files`    | Store metadata only: `object_key`, `content_type`, `size`, `checksum`.        |
| Upload API         | 2-step flow: request signed PUT URL → client uploads directly → POST metadata.|
| Download API       | Backend issues signed GET URLs (short TTL) consumed by viewer/doctor portal.  |

### Bucket Policy
- Separate per environment (`medicore-imaging-dev`, `medicore-imaging-prod`).
- Server-side encryption (SSE-S3 or SSE-KMS).
- Bucket lifecycle to transition versions > 180 days to Glacier / infrequent access.

## API Changes

| Endpoint | Current Behaviour | New Behaviour |
|----------|-------------------|---------------|
| `POST /imaging/studies/:id/images` | Accepts base64 payload. | Returns `{ uploadUrl, objectKey, headers }`. Client uploads file to object store, then calls new `POST /imaging/studies/:id/images/complete` with metadata + checksum. |
| `GET /imaging/studies/:id/images` | Returns inline base64. | Returns metadata + `downloadUrl` (signed GET) for a short TTL (e.g., 2 minutes). Viewer fetches binary using fetch/XHR. |
| `DELETE /imaging/studies/:studyId/images/:imageId` | Deletes DB row. | Also deletes object from bucket (keep version/tombstone if compliance requires). |

### Signed URL Generation
- Use AWS SDK (S3 compatible) with credentials stored in Vault/.env.
- TTL: 120 seconds for downloads, 60 seconds for uploads.
- Validate MD5/sha256 on `images/complete` step to detect tampering.

## Migration Plan

1. **Prep**
   - Add `object_key`, `content_type`, `storage_status` columns to `imaging_files`.
   - Introduce `storage_mode` flag (`'db' | 'object'`) for backwards compatibility.

2. **Backfill Script**
   - Iterate over rows with `storage_mode = 'db'`.
   - Stream `file_path` (base64) to local temp file, upload to MinIO, update row with `object_key` + set `storage_mode = 'object'`.
   - Keep checksum for later integrity checks.
   - Script: `npm run imaging:backfill -- --tenant bulawayo-general --batchSize 25` (supports `--dryRun`).

3. **Dual-Read Deployment**
   - API first tries `object_key`; if absent, falls back to base64 column.
   - Upload endpoint writes to both stores until migration hits 100%.

4. **Cutover**
   - Once all rows converted, drop base64 payload storage (or archive table).
   - Enforce object-store-only uploads.

5. **Roll-forward/Back**
   - To roll back, keep base64 column for one release, but gate new uploads with feature flag so we can revert by toggling.

## Operational Considerations

- **MinIO Deployment**: docker-compose service (dev) and managed S3 bucket (prod). Bind into `docker-compose.yml`, expose credentials via `.env`.
- **Public Endpoint**: set `STORAGE_S3_PUBLIC_BASE_URL` so signed URLs point to a host the browser can reach (e.g., `http://localhost:9000` in local Docker).
- **Monitoring**: emit metrics for `imaging_storage_upload_seconds`, `imaging_storage_errors_total`.
- **Cleanup Jobs**: nightly task to remove orphaned objects (DB row deleted but file remains).
- **Large Files**: enable multipart uploads for >100 MB (DICOM series).

## Timeline
1. Week 1: Schema changes + dual-read API.
2. Week 2: Frontend migration to signed URLs (viewer + doctor portal).
3. Week 3: Backfill existing data, monitor metrics, cut over uploads.
4. Week 4: Drop legacy base64 path, finalize docs/runbooks.


