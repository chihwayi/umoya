#!/bin/bash

# Script to update existing tenant databases with new clinical documentation fields
# This script applies the migration to all existing tenant databases

set -e

# Database connection details
DB_HOST="localhost"
DB_PORT="5432"
DB_USERNAME="medicore"
DB_PASSWORD="medicore_password"
MASTER_DB="medicore_master"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏥 Medicore Tenant Database Migration Script${NC}"
echo -e "${BLUE}==============================================${NC}"

# Function to execute SQL on a database
execute_sql() {
    local database=$1
    local sql_file=$2
    local description=$3
    
    echo -e "${YELLOW}📋 $description${NC}"
    echo -e "   Database: $database"
    
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $database -f $sql_file; then
        echo -e "${GREEN}✅ Successfully applied migration to $database${NC}"
    else
        echo -e "${RED}❌ Failed to apply migration to $database${NC}"
        return 1
    fi
    echo ""
}

# Function to get list of existing tenant databases
get_tenant_databases() {
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $MASTER_DB -t -c "
        SELECT \"databaseName\" 
        FROM tenants 
        WHERE status = 'active' 
        ORDER BY \"createdAt\";
    " | tr -d ' ' | grep -v '^$'
}

# Function to check if database exists
database_exists() {
    local db_name=$1
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $MASTER_DB -t -c "
        SELECT 1 FROM pg_database WHERE datname = '$db_name';
    " | grep -q 1
}

# Main execution
echo -e "${YELLOW}🔍 Checking for existing tenants...${NC}"

# Get list of tenant databases
TENANT_DBS=($(get_tenant_databases))

if [ ${#TENANT_DBS[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No active tenants found. Nothing to migrate.${NC}"
    exit 0
fi

echo -e "${GREEN}📊 Found ${#TENANT_DBS[@]} active tenant(s):${NC}"
for db in "${TENANT_DBS[@]}"; do
    echo -e "   - $db"
done
echo ""

# Check if migration file exists
MIGRATION_FILE="./database/migrations/001-add-clinical-documentation-fields.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}🚀 Starting migration process...${NC}"
echo ""

# Apply migration to each tenant database
SUCCESS_COUNT=0
FAILED_DBS=()

for db in "${TENANT_DBS[@]}"; do
    if database_exists "$db"; then
        if execute_sql "$db" "$MIGRATION_FILE" "Applying clinical documentation migration"; then
            ((SUCCESS_COUNT++))
        else
            FAILED_DBS+=("$db")
        fi
    else
        echo -e "${RED}❌ Database $db does not exist, skipping...${NC}"
        FAILED_DBS+=("$db")
    fi
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
echo -e "   2. Test the clinical documentation features"
echo -e "   3. Verify that new tenants will use the updated template"
echo ""
echo -e "${GREEN}✨ Migration completed successfully!${NC}"
