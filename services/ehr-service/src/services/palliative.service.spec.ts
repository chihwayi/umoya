import { PalliativeService } from './palliative.service';

describe('PalliativeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes prognosis, opioid conversion, and symptom management through governed CdssService', async () => {
    const cdssService = {
      palliativePrognosis: jest.fn().mockResolvedValue({ phase_of_illness: 'palliative' }),
      palliativeOpioidConvert: jest.fn().mockResolvedValue({ adjusted_dose_mg_24h: 30 }),
      palliativeSymptomManage: jest.fn().mockResolvedValue({ pharmacological_suggestions: ['Morphine'] }),
    };
    const service = new PalliativeService({} as any, cdssService as any);

    await service.calcPrognosis({ patientId: 'patient-1', ecog_ps: 2, kps: 60 }, 'kids-clinic');
    await service.convertOpioid({ patientId: 'patient-1', drug: 'morphine', dose_mg: 30 }, 'kids-clinic');
    await service.manageSymptom({ patientId: 'patient-1', symptom: 'pain', severity: 7 }, 'kids-clinic');

    expect(cdssService.palliativePrognosis).toHaveBeenCalledWith(
      { patientId: 'patient-1', ecog_ps: 2, kps: 60 },
      'kids-clinic',
      undefined,
    );
    expect(cdssService.palliativeOpioidConvert).toHaveBeenCalled();
    expect(cdssService.palliativeSymptomManage).toHaveBeenCalled();
  });
});
