import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { NcidRegistration } from '../entities/ncid-registration.entity';
import { NcidDuplicateFlag } from '../entities/ncid-duplicate-flag.entity';
import { NcidProgrammeLinkage } from '../entities/ncid-programme-linkage.entity';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';

@Injectable()
export class NcidService {
  private readonly logger = new Logger(NcidService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  private async tenantDb(tenantId: string): Promise<DataSource> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) {
      throw new NotFoundException('Tenant database unavailable');
    }
    return db;
  }

  hashId(idNumber: string): string {
    return crypto.createHash('sha256').update(idNumber.toUpperCase().trim()).digest('hex');
  }

  async validateIdFormat(
    tenantId: string,
    dto: { countryCode: string; idType: string; idNumber: string },
  ): Promise<{
    valid: boolean;
    formattedNumber?: string | null;
    errorMessage?: string | null;
    checkDigitValid?: boolean | null;
  }> {
    const raw = await this.cdssService.ncidValidateId(
      {
        id_type: dto.idType,
        id_number: dto.idNumber,
        country_code: dto.countryCode,
      },
      tenantId,
    );
    return {
      valid: raw?.valid === true,
      formattedNumber: raw?.formatted_number ?? null,
      errorMessage: raw?.error_message ?? null,
      checkDigitValid:
        raw?.check_digit_valid !== undefined && raw?.check_digit_valid !== null
          ? Boolean(raw.check_digit_valid)
          : null,
    };
  }

  async registerNcid(
    tenantId: string,
    dto: {
      patientId: string;
      countryCode: string;
      idType: string;
      idNumber: string;
      isPrimary?: boolean;
      verificationMethod?: string;
      verifiedBy?: string;
    },
  ): Promise<NcidRegistration> {
    const validation = await this.validateIdFormat(tenantId, {
      countryCode: dto.countryCode,
      idType: dto.idType,
      idNumber: dto.idNumber,
    });
    if (!validation.valid) {
      throw new BadRequestException(validation.errorMessage || 'Invalid national ID format');
    }

    const formatted = validation.formattedNumber ?? dto.idNumber.trim();
    const hash = this.hashId(formatted);
    const db = await this.tenantDb(tenantId);
    const repo = db.getRepository(NcidRegistration);

    const collision = await repo.findOne({
      where: {
        idNumberHash: hash,
        idType: dto.idType,
        countryCode: dto.countryCode.toUpperCase(),
      },
    });
    if (collision && collision.patientId !== dto.patientId) {
      throw new ConflictException(
        'This national ID is already linked to another patient in this tenant.',
      );
    }

    if (dto.isPrimary) {
      await repo.update({ patientId: dto.patientId }, { isPrimary: false });
    }

    const reg = repo.create({
      patientId: dto.patientId,
      countryCode: dto.countryCode.toUpperCase(),
      idType: dto.idType,
      idNumber: dto.idNumber.trim(),
      idNumberHash: hash,
      idNumberFormatted: formatted,
      isPrimary: dto.isPrimary ?? false,
      verificationMethod: dto.verificationMethod ?? null,
      verifiedBy: dto.verifiedBy ?? null,
      verified: !!dto.verifiedBy,
      verifiedAt: dto.verifiedBy ? new Date() : null,
      nationalRegistryResponse: {},
    });

    try {
      return await repo.save(reg);
    } catch (e: any) {
      this.logger.warn(`NCID save failed: ${e?.message || e}`);
      throw new ConflictException('Could not save national ID — it may already exist for this patient.');
    }
  }

  async getPatientIds(tenantId: string, patientId: string): Promise<NcidRegistration[]> {
    const db = await this.tenantDb(tenantId);
    return db.getRepository(NcidRegistration).find({
      where: { patientId, isActive: true },
      order: { isPrimary: 'DESC', createdAt: 'DESC' },
    });
  }

  async scoreDeduplication(
    tenantId: string,
    patientIdA: string,
    patientIdB: string,
    demographics: {
      a: {
        givenName: string;
        familyName: string;
        dob: string;
        sex: string;
        phone?: string;
        mothersName?: string;
        village?: string;
      };
      b: {
        givenName: string;
        familyName: string;
        dob: string;
        sex: string;
        phone?: string;
        mothersName?: string;
        village?: string;
      };
    },
  ): Promise<NcidDuplicateFlag> {
    const db = await this.tenantDb(tenantId);
    const ncidRepo = db.getRepository(NcidRegistration);
    const dupRepo = db.getRepository(NcidDuplicateFlag);

    const [idsA, idsB] = await Promise.all([
      ncidRepo.findOne({
        where: { patientId: patientIdA, isActive: true },
        order: { isPrimary: 'DESC', createdAt: 'DESC' },
      }),
      ncidRepo.findOne({
        where: { patientId: patientIdB, isActive: true },
        order: { isPrimary: 'DESC', createdAt: 'DESC' },
      }),
    ]);

    const cdssRaw = await this.cdssService.ncidDuplicateScore(
      {
        patient_id: patientIdA,
        tenant_id: tenantId,
        patient_a: {
          given_name: demographics.a.givenName,
          family_name: demographics.a.familyName,
          date_of_birth: demographics.a.dob,
          sex: demographics.a.sex,
          phone_number: demographics.a.phone,
          mothers_name: demographics.a.mothersName,
          village_or_suburb: demographics.a.village,
          national_id_hash: idsA?.idNumberHash ?? null,
        },
        patient_b: {
          given_name: demographics.b.givenName,
          family_name: demographics.b.familyName,
          date_of_birth: demographics.b.dob,
          sex: demographics.b.sex,
          phone_number: demographics.b.phone,
          mothers_name: demographics.b.mothersName,
          village_or_suburb: demographics.b.village,
          national_id_hash: idsB?.idNumberHash ?? null,
        },
        locale: 'en',
      },
      tenantId,
    );

    const matched = Array.isArray(cdssRaw?.matched_fields) ? cdssRaw.matched_fields : [];
    const flag = dupRepo.create({
      patientIdA,
      patientIdB,
      matchScore: cdssRaw?.match_score ?? 0,
      matchMethod: cdssRaw?.match_method ?? 'demographic',
      matchFields: matched,
      cdssRecommendation: cdssRaw?.recommendation ?? 'manual_review',
      cdssConfidence: cdssRaw?.confidence ?? null,
      cdssReasoning: cdssRaw?.reasoning ?? null,
      resolutionStatus: 'pending',
    });

    return dupRepo.save(flag);
  }

  async analyseGaps(
    tenantId: string,
    patientId: string,
    dto: {
      diagnoses: string[];
      ageYears: number;
      sex: string;
      isPregnant: boolean;
    },
  ): Promise<{ gaps: unknown[]; summary: string; confidence: number }> {
    const db = await this.tenantDb(tenantId);
    const activeProgrammes = await db.getRepository(NcidProgrammeLinkage).find({
      where: { patientId, active: true },
    });
    const programmeNames = activeProgrammes.map((p) => p.programme);

    const cdssRaw = await this.cdssService.ncidProgrammeGaps(
      {
        patient_id: patientId,
        tenant_id: tenantId,
        active_programmes: programmeNames,
        diagnoses: dto.diagnoses,
        age_years: dto.ageYears,
        sex: dto.sex,
        is_pregnant: dto.isPregnant,
        locale: 'en',
      },
      tenantId,
    );

    return {
      gaps: cdssRaw?.gaps_detected ?? [],
      summary: cdssRaw?.summary ?? '',
      confidence: cdssRaw?.confidence ?? 0,
    };
  }

  async resolveDuplicate(
    tenantId: string,
    flagId: string,
    resolution: {
      status: 'confirmed_duplicate' | 'confirmed_different' | 'merged' | 'dismissed';
      resolvedBy: string;
      mergedIntoPatientId?: string;
      notes?: string;
    },
  ): Promise<NcidDuplicateFlag> {
    const db = await this.tenantDb(tenantId);
    const dupRepo = db.getRepository(NcidDuplicateFlag);
    const flag = await dupRepo.findOne({ where: { id: flagId } });
    if (!flag) {
      throw new NotFoundException('Duplicate flag not found');
    }
    flag.resolutionStatus = resolution.status;
    flag.resolvedBy = resolution.resolvedBy;
    flag.resolvedAt = new Date();
    flag.mergedIntoPatientId = resolution.mergedIntoPatientId ?? null;
    flag.resolutionNotes = resolution.notes ?? null;
    return dupRepo.save(flag);
  }

  async upsertProgrammeLinkage(
    tenantId: string,
    patientId: string,
    programme: string,
    dto: {
      programmeNumber?: string;
      enrolledAt?: string;
      facilityEnrolled?: string;
    },
  ): Promise<NcidProgrammeLinkage> {
    const db = await this.tenantDb(tenantId);
    const repo = db.getRepository(NcidProgrammeLinkage);
    const existing = await repo.findOne({ where: { patientId, programme } });
    if (existing) {
      if (dto.programmeNumber !== undefined) existing.programmeNumber = dto.programmeNumber;
      if (dto.enrolledAt !== undefined) existing.enrolledAt = dto.enrolledAt;
      if (dto.facilityEnrolled !== undefined) existing.facilityEnrolled = dto.facilityEnrolled;
      existing.active = true;
      return repo.save(existing);
    }
    const link = repo.create({
      patientId,
      programme,
      programmeNumber: dto.programmeNumber ?? null,
      enrolledAt: dto.enrolledAt ?? null,
      facilityEnrolled: dto.facilityEnrolled ?? null,
      active: true,
    });
    return repo.save(link);
  }

  async getProgrammeLinkages(tenantId: string, patientId: string): Promise<NcidProgrammeLinkage[]> {
    const db = await this.tenantDb(tenantId);
    return db.getRepository(NcidProgrammeLinkage).find({
      where: { patientId },
      order: { programme: 'ASC' },
    });
  }

  async getPendingDuplicates(tenantId: string): Promise<NcidDuplicateFlag[]> {
    const db = await this.tenantDb(tenantId);
    return db.getRepository(NcidDuplicateFlag).find({
      where: { resolutionStatus: 'pending' },
      order: { matchScore: 'DESC' },
      take: 100,
    });
  }
}
