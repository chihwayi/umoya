# WHO Smart Guidelines Setup Guide

## 🎯 Overview

This guide explains how to set up and use WHO Smart Guidelines in your EHR system.

---

## ✅ What's Implemented

1. **WHO Smart Guidelines Service** - Parses FHIR resources
2. **Integration with CDSS** - Automatically uses WHO guidelines when available
3. **Smart Forms Support** - Renders FHIR Questionnaires as forms
4. **API Endpoints** - REST API for accessing guidelines and forms

---

## 📋 Prerequisites

1. **Contact WHO** - Email `SMART_DAKS@who.int` to get FHIR resources
2. **FHIR Resources** - PlanDefinition and Questionnaire files in JSON format
3. **Directory** - `services/ehr-service/who-smart-guidelines/` directory exists

---

## 🚀 Setup Steps

### Step 1: Download from WHO GitHub

**WHO Smart Guidelines are publicly available on GitHub!**

#### Quick Start:

1. **Visit WHO Smart Guidelines Implementation Guides:**
   - **HIV:** https://worldhealthorganization.github.io/smart-hiv/
   - **Immunization:** https://worldhealthorganization.github.io/smart-immunizations/

2. **Download FHIR Resources:**
   - Look for "Downloads" or "Resources" section
   - Download FHIR bundle (usually `.json` or `.zip`)
   - Or clone the repository:
     ```bash
     git clone https://github.com/WorldHealthOrganization/smart-hiv.git
     ```

3. **Extract Resources:**
   - FHIR resources are typically in `/input/resources/` or `/package/` directories
   - Extract `PlanDefinition` and `Questionnaire` resources
   - Save as individual `.json` files

#### Alternative: Clone Repository

```bash
# Clone WHO Smart Guidelines repositories
git clone https://github.com/WorldHealthOrganization/smart-hiv.git
git clone https://github.com/WorldHealthOrganization/smart-immunizations.git

# Navigate to resources directory
cd smart-hiv/input/resources/

# Copy PlanDefinition and Questionnaire files
# (Adjust paths based on repository structure)
```

### Step 2: Place Files

Place downloaded FHIR resource files (`.json`) in:
```
services/ehr-service/who-smart-guidelines/
```

**Example structure:**
```
who-smart-guidelines/
  ├── hiv-care-plan.json          # PlanDefinition
  ├── art-initiation-form.json    # Questionnaire
  ├── tb-care-plan.json           # PlanDefinition
  └── immunization-form.json      # Questionnaire
```

**Note:** Each file should contain a single FHIR resource (PlanDefinition or Questionnaire) in JSON format.

### Step 3: Restart Service

The service automatically loads FHIR resources on startup:

```bash
# Restart EHR service
docker compose restart ehr-service

# Or if running locally
cd services/ehr-service
npm run dev
```

### Step 4: Verify

Check logs for successful loading:
```
✅ Loaded PlanDefinition: hiv-care-2021 - HIV Care Guidelines
✅ Loaded Questionnaire: art-initiation - ART Initiation Form
```

Or use API:
```bash
# List available guidelines
curl http://localhost:3000/api/who-smart-guidelines/guidelines

# List available forms
curl http://localhost:3000/api/who-smart-guidelines/forms
```

---

## 🔧 How It Works

### 1. Automatic Integration with CDSS

When you request guidelines via CDSS:
```typescript
GET /api/cdss/guidelines?condition=hiv
```

The system:
1. **First** checks WHO Smart Guidelines
2. **If found**, returns WHO guidelines (evidence level: high)
3. **If not found**, falls back to CDSS guidelines

### 2. Smart Forms

Get a Smart Form:
```bash
GET /api/who-smart-guidelines/forms/art-initiation
```

Returns FHIR Questionnaire structure that can be rendered as a form.

---

## 📡 API Endpoints

### List Guidelines
```bash
GET /api/who-smart-guidelines/guidelines
```

**Response:**
```json
{
  "guidelines": [
    {
      "id": "hiv-care-2021",
      "title": "HIV Care Guidelines",
      "description": "WHO guidelines for HIV care"
    }
  ]
}
```

### Get Guidelines for Condition
```bash
GET /api/who-smart-guidelines/guidelines/hiv?age=35&gender=male
```

**Response:**
```json
{
  "condition": "hiv",
  "recommendations": [
    {
      "id": "action-1",
      "title": "ART Initiation",
      "description": "Initiate ART for all PLHIV",
      "priority": "urgent",
      "source": "who_smart_guidelines"
    }
  ],
  "source": "who_smart_guidelines"
}
```

### List Smart Forms
```bash
GET /api/who-smart-guidelines/forms
```

### Get Smart Form
```bash
GET /api/who-smart-guidelines/forms/art-initiation
```

### Reload Guidelines
```bash
POST /api/who-smart-guidelines/reload
```

---

## 🎯 Usage Examples

### Example 1: Get HIV Guidelines

```typescript
// Via CDSS (automatic WHO integration)
const guidelines = await cdssService.getGuidelines('hiv', {
  age: 35,
  gender: 'male',
  conditions: ['diabetes']
});

// Returns WHO Smart Guidelines if available
// Falls back to CDSS guidelines if not
```

### Example 2: Use Smart Form

```typescript
// Get Smart Form structure
const form = await whoSmartGuidelinesService.getSmartForm('art-initiation');

// Render form in UI
// Form structure includes:
// - Items (questions)
// - Validation rules
// - Conditional logic
// - Answer options
```

---

## 🔍 Troubleshooting

### No Guidelines Found

**Problem:** API returns empty guidelines

**Solutions:**
1. Check if files are in `who-smart-guidelines/` directory
2. Verify files are valid JSON
3. Check file naming (should end with `.json`)
4. Check logs for loading errors

### Guidelines Not Loading

**Problem:** Service doesn't load guidelines on startup

**Solutions:**
1. Check directory exists: `services/ehr-service/who-smart-guidelines/`
2. Verify file permissions
3. Check logs for errors
4. Manually reload: `POST /api/who-smart-guidelines/reload`

### Wrong Guidelines Returned

**Problem:** Wrong guidelines for condition

**Solutions:**
1. Check condition name matching (case-insensitive)
2. Verify PlanDefinition `id` or `title` matches condition
3. Check logs for matching logic

---

## 📚 Next Steps

1. **Get FHIR Resources** - Contact WHO
2. **Place Files** - In `who-smart-guidelines/` directory
3. **Test Integration** - Use API endpoints
4. **Build Smart Forms UI** - Render Questionnaires
5. **Integrate with Workflows** - Use in clinical workflows

---

## 🎉 Summary

✅ **WHO Smart Guidelines Service** - Implemented
✅ **CDSS Integration** - Automatic fallback
✅ **Smart Forms Support** - Questionnaire parsing
✅ **API Endpoints** - REST API available

**Next:** Contact WHO to get FHIR resources!

---

## 📞 Contact

- **WHO Smart Guidelines:** SMART_DAKS@who.int
- **Documentation:** See `docs/who/WHO_SMART_GUIDELINES_INTEGRATION.md`
