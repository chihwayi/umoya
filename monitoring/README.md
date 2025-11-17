# MediCore Monitoring Setup

## Prometheus + Grafana Monitoring Stack

This directory contains the configuration for Prometheus metrics collection and Grafana dashboards.

## Quick Start

### 1. Start Monitoring Stack

```bash
cd monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

This will start:
- **Prometheus** on `http://localhost:9090`
- **Grafana** on `http://localhost:3000` (admin/admin)

### 2. Verify Metrics Endpoint

The EHR service exposes metrics at:
```
http://localhost:3001/api/metrics
```

Verify it's working:
```bash
curl http://localhost:3001/api/metrics
```

### 3. Access Grafana

1. Open `http://localhost:3000`
2. Login with `admin` / `admin`
3. Navigate to **Dashboards** → **MediCore** → **MediCore EHR - Overview**

## Prometheus Configuration

**File**: `prometheus/prometheus.yml`

Scrapes metrics from:
- `ehr-service:3001` - EHR API metrics
- `tenant-service:3000` - Tenant provisioning metrics
- `cdss-service:8000` - CDSS service metrics

## Grafana Dashboards

### Overview Dashboard
**Location**: `grafana/dashboards/medicore-overview.json`

**Panels**:
1. CDSS Hooks - Total Requests
2. CDSS Hook Duration (p50, p95)
3. CDSS Hook Errors
4. Provisioning Operations
5. Provisioning Duration
6. Automation Jobs
7. SNOMED Searches
8. ICD-10 Mappings
9. System Health

### Importing Dashboards

1. **Automatic** (via provisioning):
   - Dashboards in `grafana/dashboards/` are auto-imported
   - Refresh interval: 10 seconds

2. **Manual**:
   - Go to **Dashboards** → **Import**
   - Upload JSON file from `grafana/dashboards/`

## Available Metrics

### CDSS Hooks
- `cdss_hooks_total` - Total hooks triggered
- `cdss_hook_duration_seconds` - Processing duration
- `cdss_hook_errors_total` - Error count

### Provisioning
- `provisioning_operations_total` - Total operations
- `provisioning_duration_seconds` - Operation duration
- `provisioning_errors_total` - Error count

### Automation
- `automation_jobs_total` - Jobs executed
- `automation_errors_total` - Error count

### SNOMED/ICD-10
- `snomed_searches_total` - Search count
- `icd10_mappings_total` - Mapping lookups

## Alerting Rules (Future)

Create alert rules in Prometheus:
```yaml
groups:
  - name: medicore_alerts
    rules:
      - alert: HighCDSSErrorRate
        expr: rate(cdss_hook_errors_total[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High CDSS hook error rate"
```

## Troubleshooting

1. **Prometheus can't scrape metrics**:
   - Verify services are running
   - Check network connectivity
   - Verify metrics endpoint is accessible

2. **Grafana shows "No Data"**:
   - Check Prometheus data source is configured
   - Verify Prometheus is scraping metrics
   - Check time range in dashboard

3. **Dashboards not appearing**:
   - Check provisioning directory permissions
   - Verify dashboard JSON is valid
   - Check Grafana logs: `docker logs medicore-grafana`

## Production Deployment

For production:
1. Update Prometheus retention: `--storage.tsdb.retention.time=30d`
2. Set up persistent volumes for data
3. Configure authentication for Grafana
4. Set up alerting rules
5. Configure external alertmanager

