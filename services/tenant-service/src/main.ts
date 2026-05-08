import './instrument';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TenantModule } from './tenant.module';
import { SentryFilter } from './filters/sentry.filter';
import { config as envConfig } from '@medicore/config';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

function validateCriticalSecurityEnv(): void {
  const env = (process.env.NODE_ENV || process.env.ENVIRONMENT || 'development').toLowerCase();
  const isDevLike = ['dev', 'development', 'local', 'test'].includes(env);

  const jwt = (process.env.JWT_SECRET || '').trim();
  const insecureJwtDefaults = new Set(['dev_secret_key_change_in_production', 'medicore-super-secret-key', 'ehr-super-secret-key']);

  if (!jwt) {
    throw new Error('JWT_SECRET is required for tenant-service startup.');
  }
  if (!isDevLike && insecureJwtDefaults.has(jwt)) {
    throw new Error('JWT_SECRET is using an insecure default in non-development environment.');
  }
}

async function bootstrap() {
  validateCriticalSecurityEnv();
  const app = await NestFactory.create(TenantModule, { rawBody: true });
  
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

  // Enable Sentry Filter
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryFilter(httpAdapter));

  // Enable CORS from environment variables
  const corsOrigins = envConfig.security.corsOrigins;
  
  app.enableCors({
    origin:
      corsOrigins.length > 0
        ? corsOrigins
        : process.env.NODE_ENV === 'development'
          ? true
          : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'x-session-id', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
  });

  app.setGlobalPrefix('api');

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('MediCore Tenant Management API')
    .setDescription('Complete tenant management system for MediCore eHR platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log(`🏥 MediCore Tenant Service running on port ${port}`);
}

bootstrap();
