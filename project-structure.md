# MediCore Project Structure

```
medicore/
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json
├── docs/
│   ├── architecture/
│   │   ├── system-architecture.md
│   │   ├── database-design.md
│   │   ├── multi-tenancy.md
│   │   └── security.md
│   ├── api/
│   │   ├── fhir-endpoints.md
│   │   ├── hl7-integration.md
│   │   └── medical-aids-api.md
│   ├── deployment/
│   │   ├── aws-setup.md
│   │   ├── docker-guide.md
│   │   └── monitoring.md
│   └── user-guides/
│       ├── clinic-setup.md
│       ├── patient-management.md
│       └── claims-processing.md
├── services/
│   ├── api-gateway/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── README.md
│   ├── tenant-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── entities/
│   │   │   ├── dto/
│   │   │   └── migrations/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── README.md
│   ├── patient-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── appointment-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── medical-records-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── billing-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── claims-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── cdss-service/
│   │   ├── src/
│   │   ├── ml-models/
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── README.md
│   ├── fhir-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── hl7-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── notification-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   └── auth-service/
│       ├── src/
│       ├── Dockerfile
│       └── package.json
├── web-app/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── patient/
│   │   │   ├── appointments/
│   │   │   ├── medical-records/
│   │   │   ├── billing/
│   │   │   ├── claims/
│   │   │   └── cdss/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── utils/
│   │   └── types/
│   ├── public/
│   ├── package.json
│   ├── tailwind.config.js
│   └── README.md
├── mobile-app/
│   ├── src/
│   ├── android/
│   ├── ios/
│   ├── package.json
│   └── README.md
├── infrastructure/
│   ├── kubernetes/
│   │   ├── namespaces/
│   │   ├── deployments/
│   │   ├── services/
│   │   └── ingress/
│   ├── terraform/
│   │   ├── aws/
│   │   ├── azure/
│   │   └── modules/
│   └── monitoring/
│       ├── prometheus/
│       ├── grafana/
│       └── elk/
├── database/
│   ├── migrations/
│   ├── seeds/
│   ├── schemas/
│   │   ├── tenant.sql
│   │   ├── patient.sql
│   │   ├── medical-records.sql
│   │   ├── billing.sql
│   │   └── fhir-resources.sql
│   └── README.md
├── scripts/
│   ├── setup.sh
│   ├── deploy.sh
│   ├── backup.sh
│   └── migrate.sh
└── tests/
    ├── unit/
    ├── integration/
    ├── e2e/
    └── performance/
```

## Service Descriptions

### Core Services
- **api-gateway**: Central entry point, routing, rate limiting, authentication
- **tenant-service**: Multi-tenancy management, clinic onboarding, subscription management
- **auth-service**: Authentication, authorization, role-based access control
- **patient-service**: Patient demographics, registration, medical history
- **appointment-service**: Scheduling, calendar management, reminders
- **medical-records-service**: Clinical notes, diagnoses, treatments, prescriptions
- **billing-service**: Invoicing, payments, financial reporting

### Specialized Services
- **claims-service**: Medical aid claims processing, submission, tracking
- **cdss-service**: AI-powered clinical decision support, drug interactions, guidelines
- **fhir-service**: FHIR R4 resource management, interoperability
- **hl7-service**: HL7 v2.x message processing, legacy system integration
- **notification-service**: SMS, email, push notifications, alerts

### Applications
- **web-app**: Main clinic management interface (React)
- **mobile-app**: Mobile companion app for doctors and patients (React Native)

### Infrastructure
- **kubernetes**: Container orchestration configurations
- **terraform**: Infrastructure as Code for cloud deployment
- **monitoring**: Observability stack (Prometheus, Grafana, ELK)