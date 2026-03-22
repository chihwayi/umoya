import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import {
  StaffNotification,
  StaffNotificationType,
  StaffNotificationPriority,
} from '../entities/staff-notification.entity';

export interface CreateStaffNotificationDto {
  recipientId: string;
  recipientRole?: string;
  notificationType: StaffNotificationType;
  title: string;
  message: string;
  priority?: StaffNotificationPriority;
  actionUrl?: string;
  actionLabel?: string;
  sourceEntityId?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

@Injectable()
export class StaffNotificationsService {
  private readonly logger = new Logger(StaffNotificationsService.name);

  constructor(private readonly tenantService: TenantService) {}

  // ── Core CRUD ─────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    dto: CreateStaffNotificationDto,
    tenantDb?: DataSource,
  ): Promise<StaffNotification> {
    const ds = tenantDb ?? await this.tenantService.getTenantDatabase(tenantId);
    const repo = ds.getRepository(StaffNotification);

    // Deduplicate: don't create a duplicate unread notification for the same
    // source entity and recipient within the last 24 hours.
    if (dto.sourceEntityId) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await repo.findOne({
        where: {
          tenantId,
          recipientId: dto.recipientId,
          sourceEntityId: dto.sourceEntityId,
          notificationType: dto.notificationType,
          read: false,
        },
      });
      if (existing && existing.createdAt > cutoff) {
        return existing; // already notified, skip
      }
    }

    return repo.save(
      repo.create({
        tenantId,
        ...dto,
        priority: dto.priority ?? 'normal',
      }),
    );
  }

  async getForUser(
    tenantId: string,
    userId: string,
    opts?: { read?: boolean; limit?: number },
  ): Promise<{ notifications: StaffNotification[]; unreadCount: number }> {
    const ds = await this.tenantService.getTenantDatabase(tenantId);
    const repo = ds.getRepository(StaffNotification);

    const qb = repo
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId', { tenantId })
      .andWhere('n.recipientId = :userId', { userId })
      .andWhere('(n.expiresAt IS NULL OR n.expiresAt > NOW())')
      .orderBy('n.createdAt', 'DESC')
      .take(opts?.limit ?? 50);

    if (opts?.read !== undefined) {
      qb.andWhere('n.read = :read', { read: opts.read });
    }

    const notifications = await qb.getMany();

    const unreadCount = await repo
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId', { tenantId })
      .andWhere('n.recipientId = :userId', { userId })
      .andWhere('n.read = false')
      .andWhere('(n.expiresAt IS NULL OR n.expiresAt > NOW())')
      .getCount();

    return { notifications, unreadCount };
  }

  async markAsRead(tenantId: string, notificationId: string, userId: string): Promise<void> {
    const ds = await this.tenantService.getTenantDatabase(tenantId);
    await ds.getRepository(StaffNotification).update(
      { id: notificationId, recipientId: userId },
      { read: true, readAt: new Date() },
    );
  }

  async markAllAsRead(tenantId: string, userId: string): Promise<void> {
    const ds = await this.tenantService.getTenantDatabase(tenantId);
    await ds
      .getRepository(StaffNotification)
      .createQueryBuilder()
      .update()
      .set({ read: true, readAt: new Date() })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('recipientId = :userId', { userId })
      .andWhere('read = false')
      .execute();
  }

  async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    const ds = await this.tenantService.getTenantDatabase(tenantId);
    return ds
      .getRepository(StaffNotification)
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId', { tenantId })
      .andWhere('n.recipientId = :userId', { userId })
      .andWhere('n.read = false')
      .andWhere('(n.expiresAt IS NULL OR n.expiresAt > NOW())')
      .getCount();
  }

  // ── Typed helpers used by other services ─────────────────────────────────

  async notifyTaskAssigned(
    tenantId: string,
    tenantDb: DataSource,
    opts: {
      assignedTo: string;
      taskId: string;
      taskTitle: string;
      patientName?: string;
      priority: string;
    },
  ): Promise<void> {
    const priorityMap: Record<string, StaffNotificationPriority> = {
      urgent: 'urgent', high: 'high', medium: 'normal', low: 'low',
    };
    await this.create(
      tenantId,
      {
        recipientId: opts.assignedTo,
        notificationType: 'task_assigned',
        title: `New task: ${opts.taskTitle}`,
        message: opts.patientName
          ? `You have been assigned a new ${opts.priority} priority task for patient ${opts.patientName}.`
          : `You have been assigned a new ${opts.priority} priority task.`,
        priority: priorityMap[opts.priority] ?? 'normal',
        actionUrl: `/nurse-tasks?highlight=${opts.taskId}`,
        actionLabel: 'Open Task',
        sourceEntityId: opts.taskId,
        metadata: { taskId: opts.taskId },
      },
      tenantDb,
    ).catch(e => this.logger.warn(`Task assignment notification failed: ${e?.message}`));
  }

  async notifyLabResultReady(
    tenantId: string,
    tenantDb: DataSource,
    opts: {
      recipientId: string;
      labOrderId: string;
      patientName?: string;
      testName?: string;
    },
  ): Promise<void> {
    await this.create(
      tenantId,
      {
        recipientId: opts.recipientId,
        notificationType: 'lab_result_ready',
        title: 'Lab result ready for review',
        message: opts.testName && opts.patientName
          ? `${opts.testName} results are ready for ${opts.patientName}.`
          : 'A lab result is ready for your review.',
        priority: 'normal',
        actionUrl: `/lab-orders/${opts.labOrderId}`,
        actionLabel: 'View Result',
        sourceEntityId: opts.labOrderId,
        metadata: { labOrderId: opts.labOrderId },
      },
      tenantDb,
    ).catch(e => this.logger.warn(`Lab result notification failed: ${e?.message}`));
  }
}
