# Patient Portal API

## Overview
The Patient Portal API provides endpoints for patients to access their health information and interact with the healthcare system.

## Authentication

### Patient Login
```http
POST /patient-portal/login
Content-Type: application/json

{
  "email": "patient@example.com",
  "password": "password123"
}
```

### Patient Register
```http
POST /patient-portal/register
Content-Type: application/json

{
  "email": "patient@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+263771234567",
  "dateOfBirth": "1990-01-01"
}
```

## Dashboard

### Get Dashboard Data
```http
GET /patient-portal/dashboard
Authorization: Bearer <patient-token>
```

**Response:**
```json
{
  "upcomingAppointments": [...],
  "recentLabResults": [...],
  "activePrescriptions": [...],
  "healthGoals": [...],
  "notifications": [...]
}
```

## Appointments

### Get Appointments
```http
GET /patient-portal/appointments
Authorization: Bearer <patient-token>
```

### Request Appointment
```http
POST /patient-portal/appointments/request
Authorization: Bearer <patient-token>
Content-Type: application/json

{
  "doctorId": "uuid",
  "preferredDate": "2024-01-20",
  "preferredTime": "10:00",
  "reason": "Follow-up visit"
}
```

### Cancel Appointment
```http
POST /patient-portal/appointments/:id/cancel
Authorization: Bearer <patient-token>
```

## Vitals Submission

### Submit Vitals
```http
POST /patient-portal/vitals/submit
Authorization: Bearer <patient-token>
Content-Type: application/json

{
  "bloodPressure": "120/80",
  "heartRate": 72,
  "temperature": 36.5,
  "weight": 70,
  "height": 175,
  "bloodGlucose": 5.5,
  "notes": "Morning reading"
}
```

### Get Vitals History
```http
GET /patient-portal/vitals/history
Authorization: Bearer <patient-token>

Query Parameters:
- dateFrom: date (optional)
- dateTo: date (optional)
```

## Prescriptions

### Get Prescriptions
```http
GET /patient-portal/prescriptions
Authorization: Bearer <patient-token>
```

### Download Prescription PDF
```http
GET /patient-portal/prescriptions/:id/download
Authorization: Bearer <patient-token>
```

### Request Refill
```http
POST /patient-portal/prescriptions/:id/refill
Authorization: Bearer <patient-token>
```

## Questionnaires (PROs)

### Get Available Questionnaires
```http
GET /patient-portal/questionnaires/available
Authorization: Bearer <patient-token>
```

### Get Questionnaire
```http
GET /patient-portal/questionnaires/:id
Authorization: Bearer <patient-token>
```

### Submit Questionnaire
```http
POST /patient-portal/questionnaires/:id/submit
Authorization: Bearer <patient-token>
Content-Type: application/json

{
  "responses": [
    {
      "questionId": "q1",
      "answer": 3
    }
  ]
}
```

### Get Questionnaire History
```http
GET /patient-portal/questionnaires/history
Authorization: Bearer <patient-token>
```

### Get Pending Questionnaires
```http
GET /patient-portal/questionnaires/pending
Authorization: Bearer <patient-token>
```

## Health Goals

### Get Health Goals
```http
GET /patient-portal/health-goals
Authorization: Bearer <patient-token>
```

### Create Health Goal
```http
POST /patient-portal/health-goals
Authorization: Bearer <patient-token>
Content-Type: application/json

{
  "title": "Lose Weight",
  "targetValue": 65,
  "currentValue": 70,
  "unit": "kg",
  "targetDate": "2024-06-01"
}
```

### Update Goal Progress
```http
PUT /patient-portal/health-goals/:id/progress
Authorization: Bearer <patient-token>
Content-Type: application/json

{
  "currentValue": 68
}
```

### Get Achievements
```http
GET /patient-portal/achievements
Authorization: Bearer <patient-token>
```

## Telehealth

### Join Telehealth Session
```http
POST /patient-portal/telehealth/:appointmentId/join
Authorization: Bearer <patient-token>
```

**Response:**
```json
{
  "meetingUrl": "https://meet.example.com/room-id",
  "meetingId": "room-id",
  "token": "meeting-token"
}
```

## Health Records Export

### Export Health Records
```http
GET /patient-portal/health-records/export
Authorization: Bearer <patient-token>

Query Parameters:
- format: string (pdf|fhir|json|csv)
- dateFrom: date (optional)
- dateTo: date (optional)
```

## Symptom Checker

### Submit Symptoms
```http
POST /patient-portal/symptom-checker
Authorization: Bearer <patient-token>
Content-Type: application/json

{
  "symptoms": ["headache", "fever", "nausea"],
  "severity": "moderate",
  "duration": "3 days"
}
```

**Response:**
```json
{
  "assessment": "Possible viral infection",
  "recommendations": [
    "Rest and hydration",
    "Monitor symptoms",
    "See doctor if symptoms worsen"
  ],
  "urgency": "low"
}
```

## Family Access

### Grant Family Access
```http
POST /patient-portal/family/access
Authorization: Bearer <patient-token>
Content-Type: application/json

{
  "familyMemberEmail": "family@example.com",
  "permissions": ["view_records", "view_appointments"]
}
```

### Get Family Members
```http
GET /patient-portal/family/members
Authorization: Bearer <patient-token>
```

## Fitness Integration

### Connect Fitness App
```http
POST /patient-portal/fitness/connect
Authorization: Bearer <patient-token>
Content-Type: application/json

{
  "provider": "fitbit",
  "accessToken": "fitbit-token"
}
```

### Get Fitness Data
```http
GET /patient-portal/fitness/data
Authorization: Bearer <patient-token>

Query Parameters:
- provider: string (optional)
- dateFrom: date (optional)
- dateTo: date (optional)
```

## Error Responses
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

