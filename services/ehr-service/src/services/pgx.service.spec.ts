import { PgxService } from './pgx.service';
import { PgxProfile } from '../entities/pgx-profile.entity';

describe('PgxService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes PGx checks through governed CdssService with flattened phenotype payload', async () => {
    const profile = {
      patientId: 'patient-1',
      cyp2c19Phenotype: 'poor',
      cyp2d6Phenotype: 'normal',
      cyp2c9Phenotype: 'normal',
      tpmtPhenotype: 'normal',
      hlaB5701: 'negative',
      hlaB1502: 'negative',
      slco1b1Variant: 'normal',
      g6pdStatus: 'normal',
      rawGenotypingData: {},
    } as PgxProfile;
    const profileRepo = {
      findOneBy: jest.fn().mockResolvedValue(profile),
    };
    const alertRepo = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
      find: jest.fn(),
      update: jest.fn(),
    };
    const tenantDb = {
      getRepository: jest.fn((entity: any) => (entity === PgxProfile ? profileRepo : alertRepo)),
    } as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const cdssService = {
      checkPgx: jest.fn().mockResolvedValue({
        alerts: [{
          gene: 'CYP2C19',
          interaction: 'Reduced antiplatelet effect',
          alternative: 'prasugrel',
          severity: 'high',
        }],
      }),
    };

    const service = new PgxService(tenantService as any, cdssService as any);
    const result = await service.checkDrug('kids-clinic', 'patient-1', 'clopidogrel');

    expect(cdssService.checkPgx).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        drug: 'clopidogrel',
        cyp2c19: 'PM',
      }),
      'kids-clinic',
      tenantDb,
    );
    expect(result?.geneInvolved).toBe('CYP2C19');
  });
});
