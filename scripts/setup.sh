#!/bin/bash

# Umoya Development Environment Setup Script

set -e

echo "🏥 Setting up Umoya Development Environment..."

# Check if required tools are installed
check_requirements() {
    echo "📋 Checking requirements..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed. Please install Docker first."
        exit 1
    fi

    if docker compose version &> /dev/null; then
        COMPOSE_CMD=(docker compose)
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD=(docker-compose)
    else
        echo "❌ Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    echo "✅ All requirements satisfied"
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    
    # Install root dependencies
    npm install
    
    # Install service dependencies
    echo "Installing service dependencies..."
    for service in services/*/; do
        if [ -f "$service/package.json" ]; then
            echo "Installing dependencies for $(basename "$service")"
            cd "$service" && npm install && cd - > /dev/null
        fi
    done
    
    # Install frontend dependencies
    for frontend in web-app ehr-frontend patient-portal; do
        if [ -f "$frontend/package.json" ]; then
            echo "Installing dependencies for $frontend..."
            cd "$frontend" && npm install && cd - > /dev/null
        fi
    done

    
    echo "✅ Dependencies installed"
}

# Setup environment files
setup_environment() {
    echo "🔧 Setting up environment files..."
    
    # Copy environment template if it doesn't exist
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            echo "✅ Created .env file from template"
        else
            echo "⚠️  No .env.example found, creating basic .env file"
            cat > .env << EOF
# Umoya Environment Configuration
NODE_ENV=development
SERVICE_BASE_URL=
SERVICE_TENANT_PATH=/tenant-service
SERVICE_EHR_PATH=/ehr-service
SERVICE_CDSS_PATH=/cdss-service

REACT_APP_API_BASE_URL=
REACT_APP_TENANT_API_PATH=/tenant-service/api
REACT_APP_EHR_API_PATH=/ehr-service/api
REACT_APP_CDSS_API_PATH=/cdss-service

SERVICE_TENANT_URL=http://tenant-service:3001
SERVICE_EHR_URL=http://ehr-service:3013
SERVICE_CDSS_URL=http://cdss-service:8000

REACT_APP_TENANT_API_URL=http://localhost:3001/api
REACT_APP_EHR_API_URL=http://localhost:3013/api
REACT_APP_CDSS_API_URL=http://localhost:8000

PUBLIC_APP_BASE_URL=
PUBLIC_STAFF_APP_PATH=/
PUBLIC_PATIENT_PORTAL_PATH=/patient
PUBLIC_ADMIN_APP_PATH=/admin
FRONTEND_URL=http://localhost:3000
PORTAL_BASE_URL=http://localhost:3015
WEB_APP_URL=http://localhost:3011
REACT_APP_BASE_DOMAIN=umoya.health
REACT_APP_PROTOCOL=http

CDSS_ENABLE_AI=true
MOCK_VISION_AI=true
LLM_API_URL=http://host.docker.internal:11434
POSTVISIT_LLM_API_URL=https://api.openai.com/v1/chat/completions
RXNORM_BASE_URL=https://rxnav.nlm.nih.gov/REST
PAGERDUTY_EVENTS_API_URL=https://events.pagerduty.com/v2/enqueue
POSTVISIT_CLINICALTRIALS_API_URL=https://clinicaltrials.gov/api/v2/studies
POSTVISIT_CLINICALTRIALS_STUDY_BASE_URL=https://clinicaltrials.gov/study
WHISPER_API_URL=https://api.openai.com/v1/audio/transcriptions

DATABASE_URL=postgresql://umoya:umoya_password@localhost:5432/umoya_master
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
API_PORT=3000

# Service Ports
PORT_POSTGRES=5432
PORT_REDIS=6379
PORT_MINIO=9000
PORT_MINIO_CONSOLE=9001
PORT_TENANT_SERVICE=3001
PORT_CDSS_SERVICE=8000
PORT_EHR_SERVICE=3013
PORT_WHISPER=8001
PORT_ELASTICSEARCH=9200
PORT_SNOWSTORM=8080
ELASTICSEARCH_URL=http://localhost:9200
SNOWSTORM_URL=http://localhost:8080
WHISPER_SERVICE_URL=http://localhost:8001

# Regional settings — primary market SADC, secondary broader Africa, tertiary global
# Set DEFAULT_TIMEZONE to the timezone of your deployment region
DEFAULT_CURRENCY=USD
DEFAULT_TIMEZONE=Africa/Johannesburg
DEFAULT_COUNTRY=

# SMS Provider — recommended: africas_talking (pan-Africa), twilio (global)
SMS_PROVIDER=africas_talking
SMS_API_KEY=your-sms-api-key

# Email Configuration
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Medical Aid / Insurance Integration
# Configure for your deployment region's insurance/medical-aid providers
MEDICAL_AID_API_URL=https://your-medical-aid-provider.com/api
# Legacy Zimbabwe-specific (kept for backward compatibility)
CIMAS_API_URL=https://api.cimas.co.zw
PREMIER_API_URL=https://api.premier.co.zw
ECONET_HEALTH_API_URL=https://api.econet-health.co.zw

# AI/CDSS Configuration
CDSS_MODEL_PATH=./services/cdss-service/ml-models
ENABLE_AI_DIAGNOSTICS=true
ENABLE_DRUG_INTERACTIONS=true

# File Storage
STORAGE_PROVIDER=local
STORAGE_PATH=./uploads
# For cloud storage:
# STORAGE_PROVIDER=aws
# AWS_BUCKET=umoya-files
# AWS_REGION=us-east-1
EOF
        fi
    else
        echo "✅ .env file already exists"
    fi
    
    # Setup service-specific environment files
    for service in services/*/; do
        service_name=$(basename "$service")
        env_file="$service/.env"
        
        if [ ! -f "$env_file" ]; then
            echo "Creating environment file for $service_name"
            cat > "$env_file" << EOF
NODE_ENV=development
PORT=3000
REDIS_URL=redis://localhost:6379
SERVICE_NAME=$service_name
EOF
        fi
    done
    
    echo "✅ Environment files configured"
}

# Setup databases
setup_databases() {
    echo "🗄️  Setting up databases..."
    
    # Start PostgreSQL and Redis
    "${COMPOSE_CMD[@]}" up -d postgres-master redis
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Run database migrations
    echo "Running database migrations..."
    ./scripts/migrate.sh
    
    echo "✅ Databases configured"
}

# Build services
build_services() {
    echo "🔨 Building services..."
    
    # Build all services
    for service in services/*/; do
        if [ -f "$service/Dockerfile" ]; then
            service_name=$(basename "$service")
            echo "Building $service_name..."
            "${COMPOSE_CMD[@]}" build "$service_name" || echo "⚠️  Failed to build $service_name"
        fi
    done
    
    echo "✅ Services built"
}

# Setup git hooks
setup_git_hooks() {
    echo "🔗 Setting up git hooks..."
    
    if [ -d ".git" ]; then
        npx husky install
        echo "✅ Git hooks configured"
    else
        echo "⚠️  Not a git repository, skipping git hooks setup"
    fi
}

# Create initial admin user
create_admin_user() {
    echo "👤 Creating initial admin user..."
    
    # This would typically be done through the API once services are running
    echo "ℹ️  Admin user creation will be available after starting the services"
    echo "   Use the web interface at ${WEB_APP_URL} to create your first tenant"
}

# Main setup function
main() {
    echo "🚀 Starting Umoya setup..."
    
    check_requirements
    install_dependencies
    setup_environment
    
    # Load env vars after setup
    if [ -f .env ]; then
        set -a
        source .env
        set +a
    fi

    WEB_APP_URL="${WEB_APP_URL:-}"
    API_BASE_URL="${API_BASE_URL:-${REACT_APP_EHR_API_URL:-}}"
    
    setup_databases
    build_services
    setup_git_hooks
    create_admin_user
    
    echo ""
    echo "🎉 Umoya development environment setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Review and update the .env file with your specific configuration"
    echo "2. Start the development environment: npm run dev"
    echo "3. Run the core smoke check: npm run smoke:core"
    echo "4. Access the web application at: ${WEB_APP_URL:-set WEB_APP_URL or PUBLIC_APP_BASE_URL in .env}"
    echo "5. Access the API documentation at: ${API_BASE_URL:-set REACT_APP_EHR_API_URL or REACT_APP_API_BASE_URL in .env}"
    echo "6. Monitor services with Grafana at: ${GRAFANA_URL:-http://localhost:${PORT_GRAFANA:-3012}} (admin/admin)"
    echo ""
    echo "For more information, see the README.md file"
}

# Run main function
main "$@"
