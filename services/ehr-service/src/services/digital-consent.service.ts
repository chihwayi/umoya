import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import PDFDocument = require('pdfkit');
import { MinioService } from './minio.service';

@Injectable()
export class DigitalConsentService {
  private readonly logger = new Logger(DigitalConsentService.name);

  constructor(private readonly minio: MinioService) {}

  async createRequest(
    db: DataSource,
    encounterId: string,
    patientId: string,
    templateId: string,
    requestedBy: string,
  ): Promise<{ requestId: string; rawToken: string }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const [row] = await db.query(
      `INSERT INTO consent_requests
         (encounter_id, patient_id, template_id, requested_by, token_hash, expires_at, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())
       RETURNING id`,
      [encounterId, patientId, templateId, requestedBy, tokenHash, expiresAt],
    );
    return { requestId: row.id, rawToken };
  }

  async getRequestByToken(db: DataSource, rawToken: string): Promise<any> {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const [row] = await db.query(
      `SELECT cr.*, cft.procedure_name, cft.description, cft.risks, cft.benefits, cft.alternatives,
              p.first_name, p.last_name, p.date_of_birth
       FROM consent_requests cr
       JOIN consent_form_templates cft ON cft.id = cr.template_id
       JOIN patients p ON p.id = cr.patient_id
       WHERE cr.token_hash = $1`,
      [hash],
    );
    if (!row) throw new NotFoundException('Consent request not found');
    if (row.status === 'signed') throw new BadRequestException('Already signed');
    if (row.status === 'declined') throw new BadRequestException('Already declined');
    if (new Date(row.expires_at) < new Date()) throw new BadRequestException('Consent request expired');
    return row;
  }

  async sign(
    db: DataSource,
    rawToken: string,
    signatureSvg: string,
    witnessName?: string,
    patientStatement?: string,
  ): Promise<{ pdfUrl: string }> {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const [request] = await db.query(
      `SELECT cr.*, cft.procedure_name, cft.risks, cft.benefits,
              p.first_name, p.last_name
       FROM consent_requests cr
       JOIN consent_form_templates cft ON cft.id = cr.template_id
       JOIN patients p ON p.id = cr.patient_id
       WHERE cr.token_hash = $1 AND cr.status = 'pending' AND cr.expires_at > now()`,
      [hash],
    );
    if (!request) throw new BadRequestException('Invalid or expired consent token');

    const pdfBuffer = await this.buildConsentPdf(request, signatureSvg, witnessName, patientStatement);
    const pdfKey = `consent/${request.encounter_id}/${request.id}_signed.pdf`;
    await this.minio.uploadFile(pdfKey, pdfBuffer, 'application/pdf');

    await db.query(
      `UPDATE consent_requests
       SET status = 'signed', signed_at = now(),
           signature_svg = $1, pdf_key = $2,
           witness_name = $3, patient_statement = $4
       WHERE token_hash = $5`,
      [signatureSvg, pdfKey, witnessName ?? null, patientStatement ?? null, hash],
    );

    this.logger.log(`Consent signed: request=${request.id} encounter=${request.encounter_id}`);
    return { pdfUrl: await this.minio.getSignedUrl(pdfKey, 3600) };
  }

  async decline(db: DataSource, rawToken: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await db.query(
      `UPDATE consent_requests SET status = 'declined', declined_at = now() WHERE token_hash = $1`,
      [hash],
    );
  }

  async getEncounterConsents(db: DataSource, encounterId: string): Promise<any[]> {
    return db.query(
      `SELECT cr.id, cr.status, cr.signed_at, cr.declined_at, cr.expires_at,
              cft.procedure_name, cr.pdf_key
       FROM consent_requests cr
       JOIN consent_form_templates cft ON cft.id = cr.template_id
       WHERE cr.encounter_id = $1
       ORDER BY cr.created_at DESC`,
      [encounterId],
    );
  }

  async getConsentPdfUrl(db: DataSource, requestId: string): Promise<string> {
    const [row] = await db.query(
      `SELECT pdf_key FROM consent_requests WHERE id = $1 AND status = 'signed'`,
      [requestId],
    );
    if (!row?.pdf_key) throw new NotFoundException('Signed consent PDF not found');
    return this.minio.getSignedUrl(row.pdf_key, 3600);
  }

  private buildConsentPdf(
    request: any,
    signatureSvg: string,
    witnessName?: string,
    patientStatement?: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

      doc.fontSize(16).font('Helvetica-Bold').text('PATIENT CONSENT FORM', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.5);

      doc.fontSize(12).font('Helvetica-Bold').text('Procedure: ', { continued: true })
         .font('Helvetica').text(request.procedure_name);
      doc.font('Helvetica-Bold').text('Patient: ', { continued: true })
         .font('Helvetica').text(`${request.first_name} ${request.last_name}`);
      doc.font('Helvetica-Bold').text('Date: ', { continued: true })
         .font('Helvetica').text(today);
      doc.moveDown();

      doc.font('Helvetica-Bold').fontSize(11).text('RISKS');
      doc.font('Helvetica').fontSize(10).text(request.risks);
      doc.moveDown();

      doc.font('Helvetica-Bold').fontSize(11).text('BENEFITS');
      doc.font('Helvetica').fontSize(10).text(request.benefits);
      doc.moveDown();

      if (patientStatement) {
        doc.font('Helvetica-Bold').fontSize(11).text('PATIENT STATEMENT');
        doc.font('Helvetica').fontSize(10).text(patientStatement);
        doc.moveDown();
      }

      doc.font('Helvetica').fontSize(10)
         .text('I have read and understood the above information and consent to the procedure.');
      doc.moveDown(1.5);

      doc.font('Helvetica-Bold').text('Patient Signature:');
      doc.font('Helvetica').fontSize(9).text('[Electronic signature captured]');
      doc.moveDown(0.5);

      if (witnessName) {
        doc.font('Helvetica-Bold').fontSize(10).text('Witness: ', { continued: true })
           .font('Helvetica').text(witnessName);
      }

      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('grey')
         .text('This consent was completed digitally via Umoya EHR and is legally binding.', { align: 'center' });

      doc.end();
    });
  }
}
