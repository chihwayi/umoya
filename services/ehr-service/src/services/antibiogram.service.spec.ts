import { AntibiogramService } from './antibiogram.service';

describe('AntibiogramService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes empirical antimicrobial recommendations through governed CdssService', async () => {
    const tenantDb = {} as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const cdssService = {
      recommendEmpiricalAntimicrobial: jest.fn().mockResolvedValue({
        recommendation: 'ceftriaxone',
        rationale: ['Urinary source pattern'],
      }),
    };

    const service = new AntibiogramService(tenantService as any, cdssService as any);
    const result = await service.empiricalRecommendation('kids-clinic', {
      syndrome: 'urinary tract infection',
      severity: 'moderate',
    });

    expect(cdssService.recommendEmpiricalAntimicrobial).toHaveBeenCalledWith(
      {
        syndrome: 'urinary tract infection',
        severity: 'moderate',
      },
      'kids-clinic',
      tenantDb,
    );
    expect(result.recommendation).toBe('ceftriaxone');
  });

  it('routes antimicrobial de-escalation through governed CdssService', async () => {
    const tenantDb = {} as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const cdssService = {
      recommendAntimicrobialDeescalation: jest.fn().mockResolvedValue({
        recommendation: 'ceftriaxone',
        action: 'deescalate',
      }),
    };

    const service = new AntibiogramService(tenantService as any, cdssService as any);
    const result = await service.deescalateRecommendation('kids-clinic', {
      organism: 'E. coli',
      current_regimen: 'piperacillin-tazobactam',
      susceptibility: { ceftriaxone: 'S' },
    });

    expect(cdssService.recommendAntimicrobialDeescalation).toHaveBeenCalledWith(
      {
        organism: 'E. coli',
        current_regimen: 'piperacillin-tazobactam',
        susceptibility: { ceftriaxone: 'S' },
      },
      'kids-clinic',
      tenantDb,
    );
    expect(result.action).toBe('deescalate');
  });
});
