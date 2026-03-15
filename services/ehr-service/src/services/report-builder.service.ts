import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
  ReportTemplateQueryDto,
  ExecuteReportDto,
} from '../dto/analytics.dto';
import { ReportTemplate } from '../entities/report-template.entity';
import { ReportExecution, ExecutionType, ExecutionStatus } from '../entities/report-execution.entity';
import { ReportExportService } from './report-export.service';
import { FileStorageService } from './file-storage.service';

@Injectable()
export class ReportBuilderService {
  private readonly logger = new Logger(ReportBuilderService.name);

  constructor(
    private readonly reportExportService: ReportExportService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  /**
   * Create a new report template
   */
  async createTemplate(tenantDb: DataSource, dto: CreateReportTemplateDto, userId?: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO report_templates (
        name, description, report_type, category, config, query_config,
        visualization_config, is_public, is_default, created_by,
        shared_with_roles, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        dto.name,
        dto.description ?? null,
        dto.reportType,
        dto.category ?? null,
        JSON.stringify(dto.config ?? {}),
        JSON.stringify(dto.queryConfig ?? {}),
        JSON.stringify(dto.visualizationConfig ?? {}),
        dto.isPublic ?? false,
        dto.isDefault ?? false,
        userId ?? null,
        dto.sharedWithRoles ?? [],
      ],
    );

    return result[0];
  }

  /**
   * Update a report template
   */
  async updateTemplate(tenantDb: DataSource, id: string, dto: UpdateReportTemplateDto) {
    this.ensureTenantDb(tenantDb);

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(dto.name);
      paramIndex++;
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(dto.description);
      paramIndex++;
    }
    if (dto.reportType !== undefined) {
      updates.push(`report_type = $${paramIndex}`);
      params.push(dto.reportType);
      paramIndex++;
    }
    if (dto.category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      params.push(dto.category);
      paramIndex++;
    }
    if (dto.config !== undefined) {
      updates.push(`config = $${paramIndex}::jsonb`);
      params.push(JSON.stringify(dto.config));
      paramIndex++;
    }
    if (dto.queryConfig !== undefined) {
      updates.push(`query_config = $${paramIndex}::jsonb`);
      params.push(JSON.stringify(dto.queryConfig));
      paramIndex++;
    }
    if (dto.visualizationConfig !== undefined) {
      updates.push(`visualization_config = $${paramIndex}::jsonb`);
      params.push(JSON.stringify(dto.visualizationConfig));
      paramIndex++;
    }
    if (dto.isPublic !== undefined) {
      updates.push(`is_public = $${paramIndex}`);
      params.push(dto.isPublic);
      paramIndex++;
    }
    if (dto.isDefault !== undefined) {
      updates.push(`is_default = $${paramIndex}`);
      params.push(dto.isDefault);
      paramIndex++;
    }
    if (dto.sharedWithRoles !== undefined) {
      updates.push(`shared_with_roles = $${paramIndex}`);
      params.push(dto.sharedWithRoles);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.getTemplate(tenantDb, id);
    }

    updates.push(`updated_at = NOW()`);
    const finalParamIndex = paramIndex;
    params.push(id);

    const result = await tenantDb.query(
      `UPDATE report_templates SET ${updates.join(', ')} WHERE id = $${finalParamIndex} RETURNING *`,
      params,
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Report template ${id} not found`);
    }

    return result[0];
  }

  /**
   * Get a report template by ID
   */
  async getTemplate(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(`SELECT * FROM report_templates WHERE id = $1`, [id]);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Report template ${id} not found`);
    }

    return result[0];
  }

  /**
   * List report templates with filters
   */
  async listTemplates(tenantDb: DataSource, query: ReportTemplateQueryDto) {
    this.ensureTenantDb(tenantDb);

    const where: string[] = [];
    const params: any[] = [];
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    if (query.reportType) {
      where.push(`report_type = $${params.length + 1}`);
      params.push(query.reportType);
    }
    if (query.category) {
      where.push(`category = $${params.length + 1}`);
      params.push(query.category);
    }
    if (query.isPublic !== undefined) {
      where.push(`is_public = $${params.length + 1}`);
      params.push(query.isPublic);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const countResult = await tenantDb.query(
      `SELECT COUNT(*) as total FROM report_templates ${whereClause}`,
      params,
    );
    const total = parseInt(countResult[0].total);

    const templates = await tenantDb.query(
      `SELECT * FROM report_templates ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    return {
      templates,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Delete a report template
   */
  async deleteTemplate(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(`DELETE FROM report_templates WHERE id = $1 RETURNING *`, [id]);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Report template ${id} not found`);
    }

    return { message: 'Template deleted successfully' };
  }

  /**
   * Execute a report template
   */
  async executeTemplate(
    tenantDb: DataSource,
    templateId: string,
    dto: ExecuteReportDto,
    userId?: string,
  ) {
    this.ensureTenantDb(tenantDb);

    const template = await this.getTemplate(tenantDb, templateId);

    // Create execution record
    const executionResult = await tenantDb.query(
      `INSERT INTO report_executions (
        report_template_id, execution_type, executed_by, execution_time,
        status, filters_applied, created_at, updated_at
      ) VALUES ($1, $2, $3, NOW(), 'running', $4, NOW(), NOW())
      RETURNING *`,
      [templateId, ExecutionType.MANUAL, userId ?? null, JSON.stringify(dto.filters ?? {})],
    );

    const executionId = executionResult[0].id;
    const startTime = Date.now();

    try {
      // Execute the report query based on template configuration
      const queryConfig = template.query_config || {};
      const data = await this.executeReportQuery(tenantDb, queryConfig, dto.filters ?? {}, dto);

      const durationMs = Date.now() - startTime;

      // Export if format is specified
      let fileBuffer: Buffer | null = null;
      let fileUrl: string | null = null;
      const format = dto.format || 'json';
      const columns = queryConfig.columns || Object.keys(data[0] || {});

      if (format !== 'json' && data.length > 0) {
        try {
          switch (format) {
            case 'pdf':
              fileBuffer = await this.reportExportService.exportToPdf(data, columns, template.name, {
                templateId,
                executionId,
              });
              break;
            case 'excel':
              fileBuffer = await this.reportExportService.exportToExcel(data, columns, template.name, {
                templateId,
                executionId,
              });
              break;
            case 'csv':
              const csvContent = await this.reportExportService.exportToCsv(data, columns, template.name);
              fileBuffer = Buffer.from(csvContent, 'utf-8');
              break;
          }

          // Store file in S3 and get URL
          if (fileBuffer) {
            fileUrl = await this.fileStorageService.storeReportFile(
              fileBuffer,
              template.name,
              format,
              executionId,
            );
            if (fileUrl) {
              this.logger.log(`Report file stored: ${fileUrl}`);
            }
          }
        } catch (exportError: any) {
          this.logger.error(`Export failed: ${exportError.message}`);
        }
      }

      // Update execution record
      await tenantDb.query(
        `UPDATE report_executions SET
          status = 'completed',
          duration_ms = $1,
          result_count = $2,
          file_url = $3,
          updated_at = NOW()
        WHERE id = $4`,
        [durationMs, data.length, fileUrl, executionId],
      );

      // Update template usage
      await tenantDb.query(
        `UPDATE report_templates SET
          usage_count = usage_count + 1,
          last_used = NOW(),
          updated_at = NOW()
        WHERE id = $1`,
        [templateId],
      );

      return {
        executionId,
        data: format === 'json' ? data : undefined,
        fileBuffer: format !== 'json' ? fileBuffer : undefined,
        format,
        total: data.length,
        durationMs,
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
      throw new BadRequestException(`Report execution failed: ${error.message}`);
    }
  }

  /**
   * Execute the actual report query
   */
  private async executeReportQuery(
    tenantDb: DataSource,
    queryConfig: Record<string, any>,
    filters: Record<string, any>,
    options: ExecuteReportDto,
  ): Promise<any[]> {
    // This is a simplified version - in production, you'd build dynamic SQL based on queryConfig
    // For now, we'll support basic table queries

    const table = queryConfig.table || 'appointments';
    const columns = queryConfig.columns || ['*'];
    const whereConditions: string[] = [];
    const params: any[] = [];

    // Apply filters
    if (filters.dateFrom) {
      const dateColumn = table === 'billing' ? 'invoice_date' : table === 'appointments' ? 'appointment_date' : 'created_at';
      whereConditions.push(`${dateColumn} >= $${params.length + 1}`);
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      const dateColumn = table === 'billing' ? 'invoice_date' : table === 'appointments' ? 'appointment_date' : 'created_at';
      whereConditions.push(`${dateColumn} <= $${params.length + 1}`);
      params.push(filters.dateTo);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const limit = options.limit ?? 100;
    const offset = (options.page ?? 1 - 1) * limit;

    const query = `SELECT ${columns.join(', ')} FROM ${table} ${whereClause} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const result = await tenantDb.query(query, [...params, limit, offset]);

    return result;
  }

  /**
   * Clone a report template
   */
  async cloneTemplate(tenantDb: DataSource, templateId: string, newName: string, userId?: string) {
    this.ensureTenantDb(tenantDb);

    const template = await this.getTemplate(tenantDb, templateId);

    const result = await tenantDb.query(
      `INSERT INTO report_templates (
        name, description, report_type, category, config, query_config,
        visualization_config, is_public, is_default, created_by,
        shared_with_roles, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        newName,
        template.description,
        template.report_type,
        template.category,
        template.config,
        template.query_config,
        template.visualization_config,
        false, // Cloned templates are not public by default
        false, // Cloned templates are not default
        userId ?? null,
        template.shared_with_roles || [],
      ],
    );

    return result[0];
  }

  /**
   * Get execution history for a template
   */
  async getExecutionHistory(tenantDb: DataSource, templateId: string, page: number = 1, limit: number = 10) {
    this.ensureTenantDb(tenantDb);

    const offset = (page - 1) * limit;

    const countResult = await tenantDb.query(
      `SELECT COUNT(*) as total FROM report_executions WHERE report_template_id = $1`,
      [templateId],
    );
    const total = parseInt(countResult[0].total);

    const executions = await tenantDb.query(
      `SELECT * FROM report_executions
       WHERE report_template_id = $1
       ORDER BY execution_time DESC
       LIMIT $2 OFFSET $3`,
      [templateId, limit, offset],
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
   * Seed default report templates for the tenant (idempotent).
   * Call once per tenant to give users ready-made reports.
   */
  async seedDefaultTemplates(tenantDb: DataSource, userId?: string): Promise<{ created: number; skipped: number }> {
    this.ensureTenantDb(tenantDb);

    const existing = await tenantDb.query(
      `SELECT id FROM report_templates WHERE is_default = true LIMIT 1`,
    );
    if (existing.length > 0) {
      return { created: 0, skipped: 5 };
    }

    const defaults = [
      {
        name: 'Monthly Revenue Summary',
        description: 'Billing and revenue for the selected period',
        report_type: 'financial',
        category: 'Finance',
        config: { dateRangeDefault: 'lastMonth' },
        query_config: {
          table: 'billing',
          columns: ['id', 'invoice_number', 'billing_date', 'total_amount', 'status', 'created_at'],
        },
        visualization_config: { chartType: 'table' },
        is_public: true,
        is_default: true,
      },
      {
        name: 'AR Aging Overview',
        description: 'Bills by status for receivables overview',
        report_type: 'financial',
        category: 'Finance',
        config: { dateRangeDefault: 'lastMonth' },
        query_config: {
          table: 'billing',
          columns: ['id', 'invoice_number', 'billing_date', 'total_amount', 'status', 'due_date', 'created_at'],
        },
        visualization_config: { chartType: 'table' },
        is_public: true,
        is_default: true,
      },
      {
        name: 'Appointments by Status',
        description: 'Appointments in the selected period by status',
        report_type: 'operational',
        category: 'Operations',
        config: { dateRangeDefault: 'lastMonth' },
        query_config: {
          table: 'appointments',
          columns: ['id', 'appointment_date', 'status', 'patient_id', 'created_at'],
        },
        visualization_config: { chartType: 'table' },
        is_public: true,
        is_default: true,
      },
      {
        name: 'Lab Orders Summary',
        description: 'Lab orders by status in the selected period',
        report_type: 'operational',
        category: 'Operations',
        config: { dateRangeDefault: 'lastMonth' },
        query_config: {
          table: 'lab_orders',
          columns: ['id', 'order_number', 'status', 'priority', 'created_at'],
        },
        visualization_config: { chartType: 'table' },
        is_public: true,
        is_default: true,
      },
      {
        name: 'HIPAA Audit Summary',
        description: 'PHI access events for compliance (date range filter)',
        report_type: 'operational',
        category: 'Compliance',
        config: { dateRangeDefault: 'last30Days' },
        query_config: {
          table: 'hipaa_audit_logs',
          columns: ['id', 'created_at', 'action', 'resource_type', 'operation', 'outcome'],
        },
        visualization_config: { chartType: 'table' },
        is_public: false,
        is_default: true,
      },
    ];

    let created = 0;
    for (const t of defaults) {
      const exists = await tenantDb.query(
        `SELECT 1 FROM report_templates WHERE name = $1 LIMIT 1`,
        [t.name],
      );
      if (exists.length > 0) continue;
      try {
        await tenantDb.query(
          `INSERT INTO report_templates (
            name, description, report_type, category, config, query_config,
            visualization_config, is_public, is_default, created_by,
            shared_with_roles, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11::text[], NOW(), NOW())`,
          [
            t.name,
            t.description,
            t.report_type,
            t.category,
            JSON.stringify(t.config),
            JSON.stringify(t.query_config),
            JSON.stringify(t.visualization_config),
            t.is_public,
            t.is_default,
            userId ?? null,
            ['admin', 'doctor'],
          ],
        );
        created++;
      } catch (e) {
        this.logger.warn(`Seed template "${t.name}" failed (table may not exist): ${(e as Error).message}`);
      }
    }
    return { created, skipped: defaults.length - created };
  }
}

