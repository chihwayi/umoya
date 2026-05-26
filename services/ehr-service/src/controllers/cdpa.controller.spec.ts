import { CdpaController } from './cdpa.controller';

describe('CdpaController', () => {
  it('getSummary returns numeric totals', async () => {
    const controller = new CdpaController();
    const mockReq = {
      tenantDb: {
        query: jest.fn().mockResolvedValue([
          {
            total: '18',
            compliant: '5',
            partial: '3',
            non_compliant: '2',
            not_assessed: '8',
            not_applicable: '0',
          },
        ]),
      },
    };

    const result = await controller.getSummary(mockReq as any);

    expect(result.total).toBe(18);
    expect(result.compliant).toBe(5);
    expect(result.nonCompliant).toBe(2);
    expect(typeof result.nonCompliant).toBe('number');
  });
});
