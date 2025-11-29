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
    const recordRepository = tenantDb.getRepository(MedicalRecord);
    
    return recordRepository.find({
      where: { patientId },
      relations: ['provider', 'appointment'],
      order: { recordDate: 'DESC' }
    }) as any;
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