# Monitoring & Observability Guide

## Overview
This guide covers monitoring, logging, and observability for MediCore EHR to ensure system health and performance.

## Monitoring Stack

### Components
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notification
- **Loki**: Log aggregation
- **Jaeger**: Distributed tracing (optional)

## Metrics Collection

### Application Metrics
```typescript
// Example: Custom metrics
import { Counter, Histogram } from 'prom-client';

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
});
```

### Key Metrics
- **Request Rate**: Requests per second
- **Error Rate**: Error percentage
- **Response Time**: P50, P95, P99 latencies
- **Database Queries**: Query count and duration
- **Active Connections**: Database and Redis connections
- **Memory Usage**: Application memory consumption
- **CPU Usage**: CPU utilization

### Nurse Copilot + CDSS Reliability Metrics
- `cdss_hooks_total{event_type,status,tenant_id}`: CDSS call volume and success/error rate by tenant.
- `cdss_hook_duration_seconds{event_type,tenant_id}`: CDSS end-to-end latency by tenant.
- `cdss_dependency_retries_total{event_type,reason,tenant_id}`: retry pressure by tenant and reason.
- `cdss_dependency_timeouts_total{event_type,tenant_id}`: timeout count by tenant and hook type.
- `cdss_abstentions_total{event_type,reason,tenant_id}`: abstained CDSS responses observed by EHR proxy.
- `nurse_copilot_recommendations_total{copilot_type,risk_level}`: recommendation volume split by flow.
- `nurse_copilot_decisions_total{copilot_type,decision}`: accept/modify/reject decision behavior.
- `nurse_copilot_time_to_triage_seconds`: queue-to-triage response latency.
- `nurse_copilot_documentation_duration_seconds{documentation_type}`: note/handoff drafting cycle time.
- `nurse_copilot_alert_response_seconds`: alert acknowledgement latency.

## Grafana Dashboards

### Overview Dashboard
- System health overview
- Request rates and errors
- Response time percentiles
- Active users
- Database performance

### Application Dashboard
- API endpoint performance
- Error rates by endpoint
- Database query performance
- Cache hit rates
- Background job status

### Database Dashboard
- Connection pool usage
- Query performance
- Slow queries
- Database size
- Replication lag

### Infrastructure Dashboard
- CPU and memory usage
- Disk I/O
- Network traffic
- Container health
- Service uptime

## Logging

### Log Levels
- **ERROR**: Critical errors requiring attention
- **WARN**: Warning conditions
- **INFO**: Informational messages
- **DEBUG**: Detailed debugging information

### Structured Logging
```typescript
// Example: Structured logging
logger.info('Patient created', {
  patientId: patient.id,
  tenantId: tenant.id,
  userId: user.id,
  timestamp: new Date().toISOString(),
});
```

### Log Aggregation
```yaml
# docker-compose.yml
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - ./loki-config.yml:/etc/loki/local-config.yaml
```

## Alerts

### Critical Alerts
- **Service Down**: Service unavailable
- **High Error Rate**: Error rate > 5%
- **Database Connection Failure**: Cannot connect to database
- **Disk Space Low**: Disk usage > 90%
- **Memory High**: Memory usage > 90%

### Warning Alerts
- **Slow Response Time**: P95 latency > 2s
- **High CPU Usage**: CPU usage > 80%
- **Backup Failure**: Backup job failed
- **High Database Connections**: Connections > 80% of pool

### Nurse Copilot/CDSS Alert Rules (Recommended)
- **CDSS timeout spike by tenant**: `increase(cdss_dependency_timeouts_total[10m]) > 10`
- **CDSS retry spike by tenant**: `increase(cdss_dependency_retries_total[10m]) > 50`
- **Copilot error ratio high**:
  `sum(rate(cdss_hooks_total{status="error"}[5m])) / sum(rate(cdss_hooks_total[5m])) > 0.1`
- **CDSS auth failures**: `increase(cdss_hook_errors_total{error_type="http_401"}[10m]) > 5`
- **CDSS abstain spike**: `increase(cdss_abstentions_total[15m]) > 20`
- **CDSS egress policy blocks**: `increase(cdss_hook_errors_total{error_type="egress_block"}[10m]) > 0`
- **Slow nurse triage response**:
  `histogram_quantile(0.95, rate(nurse_copilot_time_to_triage_seconds_bucket[15m])) > 900`
- **Slow alert acknowledgement**:
  `histogram_quantile(0.95, rate(nurse_copilot_alert_response_seconds_bucket[15m])) > 600`

### Alert Configuration
```yaml
# alertmanager.yml
groups:
  - name: medicore_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}"
```

## Health Checks

### Application Health
```typescript
// Health check endpoint
@Get('health')
async healthCheck() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: await this.checkDatabase(),
    redis: await this.checkRedis(),
  };
}
```

### Database Health
```bash
# Check database connection
docker exec medicore-postgres-master pg_isready

# Check database size
docker exec medicore-postgres-master psql -U medicore -c \
  "SELECT pg_size_pretty(pg_database_size('medicore_master'));"
```

### Service Health
```bash
# Check all services
docker compose ps

# Check service logs
docker compose logs -f ehr-service

# Check service metrics
curl http://localhost:3001/metrics

# Nurse copilot KPI snapshot (EHR service)
curl http://localhost:3001/metrics/nurse-copilot/kpis
```

## Performance Monitoring

### Database Performance
```sql
-- Slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Application Performance
- **APM Tools**: New Relic, Datadog, or similar
- **Profiling**: Node.js profiling
- **Memory Leaks**: Heap snapshots
- **CPU Profiling**: Flame graphs

## Uptime Monitoring

### External Monitoring
- **Uptime Robot**: External health checks
- **Pingdom**: Website monitoring
- **StatusCake**: Uptime monitoring

### Internal Monitoring
- **Health Check Endpoints**: Regular polling
- **Heartbeat**: Service heartbeat
- **Dependency Checks**: Database, Redis, etc.

## Best Practices

### Monitoring
- Monitor all critical services
- Set appropriate alert thresholds
- Review and tune alerts regularly
- Document alert procedures
- Test alerting system

### Logging
- Use structured logging
- Include context in logs
- Set appropriate log levels
- Rotate logs regularly
- Secure sensitive data

### Metrics
- Collect relevant metrics
- Avoid metric explosion
- Use appropriate metric types
- Label metrics properly
- Document metric meanings

## CDSS Fallback Runbook

### Trigger Conditions
- Rising `cdss_dependency_timeouts_total`.
- High error ratio in `cdss_hooks_total`.
- Nurse reports empty/abstained copilot responses.

### Immediate Actions
1. Confirm CDSS and AI upstream health (`/health`, model backend availability, Redis connectivity).
2. Verify timeout/retry env values:
   - EHR: `CDSS_OUTBOUND_TIMEOUT_MS`, `CDSS_OUTBOUND_RETRY_MAX`, `CDSS_OUTBOUND_RETRY_BASE_MS`
   - CDSS: `CDSS_COPILOT_TIMEOUT_SECONDS`, `CDSS_COPILOT_RETRY_MAX`, `CDSS_COPILOT_RETRY_BASE_SECONDS`
3. Check whether circuit-breaker is opening repeatedly from EHR logs.
4. Keep workflows in safe mode (fallback/abstain), do not bypass audit or auth controls.

### Recovery Validation
1. Confirm timeout and retry metrics return to baseline.
2. Confirm copilot recommendation/decision metrics resume normal flow.
3. Record incident summary with start/end times, impacted tenants, and mitigation changes.
