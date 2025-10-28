import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

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
import { ClaimsController } from './controllers/claims.controller';
import { CdssController } from './controllers/cdss.controller';
import { Dhis2Controller } from './controllers/dhis2.controller';
import { ReportsController } from './controllers/reports.controller';
import { NotificationsController } from './controllers/notifications.controller';
import { PaymentsController } from './controllers/payments.controller';
import { UsersController } from './controllers/users.controller';

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
import { ClaimsService } from './services/claims.service';
import { CdssService } from './services/cdss.service';
import { Dhis2Service } from './services/dhis2.service';
import { ReportsService } from './services/reports.service';
import { NotificationsService } from './services/notifications.service';
import { PaymentsService } from './services/payments.service';
import { UsersService } from './services/users.service';

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
    MedicalRecordController,
    PrescriptionController,
    LabOrderController,
    BillingController,
    FhirController,
    Hl7Controller,
    ClaimsController,
    CdssController,
    Dhis2Controller,
    ReportsController,
    NotificationsController,
    PaymentsController,
    UsersController,
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
    ClaimsService,
    CdssService,
    Dhis2Service,
    ReportsService,
    NotificationsService,
    PaymentsService,
    UsersService,
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