# MediCore - Multi-Tenant eHR System

🏥 **Complete Electronic Health Record System for Private Clinics in Zimbabwe**

## Overview

MediCore is a comprehensive, multi-tenant Electronic Health Record (eHR) system designed specifically for private surgeries and clinics in Zimbabwe. Built to compete with existing solutions like Health263, MediCore offers advanced features at competitive pricing with AI-powered clinical decision support.

## 🚀 Key Features

### ✅ **Complete Tenant Management System**
- **Multi-tenant Architecture** - Complete data isolation per clinic
- **Automated Database Provisioning** - Each tenant gets dedicated database
- **Role-Based Access Control** - 5 healthcare roles (Admin, Doctor, Nurse, Receptionist, Pharmacist)
- **Manual Tenant Activation** - Control over clinic activation/suspension
- **Comprehensive Analytics** - System-wide reporting and insights

### ✅ **User Management System** (NEW)
- **Complete CRUD Operations** - Create, read, update, delete clinic staff
- **Secure Password Management** - Auto-generated temporary passwords with copy functionality
- **Role-Based Permissions** - Admin-only access to user management
- **Account Status Control** - Activate/deactivate users as needed
- **Profile Management** - User settings and password change functionality

### ⚙️ **Tenant Configuration System** (NEW)
- **Gateway Isolation** - Unique SMS & Payment gateway credentials per tenant
- **Dynamic Configuration** - Store and manage API keys securely in tenant databases
- **Fallback Support** - System-level defaults with tenant-level overrides

### 🏥 **Core eHR Functionality** 
- **User Management** ✅ - Complete staff management system
- **Patient Management** 🚧 - Patient registration and demographics (Next)
- **Medical Records** 🚧 - Clinical documentation and history
- **Appointment Scheduling** 🚧 - Booking and calendar management
- **Prescription Management** 🚧 - Medication orders and tracking
- **Laboratory & Imaging** 🚧 - Test orders and results
- **Billing & Invoicing** 🚧 - Financial management

### ✅ **Medical Aid Claims Processing**
- **Automated Claims** - Generation and submission via EDI/API
- **Status Tracking** - Real-time claim status updates
- **Pre-authorization** - Instant checks for procedures
- **Provider Integration** - CIMAS, Premier, Econet Health, PSMAS
- **Pricing** - Competitive model vs Health263

### ✅ **Clinical Decision Support System (CDSS)**
- **AI Diagnostics** - MedBERT & ClinicalBERT fusion for intelligent suggestions
- **Medical Vision** - AI analysis for X-Rays and DICOM imagery
- **Drug Safety** - Advanced interaction checking (Drug-Drug, Drug-Food)
- **Guidelines** - Automated clinical protocols and compliance
- **Dosing** - Renal and weight-based dosing calculators

### 🔗 **Interoperability**
- **HL7 v2.x** - ADT, ORM, and ORU message processing
- **FHIR R4** - Complete resource mapping & capability statement
- **WHO Smart Guidelines** - Native FHIR-based guideline execution
- **DHIS2 Integration** - Automated reporting and patient sync
- **External APIs** - Webhooks for real-time status updates

### 🇿🇼 **Zimbabwe-Specific Features**
- **SMS Notifications** ✅ - Multi-network support (Econet, Telecel, NetOne) with tenant-specific sender IDs
- **Mobile Money Integration** ✅ - EcoCash & OneMoney payment processing with tenant-specific merchant accounts
- **Local Medical Aid Integration** ✅ - Direct integration with CIMAS, Premier, Econet Health
- **ZMDC Compliance** (Planned) - Regulatory reporting standards
- **Local Currency Support** 🚧 - ZWL/USD multi-currency handling

## 🏗️ Architecture

- **Multi-tenant SaaS** - Complete data isolation per clinic
- **Microservices** - Scalable and maintainable
- **Cloud-native** - Docker containerized
- **Mobile-first** - Responsive design

## 🛠️ Technology Stack

- **Backend**: Node.js, NestJS, TypeScript, PostgreSQL
- **Frontend**: React, TypeScript, Tailwind CSS
- **AI/ML**: Python, FastAPI, PyTorch, HuggingFace Transformers
- **Integration**: HAPI FHIR, Mirth Connect (Planned)
- **Infrastructure**: Docker, Docker Compose, Redis

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for development)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/chihwayi/medicore.git
   cd medicore
   ```

2. **Start the development environment**
   ```bash
   ./scripts/setup.sh
   ```

3. **Launch all services**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - **Super Admin Portal**: http://localhost:3011 (admin@medicore.co.zw / medicore123)
   - **EHR System**: http://localhost:3014/ehr/bulawayo-general (admin@bulawayo-general.co.zw / ildc3m37)
   - **Features**: Complete tenant management, user management, modern medical UI

## 📊 Current Status

### ✅ **PRODUCTION-READY MULTI-TENANT EHR PLATFORM**
- **🏥 Multi-tenant Architecture** - Complete database isolation per clinic
- **🔐 Enterprise Security** - JWT auth, tenant isolation, audit logging
- **👥 Complete User Management** - Staff CRUD, password management, role-based access
- **🎨 Modern Medical UI** - Glassmorphism design with healthcare theme
- **📱 Mobile Responsive** - Works perfectly on all devices
- **🔔 Smart Notifications** - No browser popups, beautiful toast messages
- **💚 Health Monitoring** - Real-time database health checks & alerts
- **📋 Audit Logging** - Complete activity tracking & compliance
- **📧 Email Notifications** - Welcome emails, alerts, password resets
- **📊 Analytics Dashboard** - System-wide reporting & metrics
- **💳 Payment Gateway Integration** - Tenant-specific EcoCash & OneMoney configuration
- **📱 SMS Gateway Integration** - Isolated SMS credentials for Econet/Telecel/NetOne
- **🌐 Professional Web Portal** - React TypeScript interface
- **🔧 RESTful APIs** - 69+ EHR APIs ready for development
- **🤖 CDSS** - AI-powered diagnostics & interaction checking
- **💰 Medical Aid Claims** - Automated submission & status tracking

### 🚧 **Next Phase: Core EHR Modules**
- **Patient Management** - Registration, demographics, medical history
- **Appointment Scheduling** - Calendar, booking, reminders
- **Medical Records** - Clinical notes, diagnoses, treatment plans
- **Prescription Management** - Medication orders, drug interactions
- **Laboratory Integration** - Test orders, results management
- **Billing & Invoicing** - Financial management, invoicing

## 🎯 Competitive Advantages

### vs Health263 Zimbabwe
- **40% Lower Pricing** - Transparent, all-inclusive packages
- **Modern Technology** - Cloud-native React/Node.js vs legacy systems
- **Superior User Experience** - Modern glassmorphism UI, mobile-responsive
- **Enterprise Security** - Multi-tenant isolation, JWT auth, audit logs
- **Complete Staff Management** - Built-in user management with role-based access
- **Smart Notifications** - No browser popups, beautiful toast messages
- **AI-Powered CDSS** - First in Zimbabwe market
- **Production-Ready** - Enterprise-grade multi-tenant architecture
- **Developer-Friendly** - 69+ APIs, comprehensive documentation

## 📈 Business Model

### Subscription Tiers
- **Basic** ($99/month) - Core eHR features
- **Professional** ($199/month) - + Medical aid claims + Basic CDSS
- **Enterprise** ($299/month) - + Advanced CDSS + Full integration suite

## 🏥 Target Market

- Private clinics and surgeries in Zimbabwe
- Medical practitioners seeking modern eHR solutions
- Healthcare facilities wanting to reduce costs
- Clinics requiring medical aid integration

## 🔧 Development Setup

### Local Development
```bash
# Install dependencies
npm install

# Start individual services
cd services/tenant-service
npm run dev

# Start web application
cd web-app
npm start
```

### Docker Development
```bash
# Start essential services only
docker-compose up -d postgres-master redis tenant-service web-app

# View logs
docker-compose logs -f tenant-service

# Stop services
docker-compose down
```

## 📚 API Documentation

### EHR Authentication (Port 3013)
- `POST /api/auth/login` - EHR user login with tenant isolation
- `GET /api/auth/profile` - Get current EHR user profile
- `PUT /api/auth/change-password` - Change EHR user password

### User Management (EHR)
- `GET /api/users` - List all clinic staff (with role filtering)
- `GET /api/users/:id` - Get specific user details
- `POST /api/users` - Create new clinic staff member
- `PUT /api/users/:id` - Update user information
- `DELETE /api/users/:id` - Deactivate user
- `PUT /api/users/:id/reset-password` - Reset user password
- `PUT /api/users/:id/activate` - Activate deactivated user

### Tenant Management (Port 3001)
- `GET /api/tenants` - List all tenants
- `POST /api/tenants` - Create new tenant
- `PUT /api/tenants/:id/status` - Update tenant status
- `GET /api/tenants/:id/users` - Get tenant users
- `POST /api/tenants/:id/users` - Create tenant user

### Health Monitoring
- `GET /api/health/system` - System health overview
- `GET /api/health/tenants` - All tenant health status

### Finance & Payment APIs
- `POST /api/finance/transactions` - Create finance transaction
- `POST /api/finance/transactions/:id/payments` - Record payment
- `GET /api/finance/transactions` - List transactions with filters
- `GET /api/finance/dashboard/summary` - Finance dashboard summary
- `GET /api/finance/transactions/:id` - Get transaction details

### HIV Module APIs
- `POST /api/hiv/nurse-intakes` - Create/update HIV nurse intake
- `GET /api/hiv/nurse-intakes/patient/:patientId` - Get intakes by patient
- `GET /api/hiv/nurse-intakes/appointment/:appointmentId` - Get intake by appointment
- `GET /api/hiv/enrollments` - List HIV enrollments
- Additional HIV management endpoints available

### 70+ Additional EHR APIs Ready
- Patient Management, Appointments, Medical Records
- Prescriptions, Lab Orders, Billing, Claims
- Finance Gating (Appointments, Lab, Imaging, Cardiology)
- FHIR, HL7, CDSS, DHIS2, Reports, Notifications
- SMS, Mobile Money, and more...

## 🗄️ Database Structure

### Master Database
- `tenants` - Tenant registry
- `tenant_users` - User management
- `tenant_analytics` - System metrics

### Tenant Databases (Per Clinic)
- `users` - Clinic staff
- `patients` - Patient records
- `appointments` - Scheduling
- `medical_records` - Clinical data
- `billing` - Financial records

## 🔐 Security Features

- **Multi-Tenant Isolation** - Complete database separation per clinic
- **JWT Authentication** - Secure token-based authentication with tenant validation
- **Role-Based Access Control** - 5 healthcare roles with granular permissions
- **Secure Password Management** - Auto-generated temporary passwords, mandatory changes
- **Account Security** - Password complexity enforcement, account lockout protection
- **Tenant URL Enforcement** - Strict tenant slug validation in all routes
- **Data Isolation** - No cross-tenant data access possible
- **Audit Logging** - Complete activity tracking with IP addresses
- **Health Monitoring** - Real-time database connectivity checks
- **Session Management** - Secure token expiration and refresh
- **Encryption** - Data encrypted at rest and in transit
- **Compliance** - POPIA and healthcare standards ready

## 🚀 Deployment

### Production Deployment
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

### Cloud Deployment
- AWS ECS/EKS ready
- Azure Container Instances ready
- Kubernetes manifests included

## 📞 Support

- **Email**: support@medicore.co.zw
- **Documentation**: [docs.medicore.co.zw](https://docs.medicore.co.zw)
- **Issues**: [GitHub Issues](https://github.com/chihwayi/medicore/issues)

## 📄 License

Proprietary - MediCore Solutions

## 🤝 Contributing

This is a proprietary project. For collaboration opportunities, please contact the development team.

## 🎯 Roadmap

### Phase 1 (Completed) ✅
- **Multi-tenant architecture** - Complete database isolation per clinic
- **Enterprise tenant management** - Full CRUD with health monitoring
- **Complete user management** - Staff CRUD, password management, role-based access
- **Modern medical UI** - Glassmorphism design with healthcare theme
- **Security system** - JWT auth, tenant isolation, audit logs
- **Smart notifications** - Toast messages, no browser popups
- **Mobile responsive** - Works on all devices
- **Health monitoring** - Real-time database connectivity checks
- **Email notifications** - Welcome emails, alerts, password resets
- **Analytics dashboard** - System-wide reporting and metrics

### Phase 2 (Q1 2025) 🚧
- Patient management system
- Appointment scheduling
- Medical records management

### Phase 3 (Q2 2025) 📋
- Billing and invoicing
- Medical aid claims processing
- Basic CDSS integration

### Phase 4 (Q3 2025) 🤖
- Advanced AI/CDSS features
- FHIR/HL7 integration
- Mobile applications

### Phase 5 (Q4 2025) 🌍
- Market launch in Zimbabwe
- Regional expansion
- Advanced analytics

---

**Built with ❤️ for Zimbabwe's healthcare sector**

*Revolutionizing healthcare management, one clinic at a time.*