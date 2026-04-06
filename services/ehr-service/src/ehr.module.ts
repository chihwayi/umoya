import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { MulterModule } from '@nestjs/platform-express';

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
import { CdssDecisionLogController } from './controllers/cdss-decision-log.controller';
import { NurseTaskController } from './controllers/nurse-task.controller';
import { AmbientController } from './controllers/ambient.controller';
import { EncounterPrechartController } from './controllers/encounter-prechart.controller';
import { InboxController } from './controllers/inbox.controller';
import { TbController } from './controllers/tb.controller';
import { PediatricsController } from './controllers/pediatrics.controller';
import { MentalHealthController } from './controllers/mental-health.controller';
import { MalariaController } from './controllers/malaria.controller';
import { GeriatricsController } from './controllers/geriatrics.controller';
import { NeurologyController } from './controllers/neurology.controller';
import { PulmonologyController } from './controllers/pulmonology.controller';
import { NephrologyController } from './controllers/nephrology.controller';
import { DermatologyController } from './controllers/dermatology.controller';
import { PalliativeController } from './controllers/palliative.controller';
import { NutritionController } from './controllers/nutrition.controller';
import { IcuController } from './controllers/icu.controller';
import { SdohController } from './controllers/sdoh.controller';
import { NtdController } from './controllers/ntd.controller';
import { PmtctController } from './controllers/pmtct.controller';
import { PepfarMerController } from './controllers/pepfar-mer.controller';
import { Dhis2Controller } from './controllers/dhis2.controller';
import { ReportsController } from './controllers/reports.controller';
import { NotificationsController } from './controllers/notifications.controller';
import { PaymentsController } from './controllers/payments.controller';
import { UsersController } from './controllers/users.controller';
import { StaffController } from './controllers/staff.controller';
import { GovernedController } from './controllers/governed.controller';
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
import { FinancialReportsController } from './controllers/financial-reports.controller';
import { TaxManagementController } from './controllers/tax-management.controller';
import { PaymentReconciliationController } from './controllers/payment-reconciliation.controller';
import { CardiologyController } from './controllers/cardiology.controller';
import { TerminologyController } from './controllers/terminology.controller';
import { Icd10Controller } from './controllers/icd10.controller';
import { MetricsController } from './controllers/metrics.controller';
import { MedicationHistoryController } from './controllers/medication-history.controller';
import { PrescriptionTemplateController } from './controllers/prescription-template.controller';
import { WaitlistController } from './controllers/waitlist.controller';
import { DiabetesController } from './controllers/diabetes.controller';
import { CcdaController } from './controllers/ccda.controller';
import { HipaaAuditController } from './controllers/hipaa-audit.controller';
import { AdminAuditController } from './controllers/admin-audit.controller';
import { QualityMeasuresController } from './controllers/quality-measures.controller';
import { PharmacyController } from './controllers/pharmacy.controller';
import { KnowledgeController } from './controllers/knowledge.controller';
import { ClaimsAiController } from './controllers/claims-ai.controller';
import { DoctorAvailabilityController } from './controllers/doctor-availability.controller';
import { TelemedicineController } from './controllers/telemedicine.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { AppointmentResourceController } from './controllers/appointment-resource.controller';
import { ClinicalTemplateController } from './controllers/clinical-template.controller';
import { PatientPortalController } from './controllers/patient-portal.controller';
import { PatientProController } from './controllers/patient-pro.controller';
import { MedicalAidApiController } from './controllers/medical-aid-api.controller';
import { TenantsController } from './controllers/tenants.controller';
import { WorkflowController } from './controllers/workflow.controller';
import { CarePlanController } from './controllers/care-plan.controller';
import { ReferralController } from './controllers/referral.controller';
import { DocumentController } from './controllers/document.controller';
import { ProviderMessagingController } from './controllers/provider-messaging.controller';
import { ConsentController } from './controllers/consent.controller';
import { ImmunizationController } from './controllers/immunization.controller';
import { BedManagementController } from './controllers/bed-management.controller';
import { EDController } from './controllers/ed.controller';
import { ClinicalPathwayController } from './controllers/clinical-pathway.controller';
import { OperatingRoomController } from './controllers/operating-room.controller';
import { AnesthesiaController } from './controllers/anesthesia.controller';
import { BcmaController } from './controllers/bcma.controller';
import { BloodBankController } from './controllers/blood-bank.controller';
import { InfectionControlController } from './controllers/infection-control.controller';
import { RevenueCycleController } from './controllers/revenue-cycle.controller';
import { CdiController } from './controllers/cdi.controller';
import { CaseManagementController } from './controllers/case-management.controller';
import { SepsisController } from './controllers/sepsis.controller';
import { DietaryController } from './controllers/dietary.controller';
import { TranscriptionController } from './controllers/transcription.controller';
import { WhoSmartGuidelinesController } from './controllers/who-smart-guidelines.controller';
import { DiagnosticController } from './controllers/diagnostic.controller';
import { NurseWorklistController } from './controllers/nurse-worklist.controller';
import { PostVisitController } from './controllers/post-visit.controller';
import { PopulationHealthController } from './controllers/population-health.controller';
import { PracticeManagementController } from './controllers/practice-management.controller';
import { PriorAuthorizationController } from './controllers/prior-authorization.controller';
import { NotificationCampaignController } from './controllers/notification-campaign.controller';
import { TravelVaccineController } from './controllers/travel-vaccine.controller';
import { CurrencyExchangeController } from './controllers/currency-exchange.controller';
import { MedicalAidIntegrationController } from './controllers/medical-aid-integration.controller';
import { EarlyWarningController } from './controllers/early-warning.controller';
import { MedicationSafetyController } from './controllers/medication-safety.controller';
import { EncounterCodingController } from './controllers/encounter-coding.controller';
import { SchedulingIntelligenceController } from './controllers/scheduling-intelligence.controller';
import { MlAdminController } from './controllers/ml-admin.controller';
import { AutoCodingController } from './controllers/auto-coding.controller';
import { PgxController } from './controllers/pgx.controller';
import { AntibiogramController } from './controllers/antibiogram.controller';
import { AiExplainabilityController } from './controllers/ai-explainability.controller';
import { StreamingDiagnosisController } from './controllers/streaming-diagnosis.controller';
import { SmartSchedulingController } from './controllers/smart-scheduling.controller';
import { SmartDefaultsController } from './controllers/smart-defaults.controller';
import { EncounterCopilotController } from './controllers/encounter-copilot.controller';
import { FormularyOptimizationController } from './controllers/formulary-optimization.controller';
import { PredictiveRiskController } from './controllers/predictive-risk.controller';
import { FederatedLearningController } from './controllers/federated-learning.controller';
import { HimisReportingController } from './controllers/himis-reporting.controller';
import { FhirInboundController } from './controllers/fhir-inbound.controller';
import { MultilingualEducationController } from './controllers/multilingual-education.controller';
import { OfflineSyncController } from './controllers/offline-sync.controller';
import { IotController } from './controllers/iot.controller';
import { RadiologyAiController } from './controllers/radiology-ai.controller';
import { AlertDeliveryController } from './controllers/alert-delivery.controller';
import { ModelMonitoringController } from './controllers/model-monitoring.controller';
import { PatientAiController } from './controllers/patient-ai.controller';
import { ClinicalTrialMatchingController } from './controllers/clinical-trial-matching.controller';
import { SupplyChainAiController } from './controllers/supply-chain-ai.controller';
import { ModelRegistryController } from './controllers/model-registry.controller';
import { StaffNotificationsController } from './controllers/staff-notifications.controller';
import { RegistrationIntelligenceController } from './controllers/registration-intelligence.controller';

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
import { CdssDecisionLogService } from './services/cdss-decision-log.service';
import { CdssOutcomeBatchService } from './services/cdss-outcome-batch.service';
import { NurseTaskService } from './services/nurse-task.service';
import { CareGapSchedulerService } from './services/care-gap-scheduler.service';
import { AmbientService } from './services/ambient.service';
import { AmbientGateway } from './gateways/ambient.gateway';
import { AppointmentPrecharterService } from './services/appointment-precharter.service';
import { InboxTriageService } from './services/inbox-triage.service';
import { InboxGateway } from './gateways/inbox.gateway';
import { TbService } from './services/tb.service';
import { PediatricsService } from './services/pediatrics.service';
import { MentalHealthService } from './services/mental-health.service';
import { MalariaService } from './services/malaria.service';
import { GeriatricsService } from './services/geriatrics.service';
import { NeurologyService } from './services/neurology.service';
import { PulmonologyService } from './services/pulmonology.service';
import { NephrologyService } from './services/nephrology.service';
import { DermatologyService } from './services/dermatology.service';
import { PalliativeService } from './services/palliative.service';
import { NutritionService } from './services/nutrition.service';
import { IcuService } from './services/icu.service';
import { SdohService } from './services/sdoh.service';
import { NtdService } from './services/ntd.service';
import { PmtctService } from './services/pmtct.service';
import { Dhis2Service } from './services/dhis2.service';
import { Dhis2SchedulerService } from './services/dhis2-scheduler.service';
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
import { FinancialReportsService } from './services/financial-reports.service';
import { TaxManagementService } from './services/tax-management.service';
import { PaymentReconciliationService } from './services/payment-reconciliation.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { InvoiceTemplateService } from './services/invoice-template.service';
import { CardiologyService } from './services/cardiology.service';
import { TerminologyService } from './services/terminology.service';
import { TerminologyImportService } from './services/terminology-import.service';
import { Icd10Service } from './services/icd10.service';
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
import { FhirValidatorService } from './fhir/validators/fhir-validator.service';
import { PharmacyService } from './services/pharmacy.service';
import { PharmacyIntelligenceService } from './services/pharmacy-intelligence.service';
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
import { PatientPortalH3Service } from './services/patient-portal-h3.service';
import { PatientMessagingService } from './services/patient-messaging.service';
import { PatientNotificationsService } from './services/patient-notifications.service';
import { PatientPortalAppointmentService } from './services/patient-portal-appointment.service';
import { PatientVitalsSubmissionService } from './services/patient-vitals-submission.service';
import { MedicationReminderService } from './services/medication-reminder.service';
import { HealthRecordsExportService } from './services/health-records-export.service';
import { PatientProService } from './services/patient-pro.service';
import { ProSchedulingService } from './services/pro-scheduling.service';
import { HealthGoalsService } from './services/health-goals.service';
import { MedicalAidApiService } from './services/medical-aid-api.service';
import { ClinicalWorkflowService } from './services/clinical-workflow.service';
import { CarePlanService } from './services/care-plan.service';
import { CarePlanTemplateService } from './services/care-plan-template.service';
import { ReferralService } from './services/referral.service';
import { ReferralTemplateService } from './services/referral-template.service';
import { ReferralFacilityService } from './services/referral-facility.service';
import { DocumentService } from './services/document.service';
import { MinioService } from './services/minio.service';
import { ProviderMessagingService } from './services/provider-messaging.service';
import { MessageTemplateService } from './services/message-template.service';
import { ConsentTemplateService } from './services/consent-template.service';
import { PatientConsentService } from './services/patient-consent.service';
import { ImmunizationService } from './services/immunization.service';
import { BedManagementService } from './services/bed-management.service';
import { ADTService } from './services/adt.service';
import { EDService } from './services/ed.service';
import { ClinicalPathwayService } from './services/clinical-pathway.service';
import { OperatingRoomService } from './services/operating-room.service';
import { AnesthesiaService } from './services/anesthesia.service';
import { BcmaService } from './services/bcma.service';
import { BloodBankService } from './services/blood-bank.service';
import { InfectionControlService } from './services/infection-control.service';
import { RevenueCycleService } from './services/revenue-cycle.service';
import { CdiService } from './services/cdi.service';
import { CaseManagementService } from './services/case-management.service';
import { SepsisService } from './services/sepsis.service';
import { DietaryService } from './services/dietary.service';
import { TranscriptionService } from './services/transcription.service';
import { UploadSecurityService } from './services/upload-security.service';
import { WhoSmartGuidelinesService } from './services/who-smart-guidelines.service';
import { HipaaAuditInterceptor } from './interceptors/hipaa-audit.interceptor';
import { MinimumNecessaryInterceptor } from './interceptors/minimum-necessary.interceptor';
import { MinimumNecessaryGuard } from './guards/minimum-necessary.guard';
import { QualityMeasuresService } from './services/quality-measures.service';
import { NurseWorklistService } from './services/nurse-worklist.service';
import { PostVisitService } from './services/post-visit.service';
import { PostVisitGroundedLlmService } from './services/post-visit-grounded-llm.service';
import { PostVisitEscalationService } from './services/post-visit-escalation.service';
import { PostVisitBillingIntelligenceService } from './services/post-visit-billing-intelligence.service';
import { PostVisitCompanionMemoryService } from './services/post-visit-companion-memory.service';
import { PostVisitSessionService } from './services/post-visit-session.service';
import { PostVisitDraftService } from './services/post-visit-draft.service';
import { PopulationHealthService } from './services/population-health.service';
import { PracticeManagementService } from './services/practice-management.service';
import { PriorAuthorizationService } from './services/prior-authorization.service';
import { NotificationCampaignService } from './services/notification-campaign.service';
import { TravelVaccineService } from './services/travel-vaccine.service';
import { CurrencyExchangeService } from './services/currency-exchange.service';
import { MedicalAidIntegrationService } from './services/medical-aid-integration.service';
import { EarlyWarningService } from './services/early-warning.service';
import { MedicationSafetyService } from './services/medication-safety.service';
import { EncounterCodingService } from './services/encounter-coding.service';
import { SchedulingIntelligenceService } from './services/scheduling-intelligence.service';
import { MlFeedbackService } from './services/ml-feedback.service';
import { MlModelsService } from './services/ml-models.service';
import { MedicalNlpService } from './services/medical-nlp.service';
import { TemplateFallbackService } from './services/template-fallback.service';
import { AutoCodingService } from './services/auto-coding.service';
import { PgxService } from './services/pgx.service';
import { AntibiogramService } from './services/antibiogram.service';
import { AiExplainabilityService } from './services/ai-explainability.service';
import { StreamingDiagnosisService } from './services/streaming-diagnosis.service';
import { SmartSchedulingService } from './services/smart-scheduling.service';
import { SmartDefaultsService } from './services/smart-defaults.service';
import { EncounterCopilotService } from './services/encounter-copilot.service';
import { FormularyOptimizationService } from './services/formulary-optimization.service';
import { PredictiveRiskService } from './services/predictive-risk.service';
import { FederatedLearningService } from './services/federated-learning.service';
import { HimisReportingService } from './services/himis-reporting.service';
import { FhirInboundService } from './services/fhir-inbound.service';
import { MultilingualEducationService } from './services/multilingual-education.service';
import { OfflineSyncService } from './services/offline-sync.service';
import { IotService } from './services/iot.service';
import { RadiologyAiService } from './services/radiology-ai.service';
import { AlertDeliveryService } from './services/alert-delivery.service';
import { ModelMonitoringService } from './services/model-monitoring.service';
import { PatientAiService } from './services/patient-ai.service';
import { ClinicalTrialMatchingService } from './services/clinical-trial-matching.service';
import { SupplyChainAiService } from './services/supply-chain-ai.service';
import { CriticalAlertGateway } from './gateways/critical-alert.gateway';
import { TelemedicineGateway } from './gateways/telemedicine.gateway';
import { ModelRegistryService } from './services/model-registry.service';
import { TelemedicinePostVisitBridgeService } from './services/telemedicine-postvisit-bridge.service';
import { StaffNotificationsService } from './services/staff-notifications.service';
import { RegistrationIntelligenceService } from './services/registration-intelligence.service';
import { KnowledgeIngestService } from './services/knowledge-ingest.service';
import { ClaimsAiService } from './services/claims-ai.service';
import { RiskStratificationService } from './services/risk-stratification.service';
import { OutcomeCollectionService } from './services/outcome-collection.service';
import { RegistrationAiService } from './services/registration-ai.service';
import { RegistrationAiController } from './controllers/registration-ai.controller';
import { ProactiveAiService } from './services/proactive-ai.service';
import { AiSurfaceContractService } from './services/ai-surface-contract.service';
import { PatientIntelligenceService } from './services/patient-intelligence.service';
import { DicomController } from './controllers/dicom.controller';
import { ProactiveAiController } from './controllers/proactive-ai.controller';
import { VoiceTranscriptionGateway } from './gateways/voice-transcription.gateway';

// Strategies & Guards
import { JwtStrategy } from './strategies/jwt.strategy';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { RolesGuard } from './guards/roles.guard';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.trim().length === 0) {
  throw new Error('JWT_SECRET is required for ehr-service startup.');
}

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    PassportModule,
    MulterModule.register({
      dest: './uploads',
    }),
    JwtModule.register({
      secret: jwtSecret,
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
    CdssDecisionLogController,
    NurseTaskController,
    AmbientController,
    EncounterPrechartController,
    InboxController,
    TbController,
    PediatricsController,
    MentalHealthController,
    MalariaController,
    GeriatricsController,
    NeurologyController,
    PulmonologyController,
    NephrologyController,
    DermatologyController,
    PalliativeController,
    NutritionController,
    IcuController,
    SdohController,
    NtdController,
    PmtctController,
    PepfarMerController,
    Dhis2Controller,
    ReportsController,
    NotificationsController,
    PaymentsController,
    UsersController,
    StaffController,
    GovernedController,
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
    FinancialReportsController,
    TaxManagementController,
    PaymentReconciliationController,
    TerminologyController,
    Icd10Controller,
    MetricsController,
    MedicationHistoryController,
    PrescriptionTemplateController,
    WaitlistController,
    DiabetesController,
    CcdaController,
    HipaaAuditController,
    AdminAuditController,
    QualityMeasuresController,
    PharmacyController,
    DoctorAvailabilityController,
    TelemedicineController,
    AnalyticsController,
    AppointmentResourceController,
    ClinicalTemplateController,
    PatientPortalController,
    PatientProController,
    MedicalAidApiController,
    TenantsController,
    WorkflowController,
    CarePlanController,
    ReferralController,
    DocumentController,
    ProviderMessagingController,
    ConsentController,
    ImmunizationController,
    BedManagementController,
    EDController,
    ClinicalPathwayController,
    OperatingRoomController,
    AnesthesiaController,
    BcmaController,
    BloodBankController,
    InfectionControlController,
    RevenueCycleController,
    CdiController,
    CaseManagementController,
    SepsisController,
    DietaryController,
    TranscriptionController,
    WhoSmartGuidelinesController,
    DiagnosticController,
    NurseWorklistController,
    PostVisitController,
    PopulationHealthController,
    PracticeManagementController,
    PriorAuthorizationController,
    NotificationCampaignController,
    TravelVaccineController,
    CurrencyExchangeController,
    MedicalAidIntegrationController,
    EarlyWarningController,
    MedicationSafetyController,
    EncounterCodingController,
    SchedulingIntelligenceController,
    MlAdminController,
    AutoCodingController,
    PgxController,
    AntibiogramController,
    AiExplainabilityController,
    StreamingDiagnosisController,
    SmartSchedulingController,
    SmartDefaultsController,
    EncounterCopilotController,
    FormularyOptimizationController,
    PredictiveRiskController,
    FederatedLearningController,
    HimisReportingController,
    FhirInboundController,
    MultilingualEducationController,
    OfflineSyncController,
    IotController,
    RadiologyAiController,
    AlertDeliveryController,
    ModelMonitoringController,
    PatientAiController,
    ClinicalTrialMatchingController,
    SupplyChainAiController,
    ModelRegistryController,
    StaffNotificationsController,
    RegistrationIntelligenceController,
    KnowledgeController,
    ClaimsAiController,
    RegistrationAiController,
    DicomController,
    ProactiveAiController,
  ],
  providers: [
    AuthService,
    PatientService,
    AiSurfaceContractService,
    PatientIntelligenceService,
    PatientHistoryService,
    AppointmentService,
    MedicalRecordService,
    PrescriptionService,
    PrescriptionPdfService,
    LabOrderService,
    BillingService,
    FhirService,
    FhirValidatorService,
    Hl7Service,
    TenantService,
    ClaimsService,
    CdssService,
    Dhis2Service,
    Dhis2SchedulerService,
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
    FinancialReportsService,
    TaxManagementService,
    PaymentReconciliationService,
    InvoicePdfService,
    InvoiceTemplateService,
    TerminologyService,
    TerminologyImportService,
    Icd10Service,
    CdssHookService,
    CdssDecisionLogService,
    CdssOutcomeBatchService,
    NurseTaskService,
    CareGapSchedulerService,
    AmbientService,
    AmbientGateway,
    AppointmentPrecharterService,
    InboxTriageService,
    InboxGateway,
    TbService,
    PediatricsService,
    MentalHealthService,
    MalariaService,
    GeriatricsService,
    NeurologyService,
    PulmonologyService,
    NephrologyService,
    DermatologyService,
    PalliativeService,
    NutritionService,
    IcuService,
    SdohService,
    NtdService,
    PmtctService,
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
    PharmacyIntelligenceService,
    DoctorAvailabilityService,
    TelemedicineService,
    TelemedicineVideoService,
    TelemedicineGateway,
    TelemedicinePostVisitBridgeService,
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
    PatientPortalH3Service,
    PatientMessagingService,
    PatientNotificationsService,
    PatientPortalAppointmentService,
    PatientVitalsSubmissionService,
    MedicationReminderService,
    HealthRecordsExportService,
    PatientProService,
    ProSchedulingService,
    HealthGoalsService,
    MedicalAidApiService,
    ClinicalWorkflowService,
    CarePlanService,
    CarePlanTemplateService,
    ReferralService,
    ReferralTemplateService,
    ReferralFacilityService,
    DocumentService,
    MinioService,
    ProviderMessagingService,
    MessageTemplateService,
    ConsentTemplateService,
    PatientConsentService,
    ImmunizationService,
    BedManagementService,
    ADTService,
    EDService,
    ClinicalPathwayService,
    OperatingRoomService,
    AnesthesiaService,
    BcmaService,
    BloodBankService,
    InfectionControlService,
    RevenueCycleService,
    CdiService,
    CaseManagementService,
    SepsisService,
    DietaryService,
    TranscriptionService,
    UploadSecurityService,
    WhoSmartGuidelinesService,
    NurseWorklistService,
    PostVisitGroundedLlmService,
    PostVisitService,
    PostVisitEscalationService,
    PostVisitBillingIntelligenceService,
    PostVisitCompanionMemoryService,
    PostVisitSessionService,
    PostVisitDraftService,
    PopulationHealthService,
    PracticeManagementService,
    PriorAuthorizationService,
    NotificationCampaignService,
    TravelVaccineService,
    CurrencyExchangeService,
    MedicalAidIntegrationService,
    EarlyWarningService,
    MedicationSafetyService,
    EncounterCodingService,
    SchedulingIntelligenceService,
    MlFeedbackService,
    MlModelsService,
    MedicalNlpService,
    TemplateFallbackService,
    AutoCodingService,
    PgxService,
    AntibiogramService,
    AiExplainabilityService,
    StreamingDiagnosisService,
    SmartSchedulingService,
    SmartDefaultsService,
    EncounterCopilotService,
    FormularyOptimizationService,
    PredictiveRiskService,
    FederatedLearningService,
    HimisReportingService,
    FhirInboundService,
    MultilingualEducationService,
    OfflineSyncService,
    IotService,
    RadiologyAiService,
    AlertDeliveryService,
    ModelMonitoringService,
    PatientAiService,
    ClinicalTrialMatchingService,
    SupplyChainAiService,
    ModelRegistryService,
    StaffNotificationsService,
    RegistrationIntelligenceService,
    KnowledgeIngestService,
    ClaimsAiService,
    RiskStratificationService,
    OutcomeCollectionService,
    RegistrationAiService,
    ProactiveAiService,
    CriticalAlertGateway,
    VoiceTranscriptionGateway,
    RolesGuard,
    JwtStrategy,
  ],
})
export class EhrModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'tenants/active', method: RequestMethod.ALL }, // Public endpoint - all methods
        { path: 'terminology/import/(.*)', method: RequestMethod.ALL }, // Terminology import endpoints
      )
      .forRoutes('*');
  }
}
