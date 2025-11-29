# Proper Snowstorm + Elasticsearch + SNOMED RF2 Setup Guide

## Research Summary: Correct Installation Process

Based on official Snowstorm documentation and community best practices, here's the proper setup process:

## 1. System Requirements

### Memory Requirements
- **Elasticsearch**: Minimum 4GB RAM (8GB recommended)
- **Snowstorm**: Minimum 2GB RAM (4GB recommended)
- **Total System**: 8GB+ RAM recommended

### Disk Space
- **SNOMED RF2 Files**: ~2GB compressed, ~8GB extracted
- **Elasticsearch Data**: ~15-20GB after import
- **Total**: 30GB+ free space recommended

## 2. Proper Docker Configuration

### Elasticsearch Configuration
```yaml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
  environment:
    - discovery.type=single-node
    - "ES_JAVA_OPTS=-Xms4g -Xmx4g"  # Critical: Adequate memory
    - xpack.security.enabled=false
    - xpack.security.enrollment.enabled=false
    - cluster.routing.allocation.disk.threshold_enabled=false
  ulimits:
    memlock:
      soft: -1
      hard: -1
  volumes:
    - es_data:/usr/share/elasticsearch/data
  ports:
    - "9200:9200"
```

### Snowstorm Configuration
```yaml
snowstorm:
  image: snomedinternational/snowstorm:latest
  environment:
    - "JAVA_OPTS=-Xms2g -Xmx4g -XX:+UseG1GC"
    - elasticsearch.urls=http://elasticsearch:9200
    - elasticsearch.index.prefix=snowstorm
  depends_on:
    elasticsearch:
      condition: service_healthy
  volumes:
    - ./snomed-data:/opt/snowstorm/import:ro
  ports:
    - "8080:8080"
```

## 3. Critical Setup Steps

### Step 1: Prepare SNOMED RF2 Files
```bash
# Download SNOMED CT International Edition from MLDS
# Extract to proper directory structure:
# snomed-data/
# └── SnomedCT_InternationalRF2_PRODUCTION_YYYYMMDD/
#     ├── Snapshot/
#     │   ├── Terminology/
#     │   ├── Refset/
#     │   └── ...
#     └── Full/
#         ├── Terminology/
#         ├── Refset/
#         └── ...
```

### Step 2: Start Services in Correct Order
```bash
# 1. Start Elasticsearch first
docker-compose up -d elasticsearch

# 2. Wait for Elasticsearch to be ready (critical!)
curl -X GET "localhost:9200/_cluster/health?wait_for_status=green&timeout=60s"

# 3. Start Snowstorm only after Elasticsearch is green
docker-compose up -d snowstorm

# 4. Wait for Snowstorm to be fully ready
curl -X GET "localhost:8080/actuator/health" | jq '.status'
```

### Step 3: Verify Prerequisites Before Import
```bash
# Check Elasticsearch health
curl "localhost:9200/_cluster/health" | jq '{status, number_of_nodes}'

# Check Snowstorm health
curl "localhost:8080/actuator/health" | jq '.status'

# Verify file access
docker exec snowstorm ls -la /opt/snowstorm/import/
```

## 4. Proper Import Process

### Method 1: REST API Import (Recommended)
```bash
# For fresh installation, use SNAPSHOT import
curl -X POST "localhost:8080/imports" \
  -H "Content-Type: application/json" \
  -d '{
    "branchPath": "MAIN",
    "createCodeSystemVersion": true,
    "type": "SNAPSHOT",
    "filePath": "/opt/snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_YYYYMMDD/Snapshot"
  }'
```

### Method 2: Command Line Import (Alternative)
```bash
# If REST API fails, use command line
docker exec -it snowstorm java -jar /app.jar \
  --import \
  --import.type=SNAPSHOT \
  --import.path=/opt/snowstorm/import/SnomedCT_InternationalRF2_PRODUCTION_YYYYMMDD/Snapshot \
  --import.branch=MAIN
```

## 5. Monitoring Import Progress

### Real-time Monitoring
```bash
# Monitor import logs
docker logs -f snowstorm | grep -E "(Starting|Reading|Completed|concepts)"

# Check import status
curl "localhost:8080/imports/{import-id}"

# Monitor Elasticsearch indices
curl "localhost:9200/_cat/indices?v" | grep concept
```

### Expected Import Timeline
- **Small datasets**: 5-15 minutes
- **SNOMED International**: 30-90 minutes
- **Large extensions**: 2+ hours

## 6. Common Issues and Solutions

### Issue 1: Import Jobs Created But Not Processing
**Cause**: ActiveMQ message queue not processing
**Solution**: 
```bash
# Restart Snowstorm to reset message queue
docker-compose restart snowstorm
# Wait for full startup before triggering import
```

### Issue 2: Out of Memory Errors
**Cause**: Insufficient JVM heap space
**Solution**:
```yaml
# Increase memory allocation
environment:
  - "JAVA_OPTS=-Xms4g -Xmx8g"
  - "ES_JAVA_OPTS=-Xms4g -Xmx8g"
```

### Issue 3: Elasticsearch Connection Refused
**Cause**: Elasticsearch not ready when Snowstorm starts
**Solution**:
```yaml
# Add health check and dependency
elasticsearch:
  healthcheck:
    test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
    interval: 30s
    timeout: 10s
    retries: 5

snowstorm:
  depends_on:
    elasticsearch:
      condition: service_healthy
```

### Issue 4: File Path Not Found
**Cause**: Incorrect volume mounting or file permissions
**Solution**:
```bash
# Verify file structure
docker exec snowstorm find /opt/snowstorm/import -name "*.txt" | head -5

# Fix permissions
chmod -R 755 ./snomed-data/
```

## 7. Verification After Import

### Test 1: Basic Search
```bash
curl "localhost:8080/browser/MAIN/concepts?term=pain&limit=5" | jq '.items[].pt.term'
```

### Test 2: Concept Count
```bash
curl "localhost:8080/browser/MAIN/concepts?limit=0" | jq '.total'
# Should return ~350,000+ for International Edition
```

### Test 3: Specific Concept
```bash
curl "localhost:8080/browser/MAIN/concepts/22253000" | jq '.pt.term'
# Should return "Pain"
```

## 8. Production Recommendations

### Performance Tuning
```yaml
# Elasticsearch
environment:
  - "ES_JAVA_OPTS=-Xms8g -Xmx8g"
  - indices.memory.index_buffer_size=30%
  - thread_pool.write.queue_size=1000

# Snowstorm
environment:
  - "JAVA_OPTS=-Xms4g -Xmx8g -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
```

### Backup Strategy
```bash
# Backup Elasticsearch data
docker exec elasticsearch curl -X PUT "localhost:9200/_snapshot/backup" -d '{
  "type": "fs",
  "settings": {"location": "/usr/share/elasticsearch/backup"}
}'
```

## 9. Troubleshooting Checklist

Before starting import:
- [ ] Elasticsearch status is GREEN
- [ ] Snowstorm health check returns UP
- [ ] RF2 files are properly extracted and accessible
- [ ] Sufficient disk space (30GB+)
- [ ] Sufficient memory (8GB+ total)
- [ ] No existing data conflicts

During import:
- [ ] Monitor logs for "Starting RF2 import" message
- [ ] Check for "Reading concepts" progress messages
- [ ] Monitor system resources (CPU, memory, disk)
- [ ] Verify no error messages in logs

After import:
- [ ] Search returns real concept IDs (not null)
- [ ] Concept count matches expected numbers
- [ ] Specific concept lookups work
- [ ] No error messages in application logs

## 10. Alternative: Pre-built Snowstorm with Data

If manual import continues to fail, consider:

1. **Snowstorm Docker with pre-loaded data**
2. **Elasticsearch snapshot restore**
3. **Manual database population**

This approach bypasses the import process entirely by using pre-populated data.