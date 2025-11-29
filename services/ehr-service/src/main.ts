import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { EhrModule } from './ehr.module';

async function bootstrap() {
  const app = await NestFactory.create(EhrModule);
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
  
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Tenant-Slug'],
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
  
  console.log(`🏥 MediCore EHR Service running on port ${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();