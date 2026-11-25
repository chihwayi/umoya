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
