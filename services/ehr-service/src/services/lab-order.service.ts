import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LabOrder, LabOrderStatus } from '../entities/lab-order.entity';
import { LabTest } from '../entities/lab-test.entity';
import { CriticalAlertService } from './critical-alert.service';
import { Patient } from '../entities/patient.entity';

@Injectable()
export class LabOrderService {
  constructor(private criticalAlertService: CriticalAlertService) {}
  
  private appendWorkflowEvent(
    labOrder: LabOrder,
    event: {
      type: string;
      description: string;
      actorId?: string;
      statusAfter?: LabOrderStatus;
      metadata?: Record<string, any>;
    },
  ) {
    const events = Array.isArray(labOrder.workflowEvents) ? labOrder.workflowEvents : [];
    const newEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    labOrder.workflowEvents = [newEvent, ...events].slice(0, 50);
  }

  private appendHandoffNote(
    labOrder: LabOrder,
    note: {
      authorId?: string;
      authorName?: string;
      shift?: string;
      note: string;
    },
  ) {
    const notes = Array.isArray(labOrder.handoffNotes) ? labOrder.handoffNotes : [];
    labOrder.handoffNotes = [
      {
        ...note,
        timestamp: new Date().toISOString(),
      },
      ...notes,
    ].slice(0, 50);
  }

  private appendNotificationLog(
    labOrder: LabOrder,
    entry: {
      channel: 'system' | 'sms' | 'email' | 'push';
      recipients: string[];
      subject?: string;
      message: string;
      metadata?: Record<string, any>;
    },
  ) {
    const log = Array.isArray(labOrder.notificationLog) ? labOrder.notificationLog : [];
    labOrder.notificationLog = [
      {
        ...entry,
        timestamp: new Date().toISOString(),
      },
      ...log,
    ].slice(0, 100);
  }

  async create(createDto: any, tenantDb: DataSource, orderingProviderId: string): Promise<LabOrder> {
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    
    const orderCount = await labOrderRepository.count();
    const orderNumber = `LAB${String(orderCount + 1).padStart(8, '0')}`;
    
    const labOrder = labOrderRepository.create({
      ...createDto,
      orderNumber,
      orderingProviderId,
      scheduledDateTime: createDto.scheduledDateTime ? new Date(createDto.scheduledDateTime) : null
    });
    
    return labOrderRepository.save(labOrder);
  }

  async getQualityControls(
    tenantDb: DataSource,
    options: { analyzerName?: string; status?: string; limit?: number } = {},
  ): Promise<any[]> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (options.analyzerName) {
      params.push(options.analyzerName);
      conditions.push(`qc.analyzer_name = $${params.length}`);
    }

    if (options.status) {
      params.push(options.status);
      conditions.push(`qc.status = $${params.length}`);
    }

    const limit = Math.min(Math.max(options.limit ?? 25, 1), 200);
    params.push(limit);

    const query = `
      SELECT 
        qc.*,
        u.first_name || ' ' || u.last_name AS recorded_by_name
      FROM lab_quality_controls qc
      LEFT JOIN users u ON u.id = qc.recorded_by
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY qc.run_datetime DESC
      LIMIT $${params.length}
    `;

    return tenantDb.query(query, params);
  }

  async createQualityControlEntry(
    tenantDb: DataSource,
    dto: {
      analyzer_name: string;
      test_code?: string;
      level?: string;
      lot_number?: string;
      run_datetime?: string;
      result_value?: string;
      status?: 'pending' | 'pass' | 'fail' | 'review';
      comments?: string;
    },
    recordedBy?: string,
  ) {
    const result = await tenantDb.query(
      `
      INSERT INTO lab_quality_controls (
        analyzer_name,
        test_code,
        level,
        lot_number,
        run_datetime,
        result_value,
        status,
        comments,
        recorded_by
      )
      VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6, COALESCE($7, 'pending'), $8, $9)
      RETURNING *
      `,
      [
        dto.analyzer_name,
        dto.test_code || null,
        dto.level || null,
        dto.lot_number || null,
        dto.run_datetime || null,
        dto.result_value || null,
        dto.status || 'pending',
        dto.comments || null,
        recordedBy || null,
      ],
    );

    return result[0];
  }

  async getReagentInventory(tenantDb: DataSource): Promise<any[]> {
    return tenantDb.query(
      `
      SELECT 
        ri.*,
        u.first_name || ' ' || u.last_name AS updated_by_name
      FROM lab_reagent_inventory ri
      LEFT JOIN users u ON u.id = ri.updated_by
      ORDER BY 
        CASE ri.status 
          WHEN 'critical' THEN 1
          WHEN 'warning' THEN 2
          WHEN 'ok' THEN 3
          WHEN 'expired' THEN 4
          ELSE 5
        END,
        ri.reagent_name
      `,
    );
  }

  async upsertReagentInventoryItem(
    tenantDb: DataSource,
    dto: {
      id?: string;
      reagent_name: string;
      analyzer_name?: string;
      lot_number?: string;
      quantity_available?: number;
      unit?: string;
      minimum_threshold?: number;
      expires_on?: string;
      status?: 'ok' | 'warning' | 'critical' | 'expired';
      notes?: string;
    },
    userId?: string,
  ) {
    if (dto.id) {
      const result = await tenantDb.query(
        `
        UPDATE lab_reagent_inventory
        SET 
          reagent_name = COALESCE($2, reagent_name),
          analyzer_name = COALESCE($3, analyzer_name),
          lot_number = COALESCE($4, lot_number),
          quantity_available = COALESCE($5, quantity_available),
          unit = COALESCE($6, unit),
          minimum_threshold = COALESCE($7, minimum_threshold),
          expires_on = COALESCE($8::date, expires_on),
          status = COALESCE($9, status),
          notes = COALESCE($10, notes),
          updated_by = $11,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [
          dto.id,
          dto.reagent_name || null,
          dto.analyzer_name || null,
          dto.lot_number || null,
          dto.quantity_available ?? null,
          dto.unit || null,
          dto.minimum_threshold ?? null,
          dto.expires_on || null,
          dto.status || null,
          dto.notes || null,
          userId || null,
        ],
      );

      if (result.length === 0) {
        throw new NotFoundException('Reagent inventory item not found');
      }

      return result[0];
    }

    const insertResult = await tenantDb.query(
      `
      INSERT INTO lab_reagent_inventory (
        reagent_name,
        analyzer_name,
        lot_number,
        quantity_available,
        unit,
        minimum_threshold,
        expires_on,
        status,
        notes,
        updated_by
      )
      VALUES ($1, $2, $3, $4, COALESCE($5, 'units'), COALESCE($6, 0), $7::date, COALESCE($8, 'ok'), $9, $10)
      RETURNING *
      `,
      [
        dto.reagent_name,
        dto.analyzer_name || null,
        dto.lot_number || null,
        dto.quantity_available ?? 0,
        dto.unit || null,
        dto.minimum_threshold ?? 0,
        dto.expires_on || null,
        dto.status || 'ok',
        dto.notes || null,
        userId || null,
      ],
    );

    return insertResult[0];
  }

  async updateReagentInventoryQuantity(
    tenantDb: DataSource,
    id: string,
    payload: { quantity_available: number; status?: 'ok' | 'warning' | 'critical' | 'expired' },
    userId?: string,
  ) {
    const result = await tenantDb.query(
      `
      UPDATE lab_reagent_inventory
      SET 
        quantity_available = $2,
        status = COALESCE($3, status),
        updated_by = $4,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id, payload.quantity_available, payload.status || null, userId || null],
    );

    if (result.length === 0) {
      throw new NotFoundException('Reagent inventory item not found');
    }

    return result[0];
  }

  async findAll(query: any, tenantDb: DataSource): Promise<any> {
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    const { page = 1, limit = 10, status, patientId } = query;
    
    let queryBuilder = labOrderRepository.createQueryBuilder('labOrder')
      .leftJoinAndSelect('labOrder.patient', 'patient')
      .leftJoinAndSelect('labOrder.orderingProvider', 'provider');
    
    if (status) {
      queryBuilder.andWhere('labOrder.status = :status', { status });
    }
    
    if (patientId) {
      queryBuilder.andWhere('labOrder.patientId = :patientId', { patientId });
    }
    
    const [labOrders, total]: [any[], number] = await queryBuilder
      .orderBy('labOrder.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    
    return {
      labOrders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async addResults(id: string, resultsDto: any, tenantDb: DataSource, reviewedById: string): Promise<LabOrder> {
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    
    const labOrder = await labOrderRepository.findOne({ where: { id } });
    if (!labOrder) {
      throw new NotFoundException('Lab order not found');
    }
    
    labOrder.results = resultsDto.results;
    labOrder.interpretation = resultsDto.interpretation;
    labOrder.reviewedById = reviewedById;
    labOrder.reviewedAt = new Date();
    labOrder.status = LabOrderStatus.COMPLETED;
    
    return labOrderRepository.save(labOrder);
  }

  async getPatientResults(patientId: string, tenantDb: DataSource): Promise<LabOrder[]> {
    try {
      const labOrderRepository = tenantDb.getRepository(LabOrder);
      
      const results = await labOrderRepository
        .createQueryBuilder('labOrder')
        .leftJoinAndSelect('labOrder.orderingProvider', 'orderingProvider')
        .leftJoinAndSelect('labOrder.reviewedBy', 'reviewedBy')
        .where('labOrder.patientId = :patientId', { patientId })
        .andWhere('labOrder.status = :status', { status: LabOrderStatus.COMPLETED })
        .orderBy('labOrder.reviewedAt', 'DESC', 'NULLS LAST')
        .addOrderBy('labOrder.createdAt', 'DESC')
        .getMany();
      
      return results;
    } catch (error: any) {
      // If table doesn't exist or other error, return empty array
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('lab_orders table does not exist yet');
        return [];
      }
      throw error;
    }
  }

  // Lab Technician Methods
  async getPendingOrders(tenantDb: DataSource): Promise<LabOrder[]> {
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    
    return labOrderRepository.find({
      where: { status: LabOrderStatus.ORDERED },
      relations: ['patient', 'orderingProvider'],
      order: { priority: 'DESC', createdAt: 'ASC' }
    });
  }

  async getInProgressOrders(tenantDb: DataSource): Promise<LabOrder[]> {
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    
    return labOrderRepository.find({
      where: [
        { status: LabOrderStatus.COLLECTED },
        { status: LabOrderStatus.IN_PROGRESS }
      ],
      relations: ['patient', 'orderingProvider'],
      order: { priority: 'DESC', createdAt: 'ASC' }
    });
  }

  async collectSample(id: string, tenantDb: DataSource, collectedById: string): Promise<LabOrder> {
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    
    const labOrder = await labOrderRepository.findOne({ where: { id } });
    if (!labOrder) {
      throw new NotFoundException('Lab order not found');
    }
    
    labOrder.status = LabOrderStatus.COLLECTED;
    labOrder.collectedAt = new Date();
    labOrder.collectedById = collectedById;
    labOrder.processingContext = {
      ...(labOrder.processingContext || {}),
      stage: 'awaiting_processing',
      instrumentStatus: 'queued',
    };
    this.appendWorkflowEvent(labOrder, {
      type: 'sample_collected',
      description: 'Sample collected and queued for processing',
      actorId: collectedById,
      statusAfter: LabOrderStatus.COLLECTED,
    });
    
    return labOrderRepository.save(labOrder);
  }

  async startProcessing(id: string, tenantDb: DataSource): Promise<LabOrder> {
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    
    const labOrder = await labOrderRepository.findOne({ where: { id } });
    if (!labOrder) {
      throw new NotFoundException('Lab order not found');
    }
    
    if (labOrder.status !== LabOrderStatus.COLLECTED && labOrder.status !== LabOrderStatus.ORDERED) {
      throw new Error('Can only process collected or ordered lab orders');
    }
    
    labOrder.status = LabOrderStatus.IN_PROGRESS;
    labOrder.processingContext = {
      ...(labOrder.processingContext || {}),
      stage: 'processing',
      instrumentStatus: 'running',
      processingStartedAt: new Date().toISOString(),
    };
    this.appendWorkflowEvent(labOrder, {
      type: 'processing_started',
      description: 'Order entered analyzer processing workflow',
      statusAfter: LabOrderStatus.IN_PROGRESS,
    });
    
    return labOrderRepository.save(labOrder);
  }

    async submitResults(id: string, resultsDto: any, tenantDb: DataSource, reviewedById: string): Promise<LabOrder> {
      const labOrderRepository = tenantDb.getRepository(LabOrder);
      const testRepository = tenantDb.getRepository(LabTest);
      const patientRepository = tenantDb.getRepository(Patient);
      
      const labOrder = await labOrderRepository.findOne({ 
        where: { id },
        relations: ['patient']
      });
      if (!labOrder) {
        throw new NotFoundException('Lab order not found');
      }

      const patient = await patientRepository.findOne({ where: { id: labOrder.patientId } });
      const results = resultsDto.results || labOrder.results;
      
      // Check for critical values and create alerts
      if (results && Array.isArray(results)) {
        for (const result of results) {
          if (result.testCode && result.value) {
            // Find test by test code
            const test = await testRepository.findOne({ 
              where: { testCode: result.testCode, isActive: true } 
            });
            
            if (test) {
              const numericValue = parseFloat(result.value);
              if (!isNaN(numericValue)) {
                const criticalCheck = await this.checkCriticalValue(test, numericValue);
                
                if (criticalCheck.isCritical) {
                  const alertMessage = `Critical ${criticalCheck.type} value: ${result.testName} = ${result.value} ${result.unit || ''}`;
                  
                  await this.criticalAlertService.createAlert({
                    labOrderId: labOrder.id,
                    patientId: labOrder.patientId,
                    orderingProviderId: labOrder.orderingProviderId,
                    testCode: result.testCode,
                    testName: result.testName || test.testName,
                    resultValue: String(result.value),
                    criticalValueType: criticalCheck.type || 'critical',
                    alertMessage
                  }, tenantDb);
                }
              }
            }
          }
        }
      }
      
      labOrder.results = results;
      labOrder.interpretation = resultsDto.interpretation || labOrder.interpretation;
      labOrder.attachments = resultsDto.attachments || labOrder.attachments;
      labOrder.reviewedById = reviewedById;
      labOrder.reviewedAt = new Date();
      labOrder.status = LabOrderStatus.COMPLETED;
      labOrder.processingContext = {
        ...(labOrder.processingContext || {}),
        stage: 'results_ready',
        instrumentStatus: 'complete',
        completedAt: new Date().toISOString(),
      };
      this.appendWorkflowEvent(labOrder, {
        type: 'results_submitted',
        description: 'Results verified and released to ordering clinician',
        actorId: reviewedById,
        statusAfter: LabOrderStatus.COMPLETED,
      });
      
      return labOrderRepository.save(labOrder);
    }

    private async checkCriticalValue(test: LabTest, value: number): Promise<{ isCritical: boolean; type: 'high' | 'low' | null }> {
      if (test.criticalHigh && value > test.criticalHigh) {
        return { isCritical: true, type: 'high' };
      }
      
      if (test.criticalLow && value < test.criticalLow) {
        return { isCritical: true, type: 'low' };
      }
      
      return { isCritical: false, type: null };
    }

  async updateStatus(id: string, status: LabOrderStatus, tenantDb: DataSource): Promise<LabOrder> {
    const labOrderRepository = tenantDb.getRepository(LabOrder);
    
    const labOrder = await labOrderRepository.findOne({ where: { id } });
    if (!labOrder) {
      throw new NotFoundException('Lab order not found');
    }
    
    labOrder.status = status;
    this.appendWorkflowEvent(labOrder, {
      type: 'status_updated',
      description: `Status changed to ${status}`,
      statusAfter: status,
    });
    
    return labOrderRepository.save(labOrder);
  }

  async updateProcessingContext(
    id: string,
    updateDto: {
      processingContext?: Record<string, any>;
      appendEvent?: {
        type: string;
        description: string;
        metadata?: Record<string, any>;
      };
      status?: LabOrderStatus;
      handoffNote?: {
        note: string;
        shift?: string;
      };
      notify?: {
        channel: 'system' | 'sms' | 'email' | 'push';
        recipients: string[];
        subject?: string;
        message: string;
      };
    },
    tenantDb: DataSource,
    actorId?: string,
  ): Promise<LabOrder> {
    const labOrderRepository = tenantDb.getRepository(LabOrder);

    const labOrder = await labOrderRepository.findOne({ where: { id } });
    if (!labOrder) {
      throw new NotFoundException('Lab order not found');
    }

    if (updateDto.processingContext) {
      labOrder.processingContext = {
        ...(labOrder.processingContext || {}),
        ...updateDto.processingContext,
      };
    }

    if (updateDto.status) {
      labOrder.status = updateDto.status;
    }

    if (updateDto.appendEvent) {
      this.appendWorkflowEvent(labOrder, {
        ...updateDto.appendEvent,
        actorId,
        statusAfter: updateDto.status ?? labOrder.status,
      });
    }

    if (updateDto.handoffNote?.note) {
      this.appendHandoffNote(labOrder, {
        note: updateDto.handoffNote.note,
        shift: updateDto.handoffNote.shift,
        authorId: actorId,
      });
    }

    if (updateDto.notify) {
      this.appendNotificationLog(labOrder, {
        channel: updateDto.notify.channel,
        recipients: updateDto.notify.recipients,
        subject: updateDto.notify.subject,
        message: updateDto.notify.message,
      });
    }

    return labOrderRepository.save(labOrder);
  }
}