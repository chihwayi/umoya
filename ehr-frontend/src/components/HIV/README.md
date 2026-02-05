# Unified HIV Module Architecture

## Overview
The HIV module in MediCore follows a **Unified Data Capture** strategy. This ensures that while users have flexibility in *how* they enter data, the underlying system maintains the rigor and intelligence of WHO Smart Guidelines and CDSS.

## The "Unified" Concept

We do not treat "User Defined Fields", "Smart Forms", and "CDSS" as separate, disconnected silos. Instead, they form a layered architecture:

### 1. The Intelligence Layer (CDSS/AI)
*   **Role:** The "Brain" of the system.
*   **Input:** It consumes data from the standardized internal data model.
*   **Source Agnostic:** It does not care if the data came from a quick form or a long WHO wizard.
*   **Function:** It runs rules (WHO DAKs) against the data to provide recommendations (e.g., "Start ART", "Retest in 14 days").

### 2. The Data Layer (Unified Model)
*   **Role:** The Single Source of Truth.
*   **Structure:** Standardized FHIR-compliant database schema.
*   **Storage:** All inputs, regardless of source, save to this same structure.

### 3. The Presentation Layer (Flexible Input)
Users can choose their preferred mode of interaction:

*   **Standard View (Fast Track):**
    *   *What is it?* Custom React components (e.g., `HIVTestingComponent`).
    *   *Best for:* Experienced clinicians, high-volume settings, routine visits.
    *   *Mechanism:* Directly populates the Data Layer.
    *   *Mapping:* "User Defined Fields" are mapped to standard WHO codes in the background.

*   **WHO Guided View (Smart Wizard):**
    *   *What is it?* FHIR Questionnaire Renderer (`WHOSmartFormIntegration`).
    *   *Best for:* Complex cases, training, strict compliance auditing.
    *   *Mechanism:* Renders WHO DAKs directly.
    *   *Mapping:* Native FHIR format.

## Implementation Guide

### How to use the Unified Component
Use `UnifiedHIVTestingWorkflow.tsx` instead of individual components.

```tsx
<UnifiedHIVTestingWorkflow 
  patientId={patientId}
  tenantSlug={tenantSlug}
  token={token}
/>
```

### Adding New Fields
1.  **If adding to Standard View:** Add the field to the React component, but ensure you also update the **Mapper** so it saves to the correct DB column/FHIR resource.
2.  **If adding to Smart Form:** Update the FHIR Questionnaire definition (JSON).

### CDSS Integration
The CDSS is triggered automatically when data is valid, regardless of which view was used. It provides real-time decision support in the sidebar.
