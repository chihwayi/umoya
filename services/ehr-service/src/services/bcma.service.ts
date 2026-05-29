import { Injectable, Logger, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MedicationAdministrationRecord } from '../entities/medication-administration-record.entity';
import { PatientWristband } from '../entities/patient-wristband.entity';
import { MedicationBarcodeMaster } from '../entities/medication-barcode-master.entity';
import { MedicationAlert } from '../entities/medication-alert.entity';
import { Prescription } from '../entities/prescription.entity';
import { StoreroomService } from './storeroom.service';

@Injectable()
export class BcmaService {
  private readonly logger = new Logger(BcmaService.name);

  constructor(
    @Optional() private readonly storeroomService: StoreroomService,
  ) {}

  private async resolveWardLocationId(
    tenantDb: DataSource,
    admissionId?: string,
    wardName?: string,
  ): Promise<string | null> {
    if (!this.storeroomService) return null;

    if (admissionId) {
      const { rows } = await tenantDb.query(
        `SELECT ward_location_id FROM admissions WHERE id = $1 LIMIT 1`,
        [admissionId],
      );
      if (rows[0]?.ward_location_id) return rows[0].ward_location_id;
    }

    if (wardName) {
      const { rows } = await tenantDb.query(
        `SELECT id FROM inventory_locations WHERE name = $1 AND location_type = 'ward' LIMIT 1`,
        [wardName],
      );
      return rows[0]?.id ?? null;
    }

    return null;
  }

  async getWardStock(tenantDb: DataSource, wardIdentifier: string): Promise<any[]> {
    if (!this.storeroomService) return [];

    const isUuid = /^[0-9a-f-]{36}$/i.test(wardIdentifier);
    let locationId: string | null;

    if (isUuid) {
      locationId = wardIdentifier;
    } else {
      const { rows } = await tenantDb.query(
        `SELECT id FROM inventory_locations WHERE name = $1 AND location_type = 'ward' LIMIT 1`,
        [wardIdentifier],
      );
      locationId = rows[0]?.id ?? null;
    }

    if (!locationId) return [];
    return this.storeroomService.getStockByLocation(tenantDb, locationId);
  }

  // ==================== PATIENT WRISTBAND ====================

  async issueWristband(
    patientId: string,
    admissionId: string | null,
    userId: string,
    tenantDb: DataSource,
  ): Promise<PatientWristband> {
    const repository = tenantDb.getRepository(PatientWristband);

    // Generate unique barcode (MRN + timestamp)
    const barcode = `WB-${patientId.substring(0, 8)}-${Date.now()}`;

    const wristband = repository.create({
      patientId,
      admissionId,
      barcode,
      issuedById: userId,
      issuedAt: new Date(),
      isActive: true,
    });

    return await repository.save(wristband);
  }

  async verifyWristband(
    barcode: string,
    tenantDb: DataSource,
  ): Promise<PatientWristband> {
    const repository = tenantDb.getRepository(PatientWristband);

    const wristband = await repository.findOne({
      where: { barcode, isActive: true },
      relations: ['patient'],
    });

    if (!wristband) {
      throw new NotFoundException('Invalid or inactive wristband');
    }

    return wristband;
  }

  // ==================== MEDICATION BARCODE ====================

  async verifyMedicationBarcode(
    barcode: string,
    tenantDb: DataSource,
  ): Promise<MedicationBarcodeMaster> {
    const repository = tenantDb.getRepository(MedicationBarcodeMaster);

    const medication = await repository.findOne({
      where: { barcode, isActive: true },
    });

    if (!medication) {
      throw new NotFoundException('Medication barcode not found');
    }

    return medication;
  }

  // ==================== MEDICATION ADMINISTRATION ====================

  async verify5Rights(
    patientBarcode: string,
    medicationBarcode: string,
    prescriptionId: string,
    tenantDb: DataSource,
  ): Promise<{
    verified: boolean;
    patient: any;
    medication: any;
    failures: string[];
    alerts: any[];
  }> {
    const failures: string[] = [];
    const alerts: any[] = [];

    // Verify patient
    const wristband = await this.verifyWristband(patientBarcode, tenantDb);
    const patient = wristband.patient;

    // Verify medication
    const medication = await this.verifyMedicationBarcode(medicationBarcode, tenantDb);

    // Get prescription details (would need prescription service)
    // For now, basic verification

    // Check for high-alert drugs
    if (medication.isHighAlert) {
      alerts.push({
        type: 'high_alert_drug',
        severity: 'high',
        message: `${medication.medicationName} is a HIGH-ALERT medication. Double-check required.`,
      });
    }

    // Check for controlled substances
    if (medication.isControlled) {
      alerts.push({
        type: 'controlled_substance',
        severity: 'moderate',
        message: `${medication.medicationName} is a controlled substance. Witness required.`,
      });
    }

    const verified = failures.length === 0;

    return {
      verified,
      patient,
      medication,
      failures,
      alerts,
    };
  }

  async administerMedication(
    marData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<MedicationAdministrationRecord> {
    const repository = tenantDb.getRepository(MedicationAdministrationRecord);

    // ── Ward stock check ─────────────────────────────────────────────────────
    let wardLocationId: string | null = null;
    if (this.storeroomService && marData.drug_id) {
      wardLocationId = await this.resolveWardLocationId(
        tenantDb, marData.admission_id, marData.ward_name,
      );
      if (wardLocationId) {
        const catalogItem = await this.storeroomService.getCatalogByDrugId(tenantDb, marData.drug_id);
        if (catalogItem) {
          const avail = await this.storeroomService.checkAvailability(
            tenantDb, wardLocationId, catalogItem.id, 1,
          );
          if (!avail.available) {
            throw new BadRequestException(
              `"${marData.drug_name ?? 'This medication'}" is not in stock at this ward. ` +
              `Current ward stock: ${avail.quantity_on_hand ?? 0}. ` +
              `A restocking request has been automatically raised.`,
            );
          }
        }
      }
    }
    // ── end ward stock check ─────────────────────────────────────────────────

    const mar = repository.create({
      ...marData,
      administeredById: userId,
      actualAdministrationTime: new Date(),
      administrationStatus: 'administered',
    });

    const saved = await repository.save(mar) as unknown as MedicationAdministrationRecord;

    // ── Ward stock deduction ─────────────────────────────────────────────────
    if (this.storeroomService && wardLocationId && marData.drug_id) {
      this.storeroomService.getCatalogByDrugId(tenantDb, marData.drug_id).then(async (catalogItem) => {
        if (catalogItem) {
          try {
            await this.storeroomService!.deductStock(
              tenantDb, wardLocationId!, catalogItem.id, 1, 'nursing',
              (saved as any).id, marData.patient_id, userId,
            );
          } catch (e: any) {
            this.logger.warn(`Ward stock deduction failed for ${marData.drug_name}: ${e.message}`);
          }
        }
      }).catch((e: any) => {
        this.logger.warn(`Ward stock catalog lookup failed: ${e.message}`);
      });
    }
    // ── end ward stock deduction ─────────────────────────────────────────────

    return saved;
  }

  async getMARsByPatient(
    patientId: string,
    date: Date,
    tenantDb: DataSource,
  ): Promise<MedicationAdministrationRecord[]> {
    const repository = tenantDb.getRepository(MedicationAdministrationRecord);

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      return await repository
        .createQueryBuilder('mar')
        .where('mar.patient_id = :patientId', { patientId })
        .andWhere('mar.scheduled_time >= :startOfDay', { startOfDay })
        .andWhere('mar.scheduled_time <= :endOfDay', { endOfDay })
        .leftJoinAndSelect('mar.administeredBy', 'administeredBy')
        .leftJoinAndSelect('mar.witnessedBy', 'witnessedBy')
        .orderBy('mar.scheduled_time', 'ASC')
        .getMany();
    } catch (error) {
      // Fallback: use raw query if TypeORM has issues
      return await tenantDb.query(
        `SELECT mar.*, 
         u1.first_name as administered_by_first_name, u1.last_name as administered_by_last_name,
         u2.first_name as witnessed_by_first_name, u2.last_name as witnessed_by_last_name
         FROM medication_administration_records mar
         LEFT JOIN users u1 ON mar.administered_by = u1.id
         LEFT JOIN users u2 ON mar.witnessed_by = u2.id
         WHERE mar.patient_id = $1 
         AND mar.scheduled_time >= $2 
         AND mar.scheduled_time <= $3
         ORDER BY mar.scheduled_time ASC`,
        [patientId, startOfDay, endOfDay]
      );
    }
  }

  async getMedicationSafetyWorklist(
    tenantDb: DataSource,
    options?: {
      patientId?: string;
      date?: Date;
      includeCompleted?: boolean;
      focus?: string;
      limit?: number;
    },
  ): Promise<any> {
    const targetDate = options?.date ? new Date(options.date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    const includeCompleted = Boolean(options?.includeCompleted);
    const focus = String(options?.focus || 'all').toLowerCase();
    const limit = Number.isFinite(Number(options?.limit))
      ? Math.min(Math.max(Number(options?.limit), 1), 250)
      : 120;

    const params: any[] = [startOfDay, endOfDay];
    let patientClause = '';
    if (options?.patientId) {
      params.push(options.patientId);
      patientClause = ` AND mar.patient_id = $${params.length}`;
    }

    const rows = await tenantDb.query(
      `SELECT
         mar.*,
         p.first_name,
         p.last_name,
         p.patient_number,
         p.gender,
         p.date_of_birth,
         COALESCE(mbm.is_high_alert, false) AS is_high_alert,
         COALESCE(mbm.is_controlled, false) AS is_controlled,
         COALESCE(
           (
             SELECT COUNT(*)
             FROM medication_alerts ma
             WHERE ma.mar_id = mar.id
               AND ma.acknowledged = false
           ),
           0
         ) AS open_alert_count,
         COALESCE(
           (
             SELECT COUNT(*)
             FROM medication_alerts ma
             WHERE ma.mar_id = mar.id
               AND ma.acknowledged = false
               AND LOWER(ma.severity) IN ('critical', 'high')
           ),
           0
         ) AS high_alert_count
       FROM medication_administration_records mar
       LEFT JOIN patients p
         ON p.id = mar.patient_id
       LEFT JOIN medication_barcode_master mbm
         ON LOWER(mbm.medication_name) = LOWER(mar.medication_name)
        AND mbm.is_active = true
       WHERE mar.scheduled_time >= $1
         AND mar.scheduled_time <= $2
         ${patientClause}
       ORDER BY mar.scheduled_time ASC`,
      params,
    );

    const now = new Date();
    const items = (rows || [])
      .map((row: any) => {
        const status = String(row.administration_status || 'pending').toLowerCase();
        const scheduledAt = row.scheduled_time ? new Date(row.scheduled_time) : null;
        const actualAt = row.actual_administration_time ? new Date(row.actual_administration_time) : null;
        const diffMinutes = scheduledAt
          ? Math.round((scheduledAt.getTime() - now.getTime()) / (1000 * 60))
          : null;
        const overdueMinutes =
          status === 'pending' && diffMinutes !== null && diffMinutes < 0
            ? Math.abs(diffMinutes)
            : 0;
        const dueSoon = status === 'pending' && diffMinutes !== null && diffMinutes >= 0 && diffMinutes <= 30;
        const openAlertCount = Number(row.open_alert_count || 0);
        const highAlertCount = Number(row.high_alert_count || 0);
        const isHighAlert = Boolean(row.is_high_alert);
        const isControlled = Boolean(row.is_controlled);
        const hasException = ['held', 'refused'].includes(status);
        const patientBarcodeScanned = Boolean(row.patient_wristband_scanned);
        const medicationBarcodeScanned = Boolean(row.medication_barcode_scanned);
        const scanComplianceGap = !patientBarcodeScanned || !medicationBarcodeScanned;
        const verificationScore = [
          row.right_patient_verified,
          row.right_medication_verified,
          row.right_dose_verified,
          row.right_route_verified,
          row.right_time_verified,
        ].filter(Boolean).length;
        const incompleteFiveRights = verificationScore < 5;
        const witnessRequired = isHighAlert || isControlled;
        const missingWitnessDocumentation =
          witnessRequired && status === 'administered' && !Boolean(row.witnessed_by);
        const exceptionWithoutReason =
          (status === 'held' && !String(row.omission_reason || '').trim()) ||
          (status === 'refused' && !String(row.refusal_reason || '').trim());
        const adverseReaction = Boolean(row.adverse_reaction);
        const adverseReactionWithoutDetails =
          adverseReaction && !String(row.adverse_reaction_details || '').trim();
        const requiresAdministrationSite =
          status === 'administered' && this.isParenteralRoute(String(row.route || ''));
        const administrationSiteMissing =
          requiresAdministrationSite && !String(row.administration_site || '').trim();

        const checklistItems = [
          { applicable: true, met: Boolean(row.right_patient_verified) },
          { applicable: true, met: Boolean(row.right_medication_verified) },
          { applicable: true, met: Boolean(row.right_dose_verified) },
          { applicable: true, met: Boolean(row.right_route_verified) },
          { applicable: true, met: Boolean(row.right_time_verified) },
          { applicable: true, met: patientBarcodeScanned },
          { applicable: true, met: medicationBarcodeScanned },
          { applicable: witnessRequired, met: !missingWitnessDocumentation },
          { applicable: hasException, met: !exceptionWithoutReason },
          { applicable: adverseReaction, met: !adverseReactionWithoutDetails },
          { applicable: requiresAdministrationSite, met: !administrationSiteMissing },
        ];
        const checklistTotalCount = checklistItems.filter((item) => item.applicable).length;
        const checklistCompleteCount = checklistItems.filter((item) => item.applicable && item.met).length;

        const documentationGapCount = [
          incompleteFiveRights,
          scanComplianceGap,
          missingWitnessDocumentation,
          exceptionWithoutReason,
          adverseReactionWithoutDetails,
          administrationSiteMissing,
        ].filter(Boolean).length;

        const cdssFlags: string[] = [];
        if (incompleteFiveRights) cdssFlags.push('5-rights verification incomplete');
        if (scanComplianceGap) cdssFlags.push('Barcode scan compliance gap');
        if (missingWitnessDocumentation) cdssFlags.push('Witness documentation missing');
        if (exceptionWithoutReason) cdssFlags.push('Exception reason missing');
        if (adverseReactionWithoutDetails) cdssFlags.push('Adverse reaction details missing');
        if (administrationSiteMissing) cdssFlags.push('Administration site missing');

        const adherenceRiskScore = this.calculateMarRiskScore({
          status,
          overdueMinutes,
          isHighAlert,
          isControlled,
          openAlertCount,
          highAlertCount,
          hasException,
          verificationScore,
          adverseReaction,
          scanComplianceGap,
          missingWitnessDocumentation,
          exceptionWithoutReason,
          adverseReactionWithoutDetails,
          administrationSiteMissing,
        });
        const priority =
          adherenceRiskScore >= 85
            ? 'critical'
            : adherenceRiskScore >= 65
            ? 'high'
            : adherenceRiskScore >= 40
            ? 'moderate'
            : 'low';
        const slaStatus =
          status === 'administered'
            ? 'resolved'
            : status === 'pending' && overdueMinutes > 0
            ? 'overdue'
            : status === 'pending' && dueSoon
            ? 'warning'
            : status === 'pending'
            ? 'on_track'
            : hasException
            ? 'warning'
            : 'on_track';

        const payload = {
          id: row.id,
          patientId: row.patient_id,
          patientName: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown patient',
          patientNumber: row.patient_number || null,
          patientGender: row.gender || null,
          patientAge: this.getAgeYears(row.date_of_birth),
          prescriptionId: row.prescription_id,
          medicationName: row.medication_name,
          dose: row.dose,
          unit: row.unit,
          route: row.route,
          scheduledTime: row.scheduled_time,
          actualAdministrationTime: row.actual_administration_time,
          administrationStatus: status,
          overdueMinutes,
          dueInMinutes: diffMinutes !== null && diffMinutes >= 0 ? diffMinutes : null,
          dueSoon,
          isHighAlert,
          isControlled,
          openAlertCount,
          highAlertCount,
          verificationScore,
          adverseReaction,
          patientBarcodeScanned,
          medicationBarcodeScanned,
          incompleteFiveRights,
          scanComplianceGap,
          witnessRequired,
          missingWitnessDocumentation,
          exceptionWithoutReason,
          adverseReactionWithoutDetails,
          administrationSiteMissing,
          checklistCompleteCount,
          checklistTotalCount,
          documentationGapCount,
          cdssFlags,
          refusalReason: row.refusal_reason || null,
          omissionReason: row.omission_reason || null,
          adverseReactionDetails: row.adverse_reaction_details || null,
          administrationSite: row.administration_site || null,
          notes: row.notes || null,
          riskScore: adherenceRiskScore,
          priority,
          slaStatus,
        };
        return {
          ...payload,
          recommendedActions: this.buildMarRecommendedActions(payload),
        };
      })
      .filter((item: any) => {
        if (!includeCompleted && item.administrationStatus === 'administered') return false;
        if (focus === 'overdue') return item.slaStatus === 'overdue';
        if (focus === 'high-risk') return item.priority === 'high' || item.priority === 'critical';
        if (focus === 'alerts') return Number(item.openAlertCount) > 0;
        if (focus === 'exceptions') return ['held', 'refused'].includes(item.administrationStatus);
        if (focus === 'documentation') return Number(item.documentationGapCount || 0) > 0;
        return true;
      });

    const checklistTotal = items.reduce(
      (sum: number, item: any) => sum + Number(item.checklistTotalCount || 0),
      0,
    );
    const checklistComplete = items.reduce(
      (sum: number, item: any) => sum + Number(item.checklistCompleteCount || 0),
      0,
    );

    const summary = {
      total: items.length,
      pending: items.filter((item: any) => item.administrationStatus === 'pending').length,
      administered: items.filter((item: any) => item.administrationStatus === 'administered').length,
      held: items.filter((item: any) => item.administrationStatus === 'held').length,
      refused: items.filter((item: any) => item.administrationStatus === 'refused').length,
      overdue: items.filter((item: any) => item.slaStatus === 'overdue').length,
      dueSoon: items.filter((item: any) => item.dueSoon).length,
      highRisk: items.filter((item: any) => item.priority === 'high' || item.priority === 'critical').length,
      highAlertMeds: items.filter((item: any) => item.isHighAlert).length,
      controlledMeds: items.filter((item: any) => item.isControlled).length,
      withOpenAlerts: items.filter((item: any) => Number(item.openAlertCount) > 0).length,
      incompleteFiveRights: items.filter((item: any) => Boolean(item.incompleteFiveRights)).length,
      scanComplianceGaps: items.filter((item: any) => Boolean(item.scanComplianceGap)).length,
      missingWitnessDocumentation: items.filter((item: any) => Boolean(item.missingWitnessDocumentation)).length,
      exceptionWithoutReason: items.filter((item: any) => Boolean(item.exceptionWithoutReason)).length,
      adverseReactionWithoutDetails: items.filter((item: any) => Boolean(item.adverseReactionWithoutDetails)).length,
      administrationSiteMissing: items.filter((item: any) => Boolean(item.administrationSiteMissing)).length,
      documentationGaps: items.filter((item: any) => Number(item.documentationGapCount || 0) > 0).length,
      cdssCoveragePercent: checklistTotal > 0 ? this.safePercent(checklistComplete, checklistTotal) : 0,
      administrationRatePercent: this.safePercent(
        items.filter((item: any) => item.administrationStatus === 'administered').length,
        items.length,
      ),
      avgRiskScore:
        items.length > 0
          ? Math.round(
              (items.reduce((sum: number, item: any) => sum + Number(item.riskScore || 0), 0) / items.length) * 10,
            ) / 10
          : 0,
    };

    return {
      summary,
      items: items.slice(0, limit),
      meta: {
        focus,
        includeCompleted,
        date: startOfDay.toISOString().slice(0, 10),
      },
    };
  }

  async getMedicationSafetyHandoffBrief(
    tenantDb: DataSource,
    options?: {
      patientId?: string;
      date?: Date;
    },
  ): Promise<any> {
    const worklist = await this.getMedicationSafetyWorklist(tenantDb, {
      patientId: options?.patientId,
      date: options?.date || new Date(),
      includeCompleted: false,
      focus: 'all',
      limit: 250,
    });

    const items = Array.isArray(worklist?.items) ? worklist.items : [];
    const summary = worklist?.summary || {};

    const ranked = [...items].sort((a: any, b: any) => {
      const riskDiff = Number(b.riskScore || 0) - Number(a.riskScore || 0);
      if (riskDiff !== 0) return riskDiff;
      return Number(b.overdueMinutes || 0) - Number(a.overdueMinutes || 0);
    });

    const topRisks = ranked.slice(0, 8).map((item: any) => ({
      id: item.id,
      patientId: item.patientId,
      patientName: item.patientName,
      patientNumber: item.patientNumber,
      medicationName: item.medicationName,
      dose: item.dose,
      unit: item.unit,
      route: item.route,
      administrationStatus: item.administrationStatus,
      scheduledTime: item.scheduledTime,
      overdueMinutes: item.overdueMinutes || 0,
      openAlertCount: item.openAlertCount || 0,
      highAlertCount: item.highAlertCount || 0,
      priority: item.priority || 'low',
      riskScore: Number(item.riskScore || 0),
      documentationGapCount: Number(item.documentationGapCount || 0),
      checklistCompleteCount: Number(item.checklistCompleteCount || 0),
      checklistTotalCount: Number(item.checklistTotalCount || 0),
      cdssFlags: Array.isArray(item.cdssFlags) ? item.cdssFlags.slice(0, 3) : [],
      recommendedActions: Array.isArray(item.recommendedActions)
        ? item.recommendedActions.slice(0, 3)
        : [],
    }));

    const careGaps: string[] = [];
    if (Number(summary.overdue || 0) > 0) {
      careGaps.push(`${summary.overdue} overdue administrations require immediate follow-up.`);
    }
    if (Number(summary.highRisk || 0) > 0) {
      careGaps.push(`${summary.highRisk} high-risk MAR items should be reviewed with nursing now.`);
    }
    if (Number(summary.withOpenAlerts || 0) > 0) {
      careGaps.push(`${summary.withOpenAlerts} unresolved medication safety alerts remain open.`);
    }
    if (Number(summary.incompleteFiveRights || 0) > 0) {
      careGaps.push(`${summary.incompleteFiveRights} MAR items have incomplete 5-rights verification.`);
    }
    if (Number(summary.scanComplianceGaps || 0) > 0) {
      careGaps.push(`${summary.scanComplianceGaps} MAR items have barcode scan documentation gaps.`);
    }
    if (Number(summary.missingWitnessDocumentation || 0) > 0) {
      careGaps.push(`${summary.missingWitnessDocumentation} administrations require witness documentation follow-up.`);
    }
    if (Number(summary.exceptionWithoutReason || 0) > 0) {
      careGaps.push(`${summary.exceptionWithoutReason} held/refused items lack clinical rationale documentation.`);
    }
    if (Number(summary.refused || 0) > 0 || Number(summary.held || 0) > 0) {
      careGaps.push(
        `${Number(summary.refused || 0) + Number(summary.held || 0)} held/refused medication events need clinical rationale review.`,
      );
    }
    if (Number(summary.administrationRatePercent || 0) < 80 && Number(summary.total || 0) > 0) {
      careGaps.push(`Administration completion is ${summary.administrationRatePercent}% and below target.`);
    }
    if (Number(summary.cdssCoveragePercent || 0) < 85 && Number(summary.total || 0) > 0) {
      careGaps.push(`MAR structured-documentation CDSS coverage is ${summary.cdssCoveragePercent}% (target >= 85%).`);
    }

    const recommendationSet = new Set<string>();
    if (Number(summary.cdssCoveragePercent || 0) < 85) {
      recommendationSet.add('Improve MAR documentation completeness to raise barcode and verification CDSS coverage.');
    }
    if (Number(summary.scanComplianceGaps || 0) > 0) {
      recommendationSet.add('Enforce dual barcode scanning (patient + medication) before administration finalization.');
    }
    if (Number(summary.missingWitnessDocumentation || 0) > 0) {
      recommendationSet.add('Capture witness details for high-alert and controlled medication administrations.');
    }
    for (const item of topRisks) {
      for (const flag of item.cdssFlags || []) {
        if (String(flag || '').trim()) {
          recommendationSet.add(`Resolve MAR documentation flag: ${String(flag).trim()}.`);
        }
      }
      for (const action of item.recommendedActions || []) {
        if (String(action || '').trim()) {
          recommendationSet.add(String(action).trim());
        }
      }
      if (recommendationSet.size >= 8) break;
    }

    if (!recommendationSet.size) {
      recommendationSet.add('Continue standard medication safety monitoring and document all exceptions.');
    }

    return {
      generatedAt: new Date().toISOString(),
      date: worklist?.meta?.date || new Date().toISOString().slice(0, 10),
      summary: {
        totalItems: Number(summary.total || 0),
        overdue: Number(summary.overdue || 0),
        highRisk: Number(summary.highRisk || 0),
        withOpenAlerts: Number(summary.withOpenAlerts || 0),
        held: Number(summary.held || 0),
        refused: Number(summary.refused || 0),
        incompleteFiveRights: Number(summary.incompleteFiveRights || 0),
        scanComplianceGaps: Number(summary.scanComplianceGaps || 0),
        missingWitnessDocumentation: Number(summary.missingWitnessDocumentation || 0),
        exceptionWithoutReason: Number(summary.exceptionWithoutReason || 0),
        documentationGaps: Number(summary.documentationGaps || 0),
        cdssCoveragePercent: Number(summary.cdssCoveragePercent || 0),
        administrationRatePercent: Number(summary.administrationRatePercent || 0),
        avgRiskScore: Number(summary.avgRiskScore || 0),
      },
      topRisks,
      careGaps,
      recommendations: Array.from(recommendationSet).slice(0, 8),
    };
  }

  async holdMedication(
    marId: string,
    reason: string,
    userId: string,
    tenantDb: DataSource,
  ): Promise<MedicationAdministrationRecord> {
    const repository = tenantDb.getRepository(MedicationAdministrationRecord);

    const mar = await repository.findOne({ where: { id: marId } });
    if (!mar) {
      throw new NotFoundException('MAR not found');
    }

    mar.administrationStatus = 'held';
    mar.omissionReason = reason;

    return await repository.save(mar);
  }

  async refuseMedication(
    marId: string,
    reason: string,
    tenantDb: DataSource,
  ): Promise<MedicationAdministrationRecord> {
    const repository = tenantDb.getRepository(MedicationAdministrationRecord);

    const mar = await repository.findOne({ where: { id: marId } });
    if (!mar) {
      throw new NotFoundException('MAR not found');
    }

    mar.administrationStatus = 'refused';
    mar.refusalReason = reason;

    return await repository.save(mar);
  }

  // ==================== ALERTS ====================

  async createAlert(
    alertData: any,
    tenantDb: DataSource,
  ): Promise<MedicationAlert> {
    const repository = tenantDb.getRepository(MedicationAlert);

    const alert = repository.create(alertData);
    return await repository.save(alert) as unknown as MedicationAlert;
  }

  async getActiveAlerts(
    patientId: string,
    tenantDb: DataSource,
  ): Promise<MedicationAlert[]> {
    const repository = tenantDb.getRepository(MedicationAlert);

    return await repository.find({
      where: { patientId, acknowledged: false },
      order: { createdAt: 'DESC' },
    });
  }

  async acknowledgeAlert(
    alertId: string,
    userId: string,
    overrideReason: string,
    tenantDb: DataSource,
  ): Promise<MedicationAlert> {
    const repository = tenantDb.getRepository(MedicationAlert);

    const alert = await repository.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    alert.acknowledged = true;
    alert.acknowledgedById = userId;
    alert.acknowledgedAt = new Date();
    alert.overrideReason = overrideReason;

    return await repository.save(alert);
  }

  async createEscalationAlert(
    marId: string,
    userId: string,
    data: { severity?: string; alertType?: string; message?: string; details?: any },
    tenantDb: DataSource,
  ): Promise<MedicationAlert> {
    const marRepository = tenantDb.getRepository(MedicationAdministrationRecord);
    const alertRepository = tenantDb.getRepository(MedicationAlert);

    const mar = await marRepository.findOne({ where: { id: marId } });
    if (!mar) {
      throw new NotFoundException('MAR not found');
    }

    const severity = String(data?.severity || 'high').toLowerCase();
    const alert = alertRepository.create({
      patientId: mar.patientId,
      prescriptionId: mar.prescriptionId,
      marId: mar.id,
      alertType: data?.alertType || 'administration_risk_escalation',
      severity,
      alertMessage:
        data?.message ||
        `Medication safety escalation for ${mar.medicationName} (${mar.dose} ${mar.unit})`,
      alertDetails: {
        escalatedBy: userId,
        scheduledTime: mar.scheduledTime,
        status: mar.administrationStatus,
        details: data?.details || null,
      },
      acknowledged: false,
    });

    return alertRepository.save(alert) as unknown as MedicationAlert;
  }

  // ==================== PRESCRIPTION-TO-MAR ====================

  private frequencyToTimes(frequency: string, date: Date): Date[] {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    const f = (frequency || '').toLowerCase();
    const times: Date[] = [];
    if (f.includes('once') || f === 'od' || f === 'daily') {
      times.push(new Date(day.getTime() + 8 * 60 * 60 * 1000));
    } else if (f.includes('twice') || f === 'bd' || f.includes('bid')) {
      times.push(new Date(day.getTime() + 8 * 60 * 60 * 1000));
      times.push(new Date(day.getTime() + 20 * 60 * 60 * 1000));
    } else if (f.includes('three') || f === 'tds' || f.includes('tid') || f.includes('8hr')) {
      times.push(new Date(day.getTime() + 8 * 60 * 60 * 1000));
      times.push(new Date(day.getTime() + 14 * 60 * 60 * 1000));
      times.push(new Date(day.getTime() + 20 * 60 * 60 * 1000));
    } else if (f.includes('four') || f === 'qds' || f.includes('qid') || f.includes('6hr')) {
      for (const h of [6, 12, 18, 24]) times.push(new Date(day.getTime() + h * 60 * 60 * 1000));
    } else {
      times.push(new Date(day.getTime() + 8 * 60 * 60 * 1000));
    }
    return times;
  }

  async generateMARFromPrescription(
    prescriptionId: string,
    patientId: string,
    admissionId: string | null,
    tenantDb: DataSource,
  ): Promise<any[]> {
    const prescription = await tenantDb.getRepository(Prescription).findOne({ where: { id: prescriptionId, patientId } });
    if (!prescription) throw new NotFoundException('Prescription not found');
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const times = this.frequencyToTimes(prescription.frequency, start);
    const entries: any[] = [];
    for (const t of times) {
      if (t >= start && t < end) {
        const [row] = await tenantDb.query(
          `INSERT INTO mar_scheduled_entries (prescription_id, patient_id, admission_id, medication_name, dose, frequency, scheduled_time, requires_witness, is_high_alert, is_controlled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false, false, false) RETURNING *`,
          [prescriptionId, patientId, admissionId, prescription.medicationName, prescription.dosage, prescription.frequency, t],
        );
        entries.push(row);
      }
    }
    this.logger.log(`Generated ${entries.length} MAR scheduled entries for prescription ${prescriptionId}`);
    return entries;
  }

  async getScheduledMARByPatient(patientId: string, date: Date, tenantDb: DataSource): Promise<any[]> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return tenantDb.query(
      `SELECT * FROM mar_scheduled_entries WHERE patient_id = $1 AND scheduled_time >= $2 AND scheduled_time < $3 ORDER BY scheduled_time`,
      [patientId, start, end],
    );
  }

  async administerFromScheduledEntry(
    marEntryId: string,
    body: { witnessedById?: string; notes?: string },
    actorId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const [entry] = await tenantDb.query(`SELECT * FROM mar_scheduled_entries WHERE id = $1`, [marEntryId]);
    if (!entry) throw new NotFoundException('MAR scheduled entry not found');
    if (entry.status === 'administered') throw new BadRequestException('Already administered');
    if (entry.requires_witness && !body.witnessedById) {
      throw new BadRequestException('Witness required for this medication');
    }
    const marRepo = tenantDb.getRepository(MedicationAdministrationRecord);
    const mar = marRepo.create({
      patientId: entry.patient_id,
      prescriptionId: entry.prescription_id,
      medicationName: entry.medication_name,
      dose: entry.dose,
      unit: entry.unit || 'tab',
      route: entry.route || 'oral',
      scheduledTime: entry.scheduled_time,
      actualAdministrationTime: new Date(),
      administeredById: actorId,
      witnessedById: body.witnessedById || null,
      administrationStatus: 'administered',
      notes: body.notes,
    });
    const saved = await marRepo.save(mar);
    await tenantDb.query(
      `UPDATE mar_scheduled_entries SET status = 'administered', mar_id = $1, updated_at = NOW() WHERE id = $2`,
      [saved.id, marEntryId],
    );
    return saved;
  }

  private calculateMarRiskScore(input: {
    status: string;
    overdueMinutes: number;
    isHighAlert: boolean;
    isControlled: boolean;
    openAlertCount: number;
    highAlertCount: number;
    hasException: boolean;
    verificationScore: number;
    adverseReaction: boolean;
    scanComplianceGap: boolean;
    missingWitnessDocumentation: boolean;
    exceptionWithoutReason: boolean;
    adverseReactionWithoutDetails: boolean;
    administrationSiteMissing: boolean;
  }): number {
    let score = 10;
    if (input.isHighAlert) score += 24;
    if (input.isControlled) score += 18;
    if (input.overdueMinutes >= 120) score += 26;
    else if (input.overdueMinutes >= 60) score += 20;
    else if (input.overdueMinutes > 0) score += 12;
    if (input.openAlertCount > 0) score += Math.min(20, input.openAlertCount * 5);
    if (input.highAlertCount > 0) score += Math.min(15, input.highAlertCount * 7);
    if (input.hasException) score += 16;
    if (input.status === 'pending' && input.verificationScore < 3) score += 12;
    if (input.scanComplianceGap) score += 10;
    if (input.missingWitnessDocumentation) score += 12;
    if (input.exceptionWithoutReason) score += 10;
    if (input.adverseReactionWithoutDetails) score += 8;
    if (input.administrationSiteMissing) score += 6;
    if (input.adverseReaction) score += 22;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private buildMarRecommendedActions(item: {
    administrationStatus: string;
    overdueMinutes: number;
    isHighAlert: boolean;
    isControlled: boolean;
    openAlertCount: number;
    highAlertCount: number;
    adverseReaction: boolean;
    patientBarcodeScanned?: boolean;
    medicationBarcodeScanned?: boolean;
    incompleteFiveRights?: boolean;
    scanComplianceGap?: boolean;
    witnessRequired?: boolean;
    missingWitnessDocumentation?: boolean;
    exceptionWithoutReason?: boolean;
    adverseReactionWithoutDetails?: boolean;
    administrationSiteMissing?: boolean;
    refusalReason?: string | null;
    omissionReason?: string | null;
    adverseReactionDetails?: string | null;
    administrationSite?: string | null;
    dueSoon?: boolean;
  }): string[] {
    const actions: string[] = [];
    if (item.administrationStatus === 'pending' && item.overdueMinutes > 0) {
      actions.push('Escalate overdue medication administration now');
    } else if (item.administrationStatus === 'pending' && item.dueSoon) {
      actions.push('Prepare administration before due window');
    }
    if (item.isHighAlert) {
      actions.push('Enforce high-alert double-check protocol');
    }
    if (item.isControlled) {
      actions.push('Confirm witness and controlled-substance documentation');
    }
    if (item.incompleteFiveRights) {
      actions.push('Complete full 5-rights verification before administration');
    }
    if (item.scanComplianceGap) {
      actions.push('Capture both patient and medication barcode scans for MAR compliance');
    }
    if (item.witnessRequired && item.missingWitnessDocumentation) {
      actions.push('Document required witness for high-alert/controlled medication administration');
    }
    if (item.highAlertCount > 0 || item.openAlertCount > 0) {
      actions.push('Review and acknowledge open medication safety alerts');
    }
    if (item.adverseReaction) {
      actions.push('Assess adverse reaction and update treatment plan');
    }
    if (item.adverseReactionWithoutDetails) {
      actions.push('Document adverse reaction details and immediate mitigation actions');
    }
    if (item.administrationSiteMissing) {
      actions.push('Document administration site for parenteral medication');
    }
    if (item.exceptionWithoutReason) {
      actions.push('Document clinical reason for held/refused administration event');
    }
    if (item.refusalReason || item.omissionReason) {
      actions.push('Document clinical rationale and update care plan for omission/refusal');
    }
    if (!actions.length) {
      actions.push('Continue standard medication safety monitoring');
    }
    return actions.slice(0, 4);
  }

  private isParenteralRoute(routeRaw?: string | null): boolean {
    const route = String(routeRaw || '').toLowerCase();
    return (
      route.includes('iv') ||
      route.includes('intravenous') ||
      route.includes('im') ||
      route.includes('intramuscular') ||
      route.includes('subcutaneous') ||
      route.includes('subcut') ||
      route.includes('sc') ||
      route.includes('injection')
    );
  }

  private getAgeYears(dateOfBirth?: string | Date | null): number | null {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;
    return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }

  private safePercent(part: number, whole: number): number {
    if (!whole) return 0;
    return Math.round((part / whole) * 1000) / 10;
  }
}
