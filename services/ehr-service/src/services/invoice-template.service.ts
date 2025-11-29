import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateInvoiceTemplateDto, UpdateInvoiceTemplateDto } from '../dto/finance.dto';

@Injectable()
export class InvoiceTemplateService {
  private normalizeTemplate(row: any) {
    if (!row) return null;
    let content = row.template_content;
    let variables = row.variables;

    try {
      content = typeof content === 'string' ? JSON.parse(content) : content || {};
    } catch {
      content = {};
    }

    try {
      variables = typeof variables === 'string' ? JSON.parse(variables) : variables || [];
    } catch {
      variables = [];
    }

    return {
      ...row,
      template_content: content,
      variables,
    };
  }

  async listTemplates(tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `SELECT * FROM invoice_templates ORDER BY is_default DESC, updated_at DESC`,
    );
    return rows.map((row: any) => this.normalizeTemplate(row));
  }

  async getTemplateById(tenantDb: DataSource, id: string) {
    const [row] = await tenantDb.query(`SELECT * FROM invoice_templates WHERE id = $1`, [id]);
    if (!row) {
      throw new NotFoundException(`Invoice template ${id} not found`);
    }
    return this.normalizeTemplate(row);
  }

  async getDefaultTemplate(tenantDb: DataSource) {
    const [row] = await tenantDb.query(
      `SELECT * FROM invoice_templates WHERE is_default = true AND is_active = true ORDER BY updated_at DESC LIMIT 1`,
    );
    return row ? this.normalizeTemplate(row) : null;
  }

  async createTemplate(tenantDb: DataSource, dto: CreateInvoiceTemplateDto, userId?: string) {
    const isDefault = dto.isDefault ?? false;
    const [template] = await tenantDb.query(
      `INSERT INTO invoice_templates (name, template_content, variables, is_default, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dto.name,
        JSON.stringify(dto.templateContent || {}),
        JSON.stringify(dto.variables || []),
        isDefault,
        dto.isActive ?? true,
        userId || null,
      ],
    );

    if (isDefault) {
      await this.setDefaultTemplate(tenantDb, template.id);
    }

    return this.normalizeTemplate(template);
  }

  async updateTemplate(
    tenantDb: DataSource,
    id: string,
    dto: UpdateInvoiceTemplateDto,
  ) {
    await this.getTemplateById(tenantDb, id);

    const fields: string[] = [];
    const params: any[] = [];

    if (dto.name !== undefined) {
      params.push(dto.name);
      fields.push(`name = $${params.length}`);
    }
    if (dto.templateContent !== undefined) {
      params.push(JSON.stringify(dto.templateContent || {}));
      fields.push(`template_content = $${params.length}`);
    }
    if (dto.variables !== undefined) {
      params.push(JSON.stringify(dto.variables || []));
      fields.push(`variables = $${params.length}`);
    }
    if (dto.isActive !== undefined) {
      params.push(dto.isActive);
      fields.push(`is_active = $${params.length}`);
    }

    if (fields.length === 0) {
      return this.getTemplateById(tenantDb, id);
    }

    params.push(id);
    const [updated] = await tenantDb.query(
      `UPDATE invoice_templates SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${
        params.length
      } RETURNING *`,
      params,
    );

    if (dto.isDefault === true) {
      await this.setDefaultTemplate(tenantDb, id);
      updated.is_default = true;
    } else if (dto.isDefault === false) {
      await tenantDb.query(
        `UPDATE invoice_templates SET is_default = false, updated_at = NOW() WHERE id = $1`,
        [id],
      );
      updated.is_default = false;
    }

    return this.normalizeTemplate(updated);
  }

  async setDefaultTemplate(tenantDb: DataSource, id: string) {
    await this.getTemplateById(tenantDb, id);
    await tenantDb.query('BEGIN');
    try {
      await tenantDb.query(`UPDATE invoice_templates SET is_default = false WHERE id <> $1`, [id]);
      const [updated] = await tenantDb.query(
        `UPDATE invoice_templates SET is_default = true, is_active = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id],
      );
      await tenantDb.query('COMMIT');
      return this.normalizeTemplate(updated);
    } catch (error) {
      await tenantDb.query('ROLLBACK');
      throw error;
    }
  }

  async resolveTemplateForPdf(tenantDb: DataSource, templateId?: string) {
    if (templateId) {
      try {
        const template = await this.getTemplateById(tenantDb, templateId);
        if (template?.is_active) {
          return template;
        }
      } catch {
        // ignore and fallback
      }
    }
    return this.getDefaultTemplate(tenantDb);
  }
}


