import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { TenantModule } from './tenant.module';

async function bootstrap() {
  const app = await NestFactory.create(TenantModule);
  
  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Enable CORS
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🏥 MediCore Tenant Service running on port ${port}`);
}

bootstrap();