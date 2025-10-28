import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { PatientController } from './controllers/patient.controller';
import { AppointmentController } from './controllers/appointment.controller';

// Services
import { AuthService } from './services/auth.service';
import { PatientService } from './services/patient.service';
import { AppointmentService } from './services/appointment.service';
import { TenantSimpleService } from './services/tenant-simple.service';

// Strategies & Guards
import { JwtStrategy } from './strategies/jwt.strategy';
import { TenantMiddleware } from './middleware/tenant.middleware';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'ehr-super-secret-key',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [
    AuthController,
    PatientController,
    AppointmentController,
  ],
  providers: [
    AuthService,
    PatientService,
    AppointmentService,
    TenantSimpleService,
    JwtStrategy,
  ],
})
export class SimpleEhrModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}