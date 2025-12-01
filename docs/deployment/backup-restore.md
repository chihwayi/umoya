# Backup & Restore Guide

## Overview
This guide covers backup and restore procedures for MediCore EHR to ensure data safety and disaster recovery.

## Backup Strategy

### Backup Types
1. **Full Backup**: Complete database dump
2. **Incremental Backup**: Changes since last backup
3. **Transaction Log Backup**: Continuous transaction logs

### Backup Schedule
- **Master Database**: Daily at 2 AM
- **Tenant Databases**: Daily at 3 AM
- **File Storage**: Daily at 4 AM
- **Configuration**: Weekly

## Database Backups

### Master Database Backup
```bash
#!/bin/bash
# scripts/backup-master.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/master"
DB_NAME="medicore_master"
DB_USER="medicore"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker exec medicore-postgres-master pg_dump \
  -U $DB_USER \
  -F c \
  -f /backups/master_$DATE.dump \
  $DB_NAME

# Compress backup
gzip $BACKUP_DIR/master_$DATE.dump

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.dump.gz" -mtime +30 -delete

echo "Backup completed: master_$DATE.dump.gz"
```

### Tenant Database Backup
```bash
#!/bin/bash
# scripts/backup-tenants.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/tenants"
DB_USER="medicore"

# Get all tenant databases
TENANT_DBS=$(docker exec medicore-postgres-master psql -U $DB_USER -d medicore_master -t -c \
  "SELECT \"databaseName\" FROM tenants WHERE status = 'active';")

for DB_NAME in $TENANT_DBS; do
  # Create backup directory
  mkdir -p $BACKUP_DIR/$DB_NAME
  
  # Backup database
  docker exec medicore-postgres-master pg_dump \
    -U $DB_USER \
    -F c \
    -f /backups/$DB_NAME_$DATE.dump \
    $DB_NAME
  
  # Compress backup
  gzip $BACKUP_DIR/$DB_NAME_$DATE.dump
  
  echo "Backed up: $DB_NAME"
done

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.dump.gz" -mtime +30 -delete
```

### Automated Backups
```bash
# Add to crontab
crontab -e

# Daily master backup at 2 AM
0 2 * * * /path/to/scripts/backup-master.sh

# Daily tenant backups at 3 AM
0 3 * * * /path/to/scripts/backup-tenants.sh
```

## File Storage Backups

### MinIO/S3 Backup
```bash
#!/bin/bash
# scripts/backup-files.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/files"

# Backup MinIO data
docker exec medicore-minio mc mirror \
  /data \
  s3/backups/files_$DATE

# Compress
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /data

echo "Files backed up: files_$DATE.tar.gz"
```

## Restore Procedures

### Master Database Restore
```bash
#!/bin/bash
# scripts/restore-master.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file.dump.gz>"
  exit 1
fi

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
  gunzip -c $BACKUP_FILE > /tmp/restore.dump
  BACKUP_FILE="/tmp/restore.dump"
fi

# Restore database
docker exec -i medicore-postgres-master pg_restore \
  -U medicore \
  -d medicore_master \
  -c \
  $BACKUP_FILE

echo "Master database restored from $BACKUP_FILE"
```

### Tenant Database Restore
```bash
#!/bin/bash
# scripts/restore-tenant.sh

TENANT_DB=$1
BACKUP_FILE=$2

if [ -z "$TENANT_DB" ] || [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <tenant-db-name> <backup-file.dump.gz>"
  exit 1
fi

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
  gunzip -c $BACKUP_FILE > /tmp/restore.dump
  BACKUP_FILE="/tmp/restore.dump"
fi

# Restore database
docker exec -i medicore-postgres-master pg_restore \
  -U medicore \
  -d $TENANT_DB \
  -c \
  $BACKUP_FILE

echo "Tenant database $TENANT_DB restored from $BACKUP_FILE"
```

### Point-in-Time Recovery
```bash
# Enable WAL archiving in postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backups/wal/%f'

# Restore to specific point in time
docker exec medicore-postgres-master pg_basebackup \
  -D /backups/base \
  -Ft \
  -z \
  -P

# Recover using WAL files
docker exec medicore-postgres-master pg_recovery \
  -D /backups/base \
  -t '2024-01-15 14:30:00'
```

## Backup Verification

### Verify Backup Integrity
```bash
#!/bin/bash
# scripts/verify-backup.sh

BACKUP_FILE=$1

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found"
  exit 1
fi

# Test restore to temporary database
TEMP_DB="test_restore_$(date +%s)"

# Create temporary database
docker exec medicore-postgres-master psql -U medicore -c \
  "CREATE DATABASE $TEMP_DB;"

# Restore backup
docker exec -i medicore-postgres-master pg_restore \
  -U medicore \
  -d $TEMP_DB \
  $BACKUP_FILE

# Verify tables exist
TABLE_COUNT=$(docker exec medicore-postgres-master psql -U medicore -d $TEMP_DB -t -c \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

echo "Backup verified: $TABLE_COUNT tables restored"

# Cleanup
docker exec medicore-postgres-master psql -U medicore -c \
  "DROP DATABASE $TEMP_DB;"
```

## Cloud Backup

### AWS S3 Backup
```bash
#!/bin/bash
# scripts/backup-to-s3.sh

BACKUP_FILE=$1
S3_BUCKET="medicore-backups"
S3_PATH="database/$(date +%Y/%m)/"

# Upload to S3
aws s3 cp $BACKUP_FILE s3://$S3_BUCKET/$S3_PATH

# Set lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
  --bucket $S3_BUCKET \
  --lifecycle-configuration file://lifecycle.json
```

### Lifecycle Policy
```json
{
  "Rules": [
    {
      "Id": "DeleteOldBackups",
      "Status": "Enabled",
      "Expiration": {
        "Days": 90
      }
    },
    {
      "Id": "TransitionToGlacier",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        }
      ]
    }
  ]
}
```

## Disaster Recovery

### Recovery Time Objective (RTO)
- **Target**: 4 hours
- **Procedure**: Automated failover to backup site

### Recovery Point Objective (RPO)
- **Target**: 1 hour
- **Procedure**: Hourly transaction log backups

### Recovery Procedure
1. **Assess Damage**: Identify what needs recovery
2. **Stop Services**: Prevent further data loss
3. **Restore Latest Backup**: Restore from most recent backup
4. **Apply Transaction Logs**: Recover to latest point
5. **Verify Data**: Check data integrity
6. **Resume Services**: Restart application services
7. **Monitor**: Watch for issues

## Best Practices

### Backup Management
- Test backups regularly
- Store backups offsite
- Encrypt sensitive backups
- Document restore procedures
- Train staff on recovery

### Monitoring
- Monitor backup success/failure
- Alert on backup failures
- Track backup sizes
- Monitor storage usage

### Documentation
- Document all backup procedures
- Keep restore procedures updated
- Maintain backup schedule
- Record recovery tests

