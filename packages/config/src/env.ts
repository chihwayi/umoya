import { z } from 'zod';

const envSchema = z.object({
  // System
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SYSTEM_DOMAIN: z.string().default('medicore.co.zw'),
  
  // Service URLs (Internal/Docker)
  SERVICE_TENANT_URL: z.string().default('http://tenant-service:3001'),
  SERVICE_EHR_URL: z.string().default('http://ehr-service:3013'),
  SERVICE_CDSS_URL: z.string().default('http://cdss-service:8000'),
  
  // API URLs (External/Client)
  REACT_APP_TENANT_API_URL: z.string().optional(),
  REACT_APP_EHR_API_URL: z.string().optional(),
  REACT_APP_CDSS_API_URL: z.string().optional(),
  
  // Database
  DATABASE_URL: z.string().optional(),
  POSTGRES_USER: z.string().default('medicore'),
  POSTGRES_PASSWORD: z.string().default('medicore_password'),
  POSTGRES_DB: z.string().default('medicore_master'),
  
  // Third Party
  DHIS2_URL: z.string().default('https://dhis2.mohcc.gov.zw'),
  
  // Secrets
  JWT_SECRET: z.string().default('your-super-secret-jwt-key-change-this-in-production'),
  
  // Security
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3011,http://127.0.0.1:3000,http://127.0.0.1:3011'),

  // AI & Transcription
  WHISPER_API_URL: z.string().default('https://api.openai.com/v1/audio/transcriptions'),
  WHISPER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  USE_LOCAL_WHISPER: z.enum(['true', 'false']).default('true'),
  LOCAL_WHISPER_URL: z.string().default('http://127.0.0.1:8080'),
  FEATURE_POSTVISIT_ESCALATION_CONFIDENCE: z.enum(['true', 'false']).default('false'),
  FEATURE_POSTVISIT_DIARIZATION_REVIEW: z.enum(['true', 'false']).default('false'),
  POSTVISIT_DIARIZATION_MIN_CONFIDENCE: z.string().default('0.65'),
  FEATURE_POSTVISIT_OCR_INTELLIGENCE: z.enum(['true', 'false']).default('false'),
  LOCAL_OCR_URL: z.string().default('http://127.0.0.1:8081'),

  // Notifications (SMS)
  SMS_GATEWAY_ECONET: z.string().default('https://api.econet.co.zw/sms'),
  SMS_GATEWAY_TELECEL: z.string().default('https://api.telecel.co.zw/sms'),
  SMS_GATEWAY_NETONE: z.string().default('https://api.netone.co.zw/sms'),
});

const rawNodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
const isDevLike = rawNodeEnv === 'development';

// Parse and validate
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  if (isDevLike) {
    console.error('⚠️  Environment Validation Warning:', _env.error.format());
  } else {
    throw new Error(`Environment validation failed: ${JSON.stringify(_env.error.format())}`);
  }
}

// Fallback only in dev-like environments to keep local setup simple.
const envData = _env.success
  ? _env.data
  : (process.env as any);

if (!isDevLike) {
  const insecureJwtDefault = 'your-super-secret-jwt-key-change-this-in-production';
  if (!envData.JWT_SECRET || envData.JWT_SECRET === insecureJwtDefault || envData.JWT_SECRET.length < 24) {
    throw new Error('Invalid JWT_SECRET for non-development environment.');
  }

  const serviceUrls = [
    envData.SERVICE_TENANT_URL,
    envData.SERVICE_EHR_URL,
    envData.SERVICE_CDSS_URL,
  ];
  if (serviceUrls.some((url) => !url || String(url).includes('localhost'))) {
    throw new Error('Service URLs must be explicitly configured and not localhost in non-development environment.');
  }
}

export const env = envData;

export const config = {
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  
  urls: {
    tenantService: env.SERVICE_TENANT_URL,
    ehrService: env.SERVICE_EHR_URL,
    cdssService: env.SERVICE_CDSS_URL,
    dhis2: env.DHIS2_URL,
  },
  
  db: {
    url: env.DATABASE_URL,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    name: env.POSTGRES_DB,
  },
  
  secrets: {
    jwt: env.JWT_SECRET,
  },
  
  system: {
    domain: env.SYSTEM_DOMAIN,
  },
  
  security: {
    corsOrigins: env.CORS_ORIGINS.split(','),
  },

  ai: {
    transcription: {
      useLocal: env.USE_LOCAL_WHISPER === 'true',
      localUrl: env.LOCAL_WHISPER_URL,
      apiUrl: env.WHISPER_API_URL,
      apiKey: env.OPENAI_API_KEY || env.WHISPER_API_KEY,
    }
  },

  features: {
    postVisitEscalationConfidence: env.FEATURE_POSTVISIT_ESCALATION_CONFIDENCE === 'true',
    postVisitDiarizationReview: env.FEATURE_POSTVISIT_DIARIZATION_REVIEW === 'true',
    postVisitOcrIntelligence: env.FEATURE_POSTVISIT_OCR_INTELLIGENCE === 'true',
  },

  notifications: {
    sms: {
      econet: env.SMS_GATEWAY_ECONET,
      telecel: env.SMS_GATEWAY_TELECEL,
      netone: env.SMS_GATEWAY_NETONE,
    }
  }
} as const;
