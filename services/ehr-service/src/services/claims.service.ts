import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MedicalAidClaim, ClaimStatus, MedicalAidProvider } from '../entities/medical-aid-claim.entity';
import { Bill } from '../entities/billing.entity';

@Injectable()
export class ClaimsService {
  
  async createClaim(createClaimDto: any, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    
    const claimCount = await claimRepository.count();
    const claimNumber = `CLM${String(claimCount + 1).padStart(8, '0')}`;
    
    const claim = claimRepository.create({
      ...createClaimDto,
      claimNumber,
      status: ClaimStatus.DRAFT
    });
    
    return claimRepository.save(claim);
  }

  async generateClaimFromBill(billId: string, claimData: any, tenantDb: DataSource) {
    const billRepository = tenantDb.getRepository(Bill);
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    
    const bill = await billRepository.findOne({ 
      where: { id: billId },
      relations: ['patient']
    });
    
    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    if (!bill.patient) {
      throw new BadRequestException('Bill must be associated with a patient');
    }

    // Check if claim already exists for this bill
    const existingClaim = await claimRepository.findOne({
      where: { billId }
    });

    if (existingClaim) {
      throw new BadRequestException('Claim already exists for this bill');
    }

    const claimCount = await claimRepository.count();
    const claimNumber = `CLM${String(claimCount + 1).padStart(8, '0')}`;

    const claim = claimRepository.create({
      billId: bill.id,
      patientId: bill.patientId,
      medicalAidProvider: claimData.medicalAidProvider, // This will map to medical_aid_name
      memberNumber: claimData.memberNumber,
      claimAmount: bill.totalAmount,
      claimNumber,
      status: ClaimStatus.DRAFT,
      claimData: {
        billNumber: bill.billNumber,
        billDate: bill.billDate,
        items: (bill as any).items || [],
        subtotal: bill.subtotal,
        taxAmount: bill.taxAmount,
        discountAmount: bill.discountAmount,
        totalAmount: bill.totalAmount,
        ...claimData.additionalData
      }
    } as any);

    return claimRepository.save(claim);
  }

  async getClaims(query: any, tenantDb: DataSource) {
    // Use raw SQL to avoid TypeORM join issues with column name mismatches
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (query.status) {
      whereClause += ` AND c.status = $${paramIndex}`;
      params.push(query.status);
      paramIndex++;
    }

    if (query.provider) {
      whereClause += ` AND c.medical_aid_name = $${paramIndex}`;
      params.push(query.provider);
      paramIndex++;
    }

    if (query.patientId) {
      whereClause += ` AND c.patient_id = $${paramIndex}`;
      params.push(query.patientId);
      paramIndex++;
    }

    if (query.dateFrom) {
      whereClause += ` AND c.created_at >= $${paramIndex}`;
      params.push(query.dateFrom);
      paramIndex++;
    }

    if (query.dateTo) {
      whereClause += ` AND c.created_at <= $${paramIndex}`;
      params.push(query.dateTo);
      paramIndex++;
    }

    if (query.search) {
      whereClause += ` AND (c.claim_number ILIKE $${paramIndex} OR p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR c.member_number ILIKE $${paramIndex})`;
      const searchTerm = `%${query.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      paramIndex += 4;
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 50;
    const offset = (page - 1) * limit;

    const claimsQuery = `
      SELECT 
        c.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        b.invoice_number as bill_number
      FROM medical_aid_claims c
      LEFT JOIN patients p ON p.id = c.patient_id
      LEFT JOIN billing b ON b.id = c.billing_id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM medical_aid_claims c
      LEFT JOIN patients p ON p.id = c.patient_id
      ${whereClause}
    `;
    const countParams = params.slice(0, -2); // Remove limit and offset

    const [claimsRaw, totalResult] = await Promise.all([
      tenantDb.query(claimsQuery, params),
      tenantDb.query(countQuery, countParams),
    ]);

    const claims = claimsRaw.map((row: any) => ({
      id: row.id,
      claimNumber: row.claim_number,
      patientId: row.patient_id,
      billId: row.billing_id,
      medicalAidProvider: row.medical_aid_name,
      memberNumber: row.member_number,
      claimAmount: row.claim_amount,
      approvedAmount: row.approved_amount,
      status: row.status,
      submissionDate: row.submission_date,
      responseDate: row.response_date,
      rejectionReason: row.rejection_reason,
      claimData: row.claim_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      patient: row.patient_first_name ? {
        id: row.patient_id,
        firstName: row.patient_first_name,
        lastName: row.patient_last_name,
      } : null,
      bill: row.bill_number ? {
        id: row.billing_id,
        billNumber: row.bill_number,
      } : null,
    }));

    const total = Number(totalResult[0]?.total || 0);

    return {
      claims,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getClaimById(id: string, tenantDb: DataSource) {
    // Use raw SQL to avoid TypeORM column mapping issues
    const [claimRaw] = await tenantDb.query(
      `
      SELECT 
        c.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        b.invoice_number as bill_number
      FROM medical_aid_claims c
      LEFT JOIN patients p ON p.id = c.patient_id
      LEFT JOIN billing b ON b.id = c.billing_id
      WHERE c.id = $1
    `,
      [id],
    );

    if (!claimRaw) {
      throw new NotFoundException('Claim not found');
    }

    return {
      id: claimRaw.id,
      claimNumber: claimRaw.claim_number,
      patientId: claimRaw.patient_id,
      billId: claimRaw.billing_id,
      medicalAidProvider: claimRaw.medical_aid_name,
      memberNumber: claimRaw.member_number,
      claimAmount: claimRaw.claim_amount,
      approvedAmount: claimRaw.approved_amount,
      status: claimRaw.status,
      submissionDate: claimRaw.submission_date,
      responseDate: claimRaw.response_date,
      rejectionReason: claimRaw.rejection_reason,
      claimData: claimRaw.claim_data,
      createdAt: claimRaw.created_at,
      updatedAt: claimRaw.updated_at,
      patient: claimRaw.patient_first_name ? {
        id: claimRaw.patient_id,
        firstName: claimRaw.patient_first_name,
        lastName: claimRaw.patient_last_name,
      } : null,
      bill: claimRaw.bill_number ? {
        id: claimRaw.billing_id,
        billNumber: claimRaw.bill_number,
      } : null,
    };
  }

  async submitClaim(id: string, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    const claim = await claimRepository.findOne({ where: { id } });
    
    if (!claim) {
      throw new NotFoundException('Claim not found');
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
      throw new NotFoundException('Claim not found');
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
      throw new NotFoundException('Claim not found');
    }

    claim.status = responseData.approved ? ClaimStatus.APPROVED : ClaimStatus.REJECTED;
    claim.responseDate = new Date();
    claim.approvedAmount = responseData.approvedAmount;
    claim.rejectionReason = responseData.rejectionReason;
    // Store response data in claimData if needed
    if (claim.claimData) {
      claim.claimData.response = responseData;
    } else {
      claim.claimData = { response: responseData };
    }

    return claimRepository.save(claim);
  }

  async resubmitClaim(id: string, updatedData: any, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    const claim = await claimRepository.findOne({ where: { id } });
    
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    if (claim.status !== ClaimStatus.REJECTED) {
      throw new BadRequestException('Only rejected claims can be resubmitted');
    }

    // Update claim data if provided
    if (updatedData.memberNumber) claim.memberNumber = updatedData.memberNumber;
    if (updatedData.claimAmount) claim.claimAmount = updatedData.claimAmount;
    if (updatedData.claimData) claim.claimData = { ...claim.claimData, ...updatedData.claimData };

    // Reset to draft for review before resubmission
    claim.status = ClaimStatus.DRAFT;
    claim.rejectionReason = null;
    claim.responseDate = null;
    claim.approvedAmount = null;

    return claimRepository.save(claim);
  }

  async getDashboardSummary(tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);

    const [totalClaims] = await tenantDb.query(`
      SELECT COUNT(*) as total
      FROM medical_aid_claims
    `);

    const [totalAmount] = await tenantDb.query(`
      SELECT COALESCE(SUM(claim_amount), 0) as total
      FROM medical_aid_claims
    `);

    const [approvedAmount] = await tenantDb.query(`
      SELECT COALESCE(SUM(approved_amount), 0) as total
      FROM medical_aid_claims
      WHERE status = 'approved' OR status = 'paid'
    `);

    const [pendingAmount] = await tenantDb.query(`
      SELECT COALESCE(SUM(claim_amount), 0) as total
      FROM medical_aid_claims
      WHERE status IN ('draft', 'submitted', 'processing')
    `);

    const statusBreakdown = await tenantDb.query(`
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(claim_amount), 0) as total_amount,
        COALESCE(SUM(approved_amount), 0) as approved_amount
      FROM medical_aid_claims
      GROUP BY status
      ORDER BY count DESC
    `);

    const providerBreakdown = await tenantDb.query(`
      SELECT 
        medical_aid_name as medical_aid_provider,
        COUNT(*) as count,
        COALESCE(SUM(claim_amount), 0) as total_amount,
        COALESCE(SUM(approved_amount), 0) as approved_amount,
        COUNT(*) FILTER (WHERE status = 'approved' OR status = 'paid') as approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count
      FROM medical_aid_claims
      GROUP BY medical_aid_name
      ORDER BY total_amount DESC
    `);

    // Use raw query to avoid TypeORM column name issues
    const recentClaimsRaw = await tenantDb.query(`
      SELECT 
        c.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        b.invoice_number as bill_number
      FROM medical_aid_claims c
      LEFT JOIN patients p ON p.id = c.patient_id
      LEFT JOIN billing b ON b.id = c.billing_id
      ORDER BY c.created_at DESC
      LIMIT 10
    `);
    
    const recentClaims = recentClaimsRaw.map((row: any) => ({
      id: row.id,
      claimNumber: row.claim_number,
      patientId: row.patient_id,
      billId: row.billing_id,
      medicalAidProvider: row.medical_aid_name,
      memberNumber: row.member_number,
      claimAmount: row.claim_amount,
      approvedAmount: row.approved_amount,
      status: row.status,
      submissionDate: row.submission_date,
      responseDate: row.response_date,
      rejectionReason: row.rejection_reason,
      claimData: row.claim_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      patient: row.patient_first_name ? {
        firstName: row.patient_first_name,
        lastName: row.patient_last_name,
      } : null,
      bill: row.bill_number ? {
        billNumber: row.bill_number,
      } : null,
    }));

    const [rejectedClaims] = await tenantDb.query(`
      SELECT COUNT(*) as count
      FROM medical_aid_claims
      WHERE status = 'rejected'
    `);

    const [avgTurnaroundTime] = await tenantDb.query(`
      SELECT 
        COALESCE(AVG(EXTRACT(EPOCH FROM (response_date - submission_date)) / 86400), 0) as avg_days
      FROM medical_aid_claims
      WHERE response_date IS NOT NULL AND submission_date IS NOT NULL
    `);

    return {
      summary: {
        totalClaims: Number(totalClaims?.total || 0),
        totalAmount: Number(totalAmount?.total || 0),
        approvedAmount: Number(approvedAmount?.total || 0),
        pendingAmount: Number(pendingAmount?.total || 0),
        rejectedCount: Number(rejectedClaims?.count || 0),
        avgTurnaroundDays: Number(avgTurnaroundTime?.avg_days || 0).toFixed(1),
      },
      statusBreakdown,
      providerBreakdown,
      recentClaims,
    };
  }

  async getClaimAnalytics(tenantDb: DataSource, filters?: { dateFrom?: string; dateTo?: string; provider?: string }) {
    let dateFilter = '';
    const params: any[] = [];

    if (filters?.dateFrom) {
      params.push(filters.dateFrom);
      dateFilter += ` AND created_at >= $${params.length}`;
    }
    if (filters?.dateTo) {
      params.push(filters.dateTo);
      dateFilter += ` AND created_at <= $${params.length}`;
    }
    if (filters?.provider) {
      params.push(filters.provider);
      dateFilter += ` AND medical_aid_name = $${params.length}`;
    }

    const successRate = await tenantDb.query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'approved' OR status = 'paid') * 100.0 / NULLIF(COUNT(*), 0) as success_rate
      FROM medical_aid_claims
      WHERE 1=1 ${dateFilter}
    `,
      params,
    );

    const turnaroundTime = await tenantDb.query(
      `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (response_date - submission_date)) / 86400) as avg_days,
        MIN(EXTRACT(EPOCH FROM (response_date - submission_date)) / 86400) as min_days,
        MAX(EXTRACT(EPOCH FROM (response_date - submission_date)) / 86400) as max_days
      FROM medical_aid_claims
      WHERE response_date IS NOT NULL AND submission_date IS NOT NULL ${dateFilter}
    `,
      params,
    );

    const monthlyTrend = await tenantDb.query(
      `
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as claim_count,
        COALESCE(SUM(claim_amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE status = 'approved' OR status = 'paid') as approved_count,
        COALESCE(SUM(approved_amount), 0) as approved_amount
      FROM medical_aid_claims
      WHERE 1=1 ${dateFilter}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
      LIMIT 12
    `,
      params,
    );

    const rejectionReasons = await tenantDb.query(
      `
      SELECT 
        rejection_reason,
        COUNT(*) as count
      FROM medical_aid_claims
      WHERE status = 'rejected' AND rejection_reason IS NOT NULL ${dateFilter}
      GROUP BY rejection_reason
      ORDER BY count DESC
      LIMIT 10
    `,
      params,
    );

    return {
      successRate: Number(successRate[0]?.success_rate || 0).toFixed(2),
      turnaroundTime: {
        avg: Number(turnaroundTime[0]?.avg_days || 0).toFixed(1),
        min: Number(turnaroundTime[0]?.min_days || 0).toFixed(1),
        max: Number(turnaroundTime[0]?.max_days || 0).toFixed(1),
      },
      monthlyTrend,
      rejectionReasons,
    };
  }
}
