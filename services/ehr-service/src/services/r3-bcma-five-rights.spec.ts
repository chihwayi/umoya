// R3 / FX-010 RED: BCMA five-rights must be a real check, not `verified: true`.
// Covers the audit's exact bypass (A wristband + warfarin + B/nil/garbage Rx),
// one test per right, override audit trail, offline fail-closed, and R2
// composition (no R2 relationship => deny even with perfect clinical evidence).
import { ForbiddenException } from '@nestjs/common';
import {
  evaluateFiveRights,
  NIL_UUID,
  FIVE_RIGHTS_TIME_WINDOW_MINUTES,
  OFFLINE_CACHED_MAR_STALENESS_LIMIT_MINUTES,
  type FiveRightsEvidence,
} from './bcma-five-rights';
import { BcmaService } from './bcma.service';

const PATIENT_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const PATIENT_B = 'bbbbbbbb-2222-4222-8222-222222222222';
const RX_B = 'bbbbbbbb-3333-4333-8333-333333333333';
const NURSE = '99999999-9999-4999-8999-999999999999';

function baseEvidence(overrides: Partial<FiveRightsEvidence> = {}): FiveRightsEvidence {
  const scheduledTime = new Date('2026-05-01T08:00:00.000Z');
  return {
    wristband: { barcode: 'WB-A-1', patientId: PATIENT_A, isActive: true },
    prescription: {
      id: 'aaaaaaaa-1111-4111-8111-111111111112',
      patientId: PATIENT_A,
      medicationName: 'Warfarin',
      dosage: '5mg',
      frequency: 'daily',
      status: 'active',
    },
    medication: {
      barcode: 'WARF-5MG',
      medicationName: 'Warfarin',
      genericName: 'warfarin',
      strength: '5mg',
      unit: 'mg',
      route: 'oral',
      isActive: true,
      isHighAlert: true,
      isControlled: false,
    },
    scheduled: { dose: '5mg', unit: 'mg', route: 'oral', scheduledTime },
    administered: { dose: '5mg', route: 'oral' },
    scannedAt: new Date('2026-05-01T08:10:00.000Z'),
    alreadyAdministered: false,
    ...overrides,
  };
}

describe('R3 FX-010 five-rights core (red)', () => {
  test('audit bypass (a): A wristband + warfarin + B prescription is rejected', () => {
    const result = evaluateFiveRights(
      baseEvidence({
        prescription: {
          id: RX_B,
          patientId: PATIENT_B,
          medicationName: 'Lisinopril',
          dosage: '10mg',
          frequency: 'daily',
          status: 'active',
        },
      }),
    );
    expect(result.verified).toBe(false);
    expect(result.failures).toContain('wrong-patient');
  });

  test('audit bypass (b): nil-UUID prescription id is rejected, not silently false', () => {
    const result = evaluateFiveRights(
      baseEvidence({
        prescription: null,
        prescriptionRefInvalid: true,
        prescriptionRefRaw: NIL_UUID,
      }),
    );
    expect(result.verified).toBe(false);
    expect(result.failures).toContain('invalid-prescription-id');
  });

  test('audit bypass (c): garbage prescription id is rejected', () => {
    const result = evaluateFiveRights(
      baseEvidence({ prescription: null, prescriptionRefInvalid: true, prescriptionRefRaw: 'not-a-uuid' }),
    );
    expect(result.verified).toBe(false);
    expect(result.failures).toContain('invalid-prescription-id');
  });

  test('wrong drug alone is a hard block', () => {
    const result = evaluateFiveRights(
      baseEvidence({
        medication: {
          barcode: 'LIS-10MG',
          medicationName: 'Lisinopril',
          genericName: 'lisinopril',
          strength: '10mg',
          unit: 'mg',
          route: 'oral',
          isActive: true,
          isHighAlert: false,
          isControlled: false,
        },
      }),
    );
    expect(result.verified).toBe(false);
    expect(result.failures).toContain('wrong-drug');
    expect(result.failures).not.toContain('wrong-patient');
  });

  test('wrong dose alone is a hard block', () => {
    const result = evaluateFiveRights(baseEvidence({ administered: { dose: '10mg', route: 'oral' } }));
    expect(result.verified).toBe(false);
    expect(result.failures).toContain('wrong-dose');
    expect(result.failures).toHaveLength(1);
  });

  test('wrong route alone is a hard block', () => {
    const result = evaluateFiveRights(baseEvidence({ administered: { dose: '5mg', route: 'iv' } }));
    expect(result.verified).toBe(false);
    expect(result.failures).toContain('wrong-route');
    expect(result.failures).toHaveLength(1);
  });

  test('outside the administration time window is a hard block', () => {
    const result = evaluateFiveRights(
      baseEvidence({ scannedAt: new Date(new Date('2026-05-01T08:00:00.000Z').getTime() + (FIVE_RIGHTS_TIME_WINDOW_MINUTES + 30) * 60000) }),
    );
    expect(result.verified).toBe(false);
    expect(result.failures).toContain('outside-administration-window');
  });

  test('expired prescription is a hard block', () => {
    const ev = baseEvidence();
    ev.prescription!.status = 'expired';
    const result = evaluateFiveRights(ev);
    expect(result.verified).toBe(false);
    expect(result.failures).toContain('prescription-not-active');
  });

  test('duplicate scan (already administered) is a hard block', () => {
    const result = evaluateFiveRights(baseEvidence({ alreadyAdministered: true }));
    expect(result.verified).toBe(false);
    expect(result.failures).toContain('duplicate-administration');
  });

  test('happy path verifies with populated patient/medication and empty failures', () => {
    const result = evaluateFiveRights(baseEvidence());
    expect(result.verified).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.alerts.some((a) => a.includes('HIGH-ALERT'))).toBe(true);
  });
});

describe('R3 FX-010 service gate (red)', () => {
  const scheduledTime = new Date('2026-05-01T08:00:00.000Z');

  function fakeTenantDb(scenario: 'match' | 'patient-b-rx') {
    const wristband = { barcode: 'WB-A-1', patientId: PATIENT_A, isActive: true, patient: { id: PATIENT_A } };
    const medication = {
      barcode: 'WARF-5MG', medicationName: 'Warfarin', genericName: 'warfarin',
      strength: '5mg', unit: 'mg', route: 'oral', isActive: true, isHighAlert: true, isControlled: false,
    };
    const prescription =
      scenario === 'match'
        ? { id: 'aaaaaaaa-3333-4333-8333-333333333333', patientId: PATIENT_A, medicationName: 'Warfarin', dosage: '5mg', frequency: 'daily', status: 'active' }
        : { id: RX_B, patientId: PATIENT_B, medicationName: 'Lisinopril', dosage: '10mg', frequency: 'daily', status: 'active' };
    return {
      query: async (sql: string) => {
        if (/mar_scheduled_entries/.test(sql)) {
          return [{ id: 'sched-1', prescription_id: prescription.id, patient_id: PATIENT_A, medication_name: 'Warfarin', dose: '5mg', unit: 'mg', route: 'oral', scheduled_time: scheduledTime, status: 'pending' }];
        }
        if (/medication_administration_records/.test(sql)) return [];
        return [];
      },
      getRepository: (entity: any) => {
        const name = entity?.name || '';
        if (name === 'PatientWristband') return { findOne: async () => wristband };
        if (name === 'MedicationBarcodeMaster') return { findOne: async () => medication };
        if (name === 'Prescription') return { findOne: async () => (scenario === 'patient-b-rx' && arguments ? prescription : prescription) };
        if (name === 'MedicationAlert') {
          return { create: (x: any) => x, save: async (x: any) => ({ id: 'override-1', ...x }) };
        }
        throw new Error(`unexpected repo ${name}`);
      },
    } as any;
  }

  const allowAccess = { assertCanAccess: async () => undefined } as any;
  const denyAccess = {
    assertCanAccess: async () => {
      throw new ForbiddenException('Access denied: no established relationship to this patient');
    },
  } as any;

  const RX_A = 'aaaaaaaa-3333-4333-8333-333333333333';
  const input = {
    patientBarcode: 'WB-A-1',
    medicationBarcode: 'WARF-5MG',
    prescriptionId: RX_A,
    dose: '5mg',
    route: 'oral',
    scannedAt: new Date('2026-05-01T08:10:00.000Z'),
  };

  test('strict verify throws (hard block) on patient mismatch, not silent false', async () => {
    const svc = new BcmaService(undefined, allowAccess);
    await expect(
      svc.verifyFiveRightsStrict({ ...input, prescriptionId: RX_B }, { userId: NURSE, role: 'nurse' }, fakeTenantDb('patient-b-rx')),
    ).rejects.toThrow(/wrong-patient/);
  });

  test('strict verify requires an accessor: missing accessor throws instead of bypassing', async () => {
    const svc = new BcmaService(undefined, allowAccess);
    await expect(svc.verifyFiveRightsStrict(input, undefined as any, fakeTenantDb('match'))).rejects.toThrow();
  });

  test('R2 composition: stranger with perfect clinical evidence is still denied', async () => {
    const svc = new BcmaService(undefined, denyAccess);
    await expect(
      svc.verifyFiveRightsStrict(input, { userId: NURSE, role: 'nurse' }, fakeTenantDb('match')),
    ).rejects.toThrow(ForbiddenException);
  });

  test('override without witness on high-alert warfarin is denied; with witness it audits', async () => {
    const svc = new BcmaService(undefined, allowAccess);
    const db = fakeTenantDb('patient-b-rx');
    await expect(
      svc.overrideFiveRights(
        { ...input, prescriptionId: RX_B },
        { reason: 'clinician insisted' },
        { userId: NURSE, role: 'nurse' },
        db,
      ),
    ).rejects.toThrow(/witness/i);
    const saved: any[] = [];
    const dbCapture = { ...db, getRepository: (e: any) => {
      if (e?.name === 'MedicationAlert') return { create: (x: any) => x, save: async (x: any) => { saved.push(x); return { id: 'o1', ...x }; } };
      return (db as any).getRepository(e);
    } } as any;
    const ok = await svc.overrideFiveRights(
      { ...input, prescriptionId: RX_B },
      { reason: 'verbal order from Dr X, read back', witnessUserId: 'witness-1' },
      { userId: NURSE, role: 'nurse' },
      dbCapture,
    );
    expect(ok.overridden).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0].overrideReason).toMatch(/verbal order/);
  });

  test('offline cached MAR past the staleness limit fails closed', async () => {
    const svc = new BcmaService(undefined, allowAccess);
    await expect(
      svc.verifyFiveRightsOffline(
        input,
        { scheduled: { dose: '5mg', unit: 'mg', route: 'oral', scheduledTime }, cachedAt: new Date(Date.now() - (OFFLINE_CACHED_MAR_STALENESS_LIMIT_MINUTES + 10) * 60000) } as any,
        { userId: NURSE, role: 'nurse' },
        fakeTenantDb('match'),
      ),
    ).rejects.toThrow(/stale/i);
  });
});
