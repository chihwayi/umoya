import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Controllers
import { MockAuthController } from './controllers/mock-auth.controller';
import { MockPatientController } from './controllers/mock-patient.controller';
import { MockAppointmentController } from './controllers/mock-appointment.controller';

// Mock Services
import { MockAuthService } from './services/mock-auth.service';
import { MockPatientService } from './services/mock-patient.service';
import { MockAppointmentService } from './services/mock-appointment.service';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.trim().length === 0) {
  throw new Error('JWT_SECRET is required for ehr-service startup.');
}

@Module({
  imports: [
    ConfigModule.forRoot(),
    PassportModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [
    MockAuthController,
    MockPatientController,
    MockAppointmentController,
  ],
  providers: [
    MockAuthService,
    MockPatientService,
    MockAppointmentService,
    JwtStrategy,
  ],
})
export class MockEhrModule {}
