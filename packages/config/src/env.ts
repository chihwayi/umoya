import { z } from 'zod';

const envSchema = z.object({
  // System
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SYSTEM_DOMAIN: z.string().default('medicore.co.zw'),

  // URL inheritance (single-base, optional)
  SERVICE_BASE_URL: z.string().optional(),
  SERVICE_TENANT_PATH: z.string().default('/tenant-service'),
  SERVICE_EHR_PATH: z.string().default('/ehr-service'),
  SERVICE_CDSS_PATH: z.string().default('/cdss-service'),

  REACT_APP_API_BASE_URL: z.string().optional(),
  REACT_APP_TENANT_API_PATH: z.string().default('/tenant-service'),
  REACT_APP_EHR_API_PATH: z.string().default('/ehr-service'),
  REACT_APP_CDSS_API_PATH: z.string().default('/cdss-service'),

  LOCAL_AI_BASE_URL: z.string().optional(),
  LOCAL_WHISPER_PATH: z.string().default('/inference'),
  LOCAL_OCR_PATH: z.string().default('/extract'),

  // Explicit service URLs (take priority over inherited URLs)
  SERVICE_TENANT_URL: z.string().optional(),
  SERVICE_EHR_URL: z.string().optional(),
  SERVICE_CDSS_URL: z.string().optional(),

  // API URLs (external/client)
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
  LOCAL_WHISPER_URL: z.string().optional(),
  FEATURE_POSTVISIT_ESCALATION_CONFIDENCE: z.enum(['true', 'false']).default('false'),
  FEATURE_POSTVISIT_DIARIZATION_REVIEW: z.enum(['true', 'false']).default('false'),
  POSTVISIT_DIARIZATION_MIN_CONFIDENCE: z.string().default('0.65'),
  FEATURE_POSTVISIT_OCR_INTELLIGENCE: z.enum(['true', 'false']).default('false'),
  FEATURE_POSTVISIT_MEDICATION_INTELLIGENCE_V2: z.enum(['true', 'false']).default('false'),
  FEATURE_POSTVISIT_SPECIALTY_SOAP: z.enum(['true', 'false']).default('false'),
  FEATURE_POSTVISIT_MULTILINGUAL_TEACHBACK: z.enum(['true', 'false']).default('false'),
  FEATURE_POSTVISIT_INTRAVISIT_ALERTS: z.enum(['true', 'false']).default('false'),
  LOCAL_OCR_URL: z.string().optional(),

  // Notifications (SMS)
  SMS_GATEWAY_ECONET: z.string().default('https://api.econet.co.zw/sms'),
  SMS_GATEWAY_TELECEL: z.string().default('https://api.telecel.co.zw/sms'),
  SMS_GATEWAY_NETONE: z.string().default('https://api.netone.co.zw/sms'),
});

const DEV_DEFAULTS = {
  serviceTenantUrl: 'http://tenant-service:3001',
  serviceEhrUrl: 'http://ehr-service:3013',
  serviceCdssUrl: 'http://cdss-service:8000',
  localWhisperUrl: 'http://127.0.0.1:8080/inference',
  localOcrUrl: 'http://127.0.0.1:8081/extract',
} as const;

const rawNodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
const isDevLike = rawNodeEnv === 'development' || rawNodeEnv === 'test';

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  if (isDevLike) {
    console.error('⚠️  Environment Validation Warning:', _env.error.format());
  } else {
    throw new Error(`Environment validation failed: ${JSON.stringify(_env.error.format())}`);
  }
}

const parsedEnv = _env.success ? _env.data : (process.env as any);

const hasExplicitEnvValue = (key: string): boolean => {
  const raw = (process.env as Record<string, string | undefined>)[key];
  return typeof raw === 'string' && raw.trim().length > 0;
};

const firstNonEmpty = (...values: Array<string | undefined | null>): string | undefined => {
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
};

const stripTrailingSlash = (value: string): string => String(value || '').replace(/\/+$/, '');

const ensureLeadingSlash = (value: string): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const joinUrl = (base: string, path: string): string => {
  const normalizedBase = stripTrailingSlash(base);
  const normalizedPath = ensureLeadingSlash(path);
  return `${normalizedBase}${normalizedPath}`;
};

const serviceBaseUrl = firstNonEmpty(parsedEnv.SERVICE_BASE_URL);
const reactApiBaseUrl = firstNonEmpty(parsedEnv.REACT_APP_API_BASE_URL, parsedEnv.SERVICE_BASE_URL);
const localAiBaseUrl = firstNonEmpty(parsedEnv.LOCAL_AI_BASE_URL);

const resolvedServiceTenantUrl = firstNonEmpty(
  hasExplicitEnvValue('SERVICE_TENANT_URL') ? parsedEnv.SERVICE_TENANT_URL : undefined,
  serviceBaseUrl ? joinUrl(serviceBaseUrl, parsedEnv.SERVICE_TENANT_PATH) : undefined,
  DEV_DEFAULTS.serviceTenantUrl,
);
const resolvedServiceEhrUrl = firstNonEmpty(
  hasExplicitEnvValue('SERVICE_EHR_URL') ? parsedEnv.SERVICE_EHR_URL : undefined,
  serviceBaseUrl ? joinUrl(serviceBaseUrl, parsedEnv.SERVICE_EHR_PATH) : undefined,
  DEV_DEFAULTS.serviceEhrUrl,
);
const resolvedServiceCdssUrl = firstNonEmpty(
  hasExplicitEnvValue('SERVICE_CDSS_URL') ? parsedEnv.SERVICE_CDSS_URL : undefined,
  serviceBaseUrl ? joinUrl(serviceBaseUrl, parsedEnv.SERVICE_CDSS_PATH) : undefined,
  DEV_DEFAULTS.serviceCdssUrl,
);

const resolvedReactTenantApiUrl = firstNonEmpty(
  hasExplicitEnvValue('REACT_APP_TENANT_API_URL') ? parsedEnv.REACT_APP_TENANT_API_URL : undefined,
  reactApiBaseUrl ? joinUrl(reactApiBaseUrl, parsedEnv.REACT_APP_TENANT_API_PATH) : undefined,
  resolvedServiceTenantUrl,
);
const resolvedReactEhrApiUrl = firstNonEmpty(
  hasExplicitEnvValue('REACT_APP_EHR_API_URL') ? parsedEnv.REACT_APP_EHR_API_URL : undefined,
  reactApiBaseUrl ? joinUrl(reactApiBaseUrl, parsedEnv.REACT_APP_EHR_API_PATH) : undefined,
  resolvedServiceEhrUrl,
);
const resolvedReactCdssApiUrl = firstNonEmpty(
  hasExplicitEnvValue('REACT_APP_CDSS_API_URL') ? parsedEnv.REACT_APP_CDSS_API_URL : undefined,
  reactApiBaseUrl ? joinUrl(reactApiBaseUrl, parsedEnv.REACT_APP_CDSS_API_PATH) : undefined,
  resolvedServiceCdssUrl,
);

const resolvedLocalWhisperUrl = firstNonEmpty(
  hasExplicitEnvValue('LOCAL_WHISPER_URL') ? parsedEnv.LOCAL_WHISPER_URL : undefined,
  localAiBaseUrl ? joinUrl(localAiBaseUrl, parsedEnv.LOCAL_WHISPER_PATH) : undefined,
  DEV_DEFAULTS.localWhisperUrl,
);
const resolvedLocalOcrUrl = firstNonEmpty(
  hasExplicitEnvValue('LOCAL_OCR_URL') ? parsedEnv.LOCAL_OCR_URL : undefined,
  localAiBaseUrl ? joinUrl(localAiBaseUrl, parsedEnv.LOCAL_OCR_PATH) : undefined,
  DEV_DEFAULTS.localOcrUrl,
);

const envData = {
  ...parsedEnv,
  SERVICE_TENANT_URL: resolvedServiceTenantUrl,
  SERVICE_EHR_URL: resolvedServiceEhrUrl,
  SERVICE_CDSS_URL: resolvedServiceCdssUrl,
  REACT_APP_TENANT_API_URL: resolvedReactTenantApiUrl,
  REACT_APP_EHR_API_URL: resolvedReactEhrApiUrl,
  REACT_APP_CDSS_API_URL: resolvedReactCdssApiUrl,
  LOCAL_WHISPER_URL: resolvedLocalWhisperUrl,
  LOCAL_OCR_URL: resolvedLocalOcrUrl,
};

const isLocalHostUrl = (url?: string): boolean => {
  const value = String(url || '').trim().toLowerCase();
  return value.includes('localhost') || value.includes('127.0.0.1');
};

if (!isDevLike) {
  const insecureJwtDefault = 'your-super-secret-jwt-key-change-this-in-production';
  if (!envData.JWT_SECRET || envData.JWT_SECRET === insecureJwtDefault || envData.JWT_SECRET.length < 24) {
    throw new Error('Invalid JWT_SECRET for non-development environment.');
  }

  const hasExplicitServiceRouting =
    hasExplicitEnvValue('SERVICE_BASE_URL') ||
    hasExplicitEnvValue('SERVICE_TENANT_URL') ||
    hasExplicitEnvValue('SERVICE_EHR_URL') ||
    hasExplicitEnvValue('SERVICE_CDSS_URL');
  if (!hasExplicitServiceRouting) {
    throw new Error(
      'Service routing is not explicitly configured for non-development environment. Set SERVICE_BASE_URL or explicit SERVICE_*_URL values.',
    );
  }

  const serviceUrls = [
    envData.SERVICE_TENANT_URL,
    envData.SERVICE_EHR_URL,
    envData.SERVICE_CDSS_URL,
  ];
  if (serviceUrls.some((url) => !url || isLocalHostUrl(url))) {
    throw new Error('Service URLs must be explicitly configured and not localhost/127.0.0.1 in non-development environment.');
  }

  if (envData.USE_LOCAL_WHISPER === 'true' && isLocalHostUrl(envData.LOCAL_WHISPER_URL)) {
    throw new Error('LOCAL_WHISPER_URL cannot point to localhost/127.0.0.1 in non-development when USE_LOCAL_WHISPER=true.');
  }

  if (envData.FEATURE_POSTVISIT_OCR_INTELLIGENCE === 'true' && isLocalHostUrl(envData.LOCAL_OCR_URL)) {
    throw new Error('LOCAL_OCR_URL cannot point to localhost/127.0.0.1 in non-development when OCR intelligence is enabled.');
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

  publicUrls: {
    tenantApi: env.REACT_APP_TENANT_API_URL,
    ehrApi: env.REACT_APP_EHR_API_URL,
    cdssApi: env.REACT_APP_CDSS_API_URL,
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
    corsOrigins: String(env.CORS_ORIGINS || '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  },

  ai: {
    transcription: {
      useLocal: env.USE_LOCAL_WHISPER === 'true',
      localUrl: env.LOCAL_WHISPER_URL,
      apiUrl: env.WHISPER_API_URL,
      apiKey: env.OPENAI_API_KEY || env.WHISPER_API_KEY,
    },
    ocr: {
      localUrl: env.LOCAL_OCR_URL,
    },
  },

  features: {
    postVisitEscalationConfidence: env.FEATURE_POSTVISIT_ESCALATION_CONFIDENCE === 'true',
    postVisitDiarizationReview: env.FEATURE_POSTVISIT_DIARIZATION_REVIEW === 'true',
    postVisitOcrIntelligence: env.FEATURE_POSTVISIT_OCR_INTELLIGENCE === 'true',
    postVisitMedicationIntelligenceV2: env.FEATURE_POSTVISIT_MEDICATION_INTELLIGENCE_V2 === 'true',
    postVisitSpecialtySoap: env.FEATURE_POSTVISIT_SPECIALTY_SOAP === 'true',
    postVisitMultilingualTeachBack: env.FEATURE_POSTVISIT_MULTILINGUAL_TEACHBACK === 'true',
    postVisitIntraVisitAlerts: env.FEATURE_POSTVISIT_INTRAVISIT_ALERTS === 'true',
  },

  notifications: {
    sms: {
      econet: env.SMS_GATEWAY_ECONET,
      telecel: env.SMS_GATEWAY_TELECEL,
      netone: env.SMS_GATEWAY_NETONE,
    },
  },
} as const;
