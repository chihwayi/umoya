#!/bin/bash

# MediCore Management Script
# Unified entry point for project scripts

source "$(dirname "$0")/load-env.sh"

show_menu() {
    echo "========================================"
    echo "🏥 MediCore Management Console"
    echo "========================================"
    echo "1. 🔧 Fix & Rebuild EHR Service"
    echo "2. 🔨 Rebuild EHR (Fast)"
    echo "3. 🧪 Test Tier 1 Endpoints (No Auth)"
    echo "4. 🧪 Test Tier 1 APIs (Full)"
    echo "5. 🧪 Test Patient Portal Tier 1"
    echo "6. 🧪 Quick Test (Sprints 22 & 24)"
    echo "7. 🔄 Force SNOMED Import"
    echo "8. 📊 Run SQL Tests (Tier 1)"
    echo "q. Quit"
    echo "========================================"
}

read_choice() {
    local choice
    read -p "Enter choice [1-8, q]: " choice
    echo $choice
}

execute_choice() {
    local choice=$1
    case $choice in
        1)
            echo "Running Fix EHR Service..."
            "$(dirname "$0")/fix-ehr-service.sh"
            ;;
        2)
            echo "Running Rebuild EHR..."
            "$(dirname "$0")/rebuild-ehr.sh"
            ;;
        3)
            echo "Running Tier 1 Endpoints Test..."
            "$(dirname "$0")/test-tier1-endpoints.sh"
            ;;
        4)
            echo "Running Tier 1 API Test..."
            "$(dirname "$0")/test-tier1-apis.sh"
            ;;
        5)
            echo "Running Patient Portal Test..."
            "$(dirname "$0")/test-patient-portal-tier1.sh"
            ;;
        6)
            echo "Running Quick Test (Sprints 22 & 24)..."
            "$(dirname "$0")/quick-test-sprints-22-24.sh"
            ;;
        7)
            echo "Running SNOMED Import..."
            "$(dirname "$0")/force-snomed-import.sh"
            ;;
        8)
            echo "Running SQL Tests..."
            "$(dirname "$0")/test-tier1-endpoints-sql.sh"
            ;;
        q|Q)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo "Invalid choice!"
            ;;
    esac
}

while true; do
    show_menu
    choice=$(read_choice)
    execute_choice $choice
    echo ""
    read -p "Press Enter to continue..."
done
