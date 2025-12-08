import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class MessageTemplateService {
  private readonly logger = new Logger(MessageTemplateService.name);

  async createTemplate(templateData: any, tenantDb: DataSource): Promise<any> {
    try {
      const {
        name,
        category,
        subject_template,
        message_template,
        variables = [],
        is_default = false,
        is_active = true,
        created_by,
      } = templateData;

      const result = await tenantDb.query(
        `INSERT INTO message_templates (name, category, subject_template, message_template, variables, is_default, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [name, category, subject_template, message_template, JSON.stringify(variables), is_default, is_active, created_by || null]
      );

      this.logger.log(`Template created: ${result[0].id} - ${name}`);
      return result[0];
    } catch (error) {
      this.logger.error(`Error creating template: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getTemplates(category: string | null, tenantDb: DataSource): Promise<any> {
    try {
      let query = `SELECT * FROM message_templates WHERE is_active = true`;
      const params: any[] = [];

      if (category) {
        query += ` AND category = $1`;
        params.push(category);
      }

      query += ` ORDER BY is_default DESC, usage_count DESC, name ASC`;

      const templates = await tenantDb.query(query, params);
      return templates;
    } catch (error) {
      this.logger.error(`Error getting templates: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getTemplateById(templateId: string, tenantDb: DataSource): Promise<any> {
    try {
      const result = await tenantDb.query(
        `SELECT * FROM message_templates WHERE id = $1`,
        [templateId]
      );

      if (result.length === 0) {
        throw new NotFoundException('Template not found');
      }

      return result[0];
    } catch (error) {
      this.logger.error(`Error getting template: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateTemplate(templateId: string, updates: any, tenantDb: DataSource): Promise<any> {
    try {
      const {
        name,
        category,
        subject_template,
        message_template,
        variables,
        is_default,
        is_active,
      } = updates;

      const result = await tenantDb.query(
        `UPDATE message_templates 
         SET name = COALESCE($2, name),
             category = COALESCE($3, category),
             subject_template = COALESCE($4, subject_template),
             message_template = COALESCE($5, message_template),
             variables = COALESCE($6, variables),
             is_default = COALESCE($7, is_default),
             is_active = COALESCE($8, is_active),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          templateId,
          name || null,
          category || null,
          subject_template || null,
          message_template || null,
          variables ? JSON.stringify(variables) : null,
          is_default !== undefined ? is_default : null,
          is_active !== undefined ? is_active : null,
        ]
      );

      if (result.length === 0) {
        throw new NotFoundException('Template not found');
      }

      return result[0];
    } catch (error) {
      this.logger.error(`Error updating template: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteTemplate(templateId: string, tenantDb: DataSource): Promise<void> {
    try {
      await tenantDb.query(
        `UPDATE message_templates SET is_active = false WHERE id = $1`,
        [templateId]
      );

      this.logger.log(`Template deactivated: ${templateId}`);
    } catch (error) {
      this.logger.error(`Error deleting template: ${error.message}`, error.stack);
      throw error;
    }
  }

  async applyTemplate(templateId: string, variables: any, tenantDb: DataSource): Promise<any> {
    try {
      const template = await this.getTemplateById(templateId, tenantDb);

      // Replace variables in subject and message
      let subject = template.subject_template;
      let message = template.message_template;

      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        subject = subject.replace(new RegExp(placeholder, 'g'), value as string);
        message = message.replace(new RegExp(placeholder, 'g'), value as string);
      }

      // Increment usage count
      await tenantDb.query(
        `UPDATE message_templates SET usage_count = usage_count + 1 WHERE id = $1`,
        [templateId]
      );

      return {
        subject,
        message,
        template_id: templateId,
        template_name: template.name,
      };
    } catch (error) {
      this.logger.error(`Error applying template: ${error.message}`, error.stack);
      throw error;
    }
  }
}







