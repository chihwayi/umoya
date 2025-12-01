# Billing & Claims API

## Overview
The Billing API handles invoicing, payments, financial reports, and medical aid claims processing.

## Billing Endpoints

### Get Bills
```http
GET /billing/bills
Authorization: Bearer <token>

Query Parameters:
- patientId: uuid (optional)
- status: string (optional)
- dateFrom: date (optional)
- dateTo: date (optional)
```

### Create Bill
```http
POST /billing/bills
Authorization: Bearer <token>
Content-Type: application/json

{
  "patientId": "uuid",
  "items": [
    {
      "description": "Consultation",
      "quantity": 1,
      "unitPrice": 50.00,
      "total": 50.00
    }
  ],
  "paymentMethod": "cash",
  "medicalAidId": "uuid" // optional
}
```

### Add Payment
```http
POST /billing/bills/:id/payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 50.00,
  "paymentMethod": "cash",
  "paymentDate": "2024-01-15",
  "reference": "REF123"
}
```

### Generate Invoice PDF
```http
GET /billing/bills/:id/invoice
Authorization: Bearer <token>
```

## Financial Reports

### Revenue Report
```http
GET /billing/reports/revenue
Authorization: Bearer <token>

Query Parameters:
- period: string (daily|weekly|monthly|yearly)
- dateFrom: date (optional)
- dateTo: date (optional)
```

**Response:**
```json
{
  "period": "monthly",
  "totalRevenue": 50000.00,
  "breakdown": [
    {
      "date": "2024-01",
      "revenue": 25000.00
    }
  ]
}
```

### Profit & Loss
```http
GET /billing/reports/profit-loss
Authorization: Bearer <token>

Query Parameters:
- dateFrom: date (required)
- dateTo: date (required)
```

### Cash Flow
```http
GET /billing/reports/cash-flow
Authorization: Bearer <token>

Query Parameters:
- dateFrom: date (required)
- dateTo: date (required)
```

### Aging Report
```http
GET /billing/reports/aging
Authorization: Bearer <token>
```

**Response:**
```json
{
  "current": 10000.00,
  "days31_60": 5000.00,
  "days61_90": 2000.00,
  "over90": 1000.00
}
```

## Medical Aid Claims

### Get Claims
```http
GET /claims
Authorization: Bearer <token>

Query Parameters:
- patientId: uuid (optional)
- status: string (optional)
- medicalAidName: string (optional)
```

### Create Claim
```http
POST /claims
Authorization: Bearer <token>
Content-Type: application/json

{
  "patientId": "uuid",
  "billId": "uuid",
  "medicalAidName": "CIMAS",
  "memberNumber": "123456",
  "serviceDate": "2024-01-15",
  "amount": 500.00
}
```

### Submit Claim
```http
POST /claims/:id/submit
Authorization: Bearer <token>

Query Parameters:
- submissionMethod: string (api|edi|manual|portal)
```

### Check Claim Status
```http
GET /claims/:id/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "status": "approved",
  "submittedDate": "2024-01-15",
  "approvedDate": "2024-01-20",
  "approvedAmount": 500.00,
  "externalReference": "CLAIM-12345"
}
```

### Get Status History
```http
GET /claims/:id/status-history
Authorization: Bearer <token>
```

## Pre-Authorization

### Create Pre-Authorization
```http
POST /claims/pre-authorizations
Authorization: Bearer <token>
Content-Type: application/json

{
  "patientId": "uuid",
  "medicalAidName": "CIMAS",
  "memberNumber": "123456",
  "serviceDetails": "Surgery procedure",
  "requestedAmount": 5000.00
}
```

### Get Pre-Authorizations
```http
GET /claims/pre-authorizations
Authorization: Bearer <token>
```

### Link Pre-Auth to Claim
```http
POST /claims/:id/link-preauth/:preAuthId
Authorization: Bearer <token>
```

## Bulk Operations

### Bulk Submit Claims
```http
POST /claims/bulk/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "claimIds": ["uuid1", "uuid2", "uuid3"]
}
```

### Bulk Check Status
```http
POST /claims/bulk/check-status
Authorization: Bearer <token>
Content-Type: application/json

{
  "claimIds": ["uuid1", "uuid2", "uuid3"]
}
```

## Tax Management

### Calculate VAT
```http
POST /billing/tax/calculate-vat
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 100.00,
  "vatInclusive": false
}
```

### Get Tax Reports
```http
GET /billing/tax/reports
Authorization: Bearer <token>

Query Parameters:
- period: string (monthly|quarterly|yearly)
- year: number (required)
```

## Payment Reconciliation

### Import Bank Statement
```http
POST /billing/reconciliation/import
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <bank-statement.csv>
```

### Match Payments
```http
POST /billing/reconciliation/match
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentId": "uuid",
  "bankTransactionId": "uuid"
}
```

## Error Responses
```json
{
  "statusCode": 400,
  "message": "Invalid claim data"
}
```

