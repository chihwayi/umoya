#!/bin/bash

# MediCore Development Environment Setup Script

set -e

echo "🏥 Setting up MediCore Development Environment..."

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
    
    if ! command -v docker-compose &> /dev/null; then
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
    
    # Install web app dependencies
    if [ -f "web-app/package.json" ]; then
        echo "Installing web app dependencies..."
        cd web-app && npm install && cd - > /dev/null
    fi
    
    
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
# MediCore Environment Configuration
NODE_ENV=development
DATABASE_URL=postgresql://medicore:medicore_password@localhost:5432/medicore_master
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
API_PORT=3000

# Zimbabwe-specific settings
DEFAULT_CURRENCY=USD
DEFAULT_TIMEZONE=Africa/Harare
DEFAULT_COUNTRY=Zimbabwe

# SMS Provider (econet, telecel, netone)
SMS_PROVIDER=econet
SMS_API_KEY=your-sms-api-key

# Email Configuration
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Medical Aid Integration
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
# AWS_BUCKET=medicore-files
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
    docker-compose up -d postgres-master redis
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Run database migrations
    echo "Running database migrations..."
    npm run migrate
    
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
            docker-compose build "$service_name" || echo "⚠️  Failed to build $service_name"
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
    echo "   Use the web interface at http://localhost:3011 to create your first tenant"
}

# Main setup function
main() {
    echo "🚀 Starting MediCore setup..."
    
    check_requirements
    install_dependencies
    setup_environment
    setup_databases
    build_services
    setup_git_hooks
    create_admin_user
    
    echo ""
    echo "🎉 MediCore development environment setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Review and update the .env file with your specific configuration"
    echo "2. Start the development environment: npm run dev"
    echo "3. Access the web application at: http://localhost:3011"
    echo "4. Access the API documentation at: http://localhost:3000/docs"
    echo "5. Monitor services with Grafana at: http://localhost:3012 (admin/admin)"
    echo ""
    echo "For more information, see the README.md file"
}

# Run main function
main "$@"