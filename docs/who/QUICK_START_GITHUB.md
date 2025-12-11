# Quick Start: WHO Smart Guidelines from GitHub

## ✅ Yes! WHO Smart Guidelines ARE on GitHub!

WHO Smart Guidelines FHIR resources are **publicly available** on GitHub. You don't need to email WHO to get started!

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Visit WHO Smart Guidelines GitHub

**Main Resources:**
- **HIV Guidelines:** https://worldhealthorganization.github.io/smart-hiv/
- **GitHub Repo:** https://github.com/WorldHealthOrganization/smart-hiv
- **Immunization:** https://worldhealthorganization.github.io/smart-immunizations/
- **GitHub Repo:** https://github.com/WorldHealthOrganization/smart-immunizations

### Step 2: Clone or Download

#### Option A: Clone Repository (Recommended)

```bash
# Clone HIV Smart Guidelines
git clone https://github.com/WorldHealthOrganization/smart-hiv.git

# Navigate to resources
cd smart-hiv/input/resources/

# List available FHIR resources
ls -la *.json
```

#### Option B: Download from GitHub Pages

1. Visit https://worldhealthorganization.github.io/smart-hiv/
2. Look for "Downloads" or "Package" section
3. Download FHIR bundle (`.json` or `.zip`)
4. Extract individual resources

### Step 3: Extract FHIR Resources

FHIR resources are typically in:
- `/input/resources/` - Individual resource files
- `/package/` - Packaged FHIR bundle

**Look for:**
- `PlanDefinition-*.json` - Care plans and guidelines
- `Questionnaire-*.json` - Smart Forms

### Step 4: Copy to Your Project

```bash
# Copy PlanDefinition resources
cp smart-hiv/input/resources/PlanDefinition-*.json \
   services/ehr-service/who-smart-guidelines/

# Copy Questionnaire resources
cp smart-hiv/input/resources/Questionnaire-*.json \
   services/ehr-service/who-smart-guidelines/
```

### Step 5: Restart Service

```bash
# Restart EHR service
docker compose restart ehr-service

# Or locally
cd services/ehr-service
npm run dev
```

### Step 6: Verify

Check logs for:
```
✅ Loaded PlanDefinition: hiv-care-plan - HIV Care Guidelines
✅ Loaded Questionnaire: art-initiation - ART Initiation Form
```

Or use API:
```bash
curl http://localhost:3000/api/who-smart-guidelines/guidelines
```

---

## 📁 Repository Structure

Typical WHO Smart Guidelines repository structure:

```
smart-hiv/
├── input/
│   ├── resources/          # ← FHIR resources here!
│   │   ├── PlanDefinition-hiv-care.json
│   │   ├── Questionnaire-art-initiation.json
│   │   └── ...
│   ├── pagecontent/        # Documentation
│   └── ...
├── package/                # Packaged bundle
└── ...
```

---

## 🔍 Finding Resources

### In GitHub Repository:

1. **Browse:** https://github.com/WorldHealthOrganization/smart-hiv
2. **Navigate to:** `input/resources/` directory
3. **Download:** Individual `.json` files

### In GitHub Pages:

1. **Visit:** https://worldhealthorganization.github.io/smart-hiv/
2. **Look for:** "Resources" tab or "Downloads" section
3. **Download:** FHIR bundle or individual resources

---

## 📋 Available Resources

### WHO Smart Guidelines - HIV
- **URL:** https://worldhealthorganization.github.io/smart-hiv/
- **GitHub:** https://github.com/WorldHealthOrganization/smart-hiv
- **Contains:** HIV care plans, ART initiation forms, monitoring forms

### WHO Immunization
- **URL:** https://worldhealthorganization.github.io/smart-immunizations/
- **GitHub:** https://github.com/WorldHealthOrganization/smart-immunizations
- **Contains:** Immunization schedules, vaccination forms

### More Resources:
- Check https://www.who.int/teams/digital-health-and-innovation/smart-guidelines for latest

---

## 🎯 Example: Getting HIV Guidelines

```bash
# 1. Clone repository
git clone https://github.com/WorldHealthOrganization/smart-hiv.git

# 2. Navigate to resources
cd smart-hiv/input/resources/

# 3. List available resources
ls *.json

# 4. Copy to your project
cp PlanDefinition-*.json ../../../services/ehr-service/who-smart-guidelines/
cp Questionnaire-*.json ../../../services/ehr-service/who-smart-guidelines/

# 5. Verify files
ls ../../../services/ehr-service/who-smart-guidelines/
```

---

## ✅ That's It!

Once files are in `who-smart-guidelines/` directory, the service will automatically load them on startup.

**No email to WHO needed** - everything is publicly available on GitHub!

---

## 📞 Need Help?

- **GitHub Issues:** Open an issue on the repository
- **WHO Contact:** SMART_DAKS@who.int (for support/questions)
- **Documentation:** See `docs/who/WHO_SMART_GUIDELINES_SETUP.md`

---

## 🎉 Summary

✅ **WHO Smart Guidelines ARE on GitHub** - Publicly available!
✅ **No email needed** - Just clone/download
✅ **FHIR resources ready** - In `/input/resources/` directories
✅ **Quick setup** - Copy files and restart service

**Start using WHO Smart Guidelines now!** 🚀
