import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import * as bodyParser from 'body-parser';
import compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { EhrModule } from './ehr.module';
import { HipaaAuditInterceptor } from './interceptors/hipaa-audit.interceptor';
import { AllExceptionsFilter } from './filters/http-exception.filter';
import { config as envConfig } from '@medicore/config';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

function parseBoolStrict(name: string, defaultValue: string): boolean {
  const raw = (process.env[name] ?? defaultValue).toString().trim().toLowerCase();
  if (raw !== 'true' && raw !== 'false') {
    throw new Error(`Invalid ${name} value '${process.env[name]}'. Expected 'true' or 'false'.`);
  }
  return raw === 'true';
}

function validateCriticalSecurityEnv(): void {
  const env = (process.env.NODE_ENV || process.env.ENVIRONMENT || 'development').toLowerCase();
  const isDevLike = ['dev', 'development', 'local', 'test'].includes(env);

  const jwt = (process.env.JWT_SECRET || '').trim();
  const insecureJwtDefaults = new Set(['dev_secret_key_change_in_production', 'medicore-super-secret-key', 'ehr-super-secret-key']);
  if (!jwt) {
    throw new Error('JWT_SECRET is required for ehr-service startup.');
  }
  if (!isDevLike && insecureJwtDefaults.has(jwt)) {
    throw new Error('JWT_SECRET is using an insecure default in non-development environment.');
  }

  const requireServiceAuth = parseBoolStrict('CDSS_REQUIRE_SERVICE_AUTH', 'true');
  if (requireServiceAuth) {
    const authModeRaw = (process.env.CDSS_SERVICE_AUTH_MODE || 'both').trim().toLowerCase();
    const authMode: 'token' | 'jwt' | 'both' =
      authModeRaw === 'token' || authModeRaw === 'jwt' ? authModeRaw : 'both';
    const token = (process.env.CDSS_SERVICE_TOKEN || '').trim();
    const serviceJwtSecret = (process.env.CDSS_SERVICE_JWT_SECRET || '').trim();
    if ((authMode === 'token' || authMode === 'both') && !token) {
      throw new Error('CDSS_REQUIRE_SERVICE_AUTH=true but CDSS_SERVICE_TOKEN is missing.');
    }
    if ((authMode === 'jwt' || authMode === 'both') && !serviceJwtSecret) {
      throw new Error('CDSS_REQUIRE_SERVICE_AUTH=true but CDSS_SERVICE_JWT_SECRET is missing.');
    }
    if ((authMode === 'jwt' || authMode === 'both') && serviceJwtSecret.length < 24) {
      throw new Error('CDSS_SERVICE_JWT_SECRET must be at least 24 characters when JWT service auth is enabled.');
    }
    if (!isDevLike && (authMode === 'token' || authMode === 'both') && token === 'dev_cdss_service_token_change_in_production') {
      throw new Error('CDSS_SERVICE_TOKEN is using insecure default in non-development environment.');
    }
    if (!isDevLike && (authMode === 'jwt' || authMode === 'both') && serviceJwtSecret === 'dev_cdss_service_jwt_secret_change_in_production') {
      throw new Error('CDSS_SERVICE_JWT_SECRET is using insecure default in non-development environment.');
    }
  }
}

async function bootstrap() {
  validateCriticalSecurityEnv();
  const app = await NestFactory.create(EhrModule);
  app.use(compression());
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.text({ type: ['text/plain', 'application/hl7-v2'], limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    const existing = req.header('x-request-id') || req.header('X-Request-ID');
    const rid = existing && existing.length > 0 ? existing : randomUUID();
    (req as any).requestId = rid;
    res.setHeader('X-Request-ID', rid);
    next();
  });
  
  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Enable HIPAA audit logging globally for all PHI access
  // This ensures all patient data access is logged for compliance
  // Note: The interceptor will automatically detect PHI-related endpoints
  // and log access accordingly, while skipping non-PHI endpoints
  const hipaaAuditInterceptor = app.get(HipaaAuditInterceptor);
  app.useGlobalInterceptors(hipaaAuditInterceptor);

  // Enable global exception filter for detailed error logging
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable CORS from environment variables
  const corsOrigins = envConfig.security.corsOrigins;

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Tenant-Slug', 'x-session-id', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
  });

  app.setGlobalPrefix('api');

      // Swagger setup
      const config = new DocumentBuilder()
        .setTitle('MediCore EHR API')
        .setDescription('Complete Electronic Health Records system with FHIR/HL7 support')
        .setVersion('1.0')
        .addBearerAuth()
        .addApiKey({ type: 'apiKey', name: 'X-Tenant-ID', in: 'header' }, 'tenant-key')
        .addTag('Appointments', 'Appointment management and scheduling')
        .addTag('Patients', 'Patient management and demographics')
        .addTag('Users', 'User management and authentication')
        .addTag('Auth', 'Authentication and authorization')
        .build();
      const document = SwaggerModule.createDocument(app, config);

      // Ensure appointments endpoints are under the "Appointments" tag instead of "default"
      if (document && document.paths) {
        Object.keys(document.paths).forEach((pathKey) => {
          const isAppointmentPath = pathKey.startsWith('/appointments') || pathKey.startsWith('/api/appointments');
          if (!isAppointmentPath) return;
          const pathItem: any = (document.paths as any)[pathKey];
          ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].forEach((method) => {
            if (pathItem && pathItem[method]) {
              const op = pathItem[method];
              if (!op.tags || (Array.isArray(op.tags) && (op.tags.length === 0 || op.tags.includes('default')))) {
                op.tags = ['Appointments'];
              }
            }
          });
        });
      }

      SwaggerModule.setup('api/docs', app, document);
  
  const port = process.env.PORT || 3013;
  await app.listen(port);
  
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const host = process.env.HOST || 'localhost';
  
  console.log(`🏥 MediCore EHR Service running on port ${port}`);
  console.log(`📚 API Documentation: ${protocol}://${host}:${port}/api/docs`);
}

bootstrap();
