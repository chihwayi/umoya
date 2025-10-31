import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LabOrder, LabOrderStatus } from '../entities/lab-order.entity';
import { LabTest } from '../entities/lab-test.entity';
import { CriticalAlertService } from './critical-alert.service';
import { Patient } from '../entities/patient.entity';

@Injectable()
export class LabOrderService {
  constructor(private criticalAlertService: CriticalAlertService) {}
  
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
    
    return labOrderRepository.save(labOrder);
  }
}