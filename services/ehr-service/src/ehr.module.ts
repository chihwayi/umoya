import { Module, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Entities
import { User } from './entities/user.entity';
import { Patient } from './entities/patient.entity';
import { Appointment } from './entities/appointment.entity';
import { MedicalRecord } from './entities/medical-record.entity';
import { Prescription } from './entities/prescription.entity';
import { LabOrder } from './entities/lab-order.entity';
import { Bill } from './entities/billing.entity';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { PatientController } from './controllers/patient.controller';
import { AppointmentController } from './controllers/appointment.controller';
import { MedicalRecordController } from './controllers/medical-record.controller';
import { PrescriptionController } from './controllers/prescription.controller';
import { LabOrderController } from './controllers/lab-order.controller';
import { BillingController } from './controllers/billing.controller';
import { FhirController } from './controllers/fhir.controller';
import { Hl7Controller } from './controllers/hl7.controller';

// Services
import { AuthService } from './services/auth.service';
import { PatientService } from './services/patient.service';
import { AppointmentService } from './services/appointment.service';
import { MedicalRecordService } from './services/medical-record.service';
import { PrescriptionService } from './services/prescription.service';
import { LabOrderService } from './services/lab-order.service';
import { BillingService } from './services/billing.service';
import { FhirService } from './services/fhir.service';
import { Hl7Service } from './services/hl7.service';
import { TenantService } from './services/tenant.service';

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
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'medicore',
      password: process.env.DB_PASSWORD || 'medicore_password',
      database: process.env.DB_NAME || 'medicore_ehr',
      entities: [User, Patient, Appointment, MedicalRecord, Prescription, LabOrder, Bill],
      synchronize: true, // Only for development
    }),
    TypeOrmModule.forFeature([User, Patient, Appointment, MedicalRecord, Prescription, LabOrder, Bill]),
  ],
  controllers: [
    AuthController,
    PatientController,
    AppointmentController,
    MedicalRecordController,
    PrescriptionController,
    LabOrderController,
    BillingController,
    FhirController,
    Hl7Controller,
  ],
  providers: [
    AuthService,
    PatientService,
    AppointmentService,
    MedicalRecordService,
    PrescriptionService,
    LabOrderService,
    BillingService,
    FhirService,
    Hl7Service,
    TenantService,
    JwtStrategy,
  ],
})
export class EhrModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}