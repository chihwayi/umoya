# System Architecture

## Overview
MediCore EHR is a multi-tenant, microservices-based Electronic Health Record system designed for healthcare facilities in Zimbabwe and the SADC region.

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
- **Appointment Service**: Scheduling, calendar, waitlist
- **Medical Records Service**: Clinical documentation, prescriptions
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
