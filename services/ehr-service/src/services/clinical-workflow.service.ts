import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface WorkflowStepConfig {
  assignRole?: { role: string; entityId: string; entityType: string };
  sendNotification?: { userIds: string[]; message: string; priority: string };
  createTask?: { assignedTo: string; title: string; description: string; dueDate?: string };
  updateStatus?: { entityType: string; entityId: string; status: string };
  createOrder?: { orderType: string; orderData: any };
  assignAppointment?: { appointmentId: string; assignedTo: string };
  sendMessage?: { recipientId: string; subject: string; message: string };
  wait?: { durationMinutes: number; condition?: any };
  condition?: { field: string; operator: string; value: any; thenStep: number; elseStep?: number };
}

@Injectable()
export class ClinicalWorkflowService {
  private readonly logger = new Logger(ClinicalWorkflowService.name);

  constructor() {}

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection required');
    }
  }

  // ==================== WORKFLOW MANAGEMENT ====================

  async createWorkflow(workflowData: any, tenantDb: DataSource, userId?: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO clinical_workflows (name, description, trigger_event, trigger_conditions, is_active, priority, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        workflowData.name,
        workflowData.description || null,
        workflowData.triggerEvent,
        JSON.stringify(workflowData.triggerConditions || {}),
        workflowData.isActive !== false,
        workflowData.priority || 0,
        userId || null,
      ],
    );

    const workflow = result[0];

    // Create workflow steps if provided
    if (workflowData.steps && Array.isArray(workflowData.steps)) {
      for (let i = 0; i < workflowData.steps.length; i++) {
        const step = workflowData.steps[i];
        await this.addWorkflowStep(workflow.id, step, tenantDb);
      }
    }

    return workflow;
  }

  async updateWorkflow(workflowId: string, updates: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const existing = await tenantDb.query(`SELECT * FROM clinical_workflows WHERE id = $1`, [workflowId]);
    if (existing.length === 0) {
      throw new NotFoundException('Workflow not found');
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
    if (updates.triggerEvent !== undefined) {
      updateFields.push(`trigger_event = $${paramIndex++}`);
      values.push(updates.triggerEvent);
    }
    if (updates.triggerConditions !== undefined) {
      updateFields.push(`trigger_conditions = $${paramIndex++}`);
      values.push(JSON.stringify(updates.triggerConditions));
    }
    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }
    if (updates.priority !== undefined) {
      updateFields.push(`priority = $${paramIndex++}`);
      values.push(updates.priority);
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(workflowId);

    if (updateFields.length === 1) {
      // Only updated_at
      return existing[0];
    }

    const result = await tenantDb.query(
      `UPDATE clinical_workflows SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    return result[0];
  }

  async deleteWorkflow(workflowId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const existing = await tenantDb.query(`SELECT * FROM clinical_workflows WHERE id = $1`, [workflowId]);
    if (existing.length === 0) {
      throw new NotFoundException('Workflow not found');
    }

    await tenantDb.query(`DELETE FROM clinical_workflows WHERE id = $1`, [workflowId]);
    return { message: 'Workflow deleted successfully' };
  }

  async getWorkflows(filters: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT * FROM clinical_workflows WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.triggerEvent) {
      query += ` AND trigger_event = $${paramIndex++}`;
      params.push(filters.triggerEvent);
    }
    if (filters?.isActive !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      params.push(filters.isActive);
    }
    if (filters?.search) {
      query += ` AND (name ILIKE $${paramIndex++} OR description ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      params.push(`%${filters.search}%`);
    }

    query += ` ORDER BY priority DESC, created_at DESC`;

    const workflows = await tenantDb.query(query, params);

    // Get steps for each workflow
    for (const workflow of workflows) {
      workflow.steps = await this.getWorkflowSteps(workflow.id, tenantDb);
    }

    return workflows;
  }

  async getWorkflowById(workflowId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(`SELECT * FROM clinical_workflows WHERE id = $1`, [workflowId]);
    if (result.length === 0) {
      throw new NotFoundException('Workflow not found');
    }

    const workflow = result[0];
    workflow.steps = await this.getWorkflowSteps(workflowId, tenantDb);
    workflow.triggerConditions = workflow.trigger_conditions ? JSON.parse(workflow.trigger_conditions) : {};

    return workflow;
  }

  // ==================== WORKFLOW STEPS ====================

  async addWorkflowStep(workflowId: string, stepData: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    // Get current max step_order
    const maxOrderResult = await tenantDb.query(
      `SELECT COALESCE(MAX(step_order), 0) as max_order FROM workflow_steps WHERE workflow_id = $1`,
      [workflowId],
    );
    const stepOrder = (maxOrderResult[0]?.max_order || 0) + 1;

    const result = await tenantDb.query(
      `INSERT INTO workflow_steps (workflow_id, step_order, step_type, step_config, conditions, timeout_minutes, retry_count, is_required, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        workflowId,
        stepOrder,
        stepData.stepType,
        JSON.stringify(stepData.stepConfig || {}),
        stepData.conditions ? JSON.stringify(stepData.conditions) : null,
        stepData.timeoutMinutes || null,
        stepData.retryCount || 0,
        stepData.isRequired !== false,
      ],
    );

    return result[0];
  }

  async updateWorkflowStep(stepId: string, updates: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.stepType !== undefined) {
      updateFields.push(`step_type = $${paramIndex++}`);
      values.push(updates.stepType);
    }
    if (updates.stepConfig !== undefined) {
      updateFields.push(`step_config = $${paramIndex++}`);
      values.push(JSON.stringify(updates.stepConfig));
    }
    if (updates.conditions !== undefined) {
      updateFields.push(`conditions = $${paramIndex++}`);
      values.push(JSON.stringify(updates.conditions));
    }
    if (updates.timeoutMinutes !== undefined) {
      updateFields.push(`timeout_minutes = $${paramIndex++}`);
      values.push(updates.timeoutMinutes);
    }
    if (updates.isRequired !== undefined) {
      updateFields.push(`is_required = $${paramIndex++}`);
      values.push(updates.isRequired);
    }

    if (updateFields.length === 0) {
      const existing = await tenantDb.query(`SELECT * FROM workflow_steps WHERE id = $1`, [stepId]);
      return existing[0];
    }

    values.push(stepId);
    const result = await tenantDb.query(
      `UPDATE workflow_steps SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    return result[0];
  }

  async deleteWorkflowStep(stepId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    // Get step to reorder remaining steps
    const step = await tenantDb.query(`SELECT workflow_id, step_order FROM workflow_steps WHERE id = $1`, [stepId]);
    if (step.length === 0) {
      throw new NotFoundException('Workflow step not found');
    }

    await tenantDb.query(`DELETE FROM workflow_steps WHERE id = $1`, [stepId]);

    // Reorder remaining steps
    await tenantDb.query(
      `UPDATE workflow_steps 
       SET step_order = step_order - 1 
       WHERE workflow_id = $1 AND step_order > $2`,
      [step[0].workflow_id, step[0].step_order],
    );

    return { message: 'Workflow step deleted successfully' };
  }

  async getWorkflowSteps(workflowId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const steps = await tenantDb.query(
      `SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC`,
      [workflowId],
    );

    return steps.map((step: any) => {
      // Handle step_config - PostgreSQL JSONB can return as object or string
      let stepConfig: any = {};
      if (step.step_config) {
        if (typeof step.step_config === 'string') {
          try {
            stepConfig = JSON.parse(step.step_config);
          } catch (e) {
            this.logger.warn(`Failed to parse step_config for step ${step.id}: ${e}`);
            stepConfig = {};
          }
        } else if (typeof step.step_config === 'object') {
          stepConfig = step.step_config;
        }
      }

      // Handle conditions - PostgreSQL JSONB can return as object or string
      let conditions: any = null;
      if (step.conditions) {
        if (typeof step.conditions === 'string') {
          try {
            conditions = JSON.parse(step.conditions);
          } catch (e) {
            this.logger.warn(`Failed to parse conditions for step ${step.id}: ${e}`);
            conditions = null;
          }
        } else if (typeof step.conditions === 'object') {
          conditions = step.conditions;
        }
      }

      return {
        ...step,
        stepConfig,
        conditions,
      };
    });
  }

  // ==================== WORKFLOW EXECUTION ====================

  async executeWorkflow(
    triggerEvent: string,
    triggerData: {
      entityType: string;
      entityId: string;
      patientId?: string;
      data?: any;
    },
    tenantDb: DataSource,
  ) {
    this.ensureTenantDb(tenantDb);

    // Find active workflows that match the trigger event
    const workflows = await tenantDb.query(
      `SELECT * FROM clinical_workflows 
       WHERE trigger_event = $1 AND is_active = true 
       ORDER BY priority DESC`,
      [triggerEvent],
    );

    this.logger.log(`Found ${workflows.length} active workflow(s) for trigger event: ${triggerEvent}`);

    const executions: any[] = [];

    for (const workflow of workflows) {
      this.logger.log(`Processing workflow: ${workflow.name} (${workflow.id})`);
      // Check trigger conditions
      if (workflow.trigger_conditions) {
        // Handle trigger_conditions - PostgreSQL JSONB can return as object or string
        let conditions: any = {};
        const rawConditions = workflow.trigger_conditions;
        if (typeof rawConditions === 'string') {
          try {
            conditions = JSON.parse(rawConditions);
          } catch (e) {
            this.logger.warn(`Failed to parse trigger_conditions for workflow ${workflow.id}: ${e}`);
            conditions = {};
          }
        } else if (typeof rawConditions === 'object') {
          conditions = rawConditions;
        }
        
        // If triggerData.data has a flag to bypass conditions (for testing), skip condition check
        const bypassConditions = triggerData.data?._bypassConditions === true;
        
        if (!bypassConditions) {
          const conditionsMet = this.evaluateConditions(conditions, triggerData.data || {});
          this.logger.log(`Workflow ${workflow.name} trigger conditions evaluated: ${conditionsMet}`);
          if (!conditionsMet) {
            this.logger.log(`Skipping workflow ${workflow.name} - trigger conditions not met`);
            continue; // Skip this workflow
          }
        } else {
          this.logger.log(`Bypassing trigger conditions for workflow ${workflow.name} (test mode)`);
        }
      }

      // Create execution record
      this.logger.log(`Creating execution for workflow: ${workflow.name}`);
      const execution = await this.createWorkflowExecution(workflow.id, triggerEvent, triggerData, tenantDb);
      this.logger.log(`Execution created: ${execution.id}`);
      executions.push(execution);

      // Execute workflow steps asynchronously
      this.executeWorkflowSteps(workflow.id, execution.id, triggerData, tenantDb).catch((error) => {
        this.logger.error(`Error executing workflow ${workflow.id}: ${error.message}`);
      });
    }

    return executions;
  }

  private async createWorkflowExecution(
    workflowId: string,
    triggerEvent: string,
    triggerData: any,
    tenantDb: DataSource,
  ) {
    const result = await tenantDb.query(
      `INSERT INTO workflow_executions 
       (workflow_id, trigger_event, trigger_entity_type, trigger_entity_id, patient_id, status, execution_data, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW())
       RETURNING *`,
      [
        workflowId,
        triggerEvent,
        triggerData.entityType,
        triggerData.entityId,
        triggerData.patientId || null,
        JSON.stringify(triggerData.data || {}),
      ],
    );

    return result[0];
  }

  private async executeWorkflowSteps(workflowId: string, executionId: string, triggerData: any, tenantDb: DataSource) {
    try {
      // Update execution status to running
      await tenantDb.query(
        `UPDATE workflow_executions SET status = 'running', started_at = NOW() WHERE id = $1`,
        [executionId],
      );

      // Get workflow steps
      const steps = await this.getWorkflowSteps(workflowId, tenantDb);

      // Execute each step sequentially
      for (const step of steps) {
        const stepExecution = await this.createStepExecution(executionId, step.id, step.step_order, tenantDb);

        try {
          await this.executeStep(step, triggerData, tenantDb, stepExecution.id);
          await this.updateStepExecutionStatus(stepExecution.id, 'completed', tenantDb);
        } catch (error: any) {
          this.logger.error(`Error executing step ${step.id}: ${error.message}`);
          await this.updateStepExecutionStatus(stepExecution.id, 'failed', tenantDb, error.message);
          
          if (step.is_required) {
            // Required step failed, mark execution as failed
            await tenantDb.query(
              `UPDATE workflow_executions SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
              [error.message, executionId],
            );
            return;
          }
        }
      }

      // All steps completed
      await tenantDb.query(
        `UPDATE workflow_executions SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [executionId],
      );
    } catch (error: any) {
      this.logger.error(`Error executing workflow steps: ${error.message}`);
      await tenantDb.query(
        `UPDATE workflow_executions SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
        [error.message, executionId],
      );
    }
  }

  private async executeStep(step: any, triggerData: any, tenantDb: DataSource, stepExecutionId: string) {
    const config = step.stepConfig || {};

    switch (step.step_type) {
      case 'assign_role':
        // Implementation would assign entity to role
        this.logger.log(`Assigning ${config.entityType} ${config.entityId} to role ${config.role}`);
        break;

      case 'send_notification':
        // Send notifications to users (would need user notifications service)
        if (config.userIds && Array.isArray(config.userIds)) {
          for (const userId of config.userIds) {
            this.logger.log(
              `Workflow notification for user ${userId}: ${config.message || 'Workflow step executed'}`,
            );
            // TODO: Implement user notifications table/service
            // For now, we log the notification. In production, this would:
            // 1. Insert into user_notifications table, or
            // 2. Send via email/SMS, or
            // 3. Use a messaging service
          }
        }
        break;

      case 'create_task':
        // Create task in system (would need task service)
        this.logger.log(`Creating task: ${config.title} for user ${config.assignedTo}`);
        break;

      case 'update_status':
        // Update entity status
        await tenantDb.query(
          `UPDATE ${config.entityType} SET status = $1, updated_at = NOW() WHERE id = $2`,
          [config.status, config.entityId],
        );
        break;

      case 'create_order':
        // Create order (lab/imaging)
        this.logger.log(`Creating ${config.orderType} order`);
        break;

      case 'assign_appointment':
        // Assign appointment
        await tenantDb.query(
          `UPDATE appointments SET doctor_id = $1, updated_at = NOW() WHERE id = $2`,
          [config.assignedTo, config.appointmentId],
        );
        break;

      case 'send_message':
        // Send message (would need messaging service)
        this.logger.log(`Sending message to ${config.recipientId}`);
        break;

      case 'wait':
        // Wait for duration
        if (config.durationMinutes) {
          await new Promise((resolve) => setTimeout(resolve, config.durationMinutes * 60 * 1000));
        }
        break;

      case 'condition':
        // Conditional logic
        this.logger.log(`Evaluating condition: ${config.field} ${config.operator} ${config.value}`);
        break;

      default:
        this.logger.warn(`Unknown step type: ${step.step_type}`);
    }
  }

  private async createStepExecution(executionId: string, stepId: string, stepOrder: number, tenantDb: DataSource) {
    const result = await tenantDb.query(
      `INSERT INTO workflow_step_executions 
       (execution_id, step_id, step_order, status, created_at)
       VALUES ($1, $2, $3, 'running', NOW())
       RETURNING *`,
      [executionId, stepId, stepOrder],
    );

    await tenantDb.query(
      `UPDATE workflow_step_executions SET started_at = NOW() WHERE id = $1`,
      [result[0].id],
    );

    return result[0];
  }

  private async updateStepExecutionStatus(stepExecutionId: string, status: string, tenantDb: DataSource, errorMessage?: string) {
    await tenantDb.query(
      `UPDATE workflow_step_executions 
       SET status = $1, completed_at = NOW(), error_message = $2, updated_at = NOW()
       WHERE id = $3`,
      [status, errorMessage || null, stepExecutionId],
    );
  }

  private evaluateConditions(conditions: any, data: any): boolean {
    // Simple condition evaluation
    // In production, this would be more sophisticated
    for (const [key, value] of Object.entries(conditions)) {
      if (data[key] !== value) {
        return false;
      }
    }
    return true;
  }

  // ==================== WORKFLOW EXECUTIONS ====================

  async getWorkflowExecutions(filters: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT we.*, cw.name as workflow_name 
                 FROM workflow_executions we
                 JOIN clinical_workflows cw ON we.workflow_id = cw.id
                 WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.workflowId) {
      query += ` AND we.workflow_id = $${paramIndex++}`;
      params.push(filters.workflowId);
    }
    if (filters?.patientId) {
      query += ` AND we.patient_id = $${paramIndex++}`;
      params.push(filters.patientId);
    }
    if (filters?.status) {
      query += ` AND we.status = $${paramIndex++}`;
      params.push(filters.status);
    }

    query += ` ORDER BY we.created_at DESC LIMIT ${filters?.limit || 100}`;

    const executions = await tenantDb.query(query, params);

    // Get step executions for each
    for (const execution of executions) {
      execution.steps = await this.getStepExecutions(execution.id, tenantDb);
      
      // Handle execution_data - PostgreSQL JSONB can return as object or string
      let executionData: any = {};
      const rawData = execution.execution_data;
      if (rawData !== null && rawData !== undefined) {
        try {
          if (typeof rawData === 'string') {
            const trimmed = rawData.trim();
            if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
              executionData = JSON.parse(trimmed);
            } else {
              executionData = {};
            }
          } else if (typeof rawData === 'object') {
            executionData = rawData;
          }
        } catch (error: any) {
          this.logger.warn(`Failed to parse execution_data for execution ${execution.id}: ${error.message}`);
          executionData = {};
        }
      }
      execution.executionData = executionData;
    }

    return executions;
  }

  async getStepExecutions(executionId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const steps = await tenantDb.query(
      `SELECT wse.*, ws.step_type, ws.step_order
       FROM workflow_step_executions wse
       JOIN workflow_steps ws ON wse.step_id = ws.id
       WHERE wse.execution_id = $1
       ORDER BY wse.step_order ASC`,
      [executionId],
    );

    return steps.map((step: any) => ({
      ...step,
      resultData: step.result_data ? JSON.parse(step.result_data) : null,
    }));
  }

  // ==================== WORKFLOW TEMPLATES ====================

  async getWorkflowTemplates(category: string | null, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT * FROM workflow_templates WHERE is_active = true`;
    const params: any[] = [];

    if (category) {
      query += ` AND category = $1`;
      params.push(category);
    }

    query += ` ORDER BY is_default DESC, name ASC`;

    const templates = await tenantDb.query(query, params);

    return templates.map((template: any) => {
      let templateData: any = {};
      
      // Handle template_data field - PostgreSQL JSONB can return as object or string
      const rawData = template.template_data;
      
      if (rawData !== null && rawData !== undefined) {
        try {
          if (typeof rawData === 'string') {
            // Try to parse if it's a string
            const trimmed = rawData.trim();
            if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
              templateData = JSON.parse(trimmed);
            } else {
              // If it's not valid JSON, use empty object
              this.logger.warn(`Template ${template.id} has invalid JSON string: ${rawData.substring(0, 50)}`);
              templateData = {};
            }
          } else if (typeof rawData === 'object') {
            // Already an object (PostgreSQL JSONB)
            templateData = rawData;
          }
        } catch (error: any) {
          this.logger.warn(`Failed to parse template_data for template ${template.id}: ${error.message}`);
          templateData = {};
        }
      }
      
      return {
        ...template,
        template_data: templateData,
        templateData: templateData, // Also include for backward compatibility
      };
    });
  }

  async createWorkflowFromTemplate(templateId: string, tenantDb: DataSource, userId?: string) {
    this.ensureTenantDb(tenantDb);

    const template = await tenantDb.query(`SELECT * FROM workflow_templates WHERE id = $1`, [templateId]);
    if (template.length === 0) {
      throw new NotFoundException('Workflow template not found');
    }

    // Handle template_data - PostgreSQL JSONB can return as object or string
    const rawData = template[0].template_data;
    let templateData: any = {};
    
    if (rawData !== null && rawData !== undefined) {
      try {
        if (typeof rawData === 'string') {
          // Try to parse if it's a string
          const trimmed = rawData.trim();
          if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
            templateData = JSON.parse(trimmed);
          } else {
            this.logger.warn(`Template ${templateId} has invalid JSON string: ${rawData.substring(0, 50)}`);
            templateData = {};
          }
        } else if (typeof rawData === 'object') {
          // Already an object (PostgreSQL JSONB)
          templateData = rawData;
        }
      } catch (error: any) {
        this.logger.warn(`Failed to parse template_data for template ${templateId}: ${error.message}`);
        templateData = {};
      }
    }

    // Increment usage count
    await tenantDb.query(
      `UPDATE workflow_templates SET usage_count = usage_count + 1 WHERE id = $1`,
      [templateId],
    );

    // Normalize step data (convert snake_case to camelCase if needed)
    const normalizedSteps = templateData.steps?.map((step: any) => ({
      stepType: step.stepType || step.step_type,
      stepConfig: step.stepConfig || step.step_config || {},
      conditions: step.conditions || null,
      timeoutMinutes: step.timeoutMinutes || step.timeout_minutes || null,
      retryCount: step.retryCount || step.retry_count || 0,
      isRequired: step.isRequired !== undefined ? step.isRequired : (step.is_required !== undefined ? step.is_required : true),
    })) || [];

    // Create workflow from template
    return this.createWorkflow(
      {
        name: `${templateData.name || 'Untitled Workflow'} (Copy)`,
        description: templateData.description || null,
        triggerEvent: templateData.triggerEvent || templateData.trigger_event,
        triggerConditions: templateData.triggerConditions || templateData.trigger_conditions || {},
        isActive: templateData.isActive !== undefined ? templateData.isActive : (templateData.is_active !== undefined ? templateData.is_active : true),
        priority: templateData.priority || 0,
        steps: normalizedSteps,
      },
      tenantDb,
      userId,
    );
  }

  // ==================== ANALYTICS ====================

  async getWorkflowAnalytics(tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    // Get total workflows
    const totalWorkflows = await tenantDb.query(`SELECT COUNT(*) as count FROM clinical_workflows`);
    const activeWorkflows = await tenantDb.query(`SELECT COUNT(*) as count FROM clinical_workflows WHERE is_active = true`);

    // Get total executions
    const totalExecutions = await tenantDb.query(`SELECT COUNT(*) as count FROM workflow_executions`);
    const completedExecutions = await tenantDb.query(`SELECT COUNT(*) as count FROM workflow_executions WHERE status = 'completed'`);
    const failedExecutions = await tenantDb.query(`SELECT COUNT(*) as count FROM workflow_executions WHERE status = 'failed'`);
    const runningExecutions = await tenantDb.query(`SELECT COUNT(*) as count FROM workflow_executions WHERE status = 'running'`);

    // Get executions by trigger event
    const executionsByTrigger = await tenantDb.query(`
      SELECT trigger_event, COUNT(*) as count
      FROM workflow_executions
      GROUP BY trigger_event
      ORDER BY count DESC
      LIMIT 10
    `);

    // Get most used workflows
    const mostUsedWorkflows = await tenantDb.query(`
      SELECT w.id, w.name, COUNT(we.id) as execution_count
      FROM clinical_workflows w
      LEFT JOIN workflow_executions we ON w.id = we.workflow_id
      GROUP BY w.id, w.name
      ORDER BY execution_count DESC
      LIMIT 10
    `);

    // Get average execution time
    const avgExecutionTime = await tenantDb.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds
      FROM workflow_executions
      WHERE completed_at IS NOT NULL AND started_at IS NOT NULL
    `);

    // Get executions over time (last 30 days)
    const executionsOverTime = await tenantDb.query(`
      SELECT DATE(started_at) as date, COUNT(*) as count
      FROM workflow_executions
      WHERE started_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(started_at)
      ORDER BY date DESC
    `);

    // Get success rate
    const totalCount = parseInt(totalExecutions[0].count, 10);
    const completedCount = parseInt(completedExecutions[0].count, 10);
    const successRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return {
      totalWorkflows: parseInt(totalWorkflows[0].count, 10),
      activeWorkflows: parseInt(activeWorkflows[0].count, 10),
      totalExecutions: totalCount,
      completedExecutions: completedCount,
      failedExecutions: parseInt(failedExecutions[0].count, 10),
      runningExecutions: parseInt(runningExecutions[0].count, 10),
      successRate: Math.round(successRate * 100) / 100,
      avgExecutionTimeSeconds: avgExecutionTime[0].avg_seconds ? Math.round(parseFloat(avgExecutionTime[0].avg_seconds)) : 0,
      executionsByTrigger: executionsByTrigger.map((row: any) => ({
        triggerEvent: row.trigger_event,
        count: parseInt(row.count, 10),
      })),
      mostUsedWorkflows: mostUsedWorkflows.map((row: any) => ({
        id: row.id,
        name: row.name,
        executionCount: parseInt(row.execution_count, 10),
      })),
      executionsOverTime: executionsOverTime.map((row: any) => ({
        date: row.date,
        count: parseInt(row.count, 10),
      })),
    };
  }

  async getWorkflowAnalyticsById(workflowId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    // Get workflow details
    const workflow = await this.getWorkflowById(workflowId, tenantDb);

    // Get execution statistics
    const totalExecutions = await tenantDb.query(
      `SELECT COUNT(*) as count FROM workflow_executions WHERE workflow_id = $1`,
      [workflowId],
    );
    const completedExecutions = await tenantDb.query(
      `SELECT COUNT(*) as count FROM workflow_executions WHERE workflow_id = $1 AND status = 'completed'`,
      [workflowId],
    );
    const failedExecutions = await tenantDb.query(
      `SELECT COUNT(*) as count FROM workflow_executions WHERE workflow_id = $1 AND status = 'failed'`,
      [workflowId],
    );

    // Get average execution time
    const avgExecutionTime = await tenantDb.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds
       FROM workflow_executions
       WHERE workflow_id = $1 AND completed_at IS NOT NULL AND started_at IS NOT NULL`,
      [workflowId],
    );

    // Get step failure rates
    const stepFailures = await tenantDb.query(
      `SELECT ws.step_type, COUNT(*) as failure_count
       FROM workflow_step_executions wse
       JOIN workflow_steps ws ON wse.step_id = ws.id
       WHERE wse.execution_id IN (SELECT id FROM workflow_executions WHERE workflow_id = $1)
       AND wse.status = 'failed'
       GROUP BY ws.step_type
       ORDER BY failure_count DESC`,
      [workflowId],
    );

    // Get recent executions
    const recentExecutions = await tenantDb.query(
      `SELECT id, status, started_at, completed_at, trigger_event
       FROM workflow_executions
       WHERE workflow_id = $1
       ORDER BY started_at DESC
       LIMIT 10`,
      [workflowId],
    );

    const totalCount = parseInt(totalExecutions[0].count, 10);
    const completedCount = parseInt(completedExecutions[0].count, 10);
    const successRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return {
      workflow: {
        id: workflow.id,
        name: workflow.name,
        triggerEvent: workflow.trigger_event,
        isActive: workflow.is_active,
      },
      totalExecutions: totalCount,
      completedExecutions: completedCount,
      failedExecutions: parseInt(failedExecutions[0].count, 10),
      successRate: Math.round(successRate * 100) / 100,
      avgExecutionTimeSeconds: avgExecutionTime[0].avg_seconds ? Math.round(parseFloat(avgExecutionTime[0].avg_seconds)) : 0,
      stepFailures: stepFailures.map((row: any) => ({
        stepType: row.step_type,
        failureCount: parseInt(row.failure_count, 10),
      })),
      recentExecutions: recentExecutions.map((row: any) => ({
        id: row.id,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        triggerEvent: row.trigger_event,
      })),
    };
  }

  // ==================== EXECUTION MANAGEMENT ====================

  async cancelExecution(executionId: string, tenantDb: DataSource, reason?: string) {
    this.ensureTenantDb(tenantDb);

    const execution = await tenantDb.query(
      `SELECT * FROM workflow_executions WHERE id = $1`,
      [executionId],
    );

    if (execution.length === 0) {
      throw new NotFoundException('Workflow execution not found');
    }

    if (execution[0].status === 'completed' || execution[0].status === 'failed' || execution[0].status === 'cancelled') {
      throw new BadRequestException(`Cannot cancel execution with status: ${execution[0].status}`);
    }

    // Update execution status
    await tenantDb.query(
      `UPDATE workflow_executions 
       SET status = 'cancelled', 
           completed_at = NOW(),
           error_message = $2
       WHERE id = $1`,
      [executionId, reason || 'Cancelled by user'],
    );

    // Cancel any running steps
    await tenantDb.query(
      `UPDATE workflow_step_executions 
       SET status = 'cancelled', 
           completed_at = NOW(),
           error_message = $2
       WHERE execution_id = $1 AND status = 'running'`,
      [executionId, reason || 'Cancelled by user'],
    );

    this.logger.log(`Workflow execution ${executionId} cancelled: ${reason || 'User requested'}`);

    return {
      success: true,
      message: 'Workflow execution cancelled',
      executionId,
    };
  }

  async retryFailedStep(stepExecutionId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const stepExecution = await tenantDb.query(
      `SELECT * FROM workflow_step_executions WHERE id = $1`,
      [stepExecutionId],
    );

    if (stepExecution.length === 0) {
      throw new NotFoundException('Step execution not found');
    }

    if (stepExecution[0].status !== 'failed') {
      throw new BadRequestException(`Cannot retry step with status: ${stepExecution[0].status}`);
    }

    // Get the step details
    const step = await tenantDb.query(
      `SELECT * FROM workflow_steps WHERE id = $1`,
      [stepExecution[0].step_id],
    );

    if (step.length === 0) {
      throw new NotFoundException('Workflow step not found');
    }

    // Get the execution details
    const execution = await tenantDb.query(
      `SELECT * FROM workflow_executions WHERE id = $1`,
      [stepExecution[0].execution_id],
    );

    if (execution.length === 0) {
      throw new NotFoundException('Workflow execution not found');
    }

    // Reset the step execution
    await tenantDb.query(
      `UPDATE workflow_step_executions 
       SET status = 'pending', 
           started_at = NULL,
           completed_at = NULL,
           error_message = NULL,
           retry_count = retry_count + 1
       WHERE id = $1`,
      [stepExecutionId],
    );

    // If the workflow execution was failed, set it back to running
    if (execution[0].status === 'failed') {
      await tenantDb.query(
        `UPDATE workflow_executions 
         SET status = 'running', 
             completed_at = NULL,
             error_message = NULL
         WHERE id = $1`,
        [execution[0].id],
      );
    }

    this.logger.log(`Retrying failed step ${stepExecutionId}`);

    // Execute the step
    try {
      await this.executeStep(step[0], execution[0].trigger_data, tenantDb, stepExecutionId);
      
      return {
        success: true,
        message: 'Step retry initiated',
        stepExecutionId,
      };
    } catch (error: any) {
      this.logger.error(`Failed to retry step ${stepExecutionId}: ${error.message}`);
      throw error;
    }
  }
}

