# Production Deployment Guide

## Overview
This guide covers deploying MediCore EHR to production environments with best practices for security, performance, and reliability.

## Prerequisites
- Production server (Linux recommended)
- Domain name and SSL certificate
- Database server (PostgreSQL 14+)
- Reverse proxy (NGINX or AWS ALB)
- Monitoring solution (Prometheus/Grafana)
- Backup solution

## Infrastructure Setup

### Server Requirements
- **CPU**: 4+ cores
- **RAM**: 16GB+ (32GB recommended)
- **Storage**: 100GB+ SSD
- **Network**: High-speed internet connection

### Database Server
- **PostgreSQL**: 14+ with replication
- **Backup**: Automated daily backups
- **Monitoring**: Query performance monitoring
- **Connection Pooling**: PgBouncer recommended

## Deployment Steps

### 1. Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Application Deployment
```bash
# Clone repository
git clone <repository-url>
cd medicore

# Create production .env
cp .env.example .env.production

# Configure environment variables
nano .env.production

# Start services
docker compose -f docker-compose.prod.yml up -d
```

### 3. SSL/TLS Configuration
```nginx
# NGINX configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4. Database Configuration
```bash
# Production database settings
DB_HOST=production-db-server
DB_PORT=5432
DB_USERNAME=medicore_prod
DB_PASSWORD=<strong-password>
DB_SSL=true
DB_POOL_SIZE=20
```

## Security Configuration

### Environment Variables
```bash
# Security settings
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
API_KEY=<secure-api-key>
ENCRYPTION_KEY=<encryption-key>
SESSION_SECRET=<session-secret>

# Database
DB_PASSWORD=<strong-password>
REDIS_PASSWORD=<redis-password>
```

### Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### SSL/TLS
- Use Let's Encrypt for free SSL
- Enable HSTS
- Configure strong cipher suites
- Regular certificate renewal

## Monitoring & Logging

### Application Monitoring
- **Prometheus**: Metrics collection
- **Grafana**: Dashboards and visualization
- **AlertManager**: Alert routing

### Log Management
```bash
# Centralized logging
- Application logs → ELK Stack or CloudWatch
- Access logs → NGINX logs
- Error logs → Sentry or similar
- Audit logs → Secure storage
```

### Health Checks
```bash
# Application health
curl https://your-domain.com/api/health

# Database health
docker exec medicore-postgres-master pg_isready
```

## Backup Strategy

### Database Backups
```bash
# Automated daily backups
0 2 * * * /path/to/backup-script.sh

# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
docker exec medicore-postgres-master pg_dump -U medicore medicore_master > /backups/master_$DATE.sql
```

### Backup Storage
- Local backups (7 days)
- Cloud backups (30 days)
- Offsite backups (90 days)
- Encrypted backups

### Restore Procedure
```bash
# Restore from backup
docker exec -i medicore-postgres-master psql -U medicore medicore_master < backup.sql
```

## Performance Optimization

### Application
- Enable gzip compression
- Configure CDN for static assets
- Optimize database queries
- Use Redis for caching
- Enable connection pooling

### Database
- Regular VACUUM and ANALYZE
- Proper indexing
- Query optimization
- Connection pooling (PgBouncer)

### Caching
```bash
# Redis configuration
REDIS_HOST=redis-server
REDIS_PORT=6379
REDIS_PASSWORD=<password>
CACHE_TTL=3600
```

## Scaling

### Horizontal Scaling
- Load balancer (NGINX/AWS ALB)
- Multiple application instances
- Database read replicas
- Redis cluster

### Vertical Scaling
- Increase server resources
- Optimize database configuration
- Add more memory/CPU

## Disaster Recovery

### Recovery Plan
1. **RTO**: Recovery Time Objective (4 hours)
2. **RPO**: Recovery Point Objective (1 hour)
3. **Backup Verification**: Weekly restore tests
4. **Failover Procedure**: Documented and tested

### High Availability
- Database replication
- Application redundancy
- Load balancing
- Health check automation

## Maintenance

### Updates
```bash
# Pull latest code
git pull origin main

# Rebuild services
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker compose exec ehr-service npm run migration:run
```

### Maintenance Window
- Schedule during low-traffic hours
- Notify users in advance
- Test in staging first
- Have rollback plan ready

## Compliance

### HIPAA Compliance
- Encrypted data at rest
- Encrypted data in transit
- Access controls
- Audit logging
- Business Associate Agreements

### Data Privacy
- GDPR compliance (if applicable)
- Data retention policies
- Right to deletion
- Consent management

## Support & Maintenance

### Monitoring
- 24/7 system monitoring
- Alert notifications
- Performance tracking
- Error tracking

### Support Channels
- Email support
- Phone support
- Ticketing system
- Documentation

