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
  drugId?: string; // Optional link to drug database
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
    
    const order = await repo.findOne({
      where: { id: orderId },
      relations: ['patient', 'doctor', 'appointment']
    });

    // Auto-create prescription record when a medication order is authorized
    try {
      if (order && order.orderType === OrderType.MEDICATION) {
        const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
        if (tenantDb) {
          // Prefer schema compatible with clinic-template.sql
          // Columns: medical_record_id, patient_id, doctor_id, medication_name, dosage, frequency, duration, quantity, instructions, status, prescribed_date
          const medicationName = order.orderName;
          const dosage = order.dosage || '';
          const frequency = order.frequency || '';
          const duration = order.duration || '';
          const instructions = order.instructions || '';
          const status = 'active';
          const quantity = 1;
          const prescribedDate = new Date();
          const appointmentId = order.appointmentId || null;

          await tenantDb.query(
            `INSERT INTO prescriptions (
              medical_record_id,
              patient_id,
              doctor_id,
              medication_name,
              dosage,
              frequency,
              duration,
              quantity,
              instructions,
              status,
              prescribed_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              appointmentId, // medical_record_id (nullable linkage)
              order.patientId,
              order.doctorId,
              medicationName,
              dosage,
              frequency,
              duration,
              quantity,
              instructions,
              status,
              prescribedDate
            ]
          );
        }
      }
    } catch (e) {
      // Do not block order authorization if prescription insertion fails
      console.error('Failed to auto-create prescription for medication order', e);
    }

    return order;
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
