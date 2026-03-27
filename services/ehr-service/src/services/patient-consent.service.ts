import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PatientConsent } from '../entities/patient-consent.entity';
import { ConsentSignature } from '../entities/consent-signature.entity';
import { ConsentTemplate } from '../entities/consent-template.entity';
import {
  CreatePatientConsentDto,
  SignConsentDto,
  DeclineConsentDto,
  RevokeConsentDto,
  ConsentQueryDto,
  ConsentStatus,
} from '../dto/consent.dto';

@Injectable()
export class PatientConsentService {
  private readonly logger = new Logger(PatientConsentService.name);

  private async generateConsentNumber(tenantDb: DataSource): Promise<string> {
    const [result] = await tenantDb.query(
      `SELECT COUNT(*) as count FROM patient_consents WHERE consent_number LIKE 'CNS-%'`,
    );
    const count = parseInt(result.count) + 1;
    return `CNS-${new Date().getFullYear()}-${count.toString().padStart(6, '0')}`;
  }

  async createConsent(
    consentData: CreatePatientConsentDto,
    userId: string,
    ipAddress: string,
    userAgent: string,
    tenantDb: DataSource,
  ): Promise<PatientConsent> {
    const consentRepo = tenantDb.getRepository(PatientConsent);
    const templateRepo = tenantDb.getRepository(ConsentTemplate);

    // Get template
    const template = await templateRepo.findOne({
      where: { id: consentData.templateId },
    });

    if (!template) {
      throw new NotFoundException(`Consent template not found: ${consentData.templateId}`);
    }

    if (!template.isActive) {
      throw new BadRequestException('Template is not active');
    }

    // Generate consent number
    const consentNumber = await this.generateConsentNumber(tenantDb);

    // Replace placeholders in content
    let content = template.content;
    let title = template.title;

    if (consentData.filledFields) {
      Object.keys(consentData.filledFields).forEach((key) => {
        const placeholder = `{{${key}}}`;
        const value = consentData.filledFields[key] || '';
        content = content.replace(new RegExp(placeholder, 'g'), value);
        title = title.replace(new RegExp(placeholder, 'g'), value);
      });
    }

    // Calculate validity dates
    const validFrom = new Date();
    let validUntil: Date | null = null;
    if (template.validityPeriodDays) {
      validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + template.validityPeriodDays);
    }

    const consent = consentRepo.create({
      consentNumber,
      patientId: consentData.patientId,
      templateId: template.id,
      templateVersion: template.version,
      consentType: template.consentType,
      appointmentId: consentData.appointmentId,
      procedureId: consentData.procedureId,
      title,
      content,
      filledFields: consentData.filledFields || {},
      status: ConsentStatus.PENDING,
      languageCode: template.languageCode,
      validFrom,
      validUntil,
      location: consentData.location,
      ipAddress,
      userAgent,
      presentedBy: userId,
      presentedAt: new Date(),
      notes: consentData.notes,
      // Medical coding fields
      procedureSnomedCode: consentData.procedureSnomedCode,
      procedureCptCode: consentData.procedureCptCode,
      diagnosisIcd10: consentData.diagnosisIcd10,
      diagnosisSnomed: consentData.diagnosisSnomed,
    });

    const saved = await consentRepo.save(consent);

    // Log audit trail
    await this.logAudit(saved.id, 'created', userId, ipAddress, userAgent, {}, tenantDb);

    this.logger.log(`Patient consent created: ${saved.id} for patient ${consentData.patientId}`);
    return saved;
  }

  async getPatientConsents(
    patientId: string,
    filters: ConsentQueryDto,
    tenantDb: DataSource,
  ): Promise<{ consents: PatientConsent[]; total: number }> {
    const repository = tenantDb.getRepository(PatientConsent);
    const queryBuilder = repository
      .createQueryBuilder('consent')
      .leftJoinAndSelect('consent.signatures', 'signatures')
      .leftJoinAndSelect('consent.template', 'template')
      .where('consent.patientId = :patientId', { patientId });

    if (filters.consentType) {
      queryBuilder.andWhere('consent.consentType = :consentType', {
        consentType: filters.consentType,
      });
    }

    if (filters.status) {
      queryBuilder.andWhere('consent.status = :status', { status: filters.status });
    }

    if (filters.search) {
      queryBuilder.andWhere('(consent.title ILIKE :search OR consent.consentNumber ILIKE :search)', {
        search: `%${filters.search}%`,
      });
    }

    queryBuilder.orderBy('consent.createdAt', 'DESC');

    if (filters.limit) {
      queryBuilder.take(filters.limit);
    }

    if (filters.offset) {
      queryBuilder.skip(filters.offset);
    }

    const [consents, total] = await queryBuilder.getManyAndCount();

    return { consents, total };
  }

  async getConsentById(id: string, tenantDb: DataSource): Promise<PatientConsent> {
    const repository = tenantDb.getRepository(PatientConsent);
    const consent = await repository.findOne({
      where: { id },
      relations: ['signatures', 'template', 'patient', 'presentedByUser'],
    });

    if (!consent) {
      throw new NotFoundException(`Consent not found: ${id}`);
    }

    return consent;
  }

  async presentConsent(
    id: string,
    presentedBy: string,
    ipAddress: string,
    userAgent: string,
    tenantDb: DataSource,
  ): Promise<PatientConsent> {
    const repository = tenantDb.getRepository(PatientConsent);
    const consent = await this.getConsentById(id, tenantDb);

    consent.presentedBy = presentedBy;
    consent.presentedAt = new Date();

    const updated = await repository.save(consent);

    await this.logAudit(id, 'presented', presentedBy, ipAddress, userAgent, {}, tenantDb);

    return updated;
  }

  async signConsent(
    id: string,
    signatureData: SignConsentDto,
    userId: string,
    ipAddress: string,
    userAgent: string,
    tenantDb: DataSource,
  ): Promise<PatientConsent> {
    const consentRepo = tenantDb.getRepository(PatientConsent);
    const signatureRepo = tenantDb.getRepository(ConsentSignature);

    const consent = await this.getConsentById(id, tenantDb);

    if (consent.status !== ConsentStatus.PENDING) {
      throw new BadRequestException(`Cannot sign consent with status: ${consent.status}`);
    }

    // Create signature
    const signature = signatureRepo.create({
      consentId: id,
      signerRole: signatureData.signerRole,
      signerId: userId,
      signerName: signatureData.signerName,
      signerRelationship: signatureData.signerRelationship,
      signatureType: signatureData.signatureType,
      signatureData: signatureData.signatureData,
      signatureMethod: signatureData.signatureMethod,
      ipAddress,
      userAgent,
      geolocation: signatureData.geolocation,
      deviceInfo: signatureData.deviceInfo,
      verificationCode: signatureData.verificationCode,
    });

    await signatureRepo.save(signature);

    // Check if all required signatures are collected
    const allSignatures = await signatureRepo.find({ where: { consentId: id } });
    const template = await tenantDb.getRepository(ConsentTemplate).findOne({
      where: { id: consent.templateId },
    });

    if (template) {
      const requirements = template.signatureRequirements;
      const hasPatient = requirements.patient
        ? allSignatures.some((s) => s.signerRole === 'patient')
        : true;
      const hasGuardian = requirements.guardian
        ? allSignatures.some((s) => s.signerRole === 'guardian')
        : true;
      const hasWitness = requirements.witness
        ? allSignatures.some((s) => s.signerRole === 'witness')
        : true;
      const hasProvider = requirements.provider
        ? allSignatures.some((s) => s.signerRole === 'provider')
        : true;

      if (hasPatient && hasGuardian && hasWitness && hasProvider) {
        consent.status = ConsentStatus.SIGNED;
        consent.signedAt = new Date();
        consent.consentDate = new Date();
      }
    }

    const updated = await consentRepo.save(consent);

    await this.logAudit(
      id,
      'signed',
      userId,
      ipAddress,
      userAgent,
      { signerRole: signatureData.signerRole },
      tenantDb,
    );

    this.logger.log(`Consent signed: ${id} by ${signatureData.signerRole}`);
    return updated;
  }

  async declineConsent(
    id: string,
    declineData: DeclineConsentDto,
    userId: string,
    ipAddress: string,
    userAgent: string,
    tenantDb: DataSource,
  ): Promise<PatientConsent> {
    const repository = tenantDb.getRepository(PatientConsent);
    const consent = await this.getConsentById(id, tenantDb);

    if (consent.status !== ConsentStatus.PENDING) {
      throw new BadRequestException(`Cannot decline consent with status: ${consent.status}`);
    }

    consent.status = ConsentStatus.DECLINED;
    consent.declinedAt = new Date();
    consent.declineReason = declineData.reason;

    const updated = await repository.save(consent);

    await this.logAudit(
      id,
      'declined',
      userId,
      ipAddress,
      userAgent,
      { reason: declineData.reason },
      tenantDb,
    );

    this.logger.log(`Consent declined: ${id}`);
    return updated;
  }

  async revokeConsent(
    id: string,
    revokeData: RevokeConsentDto,
    userId: string,
    ipAddress: string,
    userAgent: string,
    tenantDb: DataSource,
  ): Promise<PatientConsent> {
    const repository = tenantDb.getRepository(PatientConsent);
    const consent = await this.getConsentById(id, tenantDb);

    if (consent.status !== ConsentStatus.SIGNED) {
      throw new BadRequestException('Only signed consents can be revoked');
    }

    consent.status = ConsentStatus.REVOKED;
    consent.revokedAt = new Date();
    consent.revocationReason = revokeData.reason;
    consent.revokedBy = userId;

    const updated = await repository.save(consent);

    await this.logAudit(
      id,
      'revoked',
      userId,
      ipAddress,
      userAgent,
      { reason: revokeData.reason },
      tenantDb,
    );

    this.logger.log(`Consent revoked: ${id} by user ${userId}`);
    return updated;
  }

  async checkConsentValidity(id: string, tenantDb: DataSource): Promise<{ isValid: boolean; reason?: string }> {
    const consent = await this.getConsentById(id, tenantDb);

    if (consent.status !== ConsentStatus.SIGNED) {
      return { isValid: false, reason: `Consent status is ${consent.status}` };
    }

    if (consent.validUntil && new Date() > consent.validUntil) {
      // Auto-expire
      const repository = tenantDb.getRepository(PatientConsent);
      consent.status = ConsentStatus.EXPIRED;
      await repository.save(consent);

      return { isValid: false, reason: 'Consent has expired' };
    }

    return { isValid: true };
  }

  async getActiveConsents(
    patientId: string,
    consentType: string,
    tenantDb: DataSource,
  ): Promise<PatientConsent[]> {
    const repository = tenantDb.getRepository(PatientConsent);
    const consents = await repository.find({
      where: {
        patientId,
        consentType,
        status: ConsentStatus.SIGNED,
      },
      relations: ['signatures'],
      order: { signedAt: 'DESC' },
    });

    // Filter out expired consents
    const validConsents = [];
    for (const consent of consents) {
      const validity = await this.checkConsentValidity(consent.id, tenantDb);
      if (validity.isValid) {
        validConsents.push(consent);
      }
    }

    return validConsents;
  }

  async exportConsent(
    id: string,
    format: 'pdf' | 'json',
    userId: string,
    ipAddress: string,
    userAgent: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const consent = await this.getConsentById(id, tenantDb);

    await this.logAudit(id, 'exported', userId, ipAddress, userAgent, { format }, tenantDb);

    if (format === 'json') {
      return consent;
    }

    // PDF generation would be handled by a separate PDF service
    // For now, return structured data for PDF generation
    return {
      consentNumber: consent.consentNumber,
      title: consent.title,
      content: consent.content,
      patient: consent.patient,
      signatures: consent.signatures,
      signedAt: consent.signedAt,
      validFrom: consent.validFrom,
      validUntil: consent.validUntil,
    };
  }

  async getConsentHistory(
    patientId: string,
    tenantDb: DataSource,
  ): Promise<{ consents: PatientConsent[]; auditLog: any[] }> {
    const { consents } = await this.getPatientConsents(patientId, {}, tenantDb);

    const auditLog = await tenantDb.query(
      `
      SELECT cal.*, u.first_name, u.last_name
      FROM consent_audit_log cal
      LEFT JOIN users u ON u.id = cal.performed_by
      WHERE cal.consent_id IN (
        SELECT id FROM patient_consents WHERE patient_id = $1
      )
      ORDER BY cal.performed_at DESC
      LIMIT 100
    `,
      [patientId],
    );

    return { consents, auditLog };
  }

  private async logAudit(
    consentId: string,
    action: string,
    performedBy: string,
    ipAddress: string,
    userAgent: string,
    details: Record<string, any>,
    tenantDb: DataSource,
  ): Promise<void> {
    await tenantDb.query(
      `
      INSERT INTO consent_audit_log (
        consent_id, action, performed_by, ip_address, user_agent, details
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [consentId, action, performedBy, ipAddress, userAgent, JSON.stringify(details)],
    );
  }

  async sendConsentReminder(
    patientId: string,
    consentType: string,
    templateId: string,
    dueDate: Date,
    reason: string,
    tenantDb: DataSource,
  ): Promise<void> {
    await tenantDb.query(
      `
      INSERT INTO consent_reminders (
        patient_id, consent_type, template_id, due_date, reminder_reason
      ) VALUES ($1, $2, $3, $4, $5)
    `,
      [patientId, consentType, templateId, dueDate, reason],
    );

    this.logger.log(`Consent reminder created for patient ${patientId}`);
  }

  async checkExpiredConsents(tenantDb: DataSource): Promise<number> {
    const result = await tenantDb.query(
      `
      UPDATE patient_consents
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'signed'
        AND valid_until IS NOT NULL
        AND valid_until < NOW()
      RETURNING id
    `,
    );

    const expiredCount = result.length;
    if (expiredCount > 0) {
      this.logger.log(`Expired ${expiredCount} consents`);
    }

    return expiredCount;
  }

  async checkAiConsent(patientId: string, consentType: string, tenantDb: DataSource): Promise<boolean> {
    const repository = tenantDb.getRepository(PatientConsent);
    const consent = await repository.findOne({
      where: {
        patientId,
        consentType,
        status: ConsentStatus.SIGNED,
      },
    });
    if (!consent) return true;
    return consent.status === ConsentStatus.SIGNED;
  }

  async requireAiConsent(patientId: string, consentType: string, tenantDb: DataSource): Promise<void> {
    const allowed = await this.checkAiConsent(patientId, consentType, tenantDb);
    if (!allowed) {
      throw new ForbiddenException(
        `Patient ${patientId} has not consented to AI processing type: ${consentType}`
      );
    }
  }
}

