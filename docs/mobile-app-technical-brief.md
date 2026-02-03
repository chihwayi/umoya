# 📱 MediCore Mobile App - Technical Brief & Design Guidelines

**Target Audience:** Mobile Development Team (iOS/Android)  
**Version:** 1.0  
**Status:** Draft  
**System Context:** Multi-Tenant SaaS EHR for Zimbabwe Private Clinics

---

## 1. 🎯 Executive Summary

MediCore is a modern, cloud-native Electronic Health Record system. The mobile app is **NOT** a replication of the full web desktop experience. Instead, it is a **companion tool** focused on high-mobility workflows, specifically designed for:

1.  **Doctors/Clinicians** conducting ward rounds or working remotely.
2.  **Patients** managing their appointments and health records (future phase, focus on Provider first).

The goal is a **sleek, fast, and beautiful** application that complements the "Glassmorphism" aesthetic of the web platform while providing native mobile utility (biometrics, offline mode, push notifications).

---

## 2. 🏗️ Architecture & Connectivity

### 2.1 Multi-Tenancy (Crucial)
The backend is multi-tenant. The mobile app must handle this context.
- **Base URL**: `https://api.medicore.co.zw` (Example)
- **Tenant Resolution**: 
  - Every API request **MUST** include the `x-tenant-id` header (or similar mechanism as defined in Auth).
  - **Login Flow**: 
    1. User enters email.
    2. System identifies associated tenant(s).
    3. User selects Clinic (if multiple).
    4. App stores `tenant-id` for session.

### 2.2 Authentication
- **Protocol**: JWT (JSON Web Tokens).
- **Endpoint**: `POST /api/auth/login`
- **Security**: 
  - Use **Biometric Auth** (FaceID/TouchID) wrapper around the Refresh Token.
  - Auto-lock app after inactivity (HIPAA/Data Privacy requirement).

---

## 3. 🎨 UI/UX Design Language

The web app uses a **Glassmorphism** design system. The mobile app should adapt this for native feel:

- **Visual Style**:
  - **Translucency**: Use blur effects (e.g., SwiftUI UltraThinMaterial, Android BlurView) for overlays and bottom sheets.
  - **Cards**: Floating cards with soft shadows and subtle borders.
  - **Colors**:
    - Primary: Medical Teal/Blue (Consistent with Web).
    - Semantic: Red (Critical), Amber (Warning), Green (Normal).
  - **Typography**: Clean sans-serif (Inter or System Default), high readability.

- **Interaction Patterns**:
  - **"Thumb Zone" Navigation**: Bottom tab bar is mandatory. Critical actions (e.g., "New Note") should be within reach.
  - **Gestures**: Swipe-to-dismiss for notifications, Swipe-to-action for patient lists.
  - **Dark Mode**: **MANDATORY** for night shifts in wards.

---

## 4. 🩺 Core Features: "Doctor on Wards"

The app should focus on these "Point-of-Care" scenarios:

### 4.1 📋 The "Ward Round" View (Home)
*Instead of a generic dashboard, show what matters NOW.*
- **Admitted Patient List**: Filtered by Ward/Room.
- **Critical Flags**: Visually highlight patients with abnormal vitals or pending urgent results.
- **API**: `GET /api/bed-management/wards`, `GET /api/admissions/active`

### 4.2 ⚡ Quick Vitals & Charting
*Doctors shouldn't struggle with tiny forms.*
- **Interface**: Large sliders or number pads for BP, HR, Temp.
- **Visualization**: Sparklines (mini graphs) showing last 24h trend next to the input.
- **API**: `POST /api/vitals`, `GET /api/vitals/patient/{id}/history`

### 4.3 🎙️ AI Voice Scribe (Killer Feature)
*Don't type on a phone screen.*
- **Feature**: Record consultation/ward notes.
- **Backend**: Sends audio to `TranscriptionService`.
- **Result**: Returns structured SOAP note text for review.
- **API**: `POST /api/transcription/upload`

### 4.4 🔔 Intelligent Notifications
*Push notifications for actionable events.*
- **Critical Lab Results**: "Patient John Doe: Potassium 2.5 mmol/L (CRITICAL)"
- **Stat Orders**: New urgent orders from nurses.
- **API**: `GET /api/notifications`, WebSocket/Push integration.

### 4.5 🤖 Pocket CDSS (Clinical Decision Support)
- **Drug Interaction Checker**: Quick scanner for drug barcodes or manual search.
- **Guidelines**: "Is this patient on the right antibiotic for Pneumonia?"
- **API**: `POST /api/cdss/interactions`, `GET /api/who-smart-guidelines`

---

## 5. 🔌 Backend API Reference (Mobile Subset)

The full EHR has 69+ controllers. The mobile team should focus on these:

| Feature Category | Relevant Controllers | Description |
|-----------------|----------------------|-------------|
| **Auth & Profile** | `auth.controller.ts`<br>`users.controller.ts` | Login, Biometrics, User Profile, Shift Status |
| **Patient Care** | `patient.controller.ts`<br>`medical-record.controller.ts`<br>`nursing-notes.controller.ts` | Patient Search, Summary, Clinical Notes |
| **Inpatient** | `bed-management.controller.ts`<br>`triage.controller.ts` | Ward lists, Bed availability, Triage queue |
| **Diagnostics** | `lab-order.controller.ts`<br>`imaging.controller.ts` | View results (PDF/Data), Order Labs |
| **Clinical Ops** | `vitals.controller.ts`<br>`prescription.controller.ts` | Record Vitals, E-Prescribing |
| **Intelligence** | `cdss.controller.ts`<br>`transcription.controller.ts` | AI Scribe, Drug Interactions, Risk Scores |
| **Communication** | `notifications.controller.ts`<br>`provider-messaging.controller.ts` | Secure chat, Critical alerts |

---

## 6. 🚀 Technical Requirements

1.  **Offline-First Sync**:
    - Wards often have dead zones.
    - **Requirement**: Cache "My Patients" data. Allow writing notes offline; sync when online.
2.  **Security**:
    - No caching of sensitive PHI (Protected Health Information) in plain text.
    - Use Secure Enclave / KeyStore.
3.  **Performance**:
    - < 2s load time for Patient Summary.
    - Image compression for uploading wound photos or viewing X-rays (`imaging.controller.ts`).

---

## 7. 🗓️ Proposed MVP Scope

**Phase 1 (The "Rounder"):**
1.  Secure Biometric Login.
2.  Ward List / Patient Search.
3.  View Vitals & Lab Results.
4.  Voice-to-Text Clinical Notes.

**Phase 2 (The "Prescriber"):**
1.  E-Prescribing.
2.  Order Labs.
3.  Secure Chat with Nurses.

---

*Prepared by: Technical Lead*  
*Date: 2026-02-03*
