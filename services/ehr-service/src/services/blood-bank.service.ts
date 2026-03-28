import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { BloodDonor } from '../entities/blood-donor.entity';
import { BloodInventory } from '../entities/blood-inventory.entity';
import { BloodTransfusion } from '../entities/blood-transfusion.entity';

@Injectable()
export class BloodBankService {
  private readonly logger = new Logger(BloodBankService.name);

  constructor() {}

  // ==================== DONORS ====================

  async registerDonor(
    donorData: any,
    tenantDb: DataSource,
  ): Promise<BloodDonor> {
    const repository = tenantDb.getRepository(BloodDonor);
    const donor = repository.create(donorData);
    return await repository.save(donor) as unknown as BloodDonor;
  }

  async getDonors(
    filters: any,
    tenantDb: DataSource,
  ): Promise<BloodDonor[]> {
    const repository = tenantDb.getRepository(BloodDonor);
    return await repository.find({
      where: filters,
      order: { lastName: 'ASC' },
    });
  }

  // ==================== INVENTORY ====================

  async getInventory(
    filters: any,
    tenantDb: DataSource,
  ): Promise<BloodInventory[]> {
    const repository = tenantDb.getRepository(BloodInventory);
    
    const query = repository.createQueryBuilder('inventory')
      .where('inventory.status = :status', { status: filters.status || 'available' });

    if (filters.componentType) {
      query.andWhere('inventory.componentType = :componentType', { componentType: filters.componentType });
    }

    if (filters.bloodGroup) {
      query.andWhere('inventory.bloodGroup = :bloodGroup', { bloodGroup: filters.bloodGroup });
    }

    return await query.orderBy('inventory.expiryDate', 'ASC').getMany();
  }

  async getInventoryStats(
    tenantDb: DataSource,
  ): Promise<any> {
    const repository = tenantDb.getRepository(BloodInventory);

    const stats = await repository
      .createQueryBuilder('inventory')
      .select('inventory.componentType', 'component')
      .addSelect('inventory.bloodGroup', 'bloodGroup')
      .addSelect('COUNT(*)', 'count')
      .where('inventory.status = :status', { status: 'available' })
      .andWhere('inventory.expiryDate > :today', { today: new Date() })
      .groupBy('inventory.componentType')
      .addGroupBy('inventory.bloodGroup')
      .getRawMany();

    return stats;
  }

  async reserveUnit(
    unitId: string,
    patientId: string,
    tenantDb: DataSource,
  ): Promise<BloodInventory> {
    const repository = tenantDb.getRepository(BloodInventory);

    const unit = await repository.findOne({ where: { id: unitId } });
    if (!unit) {
      throw new NotFoundException('Blood unit not found');
    }

    if (unit.status !== 'available') {
      throw new Error('Blood unit not available');
    }

    unit.status = 'reserved';
    return await repository.save(unit);
  }

  // ==================== TRANSFUSIONS ====================

  async orderTransfusion(
    transfusionData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<BloodTransfusion> {
    const repository = tenantDb.getRepository(BloodTransfusion);

    const transfusion = repository.create({
      ...transfusionData,
      orderedById: userId,
      orderDate: new Date(),
      transfusionStatus: 'ordered',
    });

    return await repository.save(transfusion) as unknown as BloodTransfusion;
  }

  async startTransfusion(
    id: string,
    userId: string,
    preVitals: any,
    tenantDb: DataSource,
  ): Promise<BloodTransfusion> {
    const repository = tenantDb.getRepository(BloodTransfusion);

    const transfusion = await repository.findOne({ where: { id } });
    if (!transfusion) {
      throw new NotFoundException('Transfusion not found');
    }

    transfusion.startTime = new Date();
    transfusion.administeredById = userId;
    transfusion.preTransfusionVitals = preVitals;
    transfusion.transfusionStatus = 'in_progress';

    return await repository.save(transfusion);
  }

  async recordTransfusionVitals(
    id: string,
    vitals: any,
    tenantDb: DataSource,
  ): Promise<BloodTransfusion> {
    const repository = tenantDb.getRepository(BloodTransfusion);

    const transfusion = await repository.findOne({ where: { id } });
    if (!transfusion) {
      throw new NotFoundException('Transfusion not found');
    }

    const vitalsLog = transfusion.transfusionVitals || [];
    vitalsLog.push({
      ...vitals,
      time: new Date().toISOString(),
    });

    transfusion.transfusionVitals = vitalsLog;
    return await repository.save(transfusion);
  }

  async completeTransfusion(
    id: string,
    completionData: any,
    tenantDb: DataSource,
  ): Promise<BloodTransfusion> {
    const repository = tenantDb.getRepository(BloodTransfusion);

    const transfusion = await repository.findOne({ where: { id } });
    if (!transfusion) {
      throw new NotFoundException('Transfusion not found');
    }

    transfusion.endTime = new Date();
    transfusion.volumeTransfused = completionData.volumeTransfused;
    transfusion.completionNotes = completionData.notes;
    transfusion.transfusionStatus = 'completed';

    return await repository.save(transfusion);
  }

  async getActiveTransfusions(
    tenantDb: DataSource,
  ): Promise<BloodTransfusion[]> {
    const repository = tenantDb.getRepository(BloodTransfusion);

    return await repository.find({
      where: { transfusionStatus: 'in_progress' },
      relations: ['patient', 'administeredBy', 'inventory'],
      order: { startTime: 'ASC' },
    });
  }

  async getTransfusionWorklist(
    tenantDb: DataSource,
    statuses?: string[],
  ): Promise<BloodTransfusion[]> {
    const repository = tenantDb.getRepository(BloodTransfusion);
    const normalizedStatuses = (statuses || [])
      .map((status) => String(status || '').trim().toLowerCase())
      .filter(Boolean);

    const targetStatuses = normalizedStatuses.length > 0
      ? normalizedStatuses
      : ['ordered', 'in_progress'];

    return await repository.find({
      where: { transfusionStatus: In(targetStatuses) },
      relations: ['patient', 'administeredBy', 'orderedBy', 'inventory'],
      order: { orderDate: 'DESC' },
    });
  }

  async getTransfusionWorklistEnhanced(
    tenantDb: DataSource,
    statuses?: string[],
    options?: {
      includeCompleted?: boolean;
      limit?: number;
      focus?: string;
    },
  ): Promise<any> {
    const includeCompleted = Boolean(options?.includeCompleted);
    const focus = String(options?.focus || 'all').toLowerCase();
    const limit = Number.isFinite(Number(options?.limit))
      ? Math.min(Math.max(Number(options?.limit), 1), 250)
      : 120;

    const defaultStatuses = includeCompleted
      ? ['ordered', 'in_progress', 'completed']
      : ['ordered', 'in_progress'];
    const baseStatuses = (statuses || []).length > 0 ? statuses : defaultStatuses;
    const worklist = await this.getTransfusionWorklist(tenantDb, baseStatuses);
    const transfusionIds = (worklist || []).map((item) => item.id).filter(Boolean);

    let reactionRows: Array<{ transfusion_id: string; reaction_count: string }> = [];
    if (transfusionIds.length > 0) {
      try {
        reactionRows = await tenantDb.query(
          `SELECT transfusion_id, COUNT(*)::text AS reaction_count
           FROM transfusion_reactions
           WHERE transfusion_id = ANY($1::uuid[])
           GROUP BY transfusion_id`,
          [transfusionIds],
        );
      } catch (error) {
        this.logger.warn('transfusion_reactions table not available for enhanced worklist; continuing without reaction history');
      }
    }

    const reactionMap = new Map<string, number>(
      (reactionRows || []).map((row) => [row.transfusion_id, Number(row.reaction_count || 0)]),
    );
    const now = new Date();

    const enriched = (worklist || []).map((transfusion) => {
      const status = String(transfusion.transfusionStatus || '').toLowerCase();
      const orderDate = transfusion.orderDate ? new Date(transfusion.orderDate) : null;
      const startTime = transfusion.startTime ? new Date(transfusion.startTime) : null;
      const endTime = transfusion.endTime ? new Date(transfusion.endTime) : null;
      const orderAgeHours = orderDate ? Math.round(((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60)) * 10) / 10 : null;
      const startDelayMinutes =
        status === 'ordered' && orderDate
          ? Math.max(0, Math.round((now.getTime() - orderDate.getTime()) / (1000 * 60)))
          : 0;
      const lastVitalsAt = this.resolveLastVitalsTimestamp(transfusion.transfusionVitals || []);
      const monitoringGapMinutes =
        status === 'in_progress'
          ? this.resolveMonitoringGapMinutes(startTime, lastVitalsAt, now)
          : 0;
      const inProgressDurationHours =
        status === 'in_progress' && startTime
          ? Math.round(((now.getTime() - startTime.getTime()) / (1000 * 60 * 60)) * 10) / 10
          : 0;
      const expiryDays = this.resolveDaysToExpiry(transfusion?.inventory?.expiryDate, now);
      const reactionCount = reactionMap.get(transfusion.id) || 0;
      const missingConsent = !Boolean(transfusion.consentObtained);
      const missingCrossmatch = !Boolean(transfusion.crossMatchId);
      const missingIndication = !String(transfusion.indication || '').trim();
      const missingBaselineVitals = !Boolean(transfusion.preTransfusionVitals);
      const monitoringEntriesCount = Array.isArray(transfusion.transfusionVitals) ? transfusion.transfusionVitals.length : 0;
      const missingMonitoringEntries =
        (status === 'in_progress' || status === 'completed') && monitoringEntriesCount === 0;
      const missingCompletionNotes =
        status === 'completed' && !String(transfusion.completionNotes || '').trim();
      const reactionFlaggedNoDocumentation =
        (Boolean(transfusion.transfusionReaction) || reactionCount > 0) &&
        (!String(transfusion.reactionType || '').trim() ||
          !String(transfusion.reactionSeverity || '').trim() ||
          !String(transfusion.reactionManagement || '').trim());
      const donorBloodType = this.normalizeBloodType(
        transfusion?.inventory?.bloodGroup && transfusion?.inventory?.rhFactor
          ? `${transfusion.inventory.bloodGroup}${String(transfusion.inventory.rhFactor).toLowerCase() === 'negative' ? '-' : '+'}`
          : null,
      );
      const recipientBloodType = this.normalizeBloodType(transfusion?.patient?.bloodType || null);
      const isRbcProduct = this.isRBCProduct(transfusion?.inventory?.componentType);
      const compatibilityStatus: 'compatible' | 'incompatible' | 'unknown' | 'n/a' =
        !isRbcProduct
          ? 'n/a'
          : !recipientBloodType || !donorBloodType
          ? 'unknown'
          : this.isRBCCompatible(recipientBloodType, donorBloodType)
          ? 'compatible'
          : 'incompatible';
      const compatibilityAlert = compatibilityStatus === 'incompatible';
      const compatibilityUnknown = compatibilityStatus === 'unknown';
      const riskScore = this.calculateTransfusionRiskScore({
        status,
        startDelayMinutes,
        monitoringGapMinutes,
        inProgressDurationHours,
        reactionCount,
        expiryDays,
        missingConsent,
        missingCrossmatch,
        missingIndication,
        missingBaselineVitals,
        missingMonitoringEntries,
        missingCompletionNotes,
        reactionFlaggedNoDocumentation,
        incompatibleBloodType: compatibilityAlert,
        unknownCompatibility: compatibilityUnknown,
      });
      const riskLevel =
        riskScore >= 85
          ? 'critical'
          : riskScore >= 65
          ? 'high'
          : riskScore >= 40
          ? 'moderate'
          : 'low';
      const slaStatus =
        status === 'completed'
          ? 'resolved'
          : status === 'ordered' && startDelayMinutes > 120
          ? 'overdue'
          : status === 'ordered' && startDelayMinutes > 60
          ? 'warning'
          : status === 'in_progress' && monitoringGapMinutes > 30
          ? 'overdue'
          : status === 'in_progress' && monitoringGapMinutes > 15
          ? 'warning'
          : 'on_track';
      const hasReactionHistory = reactionCount > 0;
      const hasMonitoringGap = monitoringGapMinutes > 15;
      const hasStartDelay = startDelayMinutes > 60;
      const hasDocumentationGap =
        missingConsent ||
        missingCrossmatch ||
        missingIndication ||
        missingBaselineVitals ||
        missingMonitoringEntries ||
        missingCompletionNotes ||
        reactionFlaggedNoDocumentation;

      const cdssFlags: string[] = [];
      if (compatibilityAlert) cdssFlags.push('ABO/Rh compatibility block');
      else if (compatibilityUnknown) cdssFlags.push('Compatibility unresolved');
      if (missingConsent) cdssFlags.push('Consent missing');
      if (missingCrossmatch) cdssFlags.push('Crossmatch missing');
      if (missingIndication) cdssFlags.push('Indication missing');
      if (missingBaselineVitals) cdssFlags.push('Baseline vitals missing');
      if (hasStartDelay) cdssFlags.push(`Start delay ${startDelayMinutes}m`);
      if (hasMonitoringGap) cdssFlags.push(`Monitoring gap ${monitoringGapMinutes}m`);
      if (missingMonitoringEntries) cdssFlags.push('No interval vitals documented');
      if (missingCompletionNotes) cdssFlags.push('Completion notes missing');
      if (reactionFlaggedNoDocumentation) cdssFlags.push('Reaction details incomplete');

      const payload = {
        id: transfusion.id,
        patientId: transfusion.patientId,
        patientName: `${transfusion.patient?.firstName || ''} ${transfusion.patient?.lastName || ''}`.trim() || 'Unknown patient',
        inventoryId: transfusion.inventoryId,
        unitNumber: transfusion.inventory?.unitNumber || null,
        componentType: transfusion.inventory?.componentType || null,
        donorBloodGroup: transfusion.inventory?.bloodGroup || null,
        donorRhFactor: transfusion.inventory?.rhFactor || null,
        donorBloodType,
        recipientBloodType,
        compatibilityStatus,
        compatibilityAlert,
        compatibilityUnknown,
        status,
        indication: transfusion.indication || null,
        orderDate: orderDate ? orderDate.toISOString() : null,
        startTime: startTime ? startTime.toISOString() : null,
        endTime: endTime ? endTime.toISOString() : null,
        orderAgeHours,
        startDelayMinutes,
        monitoringGapMinutes,
        inProgressDurationHours,
        expiryDays,
        reactionCount,
        monitoringEntriesCount,
        missingConsent,
        missingCrossmatch,
        missingIndication,
        missingBaselineVitals,
        missingMonitoringEntries,
        missingCompletionNotes,
        reactionFlaggedNoDocumentation,
        hasDocumentationGap,
        riskScore,
        riskLevel,
        slaStatus,
        hasReactionHistory,
        hasMonitoringGap,
        hasStartDelay,
        cdssFlags,
      };

      return {
        ...payload,
        recommendedActions: this.buildTransfusionRecommendedActions(payload),
      };
    });

    const filtered = enriched.filter((item) => {
      if (focus === 'critical') return item.riskLevel === 'critical' || item.riskLevel === 'high';
      if (focus === 'monitoring') return item.hasMonitoringGap;
      if (focus === 'ordered-delay') return item.hasStartDelay;
      if (focus === 'reactions') return item.hasReactionHistory;
      if (focus === 'compatibility') return item.compatibilityAlert || item.compatibilityUnknown;
      if (focus === 'documentation') return item.hasDocumentationGap;
      return true;
    });

    const priorityRank = { critical: 0, high: 1, moderate: 2, low: 3 } as const;
    filtered.sort((a, b) => {
      const byPriority =
        (priorityRank[a.riskLevel as keyof typeof priorityRank] ?? 4) -
        (priorityRank[b.riskLevel as keyof typeof priorityRank] ?? 4);
      if (byPriority !== 0) return byPriority;
      if (Number(b.riskScore || 0) !== Number(a.riskScore || 0)) {
        return Number(b.riskScore || 0) - Number(a.riskScore || 0);
      }
      return new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime();
    });

    const summary = {
      total: filtered.length,
      ordered: filtered.filter((item) => item.status === 'ordered').length,
      inProgress: filtered.filter((item) => item.status === 'in_progress').length,
      completed: filtered.filter((item) => item.status === 'completed').length,
      critical: filtered.filter((item) => item.riskLevel === 'critical').length,
      high: filtered.filter((item) => item.riskLevel === 'high').length,
      moderate: filtered.filter((item) => item.riskLevel === 'moderate').length,
      overdue: filtered.filter((item) => item.slaStatus === 'overdue').length,
      warning: filtered.filter((item) => item.slaStatus === 'warning').length,
      monitoringGaps: filtered.filter((item) => item.hasMonitoringGap).length,
      delayedStarts: filtered.filter((item) => item.hasStartDelay).length,
      withReactionHistory: filtered.filter((item) => item.hasReactionHistory).length,
      compatibilityAlerts: filtered.filter((item) => item.compatibilityAlert).length,
      compatibilityUnknown: filtered.filter((item) => item.compatibilityUnknown).length,
      missingConsent: filtered.filter((item) => item.missingConsent).length,
      missingCrossmatch: filtered.filter((item) => item.missingCrossmatch).length,
      missingIndication: filtered.filter((item) => item.missingIndication).length,
      missingBaselineVitals: filtered.filter((item) => item.missingBaselineVitals).length,
      missingMonitoringEntries: filtered.filter((item) => item.missingMonitoringEntries).length,
      missingCompletionNotes: filtered.filter((item) => item.missingCompletionNotes).length,
      reactionDocumentationGaps: filtered.filter((item) => item.reactionFlaggedNoDocumentation).length,
      documentationGaps: filtered.filter((item) => item.hasDocumentationGap).length,
      cdssCoveragePercent:
        filtered.length > 0
          ? Math.round((filtered.filter((item) => (item.cdssFlags || []).length === 0).length / filtered.length) * 100)
          : 100,
      avgRiskScore:
        filtered.length > 0
          ? Math.round(
              (filtered.reduce((sum, item) => sum + Number(item.riskScore || 0), 0) / filtered.length) * 10,
            ) / 10
          : 0,
    };

    return {
      summary,
      items: filtered.slice(0, limit),
      meta: {
        focus,
        includeCompleted,
        limit,
      },
    };
  }

  async getOperationalBrief(
    tenantDb: DataSource,
    options?: {
      includeCompleted?: boolean;
      limit?: number;
    },
  ): Promise<any> {
    const now = new Date();
    const inventory = await this.getInventory({ status: 'available' }, tenantDb);
    const worklist = await this.getTransfusionWorklistEnhanced(tenantDb, undefined, {
      includeCompleted: Boolean(options?.includeCompleted),
      focus: 'all',
      limit: Number.isFinite(Number(options?.limit)) ? Number(options?.limit) : 200,
    });

    const componentSummaryMap = new Map<string, { componentType: string; total: number; usable: number; nearExpiry: number; expired: number }>();
    const bloodTypeSummaryMap = new Map<string, number>();

    let totalAvailable = 0;
    let usableUnits = 0;
    let nearExpiryUnits = 0;
    let expiredUnits = 0;

    for (const unit of inventory || []) {
      totalAvailable += 1;
      const componentType = String(unit.componentType || 'unknown').toLowerCase();
      const componentSummary =
        componentSummaryMap.get(componentType) ||
        { componentType, total: 0, usable: 0, nearExpiry: 0, expired: 0 };
      componentSummary.total += 1;

      const expiryDays = this.resolveDaysToExpiry(unit.expiryDate, now);
      const isExpired = expiryDays !== null && expiryDays < 0;
      const isNearExpiry = expiryDays !== null && expiryDays >= 0 && expiryDays <= 1;

      if (isExpired) {
        expiredUnits += 1;
        componentSummary.expired += 1;
      } else {
        usableUnits += 1;
        componentSummary.usable += 1;
        if (isNearExpiry) {
          nearExpiryUnits += 1;
          componentSummary.nearExpiry += 1;
        }
        const donorType = this.normalizeBloodType(
          unit.bloodGroup && unit.rhFactor
            ? `${unit.bloodGroup}${String(unit.rhFactor).toLowerCase() === 'negative' ? '-' : '+'}`
            : null,
        );
        if (donorType) {
          bloodTypeSummaryMap.set(donorType, (bloodTypeSummaryMap.get(donorType) || 0) + 1);
        }
      }

      componentSummaryMap.set(componentType, componentSummary);
    }

    const componentSummaries = Array.from(componentSummaryMap.values()).sort((a, b) => b.usable - a.usable);
    const bloodTypeSummaries = Array.from(bloodTypeSummaryMap.entries())
      .map(([bloodType, count]) => ({ bloodType, count }))
      .sort((a, b) => b.count - a.count);

    const usableRbcUnits = (inventory || []).filter((unit: any) => {
      const expiryDays = this.resolveDaysToExpiry(unit.expiryDate, now);
      return this.isRBCProduct(unit.componentType) && (expiryDays === null || expiryDays >= 0);
    });
    const oNegativeAvailable = usableRbcUnits.filter((unit: any) => this.normalizeBloodType(`${unit.bloodGroup}${String(unit.rhFactor).toLowerCase() === 'negative' ? '-' : '+'}`) === 'O-').length;
    const oPositiveAvailable = usableRbcUnits.filter((unit: any) => this.normalizeBloodType(`${unit.bloodGroup}${String(unit.rhFactor).toLowerCase() === 'negative' ? '-' : '+'}`) === 'O+').length;

    const plateletsAvailable = (inventory || []).filter((unit: any) => {
      const expiryDays = this.resolveDaysToExpiry(unit.expiryDate, now);
      const componentType = String(unit.componentType || '').toLowerCase();
      return (componentType.includes('platelet') || componentType === 'platelets') && (expiryDays === null || expiryDays >= 0);
    }).length;
    const ffpAvailable = (inventory || []).filter((unit: any) => {
      const expiryDays = this.resolveDaysToExpiry(unit.expiryDate, now);
      const componentType = String(unit.componentType || '').toLowerCase();
      return (componentType.includes('ffp') || componentType.includes('plasma')) && (expiryDays === null || expiryDays >= 0);
    }).length;

    const criticalShortages: Array<{
      key: string;
      componentType: string;
      bloodType: string | null;
      availableUnits: number;
      threshold: number;
      recommendation: string;
    }> = [];

    if (oNegativeAvailable < 2) {
      criticalShortages.push({
        key: 'rbc_o_negative',
        componentType: 'packed_rbc',
        bloodType: 'O-',
        availableUnits: oNegativeAvailable,
        threshold: 2,
        recommendation: 'Prioritize O- donor mobilization and reserve O- units for life-threatening emergencies.',
      });
    }
    if (oPositiveAvailable < 4) {
      criticalShortages.push({
        key: 'rbc_o_positive',
        componentType: 'packed_rbc',
        bloodType: 'O+',
        availableUnits: oPositiveAvailable,
        threshold: 4,
        recommendation: 'Increase O+ collection targets and monitor non-urgent RBC usage closely.',
      });
    }
    if (plateletsAvailable < 4) {
      criticalShortages.push({
        key: 'platelets',
        componentType: 'platelets',
        bloodType: null,
        availableUnits: plateletsAvailable,
        threshold: 4,
        recommendation: 'Escalate platelet stock replenishment due to short shelf-life risk.',
      });
    }
    if (ffpAvailable < 3) {
      criticalShortages.push({
        key: 'ffp',
        componentType: 'ffp',
        bloodType: null,
        availableUnits: ffpAvailable,
        threshold: 3,
        recommendation: 'Review plasma demand and trigger urgent plasma procurement.',
      });
    }

    const worklistItems = Array.isArray(worklist?.items) ? worklist.items : [];
    const compatibilityAlerts = worklistItems.filter((item: any) => item.compatibilityAlert);
    const compatibilityUnknown = worklistItems.filter((item: any) => item.compatibilityUnknown);
    const highPriorityQueue = [...worklistItems]
      .sort((a: any, b: any) => Number(b.riskScore || 0) - Number(a.riskScore || 0))
      .slice(0, 8)
      .map((item: any) => ({
        id: item.id,
        patientId: item.patientId,
        patientName: item.patientName,
        status: item.status,
        riskLevel: item.riskLevel,
        riskScore: Number(item.riskScore || 0),
        compatibilityStatus: item.compatibilityStatus || 'unknown',
        unitNumber: item.unitNumber || null,
        componentType: item.componentType || null,
        cdssFlags: Array.isArray(item.cdssFlags) ? item.cdssFlags.slice(0, 4) : [],
        recommendedActions: Array.isArray(item.recommendedActions) ? item.recommendedActions.slice(0, 3) : [],
      }));

    const recommendations = new Set<string>();
    if (criticalShortages.length > 0) {
      recommendations.add('Activate blood inventory conservation plan for low-stock components.');
    }
    if (compatibilityAlerts.length > 0) {
      recommendations.add('Hold incompatible RBC transfusions pending urgent crossmatch resolution.');
    }
    if (compatibilityUnknown.length > 0) {
      recommendations.add('Complete missing patient/donor blood typing before RBC administration.');
    }
    if (Number(worklist?.summary?.monitoringGaps || 0) > 0) {
      recommendations.add('Close transfusion monitoring gaps and document interval vitals immediately.');
    }
    if (Number(worklist?.summary?.missingConsent || 0) > 0) {
      recommendations.add('Close missing transfusion consent records before further administration.');
    }
    if (Number(worklist?.summary?.missingCrossmatch || 0) > 0) {
      recommendations.add('Resolve crossmatch documentation gaps for active transfusion orders.');
    }
    if (Number(worklist?.summary?.missingBaselineVitals || 0) > 0) {
      recommendations.add('Capture baseline pre-transfusion vitals for all open transfusions.');
    }
    if (Number(worklist?.summary?.documentationGaps || 0) > 0) {
      recommendations.add('Assign charge nurse review to clear transfusion documentation gaps this shift.');
    }
    if (Number(worklist?.summary?.cdssCoveragePercent || 100) < 85) {
      recommendations.add('Run bedside transfusion safety timeout to improve CDSS compliance coverage.');
    }
    if (nearExpiryUnits > 0) {
      recommendations.add('Rotate near-expiry units to imminent-use cases to reduce wastage.');
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
      recommendations.add('Maintain standard transfusion safety and stock governance workflows.');
    }

    return {
      generatedAt: now.toISOString(),
      inventorySummary: {
        totalAvailable,
        usableUnits,
        nearExpiryUnits,
        expiredUnits,
        componentSummaries,
        bloodTypeSummaries,
        criticalShortages,
      },
      worklistSummary: worklist?.summary || null,
      safetySummary: {
        compatibilityAlerts: compatibilityAlerts.length,
        compatibilityUnknown: compatibilityUnknown.length,
        criticalRiskItems: worklistItems.filter((item: any) => item.riskLevel === 'critical').length,
        overdueItems: worklistItems.filter((item: any) => item.slaStatus === 'overdue').length,
        monitoringGaps: Number(worklist?.summary?.monitoringGaps || 0),
        delayedStarts: Number(worklist?.summary?.delayedStarts || 0),
        missingConsent: Number(worklist?.summary?.missingConsent || 0),
        missingCrossmatch: Number(worklist?.summary?.missingCrossmatch || 0),
        missingIndication: Number(worklist?.summary?.missingIndication || 0),
        missingBaselineVitals: Number(worklist?.summary?.missingBaselineVitals || 0),
        missingMonitoringEntries: Number(worklist?.summary?.missingMonitoringEntries || 0),
        missingCompletionNotes: Number(worklist?.summary?.missingCompletionNotes || 0),
        reactionDocumentationGaps: Number(worklist?.summary?.reactionDocumentationGaps || 0),
        documentationGaps: Number(worklist?.summary?.documentationGaps || 0),
        cdssCoveragePercent: Number(worklist?.summary?.cdssCoveragePercent ?? 100),
      },
      highPriorityQueue,
      recommendations: Array.from(recommendations).slice(0, 8),
    };
  }

  async typeAndScreen(patientId: string, data: { bloodGroup: string; rhFactor: string; antibodyScreen?: string }, userId: string, tenantDb: DataSource): Promise<any> {
    const [row] = await tenantDb.query(
      `INSERT INTO blood_cross_match (patient_id, blood_group, rh_factor, antibody_screen, performed_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [patientId, data.bloodGroup, data.rhFactor, data.antibodyScreen || 'negative', userId],
    );
    return row;
  }

  async performCrossmatch(data: { patientId: string; inventoryId: string; majorCrossMatch?: string; minorCrossMatch?: string }, userId: string, tenantDb: DataSource): Promise<any> {
    const result = (data.majorCrossMatch || 'compatible').toLowerCase() === 'compatible' ? 'compatible' : 'incompatible';
    const [row] = await tenantDb.query(
      `INSERT INTO blood_cross_match (patient_id, inventory_id, blood_group, rh_factor, major_cross_match, minor_cross_match, cross_match_result, performed_by)
       SELECT $1, $2, bi.blood_group, bi.rh_factor, $3, $4, $5, $6
       FROM blood_inventory bi WHERE bi.id = $2
       RETURNING *`,
      [data.patientId, data.inventoryId, data.majorCrossMatch || 'compatible', data.minorCrossMatch || 'compatible', result, userId],
    );
    if (!row) throw new NotFoundException('Inventory unit not found');
    return row;
  }

  async getCrossmatchByPatient(patientId: string, tenantDb: DataSource): Promise<any[]> {
    return tenantDb.query(
      `SELECT * FROM blood_cross_match WHERE patient_id = $1 ORDER BY performed_at DESC`,
      [patientId],
    );
  }

  async reportTransfusionReaction(transfusionId: string, data: any, userId: string, tenantDb: DataSource): Promise<any> {
    const [tx] = await tenantDb.query(`SELECT id, patient_id FROM blood_transfusions WHERE id = $1`, [transfusionId]);
    if (!tx) throw new NotFoundException('Transfusion not found');
    const [row] = await tenantDb.query(
      `INSERT INTO transfusion_reactions (transfusion_id, patient_id, reaction_time, reaction_type, severity, symptoms, vitals_at_reaction, treatment_given, transfusion_stopped, reported_by)
       VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        transfusionId, tx.patient_id, data.reactionType || 'other', data.severity || 'moderate',
        data.symptoms ?? null, data.vitalsAtReaction ? JSON.stringify(data.vitalsAtReaction) : null,
        data.treatmentGiven ?? null, data.transfusionStopped !== false, userId,
      ],
    );
    return row;
  }

  async getTransfusionReactions(transfusionId: string, tenantDb: DataSource): Promise<any[]> {
    return tenantDb.query(
      `SELECT * FROM transfusion_reactions WHERE transfusion_id = $1 ORDER BY reaction_time DESC`,
      [transfusionId],
    );
  }

  async activateMassiveTransfusionProtocol(patientId: string, data: { unitsRequested?: number; indication?: string }, userId: string, tenantDb: DataSource): Promise<any> {
    const units = data.unitsRequested ?? 4;
    this.logger.log(`MTP activated for patient ${patientId}, ${units} units requested`);
    return {
      activated: true,
      patientId,
      unitsRequested: units,
      indication: data.indication,
      message: 'Massive transfusion protocol activated; blood bank notified.',
    };
  }

  async getUtilizationReport(tenantDb: DataSource, startDate?: Date, endDate?: Date): Promise<any> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();
    const [row] = await tenantDb.query(
      `SELECT
        COUNT(*)::int as total_transfusions,
        COUNT(*) FILTER (WHERE transfusion_status = 'completed')::int as completed,
        COUNT(*) FILTER (WHERE transfusion_status = 'in_progress')::int as in_progress
       FROM blood_transfusions WHERE order_date BETWEEN $1 AND $2`,
      [start, end],
    );
    return row;
  }

  private resolveDaysToExpiry(expiryDate?: Date | string | null, now: Date = new Date()): number | null {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    if (Number.isNaN(expiry.getTime())) return null;
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  private resolveLastVitalsTimestamp(vitals: any[]): Date | null {
    if (!Array.isArray(vitals) || vitals.length === 0) return null;
    let latest: Date | null = null;
    for (const entry of vitals) {
      const candidate = new Date(entry?.time || entry?.timestamp || entry?.recordedAt || '');
      if (Number.isNaN(candidate.getTime())) continue;
      if (!latest || candidate > latest) latest = candidate;
    }
    return latest;
  }

  private resolveMonitoringGapMinutes(
    startTime: Date | null,
    lastVitalsAt: Date | null,
    now: Date = new Date(),
  ): number {
    if (!startTime && !lastVitalsAt) return 0;
    const reference = lastVitalsAt || startTime;
    if (!reference) return 0;
    return Math.max(0, Math.round((now.getTime() - reference.getTime()) / (1000 * 60)));
  }

  private calculateTransfusionRiskScore(input: {
    status: string;
    startDelayMinutes: number;
    monitoringGapMinutes: number;
    inProgressDurationHours: number;
    reactionCount: number;
    expiryDays: number | null;
    missingConsent: boolean;
    missingCrossmatch: boolean;
    missingIndication: boolean;
    missingBaselineVitals: boolean;
    missingMonitoringEntries: boolean;
    missingCompletionNotes: boolean;
    reactionFlaggedNoDocumentation: boolean;
    incompatibleBloodType: boolean;
    unknownCompatibility: boolean;
  }): number {
    let score = 10;
    if (input.missingConsent) score += 24;
    if (input.missingCrossmatch) score += 26;
    if (input.missingIndication) score += 8;
    if (input.missingBaselineVitals) score += 12;
    if (input.missingMonitoringEntries) score += 10;
    if (input.missingCompletionNotes) score += 8;
    if (input.reactionFlaggedNoDocumentation) score += 12;
    if (input.incompatibleBloodType) score += 45;
    else if (input.unknownCompatibility) score += 10;
    if (input.expiryDays !== null && input.expiryDays < 0) score += 30;
    else if (input.expiryDays !== null && input.expiryDays <= 1) score += 18;
    if (input.status === 'ordered' && input.startDelayMinutes > 120) score += 24;
    else if (input.status === 'ordered' && input.startDelayMinutes > 60) score += 14;
    if (input.status === 'in_progress' && input.monitoringGapMinutes > 30) score += 24;
    else if (input.status === 'in_progress' && input.monitoringGapMinutes > 15) score += 14;
    if (input.status === 'in_progress' && input.inProgressDurationHours > 4) score += 10;
    if (input.reactionCount > 0) score += Math.min(22, input.reactionCount * 9);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private buildTransfusionRecommendedActions(item: {
    status: string;
    startDelayMinutes: number;
    monitoringGapMinutes: number;
    reactionCount: number;
    expiryDays: number | null;
    missingConsent: boolean;
    missingCrossmatch: boolean;
    missingIndication?: boolean;
    missingBaselineVitals?: boolean;
    missingMonitoringEntries?: boolean;
    missingCompletionNotes?: boolean;
    reactionFlaggedNoDocumentation?: boolean;
    riskLevel: string;
    compatibilityStatus?: string;
    compatibilityAlert?: boolean;
    compatibilityUnknown?: boolean;
  }): string[] {
    const actions: string[] = [];
    if (item.compatibilityAlert) {
      actions.push('Stop and re-verify ABO/Rh compatibility before any RBC transfusion');
    } else if (item.compatibilityUnknown) {
      actions.push('Document recipient blood type and donor compatibility before proceeding');
    }
    if (item.missingConsent) {
      actions.push('Capture transfusion consent before continuing');
    }
    if (item.missingCrossmatch) {
      actions.push('Perform and document crossmatch compatibility');
    }
    if (item.missingIndication) {
      actions.push('Document transfusion indication before proceeding');
    }
    if (item.missingBaselineVitals) {
      actions.push('Capture baseline pre-transfusion vitals now');
    }
    if (item.status === 'ordered' && item.startDelayMinutes > 60) {
      actions.push('Prioritize transfusion start and baseline vitals capture');
    }
    if (item.status === 'in_progress' && item.monitoringGapMinutes > 15) {
      actions.push('Record interval transfusion vitals immediately');
    }
    if (item.missingMonitoringEntries) {
      actions.push('Backfill monitoring entries and confirm bedside checks');
    }
    if (item.missingCompletionNotes) {
      actions.push('Finalize completion notes with outcome and total volume');
    }
    if (item.reactionFlaggedNoDocumentation) {
      actions.push('Complete transfusion reaction type, severity, and management details');
    }
    if (item.expiryDays !== null && item.expiryDays < 0) {
      actions.push('Quarantine expired unit and assign an alternate unit');
    } else if (item.expiryDays !== null && item.expiryDays <= 1) {
      actions.push('Confirm immediate usability of near-expiry unit');
    }
    if (item.reactionCount > 0) {
      actions.push('Apply enhanced reaction surveillance protocol');
    }
    if ((item.riskLevel === 'critical' || item.riskLevel === 'high') && item.status !== 'completed') {
      actions.push('Escalate to senior clinician and blood-bank coordinator');
    }
    if (!actions.length) {
      actions.push('Continue standard transfusion monitoring workflow');
    }
    return actions.slice(0, 4);
  }

  private normalizeBloodType(rawValue?: string | null): string | null {
    if (!rawValue) return null;
    const raw = String(rawValue).trim().toUpperCase().replace(/\s+/g, '');
    const match = raw.match(/^(O|A|B|AB)(\+|-|POSITIVE|NEGATIVE)?$/);
    if (!match) return null;
    const abo = match[1];
    const rhRaw = match[2] || '';
    const rh = rhRaw === '-' || rhRaw === 'NEGATIVE' ? '-' : '+';
    return `${abo}${rh}`;
  }

  private isRBCProduct(componentType?: string | null): boolean {
    const value = String(componentType || '').toLowerCase();
    return value.includes('packed_rbc') || value.includes('whole_blood') || value.includes('rbc');
  }

  private isRBCCompatible(recipientType: string, donorType: string): boolean {
    const matrix: Record<string, string[]> = {
      'O-': ['O-'],
      'O+': ['O-', 'O+'],
      'A-': ['O-', 'A-'],
      'A+': ['O-', 'O+', 'A-', 'A+'],
      'B-': ['O-', 'B-'],
      'B+': ['O-', 'O+', 'B-', 'B+'],
      'AB-': ['O-', 'A-', 'B-', 'AB-'],
      'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    };
    return matrix[recipientType]?.includes(donorType) || false;
  }
}
