# MediCore Mobile — Polish & UX Sprints

> **Goal:** Make the app feel modern, accessible, and competitive with leading health apps through structured UX and polish work.

These sprints follow [Sprint 05: Store-Ready Builds](SPRINT_05_STORE_READY_BUILDS_AND_BETA.md) and focus on interaction quality, consistency, and delight.

---

## Sprint overview

| Sprint | Focus | Priority | Est. |
|--------|--------|----------|------|
| [Sprint 06: High-impact UX](SPRINT_06_UX_HIGH_IMPACT.md) | Pull-to-refresh, Quick Actions, tab badges, accessibility | **Must-have** | 1 sprint |
| [Sprint 07: Polish & consistency](SPRINT_07_UX_POLISH.md) | Typography tokens, empty states, press feedback, StatePanel | **Should-have** | 1 sprint |
| [Sprint 08: Delight & refinement](SPRINT_08_UX_DELIGHT.md) | Haptics, skeleton loaders, input focus, error copy | **Nice-to-have** | 1 sprint |

---

## Design contract (unchanged)

All work must stay within the existing design system:

- **Background:** `#080E1A` · **Surface:** `#0E1829` · **Cards:** `#121F33` · **Border:** `#1E3050`
- **Accents:** Teal `#00C896`, Blue `#2B7FFF`, Amber `#FFB020`, Red `#FF4D6A`, Purple `#A66CFF`, Orange `#FF7A40`
- **Text:** Primary `#E8F0FF`, Secondary `#7A92B8`, Muted `#4A6080`
- **Typography:** Sora (display), JetBrains Mono (status/mono). Strong rounded cards and pills.

---

## Success criteria (all sprints)

- No regression in existing flows; all current tests pass.
- New behavior is consistent with dark theme and accent palette.
- Accessibility improvements do not reduce usability for non–screen-reader users.
- Performance: no added jank; pull-to-refresh and skeletons must feel smooth.

---

## Quick reference

| Area | Sprint 06 | Sprint 07 | Sprint 08 |
|------|-----------|------------|-----------|
| **Lists & feeds** | Pull-to-refresh | — | Skeleton loaders |
| **Navigation** | Tab bar badges | — | — |
| **Patient home** | Quick Actions wired | — | — |
| **Accessibility** | Labels, hints, roles | — | — |
| **Design system** | — | Typography tokens | Input focus state |
| **Empty / error** | — | Empty-state CTAs, StatePanel `info` | Error boundary copy |
| **Touch feedback** | — | Press states on cards | Haptics |

---

*Last updated: 2025. See individual sprint files for scope, tasks, and signoff.*
