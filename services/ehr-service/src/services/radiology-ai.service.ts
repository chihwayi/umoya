import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { DicomStudy } from '../entities/dicom-study.entity';
import { RadiologyAiFinding } from '../entities/radiology-ai-finding.entity';
import { AlertDeliveryService } from './alert-delivery.service';
import { AiSurfaceContractService } from './ai-surface-contract.service';

@Injectable()
export class RadiologyAiService {
  private readonly logger = new Logger(RadiologyAiService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly alertDelivery: AlertDeliveryService,
    private readonly cdssService: CdssService,
    private readonly aiSurfaceContractService: AiSurfaceContractService,
  ) {}

  private buildStudyAiMetadata(modelVersion?: string | null) {
    return this.aiSurfaceContractService.buildSurfaceMetadata({
      aiSurface: 'radiology_ai',
      useCase: 'radiology_analysis',
      source: 'radiology_ai_service',
      modelId: modelVersion || 'radiology_analysis_proxy',
      modelVersion: modelVersion || 'radiology_analysis_proxy',
      provider: 'local',
      recorded: true,
    });
  }

  private decorateStudy(study: DicomStudy | null) {
    if (!study) {
      return study;
    }
    return {
      ...study,
      aiMetadata: this.buildStudyAiMetadata(),
    };
  }

  private decorateFinding(finding: RadiologyAiFinding) {
    return {
      ...finding,
      aiMetadata: this.buildStudyAiMetadata(finding?.modelVersion || null),
    };
  }

  // ── Study Upload & Registration ────────────────────────────────────────────

  async registerStudy(subdomain: string, dto: {
    patientId: string; imagingOrderId?: string; studyUid: string;
    modality: string; bodyPart?: string; storageKey: string;
    fileSizeBytes?: number; acquiredAt?: string;
  }): Promise<DicomStudy> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(DicomStudy);
    const study = await repo.save(repo.create({
      ...dto,
      aiAnalysisRequested: true,
      aiAnalysisStatus: 'pending',
      acquiredAt: dto.acquiredAt ? new Date(dto.acquiredAt) : undefined,
    }));

    // Trigger analysis fire-and-forget
    this.analyzeStudy(subdomain, ds, study).catch(e =>
      this.logger.warn(`Radiology AI analysis failed for study ${study.id}: ${e?.message}`));

    return this.decorateStudy(study) as DicomStudy;
  }

  async getStudy(subdomain: string, studyId: string): Promise<DicomStudy | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const study = await ds.getRepository(DicomStudy).findOneBy({ id: studyId });
    return this.decorateStudy(study) as DicomStudy | null;
  }

  async getStudiesForPatient(subdomain: string, patientId: string): Promise<DicomStudy[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const studies = await ds.getRepository(DicomStudy).find({
      where: { patientId },
      order: { uploadedAt: 'DESC' },
    });
    return studies.map((study) => this.decorateStudy(study) as DicomStudy);
  }

  async getFindingsForStudy(subdomain: string, studyId: string): Promise<RadiologyAiFinding[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const findings = await ds.getRepository(RadiologyAiFinding).find({ where: { studyId } });
    return findings.map((finding) => this.decorateFinding(finding) as RadiologyAiFinding);
  }

  async getFindingsForPatient(subdomain: string, patientId: string): Promise<RadiologyAiFinding[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const findings = await ds.getRepository(RadiologyAiFinding).find({
      where: { patientId },
      order: { analyzedAt: 'DESC' },
    });
    return findings.map((finding) => this.decorateFinding(finding) as RadiologyAiFinding);
  }

  async radiologistReview(subdomain: string, findingId: string, notes: string, reviewedBy: string): Promise<RadiologyAiFinding | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(RadiologyAiFinding);
    await repo.update(findingId, { radiologistReviewed: true, radiologistNotes: notes });
    const finding = await repo.findOneBy({ id: findingId });
    return finding ? (this.decorateFinding(finding) as RadiologyAiFinding) : null;
  }

  // ── AI Analysis ────────────────────────────────────────────────────────────

  private async analyzeStudy(subdomain: string, ds: any, study: DicomStudy): Promise<void> {
    await ds.getRepository(DicomStudy).update(study.id, { aiAnalysisStatus: 'processing' });

    try {
      const data = await this.cdssService.analyzeRadiologyStudy(
        {
          studyId: study.id,
          patientId: study.patientId,
          modality: study.modality,
          bodyPart: study.bodyPart,
          storageKey: study.storageKey,
        },
        subdomain,
        ds,
      );

      const findingRepo = ds.getRepository(RadiologyAiFinding);
      const finding = await findingRepo.save(findingRepo.create({
        studyId: study.id,
        patientId: study.patientId,
        modality: study.modality,
        findings: data.findings || [],
        topFinding: data.top_finding,
        overallConfidence: data.confidence,
        heatmapStorageKey: data.heatmap_key,
        modelVersion: data.model_version,
      }));

      await ds.getRepository(DicomStudy).update(study.id, { aiAnalysisStatus: 'complete' });

      // S267 (F7) — persist the actual audit trail for this AI execution, not just
      // display-time metadata (decorateStudy/decorateFinding below only format it).
      await this.aiSurfaceContractService.recordExecution({
        tenantDb: ds,
        tenantId: subdomain,
        aiSurface: 'radiology_ai',
        useCase: 'radiology_analysis',
        source: 'radiology_ai_service.analyzeStudy',
        modelId: data.model_version || 'radiology_analysis_proxy',
        modelVersion: data.model_version || 'radiology_analysis_proxy',
        patientId: study.patientId,
        responseSummary: { topFinding: data.top_finding, confidence: data.confidence, findingCount: (data.findings || []).length },
      }).catch((e: any) => this.logger.warn(`AI surface audit recording failed for study ${study.id}: ${e?.message}`));

      // Alert if critical finding
      const criticalFindings = (data.findings || []).filter((f: any) =>
        f.severity === 'critical' || f.confidence > 0.85
      );
      if (criticalFindings.length > 0) {
        await ds.getRepository(RadiologyAiFinding).update(finding.id, { alerted: true });
        this.alertDelivery.broadcastCriticalAlert(subdomain, {
          alertType: 'radiology_critical',
          sourceEntityId: finding.id,
          patientId: study.patientId,
          severity: 'critical',
          message: `AI radiology finding: ${data.top_finding} (${Math.round((data.confidence || 0) * 100)}% confidence)`,
          payload: { studyId: study.id, findings: criticalFindings },
        }).catch(() => {});
      }
    } catch (e: any) {
      await ds.getRepository(DicomStudy).update(study.id, { aiAnalysisStatus: 'failed' });
      this.logger.error(`Radiology AI analysis error for study ${study.id}: ${e?.message}`);
    }
  }

  // ── S170: tenant-db methods for CDSS-backed analysis ────────────────────────

  async analyseStudyWithDb(
    studyId: string,
    patientId: string,
    requestedBy: string,
    db: any,
    tenantSubdomain: string,
    meta?: { modality?: string; bodyPart?: string },
  ): Promise<unknown> {
    const existing = await db.query(
      `SELECT * FROM radiology_ai_findings WHERE study_id = $1 AND urgency IS NOT NULL LIMIT 1`,
      [studyId],
    );
    if (existing.length > 0) return existing[0];

    let cdssResponse: any = null;
    let urgency = 'ROUTINE';
    let findings: unknown[] = [];
    let confidence = 0;

    try {
      cdssResponse = await this.cdssService.analyzeRadiologyStudy({
        studyId,
        patientId,
        modality: meta?.modality ?? 'UNKNOWN',
        bodyPart: meta?.bodyPart,
        storageKey: `studies/${studyId}`,
      });
      findings = cdssResponse?.findings ?? [];
      confidence = cdssResponse?.confidence ?? 0;
      // Derive urgency from findings
      const hasCritical = findings.some(
        (f: any) => f.severity === 'critical' || f.confidence > 0.9,
      );
      const hasHigh = findings.some(
        (f: any) => f.severity === 'high' || f.confidence > 0.75,
      );
      urgency = hasCritical ? 'CRITICAL' : hasHigh ? 'HIGH' : 'ROUTINE';
    } catch (err: any) {
      this.logger.warn(`CDSS radiology unavailable for ${studyId}: ${err.message}`);
      const rows = await db.query(
        `INSERT INTO radiology_ai_findings
           (study_id, patient_id, requested_by, cdss_raw_response, findings,
            urgency, modality, body_part, overall_confidence)
         VALUES ($1,$2,$3,$4,$5,'ROUTINE',$6,$7,0)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [
          studyId, patientId, requestedBy,
          JSON.stringify({ error: 'cdss_unavailable', message: err.message }),
          JSON.stringify([]),
          meta?.modality ?? null,
          meta?.bodyPart ?? null,
        ],
      );
      return rows[0] ?? null;
    }

    const rows = await db.query(
      `INSERT INTO radiology_ai_findings
         (study_id, patient_id, requested_by, cdss_raw_response, findings,
          urgency, modality, body_part, overall_confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        studyId, patientId, requestedBy,
        JSON.stringify(cdssResponse ?? {}),
        JSON.stringify(findings),
        urgency,
        meta?.modality ?? null,
        meta?.bodyPart ?? null,
        confidence,
      ],
    );
    const record = rows[0];
    if (!record) return null;

    await this.aiSurfaceContractService.recordExecution({
      tenantDb: db,
      tenantId: tenantSubdomain,
      aiSurface: 'radiology_ai',
      useCase: 'radiology_analysis',
      source: 'radiology_ai_service.analyseStudyWithDb',
      modelId: cdssResponse?.model_version || 'radiology_analysis_proxy',
      modelVersion: cdssResponse?.model_version || 'radiology_analysis_proxy',
      patientId,
      responseSummary: { urgency, confidence, findingCount: findings.length },
    }).catch((e: any) => this.logger.warn(`AI surface audit recording failed for study ${studyId}: ${e?.message}`));

    if (['HIGH', 'CRITICAL'].includes(urgency)) {
      try {
        await this.alertDelivery.broadcastCriticalAlert(tenantSubdomain, {
          alertType: 'radiology_urgent_finding',
          sourceEntityId: record.id,
          patientId,
          severity: urgency === 'CRITICAL' ? 'critical' : 'urgent',
          message: `Radiology AI: ${urgency} urgency finding for study ${studyId}`,
          payload: { studyId, urgency, confidence },
        });
        await db.query(
          `UPDATE radiology_ai_findings SET alert_sent = true, alerted = true WHERE id = $1`,
          [record.id],
        );
      } catch (alertErr: any) {
        this.logger.warn(`Alert delivery failed: ${alertErr.message}`);
      }
    }

    return record;
  }

  async getFindingsByStudyId(studyId: string, db: any): Promise<unknown> {
    const rows = await db.query(
      `SELECT * FROM radiology_ai_findings WHERE study_id = $1 ORDER BY analyzed_at DESC LIMIT 1`,
      [studyId],
    );
    return rows[0] ?? null;
  }

  async reviewFindingById(
    findingId: string,
    reviewerId: string,
    status: 'confirmed' | 'rejected' | 'needs_review',
    comment: string | undefined,
    db: any,
  ): Promise<unknown> {
    const rows = await db.query(
      `UPDATE radiology_ai_findings
       SET radiologist_review_status = $2,
           reviewed_by = $3,
           reviewed_at = now(),
           reviewer_comment = $4,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [findingId, status, reviewerId, comment ?? null],
    );
    return rows[0] ?? null;
  }

  async getPatientRadiologyAiHistory(patientId: string, db: any): Promise<unknown[]> {
    return db.query(
      `SELECT raf.*, ir.study_date, ir.description AS study_description
       FROM radiology_ai_findings raf
       LEFT JOIN imaging_requests ir ON ir.id::text = raf.study_id::text
       WHERE raf.patient_id = $1
       ORDER BY raf.analyzed_at DESC
       LIMIT 20`,
      [patientId],
    );
  }
}
