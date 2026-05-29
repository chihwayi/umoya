import { Injectable, Logger } from '@nestjs/common';
import { CdssService } from './cdss.service';
import { TenantService } from './tenant.service';
import { MinioService } from './minio.service';
import { RegistrationAiSession } from '../entities/registration-ai-session.entity';
import { InsuranceOcrResult } from '../entities/insurance-ocr-result.entity';
import * as crypto from 'crypto';

export interface PhoneticMatch {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phoneNumber: string | null;
  similarity: number;
}

@Injectable()
export class RegistrationAiService {
  private readonly logger = new Logger(RegistrationAiService.name);

  constructor(
    private readonly cdssService: CdssService,
    private readonly tenantService: TenantService,
    private readonly minioService: MinioService,
  ) {}

  /**
   * Find phonetically similar patients to detect potential duplicates.
   * Uses PostgreSQL pg_trgm SIMILARITY() + SOUNDEX fallback.
   * Returns matches with similarity > 0.70.
   */
  async findPhoneticMatches(
    firstName: string,
    lastName: string,
    tenantId: string,
    dateOfBirth?: string,
  ): Promise<PhoneticMatch[]> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) return [];

    try {
      let query = `
        SELECT
          id,
          first_name,
          last_name,
          date_of_birth,
          phone_number,
          (
            SIMILARITY(LOWER(first_name), LOWER($1)) * 0.4 +
            SIMILARITY(LOWER(last_name), LOWER($2)) * 0.6
          ) AS similarity
        FROM patients
        WHERE
          SIMILARITY(LOWER(last_name), LOWER($2)) > 0.5
          OR SOUNDEX(last_name) = SOUNDEX($2)
      `;
      const params: (string | undefined)[] = [firstName, lastName];

      if (dateOfBirth) {
        query += ` AND (date_of_birth = $3 OR date_of_birth IS NULL)`;
        params.push(dateOfBirth);
      }

      query += ` ORDER BY similarity DESC LIMIT 10`;

      const rows = await tenantDb.query(query, params);

      return rows
        .filter((r: any) => Number(r.similarity) > 0.70)
        .map((r: any) => ({
          id: r.id,
          firstName: r.first_name,
          lastName: r.last_name,
          dateOfBirth: r.date_of_birth,
          phoneNumber: r.phone_number ?? null,
          similarity: Number(r.similarity),
        }));
    } catch (err) {
      // pg_trgm may not be installed — fall back gracefully
      this.logger.warn(`Phonetic search failed (pg_trgm unavailable?): ${err}`);
      return [];
    }
  }

  /**
   * Upload insurance card image to MinIO, then OCR via CDSS.
   */
  async ocrInsuranceCard(
    imageBuffer: Buffer,
    mimeType: string,
    sessionToken: string,
    tenantId: string,
  ): Promise<InsuranceOcrResult> {
    const bucket = process.env.MINIO_BUCKET ?? 'umoya-dicom';
    const objectKey = `registration/insurance-cards/${sessionToken}/${Date.now()}`;

    await this.minioService.uploadBuffer(bucket, objectKey, imageBuffer, mimeType);

    const imageBase64 = imageBuffer.toString('base64');
    const result = await this.cdssService.ocrInsuranceCard(imageBase64, tenantId);

    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new Error(`Tenant database not found for tenantId: ${tenantId}`);
    }

    const ocrRepo = tenantDb.getRepository(InsuranceOcrResult);
    const ocrResult = ocrRepo.create({
      patientId: null,
      sessionToken,
      minioObjectKey: objectKey,
      memberId: result.member_id ?? null,
      groupNumber: result.group_number ?? null,
      planName: result.plan_name ?? null,
      payerName: result.payer_name ?? null,
      effectiveDate: result.effective_date ?? null,
      expiryDate: result.expiry_date ?? null,
      rawOcrJson: result as unknown as Record<string, unknown>,
      confidence: result.confidence ?? 0,
    });

    return ocrRepo.save(ocrResult);
  }

  /**
   * Fetch SDOH questionnaire from CDSS.
   */
  async getSdohQuestions(tenantId: string): Promise<unknown[]> {
    try {
      const result = await this.cdssService.getSdohQuestions(tenantId);
      return result.questions ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Score SDOH answers and persist a screening record.
   */
  async scoreSdohAnswers(
    patientId: string,
    answers: Record<string, number>,
    conductedByUserId: string,
    tenantId: string,
  ): Promise<{ riskFactors: string[]; overallRiskLevel: string; referrals: unknown[] }> {
    const result = await this.cdssService.scoreSdoh(
      { patient_id: patientId, answers },
      tenantId,
    );

    const riskFactors: string[] = result.risk_factors ?? [];

    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (tenantDb && (riskFactors.length > 0 || Object.keys(answers).length > 0)) {
      await tenantDb.query(
        `INSERT INTO sdoh_screening_logs
           (id, patient_id, screening_date, tool_used, responses, positive_screens, conducted_by, created_at)
         VALUES
           (gen_random_uuid(), $1, NOW()::date, 'AHC_HRSN_v1', $2::jsonb, $3::jsonb, $4, NOW())`,
        [
          patientId,
          JSON.stringify(answers),
          JSON.stringify(riskFactors.map((factor) => ({ domain: factor }))),
          conductedByUserId,
        ],
      );
    }

    return {
      riskFactors,
      overallRiskLevel: result.overall_risk_level ?? 'low',
      referrals: result.referrals ?? [],
    };
  }

  createSessionToken(): string {
    return crypto.randomBytes(24).toString('hex');
  }
}
