# MediCore CDSS Service

Clinical Decision Support System (CDSS) microservice - Python FastAPI.

## Quick Start

```bash
# Docker (recommended)
docker compose up -d cdss-service

# Local development
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## API Endpoints

- `GET /health` - Health check
- `POST /drugs/interactions/advanced` - Advanced drug interaction checking
- `POST /guidelines/check` - Clinical guidelines engine
- `POST /risk/calculate` - Risk scoring (Framingham, readmission, adherence)
- `POST /dosing/recommend` - Dosing calculator (renal, weight-based, age adjustments)
- `POST /diagnosis/suggest` - Diagnostic assistance (symptom-based differential diagnosis)

## Integration

All endpoints are integrated with EHR service via `/api/cdss/*` routes:
- Drug interactions: Used automatically in prescriptions
- Clinical guidelines: `POST /api/cdss/guidelines`
- Risk assessment: `POST /api/cdss/risk-assessment`
- Diagnostic assist: `POST /api/cdss/diagnosis-assist`
- Dosing recommendation: `POST /api/cdss/dosing-recommendation`

## API Docs

`http://localhost:8000/docs`

## Offline Clinical Evaluation

Run the Sprint 5 offline quality harness:

```bash
python evaluation/offline_clinical_eval.py
```

This generates a versioned baseline report in `evaluation/reports/` with:
- retrieval recall/hit rate @k
- citation support rate
- abstain correctness
- unsafe overconfident output rate

## Future: AI Integration

When ready, AI models can enhance:
1. Diagnostic Assistant (highest priority)
2. Risk Scoring (population-specific models)
3. Drug Interactions (novel combinations)
4. Dosing Calculator (personalized dosing)
