import './instrument';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TenantModule } from './tenant.module';
import { SentryFilter } from './filters/sentry.filter';

async function bootstrap() {
  const app = await NestFactory.create(TenantModule);
  
  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Enable Sentry Filter
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryFilter(httpAdapter));

  // Enable CORS for all origins in development
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3011', 'http://127.0.0.1:3000', 'http://127.0.0.1:3011'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'x-session-id'],
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