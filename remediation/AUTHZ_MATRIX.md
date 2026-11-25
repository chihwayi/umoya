# AUTHZ_MATRIX (generated from the r2-authz-matrix test run)

Source: `services/ehr-service/src/services/r2-authz-matrix.spec.ts` — every row
below is an executed assertion, not prose. Regenerate: `npx jest r2-authz-matrix`.

| role | endpoint | context | VIP | expected | got |
|---|---|---|---|---|---|
| receptionist | REST GET /patients/:id | stranger | no | deny | deny  |
| pharmacist | REST GET /patients/:id | stranger | no | deny | deny  |
| nurse | REST GET /patients/:id | stranger | no | deny | deny  |
| admin | REST GET /patients/:id | stranger | no | deny | deny  |
| receptionist | FHIR GET /Patient/:id | stranger | no | deny | deny  |
| nurse | FHIR GET /Patient/:id/$everything | stranger | no | deny | deny  |
| pharmacist | FHIR search (changed ID) | stranger | no | deny | deny  |
| receptionist | census search | stranger | no | deny | deny  |
| nurse | REST GET /patients/:id | care-team | no | allow | allow  |
| doctor | FHIR GET /Patient/:id/$everything | appointment | no | allow | allow  |
| pharmacist | FHIR search (changed ID) | care-team | no | allow | allow  |
| receptionist | REST GET /patients/:id | break-glass | no | allow | allow  |
| nurse | REST GET /patients/:id | expired-break-glass | no | deny | deny  |
| admin | REST GET /patients/:id | stranger | yes | deny | deny  |
| doctor | REST GET /patients/:id | care-team | yes | allow | allow  |
| admin | REST GET /patients/:id | care-team | yes | allow | allow  |
| doctor | household propagate (HIV) | no-consent | no | deny | deny  |
| doctor | household propagate (HIV) | active-consent | no | allow | allow  |
| doctor | household propagate (HIV) | withdrawn-consent | no | deny | deny  |
| doctor | household propagate (HIV) | safeguard+consent | no | deny | deny  |
| receptionist | household family panel | stranger | no | deny | deny  |
| doctor | household family panel | no-relationship | no | deny | deny  |
| admin | household alerts (minor patient) | stranger | no | deny | deny  |
| any-role | SMS send (condition text) | free-text | no | deny | deny  |
| any-role | SMS send (clean text) | free-text | no | allow | allow  |
| any-role | offline sync hiv_disclosure_records | n/a | no | deny | deny  |
