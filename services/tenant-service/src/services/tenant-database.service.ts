import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TenantService } from './tenant.service';
import { CreateClinicUserDto } from '../dto/create-clinic-user.dto';

export interface TenantUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  licenseNumber?: string;
  specialization?: string;
  phone?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt?: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TenantDatabaseService {
  private readonly logger = new Logger(TenantDatabaseService.name);

  constructor(private tenantService: TenantService) {}

  private async getTenantConnection(tenantId: string): Promise<DataSource> {
    // Don't cache connections to avoid cross-tenant contamination
    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant.connectionString) {
      throw new NotFoundException('Tenant database not provisioned');
    }

    const dataSource = new DataSource({
      type: 'postgres',
      url: tenant.connectionString,
      synchronize: false,
      logging: true, // Enable logging to debug connection issues
    });

    await dataSource.initialize();
    
    this.logger.log(`Connected to tenant database: ${tenant.databaseName} for tenant: ${tenantId}`);
    return dataSource;
  }

  async createUser(tenantId: string, createUserDto: CreateClinicUserDto): Promise<TenantUser> {
    const connection = await this.getTenantConnection(tenantId);
    
    try {
      // Hash password
      const passwordHash = await bcrypt.hash(createUserDto.temporaryPassword, 10);

      const query = `
        INSERT INTO users (email, password_hash, first_name, last_name, role, license_number, specialization, phone, must_change_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, email, first_name, last_name, role, license_number, specialization, phone, is_active, must_change_password, password_changed_at, last_login, created_at, updated_at
      `;

      const result = await connection.query(query, [
        createUserDto.email,
        passwordHash,
        createUserDto.firstName,
        createUserDto.lastName,
        createUserDto.role,
        createUserDto.licenseNumber || null,
        createUserDto.specialization || null,
        createUserDto.phone || null,
        true, // must_change_password = true for all new users
      ]);

      const user = result[0];
      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        licenseNumber: user.license_number,
        specialization: user.specialization,
        phone: user.phone,
        isActive: user.is_active,
        mustChangePassword: user.must_change_password,
        passwordChangedAt: user.password_changed_at,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
    } finally {
      await connection.destroy();
    }
  }

  async getTenantUsers(tenantId: string): Promise<TenantUser[]> {
    const connection = await this.getTenantConnection(tenantId);
    
    try {
      const query = `
        SELECT id, email, first_name, last_name, role, license_number, specialization, phone, is_active, must_change_password, password_changed_at, last_login, created_at, updated_at
        FROM users
        WHERE is_active = true
        ORDER BY created_at DESC
      `;

      const result = await connection.query(query);
      
      return result.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        licenseNumber: user.license_number,
        specialization: user.specialization,
        phone: user.phone,
        isActive: user.is_active,
        mustChangePassword: user.must_change_password,
        passwordChangedAt: user.password_changed_at,
        lastLogin: user.last_login,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      }));
    } catch (error) {
      this.logger.error(`Error querying users for tenant ${tenantId}: ${error.message}`);
      throw error;
    } finally {
      await connection.destroy();
    }
  }

  async changePassword(tenantId: string, userId: string, newPassword: string): Promise<TenantUser> {
    const connection = await this.getTenantConnection(tenantId);
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    const query = `
      UPDATE users 
      SET password_hash = $1, must_change_password = false, password_changed_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, first_name, last_name, role, license_number, specialization, phone, is_active, must_change_password, password_changed_at, last_login, created_at, updated_at
    `;

    const result = await connection.query(query, [passwordHash, userId]);
    
    if (result.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = result[0];
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      licenseNumber: user.license_number,
      specialization: user.specialization,
      phone: user.phone,
      isActive: user.is_active,
      mustChangePassword: user.must_change_password,
      passwordChangedAt: user.password_changed_at,
      lastLogin: user.last_login,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async updateUserStatus(tenantId: string, userId: string, isActive: boolean): Promise<TenantUser> {
    const connection = await this.getTenantConnection(tenantId);
    
    const query = `
      UPDATE users 
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, first_name, last_name, role, license_number, specialization, phone, is_active, must_change_password, password_changed_at, last_login, created_at, updated_at
    `;

    const result = await connection.query(query, [isActive, userId]);
    
    if (result.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = result[0];
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      licenseNumber: user.license_number,
      specialization: user.specialization,
      phone: user.phone,
      isActive: user.is_active,
      mustChangePassword: user.must_change_password,
      passwordChangedAt: user.password_changed_at,
      lastLogin: user.last_login,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async resetPassword(tenantId: string, userId: string): Promise<TenantUser> {
    const connection = await this.getTenantConnection(tenantId);
    
    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    
    const query = `
      UPDATE users 
      SET password_hash = $1, must_change_password = true, password_changed_at = NULL, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, first_name, last_name, role, license_number, specialization, phone, is_active, must_change_password, password_changed_at, last_login, created_at, updated_at
    `;

    const result = await connection.query(query, [passwordHash, userId]);
    
    if (result.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = result[0];
    
    // Log the temporary password for admin to provide to user
    this.logger.warn(`🔑 TEMPORARY PASSWORD for ${user.email}: ${tempPassword} - User MUST change on first login`);
    
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      licenseNumber: user.license_number,
      specialization: user.specialization,
      phone: user.phone,
      isActive: user.is_active,
      mustChangePassword: user.must_change_password,
      passwordChangedAt: user.password_changed_at,
      lastLogin: user.last_login,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async deleteUser(tenantId: string, userId: string): Promise<void> {
    const connection = await this.getTenantConnection(tenantId);
    
    const query = `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`;
    const result = await connection.query(query, [userId]);
    
    if (result.affectedRows === 0) {
      throw new NotFoundException('User not found');
    }
  }


}