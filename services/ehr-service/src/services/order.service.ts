import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Order, OrderType, OrderStatus, OrderPriority } from '../entities/order.entity';
import { TenantService } from './tenant.service';

export interface CreateOrderDto {
  patientId: string;
  appointmentId?: string;
  orderType: OrderType;
  orderName: string;
  description?: string;
  instructions: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  priority?: OrderPriority;
}

export interface UpdateOrderDto {
  status?: OrderStatus;
  executionNotes?: string;
}

@Injectable()
export class OrderService {
  constructor(private tenantService: TenantService) {}

  private async getRepository(tenantId: string): Promise<Repository<Order>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    return connection.getRepository(Order);
  }

  async createOrder(data: CreateOrderDto, doctorId: string, tenantId: string): Promise<Order> {
    const repo = await this.getRepository(tenantId);
    
    const order = repo.create({
      ...data,
      doctorId,
      status: OrderStatus.PENDING
    });
    
    return repo.save(order);
  }

  async getOrdersForPatient(patientId: string, tenantId: string): Promise<Order[]> {
    const repo = await this.getRepository(tenantId);
    return repo.find({
      where: { patientId },
      relations: ['patient', 'doctor', 'appointment'],
      order: { createdAt: 'DESC' }
    });
  }

  async getAuthorizedOrdersForNurse(tenantId: string): Promise<Order[]> {
    const repo = await this.getRepository(tenantId);
    return repo.find({
      where: { status: OrderStatus.AUTHORIZED },
      relations: ['patient', 'doctor', 'appointment'],
      order: { priority: 'DESC', createdAt: 'ASC' }
    });
  }

  async getOrdersByDoctor(doctorId: string, tenantId: string): Promise<Order[]> {
    const repo = await this.getRepository(tenantId);
    return repo.find({
      where: { doctorId },
      relations: ['patient', 'appointment'],
      order: { createdAt: 'DESC' }
    });
  }

  async authorizeOrder(orderId: string, authorizedBy: string, tenantId: string): Promise<Order> {
    const repo = await this.getRepository(tenantId);
    
    await repo.update(orderId, {
      status: OrderStatus.AUTHORIZED,
      authorizedBy,
      authorizedAt: new Date()
    });
    
    return repo.findOne({
      where: { id: orderId },
      relations: ['patient', 'doctor', 'appointment']
    });
  }

  async executeOrder(orderId: string, executedBy: string, executionNotes: string, tenantId: string): Promise<Order> {
    const repo = await this.getRepository(tenantId);
    
    await repo.update(orderId, {
      status: OrderStatus.COMPLETED,
      executedBy,
      executedAt: new Date(),
      executionNotes
    });
    
    return repo.findOne({
      where: { id: orderId },
      relations: ['patient', 'doctor', 'appointment']
    });
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, tenantId: string): Promise<Order> {
    const repo = await this.getRepository(tenantId);
    
    await repo.update(orderId, { status });
    
    return repo.findOne({
      where: { id: orderId },
      relations: ['patient', 'doctor', 'appointment']
    });
  }

  async getOrderById(orderId: string, tenantId: string): Promise<Order> {
    const repo = await this.getRepository(tenantId);
    return repo.findOne({
      where: { id: orderId },
      relations: ['patient', 'doctor', 'appointment']
    });
  }
}
