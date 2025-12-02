import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ReferralFacilityService {
  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new Error('Tenant database connection is required');
    }
  }

  async addFacility(facilityData: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO referral_facilities (
        facility_name, facility_type, specialties, address, city, phone, email,
        website, contact_person, referral_process, required_documents,
        average_wait_time_days, accepts_insurance, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *`,
      [
        facilityData.facilityName,
        facilityData.facilityType,
        facilityData.specialties || [],
        facilityData.address || null,
        facilityData.city || null,
        facilityData.phone || null,
        facilityData.email || null,
        facilityData.website || null,
        facilityData.contactPerson || null,
        facilityData.referralProcess || null,
        facilityData.requiredDocuments || [],
        facilityData.averageWaitTimeDays || null,
        facilityData.acceptsInsurance !== undefined ? facilityData.acceptsInsurance : true,
        facilityData.isActive !== undefined ? facilityData.isActive : true,
      ],
    );

    return result[0];
  }

  async getFacilities(filters: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT * FROM referral_facilities WHERE is_active = true`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.facilityType) {
      query += ` AND facility_type = $${paramIndex++}`;
      params.push(filters.facilityType);
    }

    if (filters.city) {
      query += ` AND LOWER(city) = LOWER($${paramIndex++})`;
      params.push(filters.city);
    }

    if (filters.acceptsInsurance !== undefined) {
      query += ` AND accepts_insurance = $${paramIndex++}`;
      params.push(filters.acceptsInsurance);
    }

    query += ` ORDER BY facility_name ASC`;

    return tenantDb.query(query, params);
  }

  async getFacilityById(facilityId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `SELECT * FROM referral_facilities WHERE id = $1`,
      [facilityId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Facility not found');
    }

    return result[0];
  }

  async searchFacilities(query: string, specialty: string | null, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let sql = `
      SELECT * FROM referral_facilities 
      WHERE is_active = true
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (query) {
      sql += ` AND (
        LOWER(facility_name) LIKE LOWER($${paramIndex}) OR
        LOWER(city) LIKE LOWER($${paramIndex}) OR
        LOWER(contact_person) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${query}%`);
      paramIndex++;
    }

    if (specialty) {
      sql += ` AND $${paramIndex} = ANY(specialties)`;
      params.push(specialty);
      paramIndex++;
    }

    sql += ` ORDER BY facility_name ASC LIMIT 50`;

    return tenantDb.query(sql, params);
  }

  async updateFacility(facilityId: string, updates: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const existing = await this.getFacilityById(facilityId, tenantDb);

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMappings: Record<string, string> = {
      facilityName: 'facility_name',
      facilityType: 'facility_type',
      contactPerson: 'contact_person',
      referralProcess: 'referral_process',
      requiredDocuments: 'required_documents',
      averageWaitTimeDays: 'average_wait_time_days',
      acceptsInsurance: 'accepts_insurance',
      isActive: 'is_active',
    };

    for (const [key, dbColumn] of Object.entries(fieldMappings)) {
      if (updates[key] !== undefined) {
        updateFields.push(`${dbColumn} = $${paramIndex++}`);
        values.push(updates[key]);
      }
    }

    const simpleFields = ['specialties', 'address', 'city', 'phone', 'email', 'website'];
    for (const field of simpleFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex++}`);
        values.push(updates[field]);
      }
    }

    if (updateFields.length === 0) {
      return existing;
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(facilityId);

    const result = await tenantDb.query(
      `UPDATE referral_facilities SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    return result[0];
  }

  async deleteFacility(facilityId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    // Soft delete by setting is_active to false
    const result = await tenantDb.query(
      `UPDATE referral_facilities SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [facilityId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Facility not found');
    }

    return { success: true, message: 'Facility deactivated' };
  }

  async getSpecialties(tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(`
      SELECT DISTINCT unnest(specialties) as specialty
      FROM referral_facilities
      WHERE is_active = true AND specialties IS NOT NULL
      ORDER BY specialty ASC
    `);

    return result.map((r: any) => r.specialty);
  }
}


import { DataSource } from 'typeorm';

@Injectable()
export class ReferralFacilityService {
  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new Error('Tenant database connection is required');
    }
  }

  async addFacility(facilityData: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO referral_facilities (
        facility_name, facility_type, specialties, address, city, phone, email,
        website, contact_person, referral_process, required_documents,
        average_wait_time_days, accepts_insurance, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *`,
      [
        facilityData.facilityName,
        facilityData.facilityType,
        facilityData.specialties || [],
        facilityData.address || null,
        facilityData.city || null,
        facilityData.phone || null,
        facilityData.email || null,
        facilityData.website || null,
        facilityData.contactPerson || null,
        facilityData.referralProcess || null,
        facilityData.requiredDocuments || [],
        facilityData.averageWaitTimeDays || null,
        facilityData.acceptsInsurance !== undefined ? facilityData.acceptsInsurance : true,
        facilityData.isActive !== undefined ? facilityData.isActive : true,
      ],
    );

    return result[0];
  }

  async getFacilities(filters: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let query = `SELECT * FROM referral_facilities WHERE is_active = true`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.facilityType) {
      query += ` AND facility_type = $${paramIndex++}`;
      params.push(filters.facilityType);
    }

    if (filters.city) {
      query += ` AND LOWER(city) = LOWER($${paramIndex++})`;
      params.push(filters.city);
    }

    if (filters.acceptsInsurance !== undefined) {
      query += ` AND accepts_insurance = $${paramIndex++}`;
      params.push(filters.acceptsInsurance);
    }

    query += ` ORDER BY facility_name ASC`;

    return tenantDb.query(query, params);
  }

  async getFacilityById(facilityId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `SELECT * FROM referral_facilities WHERE id = $1`,
      [facilityId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Facility not found');
    }

    return result[0];
  }

  async searchFacilities(query: string, specialty: string | null, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    let sql = `
      SELECT * FROM referral_facilities 
      WHERE is_active = true
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (query) {
      sql += ` AND (
        LOWER(facility_name) LIKE LOWER($${paramIndex}) OR
        LOWER(city) LIKE LOWER($${paramIndex}) OR
        LOWER(contact_person) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${query}%`);
      paramIndex++;
    }

    if (specialty) {
      sql += ` AND $${paramIndex} = ANY(specialties)`;
      params.push(specialty);
      paramIndex++;
    }

    sql += ` ORDER BY facility_name ASC LIMIT 50`;

    return tenantDb.query(sql, params);
  }

  async updateFacility(facilityId: string, updates: any, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const existing = await this.getFacilityById(facilityId, tenantDb);

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMappings: Record<string, string> = {
      facilityName: 'facility_name',
      facilityType: 'facility_type',
      contactPerson: 'contact_person',
      referralProcess: 'referral_process',
      requiredDocuments: 'required_documents',
      averageWaitTimeDays: 'average_wait_time_days',
      acceptsInsurance: 'accepts_insurance',
      isActive: 'is_active',
    };

    for (const [key, dbColumn] of Object.entries(fieldMappings)) {
      if (updates[key] !== undefined) {
        updateFields.push(`${dbColumn} = $${paramIndex++}`);
        values.push(updates[key]);
      }
    }

    const simpleFields = ['specialties', 'address', 'city', 'phone', 'email', 'website'];
    for (const field of simpleFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex++}`);
        values.push(updates[field]);
      }
    }

    if (updateFields.length === 0) {
      return existing;
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(facilityId);

    const result = await tenantDb.query(
      `UPDATE referral_facilities SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    return result[0];
  }

  async deleteFacility(facilityId: string, tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    // Soft delete by setting is_active to false
    const result = await tenantDb.query(
      `UPDATE referral_facilities SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [facilityId],
    );

    if (result.length === 0) {
      throw new NotFoundException('Facility not found');
    }

    return { success: true, message: 'Facility deactivated' };
  }

  async getSpecialties(tenantDb: DataSource) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(`
      SELECT DISTINCT unnest(specialties) as specialty
      FROM referral_facilities
      WHERE is_active = true AND specialties IS NOT NULL
      ORDER BY specialty ASC
    `);

    return result.map((r: any) => r.specialty);
  }
}

