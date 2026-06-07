import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { MedicalNlpService } from './medical-nlp.service';
import { MedicalAidApiService } from './medical-aid-api.service';
import { CdssService, RegistrationDocumentAnalysisResponse } from './cdss.service';
import { AiSurfaceContractService } from './ai-surface-contract.service';

export interface RegistrationIntakePayload {
  patientId?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | Date | null;
  gender?: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  insuranceProvider?: string;
  insuranceNumber?: string;
  medicalAidPlan?: string;
  documentExtracts?: Array<Record<string, any>>;
}

interface DuplicateCandidate {
  patientId: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  medicalAidNumber: string | null;
  matchScore: number;
  reasons: string[];
  signals: Record<string, any>;
}

interface DuplicateReviewFilters {
  sourceType?: string;
  sourceReference?: string;
  status?: string;
  limit?: number;
}

@Injectable()
export class RegistrationIntelligenceService {
  private readonly logger = new Logger(RegistrationIntelligenceService.name);

  constructor(
    @Optional() private readonly medicalNlpService?: MedicalNlpService,
    @Optional() private readonly medicalAidApiService?: MedicalAidApiService,
    @Optional() private readonly cdssService?: CdssService,
    @Optional() private readonly aiSurfaceContractService?: AiSurfaceContractService,
  ) {}

  private buildRegistrationAiMetadata(aiAnalysis?: RegistrationDocumentAnalysisResponse | null) {
    if (!aiAnalysis) {
      return null;
    }

    return this.aiSurfaceContractService?.buildSurfaceMetadata({
      aiSurface: 'registration_intelligence',
      useCase: 'registration_document_intelligence',
      source: 'registration_intelligence_service',
      modelId: aiAnalysis.model || 'registration_document_intelligence_proxy',
      modelVersion: aiAnalysis.model || 'registration_document_intelligence_proxy',
      provider: String(
        aiAnalysis.governance?.vendor_id ||
        aiAnalysis.governance?.vendorId ||
        aiAnalysis.governance?.provider ||
        'local',
      ),
      recorded: true,
    }) || null;
  }

  private mapDuplicateReviewRow(row: any) {
    return {
      id: row.id,
      sourceType: row.source_type,
      sourceReference: row.source_reference,
      subjectPatientId: row.subject_patient_id || null,
      candidatePatientId: row.candidate_patient_id,
      matchScore: row.match_score === null || row.match_score === undefined ? null : Number(row.match_score),
      matchReasons: row.match_reasons || [],
      matchSignals: row.match_signals || {},
      matchStatus: row.match_status,
      reviewedBy: row.reviewed_by || null,
      reviewedAt: row.reviewed_at || null,
      createdAt: row.created_at,
      subjectPatient: row.subject_patient_id
        ? {
            id: row.subject_patient_id,
            patientNumber: row.subject_patient_number || null,
            firstName: row.subject_first_name || null,
            lastName: row.subject_last_name || null,
          }
        : null,
      candidatePatient: {
        id: row.candidate_patient_id,
        patientNumber: row.candidate_patient_number || null,
        firstName: row.candidate_first_name || null,
        lastName: row.candidate_last_name || null,
      },
    };
  }

  async findDuplicateCandidates(
    tenantDb: DataSource,
    payload: RegistrationIntakePayload,
    options: { limit?: number } = {},
  ): Promise<DuplicateCandidate[]> {
    const rows = await tenantDb.query(
      `
        SELECT
          id,
          patient_number,
          first_name,
          last_name,
          date_of_birth,
          gender,
          phone,
          email,
          id_number,
          medical_aid_number
        FROM patients
        WHERE is_active = true
          AND ($1::uuid IS NULL OR id <> $1::uuid)
        ORDER BY created_at DESC
        LIMIT 1000
      `,
      [payload.patientId || null],
    );

    const limit = Math.max(1, Math.min(20, Number(options.limit || 8)));
    const candidates: DuplicateCandidate[] = [];
    const targetFirst = this.normalizeName(payload.firstName);
    const targetLast = this.normalizeName(payload.lastName);
    const targetFull = [targetFirst, targetLast].filter(Boolean).join(' ');
    const targetDob = this.normalizeDate(payload.dateOfBirth);
    const targetPhone = this.normalizePhone(payload.phone);
    const targetEmail = this.normalizeEmail(payload.email);
    const targetNationalId = this.normalizeLooseId(payload.nationalId);
    const targetInsurance = this.normalizeLooseId(payload.insuranceNumber);
    const targetGender = this.normalizeText(payload.gender);

    for (const row of rows || []) {
      const candidateFirst = this.normalizeName(row.first_name);
      const candidateLast = this.normalizeName(row.last_name);
      const candidateFull = [candidateFirst, candidateLast].filter(Boolean).join(' ');
      const candidateDob = this.normalizeDate(row.date_of_birth);
      const candidatePhone = this.normalizePhone(row.phone);
      const candidateEmail = this.normalizeEmail(row.email);
      const candidateNationalId = this.normalizeLooseId(row.id_number);
      const candidateInsurance = this.normalizeLooseId(row.medical_aid_number);
      const candidateGender = this.normalizeText(row.gender);

      let score = 0;
      const reasons: string[] = [];
      const signals: Record<string, any> = {};

      if (targetNationalId && candidateNationalId && targetNationalId === candidateNationalId) {
        score += 0.65;
        reasons.push('exact_national_id_match');
        signals.nationalId = 'exact';
      }

      if (targetInsurance && candidateInsurance && targetInsurance === candidateInsurance) {
        score += 0.25;
        reasons.push('exact_insurance_member_match');
        signals.insuranceNumber = 'exact';
      }

      if (targetDob && candidateDob && targetDob === candidateDob) {
        score += 0.2;
        reasons.push('exact_dob_match');
        signals.dateOfBirth = 'exact';
      }

      if (targetPhone && candidatePhone && targetPhone === candidatePhone) {
        score += 0.18;
        reasons.push('exact_phone_match');
        signals.phone = 'exact';
      }

      if (targetEmail && candidateEmail && targetEmail === candidateEmail) {
        score += 0.15;
        reasons.push('exact_email_match');
        signals.email = 'exact';
      }

      if (targetFirst && candidateFirst && targetLast && candidateLast && targetFirst === candidateFirst && targetLast === candidateLast) {
        score += 0.35;
        reasons.push('exact_name_match');
        signals.name = 'exact';
      } else if (targetFull && candidateFull) {
        const nameSimilarity = this.computeDiceSimilarity(targetFull, candidateFull);
        if (nameSimilarity >= 0.92) {
          score += 0.28;
          reasons.push('very_high_name_similarity');
          signals.name = Number(nameSimilarity.toFixed(3));
        } else if (nameSimilarity >= 0.8) {
          score += 0.18;
          reasons.push('high_name_similarity');
          signals.name = Number(nameSimilarity.toFixed(3));
        } else if (
          targetFirst &&
          targetLast &&
          targetFirst === candidateLast &&
          targetLast === candidateFirst
        ) {
          score += 0.16;
          reasons.push('swapped_name_match');
          signals.name = 'swapped';
        }
      }

      if (targetGender && candidateGender && targetGender === candidateGender) {
        score += 0.04;
        signals.gender = 'exact';
      }

      if (score >= 0.45) {
        candidates.push({
          patientId: String(row.id),
          patientNumber: String(row.patient_number || ''),
          firstName: String(row.first_name || ''),
          lastName: String(row.last_name || ''),
          dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth).toISOString().slice(0, 10) : null,
          gender: row.gender || null,
          phone: row.phone || null,
          email: row.email || null,
          nationalId: row.id_number || null,
          medicalAidNumber: row.medical_aid_number || null,
          matchScore: Number(Math.min(1, score).toFixed(2)),
          reasons,
          signals,
        });
      }
    }

    return candidates
      .sort((left, right) => right.matchScore - left.matchScore)
      .slice(0, limit);
  }

  async listDuplicateReviewQueue(
    tenantDb: DataSource,
    filters: DuplicateReviewFilters = {},
  ) {
    const rows = await tenantDb.query(
      `
        SELECT
          pim.id,
          pim.source_type,
          pim.source_reference,
          pim.subject_patient_id,
          pim.candidate_patient_id,
          pim.match_score,
          pim.match_reasons,
          pim.match_signals,
          pim.match_status,
          pim.reviewed_by,
          pim.reviewed_at,
          pim.created_at,
          candidate.patient_number AS candidate_patient_number,
          candidate.first_name AS candidate_first_name,
          candidate.last_name AS candidate_last_name,
          subject.patient_number AS subject_patient_number,
          subject.first_name AS subject_first_name,
          subject.last_name AS subject_last_name
        FROM patient_identity_matches pim
        LEFT JOIN patients candidate ON candidate.id = pim.candidate_patient_id
        LEFT JOIN patients subject ON subject.id = pim.subject_patient_id
        WHERE ($1::text IS NULL OR pim.source_type = $1::text)
          AND ($2::text IS NULL OR pim.source_reference = $2::text)
          AND ($3::text IS NULL OR pim.match_status = $3::text)
        ORDER BY pim.created_at DESC
        LIMIT $4
      `,
      [
        filters.sourceType || 'registration_intake',
        filters.sourceReference || null,
        filters.status || 'suggested',
        Math.max(1, Math.min(100, Number(filters.limit || 25))),
      ],
    );

    return (rows || []).map((row: any) => this.mapDuplicateReviewRow(row));
  }

  async reviewDuplicateCandidate(
    tenantDb: DataSource,
    matchId: string,
    payload: { matchStatus: string },
    actorUserId?: string | null,
  ) {
    const nextStatus = this.normalizeText(payload?.matchStatus);
    const allowedStatuses = new Set(['suggested', 'confirmed_duplicate', 'rejected', 'needs_follow_up', 'merged']);
    if (!nextStatus || !allowedStatuses.has(nextStatus)) {
      throw new BadRequestException('Invalid duplicate review status.');
    }

    const rows = await tenantDb.query(
      `
        UPDATE patient_identity_matches
        SET match_status = $2,
            reviewed_by = $3,
            reviewed_at = NOW()
        WHERE id = $1::uuid
        RETURNING id
      `,
      [matchId, nextStatus, actorUserId || null],
    );

    if (!rows?.length) {
      throw new BadRequestException('Duplicate review item not found.');
    }

    const reviewedRows = await tenantDb.query(
      `
        SELECT
          pim.id,
          pim.source_type,
          pim.source_reference,
          pim.subject_patient_id,
          pim.candidate_patient_id,
          pim.match_score,
          pim.match_reasons,
          pim.match_signals,
          pim.match_status,
          pim.reviewed_by,
          pim.reviewed_at,
          pim.created_at,
          candidate.patient_number AS candidate_patient_number,
          candidate.first_name AS candidate_first_name,
          candidate.last_name AS candidate_last_name,
          subject.patient_number AS subject_patient_number,
          subject.first_name AS subject_first_name,
          subject.last_name AS subject_last_name
        FROM patient_identity_matches pim
        LEFT JOIN patients candidate ON candidate.id = pim.candidate_patient_id
        LEFT JOIN patients subject ON subject.id = pim.subject_patient_id
        WHERE pim.id = $1::uuid
        LIMIT 1
      `,
      [matchId],
    );

    return reviewedRows?.length ? this.mapDuplicateReviewRow(reviewedRows[0]) : { id: matchId, matchStatus: nextStatus };
  }

  async extractRegistrationDocument(
    tenantDb: DataSource,
    file: Express.Multer.File,
    payload: { patientId?: string; documentType?: string; language?: string; actorUserId?: string | null; tenantId?: string | null } = {},
    options: { persist?: boolean } = {},
  ) {
    const persist = options.persist !== false;
    const documentType = this.normalizeDocumentType(payload.documentType);
    const ocr = await this.extractDocumentText(file, payload.language || 'en');
    const heuristicStructured = this.parseRegistrationDocument(documentType, ocr.text || '');
    const aiAnalysis = await this.analyzeRegistrationDocumentWithCdss(
      {
        documentType,
        extractedText: ocr.text || '',
        fileName: file.originalname || 'registration-document',
        mimeType: file.mimetype || null,
        language: payload.language || 'en',
        patientId: payload.patientId || null,
      },
      payload.tenantId || null,
      tenantDb,
    );
    const structured = this.mergeStructuredDocumentPayloads(
      heuristicStructured,
      aiAnalysis?.structuredPayload || {},
    );
    const fileHash = this.hashFile(file.buffer);

    if (!persist) {
      return {
        patientId: payload.patientId || null,
        documentType,
        documentName: file.originalname || 'registration-document',
        extractionStatus: ocr.text ? 'processed' : 'failed',
        ocr: {
          engine: ocr.engine,
          confidence: ocr.confidence,
        },
        extractedText: ocr.text,
        structuredPayload: structured,
        extractionSummary: aiAnalysis?.summary || null,
        flags: aiAnalysis?.flags || [],
        governance: aiAnalysis?.governance || null,
        aiMetadata: this.buildRegistrationAiMetadata(aiAnalysis),
      };
    }

    const rows = await tenantDb.query(
      `
        INSERT INTO registration_document_extracts (
          patient_id,
          document_type,
          document_name,
          mime_type,
          file_size,
          file_sha256,
          extraction_status,
          ocr_engine,
          ocr_confidence,
          extracted_text,
          structured_payload,
          metadata,
          created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13
        )
        RETURNING *
      `,
      [
        payload.patientId || null,
        documentType,
        file.originalname || 'registration-document',
        file.mimetype || null,
        Number(file.size || file.buffer?.length || 0),
        fileHash,
        ocr.text ? 'processed' : 'failed',
        ocr.engine,
        ocr.confidence,
        ocr.text || null,
        JSON.stringify(structured),
        JSON.stringify({
          source: 'registration_intelligence',
          ocr_raw: ocr.raw || {},
          ai_analysis: aiAnalysis
            ? {
                summary: aiAnalysis.summary || null,
                flags: aiAnalysis.flags || [],
                confidence: aiAnalysis.confidence ?? null,
                model: aiAnalysis.model || null,
                governance: aiAnalysis.governance || {},
                abstained: aiAnalysis.abstained === true,
                abstainReason: aiAnalysis.abstainReason || null,
              }
            : null,
          heuristic_fallback_used: true,
        }),
        payload.actorUserId || null,
      ],
    );

    const inserted = rows[0];
    return {
      id: inserted.id,
      patientId: inserted.patient_id,
      documentType: inserted.document_type,
      documentName: inserted.document_name,
      extractionStatus: inserted.extraction_status,
      ocr: {
        engine: inserted.ocr_engine,
        confidence: inserted.ocr_confidence === null || inserted.ocr_confidence === undefined
          ? null
          : Number(inserted.ocr_confidence),
      },
      extractedText: inserted.extracted_text || '',
      structuredPayload: inserted.structured_payload || {},
      extractionSummary: aiAnalysis?.summary || null,
      flags: aiAnalysis?.flags || [],
      governance: aiAnalysis?.governance || null,
      aiMetadata: this.buildRegistrationAiMetadata(aiAnalysis),
      createdAt: inserted.created_at,
    };
  }

  async runInsuranceEligibilityPrecheck(
    tenantDb: DataSource,
    payload: RegistrationIntakePayload,
    options: { persist?: boolean } = {},
  ) {
    const persist = options.persist !== false;
    const provider = this.normalizeText(payload.insuranceProvider);
    const memberNumber = this.normalizeLooseId(payload.insuranceNumber);
    const planName = this.normalizeText(payload.medicalAidPlan);
    const coverageFlags: string[] = [];
    let status = 'information_required';
    let confidence = 0.2;

    if (!provider && !memberNumber) {
      coverageFlags.push('no_coverage_information_provided');
      status = 'information_required';
      confidence = 0.15;
    } else if (!provider) {
      coverageFlags.push('missing_insurance_provider');
      status = 'information_required';
      confidence = 0.25;
    } else if (!memberNumber) {
      coverageFlags.push('missing_member_number');
      status = 'information_required';
      confidence = 0.35;
    } else if (memberNumber.length < 6) {
      coverageFlags.push('member_number_too_short');
      status = 'high_risk';
      confidence = 0.55;
    } else {
      status = planName ? 'ready_for_verification' : 'ready_for_verification';
      confidence = planName ? 0.9 : 0.82;
      if (!planName) {
        coverageFlags.push('plan_name_not_captured');
      }
    }

    const responsePayload = {
      status,
      coverageFlags,
      recommendedNextStep:
        status === 'ready_for_verification'
          ? 'Proceed to payer verification or medical-aid eligibility check.'
          : 'Capture missing provider/member details before financial clearance.',
    };

    if (!persist) {
      return {
        providerName: provider || null,
        memberNumber: memberNumber || null,
        planName: planName || null,
        status,
        confidence,
        coverageFlags,
        responsePayload,
      };
    }

    const rows = await tenantDb.query(
      `
        INSERT INTO insurance_eligibility_checks (
          patient_id,
          provider_name,
          member_number,
          plan_name,
          status,
          confidence,
          coverage_flags,
          request_payload,
          response_payload,
          checked_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,NOW()
        )
        RETURNING *
      `,
      [
        payload.patientId || null,
        provider || null,
        memberNumber || null,
        planName || null,
        status,
        confidence,
        JSON.stringify(coverageFlags),
        JSON.stringify({
          providerName: provider || null,
          memberNumber: memberNumber || null,
          planName: planName || null,
        }),
        JSON.stringify(responsePayload),
      ],
    );

    const inserted = rows[0];
    return {
      id: inserted.id,
      patientId: inserted.patient_id,
      providerName: inserted.provider_name,
      memberNumber: inserted.member_number,
      planName: inserted.plan_name,
      status: inserted.status,
      confidence: inserted.confidence === null || inserted.confidence === undefined ? null : Number(inserted.confidence),
      coverageFlags: inserted.coverage_flags || [],
      checkedAt: inserted.checked_at,
      responsePayload: inserted.response_payload || {},
    };
  }

  async verifyInsuranceEligibility(
    tenantDb: DataSource,
    payload: RegistrationIntakePayload,
    options: { persist?: boolean; actorUserId?: string | null; sourceAssessmentId?: string | null } = {},
  ) {
    const persist = options.persist !== false;
    const provider = this.normalizeText(payload.insuranceProvider);
    const memberNumber = this.normalizeLooseId(payload.insuranceNumber);
    const planName = this.normalizeText(payload.medicalAidPlan);
    const precheck = await this.runInsuranceEligibilityPrecheck(tenantDb, payload, { persist: false });
    const coverageFlags = [...(precheck.coverageFlags || [])];

    if (!provider || !memberNumber) {
      return this.persistInsuranceEligibilityCheck(
        tenantDb,
        {
          patientId: payload.patientId || null,
          providerName: provider || null,
          memberNumber: memberNumber || null,
          planName: planName || null,
          status: 'information_required',
          confidence: precheck.confidence ?? 0.2,
          coverageFlags,
          requestPayload: {
            providerName: provider || null,
            memberNumber: memberNumber || null,
            planName: planName || null,
            source: 'registration_intelligence',
            verificationMode: 'skipped_missing_inputs',
            sourceAssessmentId: options.sourceAssessmentId || null,
          },
          responsePayload: {
            valid: false,
            error: 'Provider name and member number are required for live eligibility verification.',
            recommendedNextStep: 'Capture provider and member number before running verification.',
          },
        },
        { persist },
      );
    }

    if (!this.medicalAidApiService) {
      return this.persistInsuranceEligibilityCheck(
        tenantDb,
        {
          patientId: payload.patientId || null,
          providerName: provider,
          memberNumber,
          planName: planName || null,
          status: 'verification_unavailable',
          confidence: 0.1,
          coverageFlags: [...coverageFlags, 'verification_service_unavailable'],
          requestPayload: {
            providerName: provider,
            memberNumber,
            planName: planName || null,
            source: 'registration_intelligence',
            verificationMode: 'service_unavailable',
            sourceAssessmentId: options.sourceAssessmentId || null,
          },
          responsePayload: {
            valid: false,
            error: 'Medical aid verification service is not available in this runtime.',
          },
        },
        { persist },
      );
    }

    const verification = await this.medicalAidApiService.verifyMember(provider, memberNumber, tenantDb);
    const memberDetails = verification?.memberDetails || {};
    const status = verification.valid ? 'verified_active' : 'verification_failed';
    const externalFlags = [...coverageFlags];
    if (!verification.valid) {
      externalFlags.push('external_verification_failed');
    }

    const derivedPlan =
      this.normalizeText(memberDetails?.plan || memberDetails?.schemeOption || memberDetails?.option) ||
      planName ||
      null;

    return this.persistInsuranceEligibilityCheck(
      tenantDb,
      {
        patientId: payload.patientId || null,
        providerName: provider,
        memberNumber,
        planName: derivedPlan,
        status,
        confidence: verification.valid ? 0.98 : 0.55,
        coverageFlags: externalFlags,
        requestPayload: {
          providerName: provider,
          memberNumber,
          planName: planName || null,
          source: 'registration_intelligence',
          verificationMode: 'live_api',
          sourceAssessmentId: options.sourceAssessmentId || null,
          actorUserId: options.actorUserId || null,
        },
        responsePayload: {
          valid: Boolean(verification.valid),
          error: verification.error || null,
          memberDetails,
        },
      },
      { persist },
    );
  }

  async assessRegistrationIntake(
    tenantDb: DataSource,
    payload: RegistrationIntakePayload,
    options: { persist?: boolean; actorUserId?: string | null } = {},
  ) {
    const persist = options.persist !== false;
    const duplicateCandidates = await this.findDuplicateCandidates(tenantDb, payload, { limit: 8 });
    const insuranceCheck = await this.runInsuranceEligibilityPrecheck(tenantDb, payload, { persist });
    const missingFields = this.computeMissingFields(payload);
    const consentMissingItems = this.computeConsentMissingItems(payload);
    const completenessScore = this.computeCompletenessScore(missingFields, consentMissingItems, insuranceCheck.coverageFlags || []);
    const coverageRiskLevel = this.mapCoverageRiskLevel(insuranceCheck.status, insuranceCheck.coverageFlags || []);
    const documentExtractIds = Array.isArray(payload.documentExtracts)
      ? payload.documentExtracts.map((doc) => String(doc.id || '')).filter(Boolean)
      : [];

    const summaries = this.buildIntakeSummaries({
      payload,
      completenessScore,
      missingFields,
      duplicateCandidates,
      coverageRiskLevel,
      coverageFlags: insuranceCheck.coverageFlags || [],
      consentMissingItems,
      documentCount: documentExtractIds.length,
    });

    const response = {
      patientId: payload.patientId || null,
      completenessScore,
      missingFields,
      suspectedDuplicateCount: duplicateCandidates.length,
      duplicateCandidates,
      coverageRiskLevel,
      coverageFlags: insuranceCheck.coverageFlags || [],
      insuranceCheck,
      consentReady: consentMissingItems.length === 0,
      consentMissingItems,
      frontDeskSummary: summaries.frontDeskSummary,
      nurseSummary: summaries.nurseSummary,
      clinicianSummary: summaries.clinicianSummary,
      documentExtractIds,
      structuredPayload: {
        demographicSignals: {
          hasNationalId: Boolean(this.normalizeLooseId(payload.nationalId)),
          hasPhone: Boolean(this.normalizePhone(payload.phone)),
          hasEmail: Boolean(this.normalizeEmail(payload.email)),
          hasCoverageInfo: Boolean(this.normalizeText(payload.insuranceProvider) || this.normalizeLooseId(payload.insuranceNumber)),
        },
        duplicateSignals: duplicateCandidates.map((candidate) => ({
          patientId: candidate.patientId,
          matchScore: candidate.matchScore,
          reasons: candidate.reasons,
        })),
      },
    };

    if (!persist) {
      return response;
    }

    const assessmentRows = await tenantDb.query(
      `
        INSERT INTO intake_assessments (
          patient_id,
          assessment_type,
          completeness_score,
          missing_fields,
          suspected_duplicate_count,
          duplicate_candidates,
          coverage_risk_level,
          coverage_flags,
          consent_ready,
          consent_missing_items,
          front_desk_summary,
          nurse_summary,
          clinician_summary,
          document_extract_ids,
          structured_payload,
          created_by
        ) VALUES (
          $1,'registration',$2,$3::jsonb,$4,$5::jsonb,$6,$7::jsonb,$8,$9::jsonb,$10,$11,$12,$13::jsonb,$14::jsonb,$15
        )
        RETURNING *
      `,
      [
        payload.patientId || null,
        completenessScore,
        JSON.stringify(missingFields),
        duplicateCandidates.length,
        JSON.stringify(duplicateCandidates),
        coverageRiskLevel,
        JSON.stringify(insuranceCheck.coverageFlags || []),
        consentMissingItems.length === 0,
        JSON.stringify(consentMissingItems),
        summaries.frontDeskSummary,
        summaries.nurseSummary,
        summaries.clinicianSummary,
        JSON.stringify(documentExtractIds),
        JSON.stringify(response.structuredPayload),
        options.actorUserId || null,
      ],
    );

    const assessment = assessmentRows[0];
    for (const candidate of duplicateCandidates) {
      await tenantDb.query(
        `
          INSERT INTO patient_identity_matches (
            source_type,
            source_reference,
            subject_patient_id,
            candidate_patient_id,
            match_score,
            match_reasons,
            match_signals,
            match_status
          ) VALUES (
            'registration_intake',$1,$2,$3,$4,$5::jsonb,$6::jsonb,'suggested'
          )
        `,
        [
          assessment.id,
          payload.patientId || null,
          candidate.patientId,
          candidate.matchScore,
          JSON.stringify(candidate.reasons),
          JSON.stringify(candidate.signals),
        ],
      );
    }

    return {
      ...response,
      id: assessment.id,
      createdAt: assessment.created_at,
    };
  }

  private async persistInsuranceEligibilityCheck(
    tenantDb: DataSource,
    payload: {
      patientId: string | null;
      providerName: string | null;
      memberNumber: string | null;
      planName: string | null;
      status: string;
      confidence: number | null;
      coverageFlags: string[];
      requestPayload: Record<string, any>;
      responsePayload: Record<string, any>;
    },
    options: { persist: boolean },
  ) {
    if (!options.persist) {
      return {
        patientId: payload.patientId,
        providerName: payload.providerName,
        memberNumber: payload.memberNumber,
        planName: payload.planName,
        status: payload.status,
        confidence: payload.confidence,
        coverageFlags: payload.coverageFlags,
        checkedAt: null,
        requestPayload: payload.requestPayload,
        responsePayload: payload.responsePayload,
      };
    }

    const rows = await tenantDb.query(
      `
        INSERT INTO insurance_eligibility_checks (
          patient_id,
          provider_name,
          member_number,
          plan_name,
          status,
          confidence,
          coverage_flags,
          request_payload,
          response_payload,
          checked_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,NOW()
        )
        RETURNING *
      `,
      [
        payload.patientId,
        payload.providerName,
        payload.memberNumber,
        payload.planName,
        payload.status,
        payload.confidence,
        JSON.stringify(payload.coverageFlags || []),
        JSON.stringify(payload.requestPayload || {}),
        JSON.stringify(payload.responsePayload || {}),
      ],
    );

    const inserted = rows[0];
    return {
      id: inserted.id,
      patientId: inserted.patient_id,
      providerName: inserted.provider_name,
      memberNumber: inserted.member_number,
      planName: inserted.plan_name,
      status: inserted.status,
      confidence: inserted.confidence === null || inserted.confidence === undefined ? null : Number(inserted.confidence),
      coverageFlags: inserted.coverage_flags || [],
      checkedAt: inserted.checked_at,
      requestPayload: inserted.request_payload || {},
      responsePayload: inserted.response_payload || {},
    };
  }

  private computeMissingFields(payload: RegistrationIntakePayload): string[] {
    const missing = new Set<string>();
    if (!this.normalizeName(payload.firstName)) missing.add('firstName');
    if (!this.normalizeName(payload.lastName)) missing.add('lastName');
    if (!this.normalizeDate(payload.dateOfBirth)) missing.add('dateOfBirth');
    if (!this.normalizeText(payload.gender)) missing.add('gender');
    if (!this.normalizePhone(payload.phone) && !this.normalizeEmail(payload.email)) {
      missing.add('contactMethod');
    }
    if (!this.normalizeText(payload.address)) missing.add('address');
    return Array.from(missing);
  }

  private computeConsentMissingItems(payload: RegistrationIntakePayload): string[] {
    const missing: string[] = [];
    if (!this.normalizePhone(payload.phone) && !this.normalizeEmail(payload.email)) {
      missing.push('patient_contact_confirmation');
    }
    if (!this.normalizeText(payload.emergencyContactName)) {
      missing.push('emergency_contact_name');
    }
    if (!this.normalizePhone(payload.emergencyContactPhone)) {
      missing.push('emergency_contact_phone');
    }
    const age = this.estimateAge(payload.dateOfBirth);
    if (age !== null && age < 18) {
      if (!this.normalizeText(payload.nextOfKinName || payload.emergencyContactName)) {
        missing.push('guardian_name');
      }
      if (!this.normalizePhone(payload.nextOfKinPhone || payload.emergencyContactPhone)) {
        missing.push('guardian_phone');
      }
    }
    return missing;
  }

  private computeCompletenessScore(missingFields: string[], consentMissingItems: string[], coverageFlags: string[]): number {
    let score = 100;
    score -= missingFields.length * 12;
    score -= consentMissingItems.length * 8;
    if (coverageFlags.includes('missing_member_number')) score -= 10;
    if (coverageFlags.includes('missing_insurance_provider')) score -= 10;
    if (coverageFlags.includes('member_number_too_short')) score -= 12;
    if (coverageFlags.includes('no_coverage_information_provided')) score -= 4;
    return Math.max(0, Number(score.toFixed(2)));
  }

  private mapCoverageRiskLevel(status: string, coverageFlags: string[]): 'low' | 'medium' | 'high' {
    if (status === 'high_risk' || coverageFlags.includes('member_number_too_short')) return 'high';
    if (coverageFlags.length > 0) return 'medium';
    return 'low';
  }

  private buildIntakeSummaries(args: {
    payload: RegistrationIntakePayload;
    completenessScore: number;
    missingFields: string[];
    duplicateCandidates: DuplicateCandidate[];
    coverageRiskLevel: string;
    coverageFlags: string[];
    consentMissingItems: string[];
    documentCount: number;
  }) {
    const patientLabel = [args.payload.firstName, args.payload.lastName].filter(Boolean).join(' ').trim() || 'Prospective patient';
    const duplicateSummary = args.duplicateCandidates.length
      ? `${args.duplicateCandidates.length} possible duplicate${args.duplicateCandidates.length === 1 ? '' : 's'} detected. Highest score ${args.duplicateCandidates[0].matchScore}.`
      : 'No high-confidence duplicate candidates detected.';
    const coverageFlagLabels: Record<string, string> = {
      no_coverage_information_provided: 'no insurance information provided',
      missing_insurance_provider: 'insurance provider missing',
      missing_member_number: 'member number missing',
      member_number_too_short: 'member number looks too short',
      plan_name_not_captured: 'insurance plan name not captured',
    };
    const coverageSummary = args.coverageFlags.length
      ? `Coverage risk ${args.coverageRiskLevel} — ${args.coverageFlags.map((f) => coverageFlagLabels[f] || f.replace(/_/g, ' ')).join('; ')}.`
      : 'Coverage details are sufficient for verification.';
    const consentSummary = args.consentMissingItems.length
      ? `Consent readiness blocked by: ${args.consentMissingItems.join(', ')}.`
      : 'Consent readiness baseline is complete.';

    return {
      frontDeskSummary: `${patientLabel} intake is ${args.completenessScore}% complete. ${duplicateSummary} ${coverageSummary}`,
      nurseSummary: `${patientLabel} has ${args.missingFields.length} missing registration field(s) and ${args.documentCount} extracted intake document(s). ${consentSummary}`,
      clinicianSummary: `${patientLabel} first-touch intake summary: ${duplicateSummary} ${coverageSummary} Missing fields: ${args.missingFields.join(', ') || 'none'}.`,
    };
  }

  private async extractDocumentText(
    file: Express.Multer.File,
    language: string,
  ): Promise<{ text: string; confidence: number | null; engine: string; raw: any }> {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException('Registration document file buffer is empty');
    }

    const mime = String(file.mimetype || '').toLowerCase();
    if (
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('xml') ||
      mime.includes('csv') ||
      mime.includes('html')
    ) {
      return {
        text: file.buffer.toString('utf8'),
        confidence: 1,
        engine: 'native_text_decode',
        raw: { mode: 'native_text_decode' },
      };
    }

    const endpoint = this.resolveLocalOcrUrl();
    if (!endpoint) {
      return {
        text: '',
        confidence: null,
        engine: 'ocr_unavailable',
        raw: { mode: 'ocr_unavailable' },
      };
    }

    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.originalname || 'registration-document.bin',
      contentType: file.mimetype || 'application/octet-stream',
    });
    if (language) {
      formData.append('language', language);
    }

    const response = await axios.post(endpoint, formData, {
      headers: {
        ...(formData.getHeaders() as Record<string, string>),
      },
      timeout: this.getLocalOcrTimeoutMs(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const payload = response.data;
    const text = String(payload?.text || payload?.ocr?.text || payload?.result?.text || '').trim();
    const confidence = Number(payload?.confidence ?? payload?.ocr?.confidence ?? payload?.result?.confidence);
    const engine = String(payload?.engine || payload?.ocr?.engine || 'local_ocr').trim() || 'local_ocr';

    return {
      text,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
      engine,
      raw: payload,
    };
  }

  private parseRegistrationDocument(documentType: string, extractedText: string): Record<string, any> {
    const text = String(extractedText || '').trim();
    if (!text) {
      return {};
    }

    const normalized = text.replace(/\r/g, '');
    if (documentType === 'insurance_card') {
      return {
        providerName:
          this.matchLabeledValue(normalized, ['medical aid', 'insurance provider', 'provider', 'scheme']) ||
          this.findInsuranceProvider(normalized),
        memberNumber: this.matchLabeledValue(normalized, ['member number', 'member no', 'policy number', 'membership']) || this.findLooseMemberNumber(normalized),
        planName: this.matchLabeledValue(normalized, ['plan', 'scheme option']),
      };
    }

    if (documentType === 'referral_letter') {
      const requestedSpecialty =
        this.matchLabeledValue(normalized, ['specialty', 'requested specialty', 'department']) ||
        this.findRequestedSpecialty(normalized);
      const urgency =
        this.matchLabeledValue(normalized, ['urgency', 'priority']) ||
        this.findReferralUrgency(normalized);
      const requestedInvestigations = this.findRequestedInvestigations(normalized);
      const requestedFollowUpWindow = this.findFollowUpWindow(normalized);
      return {
        referredBy: this.matchLabeledValue(normalized, ['referred by', 'from']),
        referredTo: this.matchLabeledValue(normalized, ['referred to', 'to']),
        referringClinician: this.matchLabeledValue(normalized, ['doctor', 'dr', 'referring clinician', 'consultant']),
        referringFacility: this.matchLabeledValue(normalized, ['facility', 'hospital', 'clinic']) || this.findReferralFacility(normalized),
        diagnosis: this.matchLabeledValue(normalized, ['diagnosis', 'impression']),
        reason: this.matchLabeledValue(normalized, ['reason for referral', 'reason', 'indication']),
        requestedSpecialty,
        urgency,
        requestedInvestigations,
        requestedFollowUpWindow,
        medicationCandidates: this.findMedicationCandidates(normalized),
        allergyCandidates: this.medicalNlpService?.extractAllergiesFromText(normalized) || [],
      };
    }

    return {
      fullName:
        this.matchLabeledValue(normalized, ['name', 'full name']) ||
        this.combineNameParts(
          this.matchLabeledValue(normalized, ['given names', 'first name']),
          this.matchLabeledValue(normalized, ['surname', 'last name']),
        ),
      surname: this.matchLabeledValue(normalized, ['surname', 'last name']),
      givenNames: this.matchLabeledValue(normalized, ['given names', 'first name']),
      nationalId:
        this.matchLabeledValue(normalized, ['id number', 'national id', 'passport number']) ||
        this.findLooseNationalId(normalized),
      dateOfBirth:
        this.normalizeDate(this.matchLabeledValue(normalized, ['date of birth', 'dob', 'birth date'])) ||
        this.findDateInText(normalized),
      gender: this.matchLabeledValue(normalized, ['sex', 'gender']),
    };
  }

  private async analyzeRegistrationDocumentWithCdss(
    payload: {
      documentType: string;
      extractedText: string;
      fileName?: string;
      mimeType?: string | null;
      language?: string;
      patientId?: string | null;
    },
    tenantId: string | null,
    tenantDb: DataSource,
  ): Promise<RegistrationDocumentAnalysisResponse | null> {
    if (!this.cdssService || !payload.extractedText.trim()) {
      return null;
    }

    try {
      return await this.cdssService.analyzeRegistrationDocument(
        {
          documentType: payload.documentType,
          extractedText: payload.extractedText,
          fileName: payload.fileName,
          mimeType: payload.mimeType || undefined,
          language: payload.language,
          patientId: payload.patientId || undefined,
        },
        tenantId || undefined,
        tenantDb,
      );
    } catch (error: any) {
      this.logger.warn(`Governed registration-document analysis failed: ${error?.message || error}`);
      return null;
    }
  }

  private mergeStructuredDocumentPayloads(
    localPayload: Record<string, any>,
    aiPayload: Record<string, any>,
  ): Record<string, any> {
    const merged: Record<string, any> = { ...(localPayload || {}) };
    for (const [key, value] of Object.entries(aiPayload || {})) {
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        continue;
      }
      const existing = merged[key];
      if (Array.isArray(existing) && Array.isArray(value)) {
        merged[key] = Array.from(new Set([...existing, ...value]));
      } else if (
        existing &&
        typeof existing === 'object' &&
        !Array.isArray(existing) &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        merged[key] = { ...existing, ...value };
      } else {
        merged[key] = value;
      }
    }
    return merged;
  }

  private normalizeDocumentType(raw?: string | null): string {
    const normalized = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (['insurance_card', 'medical_aid_card', 'member_card'].includes(normalized)) return 'insurance_card';
    if (['referral', 'referral_letter'].includes(normalized)) return 'referral_letter';
    if (['passport', 'national_id', 'id_card', 'identity_document'].includes(normalized)) return 'id_document';
    return normalized || 'id_document';
  }

  private resolveLocalOcrUrl(): string | null {
    const direct = String(process.env.LOCAL_OCR_URL || '').trim();
    if (direct) {
      return /\/extract$/i.test(direct) ? direct.replace(/\/+$/, '') : `${direct.replace(/\/+$/, '')}/extract`;
    }
    const base = String(process.env.LOCAL_AI_BASE_URL || '').trim().replace(/\/+$/, '');
    const path = String(process.env.LOCAL_OCR_PATH || '/extract').trim();
    if (!base) return null;
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private getLocalOcrTimeoutMs(): number {
    const raw = Number(process.env.LOCAL_OCR_TIMEOUT_MS || 15000);
    return Number.isFinite(raw) && raw > 0 ? raw : 15000;
  }

  private hashFile(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private normalizeName(value: any): string {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private normalizeText(value: any): string {
    return String(value || '').trim();
  }

  private normalizePhone(value: any): string {
    return String(value || '').replace(/\D+/g, '').trim();
  }

  private normalizeEmail(value: any): string {
    return String(value || '').trim().toLowerCase();
  }

  private normalizeLooseId(value: any): string {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private normalizeDate(value: any): string | null {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    const raw = String(value).trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [day, month, year] = raw.split('/');
      return `${year}-${month}-${day}`;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }

  private estimateAge(dateOfBirth?: string | Date | null): number | null {
    const normalized = this.normalizeDate(dateOfBirth);
    if (!normalized) return null;
    const dob = new Date(normalized);
    if (Number.isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  }

  private computeDiceSimilarity(left: string, right: string): number {
    if (!left || !right) return 0;
    if (left === right) return 1;
    const leftPairs = this.toBigrams(left);
    const rightPairs = this.toBigrams(right);
    if (leftPairs.length === 0 || rightPairs.length === 0) return 0;
    const rightCounts = new Map<string, number>();
    for (const pair of rightPairs) {
      rightCounts.set(pair, (rightCounts.get(pair) || 0) + 1);
    }
    let overlap = 0;
    for (const pair of leftPairs) {
      const count = rightCounts.get(pair) || 0;
      if (count > 0) {
        overlap++;
        rightCounts.set(pair, count - 1);
      }
    }
    return (2 * overlap) / (leftPairs.length + rightPairs.length);
  }

  private toBigrams(value: string): string[] {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length < 2) return normalized ? [normalized] : [];
    const pairs: string[] = [];
    for (let i = 0; i < normalized.length - 1; i++) {
      pairs.push(normalized.slice(i, i + 2));
    }
    return pairs;
  }

  private matchLabeledValue(text: string, labels: string[]): string | null {
    for (const label of labels) {
      const regex = new RegExp(`${label}\\s*[:\\-]\\s*([^\\n]+)`, 'i');
      const match = text.match(regex);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  private findInsuranceProvider(text: string): string | null {
    const known = ['cimas', 'psmas', 'first mutual', 'bon vie'];
    const lower = text.toLowerCase();
    const found = known.find((entry) => lower.includes(entry));
    return found ? found.replace(/\b\w/g, (char) => char.toUpperCase()) : null;
  }

  private findReferralUrgency(text: string): string | null {
    const lowered = text.toLowerCase();
    if (/\b(stat|urgent|emergency|immediate)\b/.test(lowered)) return 'urgent';
    if (/\b(semi[-\s]?urgent|priority)\b/.test(lowered)) return 'priority';
    if (/\b(routine)\b/.test(lowered)) return 'routine';
    return null;
  }

  private findReferralFacility(text: string): string | null {
    const match = text.match(/\b([A-Z][A-Za-z0-9'&.\- ]+(Hospital|Clinic|Medical Centre|Medical Center|Practice))\b/m);
    return match ? match[1].trim() : null;
  }

  private findRequestedSpecialty(text: string): string | null {
    const lowered = text.toLowerCase();
    const specialties = [
      'cardiology',
      'neurology',
      'orthopedics',
      'orthopaedics',
      'oncology',
      'ent',
      'urology',
      'gynaecology',
      'gynecology',
      'ophthalmology',
      'dermatology',
      'pediatrics',
      'paediatrics',
      'pulmonology',
      'nephrology',
      'psychiatry',
      'mental health',
    ];

    const found = specialties.find((item) => lowered.includes(item));
    return found || null;
  }

  private findRequestedInvestigations(text: string): string[] {
    const lowered = text.toLowerCase();
    const investigations = [
      'ct scan',
      'mri',
      'ultrasound',
      'x-ray',
      'ecg',
      'echo',
      'full blood count',
      'fbc',
      'liver function tests',
      'renal function tests',
      'biopsy',
    ];

    return investigations.filter((item) => lowered.includes(item));
  }

  private findFollowUpWindow(text: string): string | null {
    const match = text.match(/\b(within\s+\d+\s+(day|days|week|weeks|month|months)|in\s+\d+\s+(day|days|week|weeks|month|months)|as soon as possible)\b/i);
    return match ? match[1].trim() : null;
  }

  private findMedicationCandidates(text: string): string[] {
    const lowered = text.toLowerCase();
    const candidates = ['amoxicillin', 'ceftriaxone', 'metformin', 'insulin', 'paracetamol', 'ibuprofen', 'omeprazole', 'salbutamol'];
    return candidates.filter((item) => lowered.includes(item));
  }

  private findLooseMemberNumber(text: string): string | null {
    const match = text.match(/\b(?:member|policy|scheme)[^\n:]{0,20}[:#-]?\s*([A-Z0-9-]{6,})\b/i);
    return match?.[1] ? match[1].trim() : null;
  }

  private findLooseNationalId(text: string): string | null {
    const match = text.match(/\b([A-Z0-9-]{8,20})\b/);
    return match?.[1] ? match[1].trim() : null;
  }

  private findDateInText(text: string): string | null {
    const match = text.match(/\b(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b/);
    return this.normalizeDate(match?.[1] || null);
  }

  private combineNameParts(givenNames?: string | null, surname?: string | null): string | null {
    const joined = [givenNames, surname].filter(Boolean).join(' ').trim();
    return joined || null;
  }
}
