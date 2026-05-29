import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SimpleEhrModule } from './simple-ehr.module';

async function bootstrap() {
  const app = await NestFactory.create(SimpleEhrModule);
  
  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3013;
  await app.listen(port);
  
  console.log(`🏥 Umoya EHR Service (Simple) running on port ${port}`);
  const host = process.env.HOST || 'localhost';
  console.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
}

bootstrap().catch(console.error);