import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LabOrder, LabOrderStatus } from '../entities/lab-order.entity';

@Injectable()
export class LabOrderService {
  
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
}