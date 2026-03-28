// Force deterministic test-safe runtime env, even when CI injects production-like values.
process.env.NODE_ENV = 'test';
process.env.ENVIRONMENT = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-length-1234567890';
process.env.SERVICE_TENANT_URL = 'http://tenant-service.internal:3001';
process.env.SERVICE_EHR_URL = 'http://ehr-service.internal:3013';
process.env.SERVICE_CDSS_URL = 'http://cdss-service.internal:8000';
process.env.RXNORM_BASE_URL = 'https://rxnorm.test.local/REST';
process.env.POSTVISIT_LLM_API_URL = 'https://llm.test.local/v1/chat/completions';
process.env.PAGERDUTY_EVENTS_API_URL = 'https://events.test.local/v2/enqueue';
process.env.DHIS2_URL = 'https://dhis2.test.local';
process.env.FRONTEND_URL = 'https://staff.test.local';
process.env.PORTAL_BASE_URL = 'https://portal.test.local';
process.env.WEB_APP_URL = 'https://admin.test.local';
process.env.WHISPER_API_URL = 'https://whisper.test.local/v1/audio/transcriptions';
process.env.LOCAL_WHISPER_URL = 'https://whisper-proxy.test.local/inference';
process.env.LOCAL_OCR_URL = 'https://ocr.test.local/extract';
process.env.POSTVISIT_CLINICALTRIALS_API_URL = 'https://clinicaltrials.test.local/api/v2/studies';
