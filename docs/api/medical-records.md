# Medical Records API

## Overview
The Medical Records API manages clinical documentation, diagnoses, treatments, and care plans.

## Endpoints

### Get Medical Records
```http
GET /medical-records
Authorization: Bearer <token>

Query Parameters:
- patientId: uuid (required)
- page: number (default: 1)
- limit: number (default: 20)
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "patientId": "uuid",
      "doctorId": "uuid",
      "encounterDate": "2024-01-15T10:00:00Z",
      "chiefComplaint": "Headache",
      "diagnosis": "Migraine",
      "snomedCode": "37796009",
      "treatmentPlan": "Prescribed pain medication",
      "notes": "Patient reports severe headache"
    }
  ],
  "total": 25
}
```

### Get Medical Record by ID
```http
GET /medical-records/:id
Authorization: Bearer <token>
```

### Create Medical Record
```http
POST /medical-records
Authorization: Bearer <token>
Content-Type: application/json

{
  "patientId": "uuid",
  "encounterDate": "2024-01-15T10:00:00Z",
  "chiefComplaint": "Headache",
  "historyOfPresentIllness": "Patient reports headache for 3 days",
  "physicalExamination": "Normal examination",
  "diagnosis": "Migraine",
  "snomedCode": "37796009",
  "treatmentPlan": "Prescribed pain medication",
  "notes": "Follow-up in 1 week"
}
```

### Update Medical Record
```http
PUT /medical-records/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "treatmentPlan": "Updated treatment plan",
  "notes": "Additional notes"
}
```

## Prescriptions

### Get Prescriptions
```http
GET /prescriptions
Authorization: Bearer <token>

Query Parameters:
- patientId: uuid (optional)
- status: string (optional)
```

### Create Prescription
```http
POST /prescriptions
Authorization: Bearer <token>
Content-Type: application/json

{
  "patientId": "uuid",
  "medications": [
    {
      "drugId": "uuid",
      "drugName": "Paracetamol",
      "dosage": "500mg",
      "frequency": "twice daily",
      "duration": "7 days",
      "instructions": "Take with food"
    }
  ],
  "notes": "Complete full course"
}
```

### Check Drug Interactions
```http
POST /prescriptions/check-interactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "drugIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
{
  "hasInteractions": true,
  "interactions": [
    {
      "drug1": "Paracetamol",
      "drug2": "Warfarin",
      "severity": "moderate",
      "description": "Increased risk of bleeding"
    }
  ]
}
```

## Lab Orders

### Get Lab Orders
```http
GET /lab-orders
Authorization: Bearer <token>

Query Parameters:
- patientId: uuid (optional)
- status: string (optional)
```

### Create Lab Order
```http
POST /lab-orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "patientId": "uuid",
  "tests": [
    {
      "testId": "uuid",
      "testName": "Complete Blood Count",
      "priority": "routine"
    }
  ],
  "notes": "Routine check-up"
}
```

### Get Lab Results
```http
GET /lab-orders/:id/results
Authorization: Bearer <token>
```

### Submit Lab Results
```http
POST /lab-orders/:id/results
Authorization: Bearer <token>
Content-Type: application/json

{
  "results": [
    {
      "testId": "uuid",
      "value": "5.5",
      "unit": "mmol/L",
      "referenceRange": "3.9-5.5",
      "status": "normal"
    }
  ]
}
```

## Vitals

### Get Vitals
```http
GET /vitals
Authorization: Bearer <token>

Query Parameters:
- patientId: uuid (required)
- dateFrom: date (optional)
- dateTo: date (optional)
```

### Record Vitals
```http
POST /vitals
Authorization: Bearer <token>
Content-Type: application/json

{
  "patientId": "uuid",
  "bloodPressure": "120/80",
  "heartRate": 72,
  "temperature": 36.5,
  "weight": 70,
  "height": 175,
  "notes": "Normal vitals"
}
```

## Clinical Templates

### Get Templates
```http
GET /clinical-templates
Authorization: Bearer <token>

Query Parameters:
- specialty: string (optional)
- category: string (optional)
```

### Create Template
```http
POST /clinical-templates
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Diabetes Follow-up",
  "specialty": "endocrinology",
  "content": {
    "sections": [
      {
        "title": "Blood Glucose",
        "fields": ["fasting", "postprandial"]
      }
    ]
  }
}
```

## Error Responses
```json
{
  "statusCode": 400,
  "message": "Invalid diagnosis code"
}
```

