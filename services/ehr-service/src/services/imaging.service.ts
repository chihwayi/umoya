import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { FinanceService } from './finance.service';
import { PAYMENT_STATUS } from '../constants/payment-status';
import { TerminologyService, SnomedMapping } from './terminology.service';
import { CdssHookService } from './cdss-hook.service';
import { StorageService } from './storage.service';
import { CdssService } from './cdss.service';
import { MinioService } from './minio.service';
import { ImagingOrderAiReview } from '../entities/imaging-order-ai-review.entity';
import { RadiologyReportDraft } from '../entities/radiology-report-draft.entity';
import { RadiologyDiscrepancyReview } from '../entities/radiology-discrepancy-review.entity';
import { IncidentalFindingFollowup } from '../entities/incidental-finding-followup.entity';

@Injectable()
export class ImagingService {
  private readonly logger = new Logger(ImagingService.name);
  private readonly signedUrlTtlSeconds: number;

  constructor(
    private readonly financeService: FinanceService,
    private readonly terminologyService: TerminologyService,
    private readonly cdssHookService: CdssHookService,
    private readonly storageService: StorageService,
    private readonly cdssService: CdssService,
    private readonly minioService: MinioService,
  ) {
    const ttlCandidate = Number(process.env.IMAGING_SIGNED_URL_TTL ?? 300);
    this.signedUrlTtlSeconds = Number.isFinite(ttlCandidate) && ttlCandidate > 0 ? ttlCandidate : 300;
  }

  private isMissingSchemaError(error: any): boolean {
    const code = String(error?.code || '').toUpperCase();
    const message = String(error?.message || '').toLowerCase();
    return code === '42P01' || code === '42703' || message.includes('does not exist');
  }

  private async hasTable(tenantDb: DataSource, tableName: string): Promise<boolean> {
    try {
      const result = await tenantDb.query(
        `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = $1
        ) AS exists
        `,
        [tableName],
      );
      return !!result[0]?.exists;
    } catch (error: any) {
      this.logger.warn(`Failed table existence check for ${tableName}: ${error.message}`);
      return false;
    }
  }

  private getDefaultDoctorResultsPayload() {
    return {
      results: [],
      counts: {
        total: 0,
        awaiting_payment: 0,
        pending: 0,
        awaiting_ack: 0,
        completed: 0,
        critical: 0,
        cancelled: 0,
      },
    };
  }

  // ===== MODALITIES & STUDY TYPES =====

  async getModalities(tenantDb: DataSource) {
    const modalities = await tenantDb.query(
      `
      SELECT 
        m.*,
        COUNT(st.id) as study_type_count
      FROM imaging_modalities m
      LEFT JOIN imaging_study_types st ON st.modality_id = m.id AND st.is_active = true
      WHERE m.is_active = true
      GROUP BY m.id
      ORDER BY m.modality_name
      `,
    );

    return { modalities, total: modalities.length };
  }

  async getStudyTypes(tenantDb: DataSource, modalityCode?: string) {
    const query = `
      SELECT 
        st.*,
        m.modality_code,
        m.modality_name
      FROM imaging_study_types st
      INNER JOIN imaging_modalities m ON m.id = st.modality_id
      WHERE st.is_active = true
        ${modalityCode ? `AND m.modality_code = $1` : ''}
      ORDER BY m.modality_name, st.study_name
    `;

    const params = modalityCode ? [modalityCode] : [];
    const studyTypes = await tenantDb.query(query, params);

    return { studyTypes, total: studyTypes.length };
  }

  async getStudyTypeById(tenantDb: DataSource, id: string) {
    const studyType = await tenantDb.query(
      `
      SELECT 
        st.*,
        m.modality_code,
        m.modality_name
      FROM imaging_study_types st
      INNER JOIN imaging_modalities m ON m.id = st.modality_id
      WHERE st.id = $1
      `,
      [id],
    );

    if (studyType.length === 0) {
      throw new NotFoundException(`Study type with ID ${id} not found`);
    }

    return studyType[0];
  }

  // ===== ORDERS =====

  async createOrder(tenantDb: DataSource, orderData: any, userId?: string, tenantId?: string) {
    const {
      patient_id,
      study_type_id,
      ordering_provider,
      clinical_indication,
      clinical_history,
      suspected_diagnosis,
      icd10_codes,
      priority,
    } = orderData;

    const orderNumber = `IMG-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    const [studyInfo] = await tenantDb.query(
      `
      SELECT study_name, study_code, cost
      FROM imaging_study_types
      WHERE id = $1
      `,
      [study_type_id],
    );

    const studyName = studyInfo?.study_name || 'Imaging Study';
    const studyCode = studyInfo?.study_code || 'IMAGING';
    const studyCost =
      studyInfo && studyInfo.cost !== null && studyInfo.cost !== undefined
        ? Number(studyInfo.cost)
        : Number.NaN;

    const defaultImagingFee =
      process.env.DEFAULT_IMAGING_FEE !== undefined
        ? Number(process.env.DEFAULT_IMAGING_FEE)
        : 0;

    const amountCandidate =
      Number.isFinite(studyCost) && studyCost > 0 ? studyCost : defaultImagingFee;
    const feeAmount = Number.isFinite(amountCandidate) && amountCandidate > 0 ? Number(amountCandidate) : 0;

    let orderStatus = 'ordered';
    let paymentStatus = PAYMENT_STATUS.PAYMENT_CONFIRMED;
    let financeTransactionId: string | null = null;

    if (feeAmount > 0) {
      const transaction = await this.financeService.createTransaction(
        tenantDb,
        {
          sourceModule: 'imaging_orders',
          patientId: patient_id,
          amount: feeAmount,
          currency: 'USD',
          notes: studyName,
          payerType: 'self',
          lineItems: [
            {
              description: studyName,
              billingCode: studyCode,
              unitPrice: feeAmount,
              quantity: 1,
            },
          ],
        },
        userId,
      );
      financeTransactionId = transaction.id;
      paymentStatus = PAYMENT_STATUS.AWAITING_PAYMENT;
      orderStatus = 'awaiting_payment';
    }

    const conceptCandidate =
      orderData.snomedConceptId ??
      orderData.conceptId ??
      orderData?.snomed?.conceptId ??
      suspected_diagnosis ??
      null;

    let snomedConceptId: string | null = null;
    let snomedTerm: string | null = orderData.snomedTerm ?? null;
    let snomedModuleId: string | null = orderData.snomedModuleId ?? null;
    let snomedDefinitionStatus: string | null = orderData.snomedDefinitionStatus ?? null;
    let cptCode: string | null = orderData.cptCode ?? null;

    if (conceptCandidate && /^\d+$/.test(String(conceptCandidate))) {
      try {
        const concept = await this.terminologyService.validateConcept(
          tenantDb,
          String(conceptCandidate),
        );
        snomedConceptId = concept?.conceptId ?? null;
        snomedTerm =
          snomedTerm ??
          concept?.preferredTerm ??
          concept?.term ??
          concept?.fullySpecifiedName ??
          studyName;
        snomedModuleId = snomedModuleId ?? concept?.moduleId ?? null;
        snomedDefinitionStatus = snomedDefinitionStatus ?? concept?.definitionStatus ?? null;

        if (!cptCode) {
          const cptMappings: SnomedMapping[] = await this.terminologyService
            .mapConcept(tenantDb, concept.conceptId, 'CPT')
            .catch(() => []);
          if (cptMappings.length > 0) {
            cptCode = cptMappings[0].targetCode || null;
          }
        }
      } catch (error: any) {
        this.logger.warn(
          `SNOMED validation failed for imaging order concept "${conceptCandidate}": ${error?.message || error}`,
        );
      }
    } else if (conceptCandidate) {
      this.logger.warn(
        `Received non-numeric SNOMED concept "${conceptCandidate}" for imaging order – storing as free text.`,
      );
    }

    if (!snomedTerm) {
      snomedTerm = studyName;
    }

    if (!snomedConceptId && conceptCandidate) {
      snomedConceptId = String(conceptCandidate);
      snomedTerm = snomedTerm ?? studyName;
    }

    const result = await tenantDb.query(
      `
      INSERT INTO imaging_orders (
        patient_id, order_number, study_type_id, ordering_provider,
        clinical_indication, clinical_history, suspected_diagnosis,
        icd10_codes, priority, order_status, ordered_at, created_by,
        fee_amount, finance_transaction_id, payment_status,
        snomed_concept_id, snomed_term, snomed_module_id,
        snomed_definition_status, cpt_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
      `,
      [
        patient_id,
        orderNumber,
        study_type_id,
        ordering_provider,
        clinical_indication,
        clinical_history,
        suspected_diagnosis,
        icd10_codes,
        priority || 'routine',
        orderStatus,
        userId,
        feeAmount > 0 ? feeAmount : null,
        financeTransactionId,
        paymentStatus,
        snomedConceptId,
        snomedTerm,
        snomedModuleId,
        snomedDefinitionStatus,
        cptCode,
      ],
    );

    const order = result[0];

    if (financeTransactionId) {
      await tenantDb.query(
        `
        UPDATE financial_transactions
        SET source_reference_id = $1
        WHERE id = $2
      `,
        [order.id, financeTransactionId],
      );
    }

    let cdssInsights: any = null;
    try {
      cdssInsights = await this.cdssHookService.handleImagingOrderCreated({
        tenantId,
        tenantDb,
        imagingOrder: order,
      });
    } catch (error) {
      this.logger.warn(`CDSS hook failed for imaging order ${order.id}: ${error instanceof Error ? error.message : error}`);
    }

    let aiReview: ImagingOrderAiReview | null = null;
    try {
      aiReview = await this.prepareOrderAiReview(tenantDb, order.id, tenantId, userId);
    } catch (error) {
      this.logger.warn(`Imaging AI review failed for order ${order.id}: ${error instanceof Error ? error.message : error}`);
    }

    this.logger.log(
      `Created imaging order ${orderNumber} for patient ${patient_id} (${paymentStatus})`,
    );
    return {
      ...order,
      cdssInsights,
      aiReview,
    };
  }

  async prepareOrderAiReview(tenantDb: DataSource, orderId: string, tenantId?: string, userId?: string) {
    const order = await tenantDb.query(
      `
      SELECT
        io.id,
        io.patient_id,
        io.study_type_id,
        io.priority,
        io.order_status,
        io.payment_status,
        io.clinical_indication,
        io.clinical_history,
        io.suspected_diagnosis,
        io.ordered_at,
        st.study_name,
        st.study_code,
        st.body_part,
        st.preparation_instructions,
        st.contrast_required,
        m.modality_name,
        m.modality_code,
        p.date_of_birth,
        p.gender
      FROM imaging_orders io
      INNER JOIN imaging_study_types st ON st.id = io.study_type_id
      INNER JOIN imaging_modalities m ON m.id = st.modality_id
      INNER JOIN patients p ON p.id = io.patient_id
      WHERE io.id = $1
      `,
      [orderId],
    );

    if (order.length === 0) {
      throw new NotFoundException(`Imaging order with ID ${orderId} not found`);
    }

    const row = order[0];
    const reviewRepo = tenantDb.getRepository(ImagingOrderAiReview);
    const age = row.date_of_birth ? this.calculateAge(row.date_of_birth) : null;
    const guidelines = await this.cdssService.getGuidelines(
      `${row.study_name} imaging appropriateness`,
      {
        age,
        gender: row.gender ?? null,
        conditions: [row.suspected_diagnosis, row.clinical_indication].filter(Boolean),
        specialty: 'radiology',
        module: 'imaging_appropriateness',
        patientId: row.patient_id,
      },
      tenantId,
      tenantDb,
    );
    const protocolSearch = await this.cdssService.searchGuidelines(
      `${row.modality_code || row.modality_name} ${row.study_name} protocol ${row.clinical_indication || row.body_part || ''}`.trim(),
      5,
      {
        specialty: 'radiology',
        module: 'imaging_appropriateness',
        patientId: row.patient_id,
      },
      tenantId,
      tenantDb,
    );

    const duplicateOrders = await tenantDb.query(
      `
      SELECT id, ordered_at, order_status
      FROM imaging_orders
      WHERE patient_id = $1
        AND study_type_id = $2
        AND id <> $3
        AND ordered_at >= NOW() - INTERVAL '30 days'
        AND order_status <> 'cancelled'
      ORDER BY ordered_at DESC
      LIMIT 3
      `,
      [row.patient_id, row.study_type_id, row.id],
    );

    const supportingSignals = [
      ...(Array.isArray(guidelines.recommendations)
        ? guidelines.recommendations.slice(0, 4).map((recommendation: string) => ({
            code: 'guideline_recommendation',
            message: recommendation,
          }))
        : []),
      ...(Array.isArray(protocolSearch.citations)
        ? protocolSearch.citations.slice(0, 4).map((citation: any) => ({
            code: 'protocol_citation',
            message: citation.title || citation.text || 'Protocol citation',
            source: citation.source || null,
          }))
        : []),
      ...(row.preparation_instructions
        ? [{
            code: 'preparation_instructions',
            message: row.preparation_instructions,
          }]
        : []),
    ];

    const blockingIssues: Array<Record<string, any>> = [];
    if (!String(row.clinical_indication || '').trim()) {
      blockingIssues.push({
        code: 'missing_clinical_indication',
        message: 'Clinical indication is missing or too sparse for confident imaging appropriateness review.',
        severity: 'high',
      });
    }
    if (duplicateOrders.length > 0) {
      blockingIssues.push({
        code: 'recent_similar_imaging_order',
        message: 'Patient already has a similar imaging order in the last 30 days.',
        severity: 'medium',
        metadata: duplicateOrders.map((item: any) => ({
          orderId: item.id,
          orderedAt: item.ordered_at,
          status: item.order_status,
        })),
      });
    }
    if (row.contrast_required) {
      blockingIssues.push({
        code: 'contrast_review_required',
        message: 'Contrast requirement should be confirmed against renal function, allergy history, and local protocol before acquisition.',
        severity: 'medium',
      });
    }

    const recommendedAlternatives = [];
    if (duplicateOrders.length > 0) {
      recommendedAlternatives.push({
        type: 'review_existing_study',
        message: 'Review recent imaging or existing report before repeating the study.',
      });
    }
    if (String(row.priority || '').toLowerCase() === 'stat' && !duplicateOrders.length) {
      recommendedAlternatives.push({
        type: 'radiologist_protocol_confirmation',
        message: 'Escalate to radiologist if protocol or contrast approach needs immediate confirmation.',
      });
    }

    const appropriatenessStatus = blockingIssues.some((issue) => issue.code === 'missing_clinical_indication')
      ? 'needs_context'
      : blockingIssues.length > 0
        ? 'acceptable_with_caution'
        : supportingSignals.length > 0
          ? 'supported'
          : 'needs_context';

    const protocolSummary = {
      modality: row.modality_code || row.modality_name,
      studyName: row.study_name,
      bodyPart: row.body_part,
      preparationInstructions: row.preparation_instructions || null,
      contrastRequired: Boolean(row.contrast_required),
      paymentStatus: row.payment_status,
    };

    const review = await reviewRepo.save(
      reviewRepo.create({
        imagingOrderId: row.id,
        patientId: row.patient_id,
        studyTypeId: row.study_type_id,
        reviewedBy: userId ?? null,
        reviewStatus: 'generated',
        appropriatenessStatus,
        protocolSummary,
        supportingSignals,
        blockingIssues,
        recommendedAlternatives,
        guidelineCitations: Array.isArray(protocolSearch.citations) ? protocolSearch.citations.slice(0, 5) : [],
        rationale: this.buildImagingOrderReviewRationale({
          studyName: row.study_name,
          appropriatenessStatus,
          blockingIssueCount: blockingIssues.length,
          supportingSignalCount: supportingSignals.length,
        }),
        governance: {
          governedPath: true,
          workstream: 'MOAS-08',
          source: 'imaging_order_review',
          guidelineSource: guidelines.source || null,
          governedCorpusUsed:
            'governed_corpus_used' in protocolSearch && protocolSearch.governed_corpus_used === true,
        },
      }),
    );

    return review;
  }

  async getOrderAiReview(tenantDb: DataSource, orderId: string) {
    return tenantDb.getRepository(ImagingOrderAiReview).findOne({
      where: { imagingOrderId: orderId },
      order: { createdAt: 'DESC' },
    });
  }

  async generateReportDraft(tenantDb: DataSource, studyId: string, tenantId?: string, userId?: string) {
    const study = await tenantDb.query(
      `
      SELECT
        s.id,
        s.imaging_order_id,
        s.patient_id,
        s.study_description,
        s.technique,
        s.study_status,
        st.study_name,
        st.body_part,
        st.preparation_instructions,
        st.contrast_required,
        m.modality_name,
        m.modality_code,
        io.clinical_indication,
        io.clinical_history,
        io.suspected_diagnosis,
        p.date_of_birth,
        p.gender
      FROM imaging_studies s
      INNER JOIN imaging_study_types st ON st.id = s.study_type_id
      INNER JOIN imaging_modalities m ON m.id = st.modality_id
      INNER JOIN imaging_orders io ON io.id = s.imaging_order_id
      INNER JOIN patients p ON p.id = s.patient_id
      WHERE s.id = $1
      `,
      [studyId],
    );

    if (study.length === 0) {
      throw new NotFoundException(`Study with ID ${studyId} not found`);
    }

    const row = study[0];
    const aiFinding = await this.getLatestRadiologyFindingForStudy(
      tenantDb,
      row.imaging_order_id,
      row.patient_id,
    );
    const age = row.date_of_birth ? this.calculateAge(row.date_of_birth) : null;
    const guidelines = await this.cdssService.getGuidelines(
      `${row.study_name} radiology report draft`,
      {
        age,
        gender: row.gender ?? null,
        conditions: [row.suspected_diagnosis, row.clinical_indication].filter(Boolean),
        specialty: 'radiology',
        module: 'reporting',
        patientId: row.patient_id,
      },
      tenantId,
      tenantDb,
    );
    const citations = await this.cdssService.searchGuidelines(
      `${row.modality_code || row.modality_name} ${row.study_name} structured radiology report ${row.clinical_indication || row.body_part || ''}`.trim(),
      5,
      {
        specialty: 'radiology',
        module: 'reporting',
        patientId: row.patient_id,
      },
      tenantId,
      tenantDb,
    );

    const findingsList = Array.isArray(aiFinding?.findings) ? aiFinding.findings : [];
    const draftFindings =
      findingsList.length > 0
        ? findingsList
            .slice(0, 4)
            .map((finding: any) => {
              const confidence = finding.confidence ? ` (${Math.round(Number(finding.confidence) * 100)}% confidence)` : '';
              const region = finding.region ? `${finding.region}: ` : '';
              return `${region}${finding.label || finding.finding || 'Finding'}${confidence}.`;
            })
            .join(' ')
        : `No AI findings were available for ${row.study_name}. Correlate reported findings with the clinical indication and acquired images.`;

    const draftImpression =
      (aiFinding?.topFinding || aiFinding?.top_finding)
        ? `${aiFinding?.topFinding || aiFinding?.top_finding}. Correlate with the study images and clinical indication before final signoff.`
        : `Correlate ${row.study_name} findings with ${row.clinical_indication || 'the documented clinical indication'} before final interpretation.`;

    const recommendationPool = [
      ...(row.contrast_required
        ? ['Confirm renal function and allergy review before contrast-dependent interpretation or repeat imaging.']
        : []),
      ...(Array.isArray(guidelines.recommendations) ? guidelines.recommendations.slice(0, 2) : []),
      ...(aiFinding?.alerted ? ['Prioritize direct clinician notification and explicit follow-up planning for the flagged finding.'] : []),
    ].filter(Boolean);

    const structuredDraft = {
      structured_findings: findingsList.slice(0, 5).map((finding: any, index: number) => ({
        id: `ai-finding-${index + 1}`,
        region: finding.region || row.body_part || row.study_name,
        finding: finding.label || finding.finding || row.study_name,
        significance: this.mapRadiologyFindingSeverity(finding.severity, aiFinding?.overallConfidence),
        recommendation: recommendationPool[0] || null,
      })),
      ai_summary: {
        topFinding: aiFinding?.topFinding || aiFinding?.top_finding || null,
        overallConfidence: aiFinding?.overallConfidence ?? aiFinding?.overall_confidence ?? null,
        modelVersion: aiFinding?.modelVersion || aiFinding?.model_version || null,
      },
    };

    const draftRepo = tenantDb.getRepository(RadiologyReportDraft);
    return draftRepo.save(
      draftRepo.create({
        imagingStudyId: row.id,
        imagingOrderId: row.imaging_order_id,
        patientId: row.patient_id,
        aiFindingId: aiFinding?.id ?? null,
        generatedBy: userId ?? null,
        draftStatus: aiFinding ? 'generated' : 'needs_manual_review',
        draftFindings,
        draftImpression,
        draftRecommendations: recommendationPool.join(' ') || null,
        structuredDraft,
        supportingEvidence: [
          ...(findingsList.slice(0, 4).map((finding: any) => ({
            type: 'radiology_ai_finding',
            label: finding.label || finding.finding || null,
            region: finding.region || null,
            confidence: finding.confidence ?? null,
            severity: finding.severity ?? null,
          })) || []),
          ...(Array.isArray(guidelines.recommendations)
            ? guidelines.recommendations.slice(0, 3).map((recommendation: string) => ({
                type: 'guideline_recommendation',
                message: recommendation,
              }))
            : []),
        ],
        guidelineCitations: Array.isArray(citations.citations) ? citations.citations.slice(0, 5) : [],
        governance: {
          governedPath: true,
          workstream: 'MOAS-08',
          source: 'radiology_report_draft',
          guidelineSource: guidelines.source || null,
          governedCorpusUsed: 'governed_corpus_used' in citations && citations.governed_corpus_used === true,
        },
      }),
    );
  }

  async getStudyReportDraft(tenantDb: DataSource, studyId: string) {
    return tenantDb.getRepository(RadiologyReportDraft).findOne({
      where: { imagingStudyId: studyId },
      order: { createdAt: 'DESC' },
    });
  }

  async listReportDiscrepancyReviews(tenantDb: DataSource, reportId: string) {
    return tenantDb.getRepository(RadiologyDiscrepancyReview).find({
      where: { imagingReportId: reportId },
      order: { createdAt: 'DESC' },
      take: 5,
    });
  }

  async listReportIncidentalFollowups(tenantDb: DataSource, reportId: string) {
    return tenantDb.getRepository(IncidentalFindingFollowup).find({
      where: { imagingReportId: reportId },
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  async resolveDiscrepancyReview(
    tenantDb: DataSource,
    reviewId: string,
    payload: { review_status?: string; resolution_notes?: string | null } = {},
    userId?: string,
  ) {
    const repo = tenantDb.getRepository(RadiologyDiscrepancyReview);
    const review = await repo.findOneBy({ id: reviewId });

    if (!review) {
      throw new NotFoundException(`Discrepancy review with ID ${reviewId} not found`);
    }

    const reviewStatus = String(payload.review_status || 'resolved').trim().toLowerCase();
    if (!['resolved', 'dismissed', 'escalated'].includes(reviewStatus)) {
      throw new BadRequestException('Invalid discrepancy review status');
    }

    const updated = await repo.save({
      ...review,
      reviewedBy: userId ?? review.reviewedBy ?? null,
      resolvedAt: new Date(),
      reviewStatus,
      resolutionNotes: payload.resolution_notes?.trim() || null,
      governance: {
        ...(review.governance || {}),
        resolutionStatus: reviewStatus,
        resolutionUpdatedAt: new Date().toISOString(),
      },
    });

    if (reviewStatus === 'escalated') {
      const followupRepo = tenantDb.getRepository(IncidentalFindingFollowup);
      const followup = await followupRepo.findOne({
        where: {
          imagingReportId: review.imagingReportId,
          status: 'open',
        },
        order: { createdAt: 'DESC' },
      });

      if (followup) {
        await followupRepo.save({
          ...followup,
          status: 'acknowledged',
          acknowledgedBy: userId ?? followup.acknowledgedBy ?? null,
          acknowledgedAt: followup.acknowledgedAt || new Date(),
          resolutionNotes: payload.resolution_notes?.trim() || followup.resolutionNotes || null,
          governance: {
            ...(followup.governance || {}),
            escalationSource: 'radiology_discrepancy_review',
            escalationReviewId: reviewId,
          },
        });
      }
    }

    return updated;
  }

  async acknowledgeIncidentalFollowup(
    tenantDb: DataSource,
    followupId: string,
    payload: { resolution_notes?: string | null } = {},
    userId?: string,
  ) {
    const repo = tenantDb.getRepository(IncidentalFindingFollowup);
    const followup = await repo.findOneBy({ id: followupId });

    if (!followup) {
      throw new NotFoundException(`Incidental follow-up with ID ${followupId} not found`);
    }

    if (followup.status === 'completed') {
      throw new BadRequestException('Completed follow-up cannot be acknowledged again');
    }

    return repo.save({
      ...followup,
      status: 'acknowledged',
      acknowledgedBy: userId ?? followup.acknowledgedBy ?? null,
      acknowledgedAt: followup.acknowledgedAt || new Date(),
      resolutionNotes: payload.resolution_notes?.trim() || followup.resolutionNotes || null,
      governance: {
        ...(followup.governance || {}),
        acknowledgedAt: new Date().toISOString(),
      },
    });
  }

  async completeIncidentalFollowup(
    tenantDb: DataSource,
    followupId: string,
    payload: { resolution_notes?: string | null } = {},
    userId?: string,
  ) {
    const repo = tenantDb.getRepository(IncidentalFindingFollowup);
    const followup = await repo.findOneBy({ id: followupId });

    if (!followup) {
      throw new NotFoundException(`Incidental follow-up with ID ${followupId} not found`);
    }

    return repo.save({
      ...followup,
      status: 'completed',
      acknowledgedBy: followup.acknowledgedBy ?? userId ?? null,
      acknowledgedAt: followup.acknowledgedAt || new Date(),
      completedBy: userId ?? followup.completedBy ?? null,
      completedAt: new Date(),
      resolutionNotes: payload.resolution_notes?.trim() || followup.resolutionNotes || null,
      governance: {
        ...(followup.governance || {}),
        completedAt: new Date().toISOString(),
      },
    });
  }

  async getOrders(tenantDb: DataSource, filters: { status?: string; priority?: string } = {}) {
    const query = `
      SELECT 
        io.*,
        p.id as patient_id,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        p.date_of_birth,
        p.gender,
        st.study_name,
        st.body_part,
        m.modality_name,
        m.modality_code,
        u.first_name || ' ' || u.last_name as ordering_provider_name
      FROM imaging_orders io
      INNER JOIN patients p ON p.id = io.patient_id
      INNER JOIN imaging_study_types st ON st.id = io.study_type_id
      INNER JOIN imaging_modalities m ON m.id = st.modality_id
      INNER JOIN users u ON u.id = io.ordering_provider
      WHERE 1=1
        ${filters.status ? `AND io.order_status = $1` : ''}
        ${filters.priority ? `AND io.priority = $${filters.status ? 2 : 1}` : ''}
      ORDER BY 
        CASE io.priority 
          WHEN 'stat' THEN 1
          WHEN 'urgent' THEN 2
          WHEN 'routine' THEN 3
        END,
        io.ordered_at DESC
      LIMIT 100
    `;

    const params = [];
    if (filters.status) params.push(filters.status);
    if (filters.priority) params.push(filters.priority);

    const orders = await tenantDb.query(query, params);
    return { orders, total: orders.length };
  }

  async getOrderById(tenantDb: DataSource, orderId: string) {
    const order = await tenantDb.query(
      `
      SELECT 
        io.*,
        p.id as patient_id,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        p.date_of_birth,
        p.gender,
        p.phone,
        st.study_name,
        st.study_code,
        st.body_part,
        st.preparation_instructions,
        m.modality_name,
        m.modality_code,
        u.first_name || ' ' || u.last_name as ordering_provider_name
      FROM imaging_orders io
      INNER JOIN patients p ON p.id = io.patient_id
      INNER JOIN imaging_study_types st ON st.id = io.study_type_id
      INNER JOIN imaging_modalities m ON m.id = st.modality_id
      INNER JOIN users u ON u.id = io.ordering_provider
      WHERE io.id = $1
      `,
      [orderId],
    );

    if (order.length === 0) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const aiReview = await this.getOrderAiReview(tenantDb, orderId).catch(() => null);
    return { ...order[0], aiReview };
  }

  async getPatientOrders(tenantDb: DataSource, patientId: string) {
    const orders = await tenantDb.query(
      `
      SELECT
        io.*,
        st.study_name,
        m.modality_name,
        m.modality_code,
        u.first_name || ' ' || u.last_name as ordering_provider_name,
        r.id as report_id,
        ior.ai_summary as ai_review_summary
      FROM imaging_orders io
      INNER JOIN imaging_study_types st ON st.id = io.study_type_id
      INNER JOIN imaging_modalities m ON m.id = st.modality_id
      INNER JOIN users u ON u.id = io.ordering_provider
      LEFT JOIN imaging_studies s ON s.imaging_order_id = io.id
      LEFT JOIN imaging_reports r ON r.imaging_study_id = s.id
      LEFT JOIN imaging_order_ai_reviews ior ON ior.imaging_order_id = io.id
      WHERE io.patient_id = $1
      ORDER BY io.ordered_at DESC
      `,
      [patientId],
    );

    return {
      orders: orders.map((o: any) => ({ ...o, reportId: o.report_id ?? null })),
      total: orders.length,
    };
  }

  private calculateAge(dateOfBirth: string | Date) {
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      return null;
    }
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDelta = today.getMonth() - dob.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age;
  }

  private buildImagingOrderReviewRationale(input: {
    studyName: string;
    appropriatenessStatus: string;
    blockingIssueCount: number;
    supportingSignalCount: number;
  }) {
    if (input.appropriatenessStatus === 'supported') {
      return `${input.studyName} is supported by governed radiology guidance and protocol signals.`;
    }
    if (input.appropriatenessStatus === 'acceptable_with_caution') {
      return `${input.studyName} can proceed with caution because ${input.blockingIssueCount} review item(s) require protocol or radiologist confirmation.`;
    }
    return `${input.studyName} needs more context before appropriateness can be confidently confirmed.`;
  }

  async scheduleOrder(tenantDb: DataSource, orderId: string, scheduledDate: string) {
    await this.ensureOrderPaymentCleared(tenantDb, orderId);

    const result = await tenantDb.query(
      `
      UPDATE imaging_orders
      SET 
        order_status = 'scheduled',
        scheduled_date = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [scheduledDate, orderId],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    this.logger.log(`Scheduled imaging order ${orderId} for ${scheduledDate}`);
    return result[0];
  }

  async cancelOrder(tenantDb: DataSource, orderId: string, reason: string, userId?: string) {
    const result = await tenantDb.query(
      `
      UPDATE imaging_orders
      SET 
        order_status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [reason, orderId],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    this.logger.log(`Cancelled imaging order ${orderId}: ${reason}`);
    return result[0];
  }

  // ===== STUDIES =====

  async createStudy(tenantDb: DataSource, studyData: any, userId?: string) {
    const {
      imaging_order_id,
      patient_id,
      study_type_id,
      study_date,
      study_time,
      technologist,
      study_description,
      technique,
      contrast_used,
      contrast_type,
      contrast_volume,
      radiation_dose,
    } = studyData;

    // Generate accession number
    const accessionNumber = `ACC-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    await this.ensureOrderPaymentCleared(tenantDb, imaging_order_id);

    // Update order status to in_progress
    await tenantDb.query(
      `
      UPDATE imaging_orders
      SET order_status = 'in_progress', performed_at = NOW()
      WHERE id = $1
      `,
      [imaging_order_id],
    );

    const result = await tenantDb.query(
      `
      INSERT INTO imaging_studies (
        imaging_order_id, patient_id, accession_number, study_type_id,
        study_date, study_time, technologist, study_status, study_description,
        technique, contrast_used, contrast_type, contrast_volume, radiation_dose
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'in_progress', $8, $9, $10, $11, $12, $13)
      RETURNING *
      `,
      [
        imaging_order_id,
        patient_id,
        accessionNumber,
        study_type_id,
        study_date,
        study_time,
        technologist || userId,
        study_description,
        technique,
        contrast_used || false,
        contrast_type,
        contrast_volume,
        radiation_dose,
      ],
    );

    this.logger.log(`Created imaging study ${accessionNumber} from order ${imaging_order_id}`);
    return result[0];
  }

  async getStudies(
    tenantDb: DataSource,
    filters: { status?: string; modalityCode?: string; radiologistId?: string } = {},
  ) {
    const query = `
      SELECT 
        s.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        p.gender,
        p.date_of_birth,
        st.study_name,
        m.modality_name,
        m.modality_code,
        tech.first_name || ' ' || tech.last_name as technologist_name,
        rad.first_name || ' ' || rad.last_name as radiologist_name,
        CASE 
          WHEN r.report_status = 'final' THEN 'Reported'
          WHEN r.report_status IS NOT NULL THEN 'Draft Report'
          ELSE 'Pending Report'
        END as report_status_text
      FROM imaging_studies s
      INNER JOIN patients p ON p.id = s.patient_id
      INNER JOIN imaging_study_types st ON st.id = s.study_type_id
      INNER JOIN imaging_modalities m ON m.id = st.modality_id
      LEFT JOIN users tech ON tech.id = s.technologist
      LEFT JOIN users rad ON rad.id = s.radiologist_assigned
      LEFT JOIN imaging_reports r ON r.imaging_study_id = s.id
      WHERE 1=1
        ${filters.status ? `AND s.study_status = $1` : ''}
        ${filters.modalityCode ? `AND m.modality_code = $${filters.status ? 2 : 1}` : ''}
        ${filters.radiologistId ? `AND s.radiologist_assigned = $${(filters.status ? 1 : 0) + (filters.modalityCode ? 1 : 0) + 1}` : ''}
      ORDER BY s.study_date DESC, s.study_time DESC
      LIMIT 100
    `;

    const params = [];
    if (filters.status) params.push(filters.status);
    if (filters.modalityCode) params.push(filters.modalityCode);
    if (filters.radiologistId) params.push(filters.radiologistId);

    const studies = await tenantDb.query(query, params);
    return { studies, total: studies.length };
  }

  async getStudyById(tenantDb: DataSource, studyId: string) {
    const study = await tenantDb.query(
      `
      SELECT 
        s.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        p.gender,
        p.date_of_birth,
        st.study_name,
        st.body_part,
        m.modality_name,
        m.modality_code,
        tech.first_name || ' ' || tech.last_name as technologist_name,
        rad.first_name || ' ' || rad.last_name as radiologist_name,
        io.clinical_indication,
        io.clinical_history,
        io.suspected_diagnosis,
        io.payment_status,
        io.order_status,
        io.finance_transaction_id,
        io.fee_amount,
        io.snomed_concept_id,
        io.snomed_term,
        io.snomed_module_id,
        io.snomed_definition_status,
        io.cpt_code
      FROM imaging_studies s
      INNER JOIN patients p ON p.id = s.patient_id
      INNER JOIN imaging_study_types st ON st.id = s.study_type_id
      INNER JOIN imaging_modalities m ON m.id = st.modality_id
      INNER JOIN imaging_orders io ON io.id = s.imaging_order_id
      LEFT JOIN users tech ON tech.id = s.technologist
      LEFT JOIN users rad ON rad.id = s.radiologist_assigned
      WHERE s.id = $1
      `,
      [studyId],
    );

    if (study.length === 0) {
      throw new NotFoundException(`Study with ID ${studyId} not found`);
    }

    // Get images
    const images = await this.getStudyImages(tenantDb, studyId);

    const reportDraft = await this.getStudyReportDraft(tenantDb, studyId).catch(() => null);
    // Get report if exists
    const report = await this.getReportByStudyId(tenantDb, studyId);
    const discrepancyReviews = report?.id
      ? await this.listReportDiscrepancyReviews(tenantDb, report.id).catch(() => [])
      : [];
    const incidentalFollowups = report?.id
      ? await this.listReportIncidentalFollowups(tenantDb, report.id).catch(() => [])
      : [];

    return {
      ...study[0],
      images: images.images,
      report: report || null,
      reportDraft,
      discrepancyReviews,
      incidentalFollowups,
    };
  }

  async assignRadiologist(tenantDb: DataSource, studyId: string, radiologistId: string) {
    const result = await tenantDb.query(
      `
      UPDATE imaging_studies
      SET 
        radiologist_assigned = $1,
        study_status = 'awaiting_report',
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [radiologistId, studyId],
    );

    if (result.length === 0) {
      throw new NotFoundException(`Study with ID ${studyId} not found`);
    }

    this.logger.log(`Assigned radiologist ${radiologistId} to study ${studyId}`);
    return result[0];
  }

  async completeStudy(
    tenantDb: DataSource,
    studyId: string,
    userId?: string,
    completionNotes?: string,
  ) {
    const study = await tenantDb.query(
      `
      SELECT imaging_order_id
      FROM imaging_studies
      WHERE id = $1
      `,
      [studyId],
    );

    if (study.length === 0) {
      throw new NotFoundException(`Study with ID ${studyId} not found`);
    }

    const imagingOrderId = study[0].imaging_order_id;
    await this.ensureOrderPaymentCleared(tenantDb, imagingOrderId);

    const result = await tenantDb.query(
      `
      UPDATE imaging_studies
      SET 
        study_status = 'awaiting_report',
        updated_at = NOW(),
        technologist = COALESCE(technologist, $2),
        study_description = COALESCE(study_description, $3)
      WHERE id = $1
      RETURNING *
      `,
      [studyId, userId || null, completionNotes || null],
    );

    await tenantDb.query(
      `
      UPDATE imaging_orders
      SET order_status = 'awaiting_report', updated_at = NOW()
      WHERE id = $1
      `,
      [imagingOrderId],
    );

    this.logger.log(`Marked imaging study ${studyId} as awaiting report`);
    return result[0];
  }

  // ===== IMAGES =====

  async uploadImage(
    tenantDb: DataSource,
    studyId: string,
    imageData: any,
    userId?: string,
    tenantId?: string,
  ) {
    const { file_name, file_path, file_type, file_size, image_number, view_position, is_primary } = imageData;

    if (!file_path) {
      throw new BadRequestException('file_path (base64 payload) is required');
    }

    let storedFilePath: string | null = file_path;
    let storageMode: 'db' | 'object' = 'db';
    let objectKey: string | null = null;
    let contentType = this.resolveContentType(file_path, file_type);
    let fileSizeBytes = file_size || null;
    let fileChecksum: string | null = null;

    if (this.storageService.isEnabled()) {
      const decoded = this.decodeBase64Payload(file_path);
      fileSizeBytes = decoded.buffer.length;
      contentType = decoded.contentType || contentType;
      fileChecksum = createHash('sha256').update(decoded.buffer).digest('hex');

      const key = await this.storageService.uploadStudyAsset({
        tenantId,
        studyId,
        filename: file_name,
        buffer: decoded.buffer,
        contentType,
      });

      if (key) {
        objectKey = key;
        storageMode = 'object';
        storedFilePath = null;
      }
    } else {
      const decoded = this.decodeBase64Payload(file_path);
      fileChecksum = createHash('sha256').update(decoded.buffer).digest('hex');
    }

    const result = await tenantDb.query(
      `
      INSERT INTO imaging_files (
        imaging_study_id, file_name, file_path, file_type, file_size,
        image_number, view_position, is_primary, uploaded_by, uploaded_at,
        object_key, content_type, storage_mode, file_checksum
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11, $12, $13)
      RETURNING *
      `,
      [
        studyId,
        file_name,
        storedFilePath,
        file_type,
        fileSizeBytes,
        image_number,
        view_position,
        is_primary,
        userId,
        objectKey,
        contentType,
        storageMode,
        fileChecksum,
      ],
    );

    await tenantDb.query(
      `
      UPDATE imaging_studies
      SET number_of_images = (
        SELECT COUNT(*) FROM imaging_files WHERE imaging_study_id = $1
      )
      WHERE id = $1
      `,
      [studyId],
    );

    this.logger.log(
      `Uploaded image to study ${studyId}: ${file_name} (${storageMode === 'object' ? 'object storage' : 'database'})`,
    );
    return result[0];
  }

  async getStudyImages(tenantDb: DataSource, studyId: string) {
    const images = await tenantDb.query(
      `
      SELECT 
        f.*,
        u.first_name || ' ' || u.last_name as uploaded_by_name
      FROM imaging_files f
      LEFT JOIN users u ON u.id = f.uploaded_by
      WHERE f.imaging_study_id = $1
      ORDER BY f.is_primary DESC, f.image_number, f.uploaded_at
      `,
      [studyId],
    );

    if (!images.length) {
      return { images, total: 0 };
    }

    const hydrated = await Promise.all(
      images.map(async (image: any) => {
        if (image.storage_mode === 'object' && image.object_key) {
          try {
            const downloadUrl = await this.storageService.getSignedUrl(
              image.object_key,
              this.signedUrlTtlSeconds,
            );
            if (downloadUrl) {
              return {
                ...image,
                file_path: null,
                download_url: downloadUrl,
                download_url_expires_at: new Date(Date.now() + this.signedUrlTtlSeconds * 1000).toISOString(),
              };
            }
          } catch (error) {
            this.logger.warn(
              `Failed to generate signed URL for object ${image.object_key}: ${
                error instanceof Error ? error.message : error
              }`,
            );
          }

          try {
            const data = await this.storageService.getObjectData(image.object_key);
            if (data) {
              const mime = data.contentType || image.content_type || 'application/octet-stream';
              const base64 = data.buffer.toString('base64');
              return {
                ...image,
                file_path: `data:${mime};base64,${base64}`,
                content_type: mime,
                file_size: data.buffer.length,
              };
            }
          } catch (error) {
            this.logger.error(
              `Failed to read object ${image.object_key} for study ${studyId}: ${
                error instanceof Error ? error.message : error
              }`,
            );
          }
        }
        return image;
      }),
    );

    return { images: hydrated, total: hydrated.length };
  }

  async deleteImage(tenantDb: DataSource, imageId: string) {
    const image = await tenantDb.query(
      `
      SELECT * FROM imaging_files
      WHERE id = $1
      `,
      [imageId],
    );

    if (image.length === 0) {
      throw new NotFoundException(`Image with ID ${imageId} not found`);
    }

    await tenantDb.query(
      `
      DELETE FROM imaging_files
      WHERE id = $1
      `,
      [imageId],
    );

    const studyId = image[0].imaging_study_id;
    await tenantDb.query(
      `
      UPDATE imaging_studies
      SET number_of_images = (
        SELECT COUNT(*) FROM imaging_files WHERE imaging_study_id = $1
      )
      WHERE id = $1
      `,
      [studyId],
    );

    if (image[0].storage_mode === 'object' && image[0].object_key) {
      try {
        await this.storageService.deleteObject(image[0].object_key);
      } catch (error) {
        this.logger.warn(
          `Failed to delete object ${image[0].object_key} for image ${imageId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    this.logger.log(`Deleted image ${imageId} from study ${studyId}`);
    return image[0];
  }

  // ===== REPORTS =====

  async createReport(tenantDb: DataSource, reportData: any, userId?: string) {
    const {
      imaging_study_id,
      imaging_order_id,
      patient_id,
      report_draft_id,
      clinical_history,
      technique,
      findings,
      impression,
      recommendations,
      comparison_studies,
      critical_findings,
      is_critical,
      structured_findings,
      severity,
      follow_up_recommended,
      follow_up_interval,
      coded_diagnoses,
    } = reportData;

    await this.ensureOrderPaymentCleared(tenantDb, imaging_order_id);

    const structuredFindingsJson =
      structured_findings !== undefined && structured_findings !== null
        ? JSON.stringify(structured_findings)
        : JSON.stringify({});
    const codedDiagnosesJson =
      coded_diagnoses !== undefined && coded_diagnoses !== null
        ? JSON.stringify(coded_diagnoses)
        : JSON.stringify([]);

    const result = await tenantDb.query(
      `
      INSERT INTO imaging_reports (
        imaging_study_id, imaging_order_id, patient_id, report_status,
        clinical_history, technique, findings, impression, recommendations,
        comparison_studies, critical_findings, is_critical, structured_findings,
        severity, follow_up_recommended, follow_up_interval, coded_diagnoses,
        drafted_by, drafted_at
      )
      VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16::jsonb, $17, NOW())
      RETURNING *
      `,
      [
        imaging_study_id,
        imaging_order_id,
        patient_id,
        clinical_history,
        technique,
        findings,
        impression,
        recommendations,
        comparison_studies,
        critical_findings,
        is_critical || false,
        structuredFindingsJson,
        severity || null,
        follow_up_recommended ?? false,
        follow_up_interval || null,
        codedDiagnosesJson,
        userId,
      ],
    );

    // Update study status
    await tenantDb.query(
      `
      UPDATE imaging_studies
      SET study_status = 'reported', updated_at = NOW()
      WHERE id = $1
      `,
      [imaging_study_id],
    );

    if (report_draft_id) {
      await tenantDb.getRepository(RadiologyReportDraft).update(report_draft_id, {
        linkedReportId: result[0].id,
        draftStatus: 'applied',
      });
    }

    this.logger.log(`Created imaging report for study ${imaging_study_id}`);
    return result[0];
  }

  async getReportById(tenantDb: DataSource, reportId: string) {
    const report = await tenantDb.query(
      `
      SELECT
        r.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        drafted_u.first_name || ' ' || drafted_u.last_name as drafted_by_name,
        signed_u.first_name || ' ' || signed_u.last_name as signed_by_name,
        amended_u.first_name || ' ' || amended_u.last_name as amended_by_name,
        signed_u.first_name || ' ' || signed_u.last_name as "radiologistName",
        COALESCE(r.signed_at, r.created_at) as "reportedAt",
        r.ai_review_summary as "aiSummary"
      FROM imaging_reports r
      INNER JOIN patients p ON p.id = r.patient_id
      LEFT JOIN users drafted_u ON drafted_u.id = r.drafted_by
      LEFT JOIN users signed_u ON signed_u.id = r.signed_by
      LEFT JOIN users amended_u ON amended_u.id = r.amended_by
      WHERE r.id = $1
      `,
      [reportId],
    );

    if (report.length === 0) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    const discrepancyReviews = await this.listReportDiscrepancyReviews(tenantDb, reportId).catch(() => []);
    const incidentalFollowups = await this.listReportIncidentalFollowups(tenantDb, reportId).catch(() => []);

    return {
      ...report[0],
      discrepancyReviews,
      incidentalFollowups,
    };
  }

  async getReportByStudyId(tenantDb: DataSource, studyId: string) {
    const report = await tenantDb.query(
      `
      SELECT 
        r.*,
        drafted_u.first_name || ' ' || drafted_u.last_name as drafted_by_name,
        signed_u.first_name || ' ' || signed_u.last_name as signed_by_name
      FROM imaging_reports r
      LEFT JOIN users drafted_u ON drafted_u.id = r.drafted_by
      LEFT JOIN users signed_u ON signed_u.id = r.signed_by
      WHERE r.imaging_study_id = $1
      ORDER BY r.created_at DESC
      LIMIT 1
      `,
      [studyId],
    );

    if (report.length === 0) {
      return null;
    }

    const discrepancyReviews = await this.listReportDiscrepancyReviews(tenantDb, report[0].id).catch(() => []);
    const incidentalFollowups = await this.listReportIncidentalFollowups(tenantDb, report[0].id).catch(() => []);

    return {
      ...report[0],
      discrepancyReviews,
      incidentalFollowups,
    };
  }

  async updateReport(tenantDb: DataSource, reportId: string, reportData: any) {
    const {
      clinical_history,
      technique,
      findings,
      impression,
      recommendations,
      critical_findings,
      is_critical,
      structured_findings,
      severity,
      follow_up_recommended,
      follow_up_interval,
      coded_diagnoses,
    } = reportData;

    const reportOrderId = await this.getReportOrderId(tenantDb, reportId);
    await this.ensureOrderPaymentCleared(tenantDb, reportOrderId);

    const structuredFindingsJson =
      structured_findings !== undefined ? JSON.stringify(structured_findings) : null;
    const codedDiagnosesJson =
      coded_diagnoses !== undefined ? JSON.stringify(coded_diagnoses) : null;

    const result = await tenantDb.query(
      `
      UPDATE imaging_reports
      SET 
        clinical_history = COALESCE($1, clinical_history),
        technique = COALESCE($2, technique),
        findings = COALESCE($3, findings),
        impression = COALESCE($4, impression),
        recommendations = COALESCE($5, recommendations),
        critical_findings = COALESCE($6, critical_findings),
        is_critical = COALESCE($7, is_critical),
        structured_findings = COALESCE($8::jsonb, structured_findings),
        severity = COALESCE($9, severity),
        follow_up_recommended = COALESCE($10, follow_up_recommended),
        follow_up_interval = COALESCE($11, follow_up_interval),
        coded_diagnoses = COALESCE($12::jsonb, coded_diagnoses),
        updated_at = NOW()
      WHERE id = $13 AND report_status = 'draft'
      RETURNING *
      `,
      [
        clinical_history,
        technique,
        findings,
        impression,
        recommendations,
        critical_findings,
        is_critical,
        structuredFindingsJson,
        severity,
        follow_up_recommended,
        follow_up_interval,
        codedDiagnosesJson,
        reportId,
      ],
    );

    if (result.length === 0) {
      throw new BadRequestException('Report not found or already signed');
    }

    this.logger.log(`Updated imaging report ${reportId}`);
    return result[0];
  }

  async signReport(tenantDb: DataSource, reportId: string, userId?: string) {
    const reportOrderId = await this.getReportOrderId(tenantDb, reportId);
    await this.ensureOrderPaymentCleared(tenantDb, reportOrderId);

    const result = await tenantDb.query(
      `
      UPDATE imaging_reports
      SET 
        report_status = 'final',
        signed_by = $1,
        signed_at = NOW(),
        updated_at = NOW()
      WHERE id = $2 AND report_status IN ('draft', 'preliminary')
      RETURNING *
      `,
      [userId, reportId],
    );

    if (result.length === 0) {
      throw new BadRequestException('Report not found or already signed');
    }

    // Update study and order status
    await tenantDb.query(
      `
      UPDATE imaging_studies
      SET study_status = 'signed', updated_at = NOW()
      WHERE id = $1
      `,
      [result[0].imaging_study_id],
    );

    await tenantDb.query(
      `
      UPDATE imaging_orders
      SET order_status = 'completed', updated_at = NOW()
      WHERE id = $1
      `,
      [result[0].imaging_order_id],
    );

    const postWorkflow = await this.syncRadiologyPostReportWorkflow(tenantDb, reportId, userId);

    this.logger.log(`Signed imaging report ${reportId} by user ${userId}`);
    return {
      ...result[0],
      discrepancyReview: postWorkflow.discrepancyReview,
      incidentalFollowup: postWorkflow.incidentalFollowup,
    };
  }

  async amendReport(tenantDb: DataSource, reportId: string, amendmentData: any, userId?: string) {
    const { amendment_reason, findings, impression } = amendmentData;

    const reportOrderId = await this.getReportOrderId(tenantDb, reportId);
    await this.ensureOrderPaymentCleared(tenantDb, reportOrderId);

    const result = await tenantDb.query(
      `
      UPDATE imaging_reports
      SET 
        report_status = 'amended',
        findings = $1,
        impression = $2,
        amendment_reason = $3,
        amended_by = $4,
        amended_at = NOW(),
        updated_at = NOW()
      WHERE id = $5 AND report_status = 'final'
      RETURNING *
      `,
      [findings, impression, amendment_reason, userId, reportId],
    );

    if (result.length === 0) {
      throw new BadRequestException('Report not found or not signed');
    }

    // Update study status
    await tenantDb.query(
      `
      UPDATE imaging_studies
      SET study_status = 'amended', updated_at = NOW()
      WHERE id = $1
      `,
      [result[0].imaging_study_id],
    );

    const postWorkflow = await this.syncRadiologyPostReportWorkflow(tenantDb, reportId, userId);

    this.logger.warn(`Amended imaging report ${reportId}: ${amendment_reason}`);
    return {
      ...result[0],
      discrepancyReview: postWorkflow.discrepancyReview,
      incidentalFollowup: postWorkflow.incidentalFollowup,
    };
  }

  async getReportTemplates(tenantDb: DataSource, filters: { modalityId?: string; studyTypeId?: string } = {}) {
    const query = `
      SELECT 
        t.*,
        m.modality_name,
        st.study_name
      FROM imaging_report_templates t
      LEFT JOIN imaging_modalities m ON m.id = t.modality_id
      LEFT JOIN imaging_study_types st ON st.id = t.study_type_id
      WHERE 1=1
        ${filters.modalityId ? `AND t.modality_id = $1` : ''}
        ${filters.studyTypeId ? `AND t.study_type_id = $${filters.modalityId ? 2 : 1}` : ''}
      ORDER BY t.is_default DESC, t.template_name
    `;

    const params = [];
    if (filters.modalityId) params.push(filters.modalityId);
    if (filters.studyTypeId) params.push(filters.studyTypeId);

    try {
      const templates = await tenantDb.query(query, params);
      return { templates, total: templates.length };
    } catch (error) {
      this.logger.error(`Failed to load imaging report templates: ${error instanceof Error ? error.message : String(error)}`);
      return { templates: [], total: 0 };
    }
  }

  // ===== ANNOTATIONS =====

  async addAnnotation(tenantDb: DataSource, imageId: string, annotationData: any, userId?: string) {
    const { annotation_type, annotation_data, annotation_text } = annotationData;

    const result = await tenantDb.query(
      `
      INSERT INTO imaging_annotations (
        imaging_file_id, user_id, annotation_type, annotation_data, annotation_text
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [imageId, userId, annotation_type, JSON.stringify(annotation_data), annotation_text],
    );

    this.logger.log(`Added ${annotation_type} annotation to image ${imageId}`);
    return result[0];
  }

  async getImageAnnotations(tenantDb: DataSource, imageId: string) {
    const annotations = await tenantDb.query(
      `
      SELECT 
        a.*,
        u.first_name || ' ' || u.last_name as user_name
      FROM imaging_annotations a
      INNER JOIN users u ON u.id = a.user_id
      WHERE a.imaging_file_id = $1
      ORDER BY a.created_at
      `,
      [imageId],
    );

    return { annotations, total: annotations.length };
  }

  // ===== DOCTOR RESULT REVIEW =====

  private resolveDoctorWorkflowStatus(row: any) {
    if (
      row.payment_status === PAYMENT_STATUS.AWAITING_PAYMENT ||
      row.order_status === 'awaiting_payment'
    ) {
      return 'awaiting_payment';
    }

    if (row.order_status === 'cancelled') {
      return 'cancelled';
    }

    if (row.report_status === 'final') {
      return row.acknowledged_at ? 'acknowledged' : 'awaiting_acknowledgement';
    }

    if (!row.study_id) {
      if (row.order_status === 'scheduled') {
        return 'scheduled';
      }
      return 'awaiting_study';
    }

    if (row.study_status === 'awaiting_report') {
      return 'awaiting_report';
    }

    if (row.study_status === 'reported' || row.report_status === 'draft' || row.report_status === 'preliminary') {
      return 'reporting';
    }

    return 'in_progress';
  }

  async getDoctorImagingResults(
    tenantDb: DataSource,
    doctorId: string,
    options: { status?: string; patientId?: string } = {},
  ) {
    const requiredTables = [
      'imaging_orders',
      'imaging_study_types',
      'imaging_modalities',
      'patients',
      'imaging_studies',
      'imaging_reports',
      'imaging_report_acknowledgements',
    ];

    for (const tableName of requiredTables) {
      if (!(await this.hasTable(tenantDb, tableName))) {
        this.logger.warn(`${tableName} missing; returning default doctor imaging results payload`);
        return this.getDefaultDoctorResultsPayload();
      }
    }

    try {
      const params: any[] = [doctorId];
      const conditions: string[] = ['io.ordering_provider = $1'];

      if (options.patientId) {
        params.push(options.patientId);
        conditions.push(`io.patient_id = $${params.length}`);
      }

      const query = `
        SELECT 
          io.id as order_id,
          io.order_number,
          io.priority,
          io.order_status,
          io.payment_status,
          io.finance_transaction_id,
          io.fee_amount,
          io.ordered_at,
          io.study_type_id,
          io.clinical_indication,
          io.clinical_history,
          io.suspected_diagnosis,
          st.study_name,
          st.study_code,
          st.body_part,
          m.modality_name,
          m.modality_code,
          p.id as patient_id,
          p.first_name,
          p.last_name,
          p.patient_number,
          p.date_of_birth,
          p.gender,
          s.id as study_id,
          s.study_status,
          s.study_date,
          s.study_time,
          s.created_at as study_created_at,
          s.updated_at as study_updated_at,
          s.radiologist_assigned,
          s.technologist,
          r.id as report_id,
          r.report_status,
          r.is_critical,
          r.signed_at,
          r.created_at as report_created_at,
          r.updated_at as report_updated_at,
          r.drafted_by,
          r.signed_by,
          r.structured_findings,
          r.severity as report_severity,
          r.follow_up_recommended,
          r.follow_up_interval,
          r.coded_diagnoses,
          ack.id as acknowledgement_id,
          ack.acknowledged_at,
          ack.acknowledgment_notes
        FROM imaging_orders io
        INNER JOIN imaging_study_types st ON st.id = io.study_type_id
        INNER JOIN imaging_modalities m ON m.id = st.modality_id
        INNER JOIN patients p ON p.id = io.patient_id
        LEFT JOIN imaging_studies s ON s.imaging_order_id = io.id
        LEFT JOIN LATERAL (
          SELECT rep.*
          FROM imaging_reports rep
          WHERE rep.imaging_study_id = s.id
          ORDER BY rep.created_at DESC
          LIMIT 1
        ) r ON true
        LEFT JOIN imaging_report_acknowledgements ack 
          ON ack.imaging_report_id = r.id 
          AND ack.doctor_id = io.ordering_provider
        WHERE ${conditions.join(' AND ')}
        ORDER BY io.ordered_at DESC
        LIMIT 200
      `;

      const rows = await tenantDb.query(query, params);

      const mapped = rows.map((row: any) => {
        const workflowStatus = this.resolveDoctorWorkflowStatus(row);
        let structuredFindings: any = {};
        if (row.structured_findings) {
          if (typeof row.structured_findings === 'string') {
            try {
              structuredFindings = JSON.parse(row.structured_findings);
            } catch (error) {
              structuredFindings = {};
            }
          } else {
            structuredFindings = row.structured_findings;
          }
        }

        let codedDiagnoses: any[] = [];
        if (row.coded_diagnoses) {
          if (typeof row.coded_diagnoses === 'string') {
            try {
              codedDiagnoses = JSON.parse(row.coded_diagnoses);
            } catch (error) {
              codedDiagnoses = [];
            }
          } else {
            codedDiagnoses = row.coded_diagnoses;
          }
        }

        const requiresFollowUp = row.follow_up_recommended && !row.acknowledged_at;

        return {
          order: {
            id: row.order_id,
            number: row.order_number,
            priority: row.priority,
            status: row.order_status,
            payment_status: row.payment_status,
            finance_transaction_id: row.finance_transaction_id,
            fee_amount:
              row.fee_amount !== null && row.fee_amount !== undefined
                ? Number(row.fee_amount)
                : null,
            ordered_at: row.ordered_at,
            clinical_indication: row.clinical_indication,
            clinical_history: row.clinical_history,
            suspected_diagnosis: row.suspected_diagnosis,
            study_type_id: row.study_type_id,
            study_name: row.study_name,
            study_code: row.study_code,
            body_part: row.body_part,
            modality_name: row.modality_name,
            modality_code: row.modality_code,
          },
          patient: {
            id: row.patient_id,
            first_name: row.first_name,
            last_name: row.last_name,
            patient_number: row.patient_number,
            date_of_birth: row.date_of_birth,
            gender: row.gender,
            full_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
          },
          study: row.study_id
            ? {
                id: row.study_id,
                status: row.study_status,
                study_date: row.study_date,
                study_time: row.study_time,
                created_at: row.study_created_at,
                updated_at: row.study_updated_at,
                radiologist_assigned: row.radiologist_assigned,
                technologist: row.technologist,
              }
            : null,
          report: row.report_id
            ? {
                id: row.report_id,
                status: row.report_status,
                is_critical: row.is_critical,
                signed_at: row.signed_at,
                created_at: row.report_created_at,
                updated_at: row.report_updated_at,
                drafted_by: row.drafted_by,
                signed_by: row.signed_by,
                structured_findings: structuredFindings,
                severity: row.report_severity,
                follow_up_recommended: row.follow_up_recommended,
                follow_up_interval: row.follow_up_interval,
                coded_diagnoses: codedDiagnoses,
              }
            : null,
          acknowledgement: row.acknowledgement_id
            ? {
                id: row.acknowledgement_id,
                acknowledged_at: row.acknowledged_at,
                notes: row.acknowledgment_notes,
              }
            : null,
          workflow_status: workflowStatus,
          is_action_required: (row.is_critical || requiresFollowUp) && !row.acknowledged_at,
        };
      });

      const counts = {
        total: mapped.length,
        awaiting_payment: mapped.filter(
          (item) => item.workflow_status === 'awaiting_payment',
        ).length,
        pending: mapped.filter(
          (item) =>
            !['acknowledged', 'cancelled'].includes(item.workflow_status),
        ).length,
        awaiting_ack: mapped.filter((item) => item.workflow_status === 'awaiting_acknowledgement').length,
        completed: mapped.filter((item) => item.workflow_status === 'acknowledged').length,
        critical: mapped.filter((item) => item.report?.is_critical && !item.acknowledgement).length,
        cancelled: mapped.filter((item) => item.workflow_status === 'cancelled').length,
      };

      let filtered = mapped;
      switch ((options.status || '').toLowerCase()) {
        case 'pending':
          filtered = mapped.filter(
            (item) =>
              !['acknowledged', 'cancelled'].includes(item.workflow_status),
          );
          break;
        case 'completed':
          filtered = mapped.filter((item) => item.workflow_status === 'acknowledged');
          break;
        case 'critical':
          filtered = mapped.filter((item) => item.report?.is_critical && !item.acknowledgement);
          break;
        case 'awaiting_ack':
          filtered = mapped.filter((item) => item.workflow_status === 'awaiting_acknowledgement');
          break;
        case 'awaiting_payment':
          filtered = mapped.filter((item) => item.workflow_status === 'awaiting_payment');
          break;
        case 'cancelled':
          filtered = mapped.filter((item) => item.workflow_status === 'cancelled');
          break;
        default:
          break;
      }

      return {
        results: filtered,
        counts,
      };
    } catch (error: any) {
      if (this.isMissingSchemaError(error)) {
        this.logger.warn(`Doctor imaging results fallback due to missing schema: ${error.message}`);
        return this.getDefaultDoctorResultsPayload();
      }
      throw error;
    }
  }

  async acknowledgeReport(
    tenantDb: DataSource,
    reportId: string,
    doctorId: string,
    notes?: string,
  ) {
    const report = await tenantDb.query(
      `
      SELECT 
        r.id,
        r.report_status,
        r.imaging_order_id,
        io.ordering_provider
      FROM imaging_reports r
      INNER JOIN imaging_orders io ON io.id = r.imaging_order_id
      WHERE r.id = $1
      `,
      [reportId],
    );

    if (report.length === 0) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    if (report[0].ordering_provider !== doctorId) {
      throw new BadRequestException('Only the ordering provider can acknowledge this report');
    }

    if (report[0].report_status !== 'final') {
      throw new BadRequestException('Only finalized reports can be acknowledged');
    }

    const result = await tenantDb.query(
      `
      INSERT INTO imaging_report_acknowledgements (
        imaging_report_id,
        doctor_id,
        acknowledgment_notes
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (imaging_report_id, doctor_id)
      DO UPDATE SET 
        acknowledgment_notes = EXCLUDED.acknowledgment_notes,
        acknowledged_at = NOW(),
        updated_at = NOW()
      RETURNING *
      `,
      [reportId, doctorId, notes || null],
    );

    this.logger.log(`Report ${reportId} acknowledged by doctor ${doctorId}`);
    return result[0];
  }

  // ===== RADIOLOGIST WORKLIST =====

  async getRadiologistWorklist(tenantDb: DataSource, radiologistId?: string) {
    const studies = await tenantDb.query(
      `
      SELECT 
        s.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        p.gender,
        p.date_of_birth,
        st.study_name,
        m.modality_name,
        m.modality_code,
        io.clinical_indication,
        io.priority,
        io.order_status,
        io.payment_status,
        io.finance_transaction_id,
        io.fee_amount,
        EXTRACT(EPOCH FROM (NOW() - s.created_at))/3600 as hours_pending
      FROM imaging_studies s
      INNER JOIN patients p ON p.id = s.patient_id
      INNER JOIN imaging_study_types st ON st.id = s.study_type_id
      INNER JOIN imaging_modalities m ON m.id = st.modality_id
      INNER JOIN imaging_orders io ON io.id = s.imaging_order_id
      WHERE s.study_status IN ('awaiting_report', 'in_progress')
        AND NOT EXISTS (
          SELECT 1 FROM imaging_reports r 
          WHERE r.imaging_study_id = s.id AND r.report_status = 'final'
        )
      ORDER BY 
        CASE io.priority 
          WHEN 'stat' THEN 1
          WHEN 'urgent' THEN 2
          WHEN 'routine' THEN 3
        END,
        s.study_date DESC, s.study_time DESC
      LIMIT 50
      `,
    );

    return { studies, total: studies.length };
  }

  async getMyStudies(tenantDb: DataSource, radiologistId: string) {
    const studies = await tenantDb.query(
      `
      SELECT 
        s.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.patient_number,
        st.study_name,
        m.modality_name,
        m.modality_code,
        io.clinical_indication,
        io.priority,
        io.order_status,
        io.payment_status,
        io.finance_transaction_id,
        io.fee_amount,
        r.report_status,
        r.id as report_id
      FROM imaging_studies s
      INNER JOIN patients p ON p.id = s.patient_id
      INNER JOIN imaging_study_types st ON st.id = s.study_type_id
      INNER JOIN imaging_modalities m ON m.id = st.modality_id
      INNER JOIN imaging_orders io ON io.id = s.imaging_order_id
      LEFT JOIN imaging_reports r ON r.imaging_study_id = s.id
      WHERE s.radiologist_assigned = $1
        AND s.study_status IN ('awaiting_report', 'reported')
      ORDER BY 
        CASE io.priority 
          WHEN 'stat' THEN 1
          WHEN 'urgent' THEN 2
          WHEN 'routine' THEN 3
        END,
        s.study_date DESC
      `,
      [radiologistId],
    );

    return { studies, total: studies.length };
  }

  // ===== STATISTICS =====

  async getImagingStats(tenantDb: DataSource) {
    const stats = await tenantDb.query(
      `
      SELECT 
        COUNT(DISTINCT io.id) FILTER (WHERE io.order_status IN ('awaiting_payment','ordered')) as ordered_count,
        COUNT(DISTINCT io.id) FILTER (WHERE io.order_status = 'scheduled') as scheduled_count,
        COUNT(DISTINCT io.id) FILTER (WHERE io.order_status = 'in_progress') as in_progress_count,
        COUNT(DISTINCT io.id) FILTER (WHERE io.order_status = 'completed') as completed_count,
        COUNT(DISTINCT s.id) FILTER (WHERE s.study_status = 'awaiting_report') as awaiting_report_count,
        COUNT(DISTINCT r.id) FILTER (WHERE r.report_status = 'draft') as draft_reports_count,
        COUNT(DISTINCT r.id) FILTER (WHERE r.report_status = 'final') as final_reports_count,
        COUNT(DISTINCT r.id) FILTER (WHERE r.is_critical = true) as critical_findings_count,
        AVG(EXTRACT(EPOCH FROM (r.signed_at - s.created_at))/3600) FILTER (WHERE r.signed_at IS NOT NULL) as avg_turnaround_hours
      FROM imaging_orders io
      LEFT JOIN imaging_studies s ON s.imaging_order_id = io.id
      LEFT JOIN imaging_reports r ON r.imaging_study_id = s.id
      WHERE io.created_at > NOW() - INTERVAL '30 days'
      `,
    );

    return stats[0];
  }

  private decodeBase64Payload(dataUri: string): { buffer: Buffer; contentType?: string } {
    if (!dataUri) {
      return { buffer: Buffer.alloc(0) };
    }

    const matches = dataUri.match(/^data:(.+);base64,(.*)$/);
    if (matches && matches.length === 3) {
      return {
        buffer: Buffer.from(matches[2], 'base64'),
        contentType: matches[1],
      };
    }

    return {
      buffer: Buffer.from(dataUri, 'base64'),
    };
  }

  private resolveContentType(dataUri: string, fallbackType?: string) {
    const matches = dataUri?.match(/^data:(.+);base64,/);
    if (matches && matches.length === 2) {
      return matches[1];
    }

    switch ((fallbackType || '').toUpperCase()) {
      case 'DICOM':
        return 'application/dicom';
      case 'JPEG':
        return 'image/jpeg';
      case 'PNG':
        return 'image/png';
      case 'PDF':
        return 'application/pdf';
      case 'TIFF':
        return 'image/tiff';
      default:
        return 'application/octet-stream';
    }
  }

  private async getLatestRadiologyFindingForStudy(
    tenantDb: DataSource,
    imagingOrderId: string,
    patientId: string,
  ) {
    const findings = await tenantDb.query(
      `
      SELECT
        raf.*,
        ds.id as dicom_study_id,
        ds.study_uid,
        ds.storage_key,
        ds.acquired_at
      FROM dicom_studies ds
      INNER JOIN radiology_ai_findings raf ON raf.study_id = ds.id
      WHERE ds.patient_id = $1
        AND (ds.imaging_order_id = $2 OR ds.imaging_order_id IS NULL)
      ORDER BY
        CASE WHEN ds.imaging_order_id = $2 THEN 0 ELSE 1 END,
        raf.analyzed_at DESC
      LIMIT 1
      `,
      [patientId, imagingOrderId],
    );

    return findings[0] || null;
  }

  private mapRadiologyFindingSeverity(rawSeverity?: string | null, confidence?: number | null): string {
    const normalized = String(rawSeverity || '').toLowerCase();
    if (normalized === 'critical' || (confidence ?? 0) >= 0.9) {
      return 'critical';
    }
    if (normalized === 'high' || normalized === 'significant') {
      return 'significant';
    }
    if (normalized === 'moderate') {
      return 'moderate';
    }
    return 'minor';
  }

  private async syncRadiologyPostReportWorkflow(
    tenantDb: DataSource,
    reportId: string,
    userId?: string,
  ) {
    const rows = await tenantDb.query(
      `
      SELECT
        r.*,
        s.study_description,
        s.study_status,
        s.imaging_order_id,
        io.patient_id,
        io.clinical_indication,
        io.suspected_diagnosis,
        st.study_name,
        st.body_part,
        m.modality_name,
        m.modality_code
      FROM imaging_reports r
      INNER JOIN imaging_studies s ON s.id = r.imaging_study_id
      INNER JOIN imaging_orders io ON io.id = r.imaging_order_id
      INNER JOIN imaging_study_types st ON st.id = s.study_type_id
      INNER JOIN imaging_modalities m ON m.id = st.modality_id
      WHERE r.id = $1
      `,
      [reportId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    const report = rows[0];
    const aiFinding = await this.getLatestRadiologyFindingForStudy(
      tenantDb,
      report.imaging_order_id,
      report.patient_id,
    );
    const discrepancyReview = await this.createRadiologyDiscrepancyReview(
      tenantDb,
      report,
      aiFinding,
      userId,
    );
    const incidentalFollowup = await this.upsertIncidentalFindingFollowup(
      tenantDb,
      report,
      discrepancyReview,
      aiFinding,
      userId,
    );

    return { discrepancyReview, incidentalFollowup };
  }

  private async createRadiologyDiscrepancyReview(
    tenantDb: DataSource,
    report: any,
    aiFinding: any,
    userId?: string,
  ) {
    const reviewRepo = tenantDb.getRepository(RadiologyDiscrepancyReview);
    const aiLabels = Array.isArray(aiFinding?.findings)
      ? aiFinding.findings
          .map((finding: any) => String(finding.label || finding.finding || '').trim())
          .filter(Boolean)
      : [];
    const reportText = [
      report.findings,
      report.impression,
      report.critical_findings,
      report.recommendations,
    ]
      .map((value: any) => String(value || '').toLowerCase())
      .join(' ');
    const matchedAiLabels = aiLabels.filter((label: string) => reportText.includes(label.toLowerCase()));
    const unmatchedAiLabels = aiLabels.filter((label: string) => !reportText.includes(label.toLowerCase()));

    const discrepancyStatus = !aiFinding
      ? 'no_ai_comparison'
      : unmatchedAiLabels.length === 0 && aiLabels.length > 0
        ? 'aligned'
        : matchedAiLabels.length > 0
          ? 'partially_aligned'
          : 'needs_review';

    return reviewRepo.save(
      reviewRepo.create({
        imagingStudyId: report.imaging_study_id,
        imagingOrderId: report.imaging_order_id,
        imagingReportId: report.id,
        patientId: report.patient_id,
        aiFindingId: aiFinding?.id ?? null,
        reviewedBy: userId ?? null,
        reviewStatus: 'generated',
        discrepancyStatus,
        aiSummary: {
          topFinding: aiFinding?.top_finding || aiFinding?.topFinding || null,
          overallConfidence: aiFinding?.overall_confidence ?? aiFinding?.overallConfidence ?? null,
          findings: Array.isArray(aiFinding?.findings) ? aiFinding.findings : [],
        },
        reportSummary: {
          impression: report.impression || null,
          findings: report.findings || null,
          severity: report.severity || null,
          isCritical: Boolean(report.is_critical),
          followUpRecommended: Boolean(report.follow_up_recommended),
        },
        discrepancySummary: {
          matchedAiLabels,
          unmatchedAiLabels,
          reportStatus: report.report_status,
        },
        rationale: !aiFinding
          ? 'No radiology AI finding was available for direct discrepancy comparison.'
          : discrepancyStatus === 'aligned'
            ? 'Radiologist report content covers the AI-labeled findings without unresolved gaps.'
            : discrepancyStatus === 'partially_aligned'
              ? 'Radiologist report partially addresses the AI-labeled findings, but some AI suggestions remain unmatched and should be reviewed.'
              : 'Radiologist report does not clearly address the highest-priority AI-labeled findings and should be reviewed for reconciliation.',
        governance: {
          governedPath: true,
          workstream: 'MOAS-08',
          source: 'radiology_discrepancy_review',
        },
      }),
    );
  }

  private async upsertIncidentalFindingFollowup(
    tenantDb: DataSource,
    report: any,
    discrepancyReview: RadiologyDiscrepancyReview,
    aiFinding: any,
    userId?: string,
  ) {
    const structuredFindings = this.parseJsonValue(report.structured_findings, []);
    const significantStructuredFindings = Array.isArray(structuredFindings)
      ? structuredFindings.filter((finding: any) =>
          ['significant', 'critical'].includes(String(finding?.significance || '').toLowerCase()),
        )
      : [];
    const severity = this.normalizeIncidentSeverity(
      report.severity,
      Boolean(report.is_critical),
      significantStructuredFindings.length > 0,
      aiFinding?.alerted === true,
    );
    const followupNeeded =
      Boolean(report.is_critical) ||
      Boolean(report.follow_up_recommended) ||
      significantStructuredFindings.length > 0 ||
      discrepancyReview.discrepancyStatus === 'needs_review';

    if (!followupNeeded) {
      return null;
    }

    const repo = tenantDb.getRepository(IncidentalFindingFollowup);
    const existing = await repo.findOne({
      where: {
        imagingReportId: report.id,
        status: 'open',
      },
      order: { createdAt: 'DESC' },
    });

    const title = `Radiology follow-up: ${aiFinding?.top_finding || report.study_name || 'incidental finding'}`;
    const summaryParts = [
      report.is_critical ? 'Report contains critical findings.' : null,
      report.follow_up_recommended ? `Follow-up recommended${report.follow_up_interval ? ` ${report.follow_up_interval}` : ''}.` : null,
      significantStructuredFindings.length > 0
        ? `${significantStructuredFindings.length} structured finding(s) marked significant or critical.`
        : null,
      discrepancyReview.discrepancyStatus === 'needs_review'
        ? 'AI discrepancy review flagged unresolved items for radiologist/clinician reconciliation.'
        : null,
    ].filter(Boolean);
    const summary = summaryParts.join(' ');
    const recommendedAction =
      report.recommendations ||
      report.critical_findings ||
      significantStructuredFindings
        .map((finding: any) => finding.recommendation)
        .filter(Boolean)
        .join(' ') ||
      'Confirm patient communication, clinician acknowledgment, and concrete imaging follow-up steps.';

    const dueAt = this.offsetDueAt(severity === 'critical' ? 4 : severity === 'significant' ? 24 : 72);
    const payload = {
      imagingStudyId: report.imaging_study_id,
      imagingOrderId: report.imaging_order_id,
      imagingReportId: report.id,
      patientId: report.patient_id,
      createdBy: userId ?? null,
      status: 'open',
      followupType: 'incidental_finding_followup',
      severity,
      title,
      summary,
      recommendedAction,
      dueAt,
      evidence: {
        discrepancyStatus: discrepancyReview.discrepancyStatus,
        aiFindingId: aiFinding?.id ?? null,
        topFinding: aiFinding?.top_finding || aiFinding?.topFinding || null,
        isCritical: Boolean(report.is_critical),
        followUpRecommended: Boolean(report.follow_up_recommended),
        followUpInterval: report.follow_up_interval || null,
        structuredFindingCount: significantStructuredFindings.length,
      },
      governance: {
        governedPath: true,
        workstream: 'MOAS-08',
        source: 'incidental_finding_followup',
      },
    };

    if (existing) {
      return repo.save({
        ...existing,
        ...payload,
      });
    }

    return repo.save(repo.create(payload));
  }

  private normalizeIncidentSeverity(
    rawSeverity: string | null | undefined,
    isCritical: boolean,
    hasSignificantStructuredFinding: boolean,
    aiAlerted: boolean,
  ) {
    const normalized = String(rawSeverity || '').toLowerCase();
    if (isCritical || normalized === 'critical' || aiAlerted) {
      return 'critical';
    }
    if (normalized === 'significant' || hasSignificantStructuredFinding) {
      return 'significant';
    }
    if (normalized === 'moderate') {
      return 'moderate';
    }
    return 'minor';
  }

  private offsetDueAt(hoursFromNow: number) {
    return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  }

  private parseJsonValue<T>(value: any, fallback: T): T {
    if (value === null || value === undefined) {
      return fallback;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch (error) {
        return fallback;
      }
    }
    return value as T;
  }

  private async getReportOrderId(tenantDb: DataSource, reportId: string): Promise<string> {
    const report = await tenantDb.query(
      `
      SELECT imaging_order_id
      FROM imaging_reports
      WHERE id = $1
      `,
      [reportId],
    );

    if (report.length === 0) {
      throw new NotFoundException(`Report with ID ${reportId} not found`);
    }

    return report[0].imaging_order_id;
  }

  private async ensureOrderPaymentCleared(tenantDb: DataSource, orderId: string) {
    const [order] = await tenantDb.query(
      `
      SELECT payment_status
      FROM imaging_orders
      WHERE id = $1
      `,
      [orderId],
    );

    if (!order) {
      throw new NotFoundException(`Imaging order ${orderId} not found`);
    }

    if (order.payment_status === PAYMENT_STATUS.AWAITING_PAYMENT) {
      throw new BadRequestException(
        'Payment confirmation required before continuing this imaging order',
      );
    }
  }

  // ─── Sprint 117: DICOM Viewer + AI Heatmap ───────────────────────────────

  async getAiDraftForOrder(tenantDb: DataSource, orderId: string): Promise<{
    patientId?: string;
    reportText?: string;
    findings?: any[];
    confidence?: number | null;
    heatmapRegions?: any[];
  } | null> {
    const rows = await tenantDb.query(
      `SELECT patient_id, draft_findings, draft_impression, structured_draft, heatmap_regions
       FROM radiology_report_drafts
       WHERE imaging_order_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [orderId],
    );
    if (rows.length === 0) return null;
    const structured = rows[0].structured_draft ?? {};
    return {
      patientId: rows[0].patient_id,
      reportText: [rows[0].draft_findings, rows[0].draft_impression].filter(Boolean).join('\n\n'),
      findings: structured.findings ?? [],
      confidence: structured.confidence != null ? Number(structured.confidence) : null,
      heatmapRegions: rows[0].heatmap_regions ?? [],
    };
  }

  async saveHeatmapRegions(tenantDb: DataSource, orderId: string, regions: unknown[]): Promise<void> {
    await tenantDb.query(
      `UPDATE radiology_report_drafts
       SET heatmap_regions = $1
       WHERE imaging_order_id = $2`,
      [JSON.stringify(regions), orderId],
    );
  }

  async uploadDicomToMinio(objectKey: string, buffer: Buffer, contentType: string): Promise<void> {
    const bucket = process.env.MINIO_BUCKET ?? 'umoya-dicom';
    await this.minioService.uploadBuffer(bucket, objectKey, buffer, contentType);
  }

  async getDicomBuffer(objectKey: string): Promise<Buffer> {
    const bucket = process.env.MINIO_BUCKET ?? 'umoya-dicom';
    return this.minioService.getObjectBuffer(bucket, objectKey);
  }
}
