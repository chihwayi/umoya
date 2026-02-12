
#!/bin/bash

DATABASES=("clinic_kids-clinic_db" "clinic_testghost2_db" "clinic_testghost_db")

for DB in "${DATABASES[@]}"; do
    echo "Processing database: $DB"
    
    echo "  Applying missing tables (prescriptions, medication_reminders)..."
    cat database/schemas/fix_missing_tables.sql | docker exec -i medicore-postgres-master psql -U postgres -d "$DB"
    
    echo "  Applying migration 027 (add columns)..."
    cat database/migrations/027-fix-medication-reminders.sql | docker exec -i medicore-postgres-master psql -U postgres -d "$DB"
    
    echo "Done with $DB"
    echo "----------------------------------------"
done
