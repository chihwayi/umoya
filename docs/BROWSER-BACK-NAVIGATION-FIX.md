# Browser Back/Forward Navigation Fix — Implementation Guide

## Problem statement

Pressing the browser Back button anywhere in the EHR frequently drops the
user straight onto the login screen, which reads as a full, unexpected
logout. Nurses are hit hardest because their dashboard alone has 25+
internal views, none of which are reflected in the URL.

## Root causes (confirmed by code inspection)

1. **Login navigates with `push`, not `replace`.**
   [`ehr-frontend/src/pages/EHRLogin.tsx:132-149`](../ehr-frontend/src/pages/EHRLogin.tsx)
   calls `navigate(`/ehr/${tenantSlug}/nurse`)` (and the doctor/lab/
   radiologist/dashboard equivalents) after a successful login with no
   `{ replace: true }`. The login screen stays one entry behind the
   dashboard in browser history.

2. **The login page has no "already authenticated" redirect guard.**
   `EHRLogin.tsx` always renders the bare login form on mount — it never
   checks for a valid token and bounces the user to their real dashboard.
   So landing back on this route via Back always shows a blank login form,
   which looks exactly like being logged out even when the token in
   `localStorage` is still valid.

3. **Most dashboards keep 15–25+ internal views in local component state,
   never in the URL**, so there are zero intermediate history entries to
   step back through. Confirmed pattern, e.g.:
   [`ehr-frontend/src/pages/NurseDashboard.tsx:250-251`](../ehr-frontend/src/pages/NurseDashboard.tsx):
   ```ts
   const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'cross-module' | 'alerts' | ... | 'nhif'>('dashboard');
   const [activeSection, setActiveSection] = useState<'main' | 'hiv' | 'maternity' | 'women-health' | 'ncd' | 'finance'>('main');
   ```
   A full nurse shift of tab-switching produces **one** history entry. The
   very first Back press skips the entire session and lands on login.
   By contrast, `DoctorDashboard` is architecturally different — it already
   has real sub-routes (`/doctor/modules`, `/doctor/coordination`,
   `/doctor/patients/:id`, `/doctor/sync/:moduleKey`), so it's less affected.

4. **`isOnProtectedRoute()` misclassifies the login page as protected.**
   [`ehr-frontend/src/utils/autoLogout.ts:150-153`](../ehr-frontend/src/utils/autoLogout.ts):
   ```ts
   export const isOnProtectedRoute = (): boolean => {
     const currentPath = window.location.pathname;
     return currentPath.includes('/ehr/') && !currentPath.endsWith('/ehr/');
   };
   ```
   `/ehr/test-server` (the login URL) matches this, so the inactivity-timeout
   machinery treats the raw login screen as a page requiring a live session.

None of this is a "browser back is disabled" issue — it's a router/state
architecture gap. The fix has two independent tiers; do Tier 1 first (small,
safe, immediately effective), then Tier 2 (bigger, makes Back actually useful
rather than just harmless).

---

## Tier 1 — Stop Back from looking like a logout (do this first)

Small, low-risk, no new dependencies. Should ship as its own PR before Tier 2
starts.

### 1a. Fix `isOnProtectedRoute()`

File: `ehr-frontend/src/utils/autoLogout.ts`

```ts
export const isOnProtectedRoute = (): boolean => {
  const currentPath = window.location.pathname;
  // A bare tenant-slug path (the login screen) is public, not protected —
  // it must not arm the inactivity/auto-logout timers.
  const match = currentPath.match(/^\/ehr\/[^/]+\/?$/);
  return currentPath.includes('/ehr/') && !match;
};
```
Verify this still returns `true` for `/ehr/acme/nurse`, `/ehr/acme/doctor/patients/123`,
etc., and `false` for `/ehr/acme` and `/ehr/acme/`.

### 1b. Redirect an already-authenticated user away from the login page

File: `ehr-frontend/src/pages/EHRLogin.tsx`

Add near the top of the component, after the existing hooks, a role-aware
redirect that mirrors the exact `navigate()` targets already used in
`handleSubmit` (lines ~132-149 — doctor/radiologist/lab/nurse/dashboard):

```ts
useEffect(() => {
  const token = localStorage.getItem('ehr_token');
  const storedUser = localStorage.getItem('ehr_user');
  if (!token || !storedUser || !tenantSlug) return;
  try {
    const user = JSON.parse(storedUser);
    const target = roleToRoute(tenantSlug, user.role); // see helper below
    if (target) navigate(target, { replace: true });
  } catch {
    // malformed stored user — let the login form render normally
  }
}, [tenantSlug, navigate]);
```

Extract the role→route mapping that already exists inline in `handleSubmit`
(doctor → `/doctor`, radiologist → `/radiologist`, lab_tech → `/lab`,
nurse → `/nurse`, everything else → `/dashboard`) into a small shared helper
(e.g. `ehr-frontend/src/utils/roleRouting.ts`) so both `handleSubmit` and this
new guard call the same function instead of duplicating the branch list.

**Do not** blindly trust the stored token without a lightweight validity
check — a stale/expired token in storage should not force a fake instant
"redirect" back into a dashboard that immediately 401s. Prefer one of:
- Decode the JWT client-side and check `exp` before redirecting (cheapest).
- Or let the redirect happen and rely on the existing 401 interceptor
  (`ehr-frontend/src/services/api.ts:106-109`) to catch an actually-expired
  token and run `handleAutoLogout()` normally — this is acceptable since it's
  the same failure path that already exists today, just reached one hop later.

### 1c. Replace `navigate(...)` with `navigate(..., { replace: true })` at every post-login redirect

File: `ehr-frontend/src/pages/EHRLogin.tsx`, the block around lines 132-149.
Every `navigate(`/ehr/${tenantSlug}/...`)` call in that block should become
`navigate(`/ehr/${tenantSlug}/...`, { replace: true })`. This guarantees the
login screen never sits in history *underneath* a freshly-authenticated
session, so Back skips past it entirely and goes to whatever page (if any)
existed before the user opened the app — never a blank login form.

### 1d. Do the same audit for any other "auth gate" pages

Grep for other screens that navigate away after establishing a session and
apply the same `replace: true` treatment:
```bash
grep -rn "navigate(\`/ehr/\${tenantSlug}" ehr-frontend/src/pages/ChangePassword.tsx ehr-frontend/src/pages/MfaSetupPage.tsx ehr-frontend/src/pages/ImpersonationLanding.tsx
```
`ChangePassword` → dashboard, `MfaSetupPage` → dashboard, and
`ImpersonationLanding` → dashboard are the other three "gate" screens in the
same family (see `App.tsx:492-494`) and should get the identical treatment:
`replace: true` on the post-success navigate, plus (only if it makes sense
for that screen) an already-authenticated bypass.

### Tier 1 acceptance test

1. Log in as any role.
2. Click through 3–4 different in-app tabs/sections (doesn't matter which,
   Tier 1 doesn't fix intra-app history yet).
3. Press browser Back once.
   - **Before fix:** blank login form appears.
   - **After fix:** either nothing happens (no entry to go back to) or the
     user lands on whatever legitimately preceded the app (e.g. the tenant's
     marketing/landing page) — never a bare, confusing login form while a
     session is still active.
4. Manually clear `localStorage` (simulate real logout/expiry), navigate to
   `/ehr/<slug>`, confirm the login form renders normally (the guard must
   not trap an unauthenticated user).
5. Confirm session-idle-timeout still fires correctly on real protected
   pages, and does **not** fire while sitting on the bare login URL.

---

## Tier 2 — Sync in-app navigation to the URL (the real fix)

This is what makes Back/Forward behave the way every user expects: "go back
one step in what I was just doing," not just "don't look logged out."

### Design: one reusable hook, not 19 bespoke implementations

Add a small shared hook, e.g. `ehr-frontend/src/hooks/useUrlTab.ts`:

```ts
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Mirrors a dashboard's "active tab" state into a `?tab=` query param so
 * browser Back/Forward step through in-app views instead of skipping
 * straight past the whole session. Falls back to `defaultTab` when the
 * param is absent or holds a value outside `validTabs`.
 */
export function useUrlTab<T extends string>(
  paramName: string,
  validTabs: readonly T[],
  defaultTab: T,
): [T, (next: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(paramName);
  const current = (validTabs as readonly string[]).includes(raw ?? '')
    ? (raw as T)
    : defaultTab;

  const setTab = useCallback(
    (next: T) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === defaultTab) {
            params.delete(paramName);
          } else {
            params.set(paramName, next);
          }
          return params;
        },
        { replace: false }, // deliberate: this IS the history entry we want
      );
    },
    [setSearchParams, paramName, defaultTab],
  );

  return [current, setTab];
}
```

Why query params and not nested `<Route>` paths: most of these dashboards
render their tab content by branching on a string, not by mounting distinct
routed components — converting 19 dashboards to full nested routing is a much
larger, riskier rewrite than swapping `useState` for `useUrlTab`. Query
params get 90% of the UX benefit (working Back/Forward, shareable/bookmarkable
deep links, no full remount) for a fraction of the diff size. Reserve real
nested `<Route>`s for dashboards that are already structured that way
(doctor) or get restructured later.

Where a dashboard has **two** levels of tab state (like nurse's `activeTab`
+ `activeSection`), use two independent `useUrlTab` calls with two different
param names (`?section=hiv&tab=tb-screening`), not one combined encoding.

### Migration pattern (apply per file)

For each target file:

1. Find the `useState` line(s) driving the primary view, e.g.
   `NurseDashboard.tsx:250-251`.
2. Replace:
   ```ts
   const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | ...>('dashboard');
   ```
   with:
   ```ts
   const TABS = ['dashboard', 'tasks', 'cross-module', 'alerts', /* ...full list... */] as const;
   const [activeTab, setActiveTab] = useUrlTab('tab', TABS, 'dashboard');
   ```
   (Extract the exact union type already declared inline into the `TABS`
   const array — do not hand-retype it, copy it verbatim so nothing is
   missed or misspelled.)
3. Every other `setActiveTab(...)` call site in the file keeps working
   unchanged — the hook has the same `(value) => void` signature as
   `useState`'s setter.
4. Repeat for the second-level state (`activeSection` etc.) with its own
   param name.
5. **Do not** wrap every single modal/drawer open-state in URL params too —
   that's over-scoped and will make the diff unreviewable. Scope this pass
   to the *top-level tab/section* state per dashboard only.

### Target file list (Tier 2)

Confirmed via `grep -rl "useState<'dashboard'\|activeTab.*useState\|activeSection.*useState" ehr-frontend/src/pages/*.tsx` —
re-run this grep at the start of the cloud session to catch anything added
since this doc was written, then work through the list:

- `ehr-frontend/src/pages/NurseDashboard.tsx` — **highest priority**, most
  affected role per user report; 25+ tab values across `activeTab` +
  `activeSection`.
- `ehr-frontend/src/pages/PharmacyDashboard.tsx`
- `ehr-frontend/src/pages/LabDashboard.tsx`
- `ehr-frontend/src/pages/DoctorDashboard.tsx` — lower priority, already has
  partial real routing; check whether this file's local tab state is
  supplementary to routes or the primary mechanism before touching it.
- `ehr-frontend/src/pages/BillingDashboard.tsx`
- `ehr-frontend/src/pages/ClaimsDashboard.tsx`
- `ehr-frontend/src/pages/AnalyticsDashboard.tsx`
- `ehr-frontend/src/pages/RevenueCycleDashboard.tsx`
- `ehr-frontend/src/pages/PracticeManagementDashboard.tsx`
- `ehr-frontend/src/pages/MessagingDashboard.tsx`
- `ehr-frontend/src/pages/TelemedicineDashboard.tsx`
- `ehr-frontend/src/pages/ImmunizationDashboard.tsx`
- `ehr-frontend/src/pages/OutbreakDashboard.tsx`
- `ehr-frontend/src/pages/CascadeDashboardPage.tsx`
- `ehr-frontend/src/pages/HIVDoctorDashboard.tsx`
- `ehr-frontend/src/pages/HIPAAComplianceDashboard.tsx`
- `ehr-frontend/src/pages/AdmittedPatientPage.tsx`
- `ehr-frontend/src/pages/DoctorPatientDetail.tsx`
- `ehr-frontend/src/pages/NursePatientSummary.tsx`

Also grep `ehr-frontend/src/components/` for the same pattern — several
dashboard *pages* delegate tabbed sub-panels to embedded components (e.g.
`MentalHealthDashboard.tsx`, `MaternityDashboard.tsx` mentioned in prior
session work) that may have their own independent tab state worth wiring up
once their parent page is done.

### Recommended rollout order

1. Land Tier 1 alone first, deploy, confirm the "looks logged out" complaint
   is gone even before Tier 2 starts — it's the highest-value, lowest-risk
   change and shouldn't wait on the bigger refactor.
2. `NurseDashboard.tsx` alone as its own PR (it's the reported pain point;
   validate the `useUrlTab` pattern here before fanning out).
3. `PharmacyDashboard.tsx` and `LabDashboard.tsx` next (both already
   extensively QA-tested this session with real data — good regression
   coverage exists).
4. Remaining pages in the list above, batched a few files per PR, in
   descending order of how many roles/how often they're used.

### Tier 2 acceptance test (per dashboard)

1. Load the dashboard, note the URL has no tab param (default view).
2. Click through 4-5 different tabs. Confirm the URL updates each time
   (`?tab=vitals`, `?tab=orders`, ...).
3. Press Back repeatedly — confirm it steps backward through the exact tabs
   visited, in reverse order, re-rendering the correct panel each time, and
   eventually reaches the pre-dashboard page (not a broken/blank screen).
4. Press Forward — confirm it replays the same tabs forward correctly.
5. Copy the URL with a non-default `?tab=` value, open it in a fresh tab
   while logged in — confirm it deep-links directly to that tab.
6. Confirm no console errors and no duplicate/unnecessary re-fetching of
   data on every tab-param change (the hook should not cause each tab click
   to trigger a full remount of the dashboard shell — only content below the
   tab strip should change; if it does full-remount, the `useEffect`
   dependency arrays that fetch data are likely keyed too broadly and need
   narrowing).

---

## Non-goals / explicitly out of scope for this pass

- Full nested `<Route>`-per-tab conversion (bigger rewrite, not needed to
  fix the reported problem — see "Design" rationale above).
- A `beforeunload`/"are you sure you want to leave" interception dialog on
  Back — this fights the browser instead of fixing the underlying state
  gap, and is poor UX; do not add it.
- Wrapping every modal/drawer/filter state in URL params — scope Tier 2 to
  top-level tab/section state only, per dashboard.

## Verification before calling this done

- `cd ehr-frontend && npx tsc --noEmit -p .` must be clean (aside from the
  pre-existing, unrelated `@livekit/components-react` module-not-found
  errors in `TelehealthCallStage.tsx` / `GuestTelehealthPage.tsx` /
  `TelemedicineConsultationPage.tsx` — do not try to fix those, they're a
  separate known issue).
- Manually exercise the acceptance tests above for at least: nurse, doctor,
  pharmacist, lab tech logins (the four roles most exercised in this
  session's QA pass) after each PR.
- Commit and deploy per the project's existing workflow: commit, push to
  `main`, then on `umoya-vps` run `cd /opt/umoya && git pull` (frontend
  hot-reloads via webpack-dev-server — no container restart needed for
  frontend-only changes).
