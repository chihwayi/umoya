# Weekend Brief – Clinical Specialist & Cross-Module Roadmap

## Current Context
- Radiology specialist workflow delivered (viewer, reporting, testing).
- Maternity specialist module enhanced for nurses and doctors with scoring, timelines, collaboration panels.
- API and frontend alignment achieved for maternity insights, neonatal outcomes, and postnatal tracking.

## Active Focus
- Build out **Lab Specialist** experience:
  - Prioritised worklist with batching, analyser assignment, and status-driven actions.
  - Processing workspace (sample tracking → analyser run → verification) with critical result escalation paths.
  - Communication loop back to ordering clinicians; event timeline inside lab orders.
  - Surface reagent/inventory indicators (initial UI scaffolding while backend matures).

## Upcoming Polish (after lab specialist)
- Cross-module alert deduplication (patient-level grouping of critical alerts).
- Collaboration enhancements (handoff notes, shared task assignments, unified notifications).
- Regression pass + targeted demo data for lab queues and alert scenarios.

## Monday Kick-Off Checklist
1. Finalise lab specialist worklist design and stub sample data.
2. Implement analyser/processing panels with state transitions.
3. Wire clinician communication hooks (notifications + timeline entries).
4. Begin alert dedup prototype once lab UI stabilises.
