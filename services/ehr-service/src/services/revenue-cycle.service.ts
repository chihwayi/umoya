import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChargeMaster } from '../entities/charge-master.entity';
import { PatientCharge } from '../entities/patient-charge.entity';
import { ChargeApprovalNotification } from '../entities/charge-approval-notification.entity';

@Injectable()
export class RevenueCycleService {
  private readonly logger = new Logger(RevenueCycleService.name);

  constructor() {}

  // ==================== CHARGE MASTER ====================

  async getChargeMaster(
    filters: any,
    tenantDb: DataSource,
  ): Promise<ChargeMaster[]> {
    const repository = tenantDb.getRepository(ChargeMaster);
    return await repository.find({
      where: { isActive: true, ...filters },
      order: { chargeCode: 'ASC' },
    });
  }

  async createChargeMasterItem(
    itemData: any,
    tenantDb: DataSource,
  ): Promise<ChargeMaster> {
    const repository = tenantDb.getRepository(ChargeMaster);
    const item = repository.create(itemData);
    return await repository.save(item) as unknown as ChargeMaster;
  }

  // ==================== PATIENT CHARGES ====================

  async captureCharge(
    chargeData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<PatientCharge> {
    const repository = tenantDb.getRepository(PatientCharge);

    const charge = repository.create({
      ...chargeData,
      capturedById: userId,
      capturedAt: new Date(),
      captureMethod: chargeData.captureMethod || 'manual',
      chargeStatus: 'pending',
    });

    return await repository.save(charge) as unknown as PatientCharge;
  }

  async getPatientCharges(
    patientId: string,
    admissionId: string | null,
    tenantDb: DataSource,
  ): Promise<PatientCharge[]> {
    const repository = tenantDb.getRepository(PatientCharge);

    const query = repository.createQueryBuilder('charge')
      .where('charge.patientId = :patientId', { patientId })
      .leftJoinAndSelect('charge.orderingProvider', 'orderingProvider')
      .leftJoinAndSelect('charge.capturedBy', 'capturedBy')
      .orderBy('charge.serviceDate', 'DESC');

    if (admissionId) {
      query.andWhere('charge.admissionId = :admissionId', { admissionId });
    }

    return await query.getMany();
  }

  async getTotalCharges(
    patientId: string,
    admissionId: string | null,
    tenantDb: DataSource,
  ): Promise<number> {
    const repository = tenantDb.getRepository(PatientCharge);

    const query = repository.createQueryBuilder('charge')
      .select('SUM(charge.totalCharge)', 'total')
      .where('charge.patientId = :patientId', { patientId })
      .andWhere('charge.chargeStatus != :status', { status: 'written_off' });

    if (admissionId) {
      query.andWhere('charge.admissionId = :admissionId', { admissionId });
    }

    const result = await query.getRawOne();
    return parseFloat(result?.total || 0);
  }

  async autoCaptureCharge(
    sourceType: string,
    sourceId: string,
    chargeCode: string,
    quantity: number,
    patientId: string,
    tenantDb: DataSource,
  ): Promise<PatientCharge> {
    const chargeMasterRepo = tenantDb.getRepository(ChargeMaster);
    const chargeRepo = tenantDb.getRepository(PatientCharge);

    // Get charge from master
    const chargeMaster = await chargeMasterRepo.findOne({
      where: { chargeCode, isActive: true },
    });

    if (!chargeMaster) {
      throw new NotFoundException(`Charge code ${chargeCode} not found`);
    }

    const charge = chargeRepo.create({
      patientId,
      chargeCode,
      chargeDescription: chargeMaster.chargeDescription,
      quantity,
      unitPrice: chargeMaster.standardCharge,
      serviceDate: new Date(),
      sourceType,
      sourceId,
      cptCode: chargeMaster.cptCode,
      captureMethod: 'automatic',
      chargeStatus: 'pending',
    });

    return await chargeRepo.save(charge);
  }

  async reviewCharges(
    admissionId: string,
    tenantDb: DataSource,
  ): Promise<{ charges: PatientCharge[]; total: number; missedCharges: any[] }> {
    const repository = tenantDb.getRepository(PatientCharge);
    
    // Get charges for this admission
    const charges = await repository
      .createQueryBuilder('charge')
      .where('charge.admissionId = :admissionId', { admissionId })
      .leftJoinAndSelect('charge.orderingProvider', 'orderingProvider')
      .leftJoinAndSelect('charge.capturedBy', 'capturedBy')
      .leftJoinAndSelect('charge.reviewedBy', 'reviewedBy')
      .leftJoinAndSelect('charge.approvedBy', 'approvedBy')
      .orderBy('charge.serviceDate', 'DESC')
      .getMany();

    const total = charges.reduce((sum, c) => sum + parseFloat(c.totalCharge as any), 0);

    return {
      charges: charges as unknown as PatientCharge[],
      total,
      missedCharges: [], // TODO: Implement missed charge detection
    };
  }

  // ==================== APPROVAL WORKFLOW ====================

  async approveCharge(
    chargeId: string,
    userId: string,
    notes: string | null,
    tenantDb: DataSource,
  ): Promise<PatientCharge> {
    const repository = tenantDb.getRepository(PatientCharge);
    const charge = await repository.findOne({ where: { id: chargeId } });

    if (!charge) {
      throw new NotFoundException(`Charge with ID ${chargeId} not found`);
    }

    if (charge.chargeStatus === 'approved') {
      throw new BadRequestException('Charge is already approved');
    }

    if (charge.chargeStatus === 'billed' || charge.chargeStatus === 'paid') {
      throw new BadRequestException('Cannot approve charge that is already billed or paid');
    }

    charge.chargeStatus = 'approved';
    charge.approvedById = userId;
    charge.approvedAt = new Date();
    if (notes) {
      charge.approvalNotes = notes;
    }

    return await repository.save(charge) as unknown as PatientCharge;
  }

  async rejectCharge(
    chargeId: string,
    userId: string,
    reason: string,
    tenantDb: DataSource,
  ): Promise<PatientCharge> {
    const repository = tenantDb.getRepository(PatientCharge);
    const charge = await repository.findOne({ where: { id: chargeId } });

    if (!charge) {
      throw new NotFoundException(`Charge with ID ${chargeId} not found`);
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }

    if (charge.chargeStatus === 'billed' || charge.chargeStatus === 'paid') {
      throw new BadRequestException('Cannot reject charge that is already billed or paid');
    }

    charge.chargeStatus = 'rejected';
    charge.rejectionReason = reason;
    charge.reviewedById = userId;
    charge.reviewedAt = new Date();

    return await repository.save(charge) as unknown as PatientCharge;
  }

  async reviewCharge(
    chargeId: string,
    userId: string,
    notes: string | null,
    tenantDb: DataSource,
  ): Promise<PatientCharge> {
    const repository = tenantDb.getRepository(PatientCharge);
    const charge = await repository.findOne({ where: { id: chargeId } });

    if (!charge) {
      throw new NotFoundException(`Charge with ID ${chargeId} not found`);
    }

    if (charge.chargeStatus === 'billed' || charge.chargeStatus === 'paid') {
      throw new BadRequestException('Cannot review charge that is already billed or paid');
    }

    charge.chargeStatus = 'reviewed';
    charge.reviewedById = userId;
    charge.reviewedAt = new Date();
    if (notes) {
      charge.approvalNotes = notes;
    }

    return await repository.save(charge) as unknown as PatientCharge;
  }

  async approveAllChargesForAdmission(
    admissionId: string,
    userId: string,
    notes: string | null,
    tenantDb: DataSource,
  ): Promise<{ approvedCount: number; charges: PatientCharge[] }> {
    const repository = tenantDb.getRepository(PatientCharge);

    const charges = await repository.find({
      where: {
        admissionId,
        chargeStatus: 'pending' as any,
      },
    });

    if (charges.length === 0) {
      return { approvedCount: 0, charges: [] };
    }

    const now = new Date();
    for (const charge of charges) {
      charge.chargeStatus = 'approved' as any;
      charge.approvedById = userId;
      charge.approvedAt = now;
      if (notes) {
        charge.approvalNotes = notes;
      }
    }

    const savedCharges = await repository.save(charges) as unknown as PatientCharge[];

    // Create notification for accounts department
    await this.notifyAccounts(admissionId, userId, tenantDb);

    return {
      approvedCount: savedCharges.length,
      charges: savedCharges,
    };
  }

  async getPendingChargesForDoctor(
    doctorId: string,
    tenantDb: DataSource,
  ): Promise<{ charges: PatientCharge[]; total: number }> {
    const repository = tenantDb.getRepository(PatientCharge);

    // Get charges for patients where the doctor is the ordering provider
    const charges = await repository
      .createQueryBuilder('charge')
      .leftJoinAndSelect('charge.patient', 'patient')
      .leftJoinAndSelect('charge.orderingProvider', 'orderingProvider')
      .leftJoinAndSelect('charge.capturedBy', 'capturedBy')
      .where('charge.orderingProviderId = :doctorId', { doctorId })
      .andWhere('charge.chargeStatus IN (:...statuses)', { statuses: ['pending', 'reviewed'] })
      .orderBy('charge.serviceDate', 'DESC')
      .getMany();

    const total = charges.reduce((sum, c) => sum + parseFloat(c.totalCharge as any), 0);

    return { charges: charges as unknown as PatientCharge[], total };
  }

  async notifyAccounts(
    admissionId: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<ChargeApprovalNotification> {
    const chargeRepo = tenantDb.getRepository(PatientCharge);
    const notificationRepo = tenantDb.getRepository(ChargeApprovalNotification);

    // Get all approved charges for this admission
    const charges = await chargeRepo.find({
      where: {
        admissionId,
        chargeStatus: 'approved' as any,
      },
    });

    if (charges.length === 0) {
      throw new BadRequestException('No approved charges found for this admission');
    }

    // Get admission to get patient ID
    const admissionResult = await tenantDb.query(
      'SELECT patient_id FROM admissions WHERE id = $1',
      [admissionId],
    );

    if (!admissionResult || admissionResult.length === 0) {
      throw new NotFoundException(`Admission with ID ${admissionId} not found`);
    }

    const patientId = admissionResult[0].patient_id;
    const totalAmount = charges.reduce((sum, c) => sum + parseFloat(c.totalCharge as any), 0);

    // Check if notification already exists
    const existing = await notificationRepo.findOne({
      where: {
        admissionId,
        notificationStatus: 'unread',
      },
    });

    if (existing) {
      // Update existing notification
      existing.totalChargesCount = charges.length;
      existing.totalChargesAmount = totalAmount;
      return await notificationRepo.save(existing) as unknown as ChargeApprovalNotification;
    }

    // Create new notification
    const notification = notificationRepo.create({
      admissionId,
      patientId,
      notificationType: 'charges_ready_for_billing',
      notificationStatus: 'unread',
      totalChargesCount: charges.length,
      totalChargesAmount: totalAmount,
      createdById: userId,
    });

    return await notificationRepo.save(notification) as unknown as ChargeApprovalNotification;
  }

  async getChargeNotifications(
    accountUserId: string,
    status: string | null,
    tenantDb: DataSource,
  ): Promise<{ notifications: ChargeApprovalNotification[]; total: number }> {
    const repository = tenantDb.getRepository(ChargeApprovalNotification);

    const query = repository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.patient', 'patient')
      .leftJoinAndSelect('notification.admission', 'admission')
      .leftJoinAndSelect('notification.createdBy', 'createdBy')
      .orderBy('notification.createdAt', 'DESC');

    if (status) {
      query.andWhere('notification.notificationStatus = :status', { status });
    }

    const notifications = await query.getMany();
    return {
      notifications: notifications as unknown as ChargeApprovalNotification[],
      total: notifications.length,
    };
  }

  async markNotificationRead(
    notificationId: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<ChargeApprovalNotification> {
    const repository = tenantDb.getRepository(ChargeApprovalNotification);
    const notification = await repository.findOne({ where: { id: notificationId } });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${notificationId} not found`);
    }

    notification.notificationStatus = 'read';
    notification.readById = userId;
    notification.readAt = new Date();

    return await repository.save(notification) as unknown as ChargeApprovalNotification;
  }
}

