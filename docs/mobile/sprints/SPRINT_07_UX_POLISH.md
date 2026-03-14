# Sprint 07: Polish & Consistency

## Objective

Improve design-system consistency and perceived quality through:

1. **Typography tokens** — a single type scale used across the app  
2. **Empty states with CTAs** — actionable next step on empty lists  
3. **Press feedback** on tappable cards and list rows  
4. **StatePanel** — add `info` state and align usage

---

## Duration

**1 sprint**

---

## Scope

### 1. Typography tokens

Introduce a small type scale in `design/tokens.ts` (or a dedicated `design/typography.ts`) and use it in shared UI and key screens so font sizes and weights are consistent and theming is easier.

**Proposed scale:**

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `caption` | 11 | 600 | Labels, meta text, timestamps |
| `body` | 13 | 400 | Body copy, descriptions |
| `bodyLarge` | 14 | 500 | List item titles, card subtitles |
| `title` | 16 | 700 | Section titles, card titles |
| `titleLarge` | 18 | 700 | Modal/screen titles |
| `headline` | 20–22 | 800 | Hero titles, screen headers |

**Implementation notes:**

- Export from `design/tokens.ts` or `design/typography.ts` as e.g. `fontSize.caption`, `fontWeight.semibold`, and optionally precomputed `textStyles.caption`, etc.
- Replace hardcoded `fontSize: 11`, `12`, `13`, … in shared components first: `Screen`, `Card`, `StatePanel`, `SectionHeader`, `StatusPill`, `ProviderHero`, `PatientHero`, metric grids.
- Then sweep high-traffic screens: auth, clinic select, patient home, doctor PostVisit, doctor/nurse rounds.
- Line heights: define once per token (e.g. caption 14, body 18, title 22) for readability.

**Definition of done (typography):**

- [ ] `design/tokens.ts` (or typography module) exports a type scale used by shared UI
- [ ] At least Card, StatePanel, SectionHeader, Hero components use tokens
- [ ] No hardcoded font sizes in shared components; screens may keep a few where token doesn’t fit
- [ ] Visual regression check: app looks unchanged or improved (no squashed or oversized text)

---

### 2. Empty states with CTA

Today `StatePanel` for `state="empty"` is title + message only. For main empty states, add a primary action so the user has a clear next step.

**Target empty states:**

| Screen / context | Current message | CTA (example) |
|------------------|-----------------|----------------|
| Patient home — no appointments | “No upcoming appointments” | “Book appointment” → navigate to booking or “Coming soon” |
| Patient home — no notifications | “No notifications” | Optional “Refresh” or leave as-is |
| Doctor PostVisit — no sessions | “No post-visit sessions” | “Refresh” (refetch) |
| Patient appointments list | “No upcoming appointments” | “Book appointment” |
| Inbox / Messages empty | “No messages” | “Refresh” or “Compose” if available |

**Implementation notes:**

- Extend `StatePanel` to accept an optional `actionLabel` and `onAction` (or render `children` for custom CTA). When provided, show a button below the message using theme primary button style.
- Alternatively, keep StatePanel as-is and render a separate `Pressable`/button below it on screens that need a CTA.
- Use existing routing and refetch patterns; avoid new one-off screens for “Coming soon” if a simple alert or modal suffices.

**Definition of done (empty states):**

- [ ] StatePanel supports an optional CTA (action label + onPress) or screens render CTA below panel
- [ ] Patient “no appointments” empty state has a clear CTA (e.g. Book appointment or Refresh)
- [ ] Doctor “no post-visit sessions” has Refresh CTA
- [ ] At least one other high-visibility empty state (e.g. Inbox or Messages) has a CTA
- [ ] CTAs use theme buttons; no new one-off styles

---

### 3. Press feedback on cards and list rows

Tappable cards and list rows should give immediate visual feedback on press so the app feels responsive.

**Targets:**

- Patient home: Quick Action cards, appointment cards, notification cards (if tappable)
- Doctor PostVisit: session cards (Open Contract / Quick Review)
- Doctor/Nurse: workflow cards, inbox/message list rows
- Clinic select: tenant rows
- Any shared `Card` or list row that uses `Pressable` (or will be made pressable)

**Implementation notes:**

- Use `Pressable` with `style={({ pressed }) => [baseStyle, pressed && { opacity: 0.85 }]}` or a small scale transform (e.g. `transform: [{ scale: pressed ? 0.98 : 1 }]`) for a subtle effect.
- Prefer opacity for simplicity; avoid flashy animations. Keep duration short (e.g. 100–150 ms) if using Animated.
- Ensure disabled state remains visually distinct (e.g. opacity 0.5) and does not conflict with press state.

**Definition of done (press feedback):**

- [ ] Patient home quick-action and list cards show press feedback (opacity or scale)
- [ ] Doctor PostVisit session cards show press feedback
- [ ] Clinic select tenant rows show press feedback
- [ ] At least one doctor/nurse list (e.g. inbox or workflow) has press feedback on rows
- [ ] No double feedback (e.g. both parent and child Pressable changing opacity); one clear feedback per tap

---

### 4. StatePanel — add `info` state

PostVisit (and potentially other flows) use a non-error, informational message (e.g. “Quick Review is not available on this server yet”). Currently `StatePanel` only supports `loading | empty | error | offline`. Adding `info` keeps types and UI aligned and allows a consistent look for “informational” blocks.

**Implementation notes:**

- Extend `StatePanel` props: `state: 'loading' | 'empty' | 'error' | 'offline' | 'info'`.
- For `state="info"`: no spinner; use a subtle left border or icon tint in accent teal/blue (e.g. `borderLeftWidth: 4`, `borderLeftColor: theme.colors.accentTeal`), same title/message layout. Ensure it’s visually distinct from error (no red) and from empty (optional: small info icon).
- Replace any ad-hoc “info” styling (e.g. reusing `error` or `empty`) in postvisit and elsewhere with `state="info"`.

**Definition of done (StatePanel info):**

- [ ] `StatePanel` type includes `info`
- [ ] `info` is rendered with a distinct, non-error style (e.g. teal/blue accent, no error icon)
- [ ] Doctor PostVisit “not available on this server” message uses `state="info"`
- [ ] Any other informational panels (e.g. “Coming soon” modals or in-app notices) can use `state="info"` where appropriate

---

## CI and quality gates

- Lint, typecheck, and tests stay green.
- New styles use theme tokens only; no new magic numbers for colors or spacing in shared components.
- Press feedback is subtle and does not introduce layout shift or jank.

---

## Signoff criteria

Sprint 07 is complete when:

1. A typography scale is defined and used by shared components and at least two key screens.  
2. At least three main empty states have a clear CTA (e.g. Book appointment, Refresh).  
3. Tappable cards and list rows on patient home, PostVisit, clinic select, and at least one provider list show press feedback.  
4. StatePanel supports `info` and PostVisit (and any similar flows) use it for informational messages.

---

## Definition of done (developer)

```bash
npm --prefix ./mobile-app run lint
npm --prefix ./mobile-app run typecheck
npm --prefix ./mobile-app run test
git add .
git commit -m "mobile: sprint 07 polish (typography tokens, empty-state CTAs, press feedback, StatePanel info)"
```
