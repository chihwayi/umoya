# MediCore CDSS Service

Clinical Decision Support System (CDSS) microservice built with Python and FastAPI.

## Features

### Phase 3.1 (Current)
- ✅ Basic FastAPI structure
- ✅ Health check endpoints
- ✅ API documentation (Swagger)

### Phase 3.2 (Next)
- 🔄 Advanced drug-drug interaction checking
  - Pharmacokinetic interactions (CYP450, P-glycoprotein)
  - Pharmacodynamic interactions
  - Clinical significance scoring
  
- 🔄 Clinical guidelines engine
  - WHO guidelines integration
  - Local protocol matching
  - Evidence-based recommendations

- 🔄 Risk scoring algorithms
  - Cardiovascular risk (Framingham, QRISK)
  - Hospital readmission risk
  - Medication adherence risk

### Phase 3.3 (Future)
- 🔮 Dosing recommendations
  - Renal dosing adjustments
  - Weight-based dosing
  - Age-based adjustments

- 🔮 Diagnostic assistance
  - Symptom-based diagnosis suggestions
  - Differential diagnosis generation
  - AI-powered clinical reasoning

## API Endpoints

- `GET /` - Service info
- `GET /health` - Health check
- `POST /drugs/interactions/advanced` - Advanced drug interaction checking
- `POST /guidelines/check` - Clinical guidelines checking
- `POST /risk/calculate` - Risk score calculation
- `POST /dosing/recommend` - Dosing recommendations
- `POST /diagnosis/suggest` - Diagnostic assistance

## Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally
uvicorn main:app --reload --port 8000

# Access API docs
# http://localhost:8000/docs
```

## Docker

```bash
# Build
docker build -t medicore-cdss-service .

# Run
docker run -p 8000:8000 medicore-cdss-service
```

## Integration with EHR Service

The EHR service can call this CDSS service via HTTP REST API:

```typescript
// Example from EHR service
const response = await axios.post('http://cdss-service:8000/drugs/interactions/advanced', {
  drug_ids: ['uuid1', 'uuid2'],
  patient_id: 'patient-uuid'
});
```

