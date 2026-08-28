import { AiExplainabilityService } from './ai-explainability.service';

describe('AiExplainabilityService', () => {
  // F18 (S269) — persistAudit was previously fire-and-forget with a fully silent
  // .catch(() => {}); a failure now must surface via the logger instead of vanishing.
  it('logs an error when audit persistence fails, without throwing back to the caller', async () => {
    const tenantService = {
      getTenantDatabase: jest.fn().mockRejectedValue(new Error('db unavailable')),
    };
    const service = new AiExplainabilityService(tenantService as any);
    const errorSpy = jest.spyOn((service as any).logger, 'error');

    const result = await service.wrapAndAudit('clinic-a', 'diagnosis_suggestion', { diagnosis: 'flu' }, {
      patientId: 'patient-1',
      confidence: 0.8,
      reasoning: 'matches symptoms',
    });

    expect(result.recommendation).toEqual({ diagnosis: 'flu' });

    // persistAudit runs fire-and-forget; flush microtasks before asserting.
    await new Promise((resolve) => setImmediate(resolve));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('diagnosis_suggestion'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('patient-1'));
  });

  it('does not log when audit persistence succeeds', async () => {
    const repo = { create: jest.fn((v) => v), save: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue({ getRepository: jest.fn().mockReturnValue(repo) }),
    };
    const service = new AiExplainabilityService(tenantService as any);
    const errorSpy = jest.spyOn((service as any).logger, 'error');

    await service.wrapAndAudit('clinic-a', 'diagnosis_suggestion', { diagnosis: 'flu' }, { patientId: 'patient-1' });
    await new Promise((resolve) => setImmediate(resolve));

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
