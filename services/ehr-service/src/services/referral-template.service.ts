import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ReferralTemplateService {
  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new Error('Tenant database connection is required');
    }
  }

  async createTemplate(templateData: any, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO referral_templates (
        name, referral_type, specialty, template_data, is_default, is_active,
        created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *`,
      [
        templateData.name,
        templateData.referralType,
        templateData.specialty || null,
        JSON.stringify(templateData.templateData),
        templateData.isDefault || false,
        templateData.isActive !== undefined ? templateData.isActive : true,
        userId,
      ],
    );

    return result[0];
  }

  async getTemplates(filters: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT * FROM referral_templates WHERE is_active = true`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.referralType) {
      query += ` AND referral_type = $${paramIndex++}`;
      params.push(filters.referralType);
    }

    if (filters.specialty) {
      query += ` AND specialty = $${paramIndex++}`;
      params.push(filters.specialty);
    }

    query += ` ORDER BY is_default DESC, usage_count DESC, name ASC`;

    return tenantDb.query(query, params);
  }

  async getTemplateById(templateId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `SELECT * FROM referral_templates WHERE id = $1`,
      [templateId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Template not found');
    }

    return result[0];
  }

  async updateTemplate(templateId: string, updates: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const existing = await this.getTemplateById(templateId, tenantDb);

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.referralType !== undefined) {
      updateFields.push(`referral_type = $${paramIndex++}`);
      values.push(updates.referralType);
    }

    if (updates.specialty !== undefined) {
      updateFields.push(`specialty = $${paramIndex++}`);
      values.push(updates.specialty);
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
      return existing;
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(templateId);

    const result = await tenantDb.query(
      `UPDATE referral_templates SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    return result[0];
  }

  async deleteTemplate(templateId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `DELETE FROM referral_templates WHERE id = $1 RETURNING *`,
      [templateId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Template not found');
    }

    return { success: true, message: 'Template deleted' };
  }

  async applyTemplate(templateId: string, patientId: string, customizations: any, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const template = await this.getTemplateById(templateId, tenantDb);

    // Increment usage count
    await tenantDb.query(
      `UPDATE referral_templates SET usage_count = usage_count + 1 WHERE id = $1`,
      [templateId],
    );

    // Merge template data with customizations
    const templateData = typeof template.template_data === 'string' 
      ? JSON.parse(template.template_data) 
      : template.template_data;

    const referralData = {
      ...templateData,
      ...customizations,
      referralType: template.referral_type,
      specialty: template.specialty,
    };

    // Create referral using the merged data
    const result = await tenantDb.query(
      `INSERT INTO referrals (
        patient_id, referring_provider_id, referred_to_facility_name,
        referral_type, specialty, priority, urgency, reason,
        clinical_summary, requested_services, referral_date, status,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *`,
      [
        patientId,
        userId,
        referralData.referredToFacilityName || 'To be determined',
        referralData.referralType,
        referralData.specialty || null,
        referralData.priority || 'normal',
        referralData.urgency || 'routine',
        referralData.reason || '',
        referralData.clinicalSummary || null,
        referralData.requestedServices || null,
        referralData.referralDate || new Date().toISOString().split('T')[0],
        'draft',
      ],
    );

    return result[0];
  }
}


import { DataSource } from 'typeorm';

@Injectable()
export class ReferralTemplateService {
  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new Error('Tenant database connection is required');
    }
  }

  async createTemplate(templateData: any, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO referral_templates (
        name, referral_type, specialty, template_data, is_default, is_active,
        created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *`,
      [
        templateData.name,
        templateData.referralType,
        templateData.specialty || null,
        JSON.stringify(templateData.templateData),
        templateData.isDefault || false,
        templateData.isActive !== undefined ? templateData.isActive : true,
        userId,
      ],
    );

    return result[0];
  }

  async getTemplates(filters: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT * FROM referral_templates WHERE is_active = true`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.referralType) {
      query += ` AND referral_type = $${paramIndex++}`;
      params.push(filters.referralType);
    }

    if (filters.specialty) {
      query += ` AND specialty = $${paramIndex++}`;
      params.push(filters.specialty);
    }

    query += ` ORDER BY is_default DESC, usage_count DESC, name ASC`;

    return tenantDb.query(query, params);
  }

  async getTemplateById(templateId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `SELECT * FROM referral_templates WHERE id = $1`,
      [templateId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Template not found');
    }

    return result[0];
  }

  async updateTemplate(templateId: string, updates: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const existing = await this.getTemplateById(templateId, tenantDb);

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.referralType !== undefined) {
      updateFields.push(`referral_type = $${paramIndex++}`);
      values.push(updates.referralType);
    }

    if (updates.specialty !== undefined) {
      updateFields.push(`specialty = $${paramIndex++}`);
      values.push(updates.specialty);
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
      return existing;
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(templateId);

    const result = await tenantDb.query(
      `UPDATE referral_templates SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    return result[0];
  }

  async deleteTemplate(templateId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `DELETE FROM referral_templates WHERE id = $1 RETURNING *`,
      [templateId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Template not found');
    }

    return { success: true, message: 'Template deleted' };
  }

  async applyTemplate(templateId: string, patientId: string, customizations: any, userId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const template = await this.getTemplateById(templateId, tenantDb);

    // Increment usage count
    await tenantDb.query(
      `UPDATE referral_templates SET usage_count = usage_count + 1 WHERE id = $1`,
      [templateId],
    );

    // Merge template data with customizations
    const templateData = typeof template.template_data === 'string' 
      ? JSON.parse(template.template_data) 
      : template.template_data;

    const referralData = {
      ...templateData,
      ...customizations,
      referralType: template.referral_type,
      specialty: template.specialty,
    };

    // Create referral using the merged data
    const result = await tenantDb.query(
      `INSERT INTO referrals (
        patient_id, referring_provider_id, referred_to_facility_name,
        referral_type, specialty, priority, urgency, reason,
        clinical_summary, requested_services, referral_date, status,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *`,
      [
        patientId,
        userId,
        referralData.referredToFacilityName || 'To be determined',
        referralData.referralType,
        referralData.specialty || null,
        referralData.priority || 'normal',
        referralData.urgency || 'routine',
        referralData.reason || '',
        referralData.clinicalSummary || null,
        referralData.requestedServices || null,
        referralData.referralDate || new Date().toISOString().split('T')[0],
        'draft',
      ],
    );

    return result[0];
  }
}

