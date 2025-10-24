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
  private tenantConnections = new Map<string, DataSource>();

  constructor(private tenantService: TenantService) {}

  private async getTenantConnection(tenantId: string): Promise<DataSource> {
    if (this.tenantConnections.has(tenantId)) {
      return this.tenantConnections.get(tenantId);
    }

    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant.connectionString) {
      throw new NotFoundException('Tenant database not provisioned');
    }

    const dataSource = new DataSource({
      type: 'postgres',
      url: tenant.connectionString,
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();
    this.tenantConnections.set(tenantId, dataSource);
    
    this.logger.log(`Connected to tenant database: ${tenant.databaseName}`);
    return dataSource;
  }

  async createUser(tenantId: string, createUserDto: CreateClinicUserDto): Promise<TenantUser> {
    const connection = await this.getTenantConnection(tenantId);
    
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
  }

  async getTenantUsers(tenantId: string): Promise<TenantUser[]> {
    const connection = await this.getTenantConnection(tenantId);
    
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

  async deleteUser(tenantId: string, userId: string): Promise<void> {
    const connection = await this.getTenantConnection(tenantId);
    
    const query = `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`;
    const result = await connection.query(query, [userId]);
    
    if (result.affectedRows === 0) {
      throw new NotFoundException('User not found');
    }
  }

  async closeTenantConnection(tenantId: string): Promise<void> {
    const connection = this.tenantConnections.get(tenantId);
    if (connection) {
      await connection.destroy();
      this.tenantConnections.delete(tenantId);
      this.logger.log(`Closed tenant database connection: ${tenantId}`);
    }
  }
}