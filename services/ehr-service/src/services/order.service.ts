import { Injectable, BadRequestException } from '@nestjs/common';
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
    try {
      const repo = await this.getRepository(tenantId);

      const order = repo.create({
        ...data,
        doctorId,
        status: OrderStatus.PENDING
      });

      return await repo.save(order);
    } catch (error: any) {
      const msg = String(error?.message || '')
        .toLowerCase();
      if (msg.includes('relation') && msg.includes('orders') && msg.includes('does not exist')) {
        throw new BadRequestException('Orders table not provisioned for this tenant. Please run tenant schema migration.');
      }
      throw error;
    }
  }

  async getOrdersForPatient(patientId: string, tenantId: string): Promise<Order[]> {
    try {
      const repo = await this.getRepository(tenantId);
      return repo.find({
        where: { patientId },
        relations: ['patient', 'doctor', 'appointment'],
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      console.error('Error fetching orders for patient:', error);
      return [];
    }
  }

  async getAuthorizedOrdersForNurse(tenantId: string): Promise<Order[]> {
    try {
      const repo = await this.getRepository(tenantId);
      return repo.find({
        where: { status: OrderStatus.AUTHORIZED },
        relations: ['patient', 'doctor', 'appointment'],
        order: { priority: 'DESC', createdAt: 'ASC' }
      });
    } catch (error) {
      console.error('Error fetching authorized orders for nurse:', error);
      // Return empty array if there's an error (e.g., orders table doesn't exist yet)
      return [];
    }
  }

  async getOrdersByDoctor(doctorId: string, tenantId: string): Promise<Order[]> {
    try {
      const repo = await this.getRepository(tenantId);
      return repo.find({
        where: { doctorId },
        relations: ['patient', 'appointment'],
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      console.error('Error fetching orders by doctor:', error);
      return [];
    }
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
