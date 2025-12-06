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

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);
  private masterDb: DataSource;
  private tenantConnections = new Map<string, DataSource>();

  constructor() {
    // Initialize master database connection
    this.masterDb = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'medicore',
      password: process.env.DB_PASSWORD || 'medicore_password',
      database: 'medicore_master',
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
        this.logger.warn(`Tenant not found in registry: ${tenantIdentifier}. Attempting fallback connection.`);
        const fallbackConnection = await this.tryFallbackTenantConnection(tenantIdentifier);
        if (fallbackConnection) {
          this.tenantConnections.set(tenantIdentifier, fallbackConnection);
          return fallbackConnection;
        }
        this.logger.error(`Unable to resolve tenant "${tenantIdentifier}". Ensure the tenant exists and is active.`);
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

  async closeTenantConnection(tenantId: string): Promise<void> {
    const connection = this.tenantConnections.get(tenantId);
    if (connection) {
      await connection.destroy();
      this.tenantConnections.delete(tenantId);
    }
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

  private async createTenantConnection(databaseName: string) {
    const dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'medicore',
      password: process.env.DB_PASSWORD || 'medicore_password',
      database: databaseName,
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
      ],
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();
    return dataSource;
  }

  private async tryFallbackTenantConnection(tenantIdentifier: string): Promise<DataSource | null> {
    const normalized = tenantIdentifier.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const candidates = Array.from(
      new Set([
        tenantIdentifier,
        normalized,
        `tenant_${normalized}`,
        `clinic_${normalized}`,
        `clinic_${normalized}_db`,
      ]),
    );

    for (const candidate of candidates) {
      try {
        const connection = await this.createTenantConnection(candidate);
        this.logger.warn(
          `Connected to fallback tenant database "${candidate}" for identifier "${tenantIdentifier}". Please register this tenant in the master database.`,
        );
        return connection;
      } catch (error) {
        this.logger.debug(`Fallback connection attempt failed for database "${candidate}": ${error?.message || error}`);
      }
    }

    return null;
  }
}