import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateDigitalPrescriptionDto,
  SignPrescriptionDto,
} from '../dto/telemedicine.dto';

@Injectable()
export class DigitalPrescriptionService {
  private readonly logger = new Logger(DigitalPrescriptionService.name);

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  /**
   * Create digital prescription
   */
  async createDigitalPrescription(
    tenantDb: DataSource,
    dto: CreateDigitalPrescriptionDto,
  ) {
    this.ensureTenantDb(tenantDb);

    // Verify consultation exists
    const [consultation] = await tenantDb.query(
      `SELECT id FROM telemedicine_consultations WHERE id = $1`,
      [dto.consultationId],
    );

    if (!consultation) {
      throw new NotFoundException(`Consultation ${dto.consultationId} not found`);
    }

    const result = await tenantDb.query(
      `INSERT INTO telemedicine_prescriptions (
        consultation_id, prescription_id, e_signature_patient,
        e_signature_doctor, signature_method, is_valid,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
      RETURNING *`,
      [
        dto.consultationId,
        dto.prescriptionId ?? null,
        dto.eSignaturePatient ?? null,
        dto.eSignatureDoctor ?? null,
        dto.signatureMethod ?? null,
      ],
    );

    return result[0];
  }

  /**
   * Sign prescription
   */
  async signPrescription(
    tenantDb: DataSource,
    prescriptionId: string,
    dto: SignPrescriptionDto,
    userId: string,
  ) {
    this.ensureTenantDb(tenantDb);

    const [prescription] = await tenantDb.query(
      `SELECT * FROM telemedicine_prescriptions WHERE id = $1`,
      [prescriptionId],
    );

    if (!prescription) {
      throw new NotFoundException(`Digital prescription ${prescriptionId} not found`);
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (dto.role === 'patient') {
      updates.push('e_signature_patient = $1', 'signed_by_patient_at = NOW()');
      params.push(dto.signature);
    } else if (dto.role === 'doctor') {
      updates.push('e_signature_doctor = $1', 'signed_by_doctor_at = NOW()');
      params.push(dto.signature);
    }

    if (dto.signatureMethod) {
      updates.push(`signature_method = $${params.length + 1}`);
      params.push(dto.signatureMethod);
    }

    // Validate if both signatures are present
    if (dto.role === 'doctor' && prescription.e_signature_patient) {
      updates.push('is_valid = true');
    } else if (dto.role === 'patient' && prescription.e_signature_doctor) {
      updates.push('is_valid = true');
    }

    updates.push('updated_at = NOW()');
    params.push(prescriptionId);

    const result = await tenantDb.query(
      `UPDATE telemedicine_prescriptions
       SET ${updates.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params,
    );

    return result[0];
  }

  /**
   * Validate prescription signatures
   */
  async validatePrescription(tenantDb: DataSource, prescriptionId: string) {
    this.ensureTenantDb(tenantDb);

    const [prescription] = await tenantDb.query(
      `SELECT * FROM telemedicine_prescriptions WHERE id = $1`,
      [prescriptionId],
    );

    if (!prescription) {
      throw new NotFoundException(`Digital prescription ${prescriptionId} not found`);
    }

    const isValid =
      prescription.e_signature_patient &&
      prescription.e_signature_doctor &&
      prescription.signed_by_patient_at &&
      prescription.signed_by_doctor_at;

    if (isValid && !prescription.is_valid) {
      await tenantDb.query(
        `UPDATE telemedicine_prescriptions
         SET is_valid = true, updated_at = NOW()
         WHERE id = $1`,
        [prescriptionId],
      );
    }

    return {
      isValid: !!isValid,
      hasPatientSignature: !!prescription.e_signature_patient,
      hasDoctorSignature: !!prescription.e_signature_doctor,
      signedByPatientAt: prescription.signed_by_patient_at,
      signedByDoctorAt: prescription.signed_by_doctor_at,
    };
  }

  /**
   * Generate prescription PDF
   */
  async generatePrescriptionPDF(tenantDb: DataSource, prescriptionId: string): Promise<string> {
    this.ensureTenantDb(tenantDb);

    const [prescription] = await tenantDb.query(
      `SELECT tp.*,
              tc.patient_id,
              tc.doctor_id,
              p.first_name || ' ' || p.last_name as patient_name,
              u.first_name || ' ' || u.last_name as doctor_name,
              pr.medication_name,
              pr.dosage,
              pr.frequency,
              pr.duration,
              pr.instructions
       FROM telemedicine_prescriptions tp
       JOIN telemedicine_consultations tc ON tc.id = tp.consultation_id
       JOIN patients p ON p.id = tc.patient_id
       JOIN users u ON u.id = tc.doctor_id
       LEFT JOIN prescriptions pr ON pr.id = tp.prescription_id
       WHERE tp.id = $1`,
      [prescriptionId],
    );

    if (!prescription) {
      throw new NotFoundException(`Digital prescription ${prescriptionId} not found`);
    }

    // TODO: Generate PDF using pdfkit or similar
    // For now, return a placeholder URL
    const pdfUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/prescriptions/${prescriptionId}/pdf`;

    // Update prescription with PDF URL
    await tenantDb.query(
      `UPDATE telemedicine_prescriptions
       SET pdf_url = $1, updated_at = NOW()
       WHERE id = $2`,
      [pdfUrl, prescriptionId],
    );

    return pdfUrl;
  }

  /**
   * Send prescription to pharmacy
   */
  async sendPrescriptionToPharmacy(
    tenantDb: DataSource,
    prescriptionId: string,
    pharmacyId?: string,
  ) {
    this.ensureTenantDb(tenantDb);

    const [prescription] = await tenantDb.query(
      `SELECT * FROM telemedicine_prescriptions WHERE id = $1`,
      [prescriptionId],
    );

    if (!prescription) {
      throw new NotFoundException(`Digital prescription ${prescriptionId} not found`);
    }

    if (!prescription.is_valid) {
      throw new BadRequestException('Prescription must be signed by both patient and doctor before sending to pharmacy');
    }

    // TODO: Integrate with pharmacy service to send prescription
    // For now, just return success
    return {
      prescriptionId,
      pharmacyId: pharmacyId ?? 'default',
      sent: true,
      message: 'Prescription sent to pharmacy',
    };
  }
}

