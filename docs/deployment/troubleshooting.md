# Troubleshooting Guide

## Overview
This guide covers common issues and troubleshooting procedures for MediCore EHR.

## Common Issues

### Service Won't Start

#### Symptoms
- Service exits immediately
- Container keeps restarting
- Port already in use error

#### Solutions
```bash
# Check logs
docker compose logs <service-name>

# Check port usage
lsof -i :3000
lsof -i :3001

# Restart service
docker compose restart <service-name>

# Rebuild service
docker compose up -d --build <service-name>
```

### Database Connection Issues

#### Symptoms
- "Connection refused" errors
- "Database does not exist" errors
- Timeout errors

#### Solutions
```bash
# Verify database is running
docker compose ps postgres-master

# Check database connection
docker exec medicore-postgres-master psql -U medicore -d medicore_master -c "SELECT 1;"

# Check connection string
docker compose exec ehr-service env | grep DB

# Test connection from application
docker compose exec ehr-service npm run test:db
```

### Authentication Issues

#### Symptoms
- "Invalid token" errors
- "Unauthorized" responses
- Login failures

#### Solutions
```bash
# Check JWT secret
echo $JWT_SECRET

# Verify token expiration
# Check token in JWT.io

# Clear Redis cache
docker exec medicore-redis redis-cli FLUSHALL

# Reset user password
# Use admin panel or database
```

### Performance Issues

#### Symptoms
- Slow response times
- High CPU usage
- High memory usage
- Database timeouts

#### Solutions
```bash
# Check resource usage
docker stats

# Check database performance
docker exec medicore-postgres-master psql -U medicore -c "
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"

# Check slow queries
# Enable slow query log in postgresql.conf

# Optimize database
docker exec medicore-postgres-master psql -U medicore -d medicore_master -c "VACUUM ANALYZE;"
```

### Tenant Provisioning Issues

#### Symptoms
- Tenant creation fails
- Schema not applied
- Missing tables

#### Solutions
```bash
# Check tenant status
SELECT * FROM tenants WHERE id = '<tenant-id>';

# Check schema versions
SELECT * FROM tenant_schema_versions WHERE tenant_id = '<tenant-id>';

# Manually provision
POST /tenants/provision-database/:tenantId

# Check database exists
SELECT datname FROM pg_database WHERE datname = 'clinic_<subdomain>_db';

# Verify tables
docker exec medicore-postgres-tenant psql -U medicore -d clinic_<subdomain>_db -c "\dt"
```

## Error Messages

### "Invalid tenant error"
- **Cause**: Tenant not found or inactive
- **Solution**: Verify tenant exists and is active

### "Database connection timeout"
- **Cause**: Database server overloaded or network issues
- **Solution**: Check database performance and network

### "Schema version mismatch"
- **Cause**: Tenant schema not up to date
- **Solution**: Run provisioning for tenant

### "JWT token expired"
- **Cause**: Token expired or invalid
- **Solution**: Re-authenticate user

### "Permission denied"
- **Cause**: User lacks required permissions
- **Solution**: Check user role and permissions

## Diagnostic Commands

### System Health
```bash
# Check all services
docker compose ps

# Check service health
curl http://localhost:3001/health

# Check database health
docker exec medicore-postgres-master pg_isready

# Check Redis health
docker exec medicore-redis redis-cli PING
```

### Logs
```bash
# View all logs
docker compose logs

# Follow logs
docker compose logs -f

# View specific service logs
docker compose logs -f ehr-service

# View last 100 lines
docker compose logs --tail=100 ehr-service

# Search logs
docker compose logs | grep "error"
```

### Database Diagnostics
```bash
# Check database size
docker exec medicore-postgres-master psql -U medicore -c "
  SELECT pg_size_pretty(pg_database_size('medicore_master'));
"

# Check active connections
docker exec medicore-postgres-master psql -U medicore -c "
  SELECT count(*) FROM pg_stat_activity;
"

# Check locks
docker exec medicore-postgres-master psql -U medicore -c "
  SELECT * FROM pg_locks WHERE NOT granted;
"
```

## Recovery Procedures

### Service Recovery
```bash
# Stop all services
docker compose down

# Remove problematic containers
docker compose rm -f <service-name>

# Rebuild and start
docker compose up -d --build
```

### Database Recovery
```bash
# Restore from backup
./scripts/restore-master.sh backup.dump.gz

# Reset tenant database
# WARNING: This will delete all data
docker exec medicore-postgres-tenant psql -U medicore -c "
  DROP DATABASE clinic_<subdomain>_db;
"
# Then re-provision
POST /tenants/provision-database/:tenantId
```

### Data Recovery
```bash
# Restore specific table
docker exec -i medicore-postgres-master psql -U medicore -d medicore_master < table_backup.sql

# Restore specific tenant
./scripts/restore-tenant.sh clinic_name_db backup.dump.gz
```

## Getting Help

### Information to Collect
1. **Error Messages**: Full error text
2. **Logs**: Relevant log entries
3. **Configuration**: Environment variables (sanitized)
4. **System Info**: OS, Docker version, etc.
5. **Steps to Reproduce**: Detailed steps

### Support Channels
- **Email**: support@medicore.com
- **Documentation**: Check docs folder
- **GitHub Issues**: For bug reports
- **Community Forum**: For discussions

## Prevention

### Regular Maintenance
- Monitor system health
- Review logs regularly
- Update dependencies
- Backup databases
- Test restore procedures

### Best Practices
- Use health checks
- Set up monitoring
- Configure alerts
- Document procedures
- Train staff

