## Imaging Viewer – Open Issues (Nov 27, 2025)

### 1. DICOM fetch fails with signed URL 403
- **Symptom:** Browser console shows repeated `Failed to display DICOM image { error: XMLHttpRequest }` and Cornerstone warnings (`Unable to find tool "WwwcTool"`). Network tab reveals the signed URL to MinIO returns `403 Forbidden`.
- **Current understanding:**
  - Signed URLs now point to `http://localhost:9000/...` (public endpoint) but MinIO still rejects them. The signature is generated with AWS-style headers (`host` = `localhost:9000`) yet MinIO is configured for path-style buckets and may be validating the canonical request against `medicore-imaging.local`.
  - Need to inspect MinIO policy/logs and confirm whether:
    - The request actually reaches MinIO (check `docker logs medicore-minio`).
    - Path-style + bucket prefix is accepted when using the public hostname.
    - Any extra proxy (Traefik, nginx) is required so we can use a hostname MinIO trusts (e.g., `medicore-minio.local` mapped via `/etc/hosts`).
  - Possible fixes to investigate:
    1. Switch to virtual-host style URLs (`https://medicore-imaging.local/imaging/...`) and add that hostname to `/etc/hosts`.
    2. Keep path-style but sign using the internal hostname (`minio:9000`) and expose that to the browser via `127.0.0.1 minio` (so canonical host matches).
    3. Use a presigned POST (browser uploads) and fetch via backend proxy that streams the object (no presigned GET).
- **Next steps:** Debug with `mc admin trace` inside the MinIO container to inspect failing requests; prototype option (2) by adding `minio.localhost` DNS entry and pointing `STORAGE_S3_PUBLIC_BASE_URL` to that hostname so canonical host matches.

### 2. Study viewer lacks slice slider
- **Symptom:** Even after layout revamp, the study modal only shows prev/next buttons. Users expect a draggable slider for stacks.
- **Requirement:** Add a vertical slider (or scrubber bar) similar to standard PACS viewers. Needs keyboard + mouse wheel support, and display total/selected slice count.
- **Next steps:** Design slider component (likely reusing the existing `activeIndex` logic) and ensure it works for both signed URL DICOMs and inline JPEGs once issue (1) is resolved.

### 3. Console noise: Cornerstone LUT warning
- `The provided colorLUT only provides 0 labels...` appears every load. Low priority, but note it can be silenced by initializing Cornerstone Segmentation with proper LUT; track after DICOM delivery is stable.

---
**Owner:** Imaging squad  
**Status:** Blocked on signed URL auth  
**ETA:** TBD (needs MinIO debugging session)




