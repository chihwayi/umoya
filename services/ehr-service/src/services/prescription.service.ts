import { Injectable, NotFoundException, Logger, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Prescription, PrescriptionStatus } from '../entities/prescription.entity';
import { TerminologyService } from './terminology.service';
import { CdssHookService } from './cdss-hook.service';
import { ClinicalWorkflowService } from './clinical-workflow.service';

interface StoredConceptSummary {
  conceptId: string;
  term: string;
  moduleId?: string;
  definitionStatus?: string;
}

@Injectable()
export class PrescriptionService {
  private readonly logger = new Logger(PrescriptionService.name);

  constructor(
    private readonly terminologyService: TerminologyService,
    private readonly cdssHookService: CdssHookService,
    @Optional() private workflowService?: ClinicalWorkflowService,
  ) {}
  
  private extractConceptId(candidate: any): string | null {
    if (!candidate) {
      return null;
    }
    if (typeof candidate === 'string') {
      return candidate.trim();
    }
    return (
      candidate?.conceptId ??
      candidate?.snomedConceptId ??
      candidate?.snomed_code ??
      candidate?.snomedCode ??
      candidate?.code ??
      null
    );
  }

  private async resolveConcept(
    tenantDb: DataSource,
    raw: any,
  ): Promise<StoredConceptSummary | null> {
    if (raw === undefined || raw === null) {
      return null;
    }

    const conceptIdCandidate = this.extractConceptId(raw);
    if (!conceptIdCandidate) {
      return null;
    }

    const conceptId = String(conceptIdCandidate).trim();
    let validated:
      | {
          conceptId: string;
          preferredTerm?: string;
          term?: string;
          moduleId?: string;
          definitionStatus?: string;
        }
      | null = null;

    if (/^\d+$/.test(conceptId)) {
      try {
        validated = await this.terminologyService.validateConcept(tenantDb, conceptId);
      } catch (error: any) {
        this.logger.warn(
          `SNOMED validation failed for concept "${conceptId}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      this.logger.warn(`Received non-numeric SNOMED concept "${conceptId}" for prescription payload.`);
      return null;
    }

    const rawTerm =
      (typeof raw === 'object' && (raw.preferredTerm || raw.term || raw.fullySpecifiedName)) ||
      null;
    const term = rawTerm ?? validated?.preferredTerm ?? validated?.term ?? null;

    if (!term && !validated) {
      return null;
    }

    return {
      conceptId: validated?.conceptId ?? conceptId,
      term: term ?? '',
      moduleId: validated?.moduleId ?? raw?.moduleId,
      definitionStatus: validated?.definitionStatus ?? raw?.definitionStatus,
    };
  }

  async create(
    createDto: any,
    tenantDb: DataSource,
    prescriberId: string,
    tenantId?: string,
  ): Promise<Prescription & { cdssInsights?: any }> {
    const prescriptionCount = await tenantDb.query('SELECT COUNT(*) as count FROM prescriptions');
    const count = parseInt(prescriptionCount[0].count) + 1;
    const prescriptionNumber = `RX${String(count).padStart(8, '0')}`;
    
    // Resolve SNOMED concept for medication_name
    const medicationConcept = await this.resolveConcept(tenantDb, createDto.medication_name_snomed || createDto.medicationNameSnomed);

    // Use raw SQL to insert with SNOMED fields
    const result = await tenantDb.query(
      `
      INSERT INTO prescriptions (
        prescription_number, patient_id, prescriber_id, medical_record_id,
        medication_name, medication_name_snomed_code, medication_name_snomed_term,
        medication_name_snomed_module_id, medication_name_snomed_definition_status,
        generic_name, strength, form, dosage, frequency, route, quantity, refills,
        start_date, end_date, instructions, indication, status, pharmacy_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
      `,
      [
        prescriptionNumber,
        createDto.patientId,
        prescriberId,
        createDto.medicalRecordId ?? null,
        createDto.medicationName,
        medicationConcept?.conceptId ?? null,
        medicationConcept?.term ?? null,
        medicationConcept?.moduleId ?? null,
        medicationConcept?.definitionStatus ?? null,
        createDto.genericName ?? null,
        createDto.strength,
        createDto.form,
        createDto.dosage,
        createDto.frequency,
        createDto.route,
        createDto.quantity,
        createDto.refills ?? null,
        new Date(createDto.startDate),
        createDto.endDate ? new Date(createDto.endDate) : null,
        createDto.instructions ?? null,
        createDto.indication ?? null,
        createDto.status ?? PrescriptionStatus.ACTIVE,
        createDto.pharmacyNotes ?? null,
      ],
    );

    const createdPrescription = result[0] as Prescription;

    let cdssInsights: any = null;
    try {
      cdssInsights = await this.cdssHookService.handlePrescriptionCreated({
        tenantId: tenantId || 'unknown',
        tenantDb,
        prescription: createdPrescription,
      });
    } catch (error) {
      this.logger.warn(
        `CDSS hook failed for prescription ${createdPrescription.id}: ${error instanceof Error ? error.message : error}`,
      );
    }

    // Trigger workflow for prescription_created
    if (this.workflowService) {
      try {
        await this.workflowService.executeWorkflow(
          'prescription_created',
          {
            entityType: 'prescription',
            entityId: createdPrescription.id,
            patientId: createdPrescription.patientId,
            data: {
              medicationName: createdPrescription.medicationName,
              status: createdPrescription.status,
            },
          },
          tenantDb,
        );
      } catch (error) {
        this.logger.warn(`Failed to trigger workflow for prescription_created: ${error instanceof Error ? error.message : error}`);
      }
    }

    return {
      ...createdPrescription,
      cdssInsights,
    };
  }

  async findByPatient(patientId: string, tenantDb: DataSource): Promise<any> {
    try {
      const prescriptionRepository = tenantDb.getRepository(Prescription);
      
      // Load prescriptions with prescriber relation only (dispensedBy doesn't exist in entity)
      return await prescriptionRepository.find({
        where: { patientId },
        relations: ['prescriber'], // Removed 'dispensedBy' as it doesn't exist in the entity
        order: { createdAt: 'DESC' }
      }) as any;
    } catch (error) {
      this.logger.error(`Error finding prescriptions for patient ${patientId}: ${error instanceof Error ? error.message : error}`);
      // Return empty array instead of throwing to prevent breaking the UI
      return [];
    }
  }

  async dispense(id: string, tenantDb: DataSource, dispensedById: string): Promise<Prescription> {
    const prescriptionRepository = tenantDb.getRepository(Prescription);
    
    const prescription = await prescriptionRepository.findOne({ where: { id } });
    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }
    
    prescription.dispensedById = dispensedById;
    prescription.dispensedAt = new Date();
    prescription.status = PrescriptionStatus.COMPLETED;
    
    return prescriptionRepository.save(prescription);
  }
}
