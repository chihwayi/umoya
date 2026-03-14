# Sprint 06: High-Impact UX

## Objective

Ship the four changes that most improve perceived quality and parity with leading health apps:

1. **Pull-to-refresh** on all main list and feed screens  
2. **Quick Actions** on patient home that navigate or show clear intent  
3. **Tab bar badges** for unread counts (Inbox, Messages)  
4. **Accessibility** labels, hints, and roles on primary controls

---

## Duration

**1 sprint**

---

## Scope

### 1. Pull-to-refresh

| Screen / flow | Component | Action on refresh |
|---------------|-----------|-------------------|
| Patient home | `ScrollView` | Refetch dashboard summary, appointments, notifications, messages |
| Patient appointments (if list screen exists) | List | Refetch appointments |
| Patient notifications | List / ScrollView | Refetch notifications |
| Doctor Rounds | List / ScrollView | Refetch HIV cohort worklist (or equivalent feed) |
| Doctor PostVisit | ScrollView (sessions list) | Refetch post-visit sessions |
| Doctor Inbox | List | Refetch provider inbox |
| Doctor Messages | List | Refetch threads / unread |
| Nurse worklist / shift / vitals | Primary list | Refetch relevant queries |
| Clinic select | Tenant list | Refetch active tenants |

**Implementation notes:**

- Use React Native `RefreshControl` with `refreshing` and `onRefresh`.
- `onRefresh` should call the appropriate TanStack Query `refetch()` (e.g. from `useQuery` return).
- Use theme accent for spinner: `colors.accentTeal`.
- Optional: slight haptic on refresh trigger (can be deferred to Sprint 08).

**Definition of done (pull-to-refresh):**

- [ ] Patient home: pull to refresh refetches dashboard-related queries
- [ ] Doctor PostVisit: pull to refresh refetches sessions
- [ ] Doctor Rounds: pull to refresh refetches worklist
- [ ] Doctor Inbox: pull to refresh refetches inbox
- [ ] Doctor Messages: pull to refresh refetches messages/threads
- [ ] Nurse primary list screens: pull to refresh refetches data
- [ ] Clinic select: pull to refresh refetches tenants
- [ ] Spinner color matches theme; no layout jump when refresh appears

---

### 2. Quick Actions (patient home)

Current “Quick Actions” are non-interactive text cards. Each must do one of:

- **Navigate** to an existing screen (e.g. appointments, bills, messages, PostVisit companion), or  
- **Show a “Coming soon” or disabled state** with a short tooltip or modal so the user understands the feature is planned.

| Action | Preferred behavior |
|--------|----------------------|
| Book Appointment | Navigate to appointments or booking flow if it exists; else “Coming soon” |
| Join Telemedicine | Navigate to telemedicine/consultation entry if it exists; else “Coming soon” |
| View Bills | Navigate to patient bills screen |
| Medication Reminders | Navigate to medications/reminders screen |
| Message Clinic | Navigate to messages |
| PostVisit Companion | Navigate to patient PostVisit screen |

**Implementation notes:**

- Wrap each quick-action card in `Pressable` with `onPress`.
- Use `router.push()` or `router.replace()` for navigation; keep hrefs consistent with `app/patient/` routes.
- For “Coming soon”: use a small modal or `Alert.alert` with a single OK, or an inline `StatePanel` state="info" (after Sprint 07 StatePanel update).
- Preserve existing styling (border, padding, text); add press state (e.g. opacity 0.8) for feedback.

**Definition of done (Quick Actions):**

- [ ] All six quick actions are pressable
- [ ] At least “View Bills”, “Message Clinic”, “PostVisit Companion” (and any other existing screens) navigate to the correct route
- [ ] Actions without a screen show a clear “Coming soon” (or equivalent) message
- [ ] Press feedback (opacity or scale) on each card
- [ ] No regression in layout or styling of the Quick Actions grid

---

### 3. Tab bar badges

Show unread counts on tabs where it matters:

| Role | Tab | Badge source |
|------|-----|--------------|
| Doctor | Inbox | Provider unread count |
| Doctor | Messages | Unread message count (or thread count with unread) |
| Nurse | Inbox / Messages | Same pattern if tabs exist |
| Patient | Messages (if in tab bar) | Unread message count |

**Implementation notes:**

- Use Expo Router tab option `tabBarBadge: number | string`. Hide badge when count is 0 (use `undefined` or do not set).
- Get counts from existing TanStack Query data (e.g. `getProviderUnreadCount`, patient messages unread).
- Cap display at 99 (show “99+” if needed) for readability.
- Style: ensure badge is visible on dark tab bar (theme.surface/border); use accent or high-contrast color per platform.

**Definition of done (tab badges):**

- [ ] Doctor Inbox tab shows unread count when > 0
- [ ] Doctor Messages tab shows unread count when > 0
- [ ] Nurse tabs show unread counts if same APIs exist
- [ ] Patient tab bar shows message unread count if Messages is a tab
- [ ] Badge hidden when count is 0; no “0” displayed
- [ ] Badge readable on dark background

---

### 4. Accessibility

Add `accessibilityLabel`, `accessibilityHint`, and `accessibilityRole` to:

- Primary buttons (login, submit, “Mark read”, “Quick Review”, “Publish”, etc.)
- Tab bar items (handled by Expo Router / React Navigation; verify labels)
- Key list items (e.g. appointment cards, notification cards, session cards) so screen-reader users can distinguish and activate the right action
- Form inputs (patient/provider login, clinic search, post-visit note)
- Modal close and primary action in PostVisit contract modal

**Implementation notes:**

- Prefer short, action-oriented labels: e.g. “Log in”, “Mark notification as read”, “Open contract for [Patient name]”.
- Hints can be one short phrase: e.g. “Double tap to open the post-visit contract.”
- Roles: `button`, `link`, `header`, `text`, `search`, `summary` as appropriate. Avoid overusing `image` for decorative elements.
- Test with VoiceOver (iOS) and TalkBack (Android) on at least one flow per role (login, home, one list, one primary action).

**Definition of done (accessibility):**

- [ ] All primary buttons have `accessibilityLabel` (and `accessibilityRole="button"` where applicable)
- [ ] Key list/card items have meaningful labels (e.g. “Appointment with Dr. X on [date]”)
- [ ] Login and clinic-select inputs have labels and hints
- [ ] PostVisit modal: Close and Publish have labels and hints
- [ ] No critical accessibility warnings in IDE or from automated checks
- [ ] Smoke test with screen reader on one doctor and one patient path

---

## CI and quality gates

- Existing lint, typecheck, and tests remain green.
- New code follows project style (theme colors, spacing, no inline magic numbers for colors).
- No new accessibility regressions (manual check + any existing a11y tooling).

---

## Signoff criteria

Sprint 06 is complete when:

1. Pull-to-refresh works on all listed screens with theme-consistent spinner.
2. Patient home Quick Actions are wired (navigation or “Coming soon”) with press feedback.
3. Tab bar badges show unread counts and hide when zero.
4. Primary controls and key list items have appropriate accessibility labels/hints/roles and pass a basic screen-reader smoke test.

---

## Definition of done (developer)

```bash
npm --prefix ./mobile-app run lint
npm --prefix ./mobile-app run typecheck
npm --prefix ./mobile-app run test
git add .
git commit -m "mobile: sprint 06 high-impact UX (pull-to-refresh, Quick Actions, tab badges, a11y)"
```
