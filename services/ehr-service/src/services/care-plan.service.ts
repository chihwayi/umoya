import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CarePlanService {
  private readonly logger = new Logger(CarePlanService.name);

  constructor() {}

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection required');
    }
  }

  // ==================== CARE PLAN MANAGEMENT ====================

  async createCarePlan(patientId: string, planData: any, tenantDb: DataSource, userId?: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO care_plans (
        patient_id, template_id, name, description, category, status,
        start_date, end_date, target_completion_date, primary_provider_id,
        care_team, diagnosis_codes, notes, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *`,
      [
        patientId,
        planData.templateId || null,
        planData.name,
        planData.description || null,
        planData.category,
        planData.status || 'active',
        planData.startDate,
        planData.endDate || null,
        planData.targetCompletionDate || null,
        planData.primaryProviderId || userId || null,
        JSON.stringify(planData.careTeam || []),
        planData.diagnosisCodes || [],
        planData.notes || null,
        userId || null,
      ],
    );

    const carePlan = result[0];

    // Create goals if provided
    if (planData.goals && Array.isArray(planData.goals)) {
      for (let i = 0; i < planData.goals.length; i++) {
        await this.addGoal(carePlan.id, planData.goals[i], tenantDb);
      }
    }

    // Create interventions if provided
    if (planData.interventions && Array.isArray(planData.interventions)) {
      for (let i = 0; i < planData.interventions.length; i++) {
        await this.addIntervention(carePlan.id, planData.interventions[i], tenantDb);
      }
    }

    return this.getCarePlanById(carePlan.id, tenantDb);
  }

  async updateCarePlan(planId: string, updates: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const existing = await tenantDb.query(`SELECT * FROM care_plans WHERE id = $1`, [planId]);
    if (existing.length === 0) {
      throw new NotFoundException('Care plan not found');
    }

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.category !== undefined) {
      updateFields.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.startDate !== undefined) {
      updateFields.push(`start_date = $${paramIndex++}`);
      values.push(updates.startDate);
    }
    if (updates.endDate !== undefined) {
      updateFields.push(`end_date = $${paramIndex++}`);
      values.push(updates.endDate);
    }
    if (updates.targetCompletionDate !== undefined) {
      updateFields.push(`target_completion_date = $${paramIndex++}`);
      values.push(updates.targetCompletionDate);
    }
    if (updates.primaryProviderId !== undefined) {
      updateFields.push(`primary_provider_id = $${paramIndex++}`);
      values.push(updates.primaryProviderId);
    }
    if (updates.careTeam !== undefined) {
      updateFields.push(`care_team = $${paramIndex++}`);
      values.push(JSON.stringify(updates.careTeam));
    }
    if (updates.diagnosisCodes !== undefined) {
      updateFields.push(`diagnosis_codes = $${paramIndex++}`);
      values.push(updates.diagnosisCodes);
    }
    if (updates.notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`);
      values.push(updates.notes);
    }

    if (updateFields.length === 0) {
      return existing[0];
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(planId);

    const result = await tenantDb.query(
      `UPDATE care_plans SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    return result[0];
  }

  async getCarePlans(patientId: string, filters: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT * FROM care_plans WHERE patient_id = $1`;
    const params: any[] = [patientId];
    let paramIndex = 2;

    if (filters.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters.primaryProviderId) {
      query += ` AND primary_provider_id = $${paramIndex++}`;
      params.push(filters.primaryProviderId);
    }

    query += ` ORDER BY created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }

    const carePlans = await tenantDb.query(query, params);

    // Load goals and interventions for each care plan
    for (const plan of carePlans) {
      plan.goals = await this.getGoals(plan.id, tenantDb);
      plan.interventions = await this.getInterventions(plan.id, tenantDb);
    }

    return carePlans;
  }

  async getCarePlanById(planId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(`SELECT * FROM care_plans WHERE id = $1`, [planId]);
    if (result.length === 0) {
      throw new NotFoundException('Care plan not found');
    }

    const carePlan = result[0];
    carePlan.goals = await this.getGoals(planId, tenantDb);
    carePlan.interventions = await this.getInterventions(planId, tenantDb);

    return carePlan;
  }

  async deleteCarePlan(planId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(`DELETE FROM care_plans WHERE id = $1 RETURNING *`, [planId]);
    if (result.length === 0) {
      throw new NotFoundException('Care plan not found');
    }

    return { success: true, message: 'Care plan deleted' };
  }

  async completeCarePlan(planId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `UPDATE care_plans SET status = 'completed', end_date = CURRENT_DATE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [planId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Care plan not found');
    }

    return result[0];
  }

  async activateCarePlan(planId: string, tenantDb: DataSource) {
    return this.updateCarePlan(planId, { status: 'active' }, tenantDb);
  }

  async holdCarePlan(planId: string, tenantDb: DataSource) {
    return this.updateCarePlan(planId, { status: 'on_hold' }, tenantDb);
  }

  // ==================== GOALS MANAGEMENT ====================

  async addGoal(planId: string, goalData: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    // Get the next goal number
    const countResult = await tenantDb.query(
      `SELECT COALESCE(MAX(goal_number), 0) + 1 as next_number FROM care_plan_goals WHERE care_plan_id = $1`,
      [planId],
    );
    const goalNumber = countResult[0].next_number;

    const result = await tenantDb.query(
      `INSERT INTO care_plan_goals (
        care_plan_id, goal_number, goal_text, goal_type, target_value,
        current_value, measurement_unit, target_date, status, priority, notes,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        planId,
        goalNumber,
        goalData.goalText,
        goalData.goalType,
        goalData.targetValue || null,
        goalData.currentValue || null,
        goalData.measurementUnit || null,
        goalData.targetDate || null,
        goalData.status || 'in_progress',
        goalData.priority || 'normal',
        goalData.notes || null,
      ],
    );

    return result[0];
  }

  async updateGoal(goalId: string, updates: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const existing = await tenantDb.query(`SELECT * FROM care_plan_goals WHERE id = $1`, [goalId]);
    if (existing.length === 0) {
      throw new NotFoundException('Goal not found');
    }

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.goalText !== undefined) {
      updateFields.push(`goal_text = $${paramIndex++}`);
      values.push(updates.goalText);
    }
    if (updates.goalType !== undefined) {
      updateFields.push(`goal_type = $${paramIndex++}`);
      values.push(updates.goalType);
    }
    if (updates.targetValue !== undefined) {
      updateFields.push(`target_value = $${paramIndex++}`);
      values.push(updates.targetValue);
    }
    if (updates.currentValue !== undefined) {
      updateFields.push(`current_value = $${paramIndex++}`);
      values.push(updates.currentValue);
    }
    if (updates.measurementUnit !== undefined) {
      updateFields.push(`measurement_unit = $${paramIndex++}`);
      values.push(updates.measurementUnit);
    }
    if (updates.targetDate !== undefined) {
      updateFields.push(`target_date = $${paramIndex++}`);
      values.push(updates.targetDate);
    }
    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.priority !== undefined) {
      updateFields.push(`priority = $${paramIndex++}`);
      values.push(updates.priority);
    }
    if (updates.notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`);
      values.push(updates.notes);
    }

    if (updateFields.length === 0) {
      return existing[0];
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(goalId);

    const result = await tenantDb.query(
      `UPDATE care_plan_goals SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    return result[0];
  }

  async getGoals(planId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    return tenantDb.query(
      `SELECT * FROM care_plan_goals WHERE care_plan_id = $1 ORDER BY goal_number ASC`,
      [planId],
    );
  }

  async deleteGoal(goalId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(`DELETE FROM care_plan_goals WHERE id = $1 RETURNING *`, [goalId]);
    if (result.length === 0) {
      throw new NotFoundException('Goal not found');
    }

    return { success: true, message: 'Goal deleted' };
  }

  async achieveGoal(goalId: string, tenantDb: DataSource) {
    return this.updateGoal(goalId, { status: 'achieved' }, tenantDb);
  }

  // ==================== INTERVENTIONS MANAGEMENT ====================

  async addIntervention(planId: string, interventionData: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    // Get the next intervention number
    const countResult = await tenantDb.query(
      `SELECT COALESCE(MAX(intervention_number), 0) + 1 as next_number FROM care_plan_interventions WHERE care_plan_id = $1`,
      [planId],
    );
    const interventionNumber = countResult[0].next_number;

    const result = await tenantDb.query(
      `INSERT INTO care_plan_interventions (
        care_plan_id, goal_id, intervention_number, intervention_text, intervention_type,
        frequency, duration, responsible_role, assigned_to, status,
        start_date, end_date, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *`,
      [
        planId,
        interventionData.goalId || null,
        interventionNumber,
        interventionData.interventionText,
        interventionData.interventionType,
        interventionData.frequency || null,
        interventionData.duration || null,
        interventionData.responsibleRole || null,
        interventionData.assignedTo || null,
        interventionData.status || 'pending',
        interventionData.startDate || null,
        interventionData.endDate || null,
      ],
    );

    return result[0];
  }

  async updateIntervention(interventionId: string, updates: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const existing = await tenantDb.query(`SELECT * FROM care_plan_interventions WHERE id = $1`, [interventionId]);
    if (existing.length === 0) {
      throw new NotFoundException('Intervention not found');
    }

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.interventionText !== undefined) {
      updateFields.push(`intervention_text = $${paramIndex++}`);
      values.push(updates.interventionText);
    }
    if (updates.interventionType !== undefined) {
      updateFields.push(`intervention_type = $${paramIndex++}`);
      values.push(updates.interventionType);
    }
    if (updates.frequency !== undefined) {
      updateFields.push(`frequency = $${paramIndex++}`);
      values.push(updates.frequency);
    }
    if (updates.duration !== undefined) {
      updateFields.push(`duration = $${paramIndex++}`);
      values.push(updates.duration);
    }
    if (updates.responsibleRole !== undefined) {
      updateFields.push(`responsible_role = $${paramIndex++}`);
      values.push(updates.responsibleRole);
    }
    if (updates.assignedTo !== undefined) {
      updateFields.push(`assigned_to = $${paramIndex++}`);
      values.push(updates.assignedTo);
    }
    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.startDate !== undefined) {
      updateFields.push(`start_date = $${paramIndex++}`);
      values.push(updates.startDate);
    }
    if (updates.endDate !== undefined) {
      updateFields.push(`end_date = $${paramIndex++}`);
      values.push(updates.endDate);
    }
    if (updates.completionDate !== undefined) {
      updateFields.push(`completion_date = $${paramIndex++}`);
      values.push(updates.completionDate);
    }
    if (updates.outcomeNotes !== undefined) {
      updateFields.push(`outcome_notes = $${paramIndex++}`);
      values.push(updates.outcomeNotes);
    }

    if (updateFields.length === 0) {
      return existing[0];
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(interventionId);

    const result = await tenantDb.query(
      `UPDATE care_plan_interventions SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    return result[0];
  }

  async getInterventions(planId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    return tenantDb.query(
      `SELECT * FROM care_plan_interventions WHERE care_plan_id = $1 ORDER BY intervention_number ASC`,
      [planId],
    );
  }

  async deleteIntervention(interventionId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `DELETE FROM care_plan_interventions WHERE id = $1 RETURNING *`,
      [interventionId],
    );
    if (result.length === 0) {
      throw new NotFoundException('Intervention not found');
    }

    return { success: true, message: 'Intervention deleted' };
  }

  async completeIntervention(interventionId: string, outcomeNotes: string, tenantDb: DataSource) {
    return this.updateIntervention(
      interventionId,
      {
        status: 'completed',
        completionDate: new Date().toISOString().split('T')[0],
        outcomeNotes,
      },
      tenantDb,
    );
  }

  // ==================== PROGRESS TRACKING ====================

  async recordProgress(planId: string, progressData: any, tenantDb: DataSource, userId?: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO care_plan_progress_log (
        care_plan_id, goal_id, intervention_id, progress_date, progress_type,
        current_value, progress_percentage, notes, recorded_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        planId,
        progressData.goalId || null,
        progressData.interventionId || null,
        progressData.progressDate || new Date().toISOString().split('T')[0],
        progressData.progressType,
        progressData.currentValue || null,
        progressData.progressPercentage || null,
        progressData.notes || null,
        userId || null,
      ],
    );

    // Update goal current value if provided
    if (progressData.goalId && progressData.currentValue) {
      await this.updateGoal(progressData.goalId, { currentValue: progressData.currentValue }, tenantDb);
    }

    return result[0];
  }

  async getCarePlanProgress(planId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    return tenantDb.query(
      `SELECT * FROM care_plan_progress_log WHERE care_plan_id = $1 ORDER BY progress_date DESC, created_at DESC`,
      [planId],
    );
  }

  // ==================== OUTCOMES ASSESSMENT ====================

  async assessOutcome(planId: string, outcomeData: any, tenantDb: DataSource, userId?: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO care_plan_outcomes (
        care_plan_id, outcome_date, outcome_type, measurement_value,
        measurement_unit, baseline_value, improvement_percentage, notes,
        assessed_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        planId,
        outcomeData.outcomeDate || new Date().toISOString().split('T')[0],
        outcomeData.outcomeType,
        outcomeData.measurementValue || null,
        outcomeData.measurementUnit || null,
        outcomeData.baselineValue || null,
        outcomeData.improvementPercentage || null,
        outcomeData.notes || null,
        userId || null,
      ],
    );

    return result[0];
  }

  async getOutcomes(planId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    return tenantDb.query(
      `SELECT * FROM care_plan_outcomes WHERE care_plan_id = $1 ORDER BY outcome_date DESC, created_at DESC`,
      [planId],
    );
  }
}
