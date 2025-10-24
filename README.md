# MediCore - Multi-Tenant eHR System

🏥 **Complete Electronic Health Record System for Private Clinics in Zimbabwe**

## Overview

MediCore is a comprehensive, multi-tenant Electronic Health Record (eHR) system designed specifically for private surgeries and clinics in Zimbabwe. Built to compete with existing solutions like Health263, MediCore offers advanced features at competitive pricing with AI-powered clinical decision support.

## 🚀 Key Features

### ✅ **Complete Tenant Management System**
- **Multi-tenant Architecture** - Complete data isolation per clinic
- **Automated Database Provisioning** - Each tenant gets dedicated database
- **Role-Based Access Control** - 7 different EHR roles
- **Manual Tenant Activation** - Control over clinic activation/suspension
- **Comprehensive Analytics** - System-wide reporting and insights

### 🏥 **Core eHR Functionality** (Planned)
- Patient Management & Demographics
- Medical Records & Documentation
- Appointment Scheduling
- Prescription Management
- Laboratory & Imaging Integration
- Billing & Invoicing

### 💰 **Medical Aid Claims Processing** (Planned)
- Automated claim generation and submission
- Real-time claim status tracking
- Integration with major Zimbabwean medical aids (CIMAS, Premier, Econet Health)
- Competitive pricing model vs Health263

### 🤖 **Clinical Decision Support System (CDSS)** (Planned)
- AI-powered diagnostic assistance
- Drug interaction checking
- Clinical guidelines and protocols
- Statistical analysis and reporting
- Predictive analytics for patient outcomes

### 🔗 **Interoperability** (Planned)
- HL7 v2.x message processing
- FHIR R4 compliance
- RESTful APIs for third-party integration
- Real-time data synchronization

### 🇿🇼 **Zimbabwe-Specific Features** (Planned)
- Local medical aid integration
- ZMDC compliance
- Local currency support (ZWL/USD)
- SMS notifications (Econet, Telecel, NetOne)
- Mobile money integration (EcoCash, OneMoney)

## 🏗️ Architecture

- **Multi-tenant SaaS** - Complete data isolation per clinic
- **Microservices** - Scalable and maintainable
- **Cloud-native** - Docker containerized
- **Mobile-first** - Responsive design

## 🛠️ Technology Stack

- **Backend**: Node.js, NestJS, TypeScript, PostgreSQL
- **Frontend**: React, TypeScript, Tailwind CSS
- **AI/ML**: Python, FastAPI, TensorFlow (Planned)
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
   - **Web Portal**: http://localhost:3011
   - **Login**: admin@medicore.co.zw / medicore123

## 📊 Current Status

### ✅ **Completed Features**
- **Tenant Management System** - Fully functional
- **Multi-tenant Database Architecture** - Complete isolation
- **User Management** - Role-based access control
- **Analytics Dashboard** - System-wide reporting
- **Web Portal** - Modern React interface
- **API Gateway** - RESTful APIs

### 🚧 **In Development**
- Patient Management System
- Appointment Scheduling
- Medical Records Management
- Billing System
- Medical Aid Claims Processing
- CDSS Integration

## 🎯 Competitive Advantages

### vs Health263 Zimbabwe
- **40% Lower Pricing** - Transparent, all-inclusive packages
- **Modern Technology** - Cloud-native vs legacy systems
- **AI-Powered CDSS** - First in Zimbabwe market
- **Better User Experience** - Modern, intuitive interface
- **Complete Integration** - All-in-one solution

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

### Tenant Management
- `GET /api/tenants` - List all tenants
- `POST /api/tenants` - Create new tenant
- `PUT /api/tenants/:id/status` - Update tenant status
- `GET /api/tenants/:id/users` - Get tenant users
- `POST /api/tenants/:id/users` - Create tenant user

### Analytics
- `GET /api/analytics/overview` - System overview
- `GET /api/analytics/tenants` - All tenants overview
- `GET /api/analytics/tenants/:id/report` - Tenant report

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

- **Data Isolation** - Database-per-tenant architecture
- **Role-Based Access** - Granular permissions
- **Audit Logging** - Complete activity tracking
- **Encryption** - Data encrypted at rest and in transit
- **Compliance** - POPIA and healthcare standards

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
- Multi-tenant architecture
- Tenant management system
- User management
- Analytics dashboard

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