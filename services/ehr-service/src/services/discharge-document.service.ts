import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import PDFDocument = require('pdfkit');
import { MinioService } from './minio.service';
import { SmsService } from './sms.service';
import { PrescriptionPdfService } from './prescription-pdf.service';

@Injectable()
export class DischargeDocumentService {
  private readonly logger = new Logger(DischargeDocumentService.name);

  constructor(
    private readonly minio: MinioService,
    private readonly sms: SmsService,
    private readonly prescriptionPdf: PrescriptionPdfService,
  ) {}

  async finaliseAndSend(
    tenantDb: DataSource,
    encounterId: string,
    signedByUserId: string,
    subdomain: string,
  ): Promise<{ documentsCreated: number }> {
    const [encounter] = await tenantDb.query(
      `SELECT e.*,
              p.id           AS patient_id,
              p.first_name,  p.last_name,    p.date_of_birth,
              p.gender,      p.phone,        p.address,
              p.preferred_language,
              u.first_name   AS doctor_first_name,
              u.last_name    AS doctor_last_name,
              u.specialization
       FROM encounters e
       JOIN patients p ON p.id = e.patient_id
       LEFT JOIN users u ON u.id = $2
       WHERE e.id = $1`,
      [encounterId, signedByUserId],
    );
    if (!encounter) throw new NotFoundException(`Encounter ${encounterId} not found`);

    const language = encounter.preferred_language || 'en';
    let docsCreated = 0;

    // 1. Discharge Summary — built from diagnoses, vitals, and plan
    const summaryData = await this.fetchDischargeSummaryData(tenantDb, encounterId, encounter);
    const summaryPdf = await this.buildDischargeSummaryPdf(summaryData);
    const summaryPath = `discharge/${encounterId}/discharge_summary.pdf`;
    await this.minio.uploadFile(summaryPath, summaryPdf, 'application/pdf');
    await this.insertDocRecord(tenantDb, encounter.patient_id, encounterId, 'discharge_summary', summaryPath, 'Discharge_Summary.pdf', language, signedByUserId);
    docsCreated++;

    // 2. Prescriptions — delegate to existing PrescriptionPdfService
    const rxRows = await tenantDb.query(
      `SELECT id FROM prescriptions WHERE encounter_id = $1 ORDER BY created_at LIMIT 1`,
      [encounterId],
    );
    if (rxRows.length > 0) {
      const { buffer: rxPdf } = await this.prescriptionPdf.generatePrescriptionPDF(tenantDb, rxRows[0].id);
      const rxPath = `discharge/${encounterId}/prescriptions.pdf`;
      await this.minio.uploadFile(rxPath, rxPdf, 'application/pdf');
      await this.insertDocRecord(tenantDb, encounter.patient_id, encounterId, 'prescription', rxPath, 'Prescriptions.pdf', language, signedByUserId);
      docsCreated++;
    }

    // 3. Sick note — built from sick_notes table
    const [sickNote] = await tenantDb.query(
      `SELECT sn.*, u.first_name || ' ' || u.last_name AS doctor_name,
              u.qualification, u.license_number, u.hpcz_number
       FROM sick_notes sn
       LEFT JOIN users u ON u.id = sn.issued_by
       WHERE sn.encounter_id = $1`,
      [encounterId],
    );
    if (sickNote) {
      const snPdf = await this.buildSickNotePdf(sickNote, encounter);
      const snPath = `discharge/${encounterId}/sick_note.pdf`;
      await this.minio.uploadFile(snPath, snPdf, 'application/pdf');
      await this.insertDocRecord(tenantDb, encounter.patient_id, encounterId, 'sick_note', snPath, 'Sick_Note.pdf', language, signedByUserId);
      docsCreated++;
    }

    // 4. Follow-up plan — built from follow_up_plans and referrals
    const followupData = await this.fetchFollowUpData(tenantDb, encounterId, encounter);
    const followupPdf = await this.buildFollowUpPdf(followupData);
    const followupPath = `discharge/${encounterId}/follow_up.pdf`;
    await this.minio.uploadFile(followupPath, followupPdf, 'application/pdf');
    await this.insertDocRecord(tenantDb, encounter.patient_id, encounterId, 'follow_up_plan', followupPath, 'Follow_Up_Plan.pdf', language, signedByUserId);
    docsCreated++;

    await tenantDb.query(
      `UPDATE encounters SET finalized_at = now(), finalized_by = $1, discharge_sent = TRUE, updated_at = now()
       WHERE id = $2`,
      [signedByUserId, encounterId],
    );

    if (encounter.phone) {
      const portalLink = `https://${subdomain}.umoya.app/my-health/discharge/${encounterId}`;
      await this.sms.send(
        encounter.phone,
        `Hi ${encounter.first_name}, your discharge documents are ready: ${portalLink}`,
      );
    }

    this.logger.log(`Discharge finalized for encounter ${encounterId}: ${docsCreated} documents sent`);
    return { documentsCreated: docsCreated };
  }

  async listForPatient(tenantDb: DataSource, patientId: string): Promise<any[]> {
    return tenantDb.query(
      `SELECT pdd.*, e.encounter_date, u.first_name || ' ' || u.last_name AS signed_by_name
       FROM patient_discharge_documents pdd
       JOIN encounters e ON e.id = pdd.encounter_id
       LEFT JOIN users u ON u.id = pdd.signed_by
       WHERE pdd.patient_id = $1
       ORDER BY pdd.created_at DESC`,
      [patientId],
    );
  }

  async getDownloadUrl(
    tenantDb: DataSource,
    documentId: string,
    patientId: string,
  ): Promise<string> {
    const [doc] = await tenantDb.query(
      `SELECT * FROM patient_discharge_documents WHERE id = $1 AND patient_id = $2`,
      [documentId, patientId],
    );
    if (!doc) throw new NotFoundException('Document not found');

    if (!doc.downloaded_at) {
      await tenantDb.query(
        `UPDATE patient_discharge_documents SET downloaded_at = now() WHERE id = $1`,
        [documentId],
      );
    }

    return this.minio.getSignedUrl(doc.storage_path, 3600);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async fetchDischargeSummaryData(tenantDb: DataSource, encounterId: string, encounter: any) {
    const [diagnoses, vitals, allergies, medications, plan] = await Promise.all([
      tenantDb.query(
        `SELECT d.code, d.description, d.diagnosis_type
         FROM diagnoses d WHERE d.encounter_id = $1 ORDER BY d.created_at`,
        [encounterId],
      ),
      tenantDb.query(
        `SELECT v.recorded_at, v.weight_kg, v.height_cm, v.bp_systolic, v.bp_diastolic,
                v.pulse_bpm, v.temperature_c, v.spo2_pct, v.respiratory_rate
         FROM vitals v WHERE v.encounter_id = $1 ORDER BY v.recorded_at DESC LIMIT 1`,
        [encounterId],
      ),
      tenantDb.query(
        `SELECT allergen, severity, reaction_type FROM patient_allergies
         WHERE patient_id = $1 AND status = 'active'`,
        [encounter.patient_id],
      ),
      tenantDb.query(
        `SELECT drug_name, dose, frequency, route, status
         FROM active_medications WHERE patient_id = $1 AND status = 'active'`,
        [encounter.patient_id],
      ),
      tenantDb.query(
        `SELECT management_plan, assessment_notes FROM encounters WHERE id = $1`,
        [encounterId],
      ),
    ]);

    return { encounter, diagnoses, vitals: vitals[0] ?? null, allergies, medications, plan: plan[0] ?? null };
  }

  private async fetchFollowUpData(tenantDb: DataSource, encounterId: string, encounter: any) {
    const [followUps, referrals] = await Promise.all([
      tenantDb.query(
        `SELECT fp.follow_up_date, fp.reason, fp.provider_name, fp.instructions
         FROM follow_up_plans fp WHERE fp.encounter_id = $1`,
        [encounterId],
      ),
      tenantDb.query(
        `SELECT r.referral_to, r.reason, r.urgency, r.notes
         FROM referrals r WHERE r.encounter_id = $1`,
        [encounterId],
      ),
    ]);
    return { encounter, followUps, referrals };
  }

  private buildDischargeSummaryPdf(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { encounter, diagnoses, vitals, allergies, medications, plan } = data;
      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

      doc.fontSize(16).font('Helvetica-Bold').text('DISCHARGE SUMMARY', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Umoya EHR', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').text('Patient: ', { continued: true })
         .font('Helvetica').text(`${encounter.first_name} ${encounter.last_name}`);
      if (encounter.date_of_birth) {
        doc.font('Helvetica-Bold').text('DOB: ', { continued: true })
           .font('Helvetica').text(new Date(encounter.date_of_birth).toLocaleDateString('en-GB'));
      }
      doc.font('Helvetica-Bold').text('Date: ', { continued: true })
         .font('Helvetica').text(today);
      if (encounter.doctor_first_name) {
        doc.font('Helvetica-Bold').text('Clinician: ', { continued: true })
           .font('Helvetica').text(`${encounter.doctor_first_name} ${encounter.doctor_last_name}${encounter.specialization ? ` (${encounter.specialization})` : ''}`);
      }
      doc.moveDown();

      if (diagnoses.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).text('DIAGNOSES');
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);
        doc.font('Helvetica').fontSize(10);
        diagnoses.forEach((d: any) => {
          doc.text(`• ${d.description}${d.code ? ` (${d.code})` : ''}${d.diagnosis_type ? ` — ${d.diagnosis_type}` : ''}`);
        });
        doc.moveDown();
      }

      if (vitals) {
        doc.font('Helvetica-Bold').fontSize(11).text('VITALS AT ENCOUNTER');
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);
        doc.font('Helvetica').fontSize(10);
        if (vitals.bp_systolic) doc.text(`BP: ${vitals.bp_systolic}/${vitals.bp_diastolic} mmHg`);
        if (vitals.pulse_bpm) doc.text(`Pulse: ${vitals.pulse_bpm} bpm`);
        if (vitals.temperature_c) doc.text(`Temp: ${vitals.temperature_c}°C`);
        if (vitals.spo2_pct) doc.text(`SpO2: ${vitals.spo2_pct}%`);
        if (vitals.weight_kg) doc.text(`Weight: ${vitals.weight_kg} kg`);
        doc.moveDown();
      }

      if (allergies.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).text('KNOWN ALLERGIES');
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);
        doc.font('Helvetica').fontSize(10);
        allergies.forEach((a: any) => {
          doc.text(`• ${a.allergen} — ${a.severity?.toUpperCase() ?? 'UNKNOWN'} (${a.reaction_type ?? 'unspecified reaction'})`);
        });
        doc.moveDown();
      }

      if (medications.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).text('CURRENT MEDICATIONS');
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);
        doc.font('Helvetica').fontSize(10);
        medications.forEach((m: any) => {
          doc.text(`• ${m.drug_name} ${m.dose ?? ''} ${m.frequency ?? ''} ${m.route ? `(${m.route})` : ''}`);
        });
        doc.moveDown();
      }

      if (plan?.management_plan) {
        doc.font('Helvetica-Bold').fontSize(11).text('MANAGEMENT PLAN');
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);
        doc.font('Helvetica').fontSize(10).text(plan.management_plan);
        doc.moveDown();
      }

      doc.fontSize(9).fillColor('grey')
         .text('This document was generated electronically by Umoya EHR and is valid without a handwritten signature.', { align: 'center' });

      doc.end();
    });
  }

  private buildSickNotePdf(sickNote: any, encounter: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

      doc.fontSize(16).font('Helvetica-Bold').text('MEDICAL CERTIFICATE / SICK NOTE', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.5);

      doc.font('Helvetica').fontSize(11)
         .text(`This is to certify that `)
         .font('Helvetica-Bold').text(`${encounter.first_name} ${encounter.last_name}`, { continued: false });

      if (encounter.date_of_birth) {
        doc.font('Helvetica').text(`Date of Birth: ${new Date(encounter.date_of_birth).toLocaleDateString('en-GB')}`);
      }

      doc.moveDown(0.5).font('Helvetica')
         .text(`was examined on ${today} and is unfit for duty`);

      if (sickNote.days_off) {
        doc.text(`for a period of ${sickNote.days_off} day(s)`);
      }
      if (sickNote.start_date) {
        doc.text(`from ${new Date(sickNote.start_date).toLocaleDateString('en-GB')}` +
                 (sickNote.end_date ? ` to ${new Date(sickNote.end_date).toLocaleDateString('en-GB')}` : ''));
      }
      if (sickNote.diagnosis || sickNote.reason) {
        doc.moveDown(0.5).text(`Reason: ${sickNote.diagnosis ?? sickNote.reason}`);
      }

      doc.moveDown(1.5);
      if (sickNote.doctor_name) {
        doc.font('Helvetica-Bold').text(sickNote.doctor_name);
        if (sickNote.qualification) doc.font('Helvetica').text(sickNote.qualification);
        if (sickNote.hpcz_number) doc.text(`HPCZ Reg: ${sickNote.hpcz_number}`);
        else if (sickNote.license_number) doc.text(`Licence: ${sickNote.license_number}`);
      }
      doc.moveDown().text(today);

      doc.end();
    });
  }

  private buildFollowUpPdf(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { encounter, followUps, referrals } = data;
      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

      doc.fontSize(16).font('Helvetica-Bold').text('FOLLOW-UP PLAN', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Umoya EHR', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.5);

      doc.font('Helvetica-Bold').text('Patient: ', { continued: true })
         .font('Helvetica').text(`${encounter.first_name} ${encounter.last_name}`);
      doc.font('Helvetica-Bold').text('Date issued: ', { continued: true })
         .font('Helvetica').text(today);
      doc.moveDown();

      if (followUps.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).text('SCHEDULED FOLLOW-UPS');
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);
        doc.font('Helvetica').fontSize(10);
        followUps.forEach((f: any) => {
          doc.text(`• ${f.follow_up_date ? new Date(f.follow_up_date).toLocaleDateString('en-GB') : 'TBD'} — ${f.reason ?? ''}`);
          if (f.provider_name) doc.text(`  With: ${f.provider_name}`, { indent: 12 });
          if (f.instructions) doc.text(`  Instructions: ${f.instructions}`, { indent: 12 });
        });
        doc.moveDown();
      }

      if (referrals.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).text('REFERRALS');
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);
        doc.font('Helvetica').fontSize(10);
        referrals.forEach((r: any) => {
          doc.text(`• Referred to: ${r.referral_to}${r.urgency ? ` (${r.urgency})` : ''}`);
          if (r.reason) doc.text(`  Reason: ${r.reason}`, { indent: 12 });
          if (r.notes) doc.text(`  Notes: ${r.notes}`, { indent: 12 });
        });
        doc.moveDown();
      }

      if (followUps.length === 0 && referrals.length === 0) {
        doc.font('Helvetica').fontSize(10)
           .text('No specific follow-up appointments or referrals scheduled at this time.');
        doc.text('Please contact the clinic if your condition worsens or does not improve.');
        doc.moveDown();
      }

      doc.fontSize(9).fillColor('grey')
         .text('This document was generated electronically by Umoya EHR.', { align: 'center' });

      doc.end();
    });
  }

  private async insertDocRecord(
    tenantDb: DataSource,
    patientId: string,
    encounterId: string,
    type: string,
    path: string,
    fileName: string,
    language: string,
    signedBy: string,
  ): Promise<void> {
    await tenantDb.query(
      `INSERT INTO patient_discharge_documents
         (patient_id, encounter_id, document_type, storage_path, file_name, language, signed_by, signed_at, pushed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())`,
      [patientId, encounterId, type, path, fileName, language, signedBy],
    );
  }
}
