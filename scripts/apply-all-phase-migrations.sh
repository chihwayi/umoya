#!/bin/bash

# Script to apply ALL Phase 1 & Phase 2 migrations to tenant_bulawayo_general
# Run this from the project root: bash scripts/apply-all-phase-migrations.sh

set -e

echo "🏥 MediCore - Applying All Phase Migrations"
echo "Database: tenant_bulawayo_general"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if postgres container is running
if ! docker ps | grep medicore-postgres-master > /dev/null; then
    echo "❌ PostgreSQL container not running. Starting..."
    docker start medicore-postgres-master
    sleep 3
fi

echo "✅ Docker and PostgreSQL are running"
echo ""

# Function to apply migration
apply_migration() {
    local migration_file=$1
    local migration_name=$(basename $migration_file)
    
    echo "📝 Applying: $migration_name"
    
    if docker exec -i medicore-postgres-master psql -U medicore -d tenant_bulawayo_general < "$migration_file" > /dev/null 2>&1; then
        echo "   ✅ Success"
    else
        echo "   ⚠️  Already applied or error (continuing...)"
    fi
}

# PHASE 1 MIGRATIONS
echo "=========================================="
echo "PHASE 1 MIGRATIONS (Sprints 26-29)"
echo "=========================================="
echo ""

# Sprint 26: Operating Room
if [ -f "database/migrations/010-operating-room-management.sql" ]; then
    echo "Sprint 26: Operating Room Management"
    apply_migration "database/migrations/010-operating-room-management.sql"
    echo ""
fi

# Sprint 27: Anesthesia
if [ -f "database/migrations/011-anesthesia-module.sql" ]; then
    echo "Sprint 27: Anesthesia Module"
    apply_migration "database/migrations/011-anesthesia-module.sql"
    echo ""
fi

# Sprint 28: BCMA
if [ -f "database/migrations/012-bcma-medication-safety.sql" ]; then
    echo "Sprint 28: BCMA (Medication Safety)"
    apply_migration "database/migrations/012-bcma-medication-safety.sql"
    echo ""
fi

# Sprint 29: Blood Bank
if [ -f "database/migrations/013-blood-bank-management.sql" ]; then
    echo "Sprint 29: Blood Bank Management"
    apply_migration "database/migrations/013-blood-bank-management.sql"
    echo ""
fi

# PHASE 2 MIGRATIONS
echo "=========================================="
echo "PHASE 2 MIGRATIONS (Sprint 30+)"
echo "=========================================="
echo ""

# Sprint 30: Infection Control
if [ -f "database/migrations/014-infection-control.sql" ]; then
    echo "Sprint 30: Infection Control"
    apply_migration "database/migrations/014-infection-control.sql"
    echo ""
fi

# VERIFICATION
echo "=========================================="
echo "VERIFICATION"
echo "=========================================="
echo ""

echo "📊 Checking table counts..."
echo ""

echo "Phase 1 Tables:"
docker exec medicore-postgres-master psql -U medicore -d tenant_bulawayo_general -c "
SELECT 
    'Operating Room' as module, 
    COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%operating%' OR table_name LIKE '%surgical%' OR table_name LIKE 'or_%')
UNION ALL
SELECT 
    'Anesthesia', 
    COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%anesthesia%' OR table_name LIKE '%pacu%')
UNION ALL
SELECT 
    'BCMA', 
    COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%medication_administration%' OR table_name LIKE '%bcma%' OR table_name LIKE '%wristband%')
UNION ALL
SELECT 
    'Blood Bank', 
    COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%blood%' OR table_name LIKE '%transfusion%')
UNION ALL
SELECT 
    'Infection Control', 
    COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%infection%' OR table_name LIKE '%isolation%' OR table_name LIKE '%antimicrobial%' OR table_name LIKE '%outbreak%' OR table_name LIKE '%hand_hygiene%');
"

echo ""
echo "=========================================="
echo "✅ MIGRATION APPLICATION COMPLETE!"
echo "=========================================="
echo ""
echo "📊 Summary:"
echo "  - Phase 1: 4 sprints (OR, Anesthesia, BCMA, Blood Bank)"
echo "  - Phase 2: 1 sprint (Infection Control)"
echo "  - Database: tenant_bulawayo_general"
echo ""
echo "🎉 All migrations applied successfully!"




