import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ClinicalNoteTemplate } from '../entities/clinical-note-template.entity';
import { TenantService } from './tenant.service';

@Injectable()
export class ClinicalTemplateService {
  private readonly logger = new Logger(ClinicalTemplateService.name);

  constructor(private tenantService: TenantService) {}

  private async getRepository(tenantId: string): Promise<Repository<ClinicalNoteTemplate>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    if (!connection) {
      throw new Error(`Failed to connect to tenant database: ${tenantId}`);
    }
    return connection.getRepository(ClinicalNoteTemplate);
  }

  async findAll(tenantId: string, filters?: {
    category?: string;
    specialty?: string;
    isActive?: boolean;
    isDefault?: boolean;
  }): Promise<ClinicalNoteTemplate[]> {
    const repository = await this.getRepository(tenantId);
    const queryBuilder = repository.createQueryBuilder('template');

    if (filters?.category) {
      queryBuilder.andWhere('template.category = :category', { category: filters.category });
    }

    if (filters?.specialty) {
      queryBuilder.andWhere('template.specialty = :specialty', { specialty: filters.specialty });
    }

    if (typeof filters?.isActive !== 'undefined') {
      queryBuilder.andWhere('template.isActive = :isActive', { isActive: filters.isActive });
    }

    if (typeof filters?.isDefault !== 'undefined') {
      queryBuilder.andWhere('template.isDefault = :isDefault', { isDefault: filters.isDefault });
    }

    return queryBuilder
      .orderBy('template.isDefault', 'DESC')
      .addOrderBy('template.name', 'ASC')
      .getMany();
  }

  async findOne(id: string, tenantId: string): Promise<ClinicalNoteTemplate> {
    const repository = await this.getRepository(tenantId);
    const template = await repository.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException(`Clinical template with ID ${id} not found`);
    }

    return template;
  }

  async getDefaults(tenantId: string): Promise<ClinicalNoteTemplate[]> {
    const repository = await this.getRepository(tenantId);
    return repository.find({
      where: { isDefault: true, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findByCategory(category: string, tenantId: string): Promise<ClinicalNoteTemplate[]> {
    const repository = await this.getRepository(tenantId);
    return repository.find({
      where: { category, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async create(templateData: any, tenantId: string, userId?: string): Promise<ClinicalNoteTemplate> {
    const repository = await this.getRepository(tenantId);
    const template = repository.create({
      name: templateData.name,
      category: templateData.category || 'general',
      content: templateData.content,
      variables: templateData.variables || [],
      specialty: templateData.specialty,
      isDefault: templateData.isDefault || false,
      isActive: templateData.isActive !== false,
      createdBy: userId,
    });

    return repository.save(template);
  }

  async update(id: string, templateData: any, tenantId: string): Promise<ClinicalNoteTemplate> {
    const template = await this.findOne(id, tenantId);
    const repository = await this.getRepository(tenantId);

    Object.assign(template, {
      name: templateData.name ?? template.name,
      category: templateData.category ?? template.category,
      content: templateData.content ?? template.content,
      variables: templateData.variables ?? template.variables,
      specialty: templateData.specialty ?? template.specialty,
      isDefault: templateData.isDefault ?? template.isDefault,
      isActive: templateData.isActive ?? template.isActive,
    });

    return repository.save(template);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const template = await this.findOne(id, tenantId);
    const repository = await this.getRepository(tenantId);

    // Soft delete by setting isActive to false
    template.isActive = false;
    await repository.save(template);
  }

  async applyTemplate(
    templateId: string,
    variables: Record<string, string>,
    tenantId: string,
    context?: Record<string, any>,
  ): Promise<string> {
    const template = await this.findOne(templateId, tenantId);
    let content = template.content;

    // Replace variables in template
    if (template.variables && Array.isArray(template.variables)) {
      for (const variable of template.variables) {
        const varName = typeof variable === 'string' ? variable : variable.name || variable;
        const varValue = variables[varName] || context?.[varName] || '';
        const placeholder = `{{${varName}}}`;
        content = content.replace(new RegExp(placeholder, 'g'), varValue);
      }
    }

    // Replace common context variables
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        const placeholder = `{{${key}}}`;
        content = content.replace(new RegExp(placeholder, 'g'), String(value || ''));
      }
    }

    // Increment usage count
    const repository = await this.getRepository(tenantId);
    template.usageCount = (template.usageCount || 0) + 1;
    await repository.save(template);

    return content;
  }
}

