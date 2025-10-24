import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Bill, BillStatus, PaymentMethod } from '../entities/billing.entity';

@Injectable()
export class BillingService {
  
  async createBill(createDto: any, tenantDb: DataSource, createdById: string): Promise<Bill> {
    const billRepository = tenantDb.getRepository(Bill);
    
    const billCount = await billRepository.count();
    const billNumber = `INV${String(billCount + 1).padStart(8, '0')}`;
    
    // Calculate totals
    const subtotal = createDto.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalAmount = subtotal + (createDto.taxAmount || 0) - (createDto.discountAmount || 0);
    
    const bill = billRepository.create({
      ...createDto,
      billNumber,
      createdById,
      subtotal,
      totalAmount,
      balanceAmount: totalAmount,
      billDate: new Date(),
      dueDate: createDto.dueDate ? new Date(createDto.dueDate) : null
    });
    
    return billRepository.save(bill);
  }

  async findAllBills(query: any, tenantDb: DataSource): Promise<any> {
    const billRepository = tenantDb.getRepository(Bill);
    const { page = 1, limit = 10, status, patientId } = query;
    
    let queryBuilder = billRepository.createQueryBuilder('bill')
      .leftJoinAndSelect('bill.patient', 'patient');
    
    if (status) {
      queryBuilder.andWhere('bill.status = :status', { status });
    }
    
    if (patientId) {
      queryBuilder.andWhere('bill.patientId = :patientId', { patientId });
    }
    
    const [bills, total]: [any[], number] = await queryBuilder
      .orderBy('bill.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    
    return {
      bills,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async addPayment(id: string, paymentDto: any, tenantDb: DataSource, receivedBy: string): Promise<Bill> {
    const billRepository = tenantDb.getRepository(Bill);
    
    const bill = await billRepository.findOne({ where: { id } });
    if (!bill) {
      throw new NotFoundException('Bill not found');
    }
    
    const payment = {
      ...paymentDto,
      date: new Date(),
      receivedBy
    };
    
    bill.payments = bill.payments || [];
    bill.payments.push(payment);
    bill.paidAmount += paymentDto.amount;
    bill.balanceAmount = bill.totalAmount - bill.paidAmount;
    
    if (bill.balanceAmount <= 0) {
      bill.status = BillStatus.PAID;
    }
    
    return billRepository.save(bill);
  }
}