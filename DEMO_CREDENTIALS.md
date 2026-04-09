# MediCore Demo Credentials

All demo accounts are automatically provisioned when a new tenant/clinic is created.
Replace `{slug}` with the clinic's subdomain (e.g. `kids-clinic`, `city-hospital`).

---

## Super Admin (Platform)

| URL | Email | Password |
|-----|-------|----------|
| http://localhost:3011 | admin@medicore.health | medicore123 |

> Manages tenants, billing, and platform-wide settings.

---

## EHR — Per-Clinic Staff Accounts

Login at: **http://localhost:3000** (EHR Frontend)
API at: **http://localhost:3013**

All demo staff accounts share the same password: **`Medicore1#`**

| Role | Email |
|------|-------|
| Doctor | `doctor@{slug}.com` |
| Nurse | `nurse@{slug}.com` |
| Nurse (Accounts) | `nurse.accounts@{slug}.com` |
| Pharmacist | `pharmacist@{slug}.com` |
| Lab Technician | `lab@{slug}.com` |
| Radiologist | `radiologist@{slug}.com` |
| Accounts / Finance | `accounts@{slug}.com` |
| Receptionist | `receptionist@{slug}.com` |
| Clinic Admin | `admin@{slug}.com` |

**Example** — if the clinic slug is `kids-clinic`:
- `doctor@kids-clinic.com` / `Medicore1#`
- `nurse@kids-clinic.com` / `Medicore1#`
- `admin@kids-clinic.com` / `Medicore1#`

---

## Patient Portal

URL: **http://localhost:3015**

Patients register themselves or are registered via the EHR.
No pre-seeded patient portal accounts — use the "Register" flow.

---

## Infrastructure Services

| Service | URL | Username | Password |
|---------|-----|----------|----------|
| MinIO Console (object storage) | http://localhost:9001 | minioadmin | minioadmin |
| Grafana (monitoring) | http://localhost:3012 | admin | admin |
| Prometheus | http://localhost:9090 | — | — |
| CDSS API Docs | http://localhost:8000/docs | — | — |
| Tenant Service API | http://localhost:3001 | — | — |

---

## Notes

- Demo passwords (`Medicore1#`) meet policy requirements: uppercase, lowercase, digit, special character.
- Infrastructure passwords above are **dev defaults** — change before any production deployment (`scripts/validate-secrets.sh` will catch them).
- The CDSS `/admin/*` endpoints require a JWT signed with `JWT_SECRET` and an email in `OWNER_EMAILS`.
