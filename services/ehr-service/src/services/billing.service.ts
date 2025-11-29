import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, DeepPartial } from 'typeorm';
import { Bill, BillStatus, PaymentMethod } from '../entities/billing.entity';

@Injectable()
export class BillingService {
  
  async createBill(createDto: any, tenantDb: DataSource, createdById: string): Promise<Bill> {
    const billRepository = tenantDb.getRepository(Bill);
    
    const billCount = await billRepository.count();
    const billNumber = `INV${String(billCount + 1).padStart(8, '0')}`;
    
    // Calculate totals
    const items = createDto.items || [];
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
    const totalAmount = subtotal + (createDto.taxAmount || 0) - (createDto.discountAmount || 0);
    
    // Create bill without items (items column doesn't exist in billing table)
    const billData: any = {
      billNumber,
      patientId: createDto.patientId,
      appointmentId: createDto.appointmentId || null,
      subtotal,
      taxAmount: createDto.taxAmount || 0,
      discountAmount: createDto.discountAmount || 0,
      totalAmount,
      status: createDto.status || BillStatus.PENDING,
      billDate: createDto.billDate ? new Date(createDto.billDate) : new Date(),
      dueDate: createDto.dueDate ? new Date(createDto.dueDate) : null,
      notes: createDto.notes || null,
      createdById: createdById,
    };
    
    const bill = billRepository.create(billData as DeepPartial<Bill>);
    const savedBill = await billRepository.save(bill);
    
    // Attach items to the returned object for API response (not stored in DB)
    (savedBill as any).items = items;
    
    return savedBill;
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
    
    // Payments are managed through financial_transactions, not directly on bills
    // Update bill status if fully paid
    // Note: Actual payment tracking should go through FinanceService
    const paymentAmount = paymentDto.amount || 0;
    
    // For now, just update status if payment covers the full amount
    // Note: Payment tracking is done through financial_transactions table
    if (paymentAmount >= bill.totalAmount) {
      bill.status = BillStatus.PAID;
    }
    
    return billRepository.save(bill);
  }
}