
#!/bin/bash

DATABASES=("clinic_kids-clinic_db" "clinic_testghost2_db" "clinic_testghost_db")

for DB in "${DATABASES[@]}"; do
    echo "Processing database: $DB"
    
    echo "  Applying Sprint 1 Provisioning (Missing Tables)..."
    cat database/schemas/provision_missing_tables_sprint1.sql | docker exec -i medicore-postgres-master psql -U postgres -d "$DB"
    
    echo "  Ensuring Migration 028 (Revenue Cycle) is applied..."
    cat database/migrations/028-revenue-cycle-approval-workflow.sql | docker exec -i medicore-postgres-master psql -U postgres -d "$DB"

    echo "  Ensuring Migration 029 (Drug RxNorm) is applied..."
    cat database/migrations/029-enhance-drug-entity-rxnorm.sql | docker exec -i medicore-postgres-master psql -U postgres -d "$DB"

    echo "  Ensuring Migration 030 (Diagnosis Codes) is applied..."
    cat database/migrations/030-add-diagnosis-codes-to-appointments.sql | docker exec -i medicore-postgres-master psql -U postgres -d "$DB"

    echo "  Ensuring Migration 030 (Pharmacy Columns) is applied..."
    cat database/migrations/030-add-pharmacy-dispensing-columns.sql | docker exec -i medicore-postgres-master psql -U postgres -d "$DB"

    echo "  Ensuring Migration 032 (WHO Smart Forms) is applied..."
    cat database/migrations/032-add-who-smart-forms-data-columns.sql | docker exec -i medicore-postgres-master psql -U postgres -d "$DB"
    
    echo "Done with $DB"
    echo "----------------------------------------"
done
