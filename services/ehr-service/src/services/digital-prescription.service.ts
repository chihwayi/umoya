import { Injectable, Logger, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { config as envConfig } from '@medicore/config';
import PDFDocument from 'pdfkit';
import {
  CreateDigitalPrescriptionDto,
  SignPrescriptionDto,
} from '../dto/telemedicine.dto';
import { MinioService } from './minio.service';

@Injectable()
export class DigitalPrescriptionService {
  private readonly logger = new Logger(DigitalPrescriptionService.name);
  private readonly frontendUrl = String(process.env.FRONTEND_URL || envConfig.publicUrls.staffApp || '').replace(/\/+$/, '');

  constructor(@Optional() private readonly minioService?: MinioService) {}

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

    const pdfBuffer = await this.buildPrescriptionPdf(prescription);

    let pdfUrl: string;
    if (this.minioService) {
      const bucket = process.env.STORAGE_S3_BUCKET ?? 'medicore-documents';
      const key = `prescriptions/${prescriptionId}.pdf`;
      await this.minioService.uploadBuffer(bucket, key, pdfBuffer, 'application/pdf');
      pdfUrl = `${process.env.MINIO_PUBLIC_URL ?? ''}/${bucket}/${key}`;
    } else {
      // Fallback: base64 data URI (single-node, no object store)
      pdfUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
    }

    await tenantDb.query(
      `UPDATE telemedicine_prescriptions SET pdf_url = $1, updated_at = NOW() WHERE id = $2`,
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

    // Create a dispensing queue entry so the pharmacy sees this prescription
    await tenantDb.query(
      `INSERT INTO pharmacy_dispensing_queue
         (prescription_id, patient_id, pharmacy_id, queued_at, status, source)
       VALUES ($1, $2, $3, NOW(), 'pending', 'telemedicine')
       ON CONFLICT (prescription_id) DO UPDATE
         SET pharmacy_id = EXCLUDED.pharmacy_id, queued_at = NOW(), status = 'pending'`,
      [prescription.prescription_id, prescription.patient_id, pharmacyId ?? null],
    ).catch(async () => {
      // Table may not exist in older tenants — provision it inline
      await tenantDb.query(
        `CREATE TABLE IF NOT EXISTS pharmacy_dispensing_queue (
           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           prescription_id UUID NOT NULL,
           patient_id UUID,
           pharmacy_id UUID,
           queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           status VARCHAR(30) NOT NULL DEFAULT 'pending',
           source VARCHAR(50),
           UNIQUE (prescription_id)
         )`,
      );
      await tenantDb.query(
        `INSERT INTO pharmacy_dispensing_queue
           (prescription_id, patient_id, pharmacy_id, queued_at, status, source)
         VALUES ($1, $2, $3, NOW(), 'pending', 'telemedicine')
         ON CONFLICT (prescription_id) DO NOTHING`,
        [prescription.prescription_id, prescription.patient_id, pharmacyId ?? null],
      );
    });

    return {
      prescriptionId,
      pharmacyId: pharmacyId ?? 'default',
      sent: true,
      message: 'Prescription queued for pharmacy dispensing',
    };
  }

  private buildPrescriptionPdf(rx: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).font('Helvetica-Bold').text('MediCore — Digital Prescription', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
      doc.moveDown();
      doc.fontSize(12).font('Helvetica-Bold').text('Patient Information');
      doc.fontSize(11).font('Helvetica').text(`Name: ${rx.patient_name ?? 'N/A'}`);
      doc.moveDown();
      doc.fontSize(12).font('Helvetica-Bold').text('Prescribing Physician');
      doc.fontSize(11).font('Helvetica').text(`Dr. ${rx.doctor_name ?? 'N/A'}`);
      doc.moveDown();
      doc.fontSize(12).font('Helvetica-Bold').text('Medication');
      doc.fontSize(11).font('Helvetica')
        .text(`Medication: ${rx.medication_name ?? 'See attached'}`)
        .text(`Dosage:     ${rx.dosage ?? 'N/A'}`)
        .text(`Frequency:  ${rx.frequency ?? 'N/A'}`)
        .text(`Duration:   ${rx.duration ?? 'N/A'}`);
      if (rx.instructions) {
        doc.moveDown(0.3).text(`Instructions: ${rx.instructions}`);
      }
      doc.moveDown(2);
      if (rx.e_signature_doctor) {
        doc.fontSize(10).text('Physician signature on file (digital)', { align: 'right' });
      }
      doc.end();
    });
  }
}
