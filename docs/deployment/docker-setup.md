# Docker Deployment Guide

## Overview
This guide covers deploying MediCore EHR using Docker and Docker Compose.

## Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 8GB+ RAM
- 50GB+ disk space

## Quick Start

### 1. Clone Repository
```bash
git clone <repository-url>
cd medicore
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env
```

### 3. Start Services
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Check service status
docker compose ps
```

## Service Architecture

### Core Services
- **ehr-service**: Main EHR backend (Port 3001)
- **tenant-service**: Tenant management (Port 3002)
- **frontend**: React frontend (Port 3000)
- **postgres-master**: Master database
- **postgres-tenant**: Tenant databases

### Optional Services
- **redis**: Caching (Port 6379)
- **minio**: Object storage (Port 9000)
- **prometheus**: Metrics (Port 9090)
- **grafana**: Monitoring (Port 3001)

## Database Setup

### Master Database
```bash
# Connect to master database
docker exec -it medicore-postgres-master psql -U medicore -d medicore_master

# Verify tenant list
SELECT id, subdomain, "databaseName" FROM tenants;
```

### Tenant Provisioning
Tenant databases are automatically provisioned when:
- New tenant registers
- Tenant service starts
- Manual provisioning via API

## Health Checks

### Service Health
```bash
# Check all services
docker compose ps

# Check specific service
docker compose logs ehr-service

# Health endpoint
curl http://localhost:3001/health
```

### Database Health
```bash
# Check master database
docker exec medicore-postgres-master pg_isready

# Check tenant databases
docker exec medicore-postgres-tenant pg_isready
```

## Backup & Restore

### Database Backup
```bash
# Backup master database
docker exec medicore-postgres-master pg_dump -U medicore medicore_master > backup_master.sql

# Backup tenant database
docker exec medicore-postgres-tenant pg_dump -U medicore clinic_name_db > backup_tenant.sql
```

### Restore Database
```bash
# Restore master database
docker exec -i medicore-postgres-master psql -U medicore medicore_master < backup_master.sql

# Restore tenant database
docker exec -i medicore-postgres-tenant psql -U medicore clinic_name_db < backup_tenant.sql
```

## Scaling

### Horizontal Scaling
```bash
# Scale EHR service
docker compose up -d --scale ehr-service=3

# Scale with load balancer
# Configure NGINX or AWS ALB
```

### Resource Limits
```yaml
# docker-compose.yml
services:
  ehr-service:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker compose logs <service-name>

# Restart service
docker compose restart <service-name>

# Rebuild service
docker compose up -d --build <service-name>
```

### Database Connection Issues
```bash
# Verify database is running
docker compose ps postgres-master

# Check connection string
docker compose exec ehr-service env | grep DB

# Test connection
docker exec medicore-postgres-master psql -U medicore -d medicore_master -c "SELECT 1;"
```

### Port Conflicts
```bash
# Check port usage
lsof -i :3000
lsof -i :3001

# Change ports in docker-compose.yml
ports:
  - "3000:3000"  # Change 3000 to available port
```

## Production Deployment

### Security Checklist
- [ ] Change default passwords
- [ ] Enable SSL/TLS
- [ ] Configure firewall
- [ ] Set up monitoring
- [ ] Enable backups
- [ ] Configure log rotation
- [ ] Set resource limits
- [ ] Enable health checks

### Environment Variables
```bash
# Production .env
NODE_ENV=production
DB_PASSWORD=<strong-password>
JWT_SECRET=<strong-secret>
API_KEY=<secure-api-key>
```

## Maintenance

### Updates
```bash
# Pull latest changes
git pull

# Rebuild services
docker compose up -d --build

# Run migrations
docker compose exec ehr-service npm run migration:run
```

### Logs
```bash
# View all logs
docker compose logs

# Follow logs
docker compose logs -f

# Export logs
docker compose logs > logs.txt
```

