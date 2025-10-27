import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Patient } from '../entities/patient.entity';
import { Appointment } from '../entities/appointment.entity';
import { MedicalRecord } from '../entities/medical-record.entity';
import { Prescription } from '../entities/prescription.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { Bill } from '../entities/billing.entity';

@Injectable()
export class TenantService {
  private masterDb: DataSource;
  private tenantConnections = new Map<string, DataSource>();

  constructor() {
    // Initialize master database connection
    this.masterDb = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'postgres-master',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'medicore',
      password: process.env.DB_PASSWORD || 'medicore_password',
      database: 'medicore_master',
    });
    this.masterDb.initialize().catch(console.error);
  }

  async getTenantDatabase(tenantId: string): Promise<DataSource | null> {
    try {
      // Get tenant info from master database
      const tenantQuery = `SELECT "databaseName" FROM tenants WHERE id = $1 AND status = 'active'`;
      const result = await this.masterDb.query(tenantQuery, [tenantId]);
      
      if (!result || result.length === 0) {
        console.error(`Tenant not found or inactive: ${tenantId}`);
        return null;
      }

      const databaseName = result[0].databaseName;
      
      // Check if connection already exists
      if (this.tenantConnections.has(tenantId)) {
        return this.tenantConnections.get(tenantId);
      }

      // Create new connection for tenant
      const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'postgres-master',
        port: parseInt(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME || 'medicore',
        password: process.env.DB_PASSWORD || 'medicore_password',
        database: databaseName,
        entities: [User, Patient, Appointment, MedicalRecord, Prescription, LabOrder, Bill],
        synchronize: false, // Schema already exists
        logging: false,
      });

      await dataSource.initialize();
      this.tenantConnections.set(tenantId, dataSource);
      
      console.log(`Connected to tenant database: ${databaseName}`);
      return dataSource;
    } catch (error) {
      console.error(`Failed to connect to tenant database: ${tenantId}`, error);
      return null;
    }
  }

  async closeTenantConnection(tenantId: string): Promise<void> {
    const connection = this.tenantConnections.get(tenantId);
    if (connection) {
      await connection.destroy();
      this.tenantConnections.delete(tenantId);
    }
  }
}