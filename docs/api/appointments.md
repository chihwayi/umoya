# Appointments API

## Overview
The Appointments API manages appointment scheduling, calendar views, and waitlist management.

## Endpoints

### Get Appointments
```http
GET /appointments
Authorization: Bearer <token>

Query Parameters:
- patientId: uuid (optional)
- doctorId: uuid (optional)
- status: string (optional)
- dateFrom: date (optional)
- dateTo: date (optional)
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
      "appointmentDate": "2024-01-15T10:00:00Z",
      "duration": 30,
      "type": "consultation",
      "status": "scheduled",
      "notes": "Follow-up visit"
    }
  ],
  "total": 50,
  "page": 1
}
```

### Get Appointment by ID
```http
GET /appointments/:id
Authorization: Bearer <token>
```

### Create Appointment
```http
POST /appointments
Authorization: Bearer <token>
Content-Type: application/json

{
  "patientId": "uuid",
  "doctorId": "uuid",
  "appointmentDate": "2024-01-15T10:00:00Z",
  "duration": 30,
  "type": "consultation",
  "notes": "Initial consultation"
}
```

### Update Appointment
```http
PUT /appointments/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "appointmentDate": "2024-01-15T11:00:00Z",
  "status": "rescheduled"
}
```

### Cancel Appointment
```http
POST /appointments/:id/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Patient requested cancellation"
}
```

### Complete Appointment
```http
POST /appointments/:id/complete
Authorization: Bearer <token>
```

## Calendar Views

### Month View
```http
GET /appointments/calendar/month
Authorization: Bearer <token>

Query Parameters:
- year: number (required)
- month: number (required)
- doctorId: uuid (optional)
```

### Week View
```http
GET /appointments/calendar/week
Authorization: Bearer <token>

Query Parameters:
- year: number (required)
- week: number (required)
- doctorId: uuid (optional)
```

### Day View
```http
GET /appointments/calendar/day
Authorization: Bearer <token>

Query Parameters:
- date: date (required)
- doctorId: uuid (optional)
```

## Recurring Appointments

### Create Recurring Appointment
```http
POST /appointments/recurring
Authorization: Bearer <token>
Content-Type: application/json

{
  "patientId": "uuid",
  "doctorId": "uuid",
  "startDate": "2024-01-15T10:00:00Z",
  "endDate": "2024-03-15T10:00:00Z",
  "frequency": "weekly",
  "duration": 30,
  "type": "follow-up"
}
```

## Waitlist

### Add to Waitlist
```http
POST /appointments/waitlist
Authorization: Bearer <token>
Content-Type: application/json

{
  "patientId": "uuid",
  "doctorId": "uuid",
  "preferredDate": "2024-01-20",
  "notes": "Urgent appointment needed"
}
```

### Get Waitlist
```http
GET /appointments/waitlist
Authorization: Bearer <token>

Query Parameters:
- doctorId: uuid (optional)
- status: string (optional)
```

### Remove from Waitlist
```http
DELETE /appointments/waitlist/:id
Authorization: Bearer <token>
```

## Conflict Detection

### Check Conflicts
```http
POST /appointments/check-conflicts
Authorization: Bearer <token>
Content-Type: application/json

{
  "doctorId": "uuid",
  "appointmentDate": "2024-01-15T10:00:00Z",
  "duration": 30
}
```

**Response:**
```json
{
  "hasConflict": false,
  "conflictingAppointments": []
}
```

## Reminders

### Send Reminder
```http
POST /appointments/:id/send-reminder
Authorization: Bearer <token>
```

### Get Reminder Settings
```http
GET /appointments/reminder-settings
Authorization: Bearer <token>
```

## Telehealth

### Create Telehealth Appointment
```http
POST /appointments/telehealth
Authorization: Bearer <token>
Content-Type: application/json

{
  "patientId": "uuid",
  "doctorId": "uuid",
  "appointmentDate": "2024-01-15T10:00:00Z",
  "duration": 30
}
```

**Response:**
```json
{
  "id": "uuid",
  "meetingUrl": "https://meet.example.com/room-id",
  "meetingId": "room-id"
}
```

## Error Responses
```json
{
  "statusCode": 409,
  "message": "Appointment conflict detected",
  "conflictingAppointments": [...]
}
```

