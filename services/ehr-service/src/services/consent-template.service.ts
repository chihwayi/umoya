import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ConsentTemplate } from '../entities/consent-template.entity';
import { CreateConsentTemplateDto, UpdateConsentTemplateDto } from '../dto/consent.dto';

@Injectable()
export class ConsentTemplateService {
  private readonly logger = new Logger(ConsentTemplateService.name);

  async createTemplate(
    templateData: CreateConsentTemplateDto,
    userId: string,
    tenantDb: DataSource,
  ): Promise<ConsentTemplate> {
    const repository = tenantDb.getRepository(ConsentTemplate);

    // Check if template code already exists
    const existing = await repository.findOne({
      where: { templateCode: templateData.templateCode },
    });

    if (existing) {
      throw new BadRequestException(`Template with code '${templateData.templateCode}' already exists`);
    }

    const template = repository.create({
      ...templateData,
      createdBy: userId,
    });

    const saved = await repository.save(template);
    this.logger.log(`Consent template created: ${saved.id}`);

    return saved;
  }

  async getTemplates(
    filters: {
      consentType?: string;
      specialty?: string;
      languageCode?: string;
      isActive?: boolean;
      search?: string;
    },
    tenantDb: DataSource,
  ): Promise<ConsentTemplate[]> {
    const repository = tenantDb.getRepository(ConsentTemplate);
    const queryBuilder = repository.createQueryBuilder('template');

    if (filters.consentType) {
      queryBuilder.andWhere('template.consentType = :consentType', {
        consentType: filters.consentType,
      });
    }

    if (filters.specialty) {
      queryBuilder.andWhere('template.specialty = :specialty', {
        specialty: filters.specialty,
      });
    }

    if (filters.languageCode) {
      queryBuilder.andWhere('template.languageCode = :languageCode', {
        languageCode: filters.languageCode,
      });
    }

    if (filters.isActive !== undefined) {
      queryBuilder.andWhere('template.isActive = :isActive', {
        isActive: filters.isActive,
      });
    }

    if (filters.search) {
      queryBuilder.andWhere(
        '(template.templateName ILIKE :search OR template.title ILIKE :search OR template.templateCode ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    queryBuilder.orderBy('template.createdAt', 'DESC');

    return await queryBuilder.getMany();
  }

  async getTemplateById(id: string, tenantDb: DataSource): Promise<ConsentTemplate> {
    const repository = tenantDb.getRepository(ConsentTemplate);
    const template = await repository.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException(`Consent template not found: ${id}`);
    }

    return template;
  }

  async updateTemplate(
    id: string,
    updates: UpdateConsentTemplateDto,
    tenantDb: DataSource,
  ): Promise<ConsentTemplate> {
    const repository = tenantDb.getRepository(ConsentTemplate);
    const template = await this.getTemplateById(id, tenantDb);

    Object.assign(template, updates);
    const updated = await repository.save(template);

    this.logger.log(`Consent template updated: ${id}`);
    return updated;
  }

  async activateTemplate(id: string, tenantDb: DataSource): Promise<ConsentTemplate> {
    return await this.updateTemplate(id, { isActive: true }, tenantDb);
  }

  async deactivateTemplate(id: string, tenantDb: DataSource): Promise<ConsentTemplate> {
    return await this.updateTemplate(id, { isActive: false }, tenantDb);
  }

  async getTemplateVersions(templateCode: string, tenantDb: DataSource): Promise<ConsentTemplate[]> {
    const repository = tenantDb.getRepository(ConsentTemplate);
    return await repository.find({
      where: { templateCode },
      order: { version: 'DESC' },
    });
  }

  async duplicateTemplate(
    id: string,
    newVersion: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<ConsentTemplate> {
    const repository = tenantDb.getRepository(ConsentTemplate);
    const original = await this.getTemplateById(id, tenantDb);

    const duplicate = repository.create({
      ...original,
      id: undefined,
      version: newVersion,
      isActive: false,
      isDefault: false,
      createdBy: userId,
      createdAt: undefined,
      updatedAt: undefined,
    });

    const saved = await repository.save(duplicate);
    this.logger.log(`Template duplicated: ${id} → ${saved.id}`);

    return saved;
  }

  async previewTemplate(
    id: string,
    sampleData: Record<string, any>,
    tenantDb: DataSource,
  ): Promise<{ content: string; title: string }> {
    const template = await this.getTemplateById(id, tenantDb);

    let content = template.content;
    let title = template.title;

    // Replace placeholders with sample data
    Object.keys(sampleData).forEach((key) => {
      const placeholder = `{{${key}}}`;
      const value = sampleData[key] || '';
      content = content.replace(new RegExp(placeholder, 'g'), value);
      title = title.replace(new RegExp(placeholder, 'g'), value);
    });

    return { content, title };
  }

  async getDefaultTemplate(
    consentType: string,
    languageCode: string,
    tenantDb: DataSource,
  ): Promise<ConsentTemplate | null> {
    const repository = tenantDb.getRepository(ConsentTemplate);
    return await repository.findOne({
      where: {
        consentType,
        languageCode,
        isDefault: true,
        isActive: true,
      },
    });
  }
}

