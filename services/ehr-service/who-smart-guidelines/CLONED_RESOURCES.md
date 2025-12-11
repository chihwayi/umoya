# WHO Smart Guidelines - Cloned Resources

**Date Cloned:** December 2024

## 📋 Repositories Cloned

1. **WHO Smart Guidelines - HIV**
   - Repository: https://github.com/WorldHealthOrganization/smart-hiv
   - GitHub Pages: https://worldhealthorganization.github.io/smart-hiv/

2. **WHO Immunization Implementation Guide**
   - Repository: https://github.com/WorldHealthOrganization/smart-immunizations
   - GitHub Pages: https://worldhealthorganization.github.io/smart-immunizations/

## 📁 Resources Extracted

FHIR resources (PlanDefinition and Questionnaire) have been extracted and placed in this directory.

### Resource Types:
- **PlanDefinition** - Clinical care plans and guidelines
- **Questionnaire** - Smart Forms for data collection

## 🔄 Updating Resources

To update resources from the latest WHO repositories:

```bash
# Clone repositories
git clone https://github.com/WorldHealthOrganization/smart-hiv.git temp-smart-hiv
git clone https://github.com/WorldHealthOrganization/smart-immunizations.git temp-smart-immunizations

# Extract FHIR resources
cd temp-smart-hiv
find . -name "*.json" -type f -exec sh -c 'if head -20 "$1" | grep -qE "resourceType.*(PlanDefinition|Questionnaire)"; then cp "$1" "../services/ehr-service/who-smart-guidelines/$(basename "$1")"; fi' _ {} \;

cd ../temp-smart-immunizations
find . -name "*.json" -type f -exec sh -c 'if head -20 "$1" | grep -qE "resourceType.*(PlanDefinition|Questionnaire)"; then cp "$1" "../services/ehr-service/who-smart-guidelines/$(basename "$1")"; fi' _ {} \;

# Cleanup
cd ..
rm -rf temp-smart-hiv temp-smart-immunizations
```

## ✅ Verification

After placing resources, restart the EHR service and check logs:

```
✅ Loaded PlanDefinition: [resource-id] - [title]
✅ Loaded Questionnaire: [resource-id] - [title]
```

Or use API:
```bash
curl http://localhost:3000/api/who-smart-guidelines/guidelines
curl http://localhost:3000/api/who-smart-guidelines/forms
```

## 📚 Documentation

- **Quick Start:** `docs/who/QUICK_START_GITHUB.md`
- **Setup Guide:** `docs/who/WHO_SMART_GUIDELINES_SETUP.md`
- **Usage:** `docs/who/SMART_FORMS_USAGE.md`
