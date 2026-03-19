import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NurseTask } from '../entities/nurse-task.entity';
import { CareGapDetection } from '../entities/care-gap-detection.entity';

export interface CreateNurseTaskDto {
  patientId: string;
  assignedTo?: string;
  assignedBySystem?: boolean;
  taskType: string;
  priority?: string;
  title: string;
  description?: string;
  dueDate?: string;
  sourceType?: string;
  sourceId?: string;
}

export interface UpdateNurseTaskDto {
  status?: string;
  completedBy?: string;
  completionNotes?: string;
  assignedTo?: string;
  priority?: string;
  dueDate?: string;
}

@Injectable()
export class NurseTaskService {
  private readonly logger = new Logger(NurseTaskService.name);

  async createTask(dto: CreateNurseTaskDto, tenantDb: DataSource): Promise<NurseTask> {
    const repo = tenantDb.getRepository(NurseTask);
    const task = repo.create({
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      status: 'pending',
    });
    return repo.save(task);
  }

  async updateTask(
    taskId: string,
    dto: UpdateNurseTaskDto,
    tenantDb: DataSource,
  ): Promise<NurseTask> {
    const repo = tenantDb.getRepository(NurseTask);
    const task = await repo.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`NurseTask ${taskId} not found`);

    if (dto.status) task.status = dto.status;
    if (dto.completedBy) task.completedBy = dto.completedBy;
    if (dto.completionNotes) task.completionNotes = dto.completionNotes;
    if (dto.assignedTo !== undefined) task.assignedTo = dto.assignedTo;
    if (dto.priority) task.priority = dto.priority;
    if (dto.dueDate) task.dueDate = new Date(dto.dueDate);

    if (dto.status === 'completed' && !task.completedAt) {
      task.completedAt = new Date();
    }

    return repo.save(task);
  }

  /** Tasks for a specific nurse (assigned_to), filtered by status */
  async getTasksForNurse(
    nurseId: string,
    tenantDb: DataSource,
    status?: string,
  ): Promise<NurseTask[]> {
    const qb = tenantDb.getRepository(NurseTask)
      .createQueryBuilder('t')
      .where('t.assigned_to = :nurseId', { nurseId })
      .orderBy('t.priority', 'DESC')
      .addOrderBy('t.due_date', 'ASC');

    if (status) qb.andWhere('t.status = :status', { status });
    return qb.getMany();
  }

  /** Tasks for a patient */
  async getTasksForPatient(
    patientId: string,
    tenantDb: DataSource,
  ): Promise<NurseTask[]> {
    return tenantDb.getRepository(NurseTask).find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Pending tasks across the whole tenant — used by the nurse worklist */
  async getPendingTasks(tenantDb: DataSource, limit = 50): Promise<NurseTask[]> {
    return tenantDb.getRepository(NurseTask).find({
      where: { status: 'pending' },
      order: { priority: 'DESC', dueDate: 'ASC' },
      take: limit,
    });
  }

  // ── Care gap detections ───────────────────────────────────────────────────

  async createCareGap(
    data: Partial<CareGapDetection>,
    tenantDb: DataSource,
  ): Promise<CareGapDetection> {
    const repo = tenantDb.getRepository(CareGapDetection);
    const gap = repo.create(data);
    return repo.save(gap);
  }

  async getCareGapsForPatient(
    patientId: string,
    tenantDb: DataSource,
    status?: string,
  ): Promise<CareGapDetection[]> {
    const where: Record<string, any> = { patientId };
    if (status) where.status = status;
    return tenantDb.getRepository(CareGapDetection).find({
      where,
      order: { priority: 'DESC', detectedAt: 'DESC' },
    });
  }

  async updateCareGapStatus(
    gapId: string,
    status: string,
    tenantDb: DataSource,
  ): Promise<CareGapDetection> {
    const repo = tenantDb.getRepository(CareGapDetection);
    const gap = await repo.findOne({ where: { id: gapId } });
    if (!gap) throw new NotFoundException(`CareGapDetection ${gapId} not found`);
    gap.status = status;
    return repo.save(gap);
  }
}
