#!/bin/bash

# Script to apply patient messaging and notifications schema to all tenant databases

set -e

echo "🔧 Applying Patient Messaging & Notifications Schema to Tenant Databases..."

# Get list of all tenant databases
TENANT_DBS=$(docker exec medicore-postgres-master psql -U medicore -d postgres -t -c "
  SELECT datname 
  FROM pg_database 
  WHERE datname LIKE 'tenant_%' 
  ORDER BY datname;
")

# Apply schema to each tenant database
for DB in $TENANT_DBS; do
  DB=$(echo $DB | xargs) # Trim whitespace
  if [ -n "$DB" ]; then
    echo "📦 Applying schema to $DB..."
    docker exec -i medicore-postgres-master psql -U medicore -d "$DB" < database/schemas/add-patient-messaging.sql
    echo "✅ Schema applied to $DB"
  fi
done

echo "✅ Patient Messaging & Notifications schema applied to all tenant databases!"

