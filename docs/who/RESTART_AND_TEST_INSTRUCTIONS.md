# WHO Smart Guidelines - Restart and Test Instructions

## ✅ Resources Ready

- **67 FHIR resources** extracted and in `services/ehr-service/who-smart-guidelines/`
- **11 PlanDefinitions** - Clinical care plans
- **56 Questionnaires** - Smart Forms

---

## 🔄 Restart Service

### Option 1: Docker Compose (Recommended)

```bash
cd /Users/devoop/Dev/personal/medicore

# Rebuild service (includes new code)
docker compose build ehr-service

# Restart service
docker compose restart ehr-service

# Or rebuild and restart
docker compose up -d --build ehr-service
```

### Option 2: Local Development

```bash
cd services/ehr-service

# Install dependencies (if needed)
npm install

# Build TypeScript
npm run build

# Start service
npm run dev
```

---

## ✅ Verify Loading

### Check Logs

```bash
# Docker
docker logs medicore-ehr-service --tail 100 | grep -i "who\|smart\|guideline"

# Local
# Check console output for loading messages
```

**Expected Log Messages:**
```
✅ Loaded PlanDefinition: HIV-Testing-PlanDefinition - PlanDefinition - HiV Testing
✅ Loaded Questionnaire: HIV.B7TestForHivUsingTestingAlgorithm - Test for HIV using testing algorithm
✅ Loaded 67 WHO Smart Guidelines resources
```

---

## 🧪 Test API Endpoints

### 1. List Guidelines

```bash
curl http://localhost:3013/api/who-smart-guidelines/guidelines
```

**Expected Response:**
```json
{
  "guidelines": [
    {
      "id": "HIV-Testing-PlanDefinition",
      "title": "PlanDefinition - HiV Testing",
      "description": "..."
    },
    ...
  ],
  "message": "Contact SMART_DAKS@who.int to get FHIR resources"
}
```

### 2. List Smart Forms

```bash
curl http://localhost:3013/api/who-smart-guidelines/forms
```

**Expected Response:**
```json
{
  "forms": [
    {
      "id": "HIV.B7TestForHivUsingTestingAlgorithm",
      "title": "Test for HIV using testing algorithm",
      "description": "..."
    },
    ...
  ]
}
```

### 3. Get Recommendations for Condition

```bash
curl "http://localhost:3013/api/who-smart-guidelines/guidelines/hiv?age=35&gender=male"
```

**Expected Response:**
```json
{
  "condition": "hiv",
  "recommendations": [
    {
      "id": "action-1",
      "title": "...",
      "description": "...",
      "priority": "urgent",
      "source": "who_smart_guidelines"
    }
  ],
  "source": "who_smart_guidelines",
  "count": 10
}
```

### 4. Get Smart Form

```bash
curl http://localhost:3013/api/who-smart-guidelines/forms/HIV.B7TestForHivUsingTestingAlgorithm
```

**Expected Response:**
```json
{
  "id": "HIV.B7TestForHivUsingTestingAlgorithm",
  "title": "Test for HIV using testing algorithm",
  "description": "...",
  "items": [...],
  "source": "who_smart_guidelines"
}
```

---

## 🔍 Troubleshooting

### Resources Not Loading

**Check:**
1. Files exist: `ls services/ehr-service/who-smart-guidelines/*.json`
2. Service has access: `docker exec medicore-ehr-service ls /app/who-smart-guidelines/`
3. Check logs for errors

### API Returns 404

**Check:**
1. Service is running: `docker ps | grep ehr-service`
2. Controller is registered in `ehr.module.ts`
3. Routes are correct: `/api/who-smart-guidelines/...`
4. Service was rebuilt after adding controller

### Service Won't Start

**Check:**
1. TypeScript compiles: `npm run build`
2. No syntax errors in new code
3. Dependencies installed
4. Check Docker logs: `docker logs medicore-ehr-service`

---

## 📊 Expected Results

After restart, you should see:

✅ **Logs show:**
- "WHO Smart Guidelines directory created" or "Loaded X resources"
- Individual resource loading messages

✅ **API returns:**
- List of 11 PlanDefinitions
- List of 56 Questionnaires
- Recommendations for conditions

✅ **CDSS Integration:**
- Automatically uses WHO guidelines when available
- Falls back to CDSS guidelines if not found

---

## 🎯 Quick Test Script

```bash
# Test resource loading
cd services/ehr-service
node test-who-guidelines.js

# Should show:
# ✓ Found 67 JSON files
# ✓ PlanDefinitions: 11
# ✓ Questionnaires: 56
```

---

## 📚 Next Steps

1. ✅ Restart service
2. ✅ Verify logs
3. ✅ Test API endpoints
4. ✅ Use in clinical workflows
5. ✅ Integrate Smart Forms into UI

---

## 🎉 Success Indicators

- [x] 67 resources in directory
- [ ] Service logs show loading messages
- [ ] API returns guidelines list
- [ ] API returns forms list
- [ ] Recommendations work for conditions

**Once all checked, WHO Smart Guidelines are fully operational!** 🚀
