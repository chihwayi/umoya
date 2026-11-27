import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MedicationAdministrationRecord } from '../entities/medication-administration-record.entity';
import { PatientWristband } from '../entities/patient-wristband.entity';
import { MedicationBarcodeMaster } from '../entities/medication-barcode-master.entity';
import { MedicationAlert } from '../entities/medication-alert.entity';
import { Prescription } from '../entities/prescription.entity';
import { StoreroomService } from './storeroom.service';
import { PatientAccessService, Accessor } from './patient-access.service';
import {
  evaluateFiveRights,
  isVerifiablePrescriptionRef,
  OFFLINE_CACHED_MAR_STALENESS_LIMIT_MINUTES,
  type FiveRightsEvidence,
} from './bcma-five-rights';

export interface FiveRightsInput {
  patientBarcode: string;
  medicationBarcode: string;
  prescriptionId: string;
  dose: string;
  route: string;
  scannedAt?: Date | string;
}

/** Roles permitted to record a five-rights override (role + reason + audit). */
const OVERRIDE_ROLES = new Set(['nurse', 'doctor', 'pharmacist', 'admin']);

/**
 * Internal callers that act without an interactive accessor (order-set
 * dispense, telemedicine mid-call Rx, offline-then-sync replay, scheduled MAR
 * administration). Closed allowlist — anything else throws. Each use is
 * reason-logged so it stays greppable.
 */
const PRE_AUTHORIZED_REASONS = new Set([
  'order-set-dispense',
  'telemedicine-mid-call',
  'offline-sync-replay',
  'scheduled-mar-admin',
]);

@Injectable()
export class BcmaService {
  private readonly logger = new Logger(BcmaService.name);

  constructor(
    @Optional() private readonly storeroomService: StoreroomService,
    @Optional() private readonly patientAccessService: PatientAccessService,
  ) {}

  private async resolveWardLocationId(
    tenantDb: DataSource,
    admissionId?: string,
    wardName?: string,
  ): Promise<string | null> {
    if (!this.storeroomService) return null;

    if (admissionId) {
      const rows = await tenantDb.query(
        `SELECT ward_location_id FROM admissions WHERE id = $1 LIMIT 1`,
        [admissionId],
      );
      if (rows[0]?.ward_location_id) return rows[0].ward_location_id;
    }

    if (wardName) {
      const rows = await tenantDb.query(
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
      const rows = await tenantDb.query(
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

  // ==================== FIVE-RIGHTS GATE (FX-010) ====================
  // Every administration path calls verifyFiveRightsStrict (interactive) or
  // the explicitly named verifyFiveRightsPreAuthorized (system callers with a
  // closed-allowlist reason). There is deliberately NO optional accessor: a
  // missing accessor throws instead of bypassing the check.

  private requireAccessor(accessor: Accessor | undefined | null): Accessor {
    if (!accessor || typeof accessor.userId !== 'string' || !accessor.userId) {
      throw new ForbiddenException(
        'BCMA verification requires an authenticated accessor — anonymous verification is denied',
      );
    }
    return accessor;
  }

  private requireAuthzLayer(): PatientAccessService {
    if (!this.patientAccessService) {
      throw new ForbiddenException(
        'BCMA authorization layer is unavailable — failing closed',
      );
    }
    return this.patientAccessService;
  }

  private accessorForR2(accessor: Accessor): Accessor {
    return {
      userId: accessor.userId,
      role: accessor.role,
      facilityId: (accessor as any).facilityId ?? null,
    };
  }

  private async loadFiveRightsEvidence(
    input: FiveRightsInput,
    scheduledOverride: FiveRightsEvidence['scheduled'],
    tenantDb: DataSource,
  ): Promise<Omit<FiveRightsEvidence, 'administered' | 'scannedAt'> & { patient: any }> {
    if (!input || !isVerifiablePrescriptionRef(input.prescriptionId)) {
      throw new BadRequestException(
        `invalid-prescription-id: prescription reference is not a usable UUID`,
      );
    }
    if (!input.patientBarcode || !input.medicationBarcode) {
      throw new BadRequestException(
        'BCMA verification requires both the patient wristband and medication barcode scans',
      );
    }

    const wristband = await this.verifyWristband(input.patientBarcode, tenantDb);
    const medication = await this.verifyMedicationBarcode(input.medicationBarcode, tenantDb);
    const prescription = await tenantDb.getRepository(Prescription).findOne({
      where: { id: input.prescriptionId },
    });
    if (!prescription) {
      throw new BadRequestException(
        `prescription-not-found: no prescription ${input.prescriptionId}`,
      );
    }

    let scheduled = scheduledOverride ?? null;
    if (!scheduled) {
      const rows = await tenantDb.query(
        `SELECT dose, unit, route, scheduled_time FROM mar_scheduled_entries
         WHERE prescription_id = $1 AND patient_id = $2
         ORDER BY ABS(EXTRACT(EPOCH FROM (scheduled_time - NOW()))) ASC LIMIT 1`,
        [input.prescriptionId, wristband.patientId ?? (wristband as any).patient_id],
      );
      const entry = rows?.[0];
      scheduled = entry
        ? { dose: entry.dose, unit: entry.unit, route: entry.route, scheduledTime: entry.scheduled_time }
        : null;
    }

    const dupes = await tenantDb.query(
      `SELECT id FROM medication_administration_records
       WHERE prescription_id = $1 AND patient_id = $2 AND administration_status = 'administered' LIMIT 1`,
      [input.prescriptionId, wristband.patientId ?? (wristband as any).patient_id],
    );

    return {
      wristband: {
        barcode: wristband.barcode,
        patientId: wristband.patientId ?? (wristband as any).patient_id,
        isActive: wristband.isActive ?? true,
        expiresAt: (wristband as any).expiresAt ?? (wristband as any).expires_at ?? null,
      },
      prescription: {
        id: prescription.id,
        patientId: prescription.patientId,
        medicationName: prescription.medicationName,
        dosage: prescription.dosage,
        frequency: prescription.frequency,
        status: prescription.status,
      },
      medication: {
        barcode: medication.barcode,
        medicationName: medication.medicationName,
        genericName: (medication as any).genericName ?? (medication as any).generic_name,
        brandName: (medication as any).brandName ?? (medication as any).brand_name,
        strength: (medication as any).strength,
        unit: (medication as any).unit,
        route: (medication as any).route,
        isActive: medication.isActive ?? true,
        isHighAlert: medication.isHighAlert ?? false,
        isControlled: medication.isControlled ?? false,
      },
      scheduled,
      alreadyAdministered: Array.isArray(dupes) && dupes.length > 0,
      patient: (wristband as any).patient ?? null,
    };
  }

  private async assertFiveRightsAccess(
    accessor: Accessor,
    wristbandPatientId: string,
    prescriptionPatientId: string,
    tenantDb: DataSource,
  ): Promise<void> {
    const authz = this.requireAuthzLayer();
    const asR2 = this.accessorForR2(accessor);
    // Both the wristband patient and the prescription patient must be
    // accessible — identical 403s either way, so no oracle on mismatch.
    await authz.assertCanAccess(tenantDb, asR2, wristbandPatientId, 'bcma-five-rights');
    if (prescriptionPatientId !== wristbandPatientId) {
      await authz.assertCanAccess(tenantDb, asR2, prescriptionPatientId, 'bcma-five-rights');
    }
  }

  async verifyFiveRightsStrict(
    input: FiveRightsInput,
    accessor: Accessor,
    tenantDb: DataSource,
  ): Promise<{ verified: true; patient: any; medication: any; failures: string[]; alerts: string[] }> {
    const acc = this.requireAccessor(accessor);
    const loaded = await this.loadFiveRightsEvidence(input, null, tenantDb);
    await this.assertFiveRightsAccess(acc, loaded.wristband!.patientId, loaded.prescription!.patientId, tenantDb);
    const result = evaluateFiveRights({
      ...loaded,
      administered: { dose: input.dose, route: input.route },
      scannedAt: input.scannedAt ?? new Date(),
    });
    if (!result.verified) {
      throw new BadRequestException(`Five-rights hard block: ${result.failures.join(', ')}`);
    }
    return {
      verified: true,
      patient: loaded.patient,
      medication: loaded.medication,
      failures: [],
      alerts: result.alerts,
    };
  }

  /**
   * Explicit, named, greppable exception for internal pre-authorized callers
   * (order sets, telemedicine mid-call, offline replay). The reason must come
   * from a closed allowlist and is logged — never an omitted argument.
   */
  async verifyFiveRightsPreAuthorized(
    input: FiveRightsInput,
    preAuth: { reason: string },
    scheduledOverride: FiveRightsEvidence['scheduled'],
    tenantDb: DataSource,
  ): Promise<{ verified: true; patient: any; medication: any; failures: string[]; alerts: string[] }> {
    const reason = String(preAuth?.reason ?? '');
    if (!PRE_AUTHORIZED_REASONS.has(reason)) {
      throw new ForbiddenException(
        `BCMA pre-authorized verification requires a known internal reason — got ${JSON.stringify(reason)}`,
      );
    }
    this.logger.warn(`BCMA pre-authorized verification used (reason=${reason}, rx=${input?.prescriptionId})`);
    const loaded = await this.loadFiveRightsEvidence(input, scheduledOverride, tenantDb);
    const result = evaluateFiveRights({
      ...loaded,
      administered: { dose: input.dose, route: input.route },
      scannedAt: input.scannedAt ?? new Date(),
    });
    if (!result.verified) {
      throw new BadRequestException(`Five-rights hard block: ${result.failures.join(', ')}`);
    }
    return { verified: true, patient: loaded.patient, medication: loaded.medication, failures: [], alerts: result.alerts };
  }

  /**
   * Offline-then-sync replay: verifies against a cached MAR snapshot with an
   * explicit staleness limit. A stale cache fails closed — the client must
   * re-sync before administering. The cached authorization grant (recorded at
   * sync time) substitutes for the live R2 check only while both the cache
   * and the grant are fresh; otherwise the live R2 layer decides.
   */
  async verifyFiveRightsOffline(
    input: FiveRightsInput,
    cached: {
      scheduled: FiveRightsEvidence['scheduled'];
      cachedAt: Date | string;
      authorization?: { userId: string; patientId: string; grantedAt: Date | string };
      prescription?: FiveRightsEvidence['prescription'];
      medication?: FiveRightsEvidence['medication'];
      wristbandPatientId?: string;
    },
    accessor: Accessor,
    tenantDb: DataSource,
  ): Promise<{ verified: true; patient: any; medication: any; failures: string[]; alerts: string[]; offline: true }> {
    const acc = this.requireAccessor(accessor);
    const cachedAt = cached?.cachedAt ? new Date(cached.cachedAt) : null;
    const cacheAgeMinutes = cachedAt && !Number.isNaN(cachedAt.getTime())
      ? (Date.now() - cachedAt.getTime()) / 60000
      : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(cacheAgeMinutes) || cacheAgeMinutes > OFFLINE_CACHED_MAR_STALENESS_LIMIT_MINUTES) {
      throw new BadRequestException(
        `stale-offline-cache: cached MAR is ${Number.isFinite(cacheAgeMinutes) ? Math.round(cacheAgeMinutes) : 'unknown'} minutes old (limit ${OFFLINE_CACHED_MAR_STALENESS_LIMIT_MINUTES}) — re-sync before administering`,
      );
    }
    if (!cached?.scheduled) {
      throw new BadRequestException('no-scheduled-time: offline cache carries no scheduled dose');
    }

    const grant = cached.authorization;
    if (grant) {
      const grantedAt = new Date(grant.grantedAt);
      const grantAgeMinutes = !Number.isNaN(grantedAt.getTime())
        ? (Date.now() - grantedAt.getTime()) / 60000
        : Number.POSITIVE_INFINITY;
      if (grant.userId !== acc.userId || grantAgeMinutes > OFFLINE_CACHED_MAR_STALENESS_LIMIT_MINUTES) {
        throw new ForbiddenException('offline authorization grant is stale or does not match this accessor — failing closed');
      }
    } else {
      // No offline grant: fall back to the live R2 layer (online replay).
      const live = await this.loadFiveRightsEvidence(input, cached.scheduled, tenantDb);
      await this.assertFiveRightsAccess(acc, live.wristband!.patientId, live.prescription!.patientId, tenantDb);
      const result = evaluateFiveRights({
        ...live,
        administered: { dose: input.dose, route: input.route },
        scannedAt: input.scannedAt ?? new Date(),
      });
      if (!result.verified) {
        throw new BadRequestException(`Five-rights hard block: ${result.failures.join(', ')}`);
      }
      return { verified: true, patient: live.patient, medication: live.medication, failures: [], alerts: result.alerts, offline: true };
    }

    // Fully offline path: evidence from the verified cache, same core check.
    const evidence: FiveRightsEvidence = {
      wristband: { barcode: input.patientBarcode, patientId: grant.patientId, isActive: true },
      prescription: cached.prescription ?? null,
      medication: cached.medication ?? null,
      scheduled: cached.scheduled,
      administered: { dose: input.dose, route: input.route },
      scannedAt: input.scannedAt ?? new Date(),
      alreadyAdministered: false,
    };
    if (!evidence.prescription || !evidence.medication) {
      throw new BadRequestException('offline cache lacks prescription/medication snapshots — re-sync before administering');
    }
    const result = evaluateFiveRights(evidence);
    if (!result.verified) {
      throw new BadRequestException(`Five-rights hard block: ${result.failures.join(', ')}`);
    }
    return { verified: true, patient: null, medication: evidence.medication, failures: [], alerts: result.alerts, offline: true };
  }

  /**
   * Override path: role + recorded reason + audit entry. High-alert and
   * controlled medications additionally require a second-nurse witness.
   * NOTE (residual): overrides are recorded even for wrong-patient/wrong-drug
   * blocks — policy should forbid administering those outright; flagged in
   * NEEDS_CLINICAL_REVIEW rather than silently allowed.
   */
  async overrideFiveRights(
    input: FiveRightsInput,
    override: { reason: string; witnessUserId?: string },
    accessor: Accessor,
    tenantDb: DataSource,
  ): Promise<{ overridden: boolean; verified?: true; failures: string[]; alerts: string[]; alertId?: string }> {
    const acc = this.requireAccessor(accessor);
    if (!OVERRIDE_ROLES.has(String(acc.role))) {
      throw new ForbiddenException(`Override requires a clinical role — ${acc.role} may not override five-rights blocks`);
    }
    const reason = String(override?.reason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('Override requires a recorded reason');
    }
    const loaded = await this.loadFiveRightsEvidence(input, null, tenantDb);
    await this.assertFiveRightsAccess(acc, loaded.wristband!.patientId, loaded.prescription!.patientId, tenantDb);
    const result = evaluateFiveRights({
      ...loaded,
      administered: { dose: input.dose, route: input.route },
      scannedAt: input.scannedAt ?? new Date(),
    });
    if (result.verified) {
      return { overridden: false, verified: true, failures: [], alerts: result.alerts };
    }
    const needsWitness = Boolean(loaded.medication?.isHighAlert || loaded.medication?.isControlled);
    const witness = String(override?.witnessUserId ?? '').trim();
    if (needsWitness && (!witness || witness === acc.userId)) {
      throw new BadRequestException(
        'High-alert/controlled override requires a second-nurse witness distinct from the overrider',
      );
    }
    const repository = tenantDb.getRepository(MedicationAlert);
    const entry = repository.create({
      patientId: loaded.wristband!.patientId,
      prescriptionId: loaded.prescription!.id,
      marId: null,
      alertType: 'five_rights_override',
      severity: 'high',
      alertMessage: `Five-rights override by ${acc.userId} (${acc.role}): ${result.failures.join(', ')}. Reason: ${reason}`,
      alertDetails: {
        failures: result.failures,
        reason,
        overriddenBy: acc.userId,
        overriderRole: acc.role,
        witnessUserId: witness || null,
        scannedAt: (input.scannedAt ?? new Date()).toString(),
      },
      acknowledged: true,
      acknowledgedById: acc.userId,
      acknowledgedAt: new Date(),
      overrideReason: reason,
    });
    const saved = await repository.save(entry);
    this.logger.warn(`Five-rights override recorded: rx=${loaded.prescription!.id} by=${acc.userId} failures=${result.failures.join(',')}`);
    return { overridden: true, failures: result.failures, alerts: result.alerts, alertId: (saved as any)?.id };
  }

  async administerMedication(
    marData: any,
    accessor: Accessor,
    tenantDb: DataSource,
  ): Promise<MedicationAdministrationRecord> {
    // FX-010: direct administration runs the same five-rights gate — a MAR
    // must never be created from unscanned call data. Missing scan evidence
    // fails closed.
    const acc = this.requireAccessor(accessor);
    const userId = acc.userId;
    const verifyInput: FiveRightsInput = {
      patientBarcode: marData?.patient_barcode ?? marData?.patientBarcode,
      medicationBarcode: marData?.medication_barcode ?? marData?.medicationBarcode,
      prescriptionId: marData?.prescription_id ?? marData?.prescriptionId,
      dose: String(marData?.dose ?? ''),
      route: String(marData?.route ?? ''),
      scannedAt: marData?.scan_timestamp ?? marData?.scanTimestamp ?? new Date(),
    };
    const scheduledTimeRaw = marData?.scheduled_time ?? marData?.scheduledTime ?? null;
    const scheduledTime = scheduledTimeRaw ? new Date(scheduledTimeRaw) : null;
    if (!scheduledTime || Number.isNaN(scheduledTime.getTime())) {
      throw new BadRequestException('no-scheduled-time: administration requires a scheduled dose time');
    }
    const loaded = await this.loadFiveRightsEvidence(verifyInput, {
      dose: String(marData?.dose ?? ''),
      unit: marData?.unit ?? null,
      route: String(marData?.route ?? ''),
      scheduledTime,
    }, tenantDb);
    await this.assertFiveRightsAccess(acc, loaded.wristband!.patientId, loaded.prescription!.patientId, tenantDb);
    const gate = evaluateFiveRights({
      ...loaded,
      administered: { dose: verifyInput.dose, route: verifyInput.route },
      scannedAt: verifyInput.scannedAt ?? new Date(),
    });
    if (!gate.verified) {
      throw new BadRequestException(`Five-rights hard block: ${gate.failures.join(', ')}`);
    }

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
      // FX-010: the gate above passed — persist the verified five rights.
      rightPatientVerified: true,
      rightMedicationVerified: true,
      rightDoseVerified: true,
      rightRouteVerified: true,
      rightTimeVerified: true,
      patientWristbandScanned: true,
      medicationBarcodeScanned: true,
      scanTimestamp: verifyInput.scannedAt instanceof Date ? verifyInput.scannedAt : new Date(verifyInput.scannedAt ?? Date.now()),
      patientBarcode: verifyInput.patientBarcode,
      medicationBarcode: verifyInput.medicationBarcode,
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
        .leftJoin('mar.administeredBy', 'administeredBy')
        .addSelect(['administeredBy.id', 'administeredBy.firstName', 'administeredBy.lastName'])
        .leftJoin('mar.witnessedBy', 'witnessedBy')
        .addSelect(['witnessedBy.id', 'witnessedBy.firstName', 'witnessedBy.lastName'])
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
    body: { witnessedById?: string; notes?: string; patientBarcode?: string; medicationBarcode?: string },
    accessor: Accessor,
    tenantDb: DataSource,
  ): Promise<any> {
    // FX-010: the scheduled path previously skipped verification entirely.
    // It now runs the same gate via the pre-authorized system entry point.
    const acc = this.requireAccessor(accessor);
    const actorId = acc.userId;
    const [entry] = await tenantDb.query(`SELECT * FROM mar_scheduled_entries WHERE id = $1`, [marEntryId]);
    if (!entry) throw new NotFoundException('MAR scheduled entry not found');
    if (entry.status === 'administered') throw new BadRequestException('Already administered');
    if (entry.requires_witness && !body.witnessedById) {
      throw new BadRequestException('Witness required for this medication');
    }
    // Strict (not pre-authorized): this path has an interactive accessor,
    // so the R2 composition check applies here too.
    await this.verifyFiveRightsStrict(
      {
        patientBarcode: body.patientBarcode as string,
        medicationBarcode: body.medicationBarcode as string,
        prescriptionId: entry.prescription_id,
        dose: String(entry.dose ?? ''),
        route: String(entry.route ?? 'oral'),
        scannedAt: new Date(),
      },
      acc,
      tenantDb,
    );
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
      // FX-010: the strict gate above passed — persist the verified rights.
      rightPatientVerified: true,
      rightMedicationVerified: true,
      rightDoseVerified: true,
      rightRouteVerified: true,
      rightTimeVerified: true,
      patientWristbandScanned: true,
      medicationBarcodeScanned: true,
      scanTimestamp: new Date(),
      patientBarcode: body.patientBarcode || null,
      medicationBarcode: body.medicationBarcode || null,
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
