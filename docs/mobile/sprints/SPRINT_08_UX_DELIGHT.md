# Sprint 08: Delight & Refinement

## Objective

Add the final layer of polish that separates “good” from “best-in-class” health apps:

1. **Haptics** — light tactile feedback on primary actions  
2. **Skeleton loaders** — replace full-screen spinners with content-shaped placeholders on key screens  
3. **Input focus state** — clear focus ring or border on focused inputs  
4. **Error boundary copy** — production-friendly, user-facing error message

---

## Duration

**1 sprint**

---

## Scope

### 1. Haptics

Add light haptic feedback on primary actions so taps feel responsive and intentional.

**Targets:**

- Auth: Login / Register submit (success and failure if desired)
- Clinic select: Tenant row selection
- Patient home: Quick Action press (if not deferred from Sprint 06)
- Doctor/Nurse: “Quick Review”, “Publish”, “Mark read”, primary send/submit buttons
- Tab bar: Optional light impact on tab switch (avoid overuse; one impact per tap is enough)
- Modal: Close and primary action in PostVisit contract modal

**Implementation notes:**

- Use `expo-haptics`: `ImpactFeedbackStyle.Light` for most buttons; optionally `NotificationFeedbackType.Success` / `Warning` for submit success/failure.
- Guard: check `await Audio.isAvailableAsync()` or platform; no-op on unsupported environments so the app does not crash.
- Do not fire haptics on every list scroll or passive gesture; limit to explicit user actions (button press, tab change, selection).

**Definition of done (haptics):**

- [ ] `expo-haptics` (or equivalent) integrated; no crash when unavailable
- [ ] Login and Register submit trigger light haptic
- [ ] At least two doctor flows (e.g. Quick Review, Publish) trigger light haptic on press
- [ ] Clinic select tenant selection triggers haptic
- [ ] Tab bar: optional light haptic on tab change (configurable or off by default if too noisy)
- [ ] No haptic on scroll or non-action gestures

---

### 2. Skeleton loaders

Replace full-screen “Loading…” or single spinner with content-shaped placeholders on key screens so users perceive progress and layout stability.

**Targets:**

- Patient home: Skeleton for hero + 2–3 card placeholders (e.g. quick actions, appointments, notifications)
- Doctor PostVisit: Skeleton for session list (e.g. 3–4 card-shaped blocks)
- Doctor Rounds: Skeleton for worklist (list of placeholder rows)
- Optional: Doctor/Nurse Inbox or Messages list skeleton

**Implementation notes:**

- Use simple View-based placeholders: rounded rectangles with theme `surface` or `card` background and optional subtle shimmer (e.g. `LinearGradient` + `Animated` or a small opacity pulse). No need for complex skeletons; “block” shapes that match card/list layout are enough.
- Show skeletons only when `isLoading && !data` (or equivalent) so they don’t flash after data is already present.
- Reuse a small set of components (e.g. `SkeletonCard`, `SkeletonLine`, `SkeletonList`) from a shared place (e.g. `features/shared/ui/Skeleton.tsx`) to keep styles consistent.

**Definition of done (skeletons):**

- [ ] Shared skeleton components (at least card and list row) in design system
- [ ] Patient home shows skeleton when dashboard/appointments/notifications are loading and no data yet
- [ ] Doctor PostVisit sessions list shows skeleton when sessions are loading
- [ ] At least one doctor or nurse list (e.g. Rounds worklist) shows skeleton when loading
- [ ] No layout shift when switching from skeleton to real content; skeleton matches approximate content size
- [ ] Spinner or StatePanel loading still used where skeleton is not (e.g. modal contract load)

---

### 3. Input focus state

Text inputs currently don’t change appearance on focus. Add a clear focus state (border or ring) so users can see which field is active.

**Targets:**

- Auth: Email and password inputs (patient and provider login, register)
- Clinic select: Search input
- PostVisit: Publish note `TextInput`
- Any other prominent `TextInput` in app (e.g. messages compose, search)

**Implementation notes:**

- Use `onFocus` / `onBlur` to set a “focused” state and apply a different border color (e.g. `theme.colors.accentTeal` or `accentBlue`) and optionally slightly thicker border or shadow. Avoid large layout changes.
- If the app uses a shared `Input` or `TextInput` wrapper, add focus styling there so all inputs benefit.
- Ensure focus state is visible in both light and dark contexts (accent colors already contrast on dark background).

**Definition of done (input focus):**

- [ ] At least auth inputs (login, register) show clear focus border/ring
- [ ] Clinic select search input shows focus state
- [ ] PostVisit publish note input shows focus state
- [ ] Focus style uses theme accent; no magic colors
- [ ] No layout jump or overflow when focus style is applied

---

### 4. Error boundary copy

The in-app error boundary already shows “Something went wrong” and “Try again” / “Go to start”. Tighten production copy so it’s concise and actionable without exposing stack traces or dev details.

**Implementation notes:**

- In production build (e.g. `!__DEV__`): show a short, friendly message only, e.g.  
  **“Something went wrong. Try again or go back to start.”**  
  Omit component stack and raw `error.message` in the UI (still log or send to crash reporting).
- Keep “Try again” and “Go to start” buttons as-is; ensure button labels are clear and accessible.
- In dev, keep existing behavior (optional stack trace or longer message) for debugging.

**Definition of done (error boundary):**

- [ ] Production error view shows only user-friendly copy (no stack trace, no raw error message in UI)
- [ ] “Try again” and “Go to start” remain; labels are accessible and clear
- [ ] Dev build can still show detailed error if desired
- [ ] Copy is concise (one short sentence + actions)

---

## CI and quality gates

- Lint, typecheck, and tests stay green.
- Haptics and animations do not block main thread; no noticeable jank.
- Skeleton and focus styles use theme only.

---

## Signoff criteria

Sprint 08 is complete when:

1. Primary actions (auth submit, clinic select, PostVisit actions, tab change) have optional light haptic where implemented.  
2. Patient home and at least two other key screens show skeleton loaders when loading and no data.  
3. Auth, clinic search, and PostVisit note inputs have a clear focus state.  
4. Error boundary shows production-safe, user-friendly copy and no dev details in release builds.

---

## Definition of done (developer)

```bash
npm --prefix ./mobile-app run lint
npm --prefix ./mobile-app run typecheck
npm --prefix ./mobile-app run test
git add .
git commit -m "mobile: sprint 08 delight (haptics, skeleton loaders, input focus, error boundary copy)"
```
