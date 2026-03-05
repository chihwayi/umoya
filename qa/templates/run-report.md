# QA Run Report Template

| Field | Value |
|-------|-------|
| Tenant | e.g. `qa-shared` |
| Build / Commit | `main@<sha>` |
| Run Date | 2026‑MM‑DD |
| Operator | Name / Team |
| Bundles Verified | e.g. `core, snomed, hiv_testing` |
| Tenant Repair Run | Yes / No (`POST /admin/tenants/:id/repair`) |

## Summary
- **Status**: ✅ / ⚠️ / ❌
- **Notes**: (highlight major findings, blockers, environment issues)

## Scenario Results

| Scenario | Status | Evidence | Comments |
|----------|--------|---------|----------|
| S1 – Triage → Rx → Nursing | ☐/☑ | link to screenshot or API response | ... |
| S2 – Maternity continuum | ☐/☑ | ... | ... |
| S3 – Oncology case | ... | ... | ... |
| S4 – Cardiology | ... | ... | ... |
| S5 – Lab critical alert | ... | ... | ... |
| S6 – Imaging | ... | ... | ... |
| S7 – CDSS | ... | ... | ... |
| S8 – Tenant provisioning | ... | ... | ... |
| S9 – HIV reporting | ... | ... | ... |
| S10 – Automation harness | ... | ... | ... |
| S11 – Nurse AI/CDSS outcomes | ... | ... | ... |
| S12 – Doctor cross-module sync | ... | ... | ... |

## Doctor Outcomes Evidence
| Metric Block | Status | Evidence |
|--------------|--------|----------|
| `doctorQueue` | ☐/☑ | `qa/tests/test-results/...json` |
| `accountsSync` | ☐/☑ | `qa/tests/test-results/...json` |
| `recommendationExecution` | ☐/☑ | `qa/tests/test-results/...json` |
| `cdssAdoption` | ☐/☑ | `qa/tests/test-results/...json` |

## Defects / Risks
| ID | Severity | Description | Linked Issue | Owner |
|----|----------|-------------|--------------|-------|
| QA-123 | Major | ... | https://jira/... | ... |

## Sign-off
- QA Lead: ____________________
- Clinical Lead: _______________
- Date: _______________________

