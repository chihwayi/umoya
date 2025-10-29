# Database Migration & Deployment Guide

## Overview
This guide explains how to handle database migrations for the Medicore EHR system, ensuring all existing tenants and new tenants have the complete schema.

## Current Status ✅

### 1. **Existing Tenants** - COMPLETED
All existing tenant databases now have the nursing tables:
- `clinic_bulawayo-general_db` ✅
- `clinic_city-health_db` ✅  
- `clinic_dr-mukamuri_db` ✅
- `clinic_harare-medical_db` ✅

**Tables Added:**
- `vitals` - Patient vital signs
- `triage_assessments` - Nursing triage assessments
- `nursing_notes` - Nursing documentation
- All necessary indexes and triggers

### 2. **New Tenant Creation** - COMPLETED
The tenant creation process has been updated to include the complete schema:
- All core tables (users, patients, appointments, etc.)
- All nursing tables (vitals, triage_assessments, nursing_notes)
- All medical tables (prescriptions, lab_results, billing, etc.)
- All indexes and triggers for performance

## Deployment Process

### For Existing Deployments
1. **Apply to All Tenants:**
   ```bash
   # Run the migration script
   ./scripts/apply-nursing-tables-to-all-tenants.sh
   ```

2. **Verify Tables Exist:**
   ```bash
   # Check any tenant database
   docker exec medicore-postgres-master psql -U medicore -d clinic_bulawayo-general_db -c "\dt" | grep -E "(vitals|triage|nursing)"
   ```

### For New Deployments
1. **Deploy Services:**
   ```bash
   docker compose up -d
   ```

2. **Create New Tenants:**
   - New tenants will automatically get the complete schema
   - No additional migration needed

### For Server Deployment
1. **Copy Migration Scripts:**
   ```bash
   # Ensure these files are included in deployment
   scripts/apply-nursing-tables-to-all-tenants.sh
   services/tenant-service/src/services/database-provisioning.service.ts
   ```

2. **Run Initial Migration:**
   ```bash
   # On the server, run the migration for existing tenants
   ./scripts/apply-nursing-tables-to-all-tenants.sh
   ```

3. **Verify Deployment:**
   ```bash
   # Check that all tenants have the complete schema
   docker exec medicore-postgres-master psql -U medicore -d medicore_master -c "
   SELECT datname FROM pg_database WHERE datname LIKE 'clinic_%';
   " | while read db; do
     echo "Checking $db..."
     docker exec medicore-postgres-master psql -U medicore -d "$db" -c "\dt" | grep -E "(vitals|triage|nursing)"
   done
   ```

## Schema Evolution

### Adding New Tables/Columns
1. **Update Template Schema:**
   - Edit `services/tenant-service/src/services/database-provisioning.service.ts`
   - Add new tables/columns to `getClinicSchema()`

2. **Create Migration Script:**
   - Create new script in `scripts/` directory
   - Use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE` statements

3. **Apply to Existing Tenants:**
   - Run migration script on all existing tenants
   - New tenants will get updated schema automatically

### Example Migration Script
```bash
#!/bin/bash
# scripts/add-new-feature-tables.sh

TENANT_DBS=$(docker exec medicore-postgres-master psql -U medicore -d medicore_master -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'clinic_%';" | tr -d ' ')

for tenant_db in $TENANT_DBS; do
    if [ ! -z "$tenant_db" ]; then
        echo "Adding new tables to: $tenant_db"
        docker exec medicore-postgres-master psql -U medicore -d "$tenant_db" -c "
        CREATE TABLE IF NOT EXISTS new_feature_table (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            -- your columns here
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        "
        echo "✅ Completed: $tenant_db"
    fi
done
```

## Verification Commands

### Check All Tenant Databases
```bash
docker exec medicore-postgres-master psql -U medicore -d medicore_master -c "
SELECT datname FROM pg_database WHERE datname LIKE 'clinic_%';
"
```

### Check Specific Tenant Tables
```bash
docker exec medicore-postgres-master psql -U medicore -d clinic_bulawayo-general_db -c "\dt"
```

### Check Table Structure
```bash
docker exec medicore-postgres-master psql -U medicore -d clinic_bulawayo-general_db -c "\d vitals"
```

## Troubleshooting

### Missing Tables Error
If you get 404 errors for vitals/triage endpoints:
1. Check if tables exist: `\dt` in tenant database
2. If missing, run the migration script
3. Restart the EHR service

### New Tenant Missing Tables
If new tenants don't have all tables:
1. Check tenant service logs
2. Verify `database-provisioning.service.ts` has complete schema
3. Rebuild tenant service: `docker compose build tenant-service`

### Performance Issues
If queries are slow:
1. Check indexes exist: `\di` in tenant database
2. Run `ANALYZE` on tables
3. Check query execution plans

## Summary

✅ **All existing tenants updated**  
✅ **New tenant creation includes complete schema**  
✅ **Deployment process documented**  
✅ **Migration scripts available**  

The system is now ready for production deployment with full nursing functionality across all tenants.
