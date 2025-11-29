import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateScheduledReportDto,
  UpdateScheduledReportDto,
  ScheduledReportQueryDto,
} from '../dto/analytics.dto';
import { ScheduledReport } from '../entities/scheduled-report.entity';
import { ReportExecution, ExecutionType, ExecutionStatus } from '../entities/report-execution.entity';
import { ReportBuilderService } from './report-builder.service';
import { EmailService } from './email.service';

@Injectable()
export class ScheduledReportsService {
  private readonly logger = new Logger(ScheduledReportsService.name);

  constructor(
    private readonly reportBuilderService: ReportBuilderService,
    private readonly emailService: EmailService,
  ) {}

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  /**
   * Create a scheduled report
   */
  async createSchedule(tenantDb: DataSource, dto: CreateScheduledReportDto, userId?: string) {
    this.ensureTenantDb(tenantDb);

    // Calculate next run time based on schedule type
    const nextRun = this.calculateNextRun(dto.scheduleType, dto.scheduleConfig);

    const result = await tenantDb.query(
      `INSERT INTO scheduled_reports (
        template_id, name, schedule_type, schedule_config, recipients,
        recipient_roles, format, filters, is_active, next_run,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        dto.templateId ?? null,
        dto.name,
        dto.scheduleType,
        JSON.stringify(dto.scheduleConfig ?? {}),
        dto.recipients ?? [],
        dto.recipientRoles ?? [],
        dto.format ?? 'pdf',
        JSON.stringify(dto.filters ?? {}),
        dto.isActive ?? true,
        nextRun,
        userId ?? null,
      ],
    );

    return result[0];
  }

  /**
   * Update a scheduled report
   */
  async updateSchedule(tenantDb: DataSource, id: string, dto: UpdateScheduledReportDto) {
    this.ensureTenantDb(tenantDb);

    const schedule = await this.getSchedule(tenantDb, id);
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (dto.templateId !== undefined) {
      updates.push(`template_id = $${paramIndex}`);
      params.push(dto.templateId);
      paramIndex++;
    }
    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(dto.name);
      paramIndex++;
    }
    if (dto.scheduleType !== undefined) {
      updates.push(`schedule_type = $${paramIndex}`);
      params.push(dto.scheduleType);
      paramIndex++;
      // Recalculate next run if schedule type changed
      const scheduleConfig = dto.scheduleConfig ?? schedule.schedule_config;
      const nextRun = this.calculateNextRun(dto.scheduleType, scheduleConfig);
      updates.push(`next_run = $${paramIndex}`);
      params.push(nextRun);
      paramIndex++;
    }
    if (dto.scheduleConfig !== undefined) {
      updates.push(`schedule_config = $${paramIndex}::jsonb`);
      params.push(JSON.stringify(dto.scheduleConfig));
      paramIndex++;
      // Recalculate next run
      const scheduleType = dto.scheduleType ?? schedule.schedule_type;
      const nextRun = this.calculateNextRun(scheduleType, dto.scheduleConfig);
      updates.push(`next_run = $${paramIndex}`);
      params.push(nextRun);
      paramIndex++;
    }
    if (dto.recipients !== undefined) {
      updates.push(`recipients = $${paramIndex}`);
      params.push(dto.recipients);
      paramIndex++;
    }
    if (dto.recipientRoles !== undefined) {
      updates.push(`recipient_roles = $${paramIndex}`);
      params.push(dto.recipientRoles);
      paramIndex++;
    }
    if (dto.format !== undefined) {
      updates.push(`format = $${paramIndex}`);
      params.push(dto.format);
      paramIndex++;
    }
    if (dto.filters !== undefined) {
      updates.push(`filters = $${paramIndex}::jsonb`);
      params.push(JSON.stringify(dto.filters));
      paramIndex++;
    }
    if (dto.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(dto.isActive);
      paramIndex++;
    }

    if (updates.length === 0) {
      return schedule;
    }

    updates.push(`updated_at = NOW()`);
    const finalParamIndex = paramIndex;
    params.push(id);

    const query = `UPDATE scheduled_reports SET ${updates.join(', ')} WHERE id = $${finalParamIndex} RETURNING *`;
    const result = await tenantDb.query(query, params);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Scheduled report ${id} not found`);
    }

    return result[0];
  }

  /**
   * Get a scheduled report by ID
   */
  async getSchedule(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(`SELECT * FROM scheduled_reports WHERE id = $1`, [id]);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Scheduled report ${id} not found`);
    }

    return result[0];
  }

  /**
   * List scheduled reports
   */
  async listSchedules(tenantDb: DataSource, query: ScheduledReportQueryDto) {
    this.ensureTenantDb(tenantDb);

    const where: string[] = [];
    const params: any[] = [];
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    if (query.isActive !== undefined) {
      where.push(`is_active = $${params.length + 1}`);
      params.push(query.isActive);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const countResult = await tenantDb.query(
      `SELECT COUNT(*) as total FROM scheduled_reports ${whereClause}`,
      params,
    );
    const total = parseInt(countResult[0].total);

    const schedules = await tenantDb.query(
      `SELECT * FROM scheduled_reports ${whereClause} ORDER BY next_run ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    return {
      schedules,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Delete a scheduled report
   */
  async deleteSchedule(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(`DELETE FROM scheduled_reports WHERE id = $1 RETURNING *`, [id]);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Scheduled report ${id} not found`);
    }

    return { message: 'Scheduled report deleted successfully' };
  }

  /**
   * Manually execute a scheduled report
   */
  async executeSchedule(tenantDb: DataSource, scheduleId: string, userId?: string) {
    this.ensureTenantDb(tenantDb);

    const schedule = await this.getSchedule(tenantDb, scheduleId);

    if (!schedule.template_id) {
      throw new BadRequestException('Scheduled report must have a template ID');
    }

    // Create execution record
    const executionResult = await tenantDb.query(
      `INSERT INTO report_executions (
        scheduled_report_id, report_template_id, execution_type, executed_by,
        execution_time, status, filters_applied, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), 'running', $5, NOW(), NOW())
      RETURNING *`,
      [
        scheduleId,
        schedule.template_id,
        ExecutionType.SCHEDULED,
        userId ?? null,
        schedule.filters,
      ],
    );

    const executionId = executionResult[0].id;
    const startTime = Date.now();

    try {
      // Execute the report
      const result = await this.reportBuilderService.executeTemplate(
        tenantDb,
        schedule.template_id,
        {
          filters: schedule.filters,
          format: schedule.format,
        },
        userId,
      );

      const durationMs = Date.now() - startTime;

      // Update execution record
      await tenantDb.query(
        `UPDATE report_executions SET
          status = 'completed',
          duration_ms = $1,
          result_count = $2,
          file_url = $3,
          updated_at = NOW()
        WHERE id = $4`,
        [durationMs, result.total, null, executionId], // file_url would be set after export
      );

      // Update schedule
      const nextRun = this.calculateNextRun(schedule.schedule_type, schedule.schedule_config);
      await tenantDb.query(
        `UPDATE scheduled_reports SET
          last_run = NOW(),
          next_run = $1,
          run_count = run_count + 1,
          error_count = 0,
          last_error = NULL,
          updated_at = NOW()
        WHERE id = $2`,
        [nextRun, scheduleId],
      );

      // Send email to recipients if configured
      if (schedule.recipients && schedule.recipients.length > 0) {
        try {
          await this.sendScheduledReportEmail(
            tenantDb,
            schedule,
            result,
            executionId,
          );
        } catch (emailError: any) {
          this.logger.error(`Failed to send email for schedule ${scheduleId}: ${emailError.message}`);
          // Don't fail the execution if email fails
        }
      }

      return {
        executionId,
        ...result,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      await tenantDb.query(
        `UPDATE report_executions SET
          status = 'failed',
          duration_ms = $1,
          error_message = $2,
          updated_at = NOW()
        WHERE id = $3`,
        [durationMs, error.message, executionId],
      );

      await tenantDb.query(
        `UPDATE scheduled_reports SET
          error_count = error_count + 1,
          last_error = $1,
          updated_at = NOW()
        WHERE id = $2`,
        [error.message, scheduleId],
      );

      throw new BadRequestException(`Scheduled report execution failed: ${error.message}`);
    }
  }

  /**
   * Pause a scheduled report
   */
  async pauseSchedule(tenantDb: DataSource, scheduleId: string) {
    this.ensureTenantDb(tenantDb);

    // First verify the schedule exists
    const schedule = await this.getSchedule(tenantDb, scheduleId);
    
    const result = await tenantDb.query(
      `UPDATE scheduled_reports SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [scheduleId],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Scheduled report ${scheduleId} not found`);
    }

    return result[0];
  }

  /**
   * Resume a scheduled report
   */
  async resumeSchedule(tenantDb: DataSource, scheduleId: string) {
    this.ensureTenantDb(tenantDb);

    const schedule = await this.getSchedule(tenantDb, scheduleId);
    const nextRun = this.calculateNextRun(schedule.schedule_type, schedule.schedule_config);

    const result = await tenantDb.query(
      `UPDATE scheduled_reports SET is_active = true, next_run = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [nextRun, scheduleId],
    );

    return result[0];
  }

  /**
   * Get execution history for a scheduled report
   */
  async getScheduleHistory(tenantDb: DataSource, scheduleId: string, page: number = 1, limit: number = 10) {
    this.ensureTenantDb(tenantDb);

    const offset = (page - 1) * limit;

    const countResult = await tenantDb.query(
      `SELECT COUNT(*) as total FROM report_executions WHERE scheduled_report_id = $1`,
      [scheduleId],
    );
    const total = parseInt(countResult[0].total);

    const executions = await tenantDb.query(
      `SELECT * FROM report_executions
       WHERE scheduled_report_id = $1
       ORDER BY execution_time DESC
       LIMIT $2 OFFSET $3`,
      [scheduleId, limit, offset],
    );

    return {
      executions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Send scheduled report via email
   */
  private async sendScheduledReportEmail(
    tenantDb: DataSource,
    schedule: any,
    result: any,
    executionId: string,
  ): Promise<void> {
    const emailRecipients = schedule.recipients || [];
    
    if (emailRecipients.length === 0) {
      this.logger.warn(`No email recipients configured for schedule ${schedule.id}`);
      return;
    }

    const emailSubject = `Scheduled Report: ${schedule.name}`;
    const emailBody = `
Hello,

Your scheduled report "${schedule.name}" has been generated successfully.

Report Details:
- Report Name: ${schedule.name}
- Execution ID: ${executionId}
- Status: Completed
- Total Records: ${result.total || 0}
- Format: ${schedule.format.toUpperCase()}
- Generated At: ${new Date().toLocaleString()}

${result.fileUrl ? `Download Link: ${result.fileUrl}` : 'The report file is attached to this email.'}

Thank you for using MediCore EHR.

Best regards,
MediCore System
    `.trim();

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Scheduled Report: ${schedule.name}</h2>
        <p>Your scheduled report has been generated successfully.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Report Details:</strong></p>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Report Name:</strong> ${schedule.name}</li>
            <li><strong>Execution ID:</strong> ${executionId}</li>
            <li><strong>Status:</strong> Completed</li>
            <li><strong>Total Records:</strong> ${result.total || 0}</li>
            <li><strong>Format:</strong> ${schedule.format.toUpperCase()}</li>
            <li><strong>Generated At:</strong> ${new Date().toLocaleString()}</li>
          </ul>
        </div>
        ${result.fileUrl ? `<p><a href="${result.fileUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Download Report</a></p>` : '<p>The report file is attached to this email.</p>'}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 12px;">Thank you for using MediCore EHR.</p>
      </div>
    `;

    const attachments = result.fileBuffer
      ? [
          {
            filename: `report-${schedule.name.replace(/[^a-z0-9]/gi, '_')}-${executionId.substring(0, 8)}.${schedule.format === 'excel' ? 'xlsx' : schedule.format === 'pdf' ? 'pdf' : 'csv'}`,
            content: result.fileBuffer,
            contentType:
              schedule.format === 'pdf'
                ? 'application/pdf'
                : schedule.format === 'excel'
                  ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                  : 'text/csv',
          },
        ]
      : undefined;

    try {
      const emailResult = await this.emailService.sendBulkEmail(
        emailRecipients,
        emailSubject,
        emailBody,
        htmlBody,
        attachments,
      );

      if (emailResult.sent > 0) {
        this.logger.log(
          `Successfully sent scheduled report email to ${emailResult.sent} recipient(s) for schedule ${schedule.id}`,
        );
      }

      if (emailResult.failed > 0) {
        this.logger.warn(
          `Failed to send email to ${emailResult.failed} recipient(s): ${emailResult.errors.join('; ')}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`Failed to send scheduled report email: ${error.message}`);
      // Don't throw - email failure shouldn't break report execution
    }
  }

  /**
   * Calculate next run time based on schedule type
   */
  private calculateNextRun(scheduleType: string, scheduleConfig: Record<string, any>): Date {
    const now = new Date();
    const nextRun = new Date(now);

    switch (scheduleType) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        nextRun.setHours(scheduleConfig.hour ?? 9, scheduleConfig.minute ?? 0, 0, 0);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        nextRun.setHours(scheduleConfig.hour ?? 9, scheduleConfig.minute ?? 0, 0, 0);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(scheduleConfig.day ?? 1);
        nextRun.setHours(scheduleConfig.hour ?? 9, scheduleConfig.minute ?? 0, 0, 0);
        break;
      case 'quarterly':
        nextRun.setMonth(nextRun.getMonth() + 3);
        nextRun.setDate(scheduleConfig.day ?? 1);
        nextRun.setHours(scheduleConfig.hour ?? 9, scheduleConfig.minute ?? 0, 0, 0);
        break;
      case 'yearly':
        nextRun.setFullYear(nextRun.getFullYear() + 1);
        nextRun.setMonth(scheduleConfig.month ?? 0);
        nextRun.setDate(scheduleConfig.day ?? 1);
        nextRun.setHours(scheduleConfig.hour ?? 9, scheduleConfig.minute ?? 0, 0, 0);
        break;
      default:
        // Custom - would use cron expression from scheduleConfig
        nextRun.setDate(nextRun.getDate() + 1);
        break;
    }

    return nextRun;
  }
}

