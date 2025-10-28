import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MockEhrModule } from './mock-ehr.module';

async function bootstrap() {
  const app = await NestFactory.create(MockEhrModule);
  
  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  });

  app.setGlobalPrefix('api');

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('MediCore EHR API (Mock)')
    .setDescription('Mock EHR service for testing')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Tenant-ID', in: 'header' }, 'tenant-key')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  const port = process.env.PORT || 3013;
  await app.listen(port);
  
  console.log(`🏥 MediCore EHR Service (Mock) running on port ${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();


