# Doctor AI/CDSS Parity Decision

Date: 2026-03-05
Owner: Product + Clinical Engineering
Status: Approved for execution

## Decision

Yes. Remaining doctor-facing domains must reach the same **executable AI/CDSS depth** already applied in nurse + oncology/doctor sync work.  
Advisory-only guidance is not sufficient for final signoff.

## Required Scope

The following modules must support executable recommendation bundles (one-click actions tied to workflow state updates, audit logs, and outcome metrics):

1. Ophthalmology
2. Telemedicine
3. Lab
4. Pharmacy

## Minimum Acceptance Standard Per Module

1. Recommendation bundles with rule/citation traceability.
2. One-click action execution that writes to underlying workflow entities.
3. Cross-module context prefill via `GET /patients/:id/context` (no duplicate capture).
4. Outcome analytics surfaced in doctor workflow analytics endpoints/UI.
5. QA smoke coverage for feed presence, execution, and outcomes contract.

## Delivery Sequencing

1. Ophthalmology protocol bundles + execution actions.
2. Telemedicine consultation bundles + execution actions.
3. Lab diagnostic-pathway bundles + execution actions.
4. Pharmacy therapeutic/interaction bundles + execution actions.
5. Unified analytics and UAT evidence consolidation.
