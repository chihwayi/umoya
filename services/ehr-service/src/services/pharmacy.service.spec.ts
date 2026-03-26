import { BadRequestException } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';

describe('PharmacyService', () => {
  const buildService = () =>
    new PharmacyService({
      createBill: jest.fn().mockResolvedValue({ id: 'bill-1' }),
      addPayment: jest.fn().mockResolvedValue({ id: 'payment-1' }),
    } as any);

  it('requires pharmacist acknowledgment before dispensing when pharmacy intelligence signals exist', async () => {
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT * FROM prescriptions')) {
          return [{ id: 'rx-1', patient_id: 'patient-1' }];
        }
        if (sql.includes('FROM pharmacy_substitution_recommendations')) {
          return [{ id: 'sub-1', source_medication_name: 'Lipitor', generic_alternative: 'atorvastatin' }];
        }
        if (sql.includes('FROM antimicrobial_stewardship')) {
          return [{ id: 'stew-1', antibiotic_name: 'Amoxicillin', stewardship_recommendation: 'Review duration' }];
        }
        throw new Error(`Unexpected query: ${sql}`);
      }),
    };

    const tenantDb = {
      createQueryRunner: jest.fn(() => queryRunner),
    } as any;

    const service = buildService();

    await expect(
      service.dispensePrescription(
        tenantDb,
        'rx-1',
        {
          patientId: 'patient-1',
          items: [{ inventoryId: 'inv-1', drugId: 'drug-1', quantityDispensed: 2 }],
          paymentMethod: 'cash',
        },
        'pharm-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('persists AI review acknowledgment details on dispensing records', async () => {
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('SELECT * FROM prescriptions')) {
          return [{ id: 'rx-1', patient_id: 'patient-1', quantity: 2 }];
        }
        if (sql.includes('FROM pharmacy_substitution_recommendations')) {
          return [{ id: 'sub-1', source_medication_name: 'Lipitor', generic_alternative: 'atorvastatin' }];
        }
        if (sql.includes('FROM antimicrobial_stewardship')) {
          return [{ id: 'stew-1', antibiotic_name: 'Amoxicillin', stewardship_recommendation: 'Review duration' }];
        }
        if (sql.includes('SELECT COUNT(*)::int as count FROM pharmacy_dispensings')) {
          return [{ count: 7 }];
        }
        if (sql.includes('FROM pharmacy_inventory WHERE id = $1')) {
          return [{ quantity_on_hand: 10, selling_price: 5, name: 'Lipitor', expiry_date: '2026-12-31', batch_number: 'B1' }];
        }
        if (sql.includes('INSERT INTO pharmacy_dispensings')) {
          return [{ id: 'disp-1', patient_id: 'patient-1' }];
        }
        if (sql.includes('INSERT INTO pharmacy_dispensing_items')) {
          return [];
        }
        if (sql.includes('UPDATE pharmacy_inventory')) {
          return [];
        }
        if (sql.includes('INSERT INTO pharmacy_stock_movements')) {
          return [];
        }
        if (sql.includes('UPDATE prescriptions')) {
          return [];
        }
        if (sql.includes('SELECT name, generic_name FROM pharmacy_inventory')) {
          return [{ name: 'Lipitor', generic_name: 'atorvastatin' }];
        }
        if (sql.includes('UPDATE pharmacy_dispensings') && sql.includes('bill_id')) {
          return [];
        }
        throw new Error(`Unexpected query: ${sql}`);
      }),
    };

    const tenantDb = {
      createQueryRunner: jest.fn(() => queryRunner),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM pharmacy_dispensings d')) {
          return [{
            id: 'disp-1',
            patient_id: 'patient-1',
            patient_name: 'Patient One',
            patient_number: 'P001',
          }];
        }
        if (sql.includes('FROM pharmacy_dispensing_items di')) {
          return [];
        }
        throw new Error(`Unexpected tenantDb query: ${sql}`);
      }),
    } as any;

    const service = buildService();

    await service.dispensePrescription(
      tenantDb,
      'rx-1',
      {
        patientId: 'patient-1',
        items: [{ inventoryId: 'inv-1', drugId: 'drug-1', quantityDispensed: 2 }],
        paymentMethod: 'cash',
        medicationReviewId: 'review-1',
        selectedSubstitutionRecommendationIds: ['sub-1'],
        stewardshipReviewIds: ['stew-1'],
        aiReviewAcknowledged: true,
        aiReviewSummary: { source: 'ui' },
      },
      'pharm-1',
    );

    const insertCall = queryRunner.query.mock.calls.find(([sql]: [string]) =>
      sql.includes('INSERT INTO pharmacy_dispensings'),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall[1][6]).toBeTruthy();
    expect(insertCall[1][7]).toBe('pharm-1');
    expect(JSON.parse(insertCall[1][8])).toEqual(
      expect.objectContaining({
        source: 'ui',
        medicationReviewId: 'review-1',
        selectedSubstitutionRecommendationIds: ['sub-1'],
        stewardshipReviewIds: ['stew-1'],
        acknowledged: true,
      }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });
});
