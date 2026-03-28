import { DermatologyService } from './dermatology.service';

describe('DermatologyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes lesion classification and burn fluid calculation through governed CdssService', async () => {
    const cdssService = {
      classifyDermatologyLesion: jest.fn().mockResolvedValue({ urgency: 'urgent' }),
      calculateDermatologyBurnFluid: jest.fn().mockResolvedValue({ parkland_total_ml: 3200 }),
    };
    const service = new DermatologyService({} as any, cdssService as any);

    await service.classifyLesion({ morphology: 'nodule' }, 'kids-clinic');
    await service.calculateBurnFluid({ weight_kg: 80, tbsa_percent: 10 }, 'kids-clinic');

    expect(cdssService.classifyDermatologyLesion).toHaveBeenCalledWith(
      { morphology: 'nodule' },
      'kids-clinic',
      undefined,
    );
    expect(cdssService.calculateDermatologyBurnFluid).toHaveBeenCalledWith(
      { weight_kg: 80, tbsa_percent: 10 },
      'kids-clinic',
      undefined,
    );
  });
});
