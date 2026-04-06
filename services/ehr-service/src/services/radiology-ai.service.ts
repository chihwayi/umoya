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
}
