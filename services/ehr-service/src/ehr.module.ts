import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { PatientController } from './controllers/patient.controller';
import { PatientHistoryController } from './controllers/patient-history.controller';
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
import { VitalsController } from './controllers/vitals.controller';
import { TriageController } from './controllers/triage.controller';
import { NursingNotesController } from './controllers/nursing-notes.controller';
import { OrderController } from './controllers/order.controller';
import { ProblemController } from './controllers/problem.controller';
import { AllergyController } from './controllers/allergy.controller';
import { LabTestController } from './controllers/lab-test.controller';
import { LabTestCatalogController } from './controllers/lab-test-catalog.controller';
import { LabOrderSetController } from './controllers/lab-order-set.controller';
import { LabOrderSetEnhancedController } from './controllers/lab-order-set-enhanced.controller';
import { LabCriticalAlertController } from './controllers/lab-critical-alert.controller';
import { CriticalAlertController } from './controllers/critical-alert.controller';
import { DrugController } from './controllers/drug.controller';
import { HivController } from './controllers/hiv.controller';
import { ImagingController } from './controllers/imaging.controller';
import { MaternityController } from './controllers/maternity.controller';
import { OncologyController } from './controllers/oncology.controller';
import { OphthalmologyController } from './controllers/ophthalmology.controller';
import { FinanceController } from './controllers/finance.controller';
import { CardiologyController } from './controllers/cardiology.controller';
import { TerminologyController } from './controllers/terminology.controller';
import { MetricsController } from './controllers/metrics.controller';
import { MedicationHistoryController } from './controllers/medication-history.controller';
import { PrescriptionTemplateController } from './controllers/prescription-template.controller';
import { WaitlistController } from './controllers/waitlist.controller';
import { DiabetesController } from './controllers/diabetes.controller';
import { CcdaController } from './controllers/ccda.controller';
import { HipaaAuditController } from './controllers/hipaa-audit.controller';
import { QualityMeasuresController } from './controllers/quality-measures.controller';
import { PharmacyController } from './controllers/pharmacy.controller';
import { DoctorAvailabilityController } from './controllers/doctor-availability.controller';
import { TelemedicineController } from './controllers/telemedicine.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { AppointmentResourceController } from './controllers/appointment-resource.controller';
import { ClinicalTemplateController } from './controllers/clinical-template.controller';
import { PatientPortalController } from './controllers/patient-portal.controller';

// Services
import { AuthService } from './services/auth.service';
import { PatientService } from './services/patient.service';
import { PatientHistoryService } from './services/patient-history.service';
import { AppointmentService } from './services/appointment.service';
import { MedicalRecordService } from './services/medical-record.service';
import { PrescriptionService } from './services/prescription.service';
import { PrescriptionPdfService } from './services/prescription-pdf.service';
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
import { VitalsService } from './services/vitals.service';
import { TriageService } from './services/triage.service';
import { NursingNotesService } from './services/nursing-notes.service';
import { OrderService } from './services/order.service';
import { ProblemService } from './services/problem.service';
import { AllergyService } from './services/allergy.service';
import { LabTestService } from './services/lab-test.service';
import { LabTestCatalogService } from './services/lab-test-catalog.service';
import { LabOrderSetService } from './services/lab-order-set.service';
import { LabOrderSetEnhancedService } from './services/lab-order-set-enhanced.service';
import { LabCriticalAlertService } from './services/lab-critical-alert.service';
import { CriticalAlertService } from './services/critical-alert.service';
import { DrugService } from './services/drug.service';
import { HivService } from './services/hiv.service';
import { LabResultsMatchingService } from './services/lab-results-matching.service';
import { HivMonitoringService } from './services/hiv-monitoring.service';
import { HivQualityMetricsService } from './services/hiv-quality-metrics.service';
import { HivVisitTemplatesService } from './services/hiv-visit-templates.service';
import { HivTptTrackerService } from './services/hiv-tpt-tracker.service';
import { HivPediatricDosingService } from './services/hiv-pediatric-dosing.service';
import { HivMonthlyReturnService } from './services/hiv-monthly-return.service';
import { ImagingService } from './services/imaging.service';
import { StorageService } from './services/storage.service';
import { MaternityService } from './services/maternity.service';
import { OncologyService } from './services/oncology.service';
import { OphthalmologyService } from './services/ophthalmology.service';
import { FinanceService } from './services/finance.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { InvoiceTemplateService } from './services/invoice-template.service';
import { CardiologyService } from './services/cardiology.service';
import { TerminologyService } from './services/terminology.service';
import { CdssHookService } from './services/cdss-hook.service';
import { SpecialtyAutomationService } from './services/specialty-automation.service';
import { MetricsService } from './services/metrics.service';
import { MedicationHistoryService } from './services/medication-history.service';
import { PrescriptionTemplateService } from './services/prescription-template.service';
import { WaitlistService } from './services/waitlist.service';
import { DiabetesService } from './services/diabetes.service';
import { DiabetesCdsService } from './services/diabetes-cds.service';
import { DiabetesDeviceIntegrationService } from './services/diabetes-device-integration.service';
import { CcdaService } from './services/ccda.service';
import { HipaaAuditService } from './services/hipaa-audit.service';
import { PharmacyService } from './services/pharmacy.service';
import { DoctorAvailabilityService } from './services/doctor-availability.service';
import { TelemedicineService } from './services/telemedicine.service';
import { TelemedicineVideoService } from './services/telemedicine-video.service';
import { RemoteMonitoringService } from './services/remote-monitoring.service';
import { TelemedicineConsentService } from './services/telemedicine-consent.service';
import { DigitalPrescriptionService } from './services/digital-prescription.service';
import { ReportBuilderService } from './services/report-builder.service';
import { ScheduledReportsService } from './services/scheduled-reports.service';
import { ClinicalOutcomesService } from './services/clinical-outcomes.service';
import { AnalyticsService } from './services/analytics.service';
import { ReportExportService } from './services/report-export.service';
import { EmailService } from './services/email.service';
import { FileStorageService } from './services/file-storage.service';
import { AppointmentResourceService } from './services/appointment-resource.service';
import { ClinicalTemplateService } from './services/clinical-template.service';
import { PatientAuthService } from './services/patient-auth.service';
import { PatientPortalService } from './services/patient-portal.service';
import { PatientMessagingService } from './services/patient-messaging.service';
import { PatientNotificationsService } from './services/patient-notifications.service';
import { PatientPortalAppointmentService } from './services/patient-portal-appointment.service';
import { PatientVitalsSubmissionService } from './services/patient-vitals-submission.service';
import { HipaaAuditInterceptor } from './interceptors/hipaa-audit.interceptor';
import { MinimumNecessaryInterceptor } from './interceptors/minimum-necessary.interceptor';
import { MinimumNecessaryGuard } from './guards/minimum-necessary.guard';
import { QualityMeasuresService } from './services/quality-measures.service';

// Strategies & Guards
import { JwtStrategy } from './strategies/jwt.strategy';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'ehr-super-secret-key',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [
    AuthController,
    PatientController,
    PatientHistoryController,
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
    VitalsController,
    TriageController,
    NursingNotesController,
    OrderController,
    ProblemController,
    AllergyController,
    LabTestController,
    LabTestCatalogController,
    LabOrderSetController,
    LabOrderSetEnhancedController,
    LabCriticalAlertController,
    CriticalAlertController,
    DrugController,
    HivController,
    ImagingController,
    MaternityController,
    OncologyController,
    OphthalmologyController,
    CardiologyController,
    FinanceController,
    TerminologyController,
    MetricsController,
    MedicationHistoryController,
    PrescriptionTemplateController,
    WaitlistController,
    DiabetesController,
    CcdaController,
    HipaaAuditController,
    QualityMeasuresController,
    PharmacyController,
    DoctorAvailabilityController,
    TelemedicineController,
    AnalyticsController,
    AppointmentResourceController,
    ClinicalTemplateController,
    PatientPortalController,
  ],
  providers: [
    AuthService,
    PatientService,
    PatientHistoryService,
    AppointmentService,
    MedicalRecordService,
    PrescriptionService,
    PrescriptionPdfService,
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
    VitalsService,
    TriageService,
    NursingNotesService,
    OrderService,
    ProblemService,
    AllergyService,
    LabTestService,
    LabTestCatalogService,
    LabOrderSetService,
    LabOrderSetEnhancedService,
    LabCriticalAlertService,
    CriticalAlertService,
    DrugService,
    HivService,
    LabResultsMatchingService,
    HivMonitoringService,
    HivQualityMetricsService,
    HivVisitTemplatesService,
    HivTptTrackerService,
    HivPediatricDosingService,
    HivMonthlyReturnService,
    ImagingService,
    StorageService,
    MaternityService,
    OncologyService,
    OphthalmologyService,
    CardiologyService,
    FinanceService,
    InvoicePdfService,
    InvoiceTemplateService,
    TerminologyService,
    CdssHookService,
    SpecialtyAutomationService,
    MetricsService,
    MedicationHistoryService,
    PrescriptionTemplateService,
    WaitlistService,
    DiabetesService,
    DiabetesCdsService,
    DiabetesDeviceIntegrationService,
    CcdaService,
    HipaaAuditService,
    HipaaAuditInterceptor,
    MinimumNecessaryInterceptor,
    MinimumNecessaryGuard,
    QualityMeasuresService,
    PharmacyService,
    DoctorAvailabilityService,
    TelemedicineService,
    TelemedicineVideoService,
    RemoteMonitoringService,
    TelemedicineConsentService,
    DigitalPrescriptionService,
    ReportBuilderService,
    ScheduledReportsService,
    ClinicalOutcomesService,
    AnalyticsService,
    ReportExportService,
    EmailService,
    FileStorageService,
    AppointmentResourceService,
    ClinicalTemplateService,
    PatientAuthService,
    PatientPortalService,
    PatientMessagingService,
    PatientNotificationsService,
    PatientPortalAppointmentService,
    PatientVitalsSubmissionService,
    RolesGuard,
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