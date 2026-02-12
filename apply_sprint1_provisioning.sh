#!/bin/bash
# Apply Sprint 1 missing tables to all tenant databases

DB_USER="postgres"
# List of databases to update
DATABASES=("clinic_kids-clinic_db" "clinic_testghost2_db" "clinic_testghost_db")

SQL_FILE="database/schemas/provision_missing_tables_sprint1.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "Error: SQL file $SQL_FILE not found!"
    exit 1
fi

for DB_NAME in "${DATABASES[@]}"; do
  echo "---------------------------------------------------"
  echo "Applying Sprint 1 provisioning to database: $DB_NAME"
  echo "---------------------------------------------------"
  
  # Pipe the SQL file content directly to the psql command in the container
  cat "$SQL_FILE" | docker exec -i medicore-postgres-master psql -U $DB_USER -d $DB_NAME
  
  if [ $? -eq 0 ]; then
      echo "✅ Successfully applied to $DB_NAME"
  else
      echo "❌ Failed to apply to $DB_NAME"
  fi
done

echo "---------------------------------------------------"
echo "All databases processed."
