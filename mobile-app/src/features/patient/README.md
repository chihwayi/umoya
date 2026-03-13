# Patient Features

Patient workflows are implemented in Sprint 03 using:

- `hooks/` for React Query data contracts
- `ui/` for patient-specific hero/section/status primitives
- `utils/` for formatting and safe value parsing

Screens under `src/app/patient/*` are wired only through `src/services/api/patient.ts`.
