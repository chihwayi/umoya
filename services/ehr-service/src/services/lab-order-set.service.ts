import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LabOrderSet } from '../entities/lab-order-set.entity';
import { LabTest } from '../entities/lab-test.entity';

@Injectable()
export class LabOrderSetService {
  
  async findAll(tenantDb: DataSource, category?: string): Promise<LabOrderSet[]> {
    const setRepository = tenantDb.getRepository(LabOrderSet);
    
    let query = setRepository.createQueryBuilder('set')
      .where('set.isActive = :isActive', { isActive: true });
    
    if (category) {
      query = query.andWhere('set.category = :category', { category });
    }
    
    return query.orderBy('set.setName', 'ASC').getMany();
  }

  async findOne(id: string, tenantDb: DataSource): Promise<LabOrderSet> {
    const setRepository = tenantDb.getRepository(LabOrderSet);
    const set = await setRepository.findOne({ where: { id } });
    
    if (!set) {
      throw new Error('Lab order set not found');
    }
    
    return set;
  }

  async getSetWithTests(id: string, tenantDb: DataSource): Promise<{ set: LabOrderSet; tests: LabTest[] }> {
    const set = await this.findOne(id, tenantDb);
    const testRepository = tenantDb.getRepository(LabTest);
    
    const tests = await testRepository
      .createQueryBuilder('test')
      .where('test.id IN (:...ids)', { ids: set.testIds })
      .getMany();
    
    return { set, tests };
  }

  async seedDefaultOrderSets(tenantDb: DataSource): Promise<void> {
    const setRepository = tenantDb.getRepository(LabOrderSet);
    const testRepository = tenantDb.getRepository(LabTest);
    const count = await setRepository.count();
    
    if (count > 0) {
      return; // Already seeded
    }

    // Get test IDs by test code
    const getTestIds = async (codes: string[]): Promise<string[]> => {
      const tests = await testRepository.find({
        where: codes.map(code => ({ testCode: code }))
      });
      return tests.map(t => t.id);
    };

    // CBC Order Set
    const cbcTestIds = await getTestIds(['WBC', 'RBC', 'HGB', 'HCT', 'MCV', 'PLT']);
    await setRepository.save(setRepository.create({
      setCode: 'CBC',
      setName: 'Complete Blood Count',
      description: 'Complete blood count panel including WBC, RBC, Hemoglobin, Hematocrit, MCV, and Platelets',
      testIds: cbcTestIds,
      category: 'hematology'
    }));

    // CMP Order Set
    const cmpTestIds = await getTestIds(['GLU', 'CREAT', 'BUN', 'NA', 'K', 'CL', 'CO2', 'TP', 'ALB', 'TBIL', 'ALT', 'AST', 'ALP']);
    await setRepository.save(setRepository.create({
      setCode: 'CMP',
      setName: 'Comprehensive Metabolic Panel',
      description: 'Complete metabolic panel including glucose, electrolytes, kidney function, and liver function tests',
      testIds: cmpTestIds,
      category: 'chemistry'
    }));

    // Basic Metabolic Panel (BMP)
    const bmpTestIds = await getTestIds(['GLU', 'CREAT', 'BUN', 'NA', 'K', 'CL', 'CO2']);
    await setRepository.save(setRepository.create({
      setCode: 'BMP',
      setName: 'Basic Metabolic Panel',
      description: 'Basic metabolic panel including glucose, electrolytes, and kidney function',
      testIds: bmpTestIds,
      category: 'chemistry'
    }));

    // Lipid Panel
    const lipidTestIds = await getTestIds(['CHOL', 'TRIG', 'HDL', 'LDL']);
    await setRepository.save(setRepository.create({
      setCode: 'LIPID',
      setName: 'Lipid Panel',
      description: 'Complete lipid panel including total cholesterol, triglycerides, HDL, and LDL',
      testIds: lipidTestIds,
      category: 'chemistry'
    }));

    // Liver Function Tests (LFT)
    const lftTestIds = await getTestIds(['TP', 'ALB', 'TBIL', 'ALT', 'AST', 'ALP']);
    await setRepository.save(setRepository.create({
      setCode: 'LFT',
      setName: 'Liver Function Tests',
      description: 'Complete liver function panel including proteins, bilirubin, and liver enzymes',
      testIds: lftTestIds,
      category: 'chemistry'
    }));

    // Thyroid Function Tests
    const thyroidTestIds = await getTestIds(['TSH', 'FT4']);
    await setRepository.save(setRepository.create({
      setCode: 'THYROID',
      setName: 'Thyroid Function Panel',
      description: 'Thyroid function tests including TSH and Free T4',
      testIds: thyroidTestIds,
      category: 'immunology'
    }));
  }
}

