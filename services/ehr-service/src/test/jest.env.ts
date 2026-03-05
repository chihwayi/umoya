// Force deterministic test-safe runtime env, even when CI injects production-like values.
process.env.NODE_ENV = 'test';
process.env.ENVIRONMENT = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-length-1234567890';
process.env.SERVICE_TENANT_URL = 'http://tenant-service.internal:3001';
process.env.SERVICE_EHR_URL = 'http://ehr-service.internal:3013';
process.env.SERVICE_CDSS_URL = 'http://cdss-service.internal:8000';
