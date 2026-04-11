import { NotFoundException } from '@nestjs/common';
import { TraditionalMedicineService } from './traditional-medicine.service';
import { TmRemedy } from '../entities/tm-remedy.entity';
import { HdiAlert } from '../entities/hdi-alert.entity';
import { TmToxicityEvent } from '../entities/tm-toxicity-event.entity';
import { Prescription } from '../entities/prescription.entity';

describe('TraditionalMedicineService', () => {
  const remedyRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const alertRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const toxicityRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };
  const prescriptionRepo = {
    find: jest.fn(),
  };

  const db = {
    getRepository: jest.fn((entity: any) => {
      if (entity === TmRemedy) return remedyRepo;
      if (entity === HdiAlert) return alertRepo;
      if (entity === TmToxicityEvent) return toxicityRepo;
      if (entity === Prescription) return prescriptionRepo;
      throw new Error(`Unknown repo request: ${entity?.name}`);
    }),
  };

  const tenantService = {
    getTenantDatabase: jest.fn().mockResolvedValue(db),
  };

  const cdssService = {
    tmHdiCheck: jest.fn(),
    tmToxicityRisk: jest.fn(),
  };

  let service: TraditionalMedicineService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TraditionalMedicineService(tenantService as any, cdssService as any);
    remedyRepo.create.mockImplementation((value) => value);
    alertRepo.create.mockImplementation((value) => value);
    toxicityRepo.create.mockImplementation((value) => value);
    alertRepo.findOne.mockResolvedValue(null);
  });

  it('records a remedy and auto-triggers HDI checks against active prescriptions', async () => {
    remedyRepo.save.mockResolvedValue({
      id: 'remedy-1',
      patientId: 'patient-1',
      remedyName: "St. John's Wort",
    });
    prescriptionRepo.find.mockResolvedValue([
      { medicationName: 'Warfarin' },
    ]);
    cdssService.tmHdiCheck.mockResolvedValue({
      alert_level: 'danger',
      interactions: [
        {
          matched_drugs: ['Warfarin'],
          interaction_type: 'pharmacokinetic',
          mechanism: 'CYP3A4_induction + P-gp induction',
          severity: 'major',
          clinical_effect: 'Therapeutic failure.',
          management: 'Avoid concurrent use.',
          evidence_level: 'high',
        },
      ],
    });
    alertRepo.save.mockResolvedValue({ id: 'alert-1' });

    const result = await service.recordRemedy('tenant-a', 'patient-1', 'user-1', {
      remedyName: "St. John's Wort",
    });

    expect(cdssService.tmHdiCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        herb_names: ["St. John's Wort"],
        current_drugs: ['Warfarin'],
      }),
      'tenant-a',
    );
    expect(alertRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        tmRemedyId: 'remedy-1',
        drugName: 'Warfarin',
        severity: 'major',
      }),
    );
    expect(result.remedy.id).toBe('remedy-1');
    expect(result.interactionCheck.alert_level).toBe('danger');
  });

  it('acknowledges an HDI alert', async () => {
    alertRepo.findOne
      .mockResolvedValueOnce({ id: 'alert-1' })
      .mockResolvedValueOnce({
        id: 'alert-1',
        acknowledgedBy: 'user-1',
        overrideReason: 'Discussed with clinician',
      });

    const result = await service.acknowledgeAlert('tenant-a', 'alert-1', 'user-1', 'Discussed with clinician');

    expect(alertRepo.update).toHaveBeenCalledWith(
      'alert-1',
      expect.objectContaining({
        acknowledgedBy: 'user-1',
        overrideReason: 'Discussed with clinician',
      }),
    );
    expect(result.id).toBe('alert-1');
  });

  it('throws when updating a missing remedy', async () => {
    remedyRepo.findOne.mockResolvedValue(null);

    await expect(service.updateRemedy('tenant-a', 'missing', { isOngoing: false })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records a toxicity event and requests toxicity guidance', async () => {
    toxicityRepo.save.mockResolvedValue({
      id: 'tox-1',
      patientId: 'patient-1',
      organSystem: 'hepatic',
    });
    remedyRepo.findOne.mockResolvedValue({
      id: 'remedy-1',
      remedyName: 'Kava',
    });
    cdssService.tmToxicityRisk.mockResolvedValue({
      has_toxicity_risk: true,
      toxicity_flags: [{ herb: 'Kava', risk: 'hepatotoxic' }],
    });

    const result = await service.recordToxicityEvent('tenant-a', 'patient-1', 'user-1', {
      tmRemedyId: 'remedy-1',
      organSystem: 'hepatic',
      presentation: 'ALT rise',
    });

    expect(cdssService.tmToxicityRisk).toHaveBeenCalledWith(
      {
        herb_names: ['Kava'],
        organ_concerns: ['hepatic'],
      },
      'tenant-a',
    );
    expect(result.event.id).toBe('tox-1');
    expect(result.toxicityGuidance.has_toxicity_risk).toBe(true);
  });
});
