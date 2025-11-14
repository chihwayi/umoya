# SNOMED CT Integration Documentation

## Overview

The SNOMED CT Terminology Service provides comprehensive terminology management for the MediCore EHR system. It enables search, validation, and mapping of SNOMED CT concepts to other terminology systems.

## Features

- **Concept Search**: Search SNOMED CT concepts by term
- **Concept Validation**: Validate SNOMED CT concept codes
- **Concept Details**: Get concept details including children and parents
- **Terminology Mapping**: Map SNOMED CT codes to ICD-10, ICD-11, LOINC, and CPT
- **Caching**: Intelligent caching to reduce API calls and improve performance

## Setup

### Prerequisites

1. **SNOMED CT Terminology Server**
   - Option A: Snowstorm (recommended for local development)
     ```bash
     docker run -d -p 8080:8080 \
       -e JAVA_OPTS="-Xmx4g" \
       --name snowstorm \
       ihtsdo/snowstorm:latest
     ```
   - Option B: SNOMED CT API (cloud-based)

2. **Environment Variables**
   ```bash
   SNOMED_BASE_URL=http://localhost:8080  # Snowstorm URL
   SNOMED_USE_CACHE=true                   # Enable caching
   ```

### Database Setup

Apply the SNOMED CT schema to your tenant databases:

```bash
# For existing tenants
./scripts/apply-snomed-schema.sh

# For new tenants, schema is automatically applied via provisioning
```

## API Endpoints

### Search Concepts

```http
GET /api/terminology/snomed/search?term={term}&limit={limit}&offset={offset}&activeOnly={activeOnly}
```

**Parameters:**
- `term` (required): Search term (minimum 2 characters)
- `limit` (optional): Maximum results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `activeOnly` (optional): Only active concepts (default: true)

**Response:**
```json
{
  "concepts": [
    {
      "conceptId": "73211009",
      "term": "Diabetes mellitus",
      "preferredTerm": "Diabetes mellitus",
      "fullySpecifiedName": "Diabetes mellitus (disorder)",
      "active": true,
      "moduleId": "900000000000207008",
      "definitionStatus": "900000000000074008"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### Validate Concept

```http
GET /api/terminology/snomed/validate/{conceptId}
```

**Response:**
```json
{
  "conceptId": "73211009",
  "term": "Diabetes mellitus",
  "preferredTerm": "Diabetes mellitus",
  "fullySpecifiedName": "Diabetes mellitus (disorder)",
  "active": true
}
```

### Get Concept Details

```http
GET /api/terminology/snomed/concepts/{conceptId}/details
```

**Response:**
```json
{
  "concept": {
    "conceptId": "73211009",
    "term": "Diabetes mellitus",
    "active": true
  },
  "children": [
    {
      "conceptId": "44054006",
      "term": "Diabetes mellitus type 2"
    }
  ],
  "parents": [
    {
      "conceptId": "64572001",
      "term": "Disease"
    }
  ]
}
```

### Map Concept

```http
GET /api/terminology/snomed/map/{conceptId}/{targetSystem}
```

**Target Systems:** `ICD10`, `ICD11`, `LOINC`, `CPT`

**Response:**
```json
[
  {
    "sourceCode": "73211009",
    "targetCode": "E11",
    "targetSystem": "ICD10",
    "mapCategory": "EQUIVALENT",
    "active": true
  }
]
```

## Testing

### Unit Tests

```bash
npm test -- terminology.service.spec.ts
npm test -- terminology.controller.spec.ts
```

### Integration Tests

```bash
npm test -- terminology.integration.spec.ts
```

### Manual Testing

```bash
# Search for concepts
curl -X GET "http://localhost:3013/api/terminology/snomed/search?term=diabetes" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant"

# Validate concept
curl -X GET "http://localhost:3013/api/terminology/snomed/validate/73211009" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant"

# Map to ICD-10
curl -X GET "http://localhost:3013/api/terminology/snomed/map/73211009/ICD10" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant"
```

## Caching Strategy

The service implements intelligent caching:

1. **Search Cache**: 24-hour TTL
2. **Concept Cache**: 7-day TTL
3. **Mapping Cache**: 90-day TTL

Cache is automatically cleaned up via database cleanup functions.

## Error Handling

- **BadRequestException**: Invalid input parameters
- **NotFoundException**: Concept not found or inactive
- **Fallback**: Service falls back to cache on API failures

## Performance Considerations

- Search results are cached to reduce API calls
- Concept details are cached for frequently accessed concepts
- Mappings are cached longer as they're more stable
- Database indexes optimize cache lookups

## Future Enhancements

- [ ] Support for SNOMED CT expression queries
- [ ] Reference set management
- [ ] SNOMED CT versioning support
- [ ] Advanced mapping algorithms
- [ ] Bulk operations support

## Troubleshooting

### SNOMED CT API Not Responding

1. Check if Snowstorm is running: `docker ps | grep snowstorm`
2. Verify URL: `curl http://localhost:8080/browser/MAIN/concepts?term=diabetes`
3. Check logs: `docker logs snowstorm`

### Cache Issues

1. Clear cache: `DELETE FROM snomed_search_cache WHERE created_at < NOW() - INTERVAL '1 day'`
2. Check cache size: `SELECT COUNT(*) FROM snomed_search_cache`
3. Verify indexes: `\d snomed_search_cache` in psql

### Performance Issues

1. Check cache hit rate
2. Review database query performance
3. Consider increasing cache TTL for stable mappings
4. Monitor API response times

## References

- [SNOMED CT Documentation](https://www.snomed.org/)
- [Snowstorm GitHub](https://github.com/IHTSDO/snowstorm)
- [SNOMED CT Browser](https://browser.ihtsdotools.org/)

