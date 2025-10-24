import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Prescription, PrescriptionStatus } from '../entities/prescription.entity';

@Injectable()
export class PrescriptionService {
  
  async create(createDto: any, tenantDb: DataSource, prescriberId: string): Promise<Prescription> {
    const prescriptionRepository = tenantDb.getRepository(Prescription);
    
    const prescriptionCount = await prescriptionRepository.count();
    const prescriptionNumber = `RX${String(prescriptionCount + 1).padStart(8, '0')}`;
    
    const prescription = prescriptionRepository.create({
      ...createDto,
      prescriptionNumber,
      prescriberId,
      startDate: new Date(createDto.startDate),
      endDate: createDto.endDate ? new Date(createDto.endDate) : null
    });
    
    return prescriptionRepository.save(prescription);
  }

  async findByPatient(patientId: string, tenantDb: DataSource): Promise<any> {
    const prescriptionRepository = tenantDb.getRepository(Prescription);
    
    return prescriptionRepository.find({
      where: { patientId },
      relations: ['prescriber', 'dispensedBy'],
      order: { createdAt: 'DESC' }
    }) as any;
  }

  async dispense(id: string, tenantDb: DataSource, dispensedById: string): Promise<Prescription> {
    const prescriptionRepository = tenantDb.getRepository(Prescription);
    
    const prescription = await prescriptionRepository.findOne({ where: { id } });
    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }
    
    prescription.dispensedById = dispensedById;
    prescription.dispensedAt = new Date();
    prescription.status = PrescriptionStatus.COMPLETED;
    
    return prescriptionRepository.save(prescription);
  }
}