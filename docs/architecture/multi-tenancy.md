# Multi-Tenancy Architecture

## Overview
MediCore uses a database-per-tenant architecture where each clinic has its own isolated database, ensuring complete data separation and security.

## Architecture Pattern

### Database-Per-Tenant
- **Master Database**: Stores tenant metadata
- **Tenant Databases**: One database per clinic
- **Naming Convention**: `clinic_{subdomain}_db`
- **Complete Isolation**: No shared data between tenants

## Tenant Management

### Tenant Registration
1. Tenant registers with subdomain
2. Master database record created
3. New database provisioned
4. Core schema applied
5. Optional bundles applied
6. Initial configuration set

### Tenant Identification
- **Subdomain**: `clinic-name.medicore.com`
- **Tenant Key**: Header `X-Tenant-Key: clinic-name`
- **Database Name**: `clinic_clinic-name_db`

## Database Provisioning

### Automatic Provisioning
- Triggered on tenant registration
- Applies core schema
- Applies subscription-based bundles
- Seeds initial data (optional)

### Manual Provisioning
- Admin-triggered provisioning
- Bundle-specific provisioning
- Schema updates
- Migration scripts

### Schema Bundles
- **Core Bundle**: Base clinic schema
- **SNOMED Bundle**: Terminology tables
- **HIV Bundle**: HIV-specific tables
- **Patient Portal Bundle**: Portal features
- **Billing Bundle**: Financial features
- **Claims Bundle**: Medical aid claims

## Tenant Context

### Request Routing
```typescript
// Middleware extracts tenant from subdomain or header
@Middleware()
export class TenantMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const tenantSubdomain = req.headers['x-tenant-key'] || 
                           extractSubdomain(req.hostname);
    const tenant = await this.getTenant(tenantSubdomain);
    req.tenant = tenant;
    req.tenantDb = await this.getTenantDatabase(tenant);
    next();
  }
}
```

### Database Connection
- Dynamic connection per request
- Connection pooling per tenant
- Automatic connection management
- Connection caching

## Data Isolation

### Complete Isolation
- Separate database per tenant
- No cross-tenant queries possible
- Independent schema versions
- Isolated backups

### Security Benefits
- Data breach containment
- Compliance isolation
- Performance isolation
- Backup/restore per tenant

## Schema Management

### Version Tracking
- Track applied schema versions
- Prevent duplicate applications
- Enable rollback
- Migration history

### Schema Updates
- Bundle-based updates
- Version-controlled changes
- Backward compatibility
- Rollback procedures

## Performance Considerations

### Connection Pooling
- Per-tenant connection pools
- Configurable pool sizes
- Connection reuse
- Timeout management

### Caching
- Tenant-specific cache keys
- Cache isolation
- Cache invalidation per tenant
- Redis namespacing

## Backup & Recovery

### Per-Tenant Backups
- Individual tenant backups
- Point-in-time recovery
- Selective restore
- Backup scheduling per tenant

### Disaster Recovery
- Tenant-specific recovery
- Minimal impact on other tenants
- Isolated recovery procedures
- Data loss containment

## Scaling

### Horizontal Scaling
- Add tenant databases as needed
- Distribute tenants across servers
- Load balancing per tenant
- Independent scaling

### Resource Management
- Per-tenant resource limits
- Usage monitoring per tenant
- Billing per tenant
- Quota management

## Best Practices

### Tenant Management
- Unique subdomain per tenant
- Validate tenant status
- Handle inactive tenants
- Monitor tenant health

### Security
- Never expose tenant data
- Validate tenant context
- Audit tenant access
- Secure tenant switching

### Performance
- Optimize per-tenant queries
- Monitor tenant performance
- Set resource limits
- Cache tenant data
