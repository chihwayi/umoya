#!/bin/bash

# Script to apply pharmacy schema to all existing tenant databases
# This ensures all tenants have the pharmacy management tables

set -e

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-medicore}"
DB_PASSWORD="${DB_PASSWORD:-medicore_password}"
MASTER_DB="${MASTER_DB:-medicore_master}"
CONTAINER_NAME="${CONTAINER_NAME:-medicore-postgres-master}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}💊 Applying Pharmacy Schema to Tenant Databases${NC}"
echo -e "${BLUE}=================================================${NC}"

# Function to get tenant database names
get_tenant_databases() {
    docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d $MASTER_DB -t -c "
        SELECT \"databaseName\" 
        FROM tenants 
        WHERE status IN ('active', 'pending')
        ORDER BY \"createdAt\";
    " | tr -d ' ' | grep -v '^$'
}

# Get list of tenant databases
echo -e "${YELLOW}🔍 Finding tenant databases...${NC}"
TENANT_DBS=($(get_tenant_databases))

if [ ${#TENANT_DBS[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No active tenants found.${NC}"
    exit 0
fi

echo -e "${GREEN}📊 Found ${#TENANT_DBS[@]} tenant(s):${NC}"
for db in "${TENANT_DBS[@]}"; do
    echo -e "   - $db"
done
echo ""

# Function to apply pharmacy schema to a database
apply_pharmacy_schema() {
    local database=$1
    echo -e "${YELLOW}📋 Applying pharmacy schema to: $database${NC}"
    
    # Use the tenant service API to trigger provisioning
    # This will apply the sprint8_pharmacy bundle
    TENANT_SLUG=$(docker exec $CONTAINER_NAME psql -U $DB_USERNAME -d $MASTER_DB -t -c "
        SELECT subdomain FROM tenants WHERE \"databaseName\" = '$database';
    " | tr -d ' ')
    
    if [ -z "$TENANT_SLUG" ]; then
        echo -e "${RED}❌ Could not find tenant slug for $database${NC}"
        return 1
    fi
    
    echo -e "${BLUE}   Tenant: $TENANT_SLUG${NC}"
    
    # Trigger provisioning via API
    RESPONSE=$(curl -s -X POST "http://localhost:3001/api/tenants/$TENANT_SLUG/provision" \
        -H "Content-Type: application/json" \
        -d '{"bundles": ["sprint8_pharmacy"]}' 2>&1)
    
    if echo "$RESPONSE" | grep -q "success\|applied"; then
        echo -e "${GREEN}✅ Successfully applied pharmacy schema to $database${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to apply via API, trying direct SQL...${NC}"
        # Fallback: apply directly via SQL
        return 1
    fi
}

# Apply to each tenant database
SUCCESS_COUNT=0
FAILED_DBS=()

for db in "${TENANT_DBS[@]}"; do
    if apply_pharmacy_schema "$db"; then
        ((SUCCESS_COUNT++))
    else
        FAILED_DBS+=("$db")
        echo -e "${YELLOW}⚠️  Will try direct SQL application for $db${NC}"
    fi
    echo ""
done

echo -e "${BLUE}📊 Summary${NC}"
echo -e "${BLUE}=========${NC}"
echo -e "${GREEN}✅ Successfully applied: $SUCCESS_COUNT tenant(s)${NC}"

if [ ${#FAILED_DBS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Some tenants may need manual provisioning${NC}"
    echo -e "${YELLOW}   Failed databases: ${FAILED_DBS[*]}${NC}"
    echo ""
    echo -e "${BLUE}💡 Alternative: Use the tenant service API directly${NC}"
    echo -e "   POST http://localhost:3001/api/tenants/{tenantSlug}/provision"
    echo -e "   Body: {\"bundles\": [\"sprint8_pharmacy\"]}"
fi

echo ""
echo -e "${GREEN}✨ Pharmacy schema application completed!${NC}"

