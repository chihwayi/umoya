#!/bin/bash

# Script to apply diagnosis codes migration (030) to existing tenant databases
# This adds SNOMED CT and ICD-10 diagnosis code fields to the appointments table

set -e

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
MASTER_DB="${MASTER_DB:-medicore_master}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏥 Medicore Diagnosis Codes Migration Script${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Function to execute SQL on a database
execute_sql() {
    local database=$1
    local sql_file=$2
    local description=$3
    
    echo -e "${YELLOW}📋 $description${NC}"
    echo -e "   Database: $database"
    
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $database -f $sql_file; then
        echo -e "${GREEN}✅ Successfully applied migration to $database${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to apply migration to $database${NC}"
        return 1
    fi
}

# Function to execute inline SQL
execute_inline_sql() {
    local database=$1
    local sql=$2
    local description=$3
    
    echo -e "${YELLOW}📋 $description${NC}"
    echo -e "   Database: $database"
    
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $database -c "$sql"; then
        echo -e "${GREEN}✅ Successfully applied to $database${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to apply to $database${NC}"
        return 1
    fi
}

# Function to check if database exists
database_exists() {
    local db_name=$1
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $MASTER_DB -t -c "
        SELECT 1 FROM pg_database WHERE datname = '$db_name';
    " | grep -q 1
}

# Check if migration file exists
MIGRATION_FILE="./database/migrations/030-add-diagnosis-codes-to-appointments.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

# Check if specific tenant was provided
if [ -n "$1" ]; then
    TENANT_DB="$1"
    echo -e "${YELLOW}🔍 Applying migration to specific tenant: $TENANT_DB${NC}"
    
    if database_exists "$TENANT_DB"; then
        if execute_sql "$TENANT_DB" "$MIGRATION_FILE" "Applying diagnosis codes migration"; then
            echo -e "${GREEN}🎉 Migration completed successfully for $TENANT_DB!${NC}"
            exit 0
        else
            echo -e "${RED}❌ Migration failed for $TENANT_DB${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Database $TENANT_DB does not exist${NC}"
        exit 1
    fi
fi

# Get list of tenant databases from master database
echo -e "${YELLOW}🔍 Checking for existing tenants...${NC}"

TENANT_DBS=($(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $MASTER_DB -t -c "
    SELECT \"databaseName\" 
    FROM tenants 
    WHERE status = 'active' 
    ORDER BY \"createdAt\";
" | tr -d ' ' | grep -v '^$'))

if [ ${#TENANT_DBS[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No active tenants found. Nothing to migrate.${NC}"
    exit 0
fi

echo -e "${GREEN}📊 Found ${#TENANT_DBS[@]} active tenant(s):${NC}"
for db in "${TENANT_DBS[@]}"; do
    echo -e "   - $db"
done
echo ""

echo -e "${YELLOW}🚀 Starting migration process...${NC}"
echo ""

# Apply migration to each tenant database
SUCCESS_COUNT=0
FAILED_DBS=()

for db in "${TENANT_DBS[@]}"; do
    if database_exists "$db"; then
        if execute_sql "$db" "$MIGRATION_FILE" "Applying diagnosis codes migration"; then
            ((SUCCESS_COUNT++))
        else
            FAILED_DBS+=("$db")
        fi
    else
        echo -e "${RED}❌ Database $db does not exist, skipping...${NC}"
        FAILED_DBS+=("$db")
    fi
    echo ""
done

echo -e "${BLUE}📊 Migration Summary${NC}"
echo -e "${BLUE}==================${NC}"
echo -e "${GREEN}✅ Successfully migrated: $SUCCESS_COUNT tenant(s)${NC}"

if [ ${#FAILED_DBS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Failed to migrate: ${#FAILED_DBS[@]} tenant(s)${NC}"
    echo -e "${RED}   Failed databases: ${FAILED_DBS[*]}${NC}"
    exit 1
else
    echo -e "${GREEN}🎉 All tenant databases successfully migrated!${NC}"
fi

echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo -e "   1. Restart your EHR service to pick up the new schema"
echo -e "   2. Test the diagnosis code features in clinical notes"
echo -e "   3. Verify that new tenants will use the updated template"
echo ""
echo -e "${GREEN}✨ Migration completed successfully!${NC}"
