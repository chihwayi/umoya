# WHO Smart Guidelines - Resource Extraction Summary

**Date:** December 2024

## ✅ Successfully Extracted Resources

### Source
- **Repository:** WHO Smart Guidelines - HIV
- **URL:** https://worldhealthorganization.github.io/smart-hiv/
- **Download:** definitions.json.zip (9.0 MB)
- **Total Files:** 626 JSON files processed

### Resources Extracted
- **PlanDefinition:** 11 resources
  - HIV-Testing-PlanDefinition
  - CareAndTreatmentClinicalVisit-PlanDefinition
  - HIV-A-Registration-PlanDefinition
  - HIVB2DT, HIVB9DT, HIVC23DT, HIVC7DT, HIVD12DT, HIVD15DT, HIVD4DT
  - PrEP-visit-PlanDefinition

- **Questionnaire:** 56 resources including:
  - HIV.B7TestForHivUsingTestingAlgorithm
  - HIV.C1DetermineReasonForVisit
  - HIV.C21Diagnostics
  - HIV.D10CounselReturningClient
  - HIV.D14PreventScreenAndManageComorbiditiesAndCoinfections
  - HIV.D16PerformOtherScreenings
  - HIV.D25OfferVoluntaryPartnerAndFamilyServices
  - HIV.D2TakeVitalSigns
  - HIV.D4ScreenForTb
  - HIV.F6CheckWhetherInfantChildHadHivExposure
  - HIV.H2AttemptToLocateClient
  - And more...

## 📁 Location

All resources are in:
```
services/ehr-service/who-smart-guidelines/
```

## 🔄 Next Steps

1. **Restart EHR Service** - Resources will be automatically loaded
2. **Verify Loading** - Check logs for successful resource loading
3. **Test API** - Use endpoints to verify resources are accessible

## ✅ Verification

After restarting the service, check logs for:
```
✅ Loaded PlanDefinition: HIV-Testing-PlanDefinition - [title]
✅ Loaded Questionnaire: HIV.B7TestForHivUsingTestingAlgorithm - [title]
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
