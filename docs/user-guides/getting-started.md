# Getting Started with MediCore EHR

## Overview
MediCore is a comprehensive Electronic Health Record (EHR) system designed for multi-tenant healthcare facilities. This guide will help you get started with the system.

## System Requirements
- Docker and Docker Compose
- PostgreSQL 14+
- Node.js 18+ (for development)
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Quick Start

### 1. Initial Setup
```bash
# Clone the repository
git clone <repository-url>
cd medicore

# Start all services
docker compose up -d

# Wait for services to initialize (2-3 minutes)
docker compose logs -f
```

### 2. Access the System
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api/docs

### 3. Default Credentials
- **Admin**: admin@medicore.com / admin123
- **Doctor**: doctor@medicore.com / doctor123
- **Nurse**: nurse@medicore.com / nurse123

## Key Features
- Multi-tenant architecture (each clinic has isolated data)
- Patient management and medical records
- Appointment scheduling
- Prescription management
- Lab orders and results
- Billing and invoicing
- Medical aid claims processing
- Patient portal
- Telehealth integration

## Next Steps
1. Complete tenant registration
2. Set up your clinic profile
3. Add staff members
4. Register patients
5. Configure billing settings

## Support
For assistance, contact support@medicore.com or refer to the documentation in the `docs/user-guides/` directory.

