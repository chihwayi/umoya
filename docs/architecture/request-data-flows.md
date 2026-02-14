# Request/Data Flows

This document provides sequence diagrams for the main runtime paths across MediCore services.

## 1) Tenant Provisioning

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Super Admin (web-app)
    participant WA as web-app (3011)
    participant TS as tenant-service (3001)
    participant MDB as Master Postgres
    participant TDB as Tenant Postgres (clinic_<slug>_db)

    Admin->>WA: Create tenant
    WA->>TS: POST /api/tenants
    TS->>MDB: Insert tenant metadata
    TS->>TDB: Create database + apply core schema
    TS->>TDB: Apply bundles/migrations + seed (optional)
    TS->>MDB: Update tenant/provisioning status
    TS-->>WA: Tenant + provisioning result
    WA-->>Admin: Success/failure message
```

## 2) Clinical Action + CDSS

```mermaid
sequenceDiagram
    autonumber
    actor Clinician as Clinician (ehr-frontend)
    participant EF as ehr-frontend (3000)
    participant EHR as ehr-service (3013)
    participant TDB as Tenant Postgres
    participant CDSS as cdss-service (8000)
    participant REDIS as Redis
    participant CHROMA as Chroma DB

    Clinician->>EF: Submit clinical action
    EF->>EHR: /api/... (Authorization, X-Tenant-ID)
    EHR->>EHR: Validate JWT + tenant context
    EHR->>TDB: Read/write tenant clinical data
    alt CDS needed
        EHR->>CDSS: POST /<cdss-endpoint> with patient context
        CDSS->>REDIS: Check/set cache (as applicable)
        CDSS->>CHROMA: Retrieve guideline chunks (RAG paths)
        CDSS-->>EHR: Recommendations/warnings/scores
    end
    EHR-->>EF: Final API response
    EF-->>Clinician: Render results/alerts
```

## 3) CDSS Admin (Owner)

```mermaid
sequenceDiagram
    autonumber
    actor Owner as System Owner (web-app)
    participant WA as web-app CdssAdmin
    participant PROXY as web-app setupProxy
    participant CDSS as cdss-service /admin/*
    participant MDB as Master Postgres
    participant REDIS as Redis
    participant CHROMA as Chroma DB

    Owner->>WA: Open CDSS Admin page
    WA->>PROXY: GET /api/cdss-admin/admin/status
    WA->>PROXY: GET /api/cdss-admin/admin/settings
    WA->>PROXY: GET /api/cdss-admin/admin/metrics
    PROXY->>CDSS: Forward (/api/cdss-admin -> /)
    CDSS->>CDSS: Owner gate (JWT/email header + rate limit)
    CDSS->>MDB: Read settings + audit logs
    CDSS-->>WA: Status/settings/metrics/audit

    Owner->>WA: Save settings / Reindex / Flush cache / Ingest
    WA->>PROXY: PUT/POST /api/cdss-admin/admin/...
    PROXY->>CDSS: Forward action
    CDSS->>MDB: Persist system_settings + write cdss_admin_audit_logs
    opt Reindex
        CDSS->>CHROMA: Rebuild collection/index
    end
    opt Flush cache
        CDSS->>REDIS: Delete keys/namespace
    end
    CDSS-->>WA: Action result
```

## 4) Patient Portal

```mermaid
sequenceDiagram
    autonumber
    actor Patient as Patient (patient-portal)
    participant PP as patient-portal (3015)
    participant EHR as ehr-service (3013)
    participant TDB as Tenant Postgres
    participant OBJ as MinIO/S3

    Patient->>PP: Open patient workflow (appointments/records/etc.)
    PP->>EHR: /api/patient-portal/... (Authorization, X-Tenant-ID)
    EHR->>EHR: Validate patient auth + tenant scope
    EHR->>TDB: Query/update tenant patient data
    opt File/export paths
        EHR->>OBJ: Fetch/store files
    end
    EHR-->>PP: JSON response
    PP-->>Patient: Render data
```

## Notes

- Primary tenant routing header: `X-Tenant-ID`.
- Auth header: `Authorization: Bearer <token>`.
- Super-admin UI proxy mappings are defined in `web-app/src/setupProxy.js`.
- CDSS admin settings are persisted in master DB tables:
  - `system_settings`
  - `cdss_admin_audit_logs`
