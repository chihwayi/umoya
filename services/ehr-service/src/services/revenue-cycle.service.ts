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

    const missedCharges = await this.detectMissedCharges(admissionId, tenantDb);

    return {
      charges: charges as unknown as PatientCharge[],
      total,
      missedCharges,
    };
  }

  private async detectMissedCharges(admissionId: string, tenantDb: DataSource): Promise<any[]> {
    // Find lab orders, prescriptions, and procedures for this admission that have no matching charge line
    const [labRows, rxRows, procRows] = await Promise.all([
      tenantDb.query(
        `SELECT lo.id AS source_id, 'lab_order' AS source_type,
                lo.test_name AS description, lo.created_at AS service_date,
                COALESCE(cm.unit_price, 0) AS estimated_amount
         FROM lab_orders lo
         LEFT JOIN patient_charges pc ON pc.source_id = lo.id::text AND pc.admission_id = $1
         LEFT JOIN charge_master cm ON LOWER(cm.description) = LOWER(lo.test_name)
         WHERE lo.admission_id = $1 AND pc.id IS NULL`,
        [admissionId],
      ).catch(() => []),
      tenantDb.query(
        `SELECT p.id AS source_id, 'prescription' AS source_type,
                p.medication_name AS description, p.created_at AS service_date,
                COALESCE(cm.unit_price, 0) AS estimated_amount
         FROM prescriptions p
         LEFT JOIN patient_charges pc ON pc.source_id = p.id::text AND pc.admission_id = $1
         LEFT JOIN charge_master cm ON LOWER(cm.description) = LOWER(p.medication_name)
         WHERE p.admission_id = $1 AND pc.id IS NULL`,
        [admissionId],
      ).catch(() => []),
      tenantDb.query(
        `SELECT mr.id AS source_id, 'procedure' AS source_type,
                mr.chief_complaint AS description, mr.created_at AS service_date,
                0::numeric AS estimated_amount
         FROM medical_records mr
         LEFT JOIN patient_charges pc ON pc.source_id = mr.id::text AND pc.admission_id = $1
         WHERE mr.admission_id = $1 AND pc.id IS NULL`,
        [admissionId],
      ).catch(() => []),
    ]);

    return [...labRows, ...rxRows, ...procRows].map((r: any) => ({
      sourceId: r.source_id,
      sourceType: r.source_type,
      description: r.description ?? 'Unknown',
      serviceDate: r.service_date,
      estimatedAmount: parseFloat(r.estimated_amount ?? '0'),
    }));
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

  async getDoctorChargeWorklist(
    doctorId: string,
    tenantDb: DataSource,
    options?: {
      includeResolved?: boolean;
      limit?: number;
    },
  ): Promise<any> {
    const includeResolved = Boolean(options?.includeResolved);
    const limit = Number.isFinite(Number(options?.limit)) ? Number(options?.limit) : 100;

    const repository = tenantDb.getRepository(PatientCharge);
    const query = repository
      .createQueryBuilder('charge')
      .leftJoinAndSelect('charge.patient', 'patient')
      .leftJoinAndSelect('charge.orderingProvider', 'orderingProvider')
      .leftJoinAndSelect('charge.capturedBy', 'capturedBy')
      .leftJoinAndSelect('charge.reviewedBy', 'reviewedBy')
      .leftJoinAndSelect('charge.approvedBy', 'approvedBy')
      .where('charge.orderingProviderId = :doctorId', { doctorId });

    if (!includeResolved) {
      query.andWhere('charge.chargeStatus IN (:...statuses)', { statuses: ['pending', 'reviewed'] });
    }

    const charges = await query
      .orderBy('charge.serviceDate', 'ASC')
      .addOrderBy('charge.createdAt', 'ASC')
      .take(limit)
      .getMany();

    const items = (charges || []).map((charge) => this.hydrateChargeWorklistRow(charge as unknown as any));

    const summary = {
      total: items.length,
      open: items.filter((item: any) => ['pending', 'reviewed'].includes(String(item.chargeStatus || '').toLowerCase())).length,
      overdue: items.filter((item: any) => item.sla_status === 'overdue').length,
      dueSoon: items.filter((item: any) => item.sla_status === 'warning').length,
      highRisk: items.filter((item: any) => item.risk_level === 'high').length,
      moderateRisk: items.filter((item: any) => item.risk_level === 'moderate').length,
      potentialLeakageAmount: Number(
        items
          .filter((item: any) => ['pending', 'reviewed'].includes(String(item.chargeStatus || '').toLowerCase()))
          .reduce((sum: number, item: any) => sum + Number(item.total_charge_value || 0), 0)
          .toFixed(2),
      ),
      byStatus: items.reduce((acc: Record<string, number>, item: any) => {
        const status = String(item.chargeStatus || 'unknown').toLowerCase();
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
    };

    return { summary, items };
  }

  async getOperationalBrief(
    doctorId: string,
    tenantDb: DataSource,
    options?: {
      includeResolved?: boolean;
      limit?: number;
    },
  ): Promise<any> {
    const worklist = await this.getDoctorChargeWorklist(doctorId, tenantDb, {
      includeResolved: Boolean(options?.includeResolved),
      limit: Number.isFinite(Number(options?.limit)) ? Number(options?.limit) : 120,
    });

    const items = Array.isArray(worklist?.items) ? worklist.items : [];
    const openItems = items.filter((item: any) =>
      ['pending', 'reviewed'].includes(String(item?.chargeStatus || '').toLowerCase()),
    );

    const unreadNotifications = await tenantDb
      .getRepository(ChargeApprovalNotification)
      .count({ where: { notificationStatus: 'unread' } as any })
      .catch(() => 0);

    let accountsSyncPending = 0;
    try {
      const [syncRow] = await tenantDb.query(
        `
        SELECT COUNT(DISTINCT c.admission_id)::int AS pending
        FROM patient_charges c
        LEFT JOIN charge_approval_notifications n
          ON n.admission_id = c.admission_id
         AND n.notification_type = 'charges_ready_for_billing'
        WHERE c.ordering_provider_id = $1
          AND c.charge_status = 'approved'
          AND c.admission_id IS NOT NULL
          AND n.id IS NULL
        `,
        [doctorId],
      );
      accountsSyncPending = Number(syncRow?.pending || 0);
    } catch (error) {
      this.logger.warn('Unable to compute accounts sync pending count from notifications table');
    }

    const countChargeChecklistItems = (item: any): number => {
      const checks = [
        Boolean(item?.chargeCode),
        Boolean(item?.chargeDescription),
        Number(item?.quantity || 0) > 0,
        Number(item?.unitPrice || 0) > 0,
        Boolean(item?.cptCode),
        Boolean(item?.icd10Code),
        Boolean(item?.department),
        Boolean(item?.sourceType),
      ];
      return checks.filter(Boolean).length;
    };

    const highPriorityQueue = [...openItems]
      .sort((a: any, b: any) => {
        const riskRank = { high: 0, moderate: 1, low: 2 } as const;
        const byRisk =
          (riskRank[String(a?.risk_level || 'low').toLowerCase() as keyof typeof riskRank] ?? 3) -
          (riskRank[String(b?.risk_level || 'low').toLowerCase() as keyof typeof riskRank] ?? 3);
        if (byRisk !== 0) return byRisk;
        return Number(b?.age_days || 0) - Number(a?.age_days || 0);
      })
      .slice(0, 10)
      .map((item: any) => {
        const captureLagDays =
          item?.serviceDate && item?.capturedAt
            ? Math.max(
                0,
                Math.floor(
                  (new Date(item.capturedAt).getTime() - new Date(item.serviceDate).getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              )
            : 0;
        const missingSourceContext = !Boolean(item?.sourceType) || !Boolean(item?.sourceId);
        const staleReviewed =
          String(item?.chargeStatus || '').toLowerCase() === 'reviewed' && Number(item?.age_days || 0) >= 2;
        const cdssFlags: string[] = [];
        if (Boolean(item?.missing_cpt)) cdssFlags.push('CPT missing');
        if (Boolean(item?.missing_icd10)) cdssFlags.push('ICD-10 missing');
        if (captureLagDays >= 1) cdssFlags.push('Capture lag >24h');
        if (missingSourceContext) cdssFlags.push('Source context incomplete');
        if (staleReviewed) cdssFlags.push('Reviewed but not finalized');

        return {
          id: item.id,
          patientId: item.patient?.id || null,
          patientName:
            `${item.patient?.firstName || ''} ${item.patient?.lastName || ''}`.trim() || 'Unknown patient',
          patientNumber: item.patient?.patientNumber || null,
          chargeCode: item.chargeCode || null,
          chargeDescription: item.chargeDescription || 'Charge',
          chargeStatus: item.chargeStatus || 'pending',
          slaStatus: item.sla_status || 'on_track',
          riskLevel: item.risk_level || 'low',
          ageDays: Number(item.age_days || 0),
          captureLagDays,
          totalChargeValue: Number(item.total_charge_value || 0),
          missingCpt: Boolean(item.missing_cpt),
          missingIcd10: Boolean(item.missing_icd10),
          missingSourceContext,
          staleReviewed,
          checklistCompleteCount: countChargeChecklistItems(item),
          checklistTotalCount: 8,
          cdssFlags,
          recommendedActions: Array.isArray(item.recommended_actions)
            ? item.recommended_actions.slice(0, 3)
            : [],
        };
      });

    const missingCodingCount = openItems.filter(
      (item: any) => Boolean(item?.missing_cpt) || Boolean(item?.missing_icd10),
    ).length;
    const highValueOpenCount = openItems.filter((item: any) => Number(item?.total_charge_value || 0) >= 1000).length;
    const captureLagOver24h = highPriorityQueue.filter((item: any) => Number(item?.captureLagDays || 0) >= 1).length;
    const sourceContextGaps = highPriorityQueue.filter((item: any) => Boolean(item?.missingSourceContext)).length;
    const reviewedPendingFinalization = highPriorityQueue.filter((item: any) => Boolean(item?.staleReviewed)).length;
    const checklistTotal = highPriorityQueue.reduce(
      (sum: number, item: any) => sum + Number(item?.checklistTotalCount || 0),
      0,
    );
    const checklistComplete = highPriorityQueue.reduce(
      (sum: number, item: any) => sum + Number(item?.checklistCompleteCount || 0),
      0,
    );
    const cdssCoveragePercent =
      checklistTotal > 0 ? Number(((checklistComplete / checklistTotal) * 100).toFixed(1)) : 0;
    const potentialLeakage = Number(
      openItems.reduce((sum: number, item: any) => sum + Number(item?.total_charge_value || 0), 0).toFixed(2),
    );

    const recommendations = new Set<string>();
    if (Number(worklist?.summary?.overdue || 0) > 0) {
      recommendations.add('Clear overdue charge reviews first to prevent preventable billing delays.');
    }
    if (Number(worklist?.summary?.highRisk || 0) > 0) {
      recommendations.add('Prioritize high-risk charge rows with SLA breach and documentation defects.');
    }
    if (missingCodingCount > 0) {
      recommendations.add('Complete missing CPT/ICD-10 details before approval to reduce denial exposure.');
    }
    if (captureLagOver24h > 0) {
      recommendations.add('Reduce charge capture lag over 24 hours to protect same-cycle billing timeliness.');
    }
    if (sourceContextGaps > 0) {
      recommendations.add('Capture source order/procedure context for manual charges to strengthen audit traceability.');
    }
    if (reviewedPendingFinalization > 0) {
      recommendations.add('Finalize stale reviewed charges to prevent queue recycling and downstream delays.');
    }
    if (cdssCoveragePercent < 85) {
      recommendations.add('Improve structured charge documentation completeness to increase CDSS decision coverage.');
    }
    if (accountsSyncPending > 0) {
      recommendations.add('Push approved admissions to accounts to close physician-to-billing handoff gaps.');
    }
    if (potentialLeakage > 0) {
      recommendations.add(`Open charge queue currently carries approximately $${potentialLeakage.toFixed(2)} at-risk value.`);
    }
    for (const item of highPriorityQueue) {
      for (const action of item.recommendedActions || []) {
        if (String(action || '').trim()) {
          recommendations.add(String(action).trim());
        }
      }
      if (recommendations.size >= 8) break;
    }
    if (!recommendations.size) {
      recommendations.add('Maintain same-day charge validation and coding completeness checks.');
    }

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        total: Number(worklist?.summary?.total || 0),
        open: Number(worklist?.summary?.open || 0),
        overdue: Number(worklist?.summary?.overdue || 0),
        dueSoon: Number(worklist?.summary?.dueSoon || 0),
        highRisk: Number(worklist?.summary?.highRisk || 0),
        moderateRisk: Number(worklist?.summary?.moderateRisk || 0),
        missingCodingCount,
        highValueOpenCount,
        captureLagOver24h,
        sourceContextGaps,
        reviewedPendingFinalization,
        cdssCoveragePercent,
        potentialLeakageAmount: potentialLeakage,
        unreadNotifications,
        accountsSyncPending,
      },
      highPriorityQueue,
      recommendations: Array.from(recommendations).slice(0, 8),
    };
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

  private hydrateChargeWorklistRow(charge: any): any {
    const totalCharge = Number(charge?.totalCharge || Number(charge?.unitPrice || 0) * Number(charge?.quantity || 0));
    const normalizedTotal = Number.isFinite(totalCharge) ? Number(totalCharge.toFixed(2)) : 0;
    const status = String(charge?.chargeStatus || '').toLowerCase();
    const openStatus = status === 'pending' || status === 'reviewed';

    const serviceDate = charge?.serviceDate ? new Date(charge.serviceDate) : null;
    const ageDays = serviceDate
      ? Math.max(0, Math.floor((Date.now() - serviceDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const missingCpt = !charge?.cptCode;
    const missingIcd10 = !charge?.icd10Code;
    const highValue = normalizedTotal >= 1000;
    const stale = openStatus && ageDays >= 2;

    let slaStatus: 'on_track' | 'warning' | 'overdue' | 'resolved' = 'on_track';
    if (!openStatus) {
      slaStatus = 'resolved';
    } else if (ageDays >= 3) {
      slaStatus = 'overdue';
    } else if (ageDays >= 2) {
      slaStatus = 'warning';
    }

    let riskLevel: 'high' | 'moderate' | 'low' = 'low';
    if ((slaStatus === 'overdue' && (highValue || missingCpt || missingIcd10)) || normalizedTotal >= 3000) {
      riskLevel = 'high';
    } else if (slaStatus === 'warning' || missingCpt || missingIcd10 || highValue || stale) {
      riskLevel = 'moderate';
    }

    const recommendedActions: string[] = [];
    if (openStatus && slaStatus === 'overdue') {
      recommendedActions.push('Charge has breached review SLA: approve/reject immediately.');
    }
    if (openStatus && slaStatus === 'warning') {
      recommendedActions.push('Charge is approaching SLA: review before end of day.');
    }
    if (missingCpt) {
      recommendedActions.push('Add CPT code specificity to reduce downstream denial risk.');
    }
    if (missingIcd10) {
      recommendedActions.push('Link supporting ICD-10 diagnosis before final approval.');
    }
    if (charge?.captureMethod === 'manual' && !charge?.sourceType) {
      recommendedActions.push('Document charge source context for audit defensibility.');
    }
    if (recommendedActions.length === 0) {
      recommendedActions.push('Charge documentation is complete. Proceed with approval workflow.');
    }

    return {
      ...charge,
      total_charge_value: normalizedTotal,
      age_days: ageDays,
      sla_status: slaStatus,
      risk_level: riskLevel,
      missing_cpt: missingCpt,
      missing_icd10: missingIcd10,
      recommended_actions: recommendedActions,
    };
  }
}
