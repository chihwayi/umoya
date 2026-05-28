import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { CdssService } from './cdss.service';
import { SmsService } from './sms.service';
import { ProInterpretationService } from './pro-interpretation.service';
import { 
  getAllQuestionnaires, 
  getQuestionnairesByCategory, 
  searchQuestionnaires, 
  getQuestionnaireByCode 
} from '../data/questionnaire-library';

export interface QuestionnaireQuestion {
  number: number;
  text: string;
  type: 'number' | 'text' | 'choice' | 'scale' | 'boolean';
  required: boolean;
  options?: Array<{ value: string | number; label: string }>;
  min?: number;
  max?: number;
  scoring?: {
    method: 'direct' | 'reverse' | 'weighted';
    weight?: number;
  };
}

export interface AlertRule {
  name: string;
  conditionType: 'score' | 'response' | 'symptom' | 'score_greater_than' | 'score_between' | 'score_less_than';
  conditionValue: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  notifyRoles?: string[];
}

export interface QuestionnaireTemplate {
  code: string;
  name: string;
  description: string;
  category: string;
  version?: string;
  questions: QuestionnaireQuestion[];
  scoring: {
    algorithm: 'sum' | 'average' | 'weighted' | 'custom' | 'direct' | 'reverse';
    minScore: number;
    maxScore: number;
    thresholds?: Array<{
      label: string;
      min: number;
      max: number;
      severity?: 'low' | 'medium' | 'high' | 'critical';
    }>;
  };
  alertRules?: AlertRule[];
}

@Injectable()
export class PatientProService {
  private readonly logger = new Logger(PatientProService.name);

  constructor(
    private readonly notificationsService?: NotificationsService,
    private readonly cdssService?: CdssService,
    private readonly proInterpretationService?: ProInterpretationService,
    private readonly smsService?: SmsService,
  ) {}

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  /**
   * Get available questionnaires for a patient
   */
  async getAvailableQuestionnaires(tenantDb: DataSource, patientId?: string) {
    this.ensureTenantDb(tenantDb);

    const templates = await tenantDb.query(
      `SELECT * FROM questionnaire_templates WHERE is_active = true ORDER BY category, name`,
    );

    // If patient ID provided, also check which ones are pending/completed
    if (patientId) {
      const patientQuestionnaires = await tenantDb.query(
        `SELECT pq.*, qt.code, qt.name, qt.category
         FROM patient_questionnaires pq
         JOIN questionnaire_templates qt ON qt.id = pq.questionnaire_template_id
         WHERE pq.patient_id = $1 AND pq.status IN ('pending', 'in_progress')
         ORDER BY pq.due_date ASC NULLS LAST`,
        [patientId],
      );

      return {
        templates: templates.map((t: any) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          description: t.description,
          category: t.category,
          version: t.version || undefined,
        })),
        pending: patientQuestionnaires,
      };
    }

    return {
      templates: templates.map((t: any) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        description: t.description,
        category: t.category,
        version: t.version || undefined,
      })),
    };
  }

  /**
   * Browse questionnaire library (all available questionnaires from library)
   */
  async browseQuestionnaireLibrary(filters?: {
    category?: string;
    search?: string;
  }) {
    let questionnaires = getAllQuestionnaires();

    // Filter by category
    if (filters?.category) {
      questionnaires = getQuestionnairesByCategory(filters.category);
    }

    // Search
    if (filters?.search) {
      questionnaires = searchQuestionnaires(filters.search);
    }

    return questionnaires.map(q => ({
      code: q.code,
      name: q.name,
      description: q.description,
      category: q.category,
      version: q.version,
      questionCount: q.questions.length,
      minScore: q.scoring.minScore,
      maxScore: q.scoring.maxScore,
    }));
  }

  /**
   * Get questionnaire details from library
   */
  async getQuestionnaireFromLibrary(code: string) {
    const questionnaire = getQuestionnaireByCode(code);
    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire not found in library: ${code}`);
    }
    return questionnaire;
  }

  /**
   * Import questionnaire from library to database
   */
  async importQuestionnaireFromLibrary(
    tenantDb: DataSource,
    code: string,
    options?: { overwrite?: boolean }
  ) {
    this.ensureTenantDb(tenantDb);

    const questionnaire = getQuestionnaireByCode(code);
    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire not found in library: ${code}`);
    }

    // Check if already exists
    const existing = await tenantDb.query(
      `SELECT id FROM questionnaire_templates WHERE code = $1`,
      [code],
    );

    if (existing && existing.length > 0) {
      if (!options?.overwrite) {
        throw new BadRequestException(`Questionnaire ${code} already exists. Use overwrite option to update.`);
      }
      // Update existing
      await tenantDb.query(
        `UPDATE questionnaire_templates 
         SET name = $1, description = $2, category = $3, version = $4, 
             questions = $5, scoring_rules = $6, updated_at = NOW()
         WHERE code = $7`,
        [
          questionnaire.name,
          questionnaire.description,
          questionnaire.category,
          questionnaire.version || '1.0',
          JSON.stringify(questionnaire.questions),
          JSON.stringify(questionnaire.scoring),
          code,
        ],
      );
      return { message: `Questionnaire ${code} updated successfully`, code };
    }

    // Insert new
    await tenantDb.query(
      `INSERT INTO questionnaire_templates (
        code, name, description, category, version, questions, scoring_rules, 
        is_active, is_standard, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, NOW(), NOW())`,
      [
        questionnaire.code,
        questionnaire.name,
        questionnaire.description,
        questionnaire.category,
        questionnaire.version || '1.0',
        JSON.stringify(questionnaire.questions),
        JSON.stringify(questionnaire.scoring),
      ],
    );

    return { message: `Questionnaire ${code} imported successfully`, code };
  }

  /**
   * Assign questionnaire to patient by code (from library or database)
   */
  async assignQuestionnaireByCode(
    tenantDb: DataSource,
    patientId: string,
    questionnaireCode: string,
    options: {
      appointmentId?: string;
      assignedBy?: string;
      dueDate?: string;
      notes?: string;
      autoImport?: boolean; // Auto-import from library if not in database
    } = {},
  ) {
    this.ensureTenantDb(tenantDb);

    // First, try to find in database
    let template = await tenantDb.query(
      `SELECT * FROM questionnaire_templates WHERE code = $1 AND is_active = true`,
      [questionnaireCode],
    );

    // If not found and autoImport is enabled, import from library
    if ((!template || template.length === 0) && options.autoImport) {
      await this.importQuestionnaireFromLibrary(tenantDb, questionnaireCode);
      template = await tenantDb.query(
        `SELECT * FROM questionnaire_templates WHERE code = $1 AND is_active = true`,
        [questionnaireCode],
      );
    }

    if (!template || template.length === 0) {
      throw new NotFoundException(`Questionnaire ${questionnaireCode} not found. Use autoImport option to import from library.`);
    }

    return this.assignQuestionnaire(tenantDb, patientId, template[0].id, options);
  }

  /**
   * Get questionnaire template by ID or code
   */
  async getQuestionnaireTemplate(tenantDb: DataSource, templateIdOrCode: string) {
    this.ensureTenantDb(tenantDb);

    // Check if it's a UUID format (36 characters with dashes)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(templateIdOrCode);

    let template;
    if (isUuid) {
      // If it's a UUID, search by ID
      template = await tenantDb.query(
        `SELECT * FROM questionnaire_templates 
         WHERE id = $1::uuid AND is_active = true`,
        [templateIdOrCode],
      );
    } else {
      // If it's not a UUID, search by code
      template = await tenantDb.query(
        `SELECT * FROM questionnaire_templates 
         WHERE code = $1 AND is_active = true`,
        [templateIdOrCode],
      );
    }

    if (!template || template.length === 0) {
      throw new NotFoundException(`Questionnaire template not found: ${templateIdOrCode}`);
    }

    return template[0];
  }

  /**
   * Assign questionnaire to patient
   */
  async assignQuestionnaire(
    tenantDb: DataSource,
    patientId: string,
    templateId: string,
    options: {
      appointmentId?: string;
      assignedBy?: string;
      dueDate?: string;
      notes?: string;
    } = {},
  ) {
    this.ensureTenantDb(tenantDb);

    // Verify template exists
    const template = await this.getQuestionnaireTemplate(tenantDb, templateId);
    if (!template) {
      throw new NotFoundException('Questionnaire template not found');
    }

    // Check if already assigned and pending
    const existing = await tenantDb.query(
      `SELECT id FROM patient_questionnaires 
       WHERE patient_id = $1 AND questionnaire_template_id = $2 AND status IN ('pending', 'in_progress')`,
      [patientId, template.id],
    );

    if (existing && existing.length > 0) {
      throw new BadRequestException('Questionnaire already assigned and pending');
    }

    const [result] = await tenantDb.query(
      `INSERT INTO patient_questionnaires (
        patient_id, questionnaire_template_id, appointment_id, assigned_by,
        due_date, notes, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW())
      RETURNING *`,
      [
        patientId,
        template.id,
        options.appointmentId || null,
        options.assignedBy || null,
        options.dueDate || null,
        options.notes || null,
      ],
    );

    // Send SMS notification to patient
    try {
      const patient = await tenantDb.query(
        `SELECT first_name, phone FROM patients WHERE id = $1 LIMIT 1`,
        [patientId],
      );
      const phone = patient?.[0]?.phone;
      const name = patient?.[0]?.first_name ?? 'there';
      if (phone && this.smsService) {
        await this.smsService.send(
          phone,
          `MediCore: Hi ${name}, your care team has assigned you a health questionnaire: "${template.name ?? template.code}". Please open the MediCore Patient app to complete it.`,
        );
      }
      this.logger.log(`Questionnaire ${template.code} assigned to patient ${patientId}`);
    } catch (error) {
      this.logger.warn(`Failed to send SMS for questionnaire assignment: ${error.message}`);
    }

    return result;
  }

  /**
   * Get patient questionnaire by ID
   */
  async getPatientQuestionnaire(tenantDb: DataSource, questionnaireId: string, patientId?: string) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT pq.*, qt.code, qt.name, qt.description, qt.category, qt.questions, qt.scoring_rules
                 FROM patient_questionnaires pq
                 JOIN questionnaire_templates qt ON qt.id = pq.questionnaire_template_id
                 WHERE pq.id = $1`;
    const params: any[] = [questionnaireId];

    if (patientId) {
      query += ` AND pq.patient_id = $2`;
      params.push(patientId);
    }

    const [questionnaire] = await tenantDb.query(query, params);

    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire not found: ${questionnaireId}`);
    }

    // Get responses if completed
    if (questionnaire.status === 'completed') {
      const responses = await tenantDb.query(
        `SELECT * FROM questionnaire_responses 
         WHERE patient_questionnaire_id = $1 
         ORDER BY question_number`,
        [questionnaireId],
      );
      questionnaire.responses = responses;
    }

    return questionnaire;
  }

  /**
   * Submit questionnaire responses
   */
  async submitQuestionnaireResponses(
    tenantDb: DataSource,
    questionnaireId: string,
    patientId: string,
    responses: Array<{
      questionNumber: number;
      questionText: string;
      responseValue: string | number;
      responseType: string;
    }>,
  ) {
    this.ensureTenantDb(tenantDb);

    // Get questionnaire - this already validates patient ownership via WHERE clause
    // If patient_id doesn't match, getPatientQuestionnaire will return null and throw NotFoundException
    // So if we get here, the questionnaire belongs to the patient
    const questionnaire = await this.getPatientQuestionnaire(tenantDb, questionnaireId, patientId);

    if (questionnaire.status === 'completed') {
      throw new BadRequestException('Questionnaire already completed');
    }

    // No need to check patient_id again - getPatientQuestionnaire already validated it

    // Get template for validation
    const template = questionnaire;

    // Validate responses
    const questions = template.questions as QuestionnaireQuestion[];
    const submittedQuestionNumbers = new Set(responses.map((r) => r.questionNumber));

    // Check required questions
    const requiredQuestions = questions.filter((q) => q.required);
    for (const q of requiredQuestions) {
      if (!submittedQuestionNumbers.has(q.number)) {
        throw new BadRequestException(`Required question ${q.number} not answered`);
      }
    }

    // Calculate scores
    let totalScore = 0;
    const questionScores: Array<{ questionNumber: number; score: number }> = [];

    for (const response of responses) {
      const question = questions.find((q) => q.number === response.questionNumber);
      if (!question) continue;

      let score = 0;
      if (question.type === 'number' || question.type === 'scale') {
        score = Number(response.responseValue) || 0;
      } else if (question.type === 'choice') {
        // Find option value
        const option = question.options?.find((opt) => opt.value === response.responseValue);
        score = option ? (typeof option.value === 'number' ? option.value : 0) : 0;
      } else if (question.type === 'boolean') {
        score = response.responseValue === 'true' || response.responseValue === 1 ? 1 : 0;
      }

      // Apply scoring method
      if (question.scoring?.method === 'reverse') {
        const maxValue = question.max || 10;
        score = maxValue - score;
      }
      if (question.scoring?.weight) {
        score = score * question.scoring.weight;
      }

      questionScores.push({ questionNumber: response.questionNumber, score });
      totalScore += score;
    }

    // Calculate final score based on algorithm
    let finalScore = totalScore;
    const scoringRules = template.scoring_rules as any;
    if (scoringRules?.algorithm === 'average') {
      finalScore = totalScore / responses.length;
    }

    // Save responses
    await tenantDb.query(`BEGIN`);
    try {
      // Delete existing responses if any
      await tenantDb.query(`DELETE FROM questionnaire_responses WHERE patient_questionnaire_id = $1`, [
        questionnaireId,
      ]);

      // Insert new responses
      for (const response of responses) {
        const questionScore = questionScores.find((qs) => qs.questionNumber === response.questionNumber);
        await tenantDb.query(
          `INSERT INTO questionnaire_responses (
            patient_questionnaire_id, question_number, question_text,
            response_value, response_type, score, answered_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            questionnaireId,
            response.questionNumber,
            response.questionText,
            String(response.responseValue),
            response.responseType,
            questionScore?.score || 0,
          ],
        );
      }

      // Update questionnaire status
      const completionPercentage = Math.round((responses.length / questions.length) * 100);
      await tenantDb.query(
        `UPDATE patient_questionnaires 
         SET status = 'completed', 
             completed_at = NOW(),
             completion_percentage = $1,
             total_score = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [completionPercentage, finalScore, questionnaireId],
      );

      // Check for alerts
      await this.checkAndGenerateAlerts(tenantDb, questionnaireId, patientId, finalScore, template);

      await tenantDb.query(`COMMIT`);

      const interpretation = this.proInterpretationService
        ? this.proInterpretationService.interpret(template.code ?? template.name ?? '', finalScore)
        : undefined;

      return {
        questionnaireId,
        finalScore,
        completionPercentage,
        questionScores,
        interpretation,
      };
    } catch (error) {
      await tenantDb.query(`ROLLBACK`);
      throw error;
    }
  }

  /**
   * Check PRO score and generate alerts if needed
   */
  private async checkAndGenerateAlerts(
    tenantDb: DataSource,
    questionnaireId: string,
    patientId: string,
    score: number,
    template: any,
  ) {
    try {
      // Get alert rules for this questionnaire
      const alertRules = await tenantDb.query(
        `SELECT * FROM pro_alert_rules 
         WHERE questionnaire_template_id = $1 AND is_active = true`,
        [template.id],
      );

      for (const rule of alertRules) {
        const conditionValue = rule.condition_value as any;
        let shouldAlert = false;
        let alertMessage = rule.alert_message || `Alert: ${template.name} score is ${score}`;

        switch (rule.condition_type) {
          case 'score_greater_than':
            shouldAlert = score > conditionValue.threshold;
            break;
          case 'score_less_than':
            shouldAlert = score < conditionValue.threshold;
            break;
          case 'score_between':
            shouldAlert = score >= conditionValue.min && score <= conditionValue.max;
            break;
          case 'score_equals':
            shouldAlert = score === conditionValue.value;
            break;
        }

        if (shouldAlert) {
          // Create alert
          await tenantDb.query(
            `INSERT INTO pro_alerts (
              patient_id, patient_questionnaire_id, alert_rule_id,
              alert_severity, alert_message, score_value, status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
            [patientId, questionnaireId, rule.id, rule.alert_severity, alertMessage, score],
          );

          // Notify care team
          if (rule.notify_roles && rule.notify_roles.length > 0) {
            this.logger.log(
              `PRO Alert generated: ${alertMessage} for patient ${patientId} (severity: ${rule.alert_severity})`,
            );
            try {
              const careTeamMembers = await tenantDb.query(
                `SELECT id FROM users WHERE role = ANY($1) AND is_active = true`,
                [rule.notify_roles],
              );
              if (careTeamMembers.length > 0) {
                const values = careTeamMembers
                  .map((_: any, i: number) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
                  .join(', ');
                const params = careTeamMembers.flatMap((m: any) => [
                  m.id, alertMessage, rule.alert_severity ?? 'info', false,
                ]);
                await tenantDb.query(
                  `INSERT INTO user_workflow_notifications (user_id, message, priority, is_read)
                   VALUES ${values}
                   ON CONFLICT DO NOTHING`,
                  params,
                ).catch(async () => {
                  await tenantDb.query(
                    `CREATE TABLE IF NOT EXISTS user_workflow_notifications (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       user_id UUID NOT NULL,
                       message TEXT NOT NULL,
                       priority VARCHAR(20) NOT NULL DEFAULT 'info',
                       workflow_step_execution_id UUID,
                       is_read BOOLEAN NOT NULL DEFAULT false,
                       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                     )`,
                  );
                });
              }
            } catch (e: any) {
              this.logger.warn(`Failed to notify care team for PRO alert: ${e?.message}`);
            }
          }
        }
      }

      // Also check scoring thresholds from template
      const scoringRules = template.scoring_rules as any;
      if (scoringRules?.thresholds) {
        // Find the matching threshold (only one should match)
        // Use exclusive upper bound to avoid duplicates at boundaries
        const matchingThreshold = scoringRules.thresholds.find((threshold: any) => {
          // For upper bound, use exclusive comparison to avoid boundary conflicts
          // e.g., if threshold is 25-50, score 50 should only match if it's the last threshold
          const isLastThreshold = threshold === scoringRules.thresholds[scoringRules.thresholds.length - 1];
          if (isLastThreshold) {
            return score >= threshold.min && score <= threshold.max;
          } else {
            return score >= threshold.min && score < threshold.max;
          }
        });

        if (matchingThreshold && matchingThreshold.severity) {
          await tenantDb.query(
            `INSERT INTO pro_alerts (
              patient_id, patient_questionnaire_id, alert_severity, alert_message, score_value, status
            ) VALUES ($1, $2, $3, $4, $5, 'active')
            ON CONFLICT DO NOTHING`,
            [
              patientId,
              questionnaireId,
              matchingThreshold.severity,
              `${template.name}: Score ${score.toFixed(0)} indicates ${matchingThreshold.label}`,
              score,
            ],
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to check PRO alerts: ${error.message}`);
      // Don't fail the submission if alert generation fails
    }
  }

  /**
   * Get PRO alerts for a patient
   */
  async getPatientProAlerts(tenantDb: DataSource, patientId: string, status?: 'active' | 'acknowledged' | 'resolved' | 'dismissed') {
    this.ensureTenantDb(tenantDb);

    try {
      let query = `
        SELECT 
          pa.*,
          qt.code as questionnaire_code,
          qt.name as questionnaire_name,
          pq.completed_at,
          pq.total_score
        FROM pro_alerts pa
        JOIN patient_questionnaires pq ON pq.id = pa.patient_questionnaire_id
        JOIN questionnaire_templates qt ON qt.id = pq.questionnaire_template_id
        WHERE pa.patient_id = $1
      `;
      const params: any[] = [patientId];

      if (status) {
        query += ` AND pa.status = $2`;
        params.push(status);
      } else {
        query += ` AND pa.status = 'active'`;
      }

      query += ` ORDER BY pa.created_at DESC LIMIT 20`;

      return await tenantDb.query(query, params);
    } catch (error: any) {
      this.logger.error(`Error fetching PRO alerts: ${error.message}`);
      return [];
    }
  }

  /**
   * Get patient questionnaire history
   */
  async getPatientQuestionnaireHistory(tenantDb: DataSource, patientId: string, filters?: { limit?: number; category?: string }) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT pq.*, qt.code, qt.name, qt.category,
                        (SELECT COUNT(*) FROM questionnaire_responses qr WHERE qr.patient_questionnaire_id = pq.id) as response_count,
                        COALESCE(pq.total_score, (SELECT SUM(score) FROM questionnaire_responses qr WHERE qr.patient_questionnaire_id = pq.id)) as total_score
                 FROM patient_questionnaires pq
                 JOIN questionnaire_templates qt ON qt.id = pq.questionnaire_template_id
                 WHERE pq.patient_id = $1 AND pq.status = 'completed'`;
    const params: any[] = [patientId];

    if (filters?.category) {
      query += ` AND qt.category = $2`;
      params.push(filters.category);
    }

    query += ` ORDER BY pq.completed_at DESC NULLS LAST, pq.assigned_at DESC`;

    if (filters?.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(filters.limit);
    }

    const questionnaires = await tenantDb.query(query, params);

    return questionnaires;
  }

  /**
   * Get pending questionnaires for patient
   */
  async getPendingQuestionnaires(tenantDb: DataSource, patientId: string) {
    this.ensureTenantDb(tenantDb);

    this.logger.debug(`getPendingQuestionnaires: Querying for patientId: ${patientId}`);

    const questionnaires = await tenantDb.query(
      `SELECT pq.*, qt.code, qt.name, qt.description, qt.category, qt.questions
       FROM patient_questionnaires pq
       JOIN questionnaire_templates qt ON qt.id = pq.questionnaire_template_id
       WHERE pq.patient_id = $1 AND pq.status IN ('pending', 'in_progress')
       ORDER BY pq.assigned_at DESC, pq.due_date ASC NULLS LAST`,
      [patientId],
    );

    this.logger.debug(`getPendingQuestionnaires: Found ${questionnaires?.length || 0} questionnaires for patientId: ${patientId}`);

    return questionnaires;
  }

  /**
   * Create a custom questionnaire template
   */
  async createQuestionnaireTemplate(
    tenantDb: DataSource,
    templateData: QuestionnaireTemplate,
    createdBy?: string,
  ) {
    this.ensureTenantDb(tenantDb);

    // Validate code is unique
    const existing = await tenantDb.query(
      `SELECT id FROM questionnaire_templates WHERE code = $1`,
      [templateData.code],
    );

    if (existing && existing.length > 0) {
      throw new BadRequestException(`Questionnaire with code "${templateData.code}" already exists`);
    }

    // Validate questions
    if (!templateData.questions || templateData.questions.length === 0) {
      throw new BadRequestException('Questionnaire must have at least one question');
    }

    // Insert template
    const result = await tenantDb.query(
      `INSERT INTO questionnaire_templates (
        code, name, description, category, version, questions, scoring_rules, 
        is_active, is_standard, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, false, $8, NOW(), NOW())
      RETURNING *`,
      [
        templateData.code,
        templateData.name,
        templateData.description,
        templateData.category,
        templateData.version || '1.0',
        JSON.stringify(templateData.questions),
        JSON.stringify(templateData.scoring),
        createdBy || null,
      ],
    );

    return result[0];
  }

  /**
   * Update a questionnaire template
   */
  async updateQuestionnaireTemplate(
    tenantDb: DataSource,
    templateId: string,
    updates: Partial<QuestionnaireTemplate>,
  ) {
    this.ensureTenantDb(tenantDb);

    const existing = await tenantDb.query(
      `SELECT * FROM questionnaire_templates WHERE id = $1`,
      [templateId],
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException('Questionnaire template not found');
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description) {
      updateFields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.category) {
      updateFields.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.version) {
      updateFields.push(`version = $${paramIndex++}`);
      values.push(updates.version);
    }
    if (updates.questions) {
      updateFields.push(`questions = $${paramIndex++}`);
      values.push(JSON.stringify(updates.questions));
    }
    if (updates.scoring) {
      updateFields.push(`scoring_rules = $${paramIndex++}`);
      values.push(JSON.stringify(updates.scoring));
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(templateId);

    const result = await tenantDb.query(
      `UPDATE questionnaire_templates 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values,
    );

    return result[0];
  }

  /**
   * Delete a questionnaire template (soft delete by setting is_active = false)
   */
  async deleteQuestionnaireTemplate(tenantDb: DataSource, templateId: string) {
    this.ensureTenantDb(tenantDb);

    const existing = await tenantDb.query(
      `SELECT * FROM questionnaire_templates WHERE id = $1`,
      [templateId],
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException('Questionnaire template not found');
    }

    // Check if it's a standard questionnaire
    if (existing[0].is_standard) {
      throw new BadRequestException('Cannot delete standard questionnaires');
    }

    // Soft delete
    await tenantDb.query(
      `UPDATE questionnaire_templates SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [templateId],
    );

    return { message: 'Questionnaire template deleted successfully' };
  }

  /**
   * Initialize standard questionnaires (PHQ-9, GAD-7, etc.)
   */
  async initializeStandardQuestionnaires(tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    // Use questionnaires from the library instead of hard-coded ones
    const standardQuestionnaires = getAllQuestionnaires();

    for (const q of standardQuestionnaires) {
      const qAny = q as any; // Allow access to alertRules
      // Check if already exists
      const existing = await tenantDb.query(`SELECT id FROM questionnaire_templates WHERE code = $1`, [q.code]);

      if (existing && existing.length > 0) {
        this.logger.log(`Questionnaire ${q.code} already exists, skipping`);
        continue;
      }

      // Insert template
      await tenantDb.query(
        `INSERT INTO questionnaire_templates (
          code, name, description, category, version, is_active, is_standard,
          scoring_algorithm, min_score, max_score, questions, scoring_rules, alert_rules
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          q.code,
          q.name,
          q.description,
          q.category,
          q.version || '1.0',
          true,
          true,
          q.scoring.algorithm,
          q.scoring.minScore,
          q.scoring.maxScore,
          JSON.stringify(q.questions),
          JSON.stringify(q.scoring),
          JSON.stringify(qAny.alertRules || []),
        ],
      );

      // Create default alert rules
      if (qAny.alertRules && qAny.alertRules.length > 0) {
        const [template] = await tenantDb.query(`SELECT id FROM questionnaire_templates WHERE code = $1`, [q.code]);
        for (const alertRule of qAny.alertRules) {
          await tenantDb.query(
            `INSERT INTO pro_alert_rules (
              questionnaire_template_id, rule_name, condition_type, condition_value,
              alert_severity, alert_message, notify_roles, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              template.id,
              alertRule.name,
              alertRule.conditionType,
              JSON.stringify(alertRule.conditionValue),
              alertRule.severity,
              alertRule.message,
              alertRule.notifyRoles || ['doctor', 'nurse'],
              true,
            ],
          );
        }
      }

      this.logger.log(`Initialized standard questionnaire: ${q.code}`);
    }
  }

  /**
   * Get standard questionnaire definitions
   */
  private getStandardQuestionnaires(): Array<QuestionnaireTemplate & { alertRules?: any[] }> {
    return [
      // PHQ-9: Patient Health Questionnaire-9 (Depression)
      {
        code: 'PHQ9',
        name: 'Patient Health Questionnaire-9',
        description: '9-item depression screening questionnaire',
        category: 'mental_health',
        version: '1.0',
        questions: [
          {
            number: 1,
            text: 'Little interest or pleasure in doing things',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 2,
            text: 'Feeling down, depressed, or hopeless',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 3,
            text: 'Trouble falling or staying asleep, or sleeping too much',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 4,
            text: 'Feeling tired or having little energy',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 5,
            text: 'Poor appetite or overeating',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 6,
            text: 'Feeling bad about yourself or that you are a failure or have let yourself or your family down',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 7,
            text: 'Trouble concentrating on things, such as reading the newspaper or watching television',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 8,
            text: 'Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 9,
            text: 'Thoughts that you would be better off dead, or of hurting yourself',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
        ],
        scoring: {
          algorithm: 'sum',
          minScore: 0,
          maxScore: 27,
          thresholds: [
            { label: 'Minimal', min: 0, max: 4, severity: 'low' },
            { label: 'Mild', min: 5, max: 9, severity: 'medium' },
            { label: 'Moderate', min: 10, max: 14, severity: 'high' },
            { label: 'Moderately Severe', min: 15, max: 19, severity: 'high' },
            { label: 'Severe', min: 20, max: 27, severity: 'critical' },
          ],
        },
        alertRules: [
          {
            name: 'Severe Depression Alert',
            conditionType: 'score_greater_than',
            conditionValue: { threshold: 19 },
            severity: 'critical',
            message: 'PHQ-9 score indicates severe depression - immediate clinical attention recommended',
            notifyRoles: ['doctor', 'nurse'],
          },
          {
            name: 'Moderate Depression Alert',
            conditionType: 'score_between',
            conditionValue: { min: 10, max: 19 },
            severity: 'high',
            message: 'PHQ-9 score indicates moderate to moderately severe depression',
            notifyRoles: ['doctor'],
          },
        ],
      },
      // GAD-7: Generalized Anxiety Disorder-7
      {
        code: 'GAD7',
        name: 'Generalized Anxiety Disorder-7',
        description: '7-item anxiety screening questionnaire',
        category: 'mental_health',
        version: '1.0',
        questions: [
          {
            number: 1,
            text: 'Feeling nervous, anxious, or on edge',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 2,
            text: 'Not being able to stop or control worrying',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 3,
            text: 'Worrying too much about different things',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 4,
            text: 'Trouble relaxing',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 5,
            text: 'Being so restless that it is hard to sit still',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 6,
            text: 'Becoming easily annoyed or irritable',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 7,
            text: 'Feeling afraid, as if something awful might happen',
            type: 'scale',
            required: true,
            options: [
              { value: 0, label: 'Not at all' },
              { value: 1, label: 'Several days' },
              { value: 2, label: 'More than half the days' },
              { value: 3, label: 'Nearly every day' },
            ],
            scoring: { method: 'direct' },
          },
        ],
        scoring: {
          algorithm: 'sum',
          minScore: 0,
          maxScore: 21,
          thresholds: [
            { label: 'Minimal', min: 0, max: 4, severity: 'low' },
            { label: 'Mild', min: 5, max: 9, severity: 'medium' },
            { label: 'Moderate', min: 10, max: 14, severity: 'high' },
            { label: 'Severe', min: 15, max: 21, severity: 'critical' },
          ],
        },
        alertRules: [
          {
            name: 'Severe Anxiety Alert',
            conditionType: 'score_greater_than',
            conditionValue: { threshold: 14 },
            severity: 'critical',
            message: 'GAD-7 score indicates severe anxiety - immediate clinical attention recommended',
            notifyRoles: ['doctor', 'nurse'],
          },
        ],
      },
      // Pain Scale (NRS 0-10)
      {
        code: 'PAIN_SCALE',
        name: 'Pain Scale (NRS 0-10)',
        description: 'Numeric Rating Scale for pain assessment',
        category: 'symptom_tracking',
        version: '1.0',
        questions: [
          {
            number: 1,
            text: 'On a scale of 0 to 10, where 0 is no pain and 10 is the worst pain imaginable, what is your current pain level?',
            type: 'scale',
            required: true,
            min: 0,
            max: 10,
            scoring: { method: 'direct' },
          },
        ],
        scoring: {
          algorithm: 'sum',
          minScore: 0,
          maxScore: 10,
          thresholds: [
            { label: 'No Pain', min: 0, max: 0, severity: 'low' },
            { label: 'Mild', min: 1, max: 3, severity: 'low' },
            { label: 'Moderate', min: 4, max: 6, severity: 'medium' },
            { label: 'Severe', min: 7, max: 8, severity: 'high' },
            { label: 'Very Severe', min: 9, max: 10, severity: 'critical' },
          ],
        },
        alertRules: [
          {
            name: 'Severe Pain Alert',
            conditionType: 'score_greater_than',
            conditionValue: { threshold: 8 },
            severity: 'critical',
            message: 'Pain level is severe (8-10) - immediate attention may be needed',
            notifyRoles: ['doctor', 'nurse'],
          },
        ],
      },
      // PROMIS-29 (Simplified - 7 domains, 4 questions each = 28 questions + 1 pain intensity)
      {
        code: 'PROMIS29',
        name: 'PROMIS-29 Profile v2.1',
        description: 'Patient-Reported Outcomes Measurement Information System - 29 item profile',
        category: 'quality_of_life',
        version: '2.1',
        questions: [
          // Physical Function (4 questions)
          {
            number: 1,
            text: 'Are you able to do chores such as vacuuming or yard work?',
            type: 'scale',
            required: true,
            options: [
              { value: 5, label: 'Without any difficulty' },
              { value: 4, label: 'With a little difficulty' },
              { value: 3, label: 'With some difficulty' },
              { value: 2, label: 'With much difficulty' },
              { value: 1, label: 'Unable to do' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 2,
            text: 'Are you able to go up and down stairs at a normal pace?',
            type: 'scale',
            required: true,
            options: [
              { value: 5, label: 'Without any difficulty' },
              { value: 4, label: 'With a little difficulty' },
              { value: 3, label: 'With some difficulty' },
              { value: 2, label: 'With much difficulty' },
              { value: 1, label: 'Unable to do' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 3,
            text: 'Are you able to go for a walk of at least 15 minutes?',
            type: 'scale',
            required: true,
            options: [
              { value: 5, label: 'Without any difficulty' },
              { value: 4, label: 'With a little difficulty' },
              { value: 3, label: 'With some difficulty' },
              { value: 2, label: 'With much difficulty' },
              { value: 1, label: 'Unable to do' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 4,
            text: 'Are you able to run errands and shop?',
            type: 'scale',
            required: true,
            options: [
              { value: 5, label: 'Without any difficulty' },
              { value: 4, label: 'With a little difficulty' },
              { value: 3, label: 'With some difficulty' },
              { value: 2, label: 'With much difficulty' },
              { value: 1, label: 'Unable to do' },
            ],
            scoring: { method: 'direct' },
          },
          // Anxiety (4 questions)
          {
            number: 5,
            text: 'In the past 7 days, I felt fearful',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 6,
            text: 'In the past 7 days, I found it hard to focus on anything other than my anxiety',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 7,
            text: 'In the past 7 days, my worries overwhelmed me',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 8,
            text: 'In the past 7 days, I felt uneasy',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          // Depression (4 questions)
          {
            number: 9,
            text: 'In the past 7 days, I felt worthless',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 10,
            text: 'In the past 7 days, I felt helpless',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 11,
            text: 'In the past 7 days, I felt depressed',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 12,
            text: 'In the past 7 days, I felt hopeless',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          // Fatigue (4 questions)
          {
            number: 13,
            text: 'In the past 7 days, I felt fatigued',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 14,
            text: 'In the past 7 days, I had trouble starting things because I am tired',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 15,
            text: 'In the past 7 days, I had trouble finishing things because I am tired',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 16,
            text: 'In the past 7 days, I have been too tired to think clearly',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          // Sleep Disturbance (4 questions)
          {
            number: 17,
            text: 'In the past 7 days, my sleep quality was',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Very poor' },
              { value: 2, label: 'Poor' },
              { value: 3, label: 'Fair' },
              { value: 4, label: 'Good' },
              { value: 5, label: 'Very good' },
            ],
            scoring: { method: 'reverse' }, // Reverse scored
          },
          {
            number: 18,
            text: 'In the past 7 days, I had a problem with my sleep',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Not at all' },
              { value: 2, label: 'A little bit' },
              { value: 3, label: 'Somewhat' },
              { value: 4, label: 'Quite a bit' },
              { value: 5, label: 'Very much' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 19,
            text: 'In the past 7 days, I had trouble falling asleep',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Not at all' },
              { value: 2, label: 'A little bit' },
              { value: 3, label: 'Somewhat' },
              { value: 4, label: 'Quite a bit' },
              { value: 5, label: 'Very much' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 20,
            text: 'In the past 7 days, I had trouble staying asleep',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Not at all' },
              { value: 2, label: 'A little bit' },
              { value: 3, label: 'Somewhat' },
              { value: 4, label: 'Quite a bit' },
              { value: 5, label: 'Very much' },
            ],
            scoring: { method: 'direct' },
          },
          // Ability to Participate in Social Roles (4 questions)
          {
            number: 21,
            text: 'In the past 7 days, I have trouble doing all my regular leisure activities with others',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 22,
            text: 'In the past 7 days, I have trouble doing all of my family activities',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 23,
            text: 'In the past 7 days, I have trouble doing all my work (include work at home)',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 24,
            text: 'In the past 7 days, I have trouble doing all my usual activities with friends',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Never' },
              { value: 2, label: 'Rarely' },
              { value: 3, label: 'Sometimes' },
              { value: 4, label: 'Often' },
              { value: 5, label: 'Always' },
            ],
            scoring: { method: 'direct' },
          },
          // Pain Interference (4 questions)
          {
            number: 25,
            text: 'In the past 7 days, how much did pain interfere with your day-to-day activities?',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Not at all' },
              { value: 2, label: 'A little bit' },
              { value: 3, label: 'Somewhat' },
              { value: 4, label: 'Quite a bit' },
              { value: 5, label: 'Very much' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 26,
            text: 'In the past 7 days, how much did pain interfere with your work around the home?',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Not at all' },
              { value: 2, label: 'A little bit' },
              { value: 3, label: 'Somewhat' },
              { value: 4, label: 'Quite a bit' },
              { value: 5, label: 'Very much' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 27,
            text: 'In the past 7 days, how much did pain interfere with your ability to participate in social activities?',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Not at all' },
              { value: 2, label: 'A little bit' },
              { value: 3, label: 'Somewhat' },
              { value: 4, label: 'Quite a bit' },
              { value: 5, label: 'Very much' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 28,
            text: 'In the past 7 days, how much did pain interfere with your household chores?',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Not at all' },
              { value: 2, label: 'A little bit' },
              { value: 3, label: 'Somewhat' },
              { value: 4, label: 'Quite a bit' },
              { value: 5, label: 'Very much' },
            ],
            scoring: { method: 'direct' },
          },
          // Pain Intensity (1 question)
          {
            number: 29,
            text: 'In the past 7 days, what is your average pain level? (0 = no pain, 10 = worst pain imaginable)',
            type: 'scale',
            required: true,
            min: 0,
            max: 10,
            scoring: { method: 'direct' },
          },
        ],
        scoring: {
          algorithm: 'average',
          minScore: 1,
          maxScore: 5,
          thresholds: [
            { label: 'Excellent', min: 1, max: 1.5, severity: 'low' },
            { label: 'Good', min: 1.5, max: 2.5, severity: 'low' },
            { label: 'Fair', min: 2.5, max: 3.5, severity: 'medium' },
            { label: 'Poor', min: 3.5, max: 4.5, severity: 'high' },
            { label: 'Very Poor', min: 4.5, max: 5, severity: 'critical' },
          ],
        },
        alertRules: [],
      },
      // Diabetes Distress Scale (DDS) - Simplified 4-item version
      {
        code: 'DDS',
        name: 'Diabetes Distress Scale (4-item)',
        description: 'Screening for diabetes-related emotional distress',
        category: 'disease_specific',
        version: '1.0',
        questions: [
          {
            number: 1,
            text: 'Feeling that diabetes is taking up too much of my mental and physical energy every day',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Not a problem' },
              { value: 2, label: 'A slight problem' },
              { value: 3, label: 'A moderate problem' },
              { value: 4, label: 'A somewhat serious problem' },
              { value: 5, label: 'A serious problem' },
              { value: 6, label: 'A very serious problem' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 2,
            text: 'Feeling that I am often failing with my diabetes regimen',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Not a problem' },
              { value: 2, label: 'A slight problem' },
              { value: 3, label: 'A moderate problem' },
              { value: 4, label: 'A somewhat serious problem' },
              { value: 5, label: 'A serious problem' },
              { value: 6, label: 'A very serious problem' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 3,
            text: 'Feeling that diabetes controls my life',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Not a problem' },
              { value: 2, label: 'A slight problem' },
              { value: 3, label: 'A moderate problem' },
              { value: 4, label: 'A somewhat serious problem' },
              { value: 5, label: 'A serious problem' },
              { value: 6, label: 'A very serious problem' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 4,
            text: 'Feeling angry, scared, and/or depressed when I think about living with diabetes',
            type: 'scale',
            required: true,
            options: [
              { value: 1, label: 'Not a problem' },
              { value: 2, label: 'A slight problem' },
              { value: 3, label: 'A moderate problem' },
              { value: 4, label: 'A somewhat serious problem' },
              { value: 5, label: 'A serious problem' },
              { value: 6, label: 'A very serious problem' },
            ],
            scoring: { method: 'direct' },
          },
        ],
        scoring: {
          algorithm: 'average',
          minScore: 1,
          maxScore: 6,
          thresholds: [
            { label: 'Little or no distress', min: 1, max: 2, severity: 'low' },
            { label: 'Moderate distress', min: 2, max: 3, severity: 'medium' },
            { label: 'High distress', min: 3, max: 4, severity: 'high' },
            { label: 'Very high distress', min: 4, max: 6, severity: 'critical' },
          ],
        },
        alertRules: [
          {
            name: 'High Diabetes Distress Alert',
            conditionType: 'score_greater_than',
            conditionValue: { threshold: 3 },
            severity: 'high',
            message: 'DDS score indicates high diabetes distress - patient may need additional support',
            notifyRoles: ['doctor', 'nurse'],
          },
        ],
      },
      // Kansas City Cardiomyopathy Questionnaire (KCCQ) - Simplified 6-item version
      {
        code: 'KCCQ',
        name: 'Kansas City Cardiomyopathy Questionnaire (6-item)',
        description: 'Heart failure-specific health status assessment',
        category: 'disease_specific',
        version: '1.0',
        questions: [
          {
            number: 1,
            text: 'Over the past 2 weeks, how much has your heart failure limited your enjoyment of life?',
            type: 'scale',
            required: true,
            options: [
              { value: 100, label: 'It has not limited my enjoyment of life at all' },
              { value: 75, label: 'It has extremely limited my enjoyment of life' },
              { value: 50, label: 'It has moderately limited my enjoyment of life' },
              { value: 25, label: 'It has very much limited my enjoyment of life' },
              { value: 0, label: 'It has completely limited my enjoyment of life' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 2,
            text: 'Over the past 2 weeks, how much has your heart failure limited your ability to work or do household chores?',
            type: 'scale',
            required: true,
            options: [
              { value: 100, label: 'It has not limited me at all' },
              { value: 75, label: 'It has extremely limited me' },
              { value: 50, label: 'It has moderately limited me' },
              { value: 25, label: 'It has very much limited me' },
              { value: 0, label: 'It has completely limited me' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 3,
            text: 'Over the past 2 weeks, how much has your heart failure limited your ability to do things for fun or recreation?',
            type: 'scale',
            required: true,
            options: [
              { value: 100, label: 'It has not limited me at all' },
              { value: 75, label: 'It has extremely limited me' },
              { value: 50, label: 'It has moderately limited me' },
              { value: 25, label: 'It has very much limited me' },
              { value: 0, label: 'It has completely limited me' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 4,
            text: 'Over the past 2 weeks, how much has your heart failure limited your ability to visit with family or friends?',
            type: 'scale',
            required: true,
            options: [
              { value: 100, label: 'It has not limited me at all' },
              { value: 75, label: 'It has extremely limited me' },
              { value: 50, label: 'It has moderately limited me' },
              { value: 25, label: 'It has very much limited me' },
              { value: 0, label: 'It has completely limited me' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 5,
            text: 'Over the past 2 weeks, how much has your heart failure limited your ability to dress yourself, bathe, or use the toilet?',
            type: 'scale',
            required: true,
            options: [
              { value: 100, label: 'It has not limited me at all' },
              { value: 75, label: 'It has extremely limited me' },
              { value: 50, label: 'It has moderately limited me' },
              { value: 25, label: 'It has very much limited me' },
              { value: 0, label: 'It has completely limited me' },
            ],
            scoring: { method: 'direct' },
          },
          {
            number: 6,
            text: 'Over the past 2 weeks, how much has your heart failure limited your ability to do yard work, housework, or carry groceries?',
            type: 'scale',
            required: true,
            options: [
              { value: 100, label: 'It has not limited me at all' },
              { value: 75, label: 'It has extremely limited me' },
              { value: 50, label: 'It has moderately limited me' },
              { value: 25, label: 'It has very much limited me' },
              { value: 0, label: 'It has completely limited me' },
            ],
            scoring: { method: 'direct' },
          },
        ],
        scoring: {
          algorithm: 'average',
          minScore: 0,
          maxScore: 100,
          thresholds: [
            { label: 'Excellent', min: 75, max: 100, severity: 'low' },
            { label: 'Good', min: 50, max: 75, severity: 'low' },
            { label: 'Fair', min: 25, max: 50, severity: 'medium' },
            { label: 'Poor', min: 0, max: 25, severity: 'high' },
          ],
        },
        alertRules: [
          {
            name: 'Poor Heart Failure Status Alert',
            conditionType: 'score_less_than',
            conditionValue: { threshold: 25 },
            severity: 'high',
            message: 'KCCQ score indicates poor heart failure status - patient may need intervention',
            notifyRoles: ['doctor'],
          },
        ],
      },
    ];
  }

  /**
   * Auto-assign pre-visit questionnaires based on appointment type and patient conditions
   */
  async autoAssignPreVisitQuestionnaires(
    tenantDb: DataSource,
    patientId: string,
    appointmentId: string,
    appointmentType: string,
    appointmentDate: string,
  ) {
    this.ensureTenantDb(tenantDb);
    this.logger.log(`Auto-assigning pre-visit questionnaires for appointment ${appointmentId}`);

    const assignedQuestionnaires: string[] = [];

    try {
      // Get patient's chronic conditions to determine relevant questionnaires
      const diabetesRegistry = await tenantDb.query(
        `SELECT id FROM diabetes_registry WHERE patient_id = $1`,
        [patientId],
      );
      const hasDiabetes = diabetesRegistry && diabetesRegistry.length > 0;

      // Check for cardiology encounters
      const cardiologyEncounters = await tenantDb.query(
        `SELECT id FROM cardiology_encounters WHERE patient_id = $1 LIMIT 1`,
        [patientId],
      );
      const hasCardiacCondition = cardiologyEncounters && cardiologyEncounters.length > 0;

      // Map appointment types to questionnaires
      const questionnaireMapping: Record<string, string[]> = {
        consultation: ['PHQ9', 'GAD7'], // General mental health screening
        'follow-up': ['PHQ9'], // Quick depression check
        'mental-health': ['PHQ9', 'GAD7', 'PROMIS29'], // Comprehensive mental health
        'diabetes': hasDiabetes ? ['PHQ9', 'DDS'] : ['PHQ9'], // Diabetes-specific if patient has diabetes
        'cardiology': hasCardiacCondition ? ['PHQ9', 'KCCQ'] : ['PHQ9'], // Cardiac-specific if patient has cardiac condition
        'chronic-disease': ['PHQ9', 'GAD7', 'PROMIS29'], // Comprehensive for chronic disease management
      };

      // Get questionnaires to assign based on appointment type
      const questionnairesToAssign = questionnaireMapping[appointmentType.toLowerCase()] || ['PHQ9'];

      // Calculate due date (1 day before appointment)
      const appointmentDateObj = new Date(appointmentDate);
      const dueDate = new Date(appointmentDateObj);
      dueDate.setDate(dueDate.getDate() - 1);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      // Assign each questionnaire
      for (const questionnaireCode of questionnairesToAssign) {
        try {
          // Get template by code
          const [template] = await tenantDb.query(
            `SELECT id FROM questionnaire_templates WHERE code = $1 AND is_active = true`,
            [questionnaireCode],
          );

          if (!template) {
            this.logger.warn(`Questionnaire template ${questionnaireCode} not found, skipping`);
            continue;
          }

          // Check if already assigned for this appointment
          const existing = await tenantDb.query(
            `SELECT id FROM patient_questionnaires 
             WHERE patient_id = $1 AND questionnaire_template_id = $2 AND appointment_id = $3 AND status IN ('pending', 'in_progress')`,
            [patientId, template.id, appointmentId],
          );

          if (existing && existing.length > 0) {
            this.logger.log(`Questionnaire ${questionnaireCode} already assigned for this appointment`);
            continue;
          }

          // Assign questionnaire
          await this.assignQuestionnaire(tenantDb, patientId, template.id, {
            appointmentId,
            assignedBy: 'system',
            dueDate: dueDateStr,
            notes: `Pre-visit questionnaire for ${appointmentType} appointment`,
          });

          assignedQuestionnaires.push(questionnaireCode);
          this.logger.log(`Assigned questionnaire ${questionnaireCode} for appointment ${appointmentId}`);
        } catch (error: any) {
          this.logger.error(`Failed to assign questionnaire ${questionnaireCode}:`, error.message);
          // Continue with other questionnaires even if one fails
        }
      }

      return {
        appointmentId,
        assignedQuestionnaires,
        count: assignedQuestionnaires.length,
      };
    } catch (error: any) {
      this.logger.error(`Error auto-assigning pre-visit questionnaires:`, error);
      throw error;
    }
  }

  /**
   * Get pre-visit questionnaires for an appointment
   */
  async getPreVisitQuestionnaires(tenantDb: DataSource, appointmentId: string, patientId: string) {
    this.ensureTenantDb(tenantDb);

    const questionnaires = await tenantDb.query(
      `SELECT 
        pq.id,
        pq.status,
        pq.due_date,
        pq.assigned_at,
        pq.completed_at,
        pq.completion_percentage,
        pq.total_score,
        qt.code,
        qt.name,
        qt.description,
        qt.category
      FROM patient_questionnaires pq
      JOIN questionnaire_templates qt ON qt.id = pq.questionnaire_template_id
      WHERE pq.appointment_id = $1 AND pq.patient_id = $2
      ORDER BY pq.assigned_at DESC`,
      [appointmentId, patientId],
    );

    return questionnaires.map((q: any) => ({
      id: q.id,
      code: q.code,
      name: q.name,
      description: q.description,
      category: q.category,
      status: q.status,
      dueDate: q.due_date,
      assignedAt: q.assigned_at,
      completedAt: q.completed_at,
      completionPercentage: q.completion_percentage,
      totalScore: q.total_score,
    }));
  }

  /**
   * Get PRO responses for display in doctor view
   */
  async getProResponsesForAppointment(tenantDb: DataSource, appointmentId: string, patientId: string) {
    this.ensureTenantDb(tenantDb);

    const questionnaires = await this.getPreVisitQuestionnaires(tenantDb, appointmentId, patientId);

    // Get detailed responses for completed questionnaires
    const questionnairesWithResponses = await Promise.all(
      questionnaires.map(async (q: any) => {
        if (q.status === 'completed') {
          const responses = await tenantDb.query(
            `SELECT 
              qr.question_number,
              qr.question_text,
              qr.response_value,
              qr.response_type,
              qr.score,
              qr.answered_at
            FROM questionnaire_responses qr
            WHERE qr.patient_questionnaire_id = $1
            ORDER BY qr.question_number`,
            [q.id],
          );

          return {
            ...q,
            responses: responses.map((r: any) => ({
              questionNumber: r.question_number,
              questionText: r.question_text,
              responseValue: r.response_value,
              responseType: r.response_type,
              score: r.score,
              answeredAt: r.answered_at,
            })),
          };
        }
        return q;
      }),
    );

    return questionnairesWithResponses;
  }

  /**
   * Get PRO trends for a patient (for patient chart)
   */
  async getProTrends(tenantDb: DataSource, patientId: string, questionnaireCode?: string, limit: number = 10) {
    this.ensureTenantDb(tenantDb);

    try {
      // Check if tables exist
      const tableCheck = await tenantDb.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'patient_questionnaires'
        )
      `);
      
      if (!tableCheck[0]?.exists) {
        this.logger.warn('PRO tables not found in tenant database. Returning empty trends.');
        return [];
      }

      let query = `
        SELECT 
          pq.id,
          pq.completed_at,
          pq.total_score,
          pq.completion_percentage,
          qt.code,
          qt.name,
          qt.category,
          a.appointment_date,
          a.appointment_type
        FROM patient_questionnaires pq
        JOIN questionnaire_templates qt ON qt.id = pq.questionnaire_template_id
        LEFT JOIN appointments a ON a.id = pq.appointment_id
        WHERE pq.patient_id = $1 AND pq.status = 'completed'
      `;
      const params: any[] = [patientId];

      if (questionnaireCode) {
        query += ` AND qt.code = $2`;
        params.push(questionnaireCode);
      }

      query += ` ORDER BY pq.completed_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const trends = await tenantDb.query(query, params);

      return trends.map((t: any) => ({
        id: t.id,
        questionnaireCode: t.code,
        questionnaireName: t.name,
        category: t.category,
        completedAt: t.completed_at,
        totalScore: t.total_score,
        completionPercentage: t.completion_percentage,
        appointmentDate: t.appointment_date,
        appointmentType: t.appointment_type,
      }));
    } catch (error: any) {
      this.logger.error(`Error fetching PRO trends: ${error.message}`, error.stack);
      // Return empty array instead of throwing to prevent 500 errors
      return [];
    }
  }

  /**
   * Create a questionnaire schedule for a patient
   */
  async createQuestionnaireSchedule(
    tenantDb: DataSource,
    patientId: string,
    templateId: string,
    scheduleData: {
      scheduleType: 'one_time' | 'daily' | 'weekly' | 'monthly' | 'event_triggered';
      startDate: Date;
      endDate?: Date;
      frequency?: number;
      dayOfWeek?: number; // 0-6 (Sunday-Saturday)
      dayOfMonth?: number; // 1-31
      triggerEvent?: string;
      createdBy?: string;
    },
  ) {
    this.ensureTenantDb(tenantDb);

    const [schedule] = await tenantDb.query(
      `INSERT INTO questionnaire_schedules (
        patient_id, questionnaire_template_id, schedule_type, start_date, end_date,
        frequency, day_of_week, day_of_month, trigger_event, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
      RETURNING *`,
      [
        patientId,
        templateId,
        scheduleData.scheduleType,
        scheduleData.startDate,
        scheduleData.endDate || null,
        scheduleData.frequency || 1,
        scheduleData.dayOfWeek || null,
        scheduleData.dayOfMonth || null,
        scheduleData.triggerEvent || null,
        scheduleData.createdBy || null,
      ],
    );

    return schedule;
  }

  /**
   * Get all schedules for a patient
   */
  async getPatientSchedules(tenantDb: DataSource, patientId: string) {
    this.ensureTenantDb(tenantDb);

    try {
      // Check if tables exist
      const tableCheck = await tenantDb.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'questionnaire_schedules'
        )
      `);
      
      if (!tableCheck[0]?.exists) {
        this.logger.warn('PRO tables not found in tenant database. Returning empty schedules.');
        return [];
      }

      const schedules = await tenantDb.query(
        `SELECT 
          qs.*,
          qt.code as questionnaire_code,
          qt.name as questionnaire_name,
          qt.description as questionnaire_description,
          qt.category
         FROM questionnaire_schedules qs
         JOIN questionnaire_templates qt ON qt.id = qs.questionnaire_template_id
         WHERE qs.patient_id = $1
         ORDER BY qs.start_date DESC`,
        [patientId],
      );

      return schedules;
    } catch (error: any) {
      this.logger.error(`Error fetching patient schedules: ${error.message}`, error.stack);
      // Return empty array instead of throwing to prevent 500 errors
      return [];
    }
  }

  /**
   * Update a schedule
   */
  async updateSchedule(
    tenantDb: DataSource,
    scheduleId: string,
    updates: {
      isActive?: boolean;
      endDate?: Date;
      frequency?: number;
    },
  ) {
    this.ensureTenantDb(tenantDb);

    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      params.push(updates.isActive);
      paramIndex++;
    }

    if (updates.endDate !== undefined) {
      updateFields.push(`end_date = $${paramIndex}`);
      params.push(updates.endDate);
      paramIndex++;
    }

    if (updates.frequency !== undefined) {
      updateFields.push(`frequency = $${paramIndex}`);
      params.push(updates.frequency);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      throw new BadRequestException('No updates provided');
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(scheduleId);

    const [schedule] = await tenantDb.query(
      `UPDATE questionnaire_schedules 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params,
    );

    return schedule;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(tenantDb: DataSource, scheduleId: string) {
    this.ensureTenantDb(tenantDb);

    await tenantDb.query(`DELETE FROM questionnaire_schedules WHERE id = $1`, [scheduleId]);
  }

  /**
   * Process scheduled questionnaires (called by cron job)
   * This method checks all active schedules and creates pending questionnaires as needed
   */
  async processScheduledQuestionnaires(tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const today = new Date();
    const todayDate = today.toISOString().split('T')[0];
    const dayOfWeek = today.getDay(); // 0-6 (Sunday-Saturday)
    const dayOfMonth = today.getDate(); // 1-31

    // Get all active schedules
    const activeSchedules = await tenantDb.query(
      `SELECT * FROM questionnaire_schedules 
       WHERE is_active = true 
       AND start_date <= $1 
       AND (end_date IS NULL OR end_date >= $1)`,
      [todayDate],
    );

    let assignedCount = 0;

    for (const schedule of activeSchedules) {
      try {
        let shouldAssign = false;

        // Check if questionnaire should be assigned based on schedule type
        switch (schedule.schedule_type) {
          case 'daily':
            // Check if we should assign based on frequency
            const daysSinceStart = Math.floor(
              (today.getTime() - new Date(schedule.start_date).getTime()) / (1000 * 60 * 60 * 24),
            );
            shouldAssign = daysSinceStart % (schedule.frequency || 1) === 0;
            break;

          case 'weekly':
            if (schedule.day_of_week === dayOfWeek) {
              // Check frequency (e.g., every 2 weeks)
              const weeksSinceStart = Math.floor(
                (today.getTime() - new Date(schedule.start_date).getTime()) / (1000 * 60 * 60 * 24 * 7),
              );
              shouldAssign = weeksSinceStart % (schedule.frequency || 1) === 0;
            }
            break;

          case 'monthly':
            if (schedule.day_of_month === dayOfMonth) {
              // Check frequency (e.g., every 2 months)
              const monthsSinceStart =
                (today.getFullYear() - new Date(schedule.start_date).getFullYear()) * 12 +
                (today.getMonth() - new Date(schedule.start_date).getMonth());
              shouldAssign = monthsSinceStart % (schedule.frequency || 1) === 0;
            }
            break;

          case 'one_time':
            // Check if start date is today
            const startDateStr = new Date(schedule.start_date).toISOString().split('T')[0];
            shouldAssign = startDateStr === todayDate;
            break;

          case 'event_triggered':
            // Event-triggered schedules are handled separately
            continue;
        }

        if (shouldAssign) {
          // Check if questionnaire already assigned for today
          const existing = await tenantDb.query(
            `SELECT id FROM patient_questionnaires 
             WHERE patient_id = $1 
             AND questionnaire_template_id = $2 
             AND DATE(assigned_at) = $3 
             AND status IN ('pending', 'in_progress')`,
            [schedule.patient_id, schedule.questionnaire_template_id, todayDate],
          );

          if (!existing || existing.length === 0) {
            // Assign questionnaire
            await this.assignQuestionnaire(tenantDb, schedule.patient_id, schedule.questionnaire_template_id, {
              notes: `Automatically assigned via schedule: ${schedule.schedule_type}`,
            });

            assignedCount++;
            this.logger.log(
              `Assigned questionnaire ${schedule.questionnaire_template_id} to patient ${schedule.patient_id} via schedule ${schedule.id}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(`Error processing schedule ${schedule.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { processed: activeSchedules.length, assigned: assignedCount };
  }

  /**
   * Trigger event-based questionnaire assignment
   */
  async triggerEventQuestionnaire(
    tenantDb: DataSource,
    patientId: string,
    eventType: string,
  ) {
    this.ensureTenantDb(tenantDb);

    // Find all event-triggered schedules for this patient matching the event
    const schedules = await tenantDb.query(
      `SELECT * FROM questionnaire_schedules 
       WHERE patient_id = $1 
       AND schedule_type = 'event_triggered' 
       AND trigger_event = $2 
       AND is_active = true`,
      [patientId, eventType],
    );

    for (const schedule of schedules) {
      // Check if already assigned recently (within last 7 days)
      const recentAssignment = await tenantDb.query(
        `SELECT id FROM patient_questionnaires 
         WHERE patient_id = $1 
         AND questionnaire_template_id = $2 
         AND assigned_at >= NOW() - INTERVAL '7 days'`,
        [patientId, schedule.questionnaire_template_id],
      );

      if (!recentAssignment || recentAssignment.length === 0) {
        await this.assignQuestionnaire(tenantDb, patientId, schedule.questionnaire_template_id, {
          notes: `Automatically assigned via event trigger: ${eventType}`,
        });

        this.logger.log(
          `Assigned questionnaire ${schedule.questionnaire_template_id} to patient ${patientId} via event ${eventType}`,
        );
      }
    }
  }

  /**
   * Get population health PRO analytics
   */
  async getPopulationProAnalytics(
    tenantDb: DataSource,
    filters: {
      dateFrom?: string;
      dateTo?: string;
      questionnaireCode?: string;
      category?: string;
    } = {},
  ) {
    this.ensureTenantDb(tenantDb);

    let query = `
      SELECT 
        qt.code,
        qt.name,
        qt.category,
        COUNT(DISTINCT pq.patient_id) as patient_count,
        COUNT(pq.id) as total_assignments,
        COUNT(CASE WHEN pq.status = 'completed' THEN 1 END) as completed_count,
        AVG(CASE WHEN pq.status = 'completed' THEN pq.total_score END) as avg_score,
        MIN(CASE WHEN pq.status = 'completed' THEN pq.total_score END) as min_score,
        MAX(CASE WHEN pq.status = 'completed' THEN pq.total_score END) as max_score,
        COUNT(CASE WHEN pq.status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN pq.status = 'expired' THEN 1 END) as expired_count
      FROM patient_questionnaires pq
      JOIN questionnaire_templates qt ON qt.id = pq.questionnaire_template_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (filters.dateFrom) {
      query += ` AND pq.assigned_at >= $${paramIndex}`;
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      query += ` AND pq.assigned_at <= $${paramIndex}`;
      params.push(filters.dateTo);
      paramIndex++;
    }

    if (filters.questionnaireCode) {
      query += ` AND qt.code = $${paramIndex}`;
      params.push(filters.questionnaireCode);
      paramIndex++;
    }

    if (filters.category) {
      query += ` AND qt.category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    query += ` GROUP BY qt.code, qt.name, qt.category ORDER BY total_assignments DESC`;

    const analytics = await tenantDb.query(query, params);

    return analytics.map((a: any) => ({
      questionnaireCode: a.code,
      questionnaireName: a.name,
      category: a.category,
      patientCount: parseInt(a.patient_count),
      totalAssignments: parseInt(a.total_assignments),
      completedCount: parseInt(a.completed_count),
      completionRate: a.total_assignments > 0 ? (parseInt(a.completed_count) / parseInt(a.total_assignments)) * 100 : 0,
      avgScore: a.avg_score ? parseFloat(a.avg_score) : null,
      minScore: a.min_score ? parseFloat(a.min_score) : null,
      maxScore: a.max_score ? parseFloat(a.max_score) : null,
      pendingCount: parseInt(a.pending_count),
      expiredCount: parseInt(a.expired_count),
    }));
  }
}
