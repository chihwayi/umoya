import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, DeepPartial } from 'typeorm';
import { MedicalRecord } from '../entities/medical-record.entity';

@Injectable()
export class MedicalRecordService {
  
  async create(createDto: any, tenantDb: DataSource, providerId: string): Promise<MedicalRecord> {
    const recordRepository = tenantDb.getRepository(MedicalRecord);
    
    const recordCount = await recordRepository.count();
    const recordNumber = `MR${String(recordCount + 1).padStart(8, '0')}`;
    
    const record = recordRepository.create({
      ...createDto,
      recordNumber,
      providerId,
      recordDate: new Date()
    } as DeepPartial<MedicalRecord>);
    
    const saved = await recordRepository.save(record);
    return saved;
  }

  async findByPatient(patientId: string, tenantDb: DataSource): Promise<any> {
    try {
    const recordRepository = tenantDb.getRepository(MedicalRecord);
    
      // First try without relations to avoid column errors
      const records = await recordRepository.find({
        where: { patientId },
        order: { recordDate: 'DESC' }
      });
      
      // If no records, return empty array
      if (!records || records.length === 0) {
        return [];
      }
      
      // Try to enrich with relations if they exist, but don't fail if they don't
      try {
        const enriched = await recordRepository.find({
      where: { patientId },
      relations: ['provider', 'appointment'],
      order: { recordDate: 'DESC' }
        });
        return enriched || records;
      } catch (relationError) {
        // Relations failed (columns might not exist), return basic records
        console.warn('Could not load medical record relations:', relationError);
        return records;
      }
    } catch (error: any) {
      // If query fails completely, check if table exists
      console.error('Error fetching medical records:', error);
      
      // Return empty array instead of throwing
      return [];
    }
  }

  async findById(id: string, tenantDb: DataSource): Promise<MedicalRecord> {
    const recordRepository = tenantDb.getRepository(MedicalRecord);
    
    const record = await recordRepository.findOne({
      where: { id },
      relations: ['patient', 'provider', 'appointment']
    });
    
    if (!record) {
      throw new NotFoundException('Medical record not found');
    }
    
    return record;
  }
}