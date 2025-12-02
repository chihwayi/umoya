import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CarePlanTemplateService {
  private readonly logger = new Logger(CarePlanTemplateService.name);

  constructor(private carePlanService: any) {} // Will inject CarePlanService

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection required');
    }
  }

  async createTemplate(templateData: any, tenantDb: DataSource, userId?: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO care_plan_templates (
        name, description, category, condition_code, condition_name,
        template_data, is_default, is_active, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *`,
      [
        templateData.name,
        templateData.description || null,
        templateData.category,
        templateData.conditionCode || null,
        templateData.conditionName || null,
        JSON.stringify(templateData.templateData),
        templateData.isDefault || false,
        templateData.isActive !== false,
        userId || null,
      ],
    );

    return result[0];
  }

  async getTemplates(category: string | null, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT * FROM care_plan_templates WHERE is_active = true`;
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
            const trimmed = rawData.trim();
            if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
              templateData = JSON.parse(trimmed);
            } else {
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

  async getTemplateById(templateId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(`SELECT * FROM care_plan_templates WHERE id = $1`, [templateId]);
    if (result.length === 0) {
      throw new NotFoundException('Template not found');
    }

    const template = result[0];

    // Handle template_data field
    let templateData: any = {};
    const rawData = template.template_data;

    if (rawData !== null && rawData !== undefined) {
      try {
        if (typeof rawData === 'string') {
          const trimmed = rawData.trim();
          if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
            templateData = JSON.parse(trimmed);
          }
        } else if (typeof rawData === 'object') {
          templateData = rawData;
        }
      } catch (error: any) {
        this.logger.warn(`Failed to parse template_data for template ${templateId}: ${error.message}`);
      }
    }

    return {
      ...template,
      template_data: templateData,
      templateData: templateData,
    };
  }

  async updateTemplate(templateId: string, updates: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const existing = await tenantDb.query(`SELECT * FROM care_plan_templates WHERE id = $1`, [templateId]);
    if (existing.length === 0) {
      throw new NotFoundException('Template not found');
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
    if (updates.conditionCode !== undefined) {
      updateFields.push(`condition_code = $${paramIndex++}`);
      values.push(updates.conditionCode);
    }
    if (updates.conditionName !== undefined) {
      updateFields.push(`condition_name = $${paramIndex++}`);
      values.push(updates.conditionName);
    }
    if (updates.templateData !== undefined) {
      updateFields.push(`template_data = $${paramIndex++}`);
      values.push(JSON.stringify(updates.templateData));
    }
    if (updates.isDefault !== undefined) {
      updateFields.push(`is_default = $${paramIndex++}`);
      values.push(updates.isDefault);
    }
    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (updateFields.length === 0) {
      return existing[0];
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(templateId);

    const result = await tenantDb.query(
      `UPDATE care_plan_templates SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    return result[0];
  }

  async applyTemplate(templateId: string, patientId: string, customizations: any, tenantDb: DataSource, userId?: string) {
    this.ensureTenantDb(tenantDb);

    const template = await this.getTemplateById(templateId, tenantDb);

    // Increment usage count
    await tenantDb.query(
      `UPDATE care_plan_templates SET usage_count = usage_count + 1 WHERE id = $1`,
      [templateId],
    );

    const templateData = template.templateData || template.template_data || {};

    // Merge template data with customizations
    const carePlanData = {
      templateId,
      name: customizations.name || templateData.name || 'Untitled Care Plan',
      description: customizations.description || templateData.description || null,
      category: templateData.category || 'general',
      startDate: customizations.startDate || new Date().toISOString().split('T')[0],
      endDate: customizations.endDate || null,
      targetCompletionDate: customizations.targetCompletionDate || null,
      primaryProviderId: customizations.primaryProviderId || userId || null,
      careTeam: customizations.careTeam || [],
      diagnosisCodes: customizations.diagnosisCodes || [],
      notes: customizations.notes || null,
      goals: templateData.goals || [],
      interventions: templateData.interventions || [],
    };

    // Create care plan from template using CarePlanService
    // We'll need to inject CarePlanService properly
    const CarePlanService = (await import('./care-plan.service')).CarePlanService;
    const carePlanService = new CarePlanService();
    
    return carePlanService.createCarePlan(patientId, carePlanData, tenantDb, userId);
  }
}

