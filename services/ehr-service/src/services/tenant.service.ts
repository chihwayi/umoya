import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Patient } from '../entities/patient.entity';
import { AppointmentSimple } from '../entities/appointment-simple.entity';
import { Appointment } from '../entities/appointment.entity';
import { MedicalRecord } from '../entities/medical-record.entity';
import { Prescription } from '../entities/prescription.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { LabTest } from '../entities/lab-test.entity';
import { LabOrderSet } from '../entities/lab-order-set.entity';
import { CriticalResultAlert } from '../entities/critical-result-alert.entity';
import { Bill } from '../entities/billing.entity';
import { Vitals } from '../entities/vitals.entity';
import { TriageAssessment } from '../entities/triage-assessment.entity';
import { NursingNote } from '../entities/nursing-note.entity';
import { Order } from '../entities/order.entity';
import { Problem } from '../entities/problem.entity';
import { Allergy } from '../entities/allergy.entity';
import { Drug } from '../entities/drug.entity';
import { DrugInteraction } from '../entities/drug-interaction.entity';
import {
  PatientMedication,
  MedicationAdherence,
  MedicationReconciliationLog,
} from '../entities/patient-medication.entity';
import { ClinicalNoteTemplate } from '../entities/clinical-note-template.entity';
import { PrescriptionTemplate } from '../entities/prescription-template.entity';
import { AppointmentWaitlist } from '../entities/appointment-waitlist.entity';
import { DiabetesRegistry } from '../entities/diabetes-registry.entity';
import { DiabetesCareBundle } from '../entities/diabetes-care-bundle.entity';
import { GlucoseMonitoring } from '../entities/glucose-monitoring.entity';
import { CgmSummary } from '../entities/cgm-summary.entity';
import { DiabetesMedication } from '../entities/diabetes-medication.entity';
import { InsulinRegimen } from '../entities/insulin-regimen.entity';
import { DiabetesComplicationScreening } from '../entities/diabetes-complication-screening.entity';
import { DiabetesEducationSession } from '../entities/diabetes-education-session.entity';
import { DiabetesAlert } from '../entities/diabetes-alert.entity';
import { DiabetesDeviceIntegration } from '../entities/diabetes-device-integration.entity';
import { DoctorAvailability } from '../entities/doctor-availability.entity';
import { MedicalAidClaim } from '../entities/medical-aid-claim.entity';
import { MedicalAidClaimLine } from '../entities/medical-aid-claim-line.entity';
import { MedicalAidTariffCode } from '../entities/medical-aid-tariff-code.entity';
import { TelemedicineConsultation } from '../entities/telemedicine-consultation.entity';
import { TelemedicineDevice } from '../entities/telemedicine-device.entity';
import { TelemedicineConsent } from '../entities/telemedicine-consent.entity';
import { TelemedicineTechnicalLog } from '../entities/telemedicine-technical-log.entity';
import { RemotePatientMonitoring } from '../entities/remote-patient-monitoring.entity';
import { TelemedicinePrescription } from '../entities/telemedicine-prescription.entity';
import { ReportTemplate } from '../entities/report-template.entity';
import { ScheduledReport } from '../entities/scheduled-report.entity';
import { ReportExecution } from '../entities/report-execution.entity';
import { ClinicalOutcome } from '../entities/clinical-outcome.entity';
import { AnalyticsMetric } from '../entities/analytics-metric.entity';
import { ReportFavorite } from '../entities/report-favorite.entity';
import { AppointmentTemplate } from '../entities/appointment-template.entity';
import { AppointmentResource, AppointmentResourceBooking } from '../entities/appointment-resource.entity';
import { Immunization } from '../entities/immunization.entity';
import { ConsentTemplate } from '../entities/consent-template.entity';
import { ClinicalPathway } from '../entities/clinical-pathway.entity';
import { EDVisit } from '../entities/ed-visit.entity';
import { Bed } from '../entities/bed.entity';
import { Admission } from '../entities/admission.entity';
import { Discharge } from '../entities/discharge.entity';
import { PatientTransfer } from '../entities/patient-transfer.entity';
import { OperatingRoom } from '../entities/operating-room.entity';
import { SurgicalCase } from '../entities/surgical-case.entity';
import { SurgicalPreferenceCard } from '../entities/surgical-preference-card.entity';
import { SurgicalImplant } from '../entities/surgical-implant.entity';
import { PreAnesthesiaAssessment } from '../entities/pre-anesthesia-assessment.entity';
import { AnesthesiaRecord } from '../entities/anesthesia-record.entity';
import { AnesthesiaVitals } from '../entities/anesthesia-vitals.entity';
import { PacuRecord } from '../entities/pacu-record.entity';
import { AnesthesiaBilling } from '../entities/anesthesia-billing.entity';
import { MedicationAdministrationRecord } from '../entities/medication-administration-record.entity';
import { MedicationAlert } from '../entities/medication-alert.entity';
import { BloodDonor } from '../entities/blood-donor.entity';
import { BloodInventory } from '../entities/blood-inventory.entity';
import { BloodTransfusion } from '../entities/blood-transfusion.entity';
import { InfectionSurveillance } from '../entities/infection-surveillance.entity';
import { IsolationPrecaution } from '../entities/isolation-precaution.entity';
import { AntimicrobialStewardship } from '../entities/antimicrobial-stewardship.entity';
import { ChargeMaster } from '../entities/charge-master.entity';
import { PatientCharge } from '../entities/patient-charge.entity';
import { ChargeApprovalNotification } from '../entities/charge-approval-notification.entity';
import { PatientConsent } from '../entities/patient-consent.entity';
import { ConsentSignature } from '../entities/consent-signature.entity';
import { PharmacyDispensing } from '../entities/pharmacy-dispensing.entity';
import { PharmacyDispensingAnomaly } from '../entities/pharmacy-dispensing-anomaly.entity';
import { PharmacyDispensingItem } from '../entities/pharmacy-dispensing-item.entity';
import { PharmacyInventoryForecast } from '../entities/pharmacy-inventory-forecast.entity';
import { PharmacyInventory } from '../entities/pharmacy-inventory.entity';
import { PharmacySupplier } from '../entities/pharmacy-supplier.entity';
import { PharmacyPurchaseOrder } from '../entities/pharmacy-purchase-order.entity';
import { PharmacyPurchaseOrderItem } from '../entities/pharmacy-purchase-order-item.entity';
import { PharmacyReceipt } from '../entities/pharmacy-receipt.entity';
import { PharmacyReceiptItem } from '../entities/pharmacy-receipt-item.entity';
import { PharmacyReturn } from '../entities/pharmacy-return.entity';
import { PharmacyReturnItem } from '../entities/pharmacy-return-item.entity';
import { PharmacyStockAdjustment } from '../entities/pharmacy-stock-adjustment.entity';
import { PharmacyStockAdjustmentItem } from '../entities/pharmacy-stock-adjustment-item.entity';
import { PharmacyStockMovement } from '../entities/pharmacy-stock-movement.entity';
import { PharmacyPricingRule } from '../entities/pharmacy-pricing-rule.entity';
import { PharmacyFormulary } from '../entities/pharmacy-formulary.entity';
import { PharmacyAlert } from '../entities/pharmacy-alert.entity';
import { MedicationReconciliationAiReview } from '../entities/medication-reconciliation-ai-review.entity';
import { PharmacySubstitutionRecommendation } from '../entities/pharmacy-substitution-recommendation.entity';
import { NurseCopilotTaskEvent } from '../entities/nurse-copilot-task-event.entity';
import { NurseCopilotAlertEvent } from '../entities/nurse-copilot-alert-event.entity';
import { NurseHandoffWorkflowState } from '../entities/nurse-handoff-workflow-state.entity';
import { NurseCrossModuleWorkflowState } from '../entities/nurse-cross-module-workflow-state.entity';
import { SmsGatewayConfig } from '../entities/sms-gateway-config.entity';
import { PaymentGatewayConfig } from '../entities/payment-gateway-config.entity';
import { PaymentProviderEvent } from '../entities/payment-provider-event.entity';
import { PaymentVerificationAttempt } from '../entities/payment-verification-attempt.entity';
import { BankStatement } from '../entities/bank-statement.entity';
import { PaymentReconciliation } from '../entities/payment-reconciliation.entity';
import { PaymentAnomalyFlag } from '../entities/payment-anomaly-flag.entity';
import { PostVisitSession } from '../entities/post-visit-session.entity';
import { PostVisitTranscriptSegment } from '../entities/post-visit-transcript-segment.entity';
import { PostVisitExtractedEntity } from '../entities/post-visit-extracted-entity.entity';
import { PostVisitDraftArtifact } from '../entities/post-visit-draft-artifact.entity';
import { PostVisitReviewAction } from '../entities/post-visit-review-action.entity';
import { PostVisitRuleCitation } from '../entities/post-visit-rule-citation.entity';
import { PostVisitActionExecution } from '../entities/post-visit-action-execution.entity';
import { PostVisitCompanionThread } from '../entities/post-visit-companion-thread.entity';
import { PostVisitCompanionMessage } from '../entities/post-visit-companion-message.entity';
import { PostVisitEscalationEvent } from '../entities/post-visit-escalation-event.entity';
import { PostVisitCompanionAcknowledgement } from '../entities/post-visit-companion-acknowledgement.entity';
import { SymptomCheckerSession } from '../entities/symptom-checker-session.entity';
import { AdherenceChatLog } from '../entities/adherence-chat-log.entity';
import { PatientAiSession } from '../entities/patient-ai-session.entity';
import { PatientAiEscalation } from '../entities/patient-ai-escalation.entity';
import { PatientFollowupOrchestration } from '../entities/patient-followup-orchestration.entity';
import { ChronicDiseaseRegistry } from '../entities/chronic-disease-registry.entity';
import { PreventiveCareReminder } from '../entities/preventive-care-reminder.entity';
import { RecallList } from '../entities/recall-list.entity';
import { FeeSchedule } from '../entities/fee-schedule.entity';
import { FeeScheduleItem } from '../entities/fee-schedule-item.entity';
import { SuperbillTemplate } from '../entities/superbill-template.entity';
import { InsuranceVerification } from '../entities/insurance-verification.entity';
import { PriorAuthorization } from '../entities/prior-authorization.entity';
import { PatientPortalPayment } from '../entities/patient-portal-payment.entity';
import { ClaimDenialPrediction } from '../entities/claim-denial-prediction.entity';
import { FinancialClearanceAssessment } from '../entities/financial-clearance-assessment.entity';
import { FinancialQuoteAssessment } from '../entities/financial-quote-assessment.entity';
import { PriorAuthorizationDraft } from '../entities/prior-authorization-draft.entity';
import { HealthEducationContent } from '../entities/health-education-content.entity';
import { PatientFamilyAccess } from '../entities/patient-family-access.entity';
import { NotificationCampaign } from '../entities/notification-campaign.entity';
import { NotificationCampaignRecipient } from '../entities/notification-campaign-recipient.entity';
import { TravelVaccineDestination } from '../entities/travel-vaccine-destination.entity';
import { VaccinationCertificate } from '../entities/vaccination-certificate.entity';
import { SupportedCurrency } from '../entities/supported-currency.entity';
import { ExchangeRate } from '../entities/exchange-rate.entity';
import { MedicalAidProvider } from '../entities/medical-aid-provider.entity';
import { MedicalAidEligibilityCheck } from '../entities/medical-aid-eligibility-check.entity';
import { MedicalAidClaimSubmission } from '../entities/medical-aid-claim-submission.entity';
import { MedicalAidRemittance } from '../entities/medical-aid-remittance.entity';
import { MedicalAidRemittanceLine } from '../entities/medical-aid-remittance-line.entity';
import { PatientEarlyWarningScore } from '../entities/patient-early-warning-score.entity';
import { PatientSdoh } from '../entities/patient-sdoh.entity';
import { CdssDecisionLog } from '../entities/cdss-decision-log.entity';
import { NurseTask } from '../entities/nurse-task.entity';
import { StaffNotification } from '../entities/staff-notification.entity';
import { CareGapDetection } from '../entities/care-gap-detection.entity';
import { AmbientSession } from '../entities/ambient-session.entity';
import { EncounterPrechart } from '../entities/encounter-prechart.entity';
import { InboxItem } from '../entities/inbox-item.entity';
import { TbPatient } from '../entities/tb-patient.entity';
import { TbDiagnosis } from '../entities/tb-diagnosis.entity';
import { TbTreatmentEpisode } from '../entities/tb-treatment-episode.entity';
import { TbDotRecord } from '../entities/tb-dot-record.entity';
import { TbContactInvestigation } from '../entities/tb-contact-investigation.entity';
import { TbDrugSusceptibility } from '../entities/tb-drug-susceptibility.entity';
import { TbOutcome } from '../entities/tb-outcome.entity';
import { PediatricProfile } from '../entities/pediatric-profile.entity';
import { GrowthMeasurement } from '../entities/growth-measurement.entity';
import { DevelopmentalMilestone } from '../entities/developmental-milestone.entity';
import { NeonatalRecord } from '../entities/neonatal-record.entity';
import { SchoolHealthRecord } from '../entities/school-health-record.entity';
import { MentalHealthScreening } from '../entities/mental-health-screening.entity';
import { MentalHealthCarePlan } from '../entities/mental-health-care-plan.entity';
import { MentalHealthFollowup } from '../entities/mental-health-followup.entity';
import { CervicalScreening } from '../entities/cervical-screening.entity';
import { CervicalTreatment } from '../entities/cervical-treatment.entity';
import { FamilyPlanningEnrollment } from '../entities/family-planning-enrollment.entity';
import { FamilyPlanningFollowup } from '../entities/family-planning-followup.entity';
import { HtnRegister } from '../entities/htn-register.entity';
import { BpReading } from '../entities/bp-reading.entity';
import { NcdTreatmentReview } from '../entities/ncd-treatment-review.entity';
import { TmRemedy } from '../entities/tm-remedy.entity';
import { HdiAlert } from '../entities/hdi-alert.entity';
import { TmToxicityEvent } from '../entities/tm-toxicity-event.entity';
import { ScdRegister } from '../entities/scd-register.entity';
import { ScdCrisisEvent } from '../entities/scd-crisis-event.entity';
import { ScdTreatmentRecord } from '../entities/scd-treatment-record.entity';
import { ScdComplicationScreening } from '../entities/scd-complication-screening.entity';
import { EpilepsyRegister } from '../entities/epilepsy-register.entity';
import { AedTherapyRecord } from '../entities/aed-therapy-record.entity';
import { AedToxicityEvent } from '../entities/aed-toxicity-event.entity';
import { AnimalExposure } from '../entities/animal-exposure.entity';
import { OneHealthReport } from '../entities/one-health-report.entity';
import { PsychiatricEncounter } from '../entities/psychiatric-encounter.entity';
import { CrisisEvent } from '../entities/crisis-event.entity';
import { SafePlan } from '../entities/safe-plan.entity';
import { PsychotropicMedication } from '../entities/psychotropic-medication.entity';
import { SeizureRecord } from '../entities/seizure-record.entity';
import { StrokeAssessment } from '../entities/stroke-assessment.entity';
import { HeadacheDiary } from '../entities/headache-diary.entity';
import { NeurologyExamination } from '../entities/neurology-examination.entity';
import { CognitiveAssessment } from '../entities/cognitive-assessment.entity';
import { GeriatricAssessment } from '../entities/geriatric-assessment.entity';
import { FallsAssessment } from '../entities/falls-assessment.entity';
import { PressureInjuryAssessment } from '../entities/pressure-injury-assessment.entity';
import { PolypharmacyReview } from '../entities/polypharmacy-review.entity';
import { AdvanceCarePlanning } from '../entities/advance-care-planning.entity';
import { MalariaCase } from '../entities/malaria-case.entity';
import { CdssFeedbackBatch } from '../entities/cdss-feedback-batch.entity';
import { CdssFeedbackEntry } from '../entities/cdss-feedback-entry.entity';
import { MalariaTest } from '../entities/malaria-test.entity';
import { MalariaTreatment } from '../entities/malaria-treatment.entity';
import { MalariaContactTracing } from '../entities/malaria-contact-tracing.entity';
import { MalariaSurveillanceReport } from '../entities/malaria-surveillance-report.entity';
import { ClinicalKnowledgeDocument } from '../entities/clinical-knowledge-document.entity';
import { ClaimRiskScore } from '../entities/claim-risk-score.entity';
import { ClaimAppeal } from '../entities/claim-appeal.entity';
import { FinancialHardshipReferral } from '../entities/financial-hardship-referral.entity';
import { PdmpCheck } from '../entities/pdmp-check.entity';
import { PatientRiskTier } from '../entities/patient-risk-tier.entity';
import { RiskStratificationBatch } from '../entities/risk-stratification-batch.entity';
import { ModelDeployment } from '../entities/model-deployment.entity';
import { AiOpsMetric } from '../entities/ai-ops-metric.entity';
import { SpirometryResult } from '../entities/spirometry-result.entity';
import { CopdAssessment } from '../entities/copd-assessment.entity';
import { AsthmaRecord } from '../entities/asthma-record.entity';
import { PeakFlowDiary } from '../entities/peak-flow-diary.entity';
import { OxygenTherapyRecord } from '../entities/oxygen-therapy-record.entity';
import { CkdAssessment } from '../entities/ckd-assessment.entity';
import { DialysisRecord } from '../entities/dialysis-record.entity';
import { FluidBalanceRecord } from '../entities/fluid-balance-record.entity';
import { RenalBiopsy } from '../entities/renal-biopsy.entity';
import { TransplantRecord } from '../entities/transplant-record.entity';
import { SkinLesion } from '../entities/skin-lesion.entity';
import { WoundAssessment } from '../entities/wound-assessment.entity';
import { BurnAssessment } from '../entities/burn-assessment.entity';
import { DermatologyNote } from '../entities/dermatology-note.entity';
import { PalliativeAssessment } from '../entities/palliative-assessment.entity';
import { SymptomBurdenScore } from '../entities/symptom-burden-score.entity';
import { GoalsOfCare } from '../entities/goals-of-care.entity';
import { AdvanceDirectiveRecord } from '../entities/advance-directive-record.entity';
import { PalliativeMedicationReview } from '../entities/palliative-medication-review.entity';
import { NutritionalScreening } from '../entities/nutritional-screening.entity';
import { NutritionalAssessment } from '../entities/nutritional-assessment.entity';
import { DietaryPrescription } from '../entities/dietary-prescription.entity';
import { NutritionMonitoring } from '../entities/nutrition-monitoring.entity';
import { IcuAdmission } from '../entities/icu-admission.entity';
import { SofaScore } from '../entities/sofa-score.entity';
import { VentilatorSettings } from '../entities/ventilator-settings.entity';
import { SedationRecord } from '../entities/sedation-record.entity';
import { CentralLineRecord } from '../entities/central-line-record.entity';
import { VasopressorRecord } from '../entities/vasopressor-record.entity';
import { ModelRegistry } from '../entities/model-registry.entity';
import { ModelPerformanceMetric } from '../entities/model-performance-metric.entity';
import { ModelFairnessReport } from '../entities/model-fairness-report.entity';
import { AiEvalRun } from '../entities/ai-eval-run.entity';
import { AiReleaseGateResult } from '../entities/ai-release-gate-result.entity';
import { ModelPromotionReview } from '../entities/model-promotion-review.entity';
import { ModelCard } from '../entities/model-card.entity';
import { ModelShadowEvaluation } from '../entities/model-shadow-evaluation.entity';
import { OutcomeLearningJob } from '../entities/outcome-learning-job.entity';
import { FlRound } from '../entities/fl-round.entity';
import { FlParticipationLog } from '../entities/fl-participation-log.entity';
import { PatientIdentityMatch } from '../entities/patient-identity-match.entity';
import { RegistrationDocumentExtract } from '../entities/registration-document-extract.entity';
import { IntakeAssessment } from '../entities/intake-assessment.entity';
import { InsuranceEligibilityCheck } from '../entities/insurance-eligibility-check.entity';
import { PatientVitalBaseline } from '../entities/patient-vital-baseline.entity';
import { ClinicalEscalationTask } from '../entities/clinical-escalation-task.entity';
import { RemoteMonitoringEvent } from '../entities/remote-monitoring-event.entity';
import { RemoteMonitoringAlert } from '../entities/remote-monitoring-alert.entity';
import { EncounterCopilotSession } from '../entities/encounter-copilot-session.entity';
import { OrderAppropriatenessReview } from '../entities/order-appropriateness-review.entity';
import { ResultFollowupTask } from '../entities/result-followup-task.entity';
import { TreatmentPathwayInstance } from '../entities/treatment-pathway-instance.entity';
import { DicomStudy } from '../entities/dicom-study.entity';
import { RadiologyAiFinding } from '../entities/radiology-ai-finding.entity';
import { ImagingOrderAiReview } from '../entities/imaging-order-ai-review.entity';
import { RadiologyReportDraft } from '../entities/radiology-report-draft.entity';
import { RadiologyDiscrepancyReview } from '../entities/radiology-discrepancy-review.entity';
import { IncidentalFindingFollowup } from '../entities/incidental-finding-followup.entity';
import { getMasterDbConfig } from '../utils/runtime-env';
import { RegistrationAiSession } from '../entities/registration-ai-session.entity';
import { InsuranceOcrResult } from '../entities/insurance-ocr-result.entity';
import { DicomSeries } from '../entities/dicom-series.entity';
import { PatientAiSnapshot } from '../entities/patient-ai-snapshot.entity';
import { ProactiveAlert } from '../entities/proactive-alert.entity';
import { PatientRiskScore } from '../entities/patient-risk-score.entity';
import { Household } from '../entities/household.entity';
import { HouseholdMember } from '../entities/household-member.entity';
import { ChwVisit } from '../entities/chw-visit.entity';
import { ChwTask } from '../entities/chw-task.entity';
import { ChwDailyTally } from '../entities/chw-daily-tally.entity';
import { NutritionAssessment } from '../entities/nutrition-assessment.entity';
import { RutfDispensing } from '../entities/rutf-dispensing.entity';
import { TherapeuticFeedingRecord } from '../entities/therapeutic-feeding.entity';
import { NhifScheme } from '../entities/nhif-scheme.entity';
import { SchemeMember } from '../entities/scheme-member.entity';
import { NhifClaim } from '../entities/nhif-claim.entity';
import { CapitationPayment } from '../entities/capitation-payment.entity';
import { NhifMember } from '../entities/nhif-member.entity';
import { CapitationClaim } from '../entities/capitation-claim.entity';
import { SchemeTariffSchedule } from '../entities/scheme-tariff-schedule.entity';
import { NhlsLabResult } from '../entities/nhls-lab-result.entity';
import { TierNetExport } from '../entities/tier-net-export.entity';
import { EtrNetNotification } from '../entities/etr-net-notification.entity';
import { DatimIndicatorMapping } from '../entities/datim-indicator-mapping.entity';
import { DatimSubmission } from '../entities/datim-submission.entity';
import { AtMessageLog } from '../entities/at-message-log.entity';
import { UssdSession } from '../entities/ussd-session.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { NotificationTriggerConfig } from '../entities/notification-trigger-config.entity';
import { NotificationLog } from '../entities/notification-log.entity';
import { BirthNotification } from '../entities/birth-notification.entity';
import { DeathCertificate } from '../entities/death-certificate.entity';
import { MdsrNotification } from '../entities/mdsr-notification.entity';
import { MaternalDeath } from '../entities/maternal-death.entity';
import { MaternalDeathReview } from '../entities/maternal-death-review.entity';
import { EmoncSignal } from '../entities/emonc-signal.entity';
import { DiabeticFootAssessment } from '../entities/diabetic-foot-assessment.entity';
import { RetinopathyScreening } from '../entities/retinopathy-screening.entity';
import { CkdStagingRecord } from '../entities/ckd-staging-record.entity';
import { NtdAssessment } from '../entities/ntd-assessment.entity';
import { MdaCampaign } from '../entities/mda-campaign.entity';
import { MalariaEpisode } from '../entities/malaria-episode.entity';
import { OpenmrsPatientLink } from '../entities/openmrs-patient-link.entity';
import { MflFacility } from '../entities/mfl-facility.entity';
import { OpenmrsSyncLog } from '../entities/openmrs-sync-log.entity';
import { VhfCase } from '../entities/vhf-case.entity';
import { VhfContact } from '../entities/vhf-contact.entity';
import { MpoxLesionAssessment } from '../entities/mpox-lesion-assessment.entity';
import { PlagueCase } from '../outbreak/entities/plague-case.entity';
import { YellowFeverCase } from '../outbreak/entities/yellow-fever-case.entity';
import { MeningitisCase } from '../outbreak/entities/meningitis-case.entity';
import { LeprosyCase } from '../ntd/entities/leprosy-case.entity';
import { OnchocerciasisCase } from '../ntd/entities/onchocerciasis-case.entity';
import { FilariasisCase } from '../ntd/entities/filariasis-case.entity';
import { SormasSyncLog } from '../surveillance/entities/sormas-sync-log.entity';
import { IhrNotification } from '../surveillance/entities/ihr-notification.entity';
import { EbsSignal } from '../surveillance/entities/ebs-signal.entity';
import { CbhiHousehold } from '../cbhi/entities/cbhi-household.entity';
import { CbhiHouseholdMember } from '../cbhi/entities/cbhi-household-member.entity';
import { CbhiContribution } from '../cbhi/entities/cbhi-contribution.entity';
import { CbhiClaim } from '../cbhi/entities/cbhi-claim.entity';
import { TbaRegister } from '../tba/entities/tba-register.entity';
import { HomeBirthRecord } from '../tba/entities/home-birth-record.entity';
import { DisaSyncLog } from '../interop/entities/disa-sync-log.entity';
import { SmartcarePatientLink } from '../interop/entities/smartcare-patient-link.entity';
import { CrossBorderPatientFlag } from '../interop/entities/cross-border-patient-flag.entity';
import { UserLanguagePreference } from '../settings/entities/user-language-preference.entity';
import { OfflineSyncQueue } from '../lite/entities/offline-sync-queue.entity';
import { UssdClinicalEntry } from '../lite/entities/ussd-clinical-entry.entity';
import { SocialDeterminant } from '../cultural/entities/social-determinant.entity';
import { FamilyCouncilConsent } from '../cultural/entities/family-council-consent.entity';
import { UbuntuWellbeingAssessment } from '../cultural/entities/ubuntu-wellbeing-assessment.entity';
import { UhcIndicatorSnapshot } from '../analytics/entities/uhc-indicator-snapshot.entity';
import { SdgIndicatorTarget } from '../analytics/entities/sdg-indicator-target.entity';
import { NcidRegistration } from '../entities/ncid-registration.entity';
import { NcidDuplicateFlag } from '../entities/ncid-duplicate-flag.entity';
import { NcidProgrammeLinkage } from '../entities/ncid-programme-linkage.entity';

export interface TenantDhis2Config {
  tenantId: string;
  baseUrl: string;
  apiVersion: string;
  authType: 'pat' | 'basic';
  pat?: string | null;
  username?: string | null;
  password?: string | null;
  orgUnitId: string;
  trackedEntityTypeId?: string | null;
  dataSetId?: string | null;
  enabled: boolean;
  scheduledSyncEnabled?: boolean;
  scheduledRetryLimit?: number;
  alertLookbackHours?: number;
  alertErrorThreshold?: number;
  alertWebhookUrl?: string | null;
}

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);
  private masterDb: DataSource;
  private tenantConnections = new Map<string, DataSource>();

  constructor() {
    // Initialize master database connection
    const cfg = getMasterDbConfig();
    this.masterDb = new DataSource({
      type: 'postgres',
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      password: cfg.password,
      database: cfg.database,
    });
    this.masterDb.initialize().catch(console.error);
  }

  async getTenantDatabase(tenantIdentifier: string): Promise<DataSource | null> {
    try {
      // Check if it's a UUID or subdomain
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdentifier);
      
      let tenantQuery: string;
      if (isUUID) {
        tenantQuery = `SELECT id, "databaseName" FROM tenants WHERE id = $1 AND status = 'active'`;
      } else {
        tenantQuery = `SELECT id, "databaseName" FROM tenants WHERE subdomain = $1 AND status = 'active'`;
      }
      
      const result = await this.masterDb.query(tenantQuery, [tenantIdentifier]);
      
      if (!result || result.length === 0) {
        this.logger.warn(`Tenant not found in active registry: ${tenantIdentifier}`);
        return null;
      }

      const { id: tenantId, databaseName } = result[0];
      
      // Check if connection already exists
      if (this.tenantConnections.has(tenantId)) {
        return this.tenantConnections.get(tenantId);
      }
      
      const dataSource = await this.createTenantConnection(databaseName);
      this.tenantConnections.set(tenantId, dataSource);
      
      this.logger.log(`Connected to tenant database: ${databaseName}`);
      return dataSource;
    } catch (error) {
      this.logger.error(`Failed to connect to tenant database: ${tenantIdentifier}`, error);
      return null;
    }
  }

  async getTenantSecurityPolicy(tenantIdentifier: string): Promise<{
    id: string;
    subdomain: string;
    mfaRequired: boolean;
    sessionTimeoutMinutes: number;
    allowEmergencyBypass: boolean;
  } | null> {
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdentifier);
      const tenantFilter = isUUID ? 'id = $1' : 'subdomain = $1';
      const rows = await this.masterDb.query(
        `
          SELECT
            id,
            subdomain,
            COALESCE("mfaRequired", false) AS "mfaRequired",
            COALESCE("sessionTimeoutMinutes", 60) AS "sessionTimeoutMinutes",
            COALESCE("allowEmergencyBypass", false) AS "allowEmergencyBypass"
          FROM tenants
          WHERE ${tenantFilter}
            AND status = 'active'
          LIMIT 1
        `,
        [tenantIdentifier],
      );
      const row = rows?.[0];
      if (!row) return null;
      return {
        id: row.id,
        subdomain: row.subdomain,
        mfaRequired: Boolean(row.mfaRequired),
        sessionTimeoutMinutes: Number(row.sessionTimeoutMinutes || 60),
        allowEmergencyBypass: Boolean(row.allowEmergencyBypass),
      };
    } catch (error) {
      this.logger.warn(`Failed to load tenant security policy for ${tenantIdentifier}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async closeTenantConnection(tenantId: string): Promise<void> {
    const connection = this.tenantConnections.get(tenantId);
    if (connection) {
      await connection.destroy();
      this.tenantConnections.delete(tenantId);
    }
  }

  getSystemDb(): DataSource {
    return this.masterDb;
  }

  async getAllActiveTenants(): Promise<Array<{ id: string; subdomain: string; databaseName: string }>> {
    try {
      const result = await this.masterDb.query(
        `SELECT id, subdomain, "databaseName" FROM tenants WHERE status = 'active'`,
      );
      return result || [];
    } catch (error) {
      this.logger.error('Failed to get active tenants:', error);
      return [];
    }
  }

  async getTenantDhis2Config(tenantIdentifier: string): Promise<TenantDhis2Config | null> {
    try {
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdentifier);

      const tenantFilter = isUUID ? 't.id = $1' : 't.subdomain = $1';
      const rows = await this.masterDb.query(
        `
        SELECT
          t.id AS tenant_id,
          c.base_url,
          COALESCE(c.api_version, '40') AS api_version,
          COALESCE(c.auth_type, 'pat') AS auth_type,
          c.pat,
          c.username,
          c.password,
          c.org_unit_id,
          c.tracked_entity_type_id,
          c.dataset_id,
          COALESCE(c.enabled, true) AS enabled,
          COALESCE(c.scheduled_sync_enabled, false) AS scheduled_sync_enabled,
          COALESCE(c.scheduled_retry_limit, 20) AS scheduled_retry_limit,
          COALESCE(c.alert_lookback_hours, 24) AS alert_lookback_hours,
          COALESCE(c.alert_error_threshold, 10) AS alert_error_threshold,
          c.alert_webhook_url
        FROM tenants t
        LEFT JOIN tenant_dhis2_config c
          ON c.tenant_id = t.id
        WHERE ${tenantFilter}
          AND t.status = 'active'
        LIMIT 1
        `,
        [tenantIdentifier],
      );

      if (!rows || rows.length === 0) {
        this.logger.warn(`Tenant not found for DHIS2 config lookup: ${tenantIdentifier}`);
        return null;
      }

      const row = rows[0];
      if (!row.base_url || !row.org_unit_id) {
        return null;
      }

      return {
        tenantId: row.tenant_id,
        baseUrl: row.base_url,
        apiVersion: String(row.api_version || '40'),
        authType: row.auth_type === 'basic' ? 'basic' : 'pat',
        pat: row.pat ?? null,
        username: row.username ?? null,
        password: row.password ?? null,
        orgUnitId: row.org_unit_id,
        trackedEntityTypeId: row.tracked_entity_type_id ?? null,
        dataSetId: row.dataset_id ?? null,
        enabled: Boolean(row.enabled),
        scheduledSyncEnabled: Boolean(row.scheduled_sync_enabled),
        scheduledRetryLimit: Number(row.scheduled_retry_limit || 20),
        alertLookbackHours: Number(row.alert_lookback_hours || 24),
        alertErrorThreshold: Number(row.alert_error_threshold || 10),
        alertWebhookUrl: row.alert_webhook_url ?? null,
      };
    } catch (error) {
      this.logger.error(`Failed to load tenant DHIS2 config: ${tenantIdentifier}`, error);
      return null;
    }
  }

  private async createTenantConnection(databaseName: string) {
    const cfg = getMasterDbConfig(databaseName);
    const dataSource = new DataSource({
      type: 'postgres',
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      password: cfg.password,
      database: cfg.database,
      synchronize: false,
      entities: [
        User,
        Patient,
        AppointmentSimple,
        Appointment,
        MedicalRecord,
        Prescription,
        LabOrder,
        Bill,
        Vitals,
        TriageAssessment,
        NursingNote,
        Order,
        Problem,
        Allergy,
        LabTest,
        LabOrderSet,
        CriticalResultAlert,
        Drug,
        DrugInteraction,
        PatientMedication,
        MedicationAdherence,
        MedicationReconciliationLog,
        ClinicalNoteTemplate,
        PrescriptionTemplate,
        AppointmentWaitlist,
        DiabetesRegistry,
        DiabetesCareBundle,
        GlucoseMonitoring,
        CgmSummary,
        DiabetesMedication,
        InsulinRegimen,
        DiabetesComplicationScreening,
        DiabetesEducationSession,
        DiabetesAlert,
        DiabetesDeviceIntegration,
        DoctorAvailability,
        MedicalAidClaim,
        MedicalAidClaimLine,
        MedicalAidTariffCode,
        TelemedicineConsultation,
        TelemedicineDevice,
        TelemedicineConsent,
        TelemedicineTechnicalLog,
        RemotePatientMonitoring,
        TelemedicinePrescription,
        ReportTemplate,
        ScheduledReport,
        AppointmentTemplate,
        AppointmentResource,
        AppointmentResourceBooking,
        ReportExecution,
        ClinicalOutcome,
        AnalyticsMetric,
        ReportFavorite,
        Immunization,
        ConsentTemplate,
        ClinicalPathway,
        EDVisit,
        Bed,
        Admission,
        Discharge,
        PatientTransfer,
        OperatingRoom,
        SurgicalCase,
        SurgicalPreferenceCard,
        SurgicalImplant,
        PreAnesthesiaAssessment,
        AnesthesiaRecord,
        AnesthesiaVitals,
        PacuRecord,
        AnesthesiaBilling,
        MedicationAdministrationRecord,
        MedicationAlert,
        BloodDonor,
        BloodInventory,
        BloodTransfusion,
        InfectionSurveillance,
        IsolationPrecaution,
        AntimicrobialStewardship,
        ChargeMaster,
        PatientCharge,
        ChargeApprovalNotification,
        PatientConsent,
        ConsentSignature,
        PharmacyDispensing,
        PharmacyDispensingAnomaly,
        PharmacyDispensingItem,
        PharmacyInventoryForecast,
        PharmacyInventory,
        PharmacySupplier,
        PharmacyPurchaseOrder,
        PharmacyPurchaseOrderItem,
        PharmacyReceipt,
        PharmacyReceiptItem,
        PharmacyReturn,
        PharmacyReturnItem,
        PharmacyStockAdjustment,
        PharmacyStockAdjustmentItem,
        PharmacyStockMovement,
        PharmacyPricingRule,
        PharmacyFormulary,
        PharmacyAlert,
        MedicationReconciliationAiReview,
        PharmacySubstitutionRecommendation,
        NurseCopilotTaskEvent,
        NurseCopilotAlertEvent,
        NurseHandoffWorkflowState,
        NurseCrossModuleWorkflowState,
        SmsGatewayConfig,
        PaymentGatewayConfig,
        PaymentProviderEvent,
        PaymentVerificationAttempt,
        BankStatement,
        PaymentReconciliation,
        PaymentAnomalyFlag,
        PostVisitSession,
        PostVisitTranscriptSegment,
        PostVisitExtractedEntity,
        PostVisitDraftArtifact,
        PostVisitReviewAction,
        PostVisitRuleCitation,
        PostVisitActionExecution,
        PostVisitCompanionThread,
        PostVisitCompanionMessage,
        PostVisitEscalationEvent,
        PostVisitCompanionAcknowledgement,
        SymptomCheckerSession,
        AdherenceChatLog,
        PatientAiSession,
        PatientAiEscalation,
        PatientFollowupOrchestration,
        ChronicDiseaseRegistry,
        PreventiveCareReminder,
        RecallList,
        FeeSchedule,
        FeeScheduleItem,
        SuperbillTemplate,
        InsuranceVerification,
        PriorAuthorization,
        PatientPortalPayment,
        ClaimDenialPrediction,
        FinancialClearanceAssessment,
        FinancialQuoteAssessment,
        PriorAuthorizationDraft,
        HealthEducationContent,
        PatientFamilyAccess,
        NotificationCampaign,
        NotificationCampaignRecipient,
        TravelVaccineDestination,
        VaccinationCertificate,
        SupportedCurrency,
        ExchangeRate,
        MedicalAidProvider,
        MedicalAidEligibilityCheck,
        MedicalAidClaimSubmission,
        MedicalAidRemittance,
        MedicalAidRemittanceLine,
        PatientEarlyWarningScore,
        PatientSdoh,
        CdssDecisionLog,
        NurseTask,
        StaffNotification,
        CareGapDetection,
        AmbientSession,
        EncounterPrechart,
        InboxItem,
        TbPatient,
        TbDiagnosis,
        TbTreatmentEpisode,
        TbDotRecord,
        TbContactInvestigation,
        TbDrugSusceptibility,
        TbOutcome,
        PediatricProfile,
        GrowthMeasurement,
        DevelopmentalMilestone,
        NeonatalRecord,
        SchoolHealthRecord,
        MentalHealthScreening,
        MentalHealthCarePlan,
        MentalHealthFollowup,
        CervicalScreening,
        CervicalTreatment,
        FamilyPlanningEnrollment,
        FamilyPlanningFollowup,
        HtnRegister,
        BpReading,
        NcdTreatmentReview,
        TmRemedy,
        HdiAlert,
        TmToxicityEvent,
        ScdRegister,
        ScdCrisisEvent,
        ScdTreatmentRecord,
        ScdComplicationScreening,
        EpilepsyRegister,
        AedTherapyRecord,
        AedToxicityEvent,
        AnimalExposure,
        OneHealthReport,
        PsychiatricEncounter,
        CrisisEvent,
        SafePlan,
        PsychotropicMedication,
        SeizureRecord,
        StrokeAssessment,
        HeadacheDiary,
        NeurologyExamination,
        CognitiveAssessment,
        GeriatricAssessment,
        FallsAssessment,
        PressureInjuryAssessment,
        PolypharmacyReview,
        AdvanceCarePlanning,
        SpirometryResult,
        CopdAssessment,
        AsthmaRecord,
        PeakFlowDiary,
        OxygenTherapyRecord,
        CkdAssessment,
        DialysisRecord,
        FluidBalanceRecord,
        RenalBiopsy,
        TransplantRecord,
        SkinLesion,
        WoundAssessment,
        BurnAssessment,
        DermatologyNote,
        PalliativeAssessment,
        SymptomBurdenScore,
        GoalsOfCare,
        AdvanceDirectiveRecord,
        PalliativeMedicationReview,
        NutritionalScreening,
        NutritionalAssessment,
        DietaryPrescription,
        NutritionMonitoring,
        IcuAdmission,
        SofaScore,
        VentilatorSettings,
        SedationRecord,
        CentralLineRecord,
        VasopressorRecord,
        ModelRegistry,
        ModelPerformanceMetric,
        ModelFairnessReport,
        AiEvalRun,
        AiReleaseGateResult,
        ModelPromotionReview,
        ModelCard,
        ModelShadowEvaluation,
        OutcomeLearningJob,
        FlRound,
        FlParticipationLog,
        PatientIdentityMatch,
        RegistrationDocumentExtract,
        IntakeAssessment,
        InsuranceEligibilityCheck,
        PatientVitalBaseline,
        ClinicalEscalationTask,
        RemoteMonitoringEvent,
        RemoteMonitoringAlert,
        EncounterCopilotSession,
        OrderAppropriatenessReview,
        ResultFollowupTask,
        TreatmentPathwayInstance,
        DicomStudy,
        RadiologyAiFinding,
        ImagingOrderAiReview,
        RadiologyReportDraft,
        RadiologyDiscrepancyReview,
        IncidentalFindingFollowup,
        MalariaCase,
        MalariaTest,
        MalariaTreatment,
        MalariaContactTracing,
        MalariaSurveillanceReport,
        CdssFeedbackBatch,
        CdssFeedbackEntry,
        ClinicalKnowledgeDocument,
        ClaimRiskScore,
        ClaimAppeal,
        FinancialHardshipReferral,
        PdmpCheck,
        PatientRiskTier,
        RiskStratificationBatch,
        ModelDeployment,
        AiOpsMetric,
        RegistrationAiSession,
        InsuranceOcrResult,
        DicomSeries,
        PatientAiSnapshot,
        ProactiveAlert,
        PatientRiskScore,
        Household,
        HouseholdMember,
        ChwVisit,
        ChwTask,
        ChwDailyTally,
        NutritionAssessment,
        RutfDispensing,
        TherapeuticFeedingRecord,
        NhifScheme,
        SchemeMember,
        NhifClaim,
        CapitationPayment,
        NhifMember,
        CapitationClaim,
        SchemeTariffSchedule,
        NhlsLabResult,
        TierNetExport,
        EtrNetNotification,
        DatimIndicatorMapping,
        DatimSubmission,
        AtMessageLog,
        UssdSession,
        NotificationTemplate,
        NotificationTriggerConfig,
        NotificationLog,
        SocialDeterminant,
        FamilyCouncilConsent,
        UbuntuWellbeingAssessment,
        BirthNotification,
        DeathCertificate,
        MdsrNotification,
        MaternalDeath,
        MaternalDeathReview,
        EmoncSignal,
        DiabeticFootAssessment,
        RetinopathyScreening,
        CkdStagingRecord,
        NtdAssessment,
        MdaCampaign,
        MalariaEpisode,
        OpenmrsPatientLink,
        MflFacility,
        OpenmrsSyncLog,
        VhfCase,
        VhfContact,
        MpoxLesionAssessment,
        PlagueCase,
        YellowFeverCase,
        MeningitisCase,
        LeprosyCase,
        OnchocerciasisCase,
        FilariasisCase,
        SormasSyncLog,
        IhrNotification,
        EbsSignal,
        CbhiHousehold,
        CbhiHouseholdMember,
        CbhiContribution,
        CbhiClaim,
        TbaRegister,
        HomeBirthRecord,
        DisaSyncLog,
        SmartcarePatientLink,
        CrossBorderPatientFlag,
        UserLanguagePreference,
        OfflineSyncQueue,
        UssdClinicalEntry,
        UhcIndicatorSnapshot,
        SdgIndicatorTarget,
        NcidRegistration,
        NcidDuplicateFlag,
        NcidProgrammeLinkage,
      ],
      logging: false,
    });

    await dataSource.initialize();
    return dataSource;
  }

}
