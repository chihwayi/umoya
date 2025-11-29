# Patient Portal Data Storage Architecture

## 📍 Where Patient Portal Data is Stored

### **Answer: Patient portal data is stored in TENANT databases, NOT in a separate database**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Patient Portal Frontend                   │
│              (React App on Port 3015)                        │
│                                                              │
│  - Login/Register Pages                                      │
│  - Dashboard, Appointments, Records, etc.                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP Requests
                     │
┌────────────────────▼────────────────────────────────────────┐
│              EHR Service Backend (Port 3013)                │
│                                                              │
│  - PatientAuthService                                       │
│  - PatientPortalService                                     │
│  - PatientPortalController                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Database Queries
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Tenant Databases (Per Clinic)                  │
│                                                              │
│  ┌──────────────────────────────────────────────┐          │
│  │  patients table                              │          │
│  │  - portal_password_hash                      │          │
│  │  - portal_access_enabled                     │          │
│  │  - portal_registered_at                      │          │
│  │  - portal_last_login                         │          │
│  │  - portal_email_verified                     │          │
│  │  - portal_email_verification_token           │          │
│  │  - portal_password_reset_token              │          │
│  │  - portal_password_reset_expires            │          │
│  └──────────────────────────────────────────────┘          │
│                                                              │
│  ┌──────────────────────────────────────────────┐          │
│  │  Other Patient Data                          │          │
│  │  - appointments                               │          │
│  │  - medical_records                            │          │
│  │  - lab_orders                                │          │
│  │  - prescriptions                              │          │
│  │  - billing                                    │          │
│  └──────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Data Storage Details

### 1. **Patient Portal Authentication Data**
- **Location**: `patients` table in each tenant database
- **Columns**:
  - `portal_password_hash` - Hashed password for portal login
  - `portal_access_enabled` - Whether patient has portal access
  - `portal_registered_at` - Registration timestamp
  - `portal_last_login` - Last login timestamp
  - `portal_email_verified` - Email verification status
  - `portal_email_verification_token` - Email verification token
  - `portal_password_reset_token` - Password reset token
  - `portal_password_reset_expires` - Reset token expiration

### 2. **Patient Portal Data Access**
- **Appointments**: Stored in `appointments` table (tenant database)
- **Medical Records**: Stored in `medical_records` table (tenant database)
- **Lab Results**: Stored in `lab_orders` table (tenant database)
- **Prescriptions**: Stored in `prescriptions` table (tenant database)
- **Bills**: Stored in `billing` table (tenant database)

## Why Tenant Databases?

### ✅ **Benefits**:
1. **Data Isolation**: Each clinic's patient data is completely isolated
2. **Security**: Multi-tenant architecture ensures no cross-clinic data access
3. **Scalability**: Each tenant database can scale independently
4. **Compliance**: HIPAA compliance maintained per tenant
5. **Simplicity**: No need for separate database management

### 🔒 **Security**:
- Patient portal requests include tenant identification
- Backend validates tenant and routes to correct database
- No cross-tenant data access possible
- All access logged via HIPAA audit logs

## Code Flow

### Registration Flow:
```typescript
// PatientPortalController receives request with tenant ID
POST /api/patient-portal/register
Headers: X-Tenant-ID: <tenant-id>

// PatientAuthService uses TenantService to get tenant database
const connection = await this.tenantService.getTenantDatabase(tenantId);
const patientRepository = connection.getRepository(Patient);

// Patient record updated in tenant database
patient.portalAccessEnabled = true;
patient.portalPasswordHash = hashedPassword;
await patientRepository.save(patient);
```

### Login Flow:
```typescript
// PatientPortalController receives request with tenant ID
POST /api/patient-portal/login
Headers: X-Tenant-ID: <tenant-id>

// PatientAuthService queries tenant database
const patient = await patientRepository.findOne({
  where: { email: loginDto.email, portalAccessEnabled: true }
});

// Authentication verified against tenant database
```

## Database Provisioning

### ✅ **Already Provisioned**:
- Patient portal columns added to `patients` table in all tenant databases
- Schema included in base template for new tenants
- Indexes created for performance

### **No Separate Database Needed**:
- ❌ No `patient_portal_db`
- ❌ No `medicore_patient_web_db`
- ✅ All data in tenant databases

## Summary

**Patient portal data is stored in TENANT databases**, not in a separate database. This maintains:
- ✅ Multi-tenant isolation
- ✅ Security and compliance
- ✅ Simplicity and scalability
- ✅ HIPAA compliance per tenant

The patient portal frontend (React app) connects to the EHR backend, which routes all requests to the appropriate tenant database based on the tenant identifier in the request.

