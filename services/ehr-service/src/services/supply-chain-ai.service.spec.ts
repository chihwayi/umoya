import { SupplyChainAiService } from './supply-chain-ai.service';
import { StockoutPrediction } from '../entities/stockout-prediction.entity';
import { ProcurementAlert } from '../entities/procurement-alert.entity';

describe('SupplyChainAiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes stockout prediction through governed CdssService instead of guideline lookup', async () => {
    const stockoutRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'pred-1', ...value })),
    };
    const alertRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const tenantDb = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'drug-1', name: 'Artemether-Lumefantrine', current_stock: 120, safety_stock_days: 20 }])
        .mockResolvedValueOnce([{ avg_daily: 4 }]),
      getRepository: jest.fn((entity) => {
        if (entity === StockoutPrediction) return stockoutRepo;
        if (entity === ProcurementAlert) return alertRepo;
        throw new Error(`Unexpected repository ${String(entity)}`);
      }),
    } as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const cdssService = {
      predictSupplyStockout: jest.fn().mockResolvedValue({
        seasonal_factor: 1.4,
        drug: 'Artemether-Lumefantrine',
      }),
    };

    const service = new SupplyChainAiService(tenantService as any, cdssService as any);
    const result = await service.predictStockouts('kids-clinic');

    expect(cdssService.predictSupplyStockout).toHaveBeenCalledWith(
      {
        drugName: 'Artemether-Lumefantrine',
        currentStock: 120,
        avgDailyConsumption: 4,
        safetyStockDays: 20,
      },
      undefined,
      tenantDb,
    );
    expect(result).toHaveLength(1);
    expect(result[0].seasonalFactor).toBe(1.4);
  });
});
