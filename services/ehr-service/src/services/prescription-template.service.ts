import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PrescriptionTemplate, PrescriptionTemplateCategory } from '../entities/prescription-template.entity';
import { CreatePrescriptionTemplateDto, UpdatePrescriptionTemplateDto } from '../dto/prescription-template.dto';

@Injectable()
export class PrescriptionTemplateService {
  private readonly logger = new Logger(PrescriptionTemplateService.name);

  async findAll(
    tenantDb: DataSource,
    filters?: {
      category?: PrescriptionTemplateCategory;
      specialty?: string;
      isActive?: boolean;
      isDefault?: boolean;
      search?: string;
    }
  ): Promise<PrescriptionTemplate[]> {
    const repository = tenantDb.getRepository(PrescriptionTemplate);
    const queryBuilder = repository.createQueryBuilder('template');

    if (filters?.category) {
      queryBuilder.andWhere('template.category = :category', { category: filters.category });
    }

    if (filters?.specialty) {
      queryBuilder.andWhere('template.specialty = :specialty', { specialty: filters.specialty });
    }

    if (filters?.isActive !== undefined) {
      queryBuilder.andWhere('template.isActive = :isActive', { isActive: filters.isActive });
    }

    if (filters?.isDefault !== undefined) {
      queryBuilder.andWhere('template.isDefault = :isDefault', { isDefault: filters.isDefault });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(template.name ILIKE :search OR template.medicationName ILIKE :search OR template.genericName ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    queryBuilder.orderBy('template.isDefault', 'DESC').addOrderBy('template.usageCount', 'DESC').addOrderBy('template.name', 'ASC');

    return queryBuilder.getMany();
  }

  async findOne(id: string, tenantDb: DataSource): Promise<PrescriptionTemplate> {
    const repository = tenantDb.getRepository(PrescriptionTemplate);
    const template = await repository.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException(`Prescription template with ID ${id} not found`);
    }

    return template;
  }

  async create(
    createDto: CreatePrescriptionTemplateDto,
    tenantDb: DataSource,
    userId?: string
  ): Promise<PrescriptionTemplate> {
    const repository = tenantDb.getRepository(PrescriptionTemplate);
    const template = repository.create({
      ...createDto,
      createdBy: userId,
    });

    const saved = await repository.save(template);
    this.logger.log(`Created prescription template: ${saved.id} - ${saved.name}`);
    return saved;
  }

  async update(
    id: string,
    updateDto: UpdatePrescriptionTemplateDto,
    tenantDb: DataSource
  ): Promise<PrescriptionTemplate> {
    const repository = tenantDb.getRepository(PrescriptionTemplate);
    const template = await repository.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException(`Prescription template with ID ${id} not found`);
    }

    Object.assign(template, updateDto);
    const updated = await repository.save(template);
    this.logger.log(`Updated prescription template: ${updated.id} - ${updated.name}`);
    return updated;
  }

  async delete(id: string, tenantDb: DataSource): Promise<void> {
    const repository = tenantDb.getRepository(PrescriptionTemplate);
    const template = await repository.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException(`Prescription template with ID ${id} not found`);
    }

    // Soft delete by setting isActive to false
    template.isActive = false;
    await repository.save(template);
    this.logger.log(`Soft deleted prescription template: ${id} - ${template.name}`);
  }

  async incrementUsageCount(id: string, tenantDb: DataSource): Promise<void> {
    const repository = tenantDb.getRepository(PrescriptionTemplate);
    await repository.increment({ id }, 'usageCount', 1);
  }

  async getDefaultTemplates(tenantDb: DataSource): Promise<PrescriptionTemplate[]> {
    const repository = tenantDb.getRepository(PrescriptionTemplate);
    return repository.find({
      where: { isDefault: true, isActive: true },
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  async getByCategory(category: PrescriptionTemplateCategory, tenantDb: DataSource): Promise<PrescriptionTemplate[]> {
    const repository = tenantDb.getRepository(PrescriptionTemplate);
    return repository.find({
      where: { category, isActive: true },
      order: { isDefault: 'DESC', usageCount: 'DESC', name: 'ASC' },
    });
  }
}










