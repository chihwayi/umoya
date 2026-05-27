import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ClinicalPathway } from '../entities/clinical-pathway.entity';
import { EncounterCopilotSession } from '../entities/encounter-copilot-session.entity';
import { OrderAppropriatenessReview } from '../entities/order-appropriateness-review.entity';
import { ResultFollowupTask } from '../entities/result-followup-task.entity';
import { TreatmentPathwayInstance } from '../entities/treatment-pathway-instance.entity';
import { SmartDefaultsService } from './smart-defaults.service';
import { AiSurfaceContractService } from './ai-surface-contract.service';
import { AiOrderPipelineService } from './ai-order-pipeline.service';
import { OrderType, OrderPriority } from '../entities/order.entity';

interface EncounterCopilotRequest {
  patientId: string;
  appointmentId?: string;
  medicalRecordId?: string;
  ambientSessionId?: string;
  specialty?: string;
  encounterType?: string;
  chiefComplaint?: string;
}

@Injectable()
export class EncounterCopilotService {
  private readonly logger = new Logger(EncounterCopilotService.name);

  constructor(
    private readonly smartDefaultsService: SmartDefaultsService,
    private readonly aiSurfaceContractService: AiSurfaceContractService,
    @Optional() private readonly aiOrderPipeline?: AiOrderPipelineService,
  ) {}

  private buildAiMetadata() {
    return this.aiSurfaceContractService.buildSurfaceMetadata({
      aiSurface: 'encounter_copilot',
      useCase: 'encounter_copilot',
      source: 'encounter_copilot_service',
      modelId: 'encounter_copilot_proxy',
      modelVersion: 'encounter_copilot_proxy',
      provider: 'local',
      recorded: true,
    });
  }

  async generateSession(
    tenantId: string,
    tenantDb: DataSource,
    payload: EncounterCopilotRequest,
    actorUserId?: string | null,
  ) {
    if (!payload?.patientId) {
      throw new BadRequestException('patientId is required');
    }

    const patient = await this.getPatientRow(tenantDb, payload.patientId);
    if (!patient) {
      throw new NotFoundException(`Patient ${payload.patientId} not found`);
    }

    const latestMedicalRecord = await this.getLatestMedicalRecord(tenantDb, payload);
    const latestAmbientSession = await this.getAmbientContext(tenantDb, payload);
    const activeProblems = await this.getActiveProblems(tenantDb, payload.patientId, latestMedicalRecord);
    const allergies = await this.getAllergies(tenantDb, payload.patientId);
    const medications = await this.getActiveMedications(tenantDb, payload.patientId);
    const careGaps = await this.getOpenCareGaps(tenantDb, payload.patientId);
    const medicationAlerts = await this.getMedicationAlerts(tenantDb, payload.patientId);
    const latestVitals = await this.getLatestVitals(tenantDb, payload.patientId);

    const specialtyContributors = await this.buildSpecialtyContributors(
      tenantDb,
      payload.patientId,
      payload.specialty,
    );

    const diagnosisTerms = this.collectDiagnosisTerms(activeProblems, latestMedicalRecord);
    const smartDefaults = await this.smartDefaultsService.getDefaults(tenantId, 'encounter_copilot', {
      age: this.calculateAge(patient.date_of_birth),
      sex: patient.gender,
      diagnoses: diagnosisTerms,
      medications: medications.map((item) => item.medicationName),
      vitals: latestVitals ?? undefined,
      pregnancyStatus: patient.pregnancy_status ?? undefined,
    });

    const missingContext = this.buildMissingContext({
      patient,
      latestMedicalRecord,
      latestVitals,
      specialtyContributors,
      encounterType: payload.encounterType,
      chiefComplaint: payload.chiefComplaint,
    });
    const suggestedOrders = this.buildSuggestedOrders({
      ambientSession: latestAmbientSession,
      specialtyContributors,
      smartDefaults,
    });
    const likelyCareGaps = this.buildLikelyCareGaps(careGaps, specialtyContributors);
    const contraindicationSummary = this.buildContraindicationSummary(allergies, medications, medicationAlerts);

    const pathwayRecommendations = await this.buildPathwayRecommendations(
      tenantDb,
      payload.specialty,
      activeProblems,
      specialtyContributors,
      likelyCareGaps,
    );

    const sessionRepo = tenantDb.getRepository(EncounterCopilotSession);
    const session = await sessionRepo.save(
      sessionRepo.create({
        patientId: payload.patientId,
        appointmentId: payload.appointmentId ?? latestMedicalRecord?.appointment_id ?? null,
        medicalRecordId: payload.medicalRecordId ?? latestMedicalRecord?.id ?? null,
        ambientSessionId: payload.ambientSessionId ?? latestAmbientSession?.id ?? null,
        generatedBy: actorUserId ?? null,
        encounterType: payload.encounterType ?? latestMedicalRecord?.record_type ?? null,
        specialty: payload.specialty ?? this.inferEncounterSpecialty(specialtyContributors) ?? null,
        chiefComplaint:
          payload.chiefComplaint ??
          latestMedicalRecord?.chief_complaint ??
          latestAmbientSession?.draft_note?.subjective ??
          null,
        status: 'generated',
        summary: this.buildSummary(patient, specialtyContributors, pathwayRecommendations, likelyCareGaps),
        activeProblems,
        missingContext,
        suggestedOrders,
        likelyCareGaps,
        contraindicationSummary,
        pathwayRecommendations,
        specialtyContributors,
        encounterSnapshot: {
          patient: {
            id: patient.id,
            patientNumber: patient.patient_number,
            name: [patient.first_name, patient.last_name].filter(Boolean).join(' '),
            age: this.calculateAge(patient.date_of_birth),
            gender: patient.gender,
            pregnancyStatus: patient.pregnancy_status ?? null,
          },
          latestVitals,
          latestMedicalRecord: latestMedicalRecord
            ? {
                id: latestMedicalRecord.id,
                visitDate: latestMedicalRecord.visit_date ?? null,
                chiefComplaint: latestMedicalRecord.chief_complaint ?? null,
                assessment: latestMedicalRecord.assessment ?? null,
                plan: latestMedicalRecord.plan ?? null,
                diagnoses: this.toJsonValue(latestMedicalRecord.diagnoses, []),
              }
            : null,
          ambient: latestAmbientSession
            ? {
                id: latestAmbientSession.id,
                aiSuggestedDiagnoses: this.toJsonValue(latestAmbientSession.ai_suggested_diagnoses, []),
                alertsRaised: this.toJsonValue(latestAmbientSession.alerts_raised, []),
              }
            : null,
          smartDefaults,
        },
        governance: {
          governedPath: true,
          workstream: 'MOAS-06',
          contributorCount: specialtyContributors.length,
          generatedAt: new Date().toISOString(),
        },
        confidenceScore: this.calculateConfidenceScore({
          activeProblemCount: activeProblems.length,
          contributorCount: specialtyContributors.length,
          suggestedOrderCount: suggestedOrders.length,
          careGapCount: likelyCareGaps.length,
        }),
      }),
    );

    await this.persistPathwayInstances(
      tenantDb,
      session.id,
      payload.patientId,
      session.appointmentId,
      pathwayRecommendations,
    );

    if (this.aiOrderPipeline && suggestedOrders.length > 0) {
      const typeMap: Record<string, OrderType> = {
        lab_test: OrderType.LAB_TEST,
        consultation: OrderType.CONSULTATION,
        procedure: OrderType.PROCEDURE,
      };
      const priorityMap: Record<string, OrderPriority> = {
        urgent: OrderPriority.URGENT,
        high: OrderPriority.HIGH,
        normal: OrderPriority.NORMAL,
        low: OrderPriority.LOW,
      };
      const mappedSuggestions = suggestedOrders
        .filter((o: any) => typeMap[o.type])
        .map((o: any) => ({
          orderType: typeMap[o.type] ?? OrderType.PROCEDURE,
          instructions: o.name ?? 'AI-suggested order',
          priority: priorityMap[o.priority] ?? OrderPriority.NORMAL,
          aiReason: o.rationale ?? 'Suggested by encounter copilot',
          suggestedByModel: 'encounter_copilot',
        }));
      if (mappedSuggestions.length > 0) {
        await this.aiOrderPipeline
          .saveSuggestions(payload.patientId, 'encounter_copilot', session.id, mappedSuggestions, tenantDb)
          .catch((e: any) => this.logger.warn(`AI order pipeline save failed: ${e?.message}`));
      }
    }

    this.logger.log(`Encounter copilot session ${session.id} generated for patient ${payload.patientId}`);
    return this.getSessionById(tenantDb, session.id);
  }

  async getSessionById(tenantDb: DataSource, id: string) {
    const session = await tenantDb.getRepository(EncounterCopilotSession).findOneBy({ id });
    if (!session) {
      throw new NotFoundException(`Encounter copilot session ${id} not found`);
    }

    const pathwayInstances = await tenantDb.getRepository(TreatmentPathwayInstance).find({
      where: { encounterCopilotSessionId: id },
      order: { recommendationRank: 'ASC', createdAt: 'ASC' },
    });
    const resultFollowupTasks = await this.listResultFollowupTasks(tenantDb, id);

    return {
      ...session,
      treatmentPathways: pathwayInstances,
      resultFollowupTasks,
      aiMetadata: this.buildAiMetadata(),
    };
  }

  async listPatientSessions(
    tenantDb: DataSource,
    patientId: string,
    limit = 10,
  ) {
    const sessions = await tenantDb.getRepository(EncounterCopilotSession).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: Math.max(1, Math.min(limit, 50)),
    });

    return sessions.map((session) => ({
      ...session,
      aiMetadata: this.buildAiMetadata(),
    }));
  }

  async reviewProposedOrders(
    tenantDb: DataSource,
    sessionId: string,
    proposedOrders: Array<Record<string, any>>,
    actorUserId?: string | null,
  ) {
    if (!Array.isArray(proposedOrders) || proposedOrders.length === 0) {
      throw new BadRequestException('At least one proposed order is required');
    }

    const session = await tenantDb.getRepository(EncounterCopilotSession).findOneBy({ id: sessionId });
    if (!session) {
      throw new NotFoundException(`Encounter copilot session ${sessionId} not found`);
    }

    const allergies = await this.getAllergies(tenantDb, session.patientId);
    const medications = await this.getActiveMedications(tenantDb, session.patientId);
    const medicationAlerts = await this.getMedicationAlerts(tenantDb, session.patientId);
    const reviewRepo = tenantDb.getRepository(OrderAppropriatenessReview);

    const reviews = proposedOrders.map((order) => {
      const evaluated = this.evaluateProposedOrder(order, {
        session,
        allergies,
        medications,
        medicationAlerts,
      });

      return reviewRepo.create({
        encounterCopilotSessionId: session.id,
        patientId: session.patientId,
        appointmentId: session.appointmentId ?? null,
        reviewedBy: actorUserId ?? null,
        proposedOrderType: evaluated.proposedOrderType,
        proposedOrderName: evaluated.proposedOrderName,
        appropriatenessStatus: evaluated.appropriatenessStatus,
        confidenceScore: evaluated.confidenceScore,
        proposedOrder: order,
        supportingSignals: evaluated.supportingSignals,
        blockingIssues: evaluated.blockingIssues,
        recommendedAlternatives: evaluated.recommendedAlternatives,
        rationale: evaluated.rationale,
      });
    });

    const saved = await reviewRepo.save(reviews);
    return {
      sessionId,
      reviews: saved,
    };
  }

  async listOrderAppropriatenessReviews(tenantDb: DataSource, sessionId: string) {
    return tenantDb.getRepository(OrderAppropriatenessReview).find({
      where: { encounterCopilotSessionId: sessionId },
      order: { createdAt: 'DESC' },
    });
  }

  async generateResultFollowupTasks(
    tenantDb: DataSource,
    sessionId: string,
    actorUserId?: string | null,
  ) {
    const session = await tenantDb.getRepository(EncounterCopilotSession).findOneBy({ id: sessionId });
    if (!session) {
      throw new NotFoundException(`Encounter copilot session ${sessionId} not found`);
    }

    const existingTasks = await tenantDb.getRepository(ResultFollowupTask).find({
      where: { encounterCopilotSessionId: sessionId },
      order: { createdAt: 'DESC' },
    });
    const existingKeys = new Set(
      existingTasks.map((task) => `${task.sourceType}::${task.sourceReferenceId || 'none'}`),
    );

    const [criticalAlerts, radiologyFindings] = await Promise.all([
      this.getPendingCriticalResultAlerts(tenantDb, session.patientId),
      this.getRadiologyFollowupSignals(tenantDb, session.patientId),
    ]);

    const repo = tenantDb.getRepository(ResultFollowupTask);
    const pendingCreates = [
      ...criticalAlerts
        .filter((alert) => !existingKeys.has(`critical_result_alert::${alert.id}`))
        .map((alert) => this.buildCriticalResultFollowupTask(repo, session, alert, actorUserId)),
      ...radiologyFindings
        .filter((finding) => !existingKeys.has(`radiology_ai_finding::${finding.id}`))
        .map((finding) => this.buildRadiologyFollowupTask(repo, session, finding, actorUserId)),
    ];

    if (pendingCreates.length > 0) {
      await repo.save(pendingCreates);
    }

    return {
      sessionId,
      createdCount: pendingCreates.length,
      tasks: await this.listResultFollowupTasks(tenantDb, sessionId),
    };
  }

  async listResultFollowupTasks(tenantDb: DataSource, sessionId: string) {
    const tasks = await tenantDb.getRepository(ResultFollowupTask).find({
      where: { encounterCopilotSessionId: sessionId },
      order: { createdAt: 'DESC' },
    });
    return tasks.sort((left, right) => {
      const priorityDelta = this.priorityRank(left.priority) - this.priorityRank(right.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDue - rightDue || right.createdAt.getTime() - left.createdAt.getTime();
    });
  }

  private async persistPathwayInstances(
    tenantDb: DataSource,
    sessionId: string,
    patientId: string,
    appointmentId: string | null,
    pathwayRecommendations: Array<Record<string, any>>,
  ) {
    if (!pathwayRecommendations.length) {
      return;
    }

    const repo = tenantDb.getRepository(TreatmentPathwayInstance);
    const rows = pathwayRecommendations.map((item, index) =>
      repo.create({
        encounterCopilotSessionId: sessionId,
        patientId,
        appointmentId,
        pathwayId: item.pathwayId ?? null,
        pathwayCode: item.pathwayCode ?? null,
        pathwayName: item.pathwayName ?? item.condition ?? `Pathway ${index + 1}`,
        specialty: item.specialty ?? null,
        condition: item.condition ?? null,
        recommendationRank: index + 1,
        recommendationReason: item.recommendationReason ?? 'Encounter copilot recommendation',
        status: 'recommended',
        evidence: item.evidence ?? {},
        metadata: {
          matchedHints: item.matchedHints ?? [],
          score: item.score ?? 0,
        },
      }),
    );

    await repo.save(rows);
  }

  private async getPendingCriticalResultAlerts(tenantDb: DataSource, patientId: string) {
    const rows = await tenantDb.query(
      `
      SELECT
        id,
        lab_order_id,
        ordering_provider_id,
        test_code,
        test_name,
        result_value,
        critical_value_type,
        alert_message,
        status,
        created_at
      FROM critical_result_alerts
      WHERE patient_id = $1
        AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [patientId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      labOrderId: row.lab_order_id,
      orderingProviderId: row.ordering_provider_id ?? null,
      testCode: row.test_code ?? null,
      testName: row.test_name ?? 'Critical result',
      resultValue: row.result_value ?? null,
      criticalValueType: row.critical_value_type ?? 'critical',
      alertMessage: row.alert_message ?? null,
      status: row.status ?? 'pending',
      createdAt: row.created_at ?? null,
    }));
  }

  private async getRadiologyFollowupSignals(tenantDb: DataSource, patientId: string) {
    const rows = await tenantDb.query(
      `
      SELECT
        id,
        study_id,
        modality,
        findings,
        top_finding,
        overall_confidence,
        radiologist_reviewed,
        radiologist_notes,
        alerted,
        analyzed_at
      FROM radiology_ai_findings
      WHERE patient_id = $1
        AND (
          alerted = TRUE
          OR (radiologist_reviewed = FALSE AND COALESCE(overall_confidence, 0) >= 0.65)
        )
      ORDER BY analyzed_at DESC
      LIMIT 10
      `,
      [patientId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      studyId: row.study_id ?? null,
      modality: row.modality ?? 'Imaging',
      findings: this.toJsonValue(row.findings, []),
      topFinding: row.top_finding ?? null,
      overallConfidence:
        row.overall_confidence === null || row.overall_confidence === undefined
          ? null
          : Number(row.overall_confidence),
      radiologistReviewed: Boolean(row.radiologist_reviewed),
      radiologistNotes: row.radiologist_notes ?? null,
      alerted: Boolean(row.alerted),
      analyzedAt: row.analyzed_at ?? null,
    }));
  }

  private async getPatientRow(tenantDb: DataSource, patientId: string) {
    const [row] = await tenantDb.query(
      `
      SELECT
        id,
        patient_number,
        first_name,
        last_name,
        date_of_birth,
        gender,
        pregnancy_status,
        emergency_contact_name,
        emergency_contact_phone,
        insurance_provider,
        insurance_number,
        next_of_kin_name,
        next_of_kin_phone
      FROM patients
      WHERE id = $1
        AND is_active = true
      LIMIT 1
      `,
      [patientId],
    );
    return row ?? null;
  }

  private async getLatestMedicalRecord(tenantDb: DataSource, payload: EncounterCopilotRequest) {
    if (payload.medicalRecordId) {
      const [row] = await tenantDb.query(
        `
        SELECT
          id,
          appointment_id,
          record_type,
          visit_date,
          chief_complaint,
          assessment,
          plan,
          diagnoses
        FROM medical_records
        WHERE id = $1
        LIMIT 1
        `,
        [payload.medicalRecordId],
      );
      return row ?? null;
    }

    const params: any[] = [payload.patientId];
    let query = `
      SELECT
        id,
        appointment_id,
        record_type,
        visit_date,
        chief_complaint,
        assessment,
        plan,
        diagnoses
      FROM medical_records
      WHERE patient_id = $1
    `;
    if (payload.appointmentId) {
      params.push(payload.appointmentId);
      query += ` AND appointment_id = $2`;
    }
    query += ` ORDER BY visit_date DESC NULLS LAST, created_at DESC LIMIT 1`;

    const [row] = await tenantDb.query(query, params);
    return row ?? null;
  }

  private async getAmbientContext(tenantDb: DataSource, payload: EncounterCopilotRequest) {
    if (payload.ambientSessionId) {
      const [row] = await tenantDb.query(
        `
        SELECT
          id,
          draft_note,
          ai_suggested_orders,
          ai_suggested_diagnoses,
          alerts_raised
        FROM ambient_sessions
        WHERE id = $1
        LIMIT 1
        `,
        [payload.ambientSessionId],
      );
      return row ?? null;
    }

    const params: any[] = [payload.patientId];
    let query = `
      SELECT
        id,
        draft_note,
        ai_suggested_orders,
        ai_suggested_diagnoses,
        alerts_raised
      FROM ambient_sessions
      WHERE patient_id = $1
    `;
    if (payload.appointmentId) {
      params.push(payload.appointmentId);
      query += ` AND appointment_id = $2`;
    }
    query += ` ORDER BY created_at DESC LIMIT 1`;

    const [row] = await tenantDb.query(query, params);
    return row ?? null;
  }

  private async getActiveProblems(tenantDb: DataSource, patientId: string, latestMedicalRecord: any) {
    const rows = await tenantDb.query(
      `
      SELECT
        id,
        description,
        status,
        onset_date,
        code,
        snomed_concept_id,
        snomed_term
      FROM problems
      WHERE patient_id = $1
        AND status = 'active'
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 20
      `,
      [patientId],
    );

    const medicalRecordDiagnoses = this.toJsonValue(latestMedicalRecord?.diagnoses, []).map((item: any, index: number) => ({
      id: `medical-record-${latestMedicalRecord?.id || index}`,
      description: item?.description || item?.code || 'Unspecified diagnosis',
      status: 'active',
      source: 'medical_record',
      code: item?.code ?? null,
      type: item?.type ?? null,
    }));

    return this.dedupeByKey(
      [
        ...rows.map((row: any) => ({
          id: row.id,
          description: row.description,
          status: row.status,
          onsetDate: row.onset_date ?? null,
          code: row.code ?? row.snomed_concept_id ?? null,
          source: 'problem_list',
        })),
        ...medicalRecordDiagnoses,
      ],
      (item) => `${String(item.description || '').toLowerCase()}::${String(item.code || '').toLowerCase()}`,
    );
  }

  private async getAllergies(tenantDb: DataSource, patientId: string) {
    const rows = await tenantDb.query(
      `
      SELECT allergen, reaction, severity, verification_status, clinical_status
      FROM allergies
      WHERE patient_id = $1
      ORDER BY recorded_at DESC
      LIMIT 20
      `,
      [patientId],
    );
    return rows.map((row: any) => ({
      allergen: row.allergen,
      reaction: row.reaction ?? null,
      severity: row.severity ?? 'unknown',
      verificationStatus: row.verification_status ?? null,
      clinicalStatus: row.clinical_status ?? null,
    }));
  }

  private async getActiveMedications(tenantDb: DataSource, patientId: string) {
    const rows = await tenantDb.query(
      `
      SELECT medication_name, dosage, frequency, status, prescribed_date
      FROM prescriptions
      WHERE patient_id = $1
        AND status = 'active'
      ORDER BY prescribed_date DESC, created_at DESC
      LIMIT 20
      `,
      [patientId],
    );
    return rows.map((row: any) => ({
      medicationName: row.medication_name,
      dosage: row.dosage ?? null,
      frequency: row.frequency ?? null,
      status: row.status,
      prescribedDate: row.prescribed_date ?? null,
    }));
  }

  private async getOpenCareGaps(tenantDb: DataSource, patientId: string) {
    const rows = await tenantDb.query(
      `
      SELECT gap_type, gap_description, recommended_action, priority, due_date, status
      FROM care_gap_detections
      WHERE patient_id = $1
        AND status = 'open'
      ORDER BY detected_at DESC
      LIMIT 20
      `,
      [patientId],
    );
    return rows.map((row: any) => ({
      gapType: row.gap_type,
      gapDescription: row.gap_description,
      recommendedAction: row.recommended_action ?? null,
      priority: row.priority ?? 'medium',
      dueDate: row.due_date ?? null,
      source: 'care_gap_detection',
    }));
  }

  private async getMedicationAlerts(tenantDb: DataSource, patientId: string) {
    const rows = await tenantDb.query(
      `
      SELECT alert_type, severity, alert_message, alert_details, acknowledged
      FROM medication_alerts
      WHERE patient_id = $1
      ORDER BY created_at DESC
      LIMIT 20
      `,
      [patientId],
    );
    return rows.map((row: any) => ({
      alertType: row.alert_type,
      severity: row.severity,
      alertMessage: row.alert_message,
      alertDetails: this.toJsonValue(row.alert_details, {}),
      acknowledged: Boolean(row.acknowledged),
    }));
  }

  private async getLatestVitals(tenantDb: DataSource, patientId: string) {
    const [row] = await tenantDb.query(
      `
      SELECT
        recorded_at,
        temperature,
        blood_pressure,
        heart_rate,
        respiratory_rate,
        oxygen_saturation,
        weight,
        height,
        bmi,
        blood_glucose
      FROM vitals
      WHERE patient_id = $1
      ORDER BY recorded_at DESC
      LIMIT 1
      `,
      [patientId],
    );
    return row ?? null;
  }

  private async buildSpecialtyContributors(
    tenantDb: DataSource,
    patientId: string,
    requestedSpecialty?: string,
  ) {
    const contributors = await Promise.all([
      this.buildDiabetesContributor(tenantDb, patientId),
      this.buildHivContributor(tenantDb, patientId),
      this.buildMaternityContributor(tenantDb, patientId),
      this.buildOncologyContributor(tenantDb, patientId),
      this.buildCardiologyContributor(tenantDb, patientId),
      this.buildEmergencySepsisContributor(tenantDb, patientId),
      this.buildRequestedSpecialtyContributor(requestedSpecialty),
    ]);

    return contributors.filter(Boolean);
  }

  private async buildDiabetesContributor(tenantDb: DataSource, patientId: string) {
    const [row] = await tenantDb.query(
      `
      SELECT
        dr.id,
        dr.diabetes_type,
        dr.status,
        dr.care_plan,
        cb.hba1c_value,
        cb.hba1c_date,
        cb.eye_exam_checked,
        cb.eye_exam_date,
        cb.bundle_completion_percentage
      FROM diabetes_registry dr
      LEFT JOIN diabetes_care_bundle cb
        ON cb.diabetes_registry_id = dr.id
      WHERE dr.patient_id = $1
        AND dr.status = 'active'
      ORDER BY cb.bundle_date DESC NULLS LAST, cb.created_at DESC NULLS LAST
      LIMIT 1
      `,
      [patientId],
    );

    if (!row) {
      return null;
    }

    const suggestedOrders: any[] = [];
    const careGaps: any[] = [];

    if (!row.hba1c_date || this.daysSince(row.hba1c_date) > 180) {
      suggestedOrders.push({
        name: 'HbA1c',
        type: 'lab_test',
        priority: 'high',
        rationale: 'No recent HbA1c documented for active diabetes registry.',
        sourceModule: 'diabetes',
      });
      careGaps.push({
        gapType: 'diabetes_hba1c_overdue',
        gapDescription: 'Active diabetes registry without HbA1c in the last 6 months.',
        priority: 'high',
        recommendedAction: 'Order HbA1c and review glycemic control.',
        source: 'encounter_copilot',
      });
    }

    if (!row.eye_exam_checked || (row.eye_exam_date && this.daysSince(row.eye_exam_date) > 365)) {
      suggestedOrders.push({
        name: 'Diabetic retinal exam referral',
        type: 'consultation',
        priority: 'normal',
        rationale: 'Retinal screening is missing or stale for diabetes follow-up.',
        sourceModule: 'diabetes',
      });
    }

    return {
      module: 'diabetes',
      specialty: 'endocrinology',
      title: 'Active diabetes management context available',
      findings: [
        `Active ${row.diabetes_type} diabetes registry`,
        row.hba1c_value !== null && row.hba1c_value !== undefined
          ? `Latest HbA1c ${row.hba1c_value}`
          : 'No documented HbA1c value',
      ],
      suggestedOrders,
      likelyCareGaps: careGaps,
      pathwayHints: ['diabetes', 'glycemic control'],
      recommendationReason:
        row.hba1c_value >= 9
          ? 'Poor glycemic control requires structured diabetes treatment pathway review.'
          : 'Diabetes registry context should influence encounter planning.',
      evidence: {
        registryId: row.id,
        diabetesType: row.diabetes_type,
        hba1cValue: row.hba1c_value ?? null,
        hba1cDate: row.hba1c_date ?? null,
        bundleCompletionPercentage: row.bundle_completion_percentage ?? null,
      },
    };
  }

  private async buildHivContributor(tenantDb: DataSource, patientId: string) {
    const [row] = await tenantDb.query(
      `
      SELECT
        e.id,
        e.enrollment_status,
        e.current_regimen,
        e.art_start_date,
        (
          SELECT viral_load
          FROM hiv_clinical_visits
          WHERE enrollment_id = e.id
            AND viral_load IS NOT NULL
          ORDER BY COALESCE(viral_load_test_date, visit_date) DESC
          LIMIT 1
        ) AS last_viral_load,
        (
          SELECT COALESCE(viral_load_test_date, visit_date)
          FROM hiv_clinical_visits
          WHERE enrollment_id = e.id
            AND viral_load IS NOT NULL
          ORDER BY COALESCE(viral_load_test_date, visit_date) DESC
          LIMIT 1
        ) AS last_viral_load_date,
        (
          SELECT visit_date
          FROM hiv_clinical_visits
          WHERE enrollment_id = e.id
          ORDER BY visit_date DESC
          LIMIT 1
        ) AS last_visit_date
      FROM hiv_care_enrollments e
      WHERE e.patient_id = $1
        AND e.enrollment_status = 'active'
      ORDER BY e.updated_at DESC NULLS LAST, e.created_at DESC
      LIMIT 1
      `,
      [patientId],
    );

    if (!row) {
      return null;
    }

    const suggestedOrders: any[] = [];
    const careGaps: any[] = [];

    if (!row.last_viral_load_date || this.daysSince(row.last_viral_load_date) > 180) {
      suggestedOrders.push({
        name: 'HIV viral load',
        type: 'lab_test',
        priority: 'high',
        rationale: 'Active HIV enrollment without a recent viral load.',
        sourceModule: 'hiv',
      });
      careGaps.push({
        gapType: 'hiv_viral_load_overdue',
        gapDescription: 'Active HIV care enrollment without viral load monitoring in the last 6 months.',
        priority: 'high',
        recommendedAction: 'Order viral load and review HIV follow-up adherence.',
        source: 'encounter_copilot',
      });
    }

    if (Number(row.last_viral_load) >= 1000) {
      suggestedOrders.push({
        name: 'Enhanced adherence counseling review',
        type: 'consultation',
        priority: 'urgent',
        rationale: 'Recent viral load suggests possible virologic failure.',
        sourceModule: 'hiv',
      });
    }

    return {
      module: 'hiv',
      specialty: 'infectious_disease',
      title: 'Active HIV longitudinal care context available',
      findings: [
        row.current_regimen ? `Current regimen ${row.current_regimen}` : 'Current regimen not documented',
        row.last_viral_load !== null && row.last_viral_load !== undefined
          ? `Latest viral load ${row.last_viral_load}`
          : 'No recent viral load documented',
      ],
      suggestedOrders,
      likelyCareGaps: careGaps,
      pathwayHints: ['hiv', 'infectious disease'],
      recommendationReason:
        Number(row.last_viral_load) >= 1000
          ? 'Unsuppressed viral load should drive HIV pathway escalation and adherence follow-up.'
          : 'HIV care enrollment should shape encounter monitoring and follow-up.',
      evidence: {
        enrollmentId: row.id,
        currentRegimen: row.current_regimen ?? null,
        lastViralLoad: row.last_viral_load ?? null,
        lastViralLoadDate: row.last_viral_load_date ?? null,
        lastVisitDate: row.last_visit_date ?? null,
      },
    };
  }

  private async buildMaternityContributor(tenantDb: DataSource, patientId: string) {
    const [row] = await tenantDb.query(
      `
      SELECT
        me.id,
        me.risk_category,
        me.expected_delivery_date,
        (
          SELECT visit_date
          FROM anc_visits
          WHERE maternity_enrollment_id = me.id
          ORDER BY visit_date DESC
          LIMIT 1
        ) AS last_anc_visit_date
      FROM maternity_enrollments me
      WHERE me.patient_id = $1
        AND me.enrollment_status = 'active'
      ORDER BY me.enrollment_date DESC
      LIMIT 1
      `,
      [patientId],
    );

    if (!row) {
      return null;
    }

    const suggestedOrders: any[] = [];
    const careGaps: any[] = [];

    if (!row.last_anc_visit_date || this.daysSince(row.last_anc_visit_date) > 30) {
      suggestedOrders.push({
        name: 'Focused ANC review',
        type: 'consultation',
        priority: row.risk_category === 'high' ? 'urgent' : 'high',
        rationale: 'Active maternity enrollment without a recent ANC follow-up.',
        sourceModule: 'maternity',
      });
      careGaps.push({
        gapType: 'maternity_anc_followup_due',
        gapDescription: 'Maternity enrollment requires ANC follow-up review.',
        priority: row.risk_category === 'high' ? 'urgent' : 'high',
        recommendedAction: 'Schedule and complete the next ANC follow-up.',
        source: 'encounter_copilot',
      });
    }

    return {
      module: 'maternity',
      specialty: 'obstetrics',
      title: 'Active maternity care context available',
      findings: [
        `Risk category ${row.risk_category}`,
        row.expected_delivery_date
          ? `EDD ${row.expected_delivery_date}`
          : 'EDD not documented',
      ],
      suggestedOrders,
      likelyCareGaps: careGaps,
      pathwayHints: ['maternity', 'obstetrics', row.risk_category === 'high' ? 'high-risk pregnancy' : 'antenatal care'],
      recommendationReason:
        row.risk_category === 'high'
          ? 'High-risk maternity enrollment should drive the encounter pathway.'
          : 'Active maternity enrollment should shape ANC-focused care planning.',
      evidence: {
        enrollmentId: row.id,
        riskCategory: row.risk_category,
        expectedDeliveryDate: row.expected_delivery_date ?? null,
        lastAncVisitDate: row.last_anc_visit_date ?? null,
      },
    };
  }

  private async buildOncologyContributor(tenantDb: DataSource, patientId: string) {
    const [row] = await tenantDb.query(
      `
      SELECT id, status, primary_diagnosis, overall_stage, treatment_intent
      FROM oncology_cases
      WHERE patient_id = $1
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
      `,
      [patientId],
    );

    if (!row) {
      return null;
    }

    const suggestedOrders: any[] = [];
    if (String(row.status || '').toLowerCase() === 'new') {
      suggestedOrders.push({
        name: 'Oncology staging and treatment planning review',
        type: 'consultation',
        priority: 'high',
        rationale: 'New oncology case requires pathway-driven staging and treatment planning.',
        sourceModule: 'oncology',
      });
    }

    return {
      module: 'oncology',
      specialty: 'oncology',
      title: 'Oncology case context available',
      findings: [
        row.primary_diagnosis ? `Primary diagnosis ${row.primary_diagnosis}` : 'Primary diagnosis not documented',
        row.overall_stage ? `Stage ${row.overall_stage}` : 'Stage not documented',
      ],
      suggestedOrders,
      likelyCareGaps: [],
      pathwayHints: ['oncology', row.primary_diagnosis || 'cancer'],
      recommendationReason: 'Active oncology case should anchor pathway and next-step treatment planning.',
      evidence: {
        caseId: row.id,
        status: row.status,
        primaryDiagnosis: row.primary_diagnosis ?? null,
        overallStage: row.overall_stage ?? null,
        treatmentIntent: row.treatment_intent ?? null,
      },
    };
  }

  private async buildCardiologyContributor(tenantDb: DataSource, patientId: string) {
    const [row] = await tenantDb.query(
      `
      SELECT
        id,
        encounter_date,
        encounter_type,
        visit_reason,
        hemodynamics,
        diagnostic_tests,
        care_plan,
        follow_up_plan,
        risk_score,
        care_status
      FROM cardiology_encounters
      WHERE patient_id = $1
      ORDER BY encounter_date DESC, created_at DESC
      LIMIT 1
      `,
      [patientId],
    );

    if (!row) {
      return null;
    }

    const diagnosticTests = this.toJsonValue<any[]>(row.diagnostic_tests, []);
    const hemodynamics = this.toJsonValue<Record<string, any>>(row.hemodynamics, {});
    const suggestedOrders: any[] = [];
    const careGaps: any[] = [];
    const visitReason = String(row.visit_reason || '').toLowerCase();
    const riskScore = String(row.risk_score || '').toLowerCase();

    if (!diagnosticTests.length) {
      suggestedOrders.push({
        name: 'Cardiology diagnostic order set',
        type: 'order_set',
        priority: riskScore === 'critical' ? 'urgent' : 'high',
        rationale: 'High-risk cardiology encounter without diagnostic-test planning on record.',
        sourceModule: 'cardiology',
      });
    }

    if (!row.follow_up_plan) {
      careGaps.push({
        gapType: 'cardiology_followup_plan_missing',
        gapDescription: 'Recent cardiology encounter lacks an explicit follow-up plan.',
        priority: riskScore === 'critical' ? 'urgent' : 'high',
        recommendedAction: 'Document follow-up timing, return precautions, and clinician handoff checkpoints.',
        source: 'encounter_copilot',
      });
    }

    if (!row.care_plan) {
      careGaps.push({
        gapType: 'cardiology_care_plan_incomplete',
        gapDescription: 'Recent cardiology encounter lacks a documented care plan.',
        priority: 'high',
        recommendedAction: 'Document active management steps and testing/medication strategy before encounter close.',
        source: 'encounter_copilot',
      });
    }

    if (
      riskScore === 'critical' ||
      visitReason.includes('chest pain') ||
      visitReason.includes('heart failure')
    ) {
      suggestedOrders.push({
        name: 'Urgent ECG and troponin review',
        type: 'diagnostic_review',
        priority: 'urgent',
        rationale: 'Recent cardiology context suggests an acute coronary or decompensation workflow should be confirmed.',
        sourceModule: 'cardiology',
      });
    }

    return {
      module: 'cardiology',
      specialty: 'cardiology',
      title: 'Active cardiology longitudinal context available',
      findings: [
        row.visit_reason ? `Recent visit reason ${row.visit_reason}` : 'Recent cardiology visit recorded',
        row.risk_score ? `Risk score ${row.risk_score}` : 'Risk score not documented',
        hemodynamics?.bloodPressure || hemodynamics?.heartRate
          ? `Hemodynamics ${[hemodynamics?.bloodPressure, hemodynamics?.heartRate ? `HR ${hemodynamics.heartRate}` : null].filter(Boolean).join(', ')}`
          : 'Hemodynamic summary not documented',
      ],
      suggestedOrders,
      likelyCareGaps: careGaps,
      pathwayHints: [
        'cardiology',
        row.encounter_type || null,
        row.visit_reason || null,
        riskScore === 'critical' ? 'acute coronary syndrome' : null,
        visitReason.includes('heart failure') ? 'heart failure' : null,
      ].filter(Boolean),
      recommendationReason:
        riskScore === 'critical'
          ? 'Critical cardiology risk should drive urgent pathway selection and treatment orchestration.'
          : 'Recent cardiology encounter context should shape testing, follow-up, and longitudinal treatment planning.',
      evidence: {
        encounterId: row.id,
        encounterDate: row.encounter_date ?? null,
        encounterType: row.encounter_type ?? null,
        visitReason: row.visit_reason ?? null,
        riskScore: row.risk_score ?? null,
        careStatus: row.care_status ?? null,
        followUpPlanPresent: Boolean(row.follow_up_plan),
        carePlanPresent: Boolean(row.care_plan),
        diagnosticTestCount: diagnosticTests.length,
      },
    };
  }

  private async buildEmergencySepsisContributor(tenantDb: DataSource, patientId: string) {
    const [latestEdVisit, latestSepsisScreening, latestSepsisBundle] = await Promise.all([
      tenantDb.query(
        `
        SELECT
          id,
          arrival_date,
          chief_complaint,
          triage_level,
          triage_acuity,
          ed_status,
          disposition,
          code_stroke,
          code_stemi,
          code_sepsis,
          follow_up_instructions,
          quality_flags
        FROM ed_visits
        WHERE patient_id = $1
        ORDER BY arrival_date DESC, created_at DESC
        LIMIT 1
        `,
        [patientId],
      ),
      tenantDb.query(
        `
        SELECT
          id,
          screening_datetime,
          qsofa_score,
          sirs_score,
          lactate,
          sepsis_suspected,
          severe_sepsis,
          septic_shock,
          sepsis_bundle_initiated
        FROM sepsis_screenings
        WHERE patient_id = $1
        ORDER BY screening_datetime DESC, created_at DESC
        LIMIT 1
        `,
        [patientId],
      ),
      tenantDb.query(
        `
        SELECT
          id,
          bundle_start_time,
          lactate_value,
          repeat_lactate_measured,
          repeat_lactate_value,
          three_hour_bundle_complete,
          six_hour_bundle_complete,
          overall_compliance,
          patient_outcome
        FROM sepsis_bundles
        WHERE patient_id = $1
        ORDER BY bundle_start_time DESC, created_at DESC
        LIMIT 1
        `,
        [patientId],
      ),
    ]);

    const edVisit = latestEdVisit?.[0] ?? null;
    const sepsisScreening = latestSepsisScreening?.[0] ?? null;
    const sepsisBundle = latestSepsisBundle?.[0] ?? null;

    if (!edVisit && !sepsisScreening && !sepsisBundle) {
      return null;
    }

    const suggestedOrders: any[] = [];
    const careGaps: any[] = [];
    const findings: string[] = [];
    const pathwayHints = ['emergency', 'sepsis'];

    if (edVisit) {
      findings.push(
        edVisit.chief_complaint
          ? `Recent ED visit for ${edVisit.chief_complaint}`
          : 'Recent ED visit context available',
      );
      if (edVisit.triage_acuity) {
        findings.push(`ED triage acuity ${edVisit.triage_acuity}`);
      }
      if (!edVisit.disposition) {
        careGaps.push({
          gapType: 'ed_disposition_pending',
          gapDescription: 'Recent ED visit lacks a documented disposition plan.',
          priority: 'high',
          recommendedAction: 'Complete ED disposition planning and clinician handoff before encounter closure.',
          source: 'encounter_copilot',
        });
      }
      if (!edVisit.follow_up_instructions) {
        careGaps.push({
          gapType: 'ed_followup_instructions_missing',
          gapDescription: 'Recent ED visit lacks follow-up instructions.',
          priority: 'high',
          recommendedAction: 'Document return precautions and follow-up instructions before ED closure.',
          source: 'encounter_copilot',
        });
      }
      if (edVisit.code_stemi || String(edVisit.chief_complaint || '').toLowerCase().includes('chest pain')) {
        suggestedOrders.push({
          name: 'Emergency cardiac protocol review',
          type: 'order_set',
          priority: 'urgent',
          rationale: 'ED chest-pain/STEMI context requires explicit protocol confirmation and execution tracking.',
          sourceModule: 'ed',
        });
        pathwayHints.push('acute coronary syndrome');
      }
      if (edVisit.code_stroke) {
        pathwayHints.push('stroke');
      }
      if (edVisit.code_sepsis) {
        pathwayHints.push('sepsis');
      }
    }

    if (sepsisScreening) {
      findings.push(
        sepsisScreening.sepsis_suspected
          ? `Sepsis screening triggered with qSOFA ${sepsisScreening.qsofa_score ?? 0} and lactate ${sepsisScreening.lactate ?? 'n/a'}`
          : 'Recent sepsis screening recorded',
      );
      if (sepsisScreening.sepsis_suspected && !sepsisScreening.sepsis_bundle_initiated && !sepsisBundle) {
        suggestedOrders.push({
          name: 'Initiate sepsis hour-one bundle',
          type: 'order_set',
          priority: sepsisScreening.septic_shock ? 'urgent' : 'high',
          rationale: 'Sepsis is suspected but no bundle initiation is documented.',
          sourceModule: 'sepsis',
        });
        careGaps.push({
          gapType: 'sepsis_bundle_not_started',
          gapDescription: 'Recent sepsis screening suggests sepsis but no bundle initiation is documented.',
          priority: sepsisScreening.septic_shock ? 'urgent' : 'high',
          recommendedAction: 'Start the sepsis bundle, document antibiotics/cultures, and track time-to-intervention.',
          source: 'encounter_copilot',
        });
      }
    }

    if (sepsisBundle) {
      findings.push(
        sepsisBundle.overall_compliance
          ? 'Recent sepsis bundle marked compliant'
          : 'Recent sepsis bundle remains incomplete',
      );
      if (!sepsisBundle.three_hour_bundle_complete) {
        suggestedOrders.push({
          name: 'Queue sepsis three-hour bundle follow-through',
          type: 'order_set',
          priority: 'urgent',
          rationale: 'Recent sepsis bundle is incomplete and needs structured three-hour follow-through.',
          sourceModule: 'sepsis',
        });
      }
      if (!sepsisBundle.repeat_lactate_measured && Number(sepsisBundle.lactate_value) >= 2) {
        suggestedOrders.push({
          name: 'Repeat lactate monitoring plan',
          type: 'lab_followup',
          priority: Number(sepsisBundle.lactate_value) >= 4 ? 'urgent' : 'high',
          rationale: 'Elevated lactate without documented repeat measurement needs follow-through.',
          sourceModule: 'sepsis',
        });
        careGaps.push({
          gapType: 'sepsis_repeat_lactate_pending',
          gapDescription: 'Recent sepsis bundle lacks repeat lactate follow-through.',
          priority: Number(sepsisBundle.lactate_value) >= 4 ? 'urgent' : 'high',
          recommendedAction: 'Document repeat lactate timing and complete sepsis reassessment workflow.',
          source: 'encounter_copilot',
        });
      }
    }

    return {
      module: 'emergency_sepsis',
      specialty: 'emergency_medicine',
      title: 'Emergency and sepsis acute-care context available',
      findings,
      suggestedOrders,
      likelyCareGaps: careGaps,
      pathwayHints: this.dedupeByKey(pathwayHints.filter(Boolean), (item) => String(item).toLowerCase()),
      recommendationReason:
        sepsisBundle && !sepsisBundle.overall_compliance
          ? 'Incomplete sepsis bundle follow-through should immediately shape encounter priorities and escalation.'
          : edVisit && !edVisit.disposition
            ? 'Active emergency visit context should drive disposition, protocol execution, and handoff planning.'
            : 'Recent emergency/sepsis context should influence acute-care pathway ranking.',
      evidence: {
        edVisitId: edVisit?.id ?? null,
        edStatus: edVisit?.ed_status ?? null,
        triageAcuity: edVisit?.triage_acuity ?? null,
        sepsisScreeningId: sepsisScreening?.id ?? null,
        qsofaScore: sepsisScreening?.qsofa_score ?? null,
        sirsScore: sepsisScreening?.sirs_score ?? null,
        lactate: sepsisScreening?.lactate ?? sepsisBundle?.lactate_value ?? null,
        sepsisBundleId: sepsisBundle?.id ?? null,
        sepsisBundleCompliant: sepsisBundle?.overall_compliance ?? null,
        repeatLactateMeasured: sepsisBundle?.repeat_lactate_measured ?? null,
      },
    };
  }

  private async buildRequestedSpecialtyContributor(requestedSpecialty?: string) {
    if (!requestedSpecialty) {
      return null;
    }
    return {
      module: 'requested_specialty',
      specialty: requestedSpecialty,
      title: 'Requested specialty context supplied',
      findings: [`Encounter requested for specialty ${requestedSpecialty}`],
      suggestedOrders: [],
      likelyCareGaps: [],
      pathwayHints: [requestedSpecialty],
      recommendationReason: 'Requested specialty should bias pathway ranking.',
      evidence: {
        requestedSpecialty,
      },
    };
  }

  private buildMissingContext(input: {
    patient: any;
    latestMedicalRecord: any;
    latestVitals: any;
    specialtyContributors: any[];
    encounterType?: string;
    chiefComplaint?: string;
  }) {
    const missing: Array<Record<string, any>> = [];

    if (!input.chiefComplaint && !input.latestMedicalRecord?.chief_complaint) {
      missing.push({ field: 'chiefComplaint', reason: 'Encounter chief complaint is missing.' });
    }
    if (!input.encounterType && !input.latestMedicalRecord?.record_type) {
      missing.push({ field: 'encounterType', reason: 'Encounter type is missing.' });
    }
    if (!input.latestVitals) {
      missing.push({ field: 'latestVitals', reason: 'No recent vitals are available for this encounter.' });
    }
    if (!input.patient.emergency_contact_name || !input.patient.emergency_contact_phone) {
      missing.push({ field: 'emergencyContact', reason: 'Emergency contact details are incomplete.' });
    }

    for (const contributor of input.specialtyContributors) {
      if (contributor.module === 'hiv' && !contributor.evidence?.lastViralLoadDate) {
        missing.push({ field: 'hivViralLoad', reason: 'No recent HIV viral load is documented.' });
      }
      if (contributor.module === 'maternity' && !contributor.evidence?.lastAncVisitDate) {
        missing.push({ field: 'maternityAncVisit', reason: 'No recent ANC visit is documented.' });
      }
      if (contributor.module === 'oncology' && !contributor.evidence?.overallStage) {
        missing.push({ field: 'oncologyStage', reason: 'Oncology case stage is not documented.' });
      }
    }

    return missing;
  }

  private buildSuggestedOrders(input: {
    ambientSession: any;
    specialtyContributors: any[];
    smartDefaults: Record<string, any>;
  }) {
    const ambientOrders = this.toJsonValue(input.ambientSession?.ai_suggested_orders, []).map((order: any) => ({
      name: order?.order_name || order?.name || order?.title || 'Ambient suggested order',
      type: order?.order_type || order?.type || 'procedure',
      priority: order?.priority || 'normal',
      rationale: order?.rationale || 'Derived from ambient consultation context.',
      sourceModule: 'ambient',
      raw: order,
    }));

    const contributorOrders = input.specialtyContributors.flatMap((item) =>
      Array.isArray(item?.suggestedOrders) ? item.suggestedOrders : [],
    );

    const smartDefaultPrompts = Object.entries(input.smartDefaults || {}).map(([field, value]: [string, any]) => ({
      name: `Form default: ${field}`,
      type: 'documentation',
      priority: value?.confidence >= 0.95 ? 'normal' : 'low',
      rationale: `Encounter copilot highlighted default field "${field}" from governed smart-defaults context.`,
      sourceModule: 'smart_defaults',
      metadata: value,
    }));

    return this.dedupeByKey([...ambientOrders, ...contributorOrders, ...smartDefaultPrompts], (item) =>
      String(item.name || '').toLowerCase(),
    );
  }

  private buildLikelyCareGaps(careGaps: any[], specialtyContributors: any[]) {
    const contributorCareGaps = specialtyContributors.flatMap((item) =>
      Array.isArray(item?.likelyCareGaps) ? item.likelyCareGaps : [],
    );
    return this.dedupeByKey([...careGaps, ...contributorCareGaps], (item) =>
      `${String(item.gapType || '').toLowerCase()}::${String(item.gapDescription || '').toLowerCase()}`,
    );
  }

  private buildContraindicationSummary(allergies: any[], medications: any[], medicationAlerts: any[]) {
    const severeAllergies = allergies.filter((item) => String(item.severity || '').toLowerCase() === 'severe');
    const allergyConflicts = medications.flatMap((medication) => {
      const medName = String(medication.medicationName || '').toLowerCase();
      return allergies
        .filter((allergy) => medName.includes(String(allergy.allergen || '').toLowerCase()))
        .map((allergy) => ({
          medicationName: medication.medicationName,
          allergen: allergy.allergen,
          severity: allergy.severity,
          reaction: allergy.reaction,
        }));
    });

    return {
      allergyCount: allergies.length,
      severeAllergyCount: severeAllergies.length,
      activeMedicationAlertCount: medicationAlerts.filter((item) => !item.acknowledged).length,
      allergyConflicts,
      activeMedicationAlerts: medicationAlerts
        .filter((item) => !item.acknowledged)
        .slice(0, 5),
      summary:
        severeAllergies.length || allergyConflicts.length || medicationAlerts.some((item) => !item.acknowledged)
          ? 'Encounter includes active contraindication signals that require clinician review before finalizing treatment.'
          : 'No major allergy or active medication-alert contraindication signals were identified from current structured data.',
    };
  }

  private async buildPathwayRecommendations(
    tenantDb: DataSource,
    requestedSpecialty: string | undefined,
    activeProblems: any[],
    specialtyContributors: any[],
    likelyCareGaps: any[],
  ) {
    const repo = tenantDb.getRepository(ClinicalPathway);
    const pathways = await repo.find({ where: { isActive: true } });

    const specialtyHints = new Set(
      [requestedSpecialty, ...specialtyContributors.map((item) => item?.specialty)]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase()),
    );
    const termHints = new Set(
      [
        ...activeProblems.map((item) => item?.description),
        ...specialtyContributors.flatMap((item) => item?.pathwayHints || []),
        ...likelyCareGaps.map((item) => item?.gapType),
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase()),
    );

    const ranked = pathways
      .map((pathway) => {
        const specialty = String(pathway.specialty || '').toLowerCase();
        const condition = String(pathway.condition || '').toLowerCase();
        const matchedHints = Array.from(termHints).filter(
          (hint) => hint.includes(condition) || condition.includes(hint),
        );

        let score = 0;
        if (specialty && specialtyHints.has(specialty)) {
          score += 5;
        }
        if (matchedHints.length > 0) {
          score += 4 + matchedHints.length;
        }
        if (pathway.isDefault) {
          score += 1;
        }

        return {
          pathwayId: pathway.id,
          pathwayCode: pathway.pathwayCode,
          pathwayName: pathway.pathwayName,
          specialty: pathway.specialty,
          condition: pathway.condition,
          score,
          matchedHints,
          recommendationReason:
            matchedHints.length > 0
              ? `Matched encounter hints: ${matchedHints.join(', ')}.`
              : specialty && specialtyHints.has(specialty)
                ? `Matched specialty ${pathway.specialty}.`
                : 'Active pathway available for encounter review.',
          evidence: {
            evidenceLevel: pathway.evidenceLevel ?? null,
            guidelineSource: pathway.guidelineSource ?? null,
            targetPopulation: pathway.targetPopulation ?? null,
          },
        };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.pathwayName.localeCompare(right.pathwayName))
      .slice(0, 3);

    return ranked;
  }

  private buildSummary(
    patient: any,
    specialtyContributors: any[],
    pathwayRecommendations: any[],
    likelyCareGaps: any[],
  ) {
    const contributorSummary = specialtyContributors
      .slice(0, 3)
      .map((item) => item.title)
      .join('; ');
    const pathwaySummary = pathwayRecommendations[0]?.pathwayName
      ? `Top pathway recommendation: ${pathwayRecommendations[0].pathwayName}.`
      : 'No high-confidence pathway recommendation found yet.';
    const careGapSummary = likelyCareGaps.length
      ? `${likelyCareGaps.length} likely care gaps require follow-through.`
      : 'No likely care gaps were identified from current structured context.';

    return [
      `Encounter copilot assembled a treatment view for ${patient.first_name} ${patient.last_name}.`,
      contributorSummary || 'No specialty contributor context was detected.',
      pathwaySummary,
      careGapSummary,
    ].join(' ');
  }

  private calculateConfidenceScore(input: {
    activeProblemCount: number;
    contributorCount: number;
    suggestedOrderCount: number;
    careGapCount: number;
  }) {
    const raw =
      0.45 +
      input.activeProblemCount * 0.03 +
      input.contributorCount * 0.08 +
      input.suggestedOrderCount * 0.02 +
      input.careGapCount * 0.02;
    return Number(Math.min(0.97, raw).toFixed(2));
  }

  private buildCriticalResultFollowupTask(
    repo: Repository<ResultFollowupTask>,
    session: EncounterCopilotSession,
    alert: Record<string, any>,
    actorUserId?: string | null,
  ) {
    const priority = this.mapCriticalAlertPriority(alert.criticalValueType);
    const dueAt = this.offsetDueAt(priority === 'urgent' ? 2 : 8);

    return repo.create({
      encounterCopilotSessionId: session.id,
      patientId: session.patientId,
      appointmentId: session.appointmentId ?? null,
      generatedBy: actorUserId ?? null,
      sourceType: 'critical_result_alert',
      sourceReferenceId: alert.id,
      sourceStatus: alert.status ?? 'pending',
      taskType: 'lab_result_followup',
      taskTitle: `Critical lab follow-up: ${alert.testName || alert.testCode || 'result'}`,
      taskSummary: [
        `${alert.testName || alert.testCode || 'Critical result'} returned ${alert.resultValue || 'an abnormal value'}.`,
        alert.alertMessage || 'Immediate structured follow-up is required before encounter closure.',
      ].join(' '),
      priority,
      status: 'open',
      recommendedAction:
        'Review the critical result, document clinician notification, and convert the finding into executable follow-up orders or reassessment steps.',
      dueAt,
      evidence: {
        labOrderId: alert.labOrderId ?? null,
        testCode: alert.testCode ?? null,
        testName: alert.testName ?? null,
        resultValue: alert.resultValue ?? null,
        criticalValueType: alert.criticalValueType ?? null,
        alertMessage: alert.alertMessage ?? null,
        orderingProviderId: alert.orderingProviderId ?? null,
        sourceCreatedAt: alert.createdAt ?? null,
      },
      governance: {
        governedPath: true,
        workstream: 'MOAS-06',
        sourceKind: 'critical_result_alert',
        generatedAt: new Date().toISOString(),
      },
    });
  }

  private buildRadiologyFollowupTask(
    repo: Repository<ResultFollowupTask>,
    session: EncounterCopilotSession,
    finding: Record<string, any>,
    actorUserId?: string | null,
  ) {
    const priority = this.mapRadiologyPriority(finding);
    const dueAt = this.offsetDueAt(priority === 'urgent' ? 4 : 24);
    const findingLabel = finding.topFinding || `${finding.modality || 'Imaging'} finding`;

    return repo.create({
      encounterCopilotSessionId: session.id,
      patientId: session.patientId,
      appointmentId: session.appointmentId ?? null,
      generatedBy: actorUserId ?? null,
      sourceType: 'radiology_ai_finding',
      sourceReferenceId: finding.id,
      sourceStatus: finding.radiologistReviewed ? 'reviewed' : 'pending_review',
      taskType: 'imaging_result_followup',
      taskTitle: `Imaging follow-up: ${findingLabel}`,
      taskSummary: [
        `${finding.modality || 'Imaging'} AI flagged ${findingLabel}.`,
        finding.radiologistReviewed
          ? 'Radiologist review exists, but follow-up execution still needs to be tracked.'
          : 'Radiologist review or clinical follow-through is still pending.',
      ].join(' '),
      priority,
      status: 'open',
      recommendedAction:
        'Review the imaging result, confirm clinician handoff, and translate the finding into a concrete follow-up bundle or repeat imaging/reassessment plan.',
      dueAt,
      evidence: {
        studyId: finding.studyId ?? null,
        modality: finding.modality ?? null,
        topFinding: finding.topFinding ?? null,
        overallConfidence: finding.overallConfidence ?? null,
        alerted: finding.alerted ?? false,
        radiologistReviewed: finding.radiologistReviewed ?? false,
        radiologistNotes: finding.radiologistNotes ?? null,
        findingCount: Array.isArray(finding.findings) ? finding.findings.length : 0,
        sourceAnalyzedAt: finding.analyzedAt ?? null,
      },
      governance: {
        governedPath: true,
        workstream: 'MOAS-06',
        sourceKind: 'radiology_ai_finding',
        generatedAt: new Date().toISOString(),
      },
    });
  }

  private inferEncounterSpecialty(specialtyContributors: any[]) {
    return specialtyContributors.find((item) => item?.specialty)?.specialty ?? null;
  }

  private mapCriticalAlertPriority(criticalValueType?: string) {
    const normalized = String(criticalValueType || '').toLowerCase();
    if (normalized === 'critical') {
      return 'urgent';
    }
    if (normalized === 'high' || normalized === 'low') {
      return 'high';
    }
    return 'high';
  }

  private mapRadiologyPriority(finding: Record<string, any>) {
    const label = `${finding?.topFinding || ''} ${JSON.stringify(finding?.findings || [])}`.toLowerCase();
    const acuteKeywords = ['pneumothorax', 'hemorrhage', 'bleed', 'stroke', 'fracture', 'mass effect', 'effusion'];
    if (acuteKeywords.some((keyword) => label.includes(keyword))) {
      return 'urgent';
    }
    if (Number(finding?.overallConfidence || 0) >= 0.9 || finding?.alerted) {
      return 'high';
    }
    return 'normal';
  }

  private offsetDueAt(hoursFromNow: number) {
    return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  }

  private priorityRank(priority?: string) {
    switch (String(priority || '').toLowerCase()) {
      case 'urgent':
        return 0;
      case 'high':
        return 1;
      case 'medium':
        return 2;
      default:
        return 3;
    }
  }

  private evaluateProposedOrder(
    order: Record<string, any>,
    context: {
      session: EncounterCopilotSession;
      allergies: any[];
      medications: any[];
      medicationAlerts: any[];
    },
  ) {
    const proposedOrderName = String(
      order?.orderName ?? order?.name ?? order?.title ?? order?.medicationName ?? '',
    ).trim();
    const proposedOrderType = String(
      order?.orderType ?? order?.type ?? order?.category ?? '',
    ).trim() || null;

    const supportingSignals: Array<Record<string, any>> = [];
    const blockingIssues: Array<Record<string, any>> = [];
    const recommendedAlternatives: Array<Record<string, any>> = [];

    let score = 0.5;
    const orderNameLower = proposedOrderName.toLowerCase();
    const suggestedOrders = Array.isArray(context.session.suggestedOrders) ? context.session.suggestedOrders : [];
    const likelyCareGaps = Array.isArray(context.session.likelyCareGaps) ? context.session.likelyCareGaps : [];
    const pathwayRecommendations = Array.isArray(context.session.pathwayRecommendations)
      ? context.session.pathwayRecommendations
      : [];
    const missingContext = Array.isArray(context.session.missingContext) ? context.session.missingContext : [];

    if (!proposedOrderName) {
      blockingIssues.push({
        code: 'missing_order_name',
        severity: 'high',
        message: 'Proposed order must include a name before appropriateness can be reviewed.',
      });
      score -= 0.45;
    }

    const alignedSuggestedOrder = suggestedOrders.find((item: any) =>
      orderNameLower.includes(String(item?.name || '').toLowerCase()) ||
      String(item?.name || '').toLowerCase().includes(orderNameLower),
    );
    if (alignedSuggestedOrder) {
      supportingSignals.push({
        code: 'aligned_with_copilot_suggestion',
        message: `Matches copilot suggestion "${alignedSuggestedOrder.name}".`,
      });
      score += 0.2;
    }

    const alignedCareGap = likelyCareGaps.find((item: any) =>
      `${item?.gapDescription || ''} ${item?.recommendedAction || ''}`.toLowerCase().includes(orderNameLower),
    );
    if (alignedCareGap) {
      supportingSignals.push({
        code: 'aligned_with_care_gap',
        message: `Addresses care gap "${alignedCareGap.gapType || alignedCareGap.gapDescription}".`,
      });
      score += 0.15;
    }

    const alignedPathway = pathwayRecommendations.find((item: any) =>
      `${item?.pathwayName || ''} ${item?.condition || ''}`.toLowerCase().includes(orderNameLower),
    );
    if (alignedPathway) {
      supportingSignals.push({
        code: 'aligned_with_pathway',
        message: `Supports pathway recommendation "${alignedPathway.pathwayName}".`,
      });
      score += 0.1;
    }

    const allergyConflict = context.allergies.find((allergy) =>
      orderNameLower.includes(String(allergy.allergen || '').toLowerCase()),
    );
    if (allergyConflict) {
      blockingIssues.push({
        code: 'allergy_conflict',
        severity: 'critical',
        message: `Order conflicts with recorded allergy "${allergyConflict.allergen}".`,
      });
      score -= 0.5;
    }

    const duplicateMedication = context.medications.find((medication) =>
      orderNameLower === String(medication.medicationName || '').toLowerCase(),
    );
    if (duplicateMedication) {
      blockingIssues.push({
        code: 'duplicate_active_medication',
        severity: 'medium',
        message: `Order duplicates active medication "${duplicateMedication.medicationName}".`,
      });
      score -= 0.2;
      recommendedAlternatives.push({
        type: 'review_current_medication',
        name: duplicateMedication.medicationName,
      });
    }

    if (
      proposedOrderType?.toLowerCase() === 'medication' &&
      context.medicationAlerts.some((alert) => !alert.acknowledged)
    ) {
      blockingIssues.push({
        code: 'active_medication_alert_context',
        severity: 'medium',
        message: 'Patient has active medication alerts that should be reviewed before adding more medication orders.',
      });
      score -= 0.1;
    }

    if (missingContext.some((item: any) => item?.field === 'latestVitals') && proposedOrderType === 'medication') {
      blockingIssues.push({
        code: 'missing_recent_vitals',
        severity: 'medium',
        message: 'Recent vitals are missing; medication appropriateness may need current physiology before finalization.',
      });
      score -= 0.1;
    }

    if (!recommendedAlternatives.length) {
      for (const item of suggestedOrders) {
        if (String(item?.name || '').toLowerCase() !== orderNameLower) {
          recommendedAlternatives.push({
            type: item?.type || 'order',
            name: item?.name,
          });
        }
        if (recommendedAlternatives.length >= 3) {
          break;
        }
      }
    }

    const normalizedScore = Number(Math.max(0, Math.min(0.99, score)).toFixed(2));
    let appropriatenessStatus = 'needs_context';
    if (blockingIssues.some((item) => item.code === 'allergy_conflict')) {
      appropriatenessStatus = 'contraindicated';
    } else if (normalizedScore >= 0.75) {
      appropriatenessStatus = 'recommended';
    } else if (normalizedScore >= 0.5) {
      appropriatenessStatus = 'acceptable_with_caution';
    }

    return {
      proposedOrderName: proposedOrderName || 'Unnamed order',
      proposedOrderType,
      appropriatenessStatus,
      confidenceScore: normalizedScore,
      supportingSignals,
      blockingIssues,
      recommendedAlternatives,
      rationale: this.buildOrderReviewRationale(
        proposedOrderName || 'Unnamed order',
        appropriatenessStatus,
        supportingSignals,
        blockingIssues,
      ),
    };
  }

  private buildOrderReviewRationale(
    orderName: string,
    status: string,
    supportingSignals: Array<Record<string, any>>,
    blockingIssues: Array<Record<string, any>>,
  ) {
    const positives = supportingSignals.map((item) => item.message).join(' ');
    const blockers = blockingIssues.map((item) => item.message).join(' ');
    return [
      `Order review for "${orderName}" resolved to ${status}.`,
      positives || 'No strong positive alignment signals were detected.',
      blockers || 'No blocking issues were detected from current structured context.',
    ].join(' ');
  }

  private collectDiagnosisTerms(activeProblems: any[], latestMedicalRecord: any) {
    const fromProblems = activeProblems.map((item) => item.description).filter(Boolean);
    const fromRecord = this.toJsonValue(latestMedicalRecord?.diagnoses, [])
      .map((item: any) => item?.description || item?.code)
      .filter(Boolean);
    return this.dedupeByKey([...fromProblems, ...fromRecord], (item) => String(item).toLowerCase());
  }

  private dedupeByKey<T>(items: T[], getKey: (item: T) => string) {
    const seen = new Set<string>();
    const deduped: T[] = [];
    for (const item of items) {
      const key = getKey(item);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(item);
    }
    return deduped;
  }

  private toJsonValue<T>(value: any, fallback: T): T {
    if (value === null || value === undefined) {
      return fallback;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    return value as T;
  }

  private daysSince(value: string | Date) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return Number.MAX_SAFE_INTEGER;
    }
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  private calculateAge(value?: string | Date | null) {
    if (!value) {
      return undefined;
    }
    const dob = new Date(value);
    if (Number.isNaN(dob.getTime())) {
      return undefined;
    }
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const birthdayReached =
      now.getMonth() > dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
    if (!birthdayReached) {
      age -= 1;
    }
    return age;
  }
}
