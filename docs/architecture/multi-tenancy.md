# Multi-Tenancy Architecture

## Overview
MediCore implements a **strict multi-tenant architecture** ensuring complete data isolation between clinics while maintaining cost efficiency and scalability.

## Tenancy Strategy: Database-per-Tenant with Shared Infrastructure

### Architecture Components

#### 1. Tenant Management Layer
```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Tenant Router   │  │ Rate Limiter    │  │ Auth Filter  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Tenant Service                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Tenant Registry │  │ DB Provisioner  │  │ Config Mgmt  │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Database Architecture
```
Master Database (PostgreSQL)
├── tenant_registry
│   ├── tenant_id (UUID)
│   ├── clinic_name
│   ├── subdomain
│   ├── database_name
│   ├── connection_string
│   ├── subscription_tier
│   ├── created_at
│   └── status
└── tenant_configurations
    ├── tenant_id
    ├── feature_flags
    ├── integration_settings
    └── billing_config

Tenant Databases (Per Clinic)
clinic_abc123_db
├── patients
├── appointments  
├── medical_records
├── prescriptions
├── billing
├── claims
├── users
└── audit_logs
```

### Implementation Strategy

#### Phase 1: Tenant Foundation
1. **Tenant Registry Service**
   - Clinic registration and onboarding
   - Database provisioning automation
   - Subdomain management (clinic1.medicore.co.zw)
   - Subscription tier management

2. **Database Provisioning**
   - Automated database creation per tenant
   - Schema migration automation
   - Connection pool management
   - Backup and recovery per tenant

3. **Request Routing**
   - Subdomain-based tenant identification
   - JWT token tenant validation
   - Database connection routing
   - Cross-tenant access prevention

## Tenant Identification Methods

### 1. Subdomain-based (Primary)
```
https://clinic-abc.medicore.co.zw/api/patients
https://dr-smith-surgery.medicore.co.zw/api/appointments
```

### 2. JWT Token-based (Fallback)
```json
{
  "sub": "user123",
  "tenant_id": "clinic_abc123",
  "role": "doctor",
  "permissions": ["read:patients", "write:prescriptions"]
}
```

### 3. Header-based (API Integration)
```
X-Tenant-ID: clinic_abc123
Authorization: Bearer <jwt_token>
```

## Database Connection Management

### Connection Pool Strategy
```typescript
class TenantConnectionManager {
  private connectionPools: Map<string, Pool> = new Map();
  
  async getConnection(tenantId: string): Promise<Pool> {
    if (!this.connectionPools.has(tenantId)) {
      const config = await this.getTenantDbConfig(tenantId);
      const pool = new Pool(config);
      this.connectionPools.set(tenantId, pool);
    }
    return this.connectionPools.get(tenantId);
  }
  
  private async getTenantDbConfig(tenantId: string) {
    const tenant = await this.tenantRegistry.findById(tenantId);
    return {
      host: tenant.db_host,
      database: tenant.db_name,
      user: tenant.db_user,
      password: tenant.db_password,
      port: tenant.db_port,
      max: 20,
      idleTimeoutMillis: 30000,
    };
  }
}
```

## Security Considerations

### 1. Data Isolation
- **Physical Separation**: Each tenant has dedicated database
- **Access Control**: Tenant-specific user accounts
- **Encryption**: Data encrypted at rest and in transit
- **Audit Logging**: Complete audit trail per tenant

### 2. Cross-Tenant Prevention
- **Request Validation**: Verify tenant context on every request
- **Database Queries**: Tenant ID validation in all queries
- **File Storage**: Tenant-specific storage buckets
- **API Endpoints**: Tenant-aware route guards