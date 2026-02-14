# System Architecture

## Overview
MediCore EHR is a multi-tenant, microservices-based Electronic Health Record system designed for healthcare facilities in Zimbabwe and the SADC region.

Related docs:
- [Request/Data Flows](./request-data-flows.md)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Load Balancer                                 │
│                         (NGINX/AWS ALB/Cloudflare)                         │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┴───────────────────────────────────────────┐
│                            API Gateway                                     │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌──────────┐  │
│  │ Rate Limiting   │ │ Authentication  │ │ Tenant Routing  │ │ Logging  │  │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ └──────────┘  │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────▼────────┐    ┌──────────▼──────────┐    ┌─────────▼────────┐
│  Core Services │    │  Medical Services   │    │ Integration Svcs │
│                │    │                     │    │                  │
│ • Tenant       │    │ • Patient           │    │ • FHIR           │
│ • Auth         │    │ • Appointment       │    │ • HL7            │
│ • Notification │    │ • Medical Records   │    │ • Claims         │
│                │    │ • Billing           │    │ • CDSS           │
└────────────────┘    └─────────────────────┘    └──────────────────┘
        │                         │                         │
        └─────────────────────────┼─────────────────────────┘
                                  │
┌─────────────────────────────────┴───────────────────────────────────────────┐
│                           Data Layer                                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌──────────┐  │
│  │ Master DB       │ │ Tenant DBs      │ │ Redis Cache     │ │ File     │  │
│  │ (PostgreSQL)    │ │ (PostgreSQL)    │ │                 │ │ Storage  │  │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Microservices

### Core Services
- **Tenant Service**: Multi-tenant management, database provisioning
- **Auth Service**: Authentication, authorization, JWT management
- **Notification Service**: SMS, email, push notifications

### Medical Services
- **Patient Service**: Patient management, demographics, history
- **Appointment Service**: Scheduling, calendar, waitlist (Pay-Per-Visit model)
- **Medical Records Service**: Clinical documentation, prescriptions
- **Document Management Service** (Sprint 19): Document upload, versioning, sharing, access control
- **Provider Messaging Service** (Sprint 20): Secure messaging, inbox, threads, task assignment
- **E-Consent Management** (Sprint 21): Digital consent forms, e-signatures, version control, audit trails
- **Immunization Registry** (Sprint 22): Vaccine tracking, CDC schedules, inventory, public health reporting
- **Bed Management & ADT** (Sprint 23): Real-time bed tracking, admissions, discharges, transfers
- **Emergency Department Module** (Sprint 24): ESI triage, ED tracking board, wait time management
- **Clinical Pathways & Protocols** (Sprint 25): Evidence-based care pathways, adherence tracking
- **Billing Service**: Invoicing, payments, financial reports
- **Lab Service**: Lab orders, results, test catalog
- **Imaging Service**: Imaging orders, DICOM storage

### Integration Services
- **FHIR Service**: FHIR R4 compliance, interoperability
- **HL7 Service**: HL7 v2.x message processing
- **Claims Service**: Medical aid claims processing
- **CDSS Service**: Clinical decision support, AI

## Data Architecture

### Master Database
- Tenant metadata and configuration
- System settings and feature flags
- Integration configurations

### Tenant Databases
- Complete data isolation per clinic
- Identical schema across tenants
- Automatic provisioning

### Caching Layer
- Redis for session storage
- Frequently accessed data
- Rate limiting
- Real-time notifications

## Security Architecture

### Authentication
- JWT-based authentication
- Role-based access control (RBAC)
- Multi-factor authentication (optional)

### Data Protection
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Data masking for PII
- Complete audit logging

### Compliance
- HIPAA compliance
- POPIA compliance (if applicable)
- Medical data protection
- Data residency options

## Deployment Architecture

### Container Orchestration
- Docker Compose for development
- Kubernetes for production (optional)
- Service mesh for inter-service communication

### Scalability
- Horizontal scaling of services
- Database read replicas
- Load balancing
- Auto-scaling based on metrics

## Technology Stack

### Backend
- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL 14+
- **Cache**: Redis
- **Queue**: Bull Queue
- **File Storage**: MinIO/S3

### Frontend
- **Framework**: React + TypeScript
- **State Management**: Redux/Context API
- **UI Library**: Custom components
- **Charts**: Recharts

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Docker Compose / Kubernetes
- **Monitoring**: Prometheus + Grafana
- **Logging**: Structured logging

## Integration Points

### External Systems
- Medical aid providers (CIMAS, Premier, Econet Health)
- Laboratory systems (Lancet, PathCare)
- Payment gateways (EcoCash, OneMoney)
- SMS providers
- Email services

### Standards
- FHIR R4 for interoperability
- HL7 v2.x for legacy systems
- SNOMED CT for terminology
- ICD-10 for diagnosis coding

## Recent Enhancements (Sprints 19-20)

### Sprint 19: Document Management System
**Implementation Date**: December 2025

**Features**:
- Document upload with drag-and-drop interface
- Version control and history tracking
- Document sharing with granular permissions
- Tag-based organization
- Full-text search capabilities
- Audit logging for compliance
- Support for multiple file types (PDF, DOC, images, DICOM)

**Architecture Components**:
- **DocumentService**: Core document management logic
- **FileStorageService**: S3/MinIO integration for secure storage
- **Document Database Tables**:
  - `documents`: Main document metadata
  - `document_versions`: Version history tracking
  - `document_sharing`: Sharing permissions
  - `document_tags`: Tag-based organization
  - `document_access_log`: Complete audit trail

**Security Features**:
- Role-based access control
- File type validation
- Size limits and virus scanning
- Encryption at rest
- Signed URLs for downloads
- Complete audit trail

### Sprint 20: Provider Messaging/Inbox System
**Implementation Date**: December 2025

**Features**:
- Secure provider-to-provider messaging
- Message threading for conversations
- Priority levels (urgent, high, normal, low)
- Multiple message types (message, task, alert, consultation, referral)
- Read receipts and delivery tracking
- Unread count with auto-refresh
- Message templates with variable substitution
- Task assignment from messages
- Patient/appointment context linking
- Search and filtering capabilities

**Architecture Components**:
- **ProviderMessagingService**: Core messaging logic
- **MessageTemplateService**: Template management
- **Message Database Tables**:
  - `provider_messages`: Main message storage
  - `message_threads`: Thread management
  - `message_read_receipts`: Read tracking
  - `message_attachments`: File attachments
  - `message_tasks`: Task assignment
  - `message_templates`: Reusable templates

**Communication Features**:
- Send to individual users
- Send to roles (all nurses, all doctors)
- Send to teams/departments
- Reply and forward capabilities
- Archive and delete functionality
- Search across subject and content

**Integration Points**:
- Links to patient records
- Links to appointments
- Links to lab orders and results
- Task management system
- Notification system for urgent messages

### Performance Optimizations
- Indexed database queries for fast retrieval
- Caching for frequently accessed data
- Pagination for large result sets
- Background processing for file operations
- Optimistic UI updates for better UX

### Scalability Considerations
- Tenant-isolated data storage
- Efficient file storage with S3-compatible systems
- Database indexing for query performance
- Asynchronous processing for heavy operations
- Connection pooling for database efficiency

### Standards
- FHIR R4 for interoperability
- HL7 v2.x for legacy systems
- SNOMED CT for terminology
- ICD-10 for diagnosis coding
