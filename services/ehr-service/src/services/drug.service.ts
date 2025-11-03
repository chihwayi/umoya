import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Drug } from '../entities/drug.entity';
import { DrugInteraction, InteractionSeverity } from '../entities/drug-interaction.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class DrugService {
  constructor(
    @Inject(forwardRef(() => CdssService))
    private readonly cdssService: CdssService
  ) {}

  /**
   * Map CDSS severity string to InteractionSeverity enum
   */
  private mapSeverity(severity: string): InteractionSeverity {
    const severityMap: Record<string, InteractionSeverity> = {
      'critical': InteractionSeverity.MAJOR,
      'major': InteractionSeverity.MAJOR,
      'moderate': InteractionSeverity.MODERATE,
      'minor': InteractionSeverity.MINOR,
      'contraindicated': InteractionSeverity.MAJOR
    };
    return severityMap[severity.toLowerCase()] || InteractionSeverity.MINOR;
  }

  async findAll(tenantDb: DataSource, search?: string, drugClass?: string): Promise<Drug[]> {
    const drugRepository = tenantDb.getRepository(Drug);
    const query = drugRepository.createQueryBuilder('drug')
      .where('drug.isActive = :isActive', { isActive: true });

    if (search) {
      const searchLower = search.toLowerCase();
      query.andWhere(
        '(LOWER(drug.genericName) LIKE :search OR EXISTS (SELECT 1 FROM unnest(drug.brandNames) AS brand WHERE LOWER(brand) LIKE :search))',
        { search: `%${searchLower}%` }
      );
    }

    if (drugClass) {
      query.andWhere('drug.drugClass = :drugClass', { drugClass });
    }

    return query.orderBy('drug.genericName', 'ASC').getMany();
  }

  async findOne(id: string, tenantDb: DataSource): Promise<Drug> {
    const drugRepository = tenantDb.getRepository(Drug);
    const drug = await drugRepository.findOne({ 
      where: { id, isActive: true },
      relations: ['interactionsAsDrug1', 'interactionsAsDrug2']
    });
    
    if (!drug) {
      throw new NotFoundException('Drug not found');
    }
    
    return drug;
  }

  async findByGenericName(genericName: string, tenantDb: DataSource): Promise<Drug | null> {
    const drugRepository = tenantDb.getRepository(Drug);
    return drugRepository.findOne({ 
      where: { genericName: genericName.toLowerCase(), isActive: true }
    });
  }

  async findByBrandName(brandName: string, tenantDb: DataSource): Promise<Drug | null> {
    const drugRepository = tenantDb.getRepository(Drug);
    return drugRepository
      .createQueryBuilder('drug')
      .where('drug.isActive = :isActive', { isActive: true })
      .andWhere(':brandName = ANY(drug.brandNames)', { brandName: brandName.toLowerCase() })
      .getOne();
  }

  async findByName(name: string, tenantDb: DataSource): Promise<Drug | null> {
    // Try generic name first
    let drug = await this.findByGenericName(name, tenantDb);
    if (drug) return drug;
    
    // Try brand name
    drug = await this.findByBrandName(name, tenantDb);
    return drug;
  }

  async checkInteractions(drugIds: string[], tenantDb: DataSource): Promise<DrugInteraction[]> {
    if (drugIds.length < 2) return [];

    // First, try advanced CDSS service (Python-based)
    try {
      const cdssResult = await this.cdssService.checkDrugInteractions(drugIds, undefined, tenantDb);
      
      if (cdssResult.source === 'advanced_cdss' && cdssResult.interactions.length > 0) {
        // Transform CDSS interactions to DrugInteraction format
        const drugRepo = tenantDb.getRepository(Drug);
        const transformedInteractions: DrugInteraction[] = [];
        
        // Get all drugs first for matching
        const allDrugs = drugIds.length > 0 
          ? await drugRepo.find({ where: drugIds.map(id => ({ id })) as any })
          : [];
        const drugMap = new Map(allDrugs.map(d => [d.id, d]));
        
        for (const cdssInteraction of cdssResult.interactions) {
          // Try to match drugs by ID or name
          let drug1: Drug | undefined;
          let drug2: Drug | undefined;
          
          // Try to find by ID first, then by name matching
          for (const drugId of drugIds) {
            const drug = drugMap.get(drugId);
            if (drug && (drug.genericName.toLowerCase() === (cdssInteraction.drug1 || '').toLowerCase() ||
                         drug.genericName.toLowerCase().includes((cdssInteraction.drug1 || '').toLowerCase()))) {
              drug1 = drug;
            }
            if (drug && (drug.genericName.toLowerCase() === (cdssInteraction.drug2 || '').toLowerCase() ||
                         drug.genericName.toLowerCase().includes((cdssInteraction.drug2 || '').toLowerCase()))) {
              drug2 = drug;
            }
          }
          
          // If not found by name, use first two drugs as fallback
          if (!drug1 && drugIds.length >= 1) drug1 = drugMap.get(drugIds[0]);
          if (!drug2 && drugIds.length >= 2) drug2 = drugMap.get(drugIds[1]);
          
          if (drug1 && drug2 && drug1.id !== drug2.id) {
            const interaction = new DrugInteraction();
            interaction.drug1Id = drug1.id;
            interaction.drug2Id = drug2.id;
            interaction.severity = this.mapSeverity(cdssInteraction.severity || 'minor');
            interaction.description = cdssInteraction.mechanism || cdssInteraction.description || '';
            interaction.mechanism = cdssInteraction.mechanism;
            interaction.management = cdssInteraction.management;
            interaction.drug1 = drug1;
            interaction.drug2 = drug2;
            transformedInteractions.push(interaction);
          }
        }
        
        if (transformedInteractions.length > 0) {
          return transformedInteractions;
        }
      }
    } catch (error) {
      console.warn('CDSS service check failed, falling back to database:', error);
    }

    // Fallback to database interaction checking
    const interactionRepository = tenantDb.getRepository(DrugInteraction);
    const interactions: DrugInteraction[] = [];

    // Check all pairs of drugs
    for (let i = 0; i < drugIds.length; i++) {
      for (let j = i + 1; j < drugIds.length; j++) {
        const drug1Id = drugIds[i];
        const drug2Id = drugIds[j];

        // Check interaction in both directions
        let interaction = await interactionRepository.findOne({
          where: { drug1Id, drug2Id },
          relations: ['drug1', 'drug2']
        });

        if (!interaction) {
          interaction = await interactionRepository.findOne({
            where: { drug1Id: drug2Id, drug2Id: drug1Id },
            relations: ['drug1', 'drug2']
          });
        }

        if (interaction) {
          interactions.push(interaction);
        }
      }
    }

    return interactions;
  }

  async getPatientActiveDrugIds(patientId: string, tenantDb: DataSource): Promise<string[]> {
    // Get active prescriptions for patient
    const orderRepository = tenantDb.getRepository('Order');
    const prescriptions = await orderRepository.query(
      `SELECT DISTINCT drug_id FROM orders 
       WHERE patient_id = $1 
       AND order_type = 'medication' 
       AND status IN ('authorized', 'in_progress')
       AND drug_id IS NOT NULL`,
      [patientId]
    );

    return prescriptions.map((p: any) => p.drug_id).filter(Boolean);
  }

  async create(createDrugDto: any, tenantDb: DataSource): Promise<Drug> {
    const drugRepository = tenantDb.getRepository(Drug);
    const drug = drugRepository.create({
      genericName: createDrugDto.genericName.toLowerCase(),
      brandNames: createDrugDto.brandNames?.map((b: string) => b.toLowerCase()) || [],
      atcCode: createDrugDto.atcCode,
      drugClass: createDrugDto.drugClass,
      activeIngredients: createDrugDto.activeIngredients?.map((a: string) => a.toLowerCase()) || [],
      dosageForms: createDrugDto.dosageForms || [],
      routeOfAdministration: createDrugDto.routeOfAdministration || [],
      description: createDrugDto.description,
      isActive: true
    });

    return drugRepository.save(drug);
  }

  async seedDefaultDrugs(tenantDb: DataSource): Promise<{ message: string; count: number }> {
    const drugRepository = tenantDb.getRepository(Drug);
    
    // Check if already seeded
    const existingCount = await drugRepository.count();
    if (existingCount > 0) {
      throw new BadRequestException('Drugs have already been seeded');
    }

    // Common drugs with interactions
    const defaultDrugs = [
      {
        genericName: 'warfarin',
        brandNames: ['Coumadin', 'Jantoven'],
        drugClass: 'Anticoagulant',
        activeIngredients: ['warfarin'],
        dosageForms: ['tablet'],
        description: 'Oral anticoagulant used to prevent blood clots',
      },
      {
        genericName: 'aspirin',
        brandNames: ['Bayer', 'Ecotrin'],
        drugClass: 'NSAID/Antiplatelet',
        activeIngredients: ['acetylsalicylic acid'],
        dosageForms: ['tablet', 'enteric coated'],
        description: 'Pain reliever and antiplatelet agent',
      },
      {
        genericName: 'metformin',
        brandNames: ['Glucophage', 'Fortamet'],
        drugClass: 'Biguanide',
        activeIngredients: ['metformin'],
        dosageForms: ['tablet', 'extended release'],
        description: 'First-line medication for type 2 diabetes',
      },
      {
        genericName: 'lisinopril',
        brandNames: ['Prinivil', 'Zestril'],
        drugClass: 'ACE Inhibitor',
        activeIngredients: ['lisinopril'],
        dosageForms: ['tablet'],
        description: 'ACE inhibitor for hypertension and heart failure',
      },
      {
        genericName: 'amoxicillin',
        brandNames: ['Amoxil'],
        drugClass: 'Penicillin Antibiotic',
        activeIngredients: ['amoxicillin'],
        dosageForms: ['capsule', 'tablet', 'suspension'],
        description: 'Broad-spectrum penicillin antibiotic',
      },
      {
        genericName: 'atorvastatin',
        brandNames: ['Lipitor'],
        drugClass: 'Statin',
        activeIngredients: ['atorvastatin'],
        dosageForms: ['tablet'],
        description: 'HMG-CoA reductase inhibitor for cholesterol',
      },
      {
        genericName: 'levothyroxine',
        brandNames: ['Synthroid', 'Levoxyl'],
        drugClass: 'Thyroid Hormone',
        activeIngredients: ['levothyroxine'],
        dosageForms: ['tablet'],
        description: 'Synthetic thyroid hormone',
      },
      {
        genericName: 'albuterol',
        brandNames: ['Ventolin', 'ProAir'],
        drugClass: 'Bronchodilator',
        activeIngredients: ['albuterol'],
        dosageForms: ['inhaler', 'solution'],
        description: 'Short-acting beta-2 adrenergic agonist',
      },
      {
        genericName: 'omeprazole',
        brandNames: ['Prilosec'],
        drugClass: 'PPI',
        activeIngredients: ['omeprazole'],
        dosageForms: ['capsule', 'tablet'],
        description: 'Proton pump inhibitor for acid reflux',
      },
      {
        genericName: 'metoprolol',
        brandNames: ['Lopressor', 'Toprol XL'],
        drugClass: 'Beta Blocker',
        activeIngredients: ['metoprolol'],
        dosageForms: ['tablet', 'extended release'],
        description: 'Beta-adrenergic blocking agent',
      },
      // Add more common drugs...
      {
        genericName: 'acetaminophen',
        brandNames: ['Tylenol', 'Paracetamol'],
        drugClass: 'Analgesic',
        activeIngredients: ['acetaminophen'],
        dosageForms: ['tablet', 'liquid'],
        description: 'Pain reliever and fever reducer',
      },
      {
        genericName: 'ibuprofen',
        brandNames: ['Advil', 'Motrin'],
        drugClass: 'NSAID',
        activeIngredients: ['ibuprofen'],
        dosageForms: ['tablet', 'liquid'],
        description: 'Nonsteroidal anti-inflammatory drug',
      },
      {
        genericName: 'digoxin',
        brandNames: ['Lanoxin'],
        drugClass: 'Cardiac Glycoside',
        activeIngredients: ['digoxin'],
        dosageForms: ['tablet', 'injection'],
        description: 'Medication for heart failure and arrhythmias',
      },
      {
        genericName: 'furosemide',
        brandNames: ['Lasix'],
        drugClass: 'Loop Diuretic',
        activeIngredients: ['furosemide'],
        dosageForms: ['tablet', 'injection'],
        description: 'Diuretic used to treat fluid retention',
      },
      {
        genericName: 'prednisone',
        brandNames: ['Deltasone'],
        drugClass: 'Corticosteroid',
        activeIngredients: ['prednisone'],
        dosageForms: ['tablet'],
        description: 'Corticosteroid anti-inflammatory',
      },
    ];

    const drugs = await drugRepository.save(defaultDrugs.map(d => drugRepository.create(d)));
    
    // Seed interactions
    const interactionRepository = tenantDb.getRepository(DrugInteraction);
    
    // Find drugs for interaction pairs
    const warfarin = drugs.find(d => d.genericName === 'warfarin');
    const aspirin = drugs.find(d => d.genericName === 'aspirin');
    const digoxin = drugs.find(d => d.genericName === 'digoxin');
    const furosemide = drugs.find(d => d.genericName === 'furosemide');
    const metformin = drugs.find(d => d.genericName === 'metformin');
    
    const interactions = [];
    
    // Warfarin interactions (critical)
    if (warfarin && aspirin) {
      interactions.push({
        drug1Id: warfarin.id,
        drug2Id: aspirin.id,
        severity: InteractionSeverity.MAJOR,
        description: 'Increased risk of bleeding when warfarin is combined with aspirin',
        mechanism: 'Both drugs affect hemostasis - warfarin inhibits clotting factors, aspirin inhibits platelet aggregation',
        management: 'Monitor INR closely. Consider proton pump inhibitor for GI protection.',
        evidenceLevel: 'established'
      });
    }
    
    if (warfarin && digoxin) {
      interactions.push({
        drug1Id: warfarin.id,
        drug2Id: digoxin.id,
        severity: InteractionSeverity.MODERATE,
        description: 'Digoxin may enhance warfarin anticoagulant effect',
        mechanism: 'Potential displacement from protein binding sites',
        management: 'Monitor INR when starting or stopping digoxin',
        evidenceLevel: 'probable'
      });
    }
    
    // Digoxin interactions
    if (digoxin && furosemide) {
      interactions.push({
        drug1Id: digoxin.id,
        drug2Id: furosemide.id,
        severity: InteractionSeverity.MODERATE,
        description: 'Diuretics may cause hypokalemia which increases digoxin toxicity risk',
        mechanism: 'Hypokalemia enhances digoxin binding to Na+/K+ ATPase',
        management: 'Monitor potassium levels. Maintain K+ > 3.5 mEq/L',
        evidenceLevel: 'established'
      });
    }
    
    // Metformin interactions
    if (furosemide && metformin) {
      interactions.push({
        drug1Id: furosemide.id,
        drug2Id: metformin.id,
        severity: InteractionSeverity.MINOR,
        description: 'Furosemide may reduce metformin efficacy',
        mechanism: 'Possible interference with metformin renal clearance',
        management: 'Monitor blood glucose levels',
        evidenceLevel: 'possible'
      });
    }
    
    if (interactions.length > 0) {
      await interactionRepository.save(interactions.map(i => interactionRepository.create(i)));
    }
    
    return { 
      message: `Successfully seeded ${drugs.length} drugs and ${interactions.length} interactions`,
      count: drugs.length 
    };
  }
}

