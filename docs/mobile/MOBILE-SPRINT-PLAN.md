# MediCore Mobile App — Sprint Plan S109–S118

> **Platform:** React Native + Expo SDK 52
> **Branch convention:** `codex/mobile-sprint-{sprint}-{slug}`
> **Design tokens:** `#080E1A` bg · `#00C896` teal · `#2B7FFF` blue · `#A66CFF` purple · `#FF4D6A` red · `#FF7A40` amber
> **Fonts:** Sora (UI) + JetBrains Mono (vitals/numbers)
> **State:** Zustand · **Navigation:** React Navigation v7 · **Storage:** Expo SecureStore + AsyncStorage

---

## Sprint S109 — Foundation: Project Setup, Design System, Auth & Multi-Tenant

**Goal:** A running Expo app with the full dark design system, working tenant selection (persisted), and a working login screen for all three roles. No features yet — just the shell that every subsequent sprint builds on.

### Deliverables

#### 1. Expo Project Scaffold
- Initialize Expo with TypeScript template inside `mobile/`
- Install core dependencies:
  - `react-navigation/native` + `react-navigation/bottom-tabs` + `react-navigation/stack`
  - `expo-secure-store` (tokens + tenant)
  - `@react-native-async-storage/async-storage` (UI preferences)
  - `zustand` (global state)
  - `axios` (HTTP, configured per tenant)
  - `expo-notifications` (foundation only, actual push in S116)
  - `expo-font` (Sora + JetBrains Mono via Google Fonts)
  - `react-native-reanimated` (animations)
  - `react-native-svg` (icons + sparklines)
  - `expo-local-authentication` (biometric PIN for patient login)
  - `expo-camera` (QR scan for patient login)
- EAS Build configuration (`eas.json`) for development + preview + production profiles
- `.env` setup: `EXPO_PUBLIC_API_BASE`, `EXPO_PUBLIC_WS_BASE`

#### 2. Design System (`mobile/src/design/`)
Create the following shared primitives used by every screen:

**`tokens.ts`**
```
C = {
  bg: '#080E1A',
  surface: '#0E1829',
  card: '#121F33',
  border: '#1A2B45',
  borderLight: '#243550',
  teal: '#00C896',
  blue: '#2B7FFF',
  purple: '#A66CFF',
  red: '#FF4D6A',
  amber: '#FF7A40',
  green: '#00C896',
  textPrimary: '#E8F0FA',
  textSecondary: '#8FA8CC',
  textMuted: '#4A6A8A',
}
FONT = { ui: 'Sora', mono: 'JetBrainsMono' }
RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, pill: 99, card: 14 }
```

**Components to build (`mobile/src/components/ui/`):**
- `Badge` — colored pill label (severity, status)
- `AiBadge` — animated gradient badge ("AI", "CDSS", "COPILOT", "POSTVISIT AI")
- `AiPulse` — pulsing AI orb for PostVisit AI entry points
- `Dot` — colored status indicator dot (with optional pulse animation)
- `Card` — dark card container with border
- `SectionHeader` — section label with optional "See all" action
- `ScreenHeader` — top bar with title, subtitle, accent color, optional extra slot
- `Icon` — SVG path renderer (all icons defined as path strings in `icons.ts`)
- `Sparkline` — SVG trend chart with reference range band (used in lab results)
- `SlaTimer` — animated countdown ring for escalation SLA (seconds remaining, color shifts red as time runs out)
- `Spinner` — loading indicator in teal

#### 3. Navigation Shell
Three separate navigator trees merged under `RootNavigator`:

```
RootNavigator (Stack)
  ├── TenantSelectScreen          (shown when no tenant in SecureStore)
  ├── LoginScreen                 (shown when tenant exists but no JWT)
  └── MainNavigator (Stack)
       ├── DoctorNavigator        (Bottom Tabs)
       ├── NurseNavigator         (Bottom Tabs)
       └── PatientNavigator       (Bottom Tabs)
```

Each role navigator is a bottom tab navigator. Tab definitions:

**Doctor tabs:** Rounds | PostVisit | Inbox | Messages | AI
**Nurse tabs:** Shift | Vitals | Messages
**Patient tabs:** Home | PostVisit | Meds | Bills | Health

Bottom tab bar: dark `#0E1829` background, active tab highlighted with role accent color in a pill behind the icon, inactive icons muted.

Status bar: dark content. Time display top-left. Notification bell top-right with unread badge.

#### 4. Tenant Selection Screen
- Search field: user types clinic name or subdomain
- Option to scan QR code (camera permission requested)
- On selection/scan: store `{ slug, name, logoUrl, primaryColor, baseUrl }` in `SecureStore` key `medicore_tenant`
- Clinic branding shown after selection (logo + name)
- "Confirm and continue" navigates to Login
- This screen is **never shown again** after tenant is stored, unless user explicitly taps "Change Clinic" from the profile/settings menu

#### 5. Login Screen
- Clinic logo + name displayed at top (loaded from SecureStore)
- Role picker: Doctor | Nurse | Patient (tab selector)
- **Doctor/Nurse login:** Email + Password → POST `/auth/login` → store JWT in SecureStore `medicore_jwt`
- **Patient login — OTP flow:** Phone number input → POST `/auth/patient/otp-request` → OTP input → POST `/auth/patient/otp-verify` → store JWT
- **Patient login — QR flow:** Scan QR button → camera opens → QR decoded → pre-fills tenant + MRN + one-time token → auto-authenticates → patient sets 4-digit PIN
- After first patient login: subsequent logins show phone + 4-digit PIN only (biometric available if device supports it)
- "Forgot PIN" → re-triggers OTP flow
- "Change Clinic" link at bottom of screen

#### 6. Auth State (Zustand `useAuthStore`)
```
{
  jwt: string | null,
  role: 'doctor' | 'nurse' | 'patient' | null,
  user: { id, name, tenantSlug, ... } | null,
  tenant: { slug, name, logoUrl, baseUrl } | null,
  login: (jwt, role, user) => void,
  logout: () => void,  // clears JWT, keeps tenant
  clearTenant: () => void,  // clears both (Change Clinic)
}
```

#### 7. API Client (`mobile/src/services/api.ts`)
- Axios instance pre-configured with `baseURL` from tenant `baseUrl`
- Request interceptor: attaches `Authorization: Bearer {jwt}` + `X-Tenant-ID: {slug}`
- Response interceptor: 401 → logout + navigate to Login
- WebSocket client factory: `createWsClient(path)` → returns a WebSocket instance with auto-reconnect

---

## Sprint S110 — Doctor: Ward Rounds + PostVisit AI Signoff

**Goal:** The two most critical doctor screens. A doctor can see all patients on rounds with live alerts, then review and sign AI-drafted consultation notes, which immediately become visible to the patient.

### Screens

#### Ward Rounds Screen (`DoctorRoundsScreen`)
**Data:** `GET /ehr/patients/ward-rounds` → list of admitted patients

**Patient card displays:**
- Patient name, age, ward, bed ID, primary diagnosis
- Severity badge: CRITICAL (red) / WARNING (amber) / HIGH (amber) / STABLE (green) — driven by the most severe active alert
- Inline vitals row: BP, SpO₂, HR, K+ — displayed in monospace font. Abnormal values highlighted in red/amber automatically (SpO₂ < 94% → red, BP systolic > 160 → amber, etc.)
- Alert tags row: each alert shown as a small pill with warning icon (e.g., "Critical: SpO₂ 88%", "Troponin 2.4", "K+ 6.8 — CRITICAL")
- Left border colored by severity

**Header:**
- Doctor name and "Ward Rounds" title
- Stats row: total patients / active escalations / pending PostVisit signoffs
- PostVisit AI banner: gradient card showing number of pending signoffs → taps into PostVisit tab

**Realtime:** WebSocket subscription on mount (`/ws/ward-alerts?tenant={slug}`). Incoming messages update the patient list without full refresh. New critical alert → brief haptic feedback + patient card animates to top if severity = CRITICAL.

**Patient card actions:**
- Tap card → Patient Detail Sheet (bottom sheet): full vitals history, active orders, medications list, diagnosis list, CDSS alerts
- Long-press → Transfer Patient action (bottom sheet with bed selector)

**Bed transfer flow:**
- Ward + bed selector (fetched from `GET /ehr/beds/available`)
- Transfer note field (typed or voice-dictated)
- Confirm → `POST /ehr/patients/{id}/transfer` → ward rounds list updates in real-time
- Receiving doctor (if different) gets a push notification

**Search/filter bar:**
- Filter by ward (All / Cardiology / Maternity / General / HIV)
- Search by patient name or bed ID

#### PostVisit AI Signoff Screen (`DoctorPostVisitScreen`)

**Overview:** This screen is where the PostVisit AI magic happens for clinicians. After a consultation is recorded (web EHR), the AI generates a structured clinical note. The doctor reviews it on mobile and signs with one tap.

**Data:** `GET /postvisit/sessions/pending?status=unsigned` — returns all unsigned AI drafts for this doctor

**Session card displays:**
- Patient name, session time, session duration, session ID (e.g., PV-2240)
- AI confidence score (e.g., 96%) shown as a colored circle (green ≥ 90, amber 75-89, red < 75)
- Extracted clinical entities: diagnoses, medications, lab values, referrals — shown as blue chips
- **AI Draft section** (the note itself):
  - Header: "AI DRAFT" badge + "citation-grounded" label
  - The drafted note text in full — this is the complete clinical note written by the PostVisit AI, containing:
    - **What was discussed during the consultation** (derived from voice/text transcription)
    - **What the patient reported** (symptoms, complaints, history)
    - **What was found on examination** (vitals, physical exam findings)
    - **What the conclusion was** (diagnosis, ICD-10 code, severity)
    - **What the plan is** (medications, doses, investigations, referrals, admissions)
    - Structured as SOAP: Subjective / Objective / Assessment / Plan
  - The draft is editable — tap any section to open a text editor
- **Safety flags row:** "Critical lab cited" / "Drug interaction verified" / "WHO guideline applied" / "PHI-minimized" — each with a green shield icon
- **Actions:** Edit (opens editable text view) | Sign & Publish (single tap)

**Sign & Publish:**
- Tapping signs the note with doctor's credentials
- `POST /postvisit/sessions/{id}/sign`
- Note immediately published to the patient's PostVisit tab (they receive a push notification)
- Session card transitions to "Signed & Published" state (green checkmark)
- Badge count on tab decrements

**Batch sign:** If all pending sessions are standard (confidence ≥ 90%, no critical flags), a "Review All & Sign 3" button appears at the top — shows a swipeable review flow and signs all in sequence.

**Edit flow:**
- Inline edit mode: each SOAP section becomes an editable textarea
- AI can re-draft if doctor adds a voice note: microphone icon in edit mode → appends dictated text → AI re-processes and shows diff
- Save → stores draft locally until explicitly signed

---

## Sprint S111 — Doctor: CDSS + Voice Dictation

**Goal:** The clinical decision support screen and voice-to-SOAP dictation. These are standalone AI tools the doctor uses mid-consultation or during rounds.

### Screens

#### CDSS Screen (`DoctorCDSSScreen`)

**Six tool buttons (3x2 grid):**
| Tool | Accent | Function |
|------|--------|----------|
| Drug Interactions | Purple | Check two or more drugs for interactions |
| Dose Calculator | Teal | Weight-based dosing with renal adjustment |
| Risk Scores | Amber | CHADS₂, HEART, Child-Pugh, WELLS, qSOFA |
| WHO Guidelines | Blue | Search WHO Smart Guidelines by condition |
| Dx Suggest | Green | Differential diagnosis from symptoms |
| Lab Interpret | Red | Explain lab result in clinical context |

**Search bar:** Free-text input. Examples: "aspirin warfarin", "metformin eGFR 35", "chest pain ECG changes"

**Result card:**
- Severity badge: HIGH (red) / MED (amber) / LOW (green) / INFO (blue)
- Title + full explanation text
- Evidence source: "WHO EML 2023 · CDSS-verified" / "KDIGO 2022 · WHO Guideline" etc.
- "Save to Patient Record" button (associates result with the currently open patient encounter if applicable)

**API:** `POST /cdss/guidelines/check` — same endpoint already implemented on the web

**Recent queries:** Last 5 queries stored locally (AsyncStorage), shown as quick-tap chips below the search bar.

#### Voice Dictation Screen (`DoctorDictateScreen`)

**Purpose:** Doctor speaks about a patient encounter. AI structures it into a complete SOAP note with medication orders and investigation orders.

**UI:**
- Large microphone button centered on screen (96px circle)
  - Idle: teal/blue gradient, "Tap mic to dictate"
  - Recording: red/orange gradient, ripple animation rings expanding outward, "Recording — tap to stop" in red
  - Processing: spinner, "Processing..."
- Tap to start → start recording (Expo `Audio.Recording`)
- Tap to stop → stop recording → send audio file to `POST /ai/dictate` → receive structured note

**AI-structured output:**
```
SOAP Note:
  S — Subjective (what the patient told the doctor)
  O — Objective (examination findings, vitals from the session)
  A — Assessment (diagnosis with ICD-10)
  P — Plan (medications, investigations, referrals, admissions)

Extracted orders:
  Medications: [{ name, dose, route, frequency }]
  Investigations: [{ type, urgency }]

Confidence score: 0–100%
```

**After processing:**
- SOAP sections displayed with editable text per section
- Medications + investigations shown in two columns
- AI confidence badge
- "Save to Patient Record" button → `POST /ehr/encounters/{id}/note`
- "Send to PostVisit Queue" button → creates a pending PostVisit session for signoff

**Patient context:** A patient selector at the top of the screen. If the doctor navigated here from a patient card, the patient is pre-selected. Otherwise, search by name/MRN.

---

## Sprint S112 — Nurse: Shift Dashboard, Vitals, Escalation

**Goal:** The nurse's complete mobile workflow — shift task management, patient vitals recording with AI interpretation, and the escalation system.

### Screens

#### Shift Dashboard (`NurseShiftScreen`)

**Two sub-tabs: Worklist | Triage**

**Worklist sub-tab:**
- Summary stats at top: Urgent count (red) / High count (amber)
- AI Copilot banner: "AI-assisted triage · vitals · escalation · handoff"
- Task list — each task card shows:
  - Patient name + severity badge (URGENT/HIGH/MED)
  - Task description (e.g., "BP recheck", "Insulin (BCMA scan)", "Fetal monitoring strip")
  - Bed number + due time
  - Escalate button (red pill, shown only on critical/escalatable tasks)
  - Completion checkbox (right side) — tap to toggle done
  - Done tasks shown muted/strikethrough with opacity 0.6

**AI Handoff card** at the bottom of the worklist:
- Auto-generated end-of-shift summary
- Lists each high-priority patient with the key clinical event: "C-12 (Moyo): SpO₂ escalation sent", "M-03 (Ncube): BP trending", etc.
- "Generate Full Handoff Report" button → `POST /ai/handoff-summary` → opens a share sheet with the formatted report

**Triage sub-tab:**
- ESI 1-5 scoring for ED patients
- Each patient card: complaint, ESI level (large colored number), wait time
- ESI 1-2 → red left border + Escalate button shown
- "Start Assessment with AI Copilot" button → opens Assessment Sheet

**Assessment Sheet (bottom sheet):**
- Patient chief complaint pre-filled
- Nurse records rapid assessment: vitals, symptoms, pain scale
- AI suggests ESI score based on input
- Nurse confirms or overrides
- Submit → creates triage record + updates queue

#### Escalation Modal (`EscalateModal`)
Triggered from any task card or triage card. Bottom sheet overlay.

**Fields:**
- Severity selector: CRITICAL (red) / HIGH (amber) / MED (blue) — selected by default based on task priority
- Doctor selector: dropdown of available doctors (ward lead, on-call, cardiologist, etc.) from `GET /staff/on-duty`
- Clinical Finding: multi-line text input — required
- "Dictate finding" mic icon → voice input populates the field

**On send:**
- `POST /escalations` with severity, doctorId, patientId, finding
- SLA timer starts on the doctor's side immediately
- Nurse sees "Escalation Sent" confirmation screen with doctor name and audit trail confirmation
- Task card on the nurse's list updates to show "Escalated" badge

#### Vitals Recording Screen (`NurseVitalsScreen`)

**Patient selector at top** — search by name or bed. Recent patients shown as quick-select chips.

**Vitals entry grid (2 columns):**
- Systolic BP (mmHg)
- Diastolic BP (mmHg)
- Heart Rate (bpm)
- Temperature (°C)
- SpO₂ (%)
- Respiratory Rate (/min)
- Pain Score (/10)
- Blood Glucose (mmol/L) — optional

Each field: large monospace number input with unit label. Tap to edit via numeric keyboard.

**Bluetooth import button** (future-ready): "Import from device" pill at top of grid. Tapping shows a scan sheet (implementation in S115 Bluetooth sprint, this sprint shows "coming soon" toast).

**"Interpret with AI Copilot" button:**
- Sends all entered vitals to `POST /ai/vitals/interpret` with patient context
- Returns:
  - Narrative interpretation: "BP prehypertensive. SpO₂ normal. No immediate clinical concern."
  - Abnormal flags: e.g., `[{ vital: 'SpO2', value: 88, severity: 'critical', message: 'SpO₂ critically low — escalate immediately' }]`
  - If any flag is CRITICAL → interpretation card rendered in red + an "Escalate Now" button appears inline

**Save Vitals button:**
- `POST /ehr/vitals` with patientId, timestamp, all values
- On success → toast "Vitals saved for [patient name]"
- On critical vitals → automatic notification sent to the patient's ward doctor

---

## Sprint S113 — Patient: Home + PostVisit AI (Core Experience)

**Goal:** The patient-facing PostVisit AI experience — the highest-value patient feature. A patient opens the app, sees their signed visit note, reads it in plain language, and chats with an AI that explains everything about their consultation.

### Screens

#### Patient Home Screen (`PatientHomeScreen`)

**Greeting bar:**
- "Good morning, [First Name]" with current time of day
- Dynamic: "Good afternoon" / "Good evening" based on hour

**PostVisit AI Banner (hero card):**
- Only shown when there is at least one signed note available
- Teal gradient card with `AiPulse` orb
- "PostVisit AI" title with live pulse dot
- Subtitle: "Dr. [name] signed your visit summary." + visit date
- "View summary + ask AI →" tap target
- If multiple signed notes → "3 visit summaries available →"
- Tapping navigates to PostVisit tab focused on the most recent note

**Medication Reminder Strip:**
- Shows the next due medication and time
- Tap → navigates to Meds tab
- Badge shows total doses due today
- If a dose is overdue → strip turns amber

**Recent Lab Results:**
- Last 3 results with name, value (monospace), date, status dot (green/amber/red)
- Tap any result → navigates to Health tab → Labs sub-tab
- "See all" → Health tab

**Quick Actions (2x2 grid):**
- Book Appointment (teal)
- Telehealth (blue) — video call with doctor
- Pay Bills (amber) → Bills tab
- Symptom Checker (purple) — AI triage

#### Visit Summary Screen (`PatientVisitScreen`)

This is the PostVisit AI patient experience. Two tabs: Visit Summary | AI Chat.

**Visit Summary tab:**

Header shows:
- Visit date (calendar-style: month + day number in blue box)
- Visit type (Office Visit / Telehealth / Emergency / Follow-up)
- Doctor name + specialty (in teal)

Quick Summary card (teal-tinted):
- A single plain-language sentence summarizing the visit
- Example: "You came in with chest pain and were diagnosed with NSTEMI — urgent treatment was started."
- This is auto-generated by the AI in patient-friendly language, not medical jargon

**Expandable SOAP sections (accordion):**

Each section has:
- Section icon + label (plain language label, not "SOAP")
- "Ask" button (teal pill with checkmark icon) — taps into AI Chat with that section pre-queued
- Expand/collapse chevron
- Content shown in plain language when expanded (AI re-writes clinical text for patient comprehension)

The six sections:

| Section Key | Plain Label | Icon | What it contains |
|-------------|-------------|------|-----------------|
| `cc` | Why You Came In | 💬 | Chief complaint in patient's own terms. What symptom brought them to the clinic. Example: "You came in because of chest pain that started 4 hours before your appointment and radiated to your left arm." |
| `hpi` | What Happened | 🕐 | Full history of present illness, simplified. Timeline of symptom onset, character, severity. Associated symptoms. Relevant past history briefly mentioned. Example: "The pain was crushing and rated 8 out of 10 in severity. You also noticed sweating and mild nausea. You have a history of high blood pressure and high cholesterol." |
| `sx` | Your Symptoms | 📋 | All reported symptoms, structured as a list. What was present AND what was not present (negative symptoms are important medically). Example: "You reported: chest pain (8/10), left arm pain, sweating, mild nausea. You did NOT have: shortness of breath, dizziness, fainting, or palpitations." |
| `pe` | Examination Findings | 🩺 | What the doctor found on physical examination. Vitals. Heart sounds, lung sounds, any abnormal findings. Example: "Your blood pressure was 158/94 (higher than normal). Your heart rate was 108 (slightly fast). Your oxygen level was 94% (borderline). Heart sounds were normal. Lungs were clear." |
| `assess` | The Conclusion | ⚕️ | Diagnosis in plain language + ICD-10 shown as a subtitle. Key test results that supported the diagnosis. Severity. Example: "You were diagnosed with NSTEMI — a type of heart attack caused by reduced blood flow to part of your heart muscle. Your blood test (Troponin I) was 2.4 — elevated, confirming heart damage. Your ECG also showed changes consistent with this diagnosis." |
| `plan` | Your Treatment Plan | ⭐ | All actions taken and planned, in plain language, numbered. Each medication explained briefly. Each investigation explained. Follow-ups. Example: "1. You were admitted to the cardiac care unit for close monitoring. 2. You were given Aspirin 300mg and Clopidogrel 600mg — these are blood thinners that help keep your heart artery open. 3. You were given Enoxaparin — a blood thinner injection. 4. A cardiologist was called to review you urgently. 5. Your blood test and ECG will be repeated in 3 hours. 6. An echocardiogram (heart scan) is planned within 24 hours." |

**AI Chat tab:**

**Intro screen (first time, before first message):**
- Large `AiPulse` orb (60px, active)
- "Your visit assistant" title
- "Visit Summary" teal pill badge
- "Ask me anything about your visit." subtitle

**Suggested questions (chips, shown before first message):**
- "What happened during my visit?"
- "What was discussed?"
- "What was the conclusion?"
- "What do my medications do?"
- "When is my follow-up?"
- "Should I be worried?"
- "What should I watch out for at home?"

**Chat messages:**
- Patient messages: right-aligned, teal/blue gradient bubble
- AI messages: left-aligned, dark card bubble with AI avatar (gradient circle with sparkle icon)
- AI responses always include a "PostVisit AI · citation-grounded" badge — meaning answers are drawn only from the signed note, not from general knowledge
- Typing indicator: three animated dots

**AI behavior:**
- `POST /postvisit/sessions/{id}/chat` — sends patient message + session context
- AI responses are grounded in the signed note content: it will not speculate beyond what the doctor recorded
- If asked about something not in the note: "That wasn't mentioned in your visit notes. Please ask your doctor at your follow-up."
- Responses are in plain language appropriate for a non-clinical person

**Multiple visits:**
- If patient has multiple signed notes, a visit selector appears at the top of the PostVisit tab
- Shows visit date + doctor name for each — most recent first
- Patient can switch between visits

---

## Sprint S114 — Patient: Medications + Bills

**Goal:** Medication adherence tracking with reminders, and the full bill payment flow supporting regional payment methods.

### Screens

#### My Medications Screen (`PatientMedicationsScreen`)

**Data:** `GET /ehr/medications?patientId={id}` — active prescriptions

**Today's Schedule section:**
- Medication card per active medication:
  - Name + dose (large text)
  - When to take + time (e.g., "Morning with food · 07:00")
  - Left border in medication's assigned color (each med gets a unique color from a palette)
  - TAKEN badge (green) if taken today
  - Reminder toggle (bell icon + pill toggle) — managing push notification schedule
  - 7-day adherence dots: M T W T F S S — each day is a small colored square (filled = taken, empty = missed). Current day highlighted
  - Adherence percentage for the week (e.g., "82%") shown as a small badge
  - Medication note in italic (important warnings: "Take with food", "Avoid NSAIDs", etc.)
  - "Mark as Taken" button — only shown if not yet taken today
    - On tap: button transitions to "Marked as taken!" with checkmark + green color (1.2s transition)
    - `POST /patients/medications/{id}/adherence` records the event with timestamp
    - A small celebration micro-animation plays (confetti burst or green pulse)

**Mark as Taken via notification:** Push notification at scheduled time → "Time to take Aspirin 75mg" → tap on notification opens app directly to that medication card. One-tap mark as taken from notification action button (no need to open app).

**AI Adherence Summary card** (bottom of screen):
- Weekly metrics: adherence %, doses today, missed count
- Brief AI comment: "You're doing well this week! Aspirin is critical — try to take it with breakfast every day."
- Generated by `GET /ai/medication-adherence-summary?patientId={id}`

**Prescription details sheet (tap medication name):**
- Full prescription details
- Prescribing doctor + date prescribed
- Refill status
- Drug information (mechanism explained in plain language)
- "Ask AI about this medication" button → opens PostVisit chat pre-primed with a medication question

#### My Bills Screen (`PatientBillsScreen`)

**Data:** `GET /billing/invoices?patientId={id}`

**Outstanding balance summary (top):**
- Large amber number showing total balance due
- Sub-label with invoice count
- Quick-pay buttons: "EcoCash" (red) + "OneMoney" (green) — tapping either pre-selects that payment method and opens the payment flow for the oldest due invoice

**Invoice list:** Each invoice card shows:
- Invoice ID (monospace) + description + date
- Amount in amber (due) / green (paid) / blue (medical aid)
- Status badge: DUE / PAID / MED AID
- "Pay Now" button on due invoices
- "Payment confirmed · Receipt saved" row on paid invoices
- "Claimed to [insurer] — awaiting reimbursement" row on medical aid invoices

**Payment Flow (3 steps):**

Step 1 — Choose Payment Method:
- Invoice summary card (ID, description, total amount in amber)
- Payment method selector (radio list):
  - EcoCash — red (#E31837), 📱 icon
  - OneMoney — green (#00A651), 💚 icon
  - Card Payment — blue, 💳 icon (Visa/Mastercard)
  - Bank Transfer — grey, 🏦 icon (ZIPIT / EFT)
- For EcoCash/OneMoney: mobile number input field appears (pre-filled with patient's registered number)
- "Continue to Review" button

Step 2 — Confirm Payment:
- Invoice line items breakdown
- Total amount
- Selected payment method shown with icon
- For mobile money: "You will receive a payment prompt on [number]"
- HIPAA-compliant transaction security note
- "Confirm & Pay USD $[amount]" button (colored to match payment method)

Step 3 — Payment Success:
- Large green checkmark circle
- "Payment Successful!" headline
- Amount + payment method summary
- Receipt card with invoice ID and amount
- "Done" button → returns to invoice list, invoice now shows PAID

**API:**
- `POST /billing/payment/initiate` → returns payment session
- `POST /billing/payment/confirm` → verifies and marks paid
- `GET /billing/receipt/{id}` → receipt for sharing

---

## Sprint S115 — Patient: My Health + Connected Services

**Goal:** The patient's health record on mobile — biometrics, vitals history, lab results with trend charts, and integration with wearable platforms.

### Screens

#### My Health Screen (`PatientHealthScreen`)

Five sub-tabs accessible via a scrollable pill tab row at the top.

**Health Profile sub-tab:**
- Personal Information card: Full Name, Date of Birth, Gender, Phone, Email, MRN
- Biometrics card: Height (cm), Weight (kg), BMI (calculated, colored green/amber/red by range), Blood Type
- "Ask AI" button on biometrics card: asks the PostVisit AI about the patient's biometric context
- Diagnoses card: active diagnoses listed with:
  - Diagnosis name + ICD-10 code
  - Date diagnosed
  - Severity badge (critical/moderate/mild)
  - Active/resolved badge
  - "Ask AI" button per diagnosis → PostVisit AI chat pre-primed with that diagnosis

**Vitals sub-tab:**
- Time range selector: 7 days / 30 days / 90 days
- Charts for each vital type (if data available):
  - Blood Pressure (systolic + diastolic lines on same chart)
  - Heart Rate
  - SpO₂
  - Temperature
  - Blood Glucose
- Each chart: SVG line chart with reference range band (normal zone shown as a shaded area)
- Data sources labeled per point: "Nurse recorded" / "Apple Watch" / "Self-reported"
- Latest reading shown prominently above each chart with status dot

**Lab Results sub-tab:**
- List of all lab results grouped by panel
- Each result card:
  - Test name + date
  - Value (large monospace) + unit + status badge (NORMAL / LOW / HIGH / ELEVATED / CRITICAL)
  - Reference range text
  - "Ask AI about this" teal pill → opens PostVisit AI chat about this specific result
  - Sparkline trend chart (last 4 readings) with reference band — shows whether the value is improving, stable, or worsening
  - X-axis labels with date of each reading
- Empty state: "No lab results yet. Results ordered by your doctor will appear here."

**Connected Services sub-tab:**
Six wearable/health platform tiles (2x2x... grid):
- Apple Health (iOS only)
- Google Fit (Android only)
- Fitbit
- Samsung Health
- Garmin Connect
- Withings

Each tile:
- Platform logo/color + name
- Description of what data it syncs
- Data type tags (Heart Rate / Steps / ECG / Sleep / BP / SpO₂ / Weight)
- "Connected" dot + "Synced [n]h ago" if connected
- "Connect" button if not connected (triggers OAuth or HealthKit permission flow)
- "Disconnect" link if connected

Connection flows:
- Apple Health: `expo-health` → request HealthKit permissions → background sync
- Google Fit: OAuth via Expo AuthSession → Google Fit REST API
- Others: OAuth via Expo AuthSession → respective platform APIs
- All synced data goes through `POST /patients/wearable-sync` → stored in the vitals history

HIPAA badge: "HIPAA compliant" with green shield shown at the top of the sub-tab.

**Documents sub-tab:**
- List of uploaded documents: discharge summaries, referral letters, reports
- Each document: icon (PDF/image), name, date, upload source
- Tap → opens in-app PDF viewer (`expo-file-system` + `expo-sharing`)
- Upload button → photo picker or file picker → `POST /patients/documents/upload`

---

## Sprint S116 — Secure Messaging + Push Notifications

**Goal:** HIPAA-compliant secure messaging between all clinical roles, plus a fully working push notification system for all critical events.

### Secure Messaging (`SecureMessagingScreen`)

Used by Doctor and Nurse roles (same screen, filtered by sender role).

**Thread List view:**
- Each thread: avatar (initials in colored circle) + contact name + role tag + last message preview + timestamp + unread badge
- Unread threads shown with brighter border and bold text
- Filter chips at top: All | Doctors | Nurses | Lab | Pharmacy
- "New Message" FAB (floating action button, bottom-right) → opens Compose Sheet

**Compose Sheet (bottom sheet):**
- Search field to find a staff member: searches by name, role, ward
- Staff results list with role chip
- Select contact → opens new thread immediately

**Thread (Chat) view:**
- Header: contact name + role + online/offline indicator
- Messages: right-aligned sent, left-aligned received (dark card bubbles)
- HIPAA encrypted badge at the top of the thread: "End-to-end encrypted · HIPAA compliant"
- Message input: text + mic icon (voice message, transcribed) + attachment icon (send image/lab result)
- Send button (teal gradient circle)
- Delivered/Read receipts: single tick (sent) / double tick (delivered) / teal double tick (read)
- Long-press message → copy / delete

**API:**
- WebSocket channel per thread (`/ws/messages/{threadId}`)
- `GET /messages/threads` — thread list
- `GET /messages/threads/{id}/messages` — message history
- `POST /messages/threads/{id}/send` — send message
- `POST /messages/threads` — create new thread

### Push Notifications

**Registration:** On login, register device push token: `POST /notifications/register-device` with `{ token, platform, role, userId }`

**Notification events and their handling:**

| Event | Who receives | Notification content | Tap action |
|-------|-------------|---------------------|------------|
| Doctor signs PostVisit note | Patient | "Dr. [name] signed your [visit type] summary. Tap to read and chat with AI." | Open PostVisit tab → that session |
| Nurse escalates patient | Doctor | "URGENT: [patient name] — [finding summary]. Tap to review." | Open Escalation Inbox → that escalation |
| Escalation not acknowledged (SLA breach) | Doctor + Nurse | "Escalation for [patient] not acknowledged in 15 minutes. Tap to act." | Open Escalation Inbox |
| Escalation resolved | Nurse | "[Doctor name] resolved the escalation for [patient]." | Open Messages or Inbox |
| Medication due | Patient | "Time to take [medication name]. Tap to mark as taken." | Open Meds tab, scroll to that med |
| Lab result available | Patient | "Your [test name] result is ready. Tap to view." | Open Health tab → Labs |
| Appointment reminder (24h before) | Patient | "Reminder: Appointment with Dr. [name] tomorrow at [time]." | Open calendar or appointments screen |
| Appointment reminder (1h before) | Patient | "Your appointment is in 1 hour. Dr. [name] at [time]." | Open appointments |
| New secure message | Doctor/Nurse | "[Sender name]: [first 50 chars of message]" | Open Messages thread |
| Critical wearable reading | Patient | "Your Apple Watch detected SpO₂ [value]%. Tap to review." | Open Health → Vitals |
| Critical vitals after nurse entry | Doctor | "Critical vitals recorded: [patient] — [vital] [value]. Tap to review." | Open Ward Rounds → patient card |
| Bill payment successful | Patient | "Payment of $[amount] confirmed. Tap to view receipt." | Open Bills tab |

**Notification Centre overlay:**
Bell icon in status bar. Unread badge count. Tapping bell opens a notification centre overlay (slides in from top):
- Filter chips: All | Escalations | Messages | Results | Reminders | Bills
- Each notification: icon (colored by type) + title + body + time ago
- Tap notification → marks read + navigates to correct screen
- "Mark all read" button
- Swipe-left to dismiss individual notification

---

## Sprint S117 — Doctor: Escalation Inbox + SLA Timers + Real-Time Alerts

**Goal:** The complete escalation management flow for doctors, with live SLA countdown timers and real-time WebSocket alerts that make the app genuinely useful in critical situations.

### Escalation Inbox (`DoctorEscalationInboxScreen`)

**Data:** `GET /escalations?assignedTo={doctorId}&status=open`

**Header stats:**
- Critical count (red) / High count (amber) / Med count (blue)

**Filter chips:** All | Critical | High | Med | Resolved

**Escalation card:**
- Severity left border + badge (CRITICAL / HIGH / MED)
- Patient name + bed + ward
- SLA timer: circular countdown showing time remaining to acknowledge
  - Green (> 10 min)
  - Amber (5–10 min)
  - Red (< 5 min)
  - Flashing red border when < 2 min
- Finding text (what the nurse reported)
- Escalating nurse name + time sent
- CDSS suggestion: auto-generated by AI based on the finding — "Possible NSTEMI. Consider: 12-lead ECG, troponin, aspirin 300mg STAT, cardiology referral." Shown as an info card with AI badge
- Two actions: "Acknowledge" (amber outline) | "Resolve" (teal gradient)
- "View Patient" link → navigates to that patient's card in Ward Rounds

**Acknowledge flow:**
- Tap "Acknowledge" → bottom sheet appears
- Doctor enters a brief response: "On my way" / "Ordering investigation" / custom text (voice or type)
- Submit → `PATCH /escalations/{id}/acknowledge` → SLA timer pauses → nurse notified
- Card transitions to "Acknowledged" state with doctor's response shown

**Resolve flow:**
- Tap "Resolve" → bottom sheet appears
- Resolution note field (what was done)
- `PATCH /escalations/{id}/resolve` → nurse notified → card moves to Resolved section
- Creates an audit entry

**Resolved section:**
- Collapsed accordion at bottom of list
- Shows last 10 resolved escalations today with resolution time and who resolved

**Real-Time Updates via WebSocket:**
- New escalation arrives → card animates in from top with haptic feedback
- Escalation acknowledged by another doctor → card updates in place
- SLA timer ticks down live (updates every second)
- When a critical escalation arrives while the doctor is on a different tab → a temporary alert banner drops down from the top of the screen (like an iOS call banner): "CRITICAL: [patient] — [brief finding]" with "View" button

---

## Sprint S118 — Store Submission, Polish & Launch

**Goal:** The app is production-ready and submitted to both the App Store (iOS) and Google Play Store (Android).

### Technical Hardening

**Performance:**
- Memo-ize all list items (ward rounds cards, message threads, medication cards) with `React.memo`
- FlatList with `getItemLayout` for all long lists (ward rounds, lab results, messages)
- Image caching for clinic logos and patient avatars (`expo-image`)
- WebSocket connection pooling — one connection per app session, not per screen
- JWT refresh token flow: proactive refresh 5 min before expiry, no mid-session logouts

**Security:**
- All PHI (patient health information) stored only in SecureStore, never in AsyncStorage
- JWT stored in SecureStore with biometric protection flag
- Screen privacy: blur screen content when app backgrounds (protects PHI from app switcher screenshots)
- Certificate pinning for the API base URL
- Jailbreak/root detection warning (advisory, not blocking)

**Offline handling:**
- Nurse vitals form works offline: stores entries in a local queue (SQLite via `expo-sqlite`), syncs when connection restored
- Patient medication "Mark as Taken" works offline: queued and synced
- All other screens show a clean "You're offline" banner with retry button (no crashes)

**Error boundaries:** React error boundary wrapping each tab — a single screen crash cannot bring down the whole app.

### App Store Assets

**Icons (required sizes):**
- iOS: 1024×1024 base + all required sizes (Expo generates from base)
- Android: 512×512 + adaptive icon (foreground + background layers)
- Icon design: MediCore "M" monogram on dark `#080E1A` background with teal gradient

**Splash screen:**
- Dark `#080E1A` background
- MediCore logo centered
- Teal gradient pulse ring animation (Expo splash plugin)

**App Store screenshots (6 required per device size):**
1. Patient PostVisit AI — "Understand your consultation, in plain language"
2. Patient AI Chat — "Ask anything about your visit"
3. Doctor Ward Rounds — "Your ward at a glance, in real time"
4. Doctor PostVisit Signoff — "AI-drafted, you sign in seconds"
5. Nurse Shift Dashboard — "Your shift, organized by AI"
6. Nurse Vitals + AI interpretation — "Record vitals. AI interprets instantly."

**App Store metadata:**
- Name: "MediCore Clinical"
- Subtitle: "AI-First Clinical Companion"
- Keywords: clinical, EHR, doctor, nurse, patient, AI, CDSS, PostVisit
- Privacy policy URL: required before submission
- Data usage declarations: PHI collected, encrypted, not sold

### EAS Build + Submit

```bash
# Production builds
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

**App Review checklist:**
- [ ] All screens tested on iOS 16+ and Android 12+
- [ ] No hardcoded tenant slugs or test credentials in production build
- [ ] Health data permission strings in `Info.plist` (iOS) and `AndroidManifest.xml`
- [ ] Camera permission for QR scan (patient login) declared
- [ ] Push notification entitlement
- [ ] Background fetch entitlement (wearable sync)
- [ ] All third-party licenses included
- [ ] HIPAA compliance statement in privacy policy
- [ ] Age restriction: 17+ (medical)

### Final Polish

**Micro-interactions (all sprints contribute, finalized here):**
- Medication "Mark as Taken": confetti micro-animation
- PostVisit "Sign & Publish": signature sweep animation + teal pulse
- Escalation SLA timer: color shift animation as time decreases
- Bill payment success: green checkmark pop animation
- AI typing indicator: three dots with staggered scale animation
- AiPulse orb: soft radial pulse (1.5s infinite)
- Tab transitions: fade (not slide — faster perceived performance)

**Accessibility:**
- All touchable elements: minimum 44×44pt tap target
- Color contrast ratios pass WCAG AA for all text
- Screen reader labels on all icon buttons
- Dynamic font size support (respects iOS/Android font size settings up to +2 stops)

**Localization (foundation):**
- All user-facing strings in `i18n/en.ts`
- RTL layout support via `I18nManager` (for future Arabic/Hebrew locales)
- Date/time formats via `Intl.DateTimeFormat` (locale-aware)

---

## Cross-Sprint Technical Standards

These standards apply across all sprints:

### File Structure
```
mobile/
  src/
    design/          tokens.ts, icons.ts
    components/
      ui/            Badge, Card, AiBadge, AiPulse, Sparkline, SlaTimer...
      doctor/        WardRoundsScreen, PostVisitSignoffScreen, CDSSScreen...
      nurse/         ShiftDashboardScreen, VitalsScreen, EscalateModal...
      patient/       HomeScreen, VisitSummaryScreen, MedicationsScreen...
      shared/        SecureMessaging, NotificationCentre...
    navigation/      RootNavigator, DoctorNavigator, NurseNavigator, PatientNavigator
    services/        api.ts, ws.ts, notifications.ts
    stores/          useAuthStore.ts, usePatientStore.ts, useEscalationStore.ts
    hooks/           useWardAlerts.ts, useWearableSync.ts
    utils/           vitals.ts (normal ranges), date.ts, format.ts
```

### Component rules
- Every screen uses `C` tokens from `design/tokens.ts` — no hardcoded hex strings in components
- All icons use the `Icon` component with path strings from `icons.ts`
- Dark background is always `C.bg` (`#080E1A`) — never plain black or white
- All number/vital displays use JetBrains Mono font family
- All AI-related UI elements must include an `AiBadge` so users always know when AI is speaking

### API conventions
- All requests through the `api.ts` axios instance (never raw `fetch`)
- PHI parameters never sent in URL query strings — always in POST body
- All dates in ISO 8601 format
- Optimistic UI updates for user actions (mark taken, complete task) — update local state immediately, sync in background

### Testing
- Each sprint includes unit tests for: store actions, API client, utility functions
- Each sprint includes one E2E smoke test (Detox or Maestro): the happy path of the sprint's main feature
- Snapshot tests for design system components (Badge, Card, AiBadge, etc.)

---

## Sprint Summary Table

| Sprint | Name | Key Output |
|--------|------|-----------|
| S109 | Foundation | Expo project, design system, auth, tenant persistence, navigation shell |
| S110 | Doctor Core | Ward rounds (live), PostVisit AI signoff (draft → sign → publish) |
| S111 | Doctor AI | CDSS (drug interactions, WHO guidelines, risk scores), Voice dictation → SOAP |
| S112 | Nurse Copilot | Shift worklist, AI triage, vitals + AI interpretation, escalation modal |
| S113 | Patient PostVisit | Home, Visit Summary (plain-language SOAP), AI Chat (consultation Q&A) |
| S114 | Patient Transactions | Medications + adherence tracking, Bills + EcoCash/OneMoney payment |
| S115 | Patient Health | Biometrics, vitals history charts, lab trends + sparklines, wearable sync |
| S116 | Comms + Push | Secure messaging (HIPAA), full push notification system, notification centre |
| S117 | Escalation + RT | Escalation inbox, SLA timers, real-time WebSocket alert banners |
| S118 | Store Launch | Performance, security hardening, store assets, EAS submit |
