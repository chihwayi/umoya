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
- **Document management** (Sprint 19) - Upload, organize, and share clinical documents
- **Provider messaging** (Sprint 20) - Secure provider-to-provider communication

## Next Steps
1. Complete tenant registration
2. Set up your clinic profile
3. Add staff members
4. Register patients
5. Configure billing settings
6. Upload patient documents to the document management system
7. Start using provider messaging for care coordination

## New Features (December 2025)

### Document Management (Sprint 19)
Comprehensive document management system for clinical documents:
- Upload and organize patient documents
- Support for multiple file types (PDF, DOC, images, DICOM)
- Version control and history tracking
- Secure document sharing with permissions
- Tag-based organization
- Full audit trail for compliance

**Getting Started with Documents**:
1. Log in as a provider
2. Select a patient from your dashboard
3. Click "Documents" in the sidebar
4. Upload documents using drag-and-drop
5. Add metadata (type, description, tags)
6. Share with other providers as needed

### Provider Messaging (Sprint 20)
Secure messaging system for provider communication:
- HIPAA-compliant messaging
- Message inbox with unread count
- Priority levels and message types
- Message threading for conversations
- Message templates for common scenarios
- Task assignment from messages
- Patient/appointment context linking

**Getting Started with Messaging**:
1. Log in as any provider
2. Click "Messages" in the sidebar
3. View your inbox and unread count
4. Click "Compose" to send a message
5. Select recipient (user, role, or team)
6. Use templates for common scenarios
7. Link messages to patients when relevant

## Support
For assistance, contact support@medicore.com or refer to the documentation in the `docs/user-guides/` directory.

