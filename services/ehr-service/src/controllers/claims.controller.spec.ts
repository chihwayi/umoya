import { ClaimsController } from './claims.controller';

describe('ClaimsController', () => {
  const mockTenantDb = {} as any;

  const claimsService = {
    getClaimReadiness: jest.fn(),
    getClaimReadinessWorklist: jest.fn(),
  } as any;

  let controller: ClaimsController;

  beforeEach(() => {
    controller = new ClaimsController(claimsService);
    jest.clearAllMocks();
  });

  it('returns claim readiness for the requested claim', async () => {
    const expected = { claimId: 'claim-1', status: 'blocked' };
    claimsService.getClaimReadiness.mockResolvedValue(expected);

    const result = await controller.getClaimReadiness('claim-1', { tenantDb: mockTenantDb } as any);

    expect(result).toEqual(expected);
    expect(claimsService.getClaimReadiness).toHaveBeenCalledWith('claim-1', mockTenantDb);
  });

  it('returns claim readiness worklist for the current tenant', async () => {
    const expected = { summary: { total: 4 } };
    const query = { statuses: 'draft,rejected', limit: '25' };
    claimsService.getClaimReadinessWorklist.mockResolvedValue(expected);

    const result = await controller.getClaimReadinessWorklist(query, { tenantDb: mockTenantDb } as any);

    expect(result).toEqual(expected);
    expect(claimsService.getClaimReadinessWorklist).toHaveBeenCalledWith(query, mockTenantDb);
  });
});
