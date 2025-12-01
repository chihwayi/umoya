# Patients API

## Overview
The Patients API provides endpoints for managing patient information, medical history, and demographics.

## Endpoints

### Get All Patients
```http
GET /patients
Authorization: Bearer <token>
X-Tenant-Key: <subdomain>

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- search: string (optional)
- gender: string (optional)
- ageMin: number (optional)
- ageMax: number (optional)
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "dateOfBirth": "1990-01-01",
      "gender": "male",
      "phone": "+263771234567",
      "email": "john@example.com"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### Get Patient by ID
```http
GET /patients/:id
Authorization: Bearer <token>
```

### Create Patient
```http
POST /patients
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-01",
  "gender": "male",
  "phone": "+263771234567",
  "email": "john@example.com",
  "address": {
    "street": "123 Main St",
    "city": "Harare",
    "country": "Zimbabwe"
  },
  "medicalAid": {
    "provider": "CIMAS",
    "memberNumber": "123456",
    "principalMember": "John Doe"
  }
}
```

### Update Patient
```http
PUT /patients/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "+263779876543",
  "email": "newemail@example.com"
}
```

### Delete Patient
```http
DELETE /patients/:id
Authorization: Bearer <token>
```

## Advanced Search
```http
GET /patients/search/advanced
Authorization: Bearer <token>

Query Parameters:
- search: string (name, ID, phone, email)
- gender: string
- ageMin: number
- ageMax: number
- registrationDateFrom: date
- registrationDateTo: date
- medicalAidProvider: string
- city: string
```

## Medical History

### Get Medical History
```http
GET /patients/:patientId/history/medical
Authorization: Bearer <token>
```

### Add Medical History
```http
POST /patients/:patientId/history/medical
Authorization: Bearer <token>
Content-Type: application/json

{
  "condition": "Hypertension",
  "snomedCode": "38341003",
  "diagnosisDate": "2020-01-01",
  "status": "active",
  "notes": "Controlled with medication"
}
```

### Update Medical History
```http
PUT /patients/:patientId/history/medical/:id
Authorization: Bearer <token>
```

### Delete Medical History
```http
DELETE /patients/:patientId/history/medical/:id
Authorization: Bearer <token>
```

## Family History
```http
GET /patients/:patientId/history/family
POST /patients/:patientId/history/family
PUT /patients/:patientId/history/family/:id
DELETE /patients/:patientId/history/family/:id
```

## Social History
```http
GET /patients/:patientId/history/social
POST /patients/:patientId/history/social
PUT /patients/:patientId/history/social/:id
DELETE /patients/:patientId/history/social/:id
```

## Timeline
```http
GET /patients/:patientId/history/timeline
Authorization: Bearer <token>

Response: Combined view of all history types in chronological order
```

## Documents
```http
GET /patients/:patientId/documents
POST /patients/:patientId/documents
DELETE /patients/:patientId/documents/:id
```

## Error Responses
```json
{
  "statusCode": 404,
  "message": "Patient not found"
}
```

