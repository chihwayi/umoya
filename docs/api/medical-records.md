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

## Document Management (Sprint 19)

### Upload Document
```http
POST /documents/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- file: file (required)
- patientId: uuid (required)
- documentType: string (required)
- description: string (optional)
- tags: string[] (optional)
```

### Get Documents
```http
GET /documents
Authorization: Bearer <token>

Query Parameters:
- patientId: uuid (required)
- documentType: string (optional)
- dateFrom: date (optional)
- dateTo: date (optional)
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "patientId": "uuid",
      "documentType": "lab_result",
      "fileName": "blood_test.pdf",
      "fileSize": 102400,
      "uploadedBy": "uuid",
      "uploadedAt": "2025-12-02T10:00:00Z",
      "tags": ["blood test", "routine"],
      "version": 1
    }
  ]
}
```

### Get Document by ID
```http
GET /documents/:id
Authorization: Bearer <token>
```

### Update Document Metadata
```http
PUT /documents/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Updated description",
  "tags": ["updated", "tags"]
}
```

### Delete Document
```http
DELETE /documents/:id
Authorization: Bearer <token>
```

### Document Versioning
```http
POST /documents/:id/versions
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- file: file (required)
- changeSummary: string (optional)
```

### Get Document Versions
```http
GET /documents/:id/versions
Authorization: Bearer <token>
```

### Restore Document Version
```http
POST /documents/:id/versions/:versionId/restore
Authorization: Bearer <token>
```

### Share Document
```http
POST /documents/:id/share
Authorization: Bearer <token>
Content-Type: application/json

{
  "shared_with_user_id": "uuid",
  "permission_level": "view",
  "expires_at": "2025-12-31T23:59:59Z"
}
```

### Get Shared Documents
```http
GET /documents/shared
Authorization: Bearer <token>
```

### Document Tags
```http
POST /documents/:id/tags
Authorization: Bearer <token>
Content-Type: application/json

{
  "tag_name": "urgent"
}
```

```http
DELETE /documents/:id/tags/:tagName
Authorization: Bearer <token>
```

### Document Access Log
```http
GET /documents/:id/access-log
Authorization: Bearer <token>
```

## Provider Messaging (Sprint 20)

### Send Message
```http
POST /messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipient_id": "uuid",
  "recipient_role": "nurse",
  "recipient_team": "ICU",
  "subject": "Patient Follow-up Required",
  "message_text": "Please review lab results for patient...",
  "message_type": "message",
  "priority": "high",
  "patient_id": "uuid",
  "appointment_id": "uuid",
  "requires_response": true
}
```

### Get Inbox
```http
GET /messages/inbox
Authorization: Bearer <token>

Query Parameters:
- status: string (optional)
- priority: string (optional)
- message_type: string (optional)
- limit: number (default: 50)
- offset: number (default: 0)
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "sender_id": "uuid",
      "subject": "Patient Follow-up Required",
      "message_text": "Please review lab results...",
      "message_type": "message",
      "priority": "high",
      "status": "sent",
      "sent_at": "2025-12-02T10:00:00Z",
      "sender": {
        "name": "Dr. Smith",
        "role": "doctor"
      }
    }
  ],
  "total": 25
}
```

### Get Sent Messages
```http
GET /messages/sent
Authorization: Bearer <token>
```

### Get Message by ID
```http
GET /messages/:id
Authorization: Bearer <token>
```

### Reply to Message
```http
POST /messages/:id/reply
Authorization: Bearer <token>
Content-Type: application/json

{
  "message_text": "I will review the results shortly."
}
```

### Forward Message
```http
POST /messages/:id/forward
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipient_id": "uuid",
  "message_text": "FYI - please handle this case."
}
```

### Mark as Read/Unread
```http
PUT /messages/:id/read
Authorization: Bearer <token>
```

```http
PUT /messages/:id/unread
Authorization: Bearer <token>
```

### Archive/Delete Message
```http
POST /messages/:id/archive
Authorization: Bearer <token>
```

```http
DELETE /messages/:id
Authorization: Bearer <token>
```

### Get Unread Count
```http
GET /messages/unread-count
Authorization: Bearer <token>
```

**Response:**
```json
{
  "count": 5
}
```

### Search Messages
```http
GET /messages/search
Authorization: Bearer <token>

Query Parameters:
- query: string (required)
- message_type: string (optional)
- priority: string (optional)
```

### Message Threads
```http
GET /messages/threads
Authorization: Bearer <token>
```

```http
GET /messages/threads/:id
Authorization: Bearer <token>
```

```http
POST /messages/threads
Authorization: Bearer <token>
Content-Type: application/json

{
  "subject": "Patient Care Coordination",
  "patient_id": "uuid",
  "participants": ["uuid1", "uuid2"]
}
```

### Message Templates
```http
GET /messages/templates/list
Authorization: Bearer <token>

Query Parameters:
- category: string (optional)
```

```http
GET /messages/templates/:id
Authorization: Bearer <token>
```

```http
POST /messages/templates/:id/apply
Authorization: Bearer <token>
Content-Type: application/json

{
  "patient_name": "Sarah Johnson",
  "doctor_name": "Dr. Smith",
  "test_name": "Blood Glucose"
}
```

### Message Tasks
```http
POST /messages/:id/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "task_title": "Review Lab Results",
  "task_description": "Review and follow up on abnormal results",
  "assigned_to": "uuid",
  "due_date": "2025-12-05T17:00:00Z",
  "priority": "high"
}
```

```http
GET /messages/:id/tasks
Authorization: Bearer <token>
```

```http
PUT /messages/tasks/:taskId
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "in_progress"
}
```

```http
POST /messages/tasks/:taskId/complete
Authorization: Bearer <token>
Content-Type: application/json

{
  "completion_notes": "Lab results reviewed and patient contacted."
}
```

## Error Responses
```json
{
  "statusCode": 400,
  "message": "Invalid diagnosis code"
}
```

