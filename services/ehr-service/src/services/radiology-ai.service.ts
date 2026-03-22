import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { DicomStudy } from '../entities/dicom-study.entity';
import { RadiologyAiFinding } from '../entities/radiology-ai-finding.entity';
import { AlertDeliveryService } from './alert-delivery.service';
import axios from 'axios';

@Injectable()
export class RadiologyAiService {
  private readonly logger = new Logger(RadiologyAiService.name);
  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  constructor(
    private readonly tenantService: TenantService,
    private readonly alertDelivery: AlertDeliveryService,
    private readonly cdssService: CdssService,
  ) {}

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

    return study;
  }

  async getStudy(subdomain: string, studyId: string): Promise<DicomStudy | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(DicomStudy).findOneBy({ id: studyId });
  }

  async getStudiesForPatient(subdomain: string, patientId: string): Promise<DicomStudy[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(DicomStudy).find({
      where: { patientId },
      order: { uploadedAt: 'DESC' },
    });
  }

  async getFindingsForStudy(subdomain: string, studyId: string): Promise<RadiologyAiFinding[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(RadiologyAiFinding).find({ where: { studyId } });
  }

  async getFindingsForPatient(subdomain: string, patientId: string): Promise<RadiologyAiFinding[]> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(RadiologyAiFinding).find({
      where: { patientId },
      order: { analyzedAt: 'DESC' },
    });
  }

  async radiologistReview(subdomain: string, findingId: string, notes: string, reviewedBy: string): Promise<RadiologyAiFinding | null> {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const repo = ds.getRepository(RadiologyAiFinding);
    await repo.update(findingId, { radiologistReviewed: true, radiologistNotes: notes });
    return repo.findOneBy({ id: findingId });
  }

  // ── AI Analysis ────────────────────────────────────────────────────────────

  private async analyzeStudy(subdomain: string, ds: any, study: DicomStudy): Promise<void> {
    await ds.getRepository(DicomStudy).update(study.id, { aiAnalysisStatus: 'processing' });

    try {
      // Route through CdssService for circuit breaker protection;
      // fall back to direct axios if CdssService has no radiology proxy method.
      let data: any;
      try {
        data = await this.cdssService.getGuidelines(
          `radiology analysis ${study.modality} ${study.bodyPart}`,
          { studyId: study.id, patientId: study.patientId, modality: study.modality, bodyPart: study.bodyPart, storageKey: study.storageKey },
        );
        if (!data?.findings) {
          // CdssService returned guidelines, not findings — fall through to direct call
          throw new Error('No findings in CDSS response');
        }
      } catch {
        // Direct call as last resort (study-level binary analysis endpoint)
        const res = await axios.post(`${this.cdssUrl}/radiology/analyze`, {
          studyId: study.id,
          patientId: study.patientId,
          modality: study.modality,
          bodyPart: study.bodyPart,
          storageKey: study.storageKey,
        }, { timeout: 60000 });
        data = res.data;
      }

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
