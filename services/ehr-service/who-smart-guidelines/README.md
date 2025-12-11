# WHO Smart Guidelines Directory

This directory stores WHO Smart Guidelines FHIR resources.

## 📋 How to Get WHO Smart Guidelines

### ✅ Option 1: Download from GitHub (Recommended!)

**WHO Smart Guidelines ARE publicly available on GitHub!**

#### Quick Start:

1. **Visit WHO Smart Guidelines GitHub:**
   - **HIV:** https://github.com/WorldHealthOrganization/smart-hiv
   - **Immunization:** https://github.com/WorldHealthOrganization/smart-immunizations
   - **GitHub Pages:** https://worldhealthorganization.github.io/smart-hiv/

2. **Clone or Download:**
   ```bash
   git clone https://github.com/WorldHealthOrganization/smart-hiv.git
   cd smart-hiv/input/resources/
   ```

3. **Copy FHIR Resources:**
   ```bash
   # Copy PlanDefinition and Questionnaire files
   cp PlanDefinition-*.json /path/to/services/ehr-service/who-smart-guidelines/
   cp Questionnaire-*.json /path/to/services/ehr-service/who-smart-guidelines/
   ```

**See:** `docs/who/QUICK_START_GITHUB.md` for detailed instructions

### Option 2: Contact WHO (For Support)

**Email:** `SMART_DAKS@who.int`

**When to contact:**
- Need help accessing resources
- Want to join working group calls
- Have implementation questions
- Need access to private/beta resources

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
