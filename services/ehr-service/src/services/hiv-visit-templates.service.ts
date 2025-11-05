import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HivVisitTemplatesService {
  private readonly logger = new Logger(HivVisitTemplatesService.name);

  /**
   * Get visit templates
   */
  async getTemplates(tenantDb: DataSource, visitType?: string) {
    let query = `SELECT * FROM hiv_visit_templates WHERE is_default = true`;
    const params: any[] = [];

    if (visitType) {
      query += ` OR visit_type = $1`;
      params.push(visitType);
    }

    query += ` ORDER BY is_default DESC, name ASC`;

    const templates = await tenantDb.query(query, params);
    return { templates };
  }

  /**
   * Create visit template
   */
  async createTemplate(templateData: any, tenantDb: DataSource, userId?: string) {
    const result = await tenantDb.query(
      `INSERT INTO hiv_visit_templates (name, description, visit_type, template_data, is_default, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        templateData.name,
        templateData.description || null,
        templateData.visitType || null,
        JSON.stringify(templateData.templateData),
        templateData.isDefault || false,
        userId || null
      ]
    );
    return result[0];
  }

  /**
   * Apply template to form
   */
  applyTemplate(template: any, currentForm: any): any {
    const templateData = typeof template.template_data === 'string' 
      ? JSON.parse(template.template_data)
      : template.template_data;

    // Merge template data with current form, preserving user-entered values
    const merged = { ...currentForm };
    
    for (const key in templateData) {
      if (templateData[key] !== null && templateData[key] !== undefined && templateData[key] !== '') {
        // Only apply if current form value is empty
        if (!merged[key] || merged[key] === '' || merged[key] === null) {
          merged[key] = templateData[key];
        }
      }
    }

    return merged;
  }
}

