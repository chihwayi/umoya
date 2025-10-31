import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LabTest } from '../entities/lab-test.entity';

@Injectable()
export class LabTestService {
  
  async findAll(tenantDb: DataSource, category?: string, search?: string): Promise<LabTest[]> {
    const testRepository = tenantDb.getRepository(LabTest);
    
    let query = testRepository.createQueryBuilder('test')
      .where('test.isActive = :isActive', { isActive: true });
    
    if (category) {
      query = query.andWhere('test.category = :category', { category });
    }
    
    if (search) {
      query = query.andWhere(
        '(test.testName ILIKE :search OR test.testCode ILIKE :search OR test.loincCode ILIKE :search)',
        { search: `%${search}%` }
      );
    }
    
    return query.orderBy('test.category', 'ASC').addOrderBy('test.testName', 'ASC').getMany();
  }

  async findOne(id: string, tenantDb: DataSource): Promise<LabTest> {
    const testRepository = tenantDb.getRepository(LabTest);
    const test = await testRepository.findOne({ where: { id } });
    
    if (!test) {
      throw new Error('Lab test not found');
    }
    
    return test;
  }

  async findByLoincCode(loincCode: string, tenantDb: DataSource): Promise<LabTest | null> {
    const testRepository = tenantDb.getRepository(LabTest);
    return testRepository.findOne({ where: { loincCode, isActive: true } });
  }

  async getReferenceRange(testId: string, gender: string, tenantDb: DataSource): Promise<string | null> {
    const test = await this.findOne(testId, tenantDb);
    
    if (gender === 'male' && test.referenceRangeMale) {
      return test.referenceRangeMale;
    }
    if (gender === 'female' && test.referenceRangeFemale) {
      return test.referenceRangeFemale;
    }
    return test.referenceRangeGeneral || null;
  }

  async checkCriticalValues(testId: string, value: number, tenantDb: DataSource): Promise<{ isCritical: boolean; type: 'high' | 'low' | null }> {
    const test = await this.findOne(testId, tenantDb);
    
    if (test.criticalHigh && value > test.criticalHigh) {
      return { isCritical: true, type: 'high' };
    }
    
    if (test.criticalLow && value < test.criticalLow) {
      return { isCritical: true, type: 'low' };
    }
    
    return { isCritical: false, type: null };
  }

  async seedDefaultTests(tenantDb: DataSource): Promise<void> {
    const testRepository = tenantDb.getRepository(LabTest);
    const count = await testRepository.count();
    
    if (count > 0) {
      return; // Already seeded
    }

    const defaultTests = [
      // Complete Blood Count (CBC)
      { testName: 'White Blood Cell Count', loincCode: '6690-2', testCode: 'WBC', category: 'hematology', specimenType: 'Whole Blood', unit: '10*3/uL', referenceRangeGeneral: '4.0-11.0', criticalHigh: 30.0, criticalLow: 2.0 },
      { testName: 'Red Blood Cell Count', loincCode: '789-8', testCode: 'RBC', category: 'hematology', specimenType: 'Whole Blood', unit: '10*6/uL', referenceRangeMale: '4.5-6.0', referenceRangeFemale: '4.0-5.5', criticalLow: 2.0 },
      { testName: 'Hemoglobin', loincCode: '718-7', testCode: 'HGB', category: 'hematology', specimenType: 'Whole Blood', unit: 'g/dL', referenceRangeMale: '13.5-17.5', referenceRangeFemale: '12.0-15.5', criticalHigh: 20.0, criticalLow: 7.0 },
      { testName: 'Hematocrit', loincCode: '4544-3', testCode: 'HCT', category: 'hematology', specimenType: 'Whole Blood', unit: '%', referenceRangeMale: '40-52', referenceRangeFemale: '36-48', criticalHigh: 60.0, criticalLow: 20.0 },
      { testName: 'Mean Cell Volume', loincCode: '787-2', testCode: 'MCV', category: 'hematology', specimenType: 'Whole Blood', unit: 'fL', referenceRangeGeneral: '80-100' },
      { testName: 'Platelet Count', loincCode: '777-3', testCode: 'PLT', category: 'hematology', specimenType: 'Whole Blood', unit: '10*3/uL', referenceRangeGeneral: '150-450', criticalLow: 50.0 },
      
      // Comprehensive Metabolic Panel (CMP)
      { testName: 'Glucose', loincCode: '2339-0', testCode: 'GLU', category: 'chemistry', specimenType: 'Serum', unit: 'mg/dL', referenceRangeGeneral: '70-100', criticalHigh: 400.0, criticalLow: 40.0 },
      { testName: 'Creatinine', loincCode: '2160-0', testCode: 'CREAT', category: 'chemistry', specimenType: 'Serum', unit: 'mg/dL', referenceRangeMale: '0.7-1.3', referenceRangeFemale: '0.6-1.1', criticalHigh: 5.0 },
      { testName: 'Blood Urea Nitrogen', loincCode: '3094-0', testCode: 'BUN', category: 'chemistry', specimenType: 'Serum', unit: 'mg/dL', referenceRangeGeneral: '7-20', criticalHigh: 100.0 },
      { testName: 'Sodium', loincCode: '2951-2', testCode: 'NA', category: 'chemistry', specimenType: 'Serum', unit: 'mEq/L', referenceRangeGeneral: '136-145', criticalHigh: 160.0, criticalLow: 120.0 },
      { testName: 'Potassium', loincCode: '2823-3', testCode: 'K', category: 'chemistry', specimenType: 'Serum', unit: 'mEq/L', referenceRangeGeneral: '3.5-5.0', criticalHigh: 6.5, criticalLow: 2.5 },
      { testName: 'Chloride', loincCode: '2075-0', testCode: 'CL', category: 'chemistry', specimenType: 'Serum', unit: 'mEq/L', referenceRangeGeneral: '98-107' },
      { testName: 'Carbon Dioxide', loincCode: '2028-9', testCode: 'CO2', category: 'chemistry', specimenType: 'Serum', unit: 'mEq/L', referenceRangeGeneral: '22-28' },
      { testName: 'Total Protein', loincCode: '2885-2', testCode: 'TP', category: 'chemistry', specimenType: 'Serum', unit: 'g/dL', referenceRangeGeneral: '6.0-8.3' },
      { testName: 'Albumin', loincCode: '1751-7', testCode: 'ALB', category: 'chemistry', specimenType: 'Serum', unit: 'g/dL', referenceRangeGeneral: '3.5-5.0', criticalLow: 2.0 },
      { testName: 'Bilirubin Total', loincCode: '1975-2', testCode: 'TBIL', category: 'chemistry', specimenType: 'Serum', unit: 'mg/dL', referenceRangeGeneral: '0.2-1.2', criticalHigh: 15.0 },
      { testName: 'ALT (Alanine Aminotransferase)', loincCode: '1742-6', testCode: 'ALT', category: 'chemistry', specimenType: 'Serum', unit: 'U/L', referenceRangeMale: '10-40', referenceRangeFemale: '7-35', criticalHigh: 500.0 },
      { testName: 'AST (Aspartate Aminotransferase)', loincCode: '1920-8', testCode: 'AST', category: 'chemistry', specimenType: 'Serum', unit: 'U/L', referenceRangeMale: '10-40', referenceRangeFemale: '9-32', criticalHigh: 500.0 },
      { testName: 'Alkaline Phosphatase', loincCode: '6768-6', testCode: 'ALP', category: 'chemistry', specimenType: 'Serum', unit: 'U/L', referenceRangeGeneral: '44-147' },
      
      // Lipid Panel
      { testName: 'Total Cholesterol', loincCode: '2093-3', testCode: 'CHOL', category: 'chemistry', specimenType: 'Serum', unit: 'mg/dL', referenceRangeGeneral: '<200', criticalHigh: 300.0 },
      { testName: 'Triglycerides', loincCode: '2571-8', testCode: 'TRIG', category: 'chemistry', specimenType: 'Serum', unit: 'mg/dL', referenceRangeGeneral: '<150', criticalHigh: 500.0 },
      { testName: 'HDL Cholesterol', loincCode: '2085-9', testCode: 'HDL', category: 'chemistry', specimenType: 'Serum', unit: 'mg/dL', referenceRangeGeneral: '>40', criticalLow: 20.0 },
      { testName: 'LDL Cholesterol', loincCode: '2089-1', testCode: 'LDL', category: 'chemistry', specimenType: 'Serum', unit: 'mg/dL', referenceRangeGeneral: '<100', criticalHigh: 190.0 },
      
      // Common Tests
      { testName: 'TSH (Thyroid Stimulating Hormone)', loincCode: '3016-3', testCode: 'TSH', category: 'immunology', specimenType: 'Serum', unit: 'mIU/L', referenceRangeGeneral: '0.4-4.0' },
      { testName: 'Free T4', loincCode: '3026-2', testCode: 'FT4', category: 'immunology', specimenType: 'Serum', unit: 'ng/dL', referenceRangeGeneral: '0.8-1.8' },
      { testName: 'Hemoglobin A1c', loincCode: '4548-4', testCode: 'HBA1C', category: 'chemistry', specimenType: 'Whole Blood', unit: '%', referenceRangeGeneral: '4.0-5.6', criticalHigh: 10.0 },
      { testName: 'HIV Antibody', loincCode: '75622-1', testCode: 'HIV', category: 'immunology', specimenType: 'Serum', unit: '', referenceRangeGeneral: 'Negative' },
    ];

    for (const test of defaultTests) {
      await testRepository.save(testRepository.create(test));
    }
  }
}

