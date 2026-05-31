import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(
    userId: string,
    action: AuditAction | string,
    resource: string,
    resourceId?: string,
    oldValues?: any,
    newValues?: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const auditLog = this.auditLogRepository.create({
      userId,
      action: action as AuditAction,
      resource,
      resourceId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
    });

    return this.auditLogRepository.save(auditLog);
  }

  async getAuditLogs(page = 1, limit = 50, userId?: string, action?: string) {
    const query = this.auditLogRepository.createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .orderBy('audit.createdAt', 'DESC');

    if (userId) {
      query.andWhere('audit.userId = :userId', { userId });
    }

    if (action) {
      query.andWhere('audit.action = :action', { action });
    }

    const [logs, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Audit trail for a single resource (e.g. all events for one tenant).
   * Tenant lifecycle + user events are logged with resourceId = tenant.id.
   */
  async getResourceAuditLogs(resourceId: string, page = 1, limit = 50) {
    const [logs, total] = await this.auditLogRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .where('audit.resourceId = :resourceId', { resourceId })
      .orderBy('audit.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        resource: l.resource,
        resourceId: l.resourceId,
        oldValues: l.oldValues,
        newValues: l.newValues,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt,
        actor: l.user
          ? { id: l.user.id, email: l.user.email, name: `${l.user.firstName} ${l.user.lastName}`.trim() }
          : null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Best-effort audit write — never throws into the caller's request path. */
  async safeLog(
    userId: string | null,
    action: AuditAction | string,
    resource: string,
    resourceId?: string,
    oldValues?: any,
    newValues?: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      if (!userId) return;
      await this.log(userId, action, resource, resourceId, oldValues, newValues, ipAddress, userAgent);
    } catch {
      /* auditing must never break the operation it records */
    }
  }
}