# Mobile `testID` convention

Established in S259 (2026-08-25) when the mobile app had zero `testID` props
anywhere, which meant any e2e coverage had to rely on fragile text-matching.
Extended to the patient-portal screens in a follow-up pass (2026-08-26).

## Pattern

```
<screen-slug>-<element>[-<id>]
```

- `screen-slug`: kebab-case, short, derived from the screen/component name
  (e.g. `PatientBillsScreen` → `patient-bills`, `NurseShiftScreen` → `shift`).
- `element`: what it is (`btn`, `input`, `item`, `tab`, `card`, `checkbox`).
- `-{id}`: appended when the element repeats per list row/entity (invoice id,
  task id, message id) so a spec can target one specific row instead of the
  first match.

Examples already in the codebase: `login-role-{key}`, `login-email-input`,
`shift-task-checkbox-{id}`, `shift-tab-{key}`, `tab-${route.name}` (see
`LoginScreen.tsx`, `NurseShiftScreen.tsx`, `TabBar.tsx`), and the patient-portal
IDs listed below.

## Where it's applied so far

- Login, tab bar (S259)
- Nurse worklist/triage/escalate/SBAR, doctor rounds/med-rec (S259)
- Patient portal: appointments, bills/payment, meds, messages, notifications,
  health, home (2026-08-26 follow-up)

## Where it isn't yet

Doctor/nurse screens beyond the S259 point-of-care set, and the remaining
patient-portal screens (education, questionnaires, AI companion, telemedicine,
family access, post-visit). Add `testID`s following the same pattern as those
screens get real e2e coverage — don't add them speculatively to screens
nothing exercises yet, since untested `testID` placement can drift out of
sync with the UI it's meant to describe.
