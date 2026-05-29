# UMOYA — Brand Identity & Design System

---

## The Name

**UMOYA** (pronounced *oo-MOH-yah*) means **breath · spirit · life force** in Zulu and Ndebele — two of the eight languages natively supported by the platform. In Bantu languages across the SADC region, the root carries the sense of vital essence, the animating principle, and the continuity of being.

Clinically, breath is the first thing assessed on any patient and the last vital sign that leaves them. It is what medicine monitors, protects, and restores. The name does not borrow this meaning — it is the actual cultural and clinical fabric the platform was built on.

---

## Tagline Options

**Primary:**
> *Breath. Intelligence. Continuity of Care.*

**Secondary options:**
> *The Operating System for Connected Care.*
> *Clinical intelligence. Human at its core.*
> *Every breath. Every patient. Every facility.*
> *Where AI meets African healthcare.*
> *Care without boundaries.*

---

## Brand Voice

| Quality | What it means in practice |
|---|---|
| **Authoritative** | Write like a senior clinician, not a startup. Confident, precise, no filler. |
| **Human** | Technology serves people — never let the system sound cold or robotic. |
| **African** | Rooted in the region. SADC, Ubuntu, community-of-care. Not borrowed from Silicon Valley. |
| **Transparent** | Every AI decision is explainable. Every alert has a reason. No black boxes. |
| **Minimal** | Say one thing clearly. No jargon stacks. No buzzword soup. |

### Tone by surface
- **Clinical staff UI:** Direct, efficient, no ceremony. "Patient checked in. Queue position: 3."
- **Patient-facing UI:** Warm, clear, non-medical language. "You're all set. The doctor will see you soon."
- **Management dashboards:** Data-first, precise. Numbers speak; copy frames.
- **Marketing / landing page:** Confident, visionary, SADC-grounded.

---

## Logo

### Concept: The Breath Pulse

The UMOYA mark is a single continuous line — an ECG-style breath waveform that rises, peaks, and resolves into an upward-curving leaf tip. It reads simultaneously as:

- A **breath waveform** — the clinical heartbeat of the platform
- A **leaf** — life, growth, the African continent, nature
- The letter **U** — read as a monogram when cropped to an icon

The line is unbroken from start to finish, representing the **continuity of care** from first breath to discharge and beyond.

### Mark Geometry

```
     ╭─╮
    /   \          ╭─leaf tip
   /     \        /
──╯       ╰──────╯
  breath rise  resolve
```

- Stroke weight: medium (not hairline, not heavy) — confident but not aggressive
- Start and end: open — the care loop never closes, it continues
- Curve at resolution: upward — optimism, life, not flatline

### Wordmark

**UMOYA** — set in **Plus Jakarta Sans** (or **Satoshi**), weight 600 (Semi-Bold), tracked at +20 (wide spacing). All caps or title case both work; title case (*Umoya*) is warmer for patient surfaces, all caps (*UMOYA*) is stronger for enterprise/hospital contexts.

The mark sits to the left of the wordmark. Minimum clearspace: equal to the cap-height of the "U" on all sides.

---

## Color System

### Primary Palette

| Token | Name | Hex | Usage |
|---|---|---|---|
| `--umoya-teal` | Breath Teal | `#0AA98A` | Primary brand, CTAs, active states, AI indicators |
| `--umoya-forest` | Forest Green | `#1B6B3A` | Secondary brand, success states, African identity |
| `--umoya-deep` | Deep Night | `#080E1A` | Dark surface backgrounds |
| `--umoya-midnight` | Midnight Blue | `#0C1528` | Card/panel backgrounds |
| `--umoya-surface` | Surface | `#111E35` | Elevated surfaces, modals |

### Accent Palette

| Token | Name | Hex | Usage |
|---|---|---|---|
| `--umoya-coral` | Warm Coral | `#E8614D` | Critical alerts, urgent states, CTAs on dark |
| `--umoya-amber` | Alert Amber | `#F0954A` | Warnings, high-severity, caution |
| `--umoya-sky` | Sky Blue | `#3B9EFF` | Info, links, secondary actions |
| `--umoya-violet` | Nurse Violet | `#9B6BFF` | Nursing workflows, secondary module accent |

### Neutral Palette

| Token | Name | Hex | Usage |
|---|---|---|---|
| `--umoya-white` | Pure White | `#FFFFFF` | Text on dark, icons |
| `--umoya-text` | Text Primary | `#E2EDF8` | Body text on dark backgrounds |
| `--umoya-text-2` | Text Secondary | `#7A9CBC` | Supporting text, labels |
| `--umoya-text-3` | Text Muted | `#3D607F` | Placeholders, disabled states |
| `--umoya-border` | Border | `#162440` | Dividers, input borders |
| `--umoya-light-bg` | Light Background | `#F5F8FA` | Light mode page background |
| `--umoya-light-surface` | Light Surface | `#FFFFFF` | Cards on light background |
| `--umoya-light-text` | Light Body Text | `#0F1F2E` | Text on light backgrounds |

### Color Ratio (dark surfaces)
- 60% Deep Night / Midnight backgrounds
- 30% Breath Teal / Forest Green brand elements
- 10% Coral / Amber accents

### Semantic Color Assignments

| Clinical state | Color | Hex |
|---|---|---|
| Normal / stable | Forest Green | `#1B6B3A` or `#22C55E` |
| Monitor / advisory | Amber | `#F0954A` |
| High risk / urgent | Coral | `#E8614D` |
| Critical | Deep Red | `#C62828` |
| AI active | Breath Teal | `#0AA98A` |
| Offline | Text Muted | `#3D607F` |

---

## Typography

### Typefaces

| Role | Typeface | Weight | Notes |
|---|---|---|---|
| **Display / Hero** | Plus Jakarta Sans | 700–800 | Landing page headlines, large dashboard numbers |
| **UI / Body** | Plus Jakarta Sans | 400–600 | All interface text |
| **Monospace** | JetBrains Mono | 400–700 | Code, IDs, reference numbers, timestamps |
| **Mobile** | Sora (existing) | 400–800 | Existing mobile font — keep for consistency |

### Type Scale (web)

| Level | Size | Weight | Usage |
|---|---|---|---|
| `display` | 56px / 3.5rem | 800 | Hero headline |
| `h1` | 40px / 2.5rem | 700 | Page titles |
| `h2` | 28px / 1.75rem | 700 | Section headings |
| `h3` | 20px / 1.25rem | 600 | Card headings |
| `h4` | 16px / 1rem | 600 | Sub-headings, labels |
| `body` | 15px / 0.94rem | 400 | Body text |
| `small` | 13px / 0.81rem | 400 | Supporting text |
| `micro` | 11px / 0.69rem | 500 | Badges, chips, timestamps |

### Letter spacing
- Display / headings: `-0.02em` (tight, premium)
- Body: `0` (natural)
- All caps labels / badges: `+0.08em` (readable)
- Wordmark: `+0.12em` (distinctive)

---

## Iconography

- Style: **Lucide React** (already in use) — 1.5px stroke, rounded caps
- Size grid: 16 / 20 / 24 / 32px
- Colour: inherits from context (text-teal on dark, text-forest on light)
- Never fill icons solid unless indicating "active" state
- Avoid mixing icon libraries within a single screen

---

## Motion

- Transitions: `200ms ease-out` for state changes, `300ms ease-in-out` for panels/modals
- The breath pulse in the logo can animate on loading screens: a subtle inhale-exhale scale loop (`scale: 0.97 → 1.03 → 1.0`, 2s loop)
- Avoid animation on clinical data — numbers and alerts must never feel playful

---

## UI Component Patterns

### Buttons
- **Primary:** Breath Teal fill, white text, `border-radius: 10px`, `padding: 12px 24px`
- **Secondary:** Teal border + teal text, transparent fill
- **Danger:** Coral fill, white text
- **Ghost:** No border, text only, teal on hover

### Cards (dark)
- Background: `#111E35`
- Border: `1px solid #162440`
- Border-radius: `14px`
- Box-shadow: `0 4px 16px rgba(0,0,0,0.4)`

### Cards (light)
- Background: `#FFFFFF`
- Border: `1px solid #E2EBF2`
- Border-radius: `14px`
- Box-shadow: `0 2px 8px rgba(10,169,138,0.06)`

### Badges / Status chips
- Pill shape (`border-radius: 99px`)
- Padding: `2px 10px`
- Font: `11px / 500 / +0.08em tracking`
- Colour: semantic (see Semantic Color Assignments above)

---

## System Name Usage Rules

| Context | Correct usage |
|---|---|
| Full brand name | **UMOYA** or **Umoya** |
| Product name | **Umoya EHR** or **Umoya Health** |
| Mobile app | **Umoya Clinical** |
| Patient portal / app | **Umoya** |
| Admin portal | **Umoya Admin** |
| API / technical docs | `umoya` (lowercase, no spaces) |
| Domain | `umoya.health` or `umoyahealth.com` (verify availability) |
| Bundle ID | `com.umoya.clinical` |
| Docker / container prefix | `umoya-` |
| Environment variable prefix | `UMOYA_` (where previously `UMOYA_`) |
| GitHub org / repo | `umoya` / `umoya-ehr` |
| Database name | `umoya` |
| S3/MinIO bucket prefix | `umoya-` |

---

## What Not to Do

- Do not use "Umoya" anywhere in user-facing text
- Do not use the red cross or stethoscope as primary logo elements
- Do not use bright neon or startup-gradient aesthetics
- Do not use robotic AI imagery — UMOYA is human-centred
- Do not write taglines with words like "revolutionary," "disruptive," or "game-changing"
- Do not abbreviate to "UMO" — the full name is short enough
- Do not use the logo on a busy photographic background without a colour buffer

---

## Landing Page Hero Copy

```
UMOYA

Breath. Intelligence. Continuity of Care.

The clinical operating system built for Africa and the world —
AI-first, offline-capable, and deeply human.

[Request Access]  [Explore Features]
```

### Supporting section headlines

- *Care that follows the patient, not the paper*
- *Every vital sign. Every diagnosis. Every facility.*
- *AI that works at the bedside, not in a slide deck.*
- *From a rural clinic to a national ministry — one platform.*
- *The system that knows when a patient is at risk before symptoms appear.*
- *Offline-first. Because care cannot wait for a signal.*
- *Eight languages. One continuum of care.*

---

*Brand document version 1.0 — 2026-05-29*
