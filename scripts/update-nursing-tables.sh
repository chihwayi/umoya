#!/bin/bash

# Master database connection details
MASTER_DB_HOST="localhost"
MASTER_DB_PORT="5432"
MASTER_DB_NAME="medicore_master"
MASTER_DB_USER="medicore"
MASTER_DB_PASSWORD="medicore_password"

# Path to the migration script
MIGRATION_SCRIPT="./database/migrations/002-add-nursing-tables.sql"

echo "Starting nursing tables migration for existing tenants..."

# Get all tenant database names from the master database
TENANT_DBS=$(PGPASSWORD=$MASTER_DB_PASSWORD psql -h $MASTER_DB_HOST -p $MASTER_DB_PORT -U $MASTER_DB_USER -d $MASTER_DB_NAME -t -c "SELECT \"databaseName\" FROM tenants WHERE status = 'active';")

if [ -z "$TENANT_DBS" ]; then
    echo "No active tenants found to migrate."
    exit 0
fi

for DB_NAME in $TENANT_DBS; do
    DB_NAME=$(echo "$DB_NAME" | xargs) # Trim whitespace
    echo "Applying nursing tables migration to tenant database: $DB_NAME"
    
    # Apply the migration script to each tenant database
    PGPASSWORD=$MASTER_DB_PASSWORD psql -h $MASTER_DB_HOST -p $MASTER_DB_PORT -U $MASTER_DB_USER -d "$DB_NAME" -f "$MIGRATION_SCRIPT"
    
    if [ $? -eq 0 ]; then
        echo "Successfully migrated $DB_NAME"
    else
        echo "Error migrating $DB_NAME. Please check the logs."
    fi
done

echo "Nursing tables migration process completed."
