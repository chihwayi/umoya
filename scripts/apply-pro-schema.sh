#!/bin/bash

# Script to apply Patient-Reported Outcomes (PROs) schema to tenant databases
# Usage: ./scripts/apply-pro-schema.sh [tenant_slug]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATION_FILE="$PROJECT_ROOT/database/migrations/015-add-patient-reported-outcomes.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Patient-Reported Outcomes (PROs) Schema Provisioning ===${NC}"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
  exit 1
fi

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
MASTER_DB="${MASTER_DB:-medicore_master}"

# Function to apply schema to a tenant database
apply_to_tenant() {
  local tenant_slug=$1
  local db_name="medicore_${tenant_slug}"

  echo -e "\n${YELLOW}Applying PRO schema to tenant: ${tenant_slug} (database: ${db_name})${NC}"

  # Check if database exists
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$MASTER_DB" -tAc \
    "SELECT 1 FROM tenants WHERE subdomain = '$tenant_slug'" > /dev/null 2>&1

  if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Tenant '${tenant_slug}' not found in master database${NC}"
    return 1
  fi

  # Check if tenant database exists
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '$db_name'" | grep -q 1

  if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Tenant database '${db_name}' does not exist${NC}"
    return 1
  fi

  # Apply migration
  echo "Applying migration to ${db_name}..."
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" -f "$MIGRATION_FILE"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully applied PRO schema to ${tenant_slug}${NC}"
    
    # Initialize standard questionnaires via API
    echo "Initializing standard questionnaires..."
    API_URL="${API_URL:-http://localhost:3013/api}"
    TENANT_SLUG="$tenant_slug"
    
    # Try to initialize via API (requires EHR service to be running)
    if command -v curl &> /dev/null; then
      INIT_RESPONSE=$(curl -s -X POST "${API_URL}/patient-portal/questionnaires/initialize" \
        -H "Content-Type: application/json" \
        -H "X-Tenant-ID: ${TENANT_SLUG}" \
        -H "Authorization: Bearer ${ADMIN_TOKEN:-}" 2>&1)
      
      if echo "$INIT_RESPONSE" | grep -q "initialized successfully"; then
        echo -e "${GREEN}✓ Standard questionnaires initialized${NC}"
      else
        echo -e "${YELLOW}Note: Standard questionnaires initialization via API failed or skipped${NC}"
        echo -e "${YELLOW}  You can initialize manually by calling:${NC}"
        echo -e "${YELLOW}  POST ${API_URL}/patient-portal/questionnaires/initialize${NC}"
        echo -e "${YELLOW}  Header: X-Tenant-ID: ${TENANT_SLUG}${NC}"
      fi
    else
      echo -e "${YELLOW}Note: curl not found. Standard questionnaires need to be initialized manually via API${NC}"
      echo -e "${YELLOW}  POST ${API_URL}/patient-portal/questionnaires/initialize${NC}"
      echo -e "${YELLOW}  Header: X-Tenant-ID: ${TENANT_SLUG}${NC}"
    fi
    
    return 0
  else
    echo -e "${RED}✗ Failed to apply PRO schema to ${tenant_slug}${NC}"
    return 1
  fi
}

# Function to apply to all tenants
apply_to_all_tenants() {
  echo -e "${YELLOW}Applying PRO schema to ALL tenants...${NC}"

  # Get all active tenants
  TENANTS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$MASTER_DB" -tAc \
    "SELECT subdomain FROM tenants WHERE status = 'active'")

  if [ -z "$TENANTS" ]; then
    echo -e "${YELLOW}No active tenants found${NC}"
    return 0
  fi

  SUCCESS_COUNT=0
  FAIL_COUNT=0

  for tenant in $TENANTS; do
    if apply_to_tenant "$tenant"; then
      ((SUCCESS_COUNT++))
    else
      ((FAIL_COUNT++))
    fi
  done

  echo -e "\n${GREEN}=== Summary ===${NC}"
  echo -e "Success: ${SUCCESS_COUNT}"
  echo -e "Failed: ${FAIL_COUNT}"
}

# Main execution
if [ -z "$1" ]; then
  # No tenant specified, apply to all
  apply_to_all_tenants
else
  # Apply to specific tenant
  apply_to_tenant "$1"
fi

echo -e "\n${GREEN}=== PRO Schema Provisioning Complete ===${NC}"

