# Authentication API

## Overview
MediCore EHR uses JWT (JSON Web Tokens) for authentication. All API requests require a valid JWT token in the Authorization header.

## Authentication Endpoints

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "tenantSubdomain": "clinic-name"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "doctor",
    "name": "Dr. John Doe"
  }
}
```

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "doctor",
  "tenantSubdomain": "clinic-name"
}
```

### Refresh Token
```http
POST /auth/refresh
Authorization: Bearer <refresh_token>
```

### Logout
```http
POST /auth/logout
Authorization: Bearer <access_token>
```

## Using Authentication

### Request Headers
```http
Authorization: Bearer <access_token>
X-Tenant-Key: <tenant-subdomain>
```

### Token Expiration
- **Access Token**: 24 hours
- **Refresh Token**: 7 days

### Role-Based Access
- **admin**: Full system access
- **doctor**: Clinical and patient access
- **nurse**: Clinical documentation access
- **receptionist**: Patient and appointment access
- **pharmacist**: Prescription access
- **lab_tech**: Lab order access
- **radiologist**: Imaging access
- **accounts**: Billing access

## Patient Portal Authentication

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

### Password Reset
```http
POST /patient-portal/forgot-password
Content-Type: application/json

{
  "email": "patient@example.com"
}
```

```http
POST /patient-portal/reset-password
Content-Type: application/json

{
  "token": "reset-token",
  "newPassword": "newpassword123"
}
```

## Security

### Best Practices
- Use HTTPS in production
- Store tokens securely
- Implement token refresh
- Validate tokens server-side
- Use strong passwords
- Enable 2FA (optional)

### Error Responses
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Invalid token"
}
```

