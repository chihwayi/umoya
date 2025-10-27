import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MedicalAidClaim, ClaimStatus, MedicalAidProvider } from '../entities/medical-aid-claim.entity';

@Injectable()
export class ClaimsService {
  
  async createClaim(createClaimDto: any, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    
    const claimNumber = `CLM-${Date.now()}`;
    const claim = claimRepository.create({
      ...createClaimDto,
      claimNumber,
      status: ClaimStatus.DRAFT
    });
    
    return claimRepository.save(claim);
  }

  async getClaims(query: any, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    
    let queryBuilder = claimRepository.createQueryBuilder('claim')
      .leftJoinAndSelect('claim.patient', 'patient')
      .leftJoinAndSelect('claim.bill', 'bill');

    if (query.status) {
      queryBuilder.andWhere('claim.status = :status', { status: query.status });
    }

    if (query.provider) {
      queryBuilder.andWhere('claim.medicalAidProvider = :provider', { provider: query.provider });
    }

    if (query.patientId) {
      queryBuilder.andWhere('claim.patientId = :patientId', { patientId: query.patientId });
    }

    return queryBuilder.getMany();
  }

  async getClaimById(id: string, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    return claimRepository.findOne({
      where: { id },
      relations: ['patient', 'bill']
    });
  }

  async submitClaim(id: string, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    const claim = await claimRepository.findOne({ where: { id } });
    
    if (!claim) {
      throw new Error('Claim not found');
    }

    // Simulate medical aid submission
    claim.status = ClaimStatus.SUBMITTED;
    claim.submissionDate = new Date();
    
    // Here you would integrate with actual medical aid APIs
    // CIMAS, Premier, Econet Health APIs
    
    return claimRepository.save(claim);
  }

  async checkClaimStatus(id: string, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    const claim = await claimRepository.findOne({ where: { id } });
    
    if (!claim) {
      throw new Error('Claim not found');
    }

    // Simulate status check with medical aid provider
    return {
      claimNumber: claim.claimNumber,
      status: claim.status,
      submissionDate: claim.submissionDate,
      responseDate: claim.responseDate,
      approvedAmount: claim.approvedAmount
    };
  }

  async processResponse(id: string, responseData: any, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    const claim = await claimRepository.findOne({ where: { id } });
    
    if (!claim) {
      throw new Error('Claim not found');
    }

    claim.status = responseData.approved ? ClaimStatus.APPROVED : ClaimStatus.REJECTED;
    claim.responseDate = new Date();
    claim.approvedAmount = responseData.approvedAmount;
    claim.rejectionReason = responseData.rejectionReason;
    claim.responseData = responseData;
    
    return claimRepository.save(claim);
  }
}