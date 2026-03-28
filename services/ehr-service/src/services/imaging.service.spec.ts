import { ImagingService } from './imaging.service';
import { ImagingOrderAiReview } from '../entities/imaging-order-ai-review.entity';
import { RadiologyReportDraft } from '../entities/radiology-report-draft.entity';
import { RadiologyDiscrepancyReview } from '../entities/radiology-discrepancy-review.entity';
import { IncidentalFindingFollowup } from '../entities/incidental-finding-followup.entity';

describe('ImagingService', () => {
  it('persists governed imaging order reviews with duplicate-order caution and protocol guidance', async () => {
    const reviewRows: any[] = [];
    const reviewRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `review-${reviewRows.length + 1}`, ...value };
        reviewRows.push(row);
        return row;
      }),
      findOne: jest.fn(async ({ where }: any) =>
        reviewRows.filter((row) => row.imagingOrderId === where.imagingOrderId).slice(-1)[0] ?? null,
      ),
    };

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM imaging_orders io')) {
          return [{
            id: 'order-1',
            patient_id: 'patient-1',
            study_type_id: 'study-1',
            priority: 'routine',
            order_status: 'ordered',
            payment_status: 'payment_confirmed',
            clinical_indication: 'Persistent cough',
            clinical_history: 'Cough for 3 weeks',
            suspected_diagnosis: 'Pneumonia',
            ordered_at: '2026-03-26T10:00:00.000Z',
            study_name: 'Chest X-Ray',
            study_code: 'CXR',
            body_part: 'Chest',
            preparation_instructions: 'Remove metallic objects before acquisition.',
            contrast_required: false,
            modality_name: 'Radiography',
            modality_code: 'XR',
            date_of_birth: '1990-01-01',
            gender: 'female',
          }];
        }
        if (sql.includes('FROM imaging_orders') && sql.includes("ordered_at >= NOW() - INTERVAL '30 days'")) {
          return [{
            id: 'order-older',
            ordered_at: '2026-03-20T09:00:00.000Z',
            order_status: 'completed',
          }];
        }
        throw new Error(`Unexpected query: ${sql}`);
      }),
      getRepository: jest.fn((entity: any) => {
        if (entity === ImagingOrderAiReview) {
          return reviewRepo;
        }
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    } as any;

    const service = new ImagingService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        getGuidelines: jest.fn().mockResolvedValue({
          recommendations: ['Chest radiograph is appropriate first-line imaging for persistent cough.'],
          contraindications: [],
          source: 'advanced_cdss',
        }),
        searchGuidelines: jest.fn().mockResolvedValue({
          citations: [
            { title: 'Chest X-Ray adult protocol', text: 'PA and lateral views where feasible.', source: 'Governed Registry' },
          ],
          governed_corpus_used: true,
        }),
      } as any,
    );

    const result = await service.prepareOrderAiReview(tenantDb, 'order-1', 'kids-clinic', 'user-1');

    expect(reviewRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        imagingOrderId: 'order-1',
        patientId: 'patient-1',
        appropriatenessStatus: 'acceptable_with_caution',
        blockingIssues: expect.arrayContaining([
          expect.objectContaining({ code: 'recent_similar_imaging_order' }),
        ]),
        supportingSignals: expect.arrayContaining([
          expect.objectContaining({ code: 'guideline_recommendation' }),
          expect.objectContaining({ code: 'protocol_citation' }),
        ]),
      }),
    );
    expect(result.guidelineCitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Chest X-Ray adult protocol' }),
      ]),
    );
  });

  it('generates a governed radiology report draft from AI findings and reporting guidance', async () => {
    const draftRows: any[] = [];
    const draftRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `draft-${draftRows.length + 1}`, ...value };
        draftRows.push(row);
        return row;
      }),
      findOne: jest.fn(),
    };

    const tenantDb = {
      query: jest.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('FROM imaging_studies s') && sql.includes('INNER JOIN imaging_orders io')) {
          return [{
            id: 'study-1',
            imaging_order_id: 'order-1',
            patient_id: 'patient-1',
            study_description: 'PA/lateral chest radiograph',
            technique: 'PA and lateral views',
            study_status: 'awaiting_report',
            study_name: 'Chest X-Ray',
            body_part: 'Chest',
            preparation_instructions: 'Remove metallic objects.',
            contrast_required: false,
            modality_name: 'Radiography',
            modality_code: 'XR',
            clinical_indication: 'Persistent cough',
            clinical_history: 'Cough for 3 weeks',
            suspected_diagnosis: 'Pneumonia',
            date_of_birth: '1990-01-01',
            gender: 'female',
          }];
        }
        if (sql.includes('FROM dicom_studies ds') && sql.includes('INNER JOIN radiology_ai_findings raf')) {
          return [{
            id: 'finding-1',
            study_id: 'dicom-1',
            patient_id: 'patient-1',
            modality: 'XR',
            findings: [
              { label: 'Right lower lobe consolidation', confidence: 0.92, severity: 'critical', region: 'Right lower lobe' },
            ],
            top_finding: 'Right lower lobe consolidation',
            overall_confidence: 0.92,
            model_version: 'rad-v1',
            alerted: true,
          }];
        }
        throw new Error(`Unexpected query: ${sql} // params: ${JSON.stringify(params || [])}`);
      }),
      getRepository: jest.fn((entity: any) => {
        if (entity === RadiologyReportDraft) {
          return draftRepo;
        }
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    } as any;

    const service = new ImagingService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        getGuidelines: jest.fn().mockResolvedValue({
          recommendations: ['Document whether the consolidation is focal and correlate with prior imaging if available.'],
          source: 'advanced_cdss',
        }),
        searchGuidelines: jest.fn().mockResolvedValue({
          citations: [{ title: 'Chest radiograph structured reporting', source: 'Governed Registry' }],
          governed_corpus_used: true,
        }),
      } as any,
    );

    const draft = await service.generateReportDraft(tenantDb, 'study-1', 'kids-clinic', 'rad-1');

    expect(draftRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        imagingStudyId: 'study-1',
        imagingOrderId: 'order-1',
        patientId: 'patient-1',
        aiFindingId: 'finding-1',
        draftStatus: 'generated',
      }),
    );
    expect(draft.draftImpression).toContain('Right lower lobe consolidation');
    expect(draft.governance).toEqual(expect.objectContaining({ governedPath: true, source: 'radiology_report_draft' }));
  });

  it('creates discrepancy review and incidental follow-up when a report is finalized against AI findings', async () => {
    const discrepancyRows: any[] = [];
    const followupRows: any[] = [];
    const discrepancyRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `disc-${discrepancyRows.length + 1}`, ...value };
        discrepancyRows.push(row);
        return row;
      }),
      find: jest.fn(async ({ where }: any) => discrepancyRows.filter((row) => row.imagingReportId === where.imagingReportId)),
    };
    const followupRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const row = { id: `follow-${followupRows.length + 1}`, ...value };
        followupRows.push(row);
        return row;
      }),
      update: jest.fn(async (id, value) => {
        const index = followupRows.findIndex((row) => row.id === id);
        if (index >= 0) {
          followupRows[index] = { ...followupRows[index], ...value };
        }
        return { affected: index >= 0 ? 1 : 0 };
      }),
      find: jest.fn(async ({ where }: any) => followupRows.filter((row) => row.imagingReportId === where.imagingReportId)),
      findOne: jest.fn(async () => null),
      findOneBy: jest.fn(async ({ id }: any) => followupRows.find((row) => row.id === id) ?? null),
    };

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT imaging_order_id') && sql.includes('FROM imaging_reports')) {
          return [{ imaging_order_id: 'order-1' }];
        }
        if (sql.includes('SELECT payment_status') && sql.includes('FROM imaging_orders')) {
          return [{ payment_status: 'payment_confirmed' }];
        }
        if (sql.includes('UPDATE imaging_reports') && sql.includes("report_status = 'final'")) {
          return [{
            id: 'report-1',
            imaging_study_id: 'study-1',
            imaging_order_id: 'order-1',
            patient_id: 'patient-1',
            report_status: 'final',
            findings: 'No focal consolidation described.',
            impression: 'No acute cardiopulmonary abnormality.',
            recommendations: 'CT chest follow-up if symptoms persist.',
            critical_findings: 'Review persistent symptoms urgently.',
            is_critical: true,
            severity: 'critical',
            follow_up_recommended: true,
            follow_up_interval: 'within 24 hours',
            structured_findings: JSON.stringify([
              { region: 'Right lower lobe', finding: 'Possible consolidation', significance: 'significant', recommendation: 'Repeat chest imaging' },
            ]),
          }];
        }
        if (sql.includes('UPDATE imaging_studies') || sql.includes('UPDATE imaging_orders')) {
          return [];
        }
        if (sql.includes('FROM imaging_reports r') && sql.includes('INNER JOIN imaging_studies s')) {
          return [{
            id: 'report-1',
            imaging_study_id: 'study-1',
            imaging_order_id: 'order-1',
            patient_id: 'patient-1',
            report_status: 'final',
            findings: 'No focal consolidation described.',
            impression: 'No acute cardiopulmonary abnormality.',
            recommendations: 'CT chest follow-up if symptoms persist.',
            critical_findings: 'Review persistent symptoms urgently.',
            is_critical: true,
            severity: 'critical',
            follow_up_recommended: true,
            follow_up_interval: 'within 24 hours',
            structured_findings: JSON.stringify([
              { region: 'Right lower lobe', finding: 'Possible consolidation', significance: 'significant', recommendation: 'Repeat chest imaging' },
            ]),
            study_name: 'Chest X-Ray',
          }];
        }
        if (sql.includes('FROM dicom_studies ds') && sql.includes('INNER JOIN radiology_ai_findings raf')) {
          return [{
            id: 'finding-1',
            top_finding: 'Right lower lobe consolidation',
            overall_confidence: 0.91,
            findings: [
              { label: 'Right lower lobe consolidation', confidence: 0.91, severity: 'critical' },
            ],
            alerted: true,
          }];
        }
        throw new Error(`Unexpected query: ${sql}`);
      }),
      getRepository: jest.fn((entity: any) => {
        if (entity === RadiologyDiscrepancyReview) return discrepancyRepo;
        if (entity === IncidentalFindingFollowup) return followupRepo;
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    } as any;

    const service = new ImagingService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const signed = await service.signReport(tenantDb, 'report-1', 'rad-1');

    expect(discrepancyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        imagingReportId: 'report-1',
        discrepancyStatus: 'needs_review',
      }),
    );
    expect(followupRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        imagingReportId: 'report-1',
        severity: 'critical',
        status: 'open',
      }),
    );
    expect(signed.discrepancyReview).toEqual(expect.objectContaining({ discrepancyStatus: 'needs_review' }));
    expect(signed.incidentalFollowup).toEqual(expect.objectContaining({ status: 'open' }));
  });

  it('resolves discrepancy reviews and completes incidental follow-up workflow state', async () => {
    const discrepancyRepo = {
      findOneBy: jest.fn(async ({ id }: any) =>
        id === 'disc-1'
          ? {
              id: 'disc-1',
              imagingReportId: 'report-1',
              reviewStatus: 'generated',
              governance: { governedPath: true },
            }
          : null,
      ),
      save: jest.fn(async (value) => value),
    };
    const followupRepo = {
      findOne: jest.fn(async () => ({
        id: 'follow-1',
        imagingReportId: 'report-1',
        status: 'open',
        governance: { governedPath: true },
      })),
      findOneBy: jest.fn(async ({ id }: any) =>
        id === 'follow-1'
          ? {
              id: 'follow-1',
              imagingReportId: 'report-1',
              status: 'acknowledged',
              governance: { governedPath: true },
            }
          : null,
      ),
      save: jest.fn(async (value) => value),
    };

    const tenantDb = {
      getRepository: jest.fn((entity: any) => {
        if (entity === RadiologyDiscrepancyReview) return discrepancyRepo;
        if (entity === IncidentalFindingFollowup) return followupRepo;
        throw new Error(`Unexpected repository request: ${entity?.name}`);
      }),
    } as any;

    const service = new ImagingService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const resolved = await service.resolveDiscrepancyReview(
      tenantDb,
      'disc-1',
      { review_status: 'escalated', resolution_notes: 'Escalated for clinician follow-up.' },
      'rad-1',
    );
    const completed = await service.completeIncidentalFollowup(
      tenantDb,
      'follow-1',
      { resolution_notes: 'Patient notified and clinician informed.' },
      'rad-1',
    );

    expect(discrepancyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'disc-1',
        reviewStatus: 'escalated',
        resolutionNotes: 'Escalated for clinician follow-up.',
        reviewedBy: 'rad-1',
      }),
    );
    expect(followupRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'follow-1',
        status: 'completed',
        resolutionNotes: 'Patient notified and clinician informed.',
        completedBy: 'rad-1',
      }),
    );
    expect(resolved.reviewStatus).toBe('escalated');
    expect(completed.status).toBe('completed');
  });
});
