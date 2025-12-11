# WHO Smart Guidelines Directory

This directory stores WHO Smart Guidelines FHIR resources.

## 📋 How to Get WHO Smart Guidelines

### Step 1: Contact WHO
**Email:** `SMART_DAKS@who.int`

**What to request:**
- Access to FHIR resources (PlanDefinition, Questionnaire)
- FHIR resources for:
  - HIV/AIDS care
  - TB care
  - Maternal health
  - Child health
  - Malaria
  - NCDs (Non-Communicable Diseases)

### Step 2: Download FHIR Resources
Once WHO provides access, download FHIR resources in JSON format.

### Step 3: Place Files Here
Place downloaded FHIR resource files (`.json`) in this directory:
```
who-smart-guidelines/
  ├── hiv-care-2021.json
  ├── tb-care-2021.json
  ├── maternal-health-2021.json
  └── ...
```

### Step 4: Restart Service
The service will automatically load FHIR resources on startup.

## 📁 File Naming Convention

Use descriptive names:
- `hiv-care-2021.json` - HIV care guidelines
- `tb-care-2021.json` - TB care guidelines
- `maternal-health-2021.json` - Maternal health guidelines
- `art-initiation-questionnaire.json` - ART initiation form

## 🔍 Supported FHIR Resource Types

- **PlanDefinition** - Clinical care plans and guidelines
- **Questionnaire** - Smart Forms for data collection

## ✅ Verification

After placing files, check logs:
```
✅ Loaded PlanDefinition: hiv-care-2021 - HIV Care Guidelines
✅ Loaded Questionnaire: art-initiation - ART Initiation Form
```

Or use API:
```bash
GET /api/who-smart-guidelines/guidelines
GET /api/who-smart-guidelines/forms
```

## 📚 Resources

- **WHO Smart Guidelines:** https://www.who.int/teams/digital-health-and-innovation/smart-guidelines
- **Contact:** SMART_DAKS@who.int
- **FHIR R4 Spec:** https://www.hl7.org/fhir/
