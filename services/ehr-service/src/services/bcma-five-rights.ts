// R3 / FX-010 (UX-001, S0) — BCMA five-rights: the SINGLE verification
// mechanism every administration path calls.
//
// Design (applies the R1/R2 lessons):
// 1. `evaluateFiveRights` is a pure function over resolved evidence. It is the
//    ONLY place the patient↔prescription↔drug↔dose↔route↔time comparison lives.
//    Direct API, order-set dispense, telemedicine mid-call Rx, the scheduled
//    MAR path, and the offline-then-sync replay path all funnel through it —
//    never duplicated per entry point.
// 2. The function unconditionally produces a result: there is no optional
//    parameter that can silently skip the check. Service wrappers REQUIRE an
//    accessor ({ userId, role }) and throw when it is absent (lesson 1).
//    The one internal pre-authorized caller is the explicitly named
//    `verifyFiveRightsPreAuthorized(input, { reason }, ...)` — greppable,
//    reason-logged, never an omitted argument.
// 3. Fail closed: unverifiable (missing schedule/route/dose source, stale
//    offline cache, unknown accessor) blocks. Any mismatch throws at the
//    service layer — a "verified: false" is never returned silently.
//
// Policy constants are operational policy, not clinical content: the 60-minute
// administration window and the offline-cache staleness limit are documented
// here and overridable per tenant via the options argument where supported.

export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** +/- minutes around the scheduled time an administration is accepted. */
export const FIVE_RIGHTS_TIME_WINDOW_MINUTES = 60;

/**
 * Maximum age of a cached MAR snapshot an offline client may verify against.
 * Older caches fail closed: the client must re-sync before administering.
 */
export const OFFLINE_CACHED_MAR_STALENESS_LIMIT_MINUTES = 240;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A prescription reference is only usable when it is a real (non-nil) UUID.
 * Nil UUIDs, garbage strings, null/undefined all fail closed — this is the
 * audit's exact bypass (patient A wristband + warfarin + B/nil/garbage Rx).
 */
export function isVerifiablePrescriptionRef(id: unknown): boolean {
  return (
    typeof id === 'string' &&
    UUID_RE.test(id) &&
    id.toLowerCase() !== NIL_UUID
  );
}

export interface FiveRightsWristband {
  barcode: string;
  patientId: string;
  isActive: boolean;
  expiresAt?: Date | string | null;
}

export interface FiveRightsPrescription {
  id: string;
  patientId: string;
  medicationName: string;
  dosage?: string | null;
  frequency?: string | null;
  status: string;
}

export interface FiveRightsMedication {
  barcode: string;
  medicationName: string;
  genericName?: string | null;
  brandName?: string | null;
  strength?: string | null;
  unit?: string | null;
  route?: string | null;
  isActive: boolean;
  isHighAlert: boolean;
  isControlled: boolean;
}

export interface FiveRightsScheduledDose {
  dose: string;
  unit?: string | null;
  route?: string | null;
  scheduledTime: Date | string;
}

export interface FiveRightsEvidence {
  wristband: FiveRightsWristband | null;
  /** Null when the prescription row could not be loaded. */
  prescription: FiveRightsPrescription | null;
  /** Set when the caller-supplied ref itself was unusable (nil/garbage). */
  prescriptionRefInvalid?: boolean;
  prescriptionRefRaw?: unknown;
  medication: FiveRightsMedication | null;
  /** Null when no scheduled MAR entry exists for this prescription. */
  scheduled: FiveRightsScheduledDose | null;
  administered: { dose: string; route: string };
  scannedAt: Date | string;
  alreadyAdministered: boolean;
}

export interface FiveRightsResult {
  verified: boolean;
  failures: string[];
  alerts: string[];
}

function normName(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[_\-]+/g, ' ')
    .replace(/[^a-z0-9 +]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normDose(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/\s+/g, '');
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function evaluateFiveRights(evidence: FiveRightsEvidence): FiveRightsResult {
  const failures: string[] = [];
  const alerts: string[] = [];

  const scannedAt = toDate(evidence.scannedAt as any);
  if (!scannedAt) {
    failures.push('invalid-scan-time');
  }

  // ── Prescription reference (audit bypass: nil UUID / garbage / B's Rx) ──
  const refRaw = evidence.prescription?.id ?? evidence.prescriptionRefRaw;
  if (evidence.prescriptionRefInvalid || !isVerifiablePrescriptionRef(refRaw)) {
    failures.push('invalid-prescription-id');
    return { verified: false, failures, alerts };
  }
  if (!evidence.prescription) {
    failures.push('prescription-not-found');
    return { verified: false, failures, alerts };
  }
  const prescription = evidence.prescription;

  // ── Wristband ──
  if (!evidence.wristband) {
    failures.push('wristband-not-found');
  } else {
    if (!evidence.wristband.isActive) failures.push('wristband-inactive');
    const expiry = toDate(evidence.wristband.expiresAt ?? null);
    if (expiry && scannedAt && expiry.getTime() < scannedAt.getTime()) {
      failures.push('expired-item');
    }
    if (evidence.wristband.patientId !== prescription.patientId) {
      failures.push('wrong-patient');
    }
  }

  // ── Medication product ──
  if (!evidence.medication) {
    failures.push('medication-not-found');
  } else {
    if (!evidence.medication.isActive) failures.push('medication-inactive');
    const candidates = [
      evidence.medication.medicationName,
      evidence.medication.genericName,
      evidence.medication.brandName,
    ].map(normName);
    if (!candidates.includes(normName(prescription.medicationName))) {
      failures.push('wrong-drug');
    }
    if (evidence.medication.isHighAlert) {
      alerts.push(
        `HIGH-ALERT medication: ${evidence.medication.medicationName} requires a double-check and a second-nurse witness for any override.`,
      );
    }
    if (evidence.medication.isControlled) {
      alerts.push(
        `CONTROLLED substance: ${evidence.medication.medicationName} requires a witness for any override.`,
      );
    }
  }

  // ── Dose (right dose) ──
  const expectedDose =
    evidence.scheduled?.dose ?? prescription.dosage ?? null;
  if (!expectedDose || !normDose(expectedDose)) {
    failures.push('dose-unverifiable');
  } else if (normDose(evidence.administered.dose) !== normDose(expectedDose)) {
    failures.push('wrong-dose');
  }

  // ── Route (right route) ──
  const expectedRoute =
    evidence.scheduled?.route ??
    evidence.medication?.route ??
    null;
  if (!expectedRoute || !normName(expectedRoute)) {
    failures.push('route-unverifiable');
  } else if (normName(evidence.administered.route) !== normName(expectedRoute)) {
    failures.push('wrong-route');
  }

  // ── Time window (right time) ──
  const scheduledTime = toDate(evidence.scheduled?.scheduledTime ?? null);
  if (!scheduledTime) {
    failures.push('no-scheduled-time');
  } else if (scannedAt) {
    const diffMinutes =
      Math.abs(scannedAt.getTime() - scheduledTime.getTime()) / 60000;
    if (diffMinutes > FIVE_RIGHTS_TIME_WINDOW_MINUTES) {
      failures.push('outside-administration-window');
    }
  }

  // ── Prescription liveness + duplicate scan ──
  if (prescription.status !== 'active') {
    failures.push('prescription-not-active');
    if (prescription.status === 'expired') failures.push('expired-item');
  }
  if (evidence.alreadyAdministered) {
    failures.push('duplicate-administration');
  }

  return { verified: failures.length === 0, failures, alerts };
}
