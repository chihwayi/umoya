import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Patient } from '../entities/patient.entity';
import { AppointmentSimple } from '../entities/appointment-simple.entity';
import { MedicalRecord } from '../entities/medical-record.entity';
import { Prescription } from '../entities/prescription.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { Bill } from '../entities/billing.entity';
import { Vitals } from '../entities/vitals.entity';
import { TriageAssessment } from '../entities/triage-assessment.entity';
import { NursingNote } from '../entities/nursing-note.entity';
import { Order } from '../entities/order.entity';

@Injectable()
export class TenantService {
  private masterDb: DataSource;
  private tenantConnections = new Map<string, DataSource>();

  constructor() {
    // Initialize master database connection
    this.masterDb = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'medicore',
      password: process.env.DB_PASSWORD || 'medicore_password',
      database: 'medicore_master',
    });
    this.masterDb.initialize().catch(console.error);
  }

  async getTenantDatabase(tenantIdentifier: string): Promise<DataSource | null> {
    try {
      // Check if it's a UUID or subdomain
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdentifier);
      
      let tenantQuery: string;
      if (isUUID) {
        tenantQuery = `SELECT id, "databaseName" FROM tenants WHERE id = $1 AND status = 'active'`;
      } else {
        tenantQuery = `SELECT id, "databaseName" FROM tenants WHERE subdomain = $1 AND status = 'active'`;
      }
      
      const result = await this.masterDb.query(tenantQuery, [tenantIdentifier]);
      
      if (!result || result.length === 0) {
        console.error(`Tenant not found or inactive: ${tenantIdentifier}`);
        return null;
      }

      const { id: tenantId, databaseName } = result[0];
      
      // Check if connection already exists
      if (this.tenantConnections.has(tenantId)) {
        return this.tenantConnections.get(tenantId);
      }

      // Create new connection for tenant
      const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME || 'medicore',
        password: process.env.DB_PASSWORD || 'medicore_password',
        database: databaseName,
        entities: [User, Patient, AppointmentSimple, MedicalRecord, Prescription, LabOrder, Bill, Vitals, TriageAssessment, NursingNote, Order],
        synchronize: false, // Schema already exists
        logging: false,
      });

      await dataSource.initialize();
      this.tenantConnections.set(tenantId, dataSource);
      
      console.log(`Connected to tenant database: ${databaseName}`);
      return dataSource;
    } catch (error) {
      console.error(`Failed to connect to tenant database: ${tenantIdentifier}`, error);
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