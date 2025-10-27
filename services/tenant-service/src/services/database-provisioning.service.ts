import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseProvisioningService {
  private readonly logger = new Logger(DatabaseProvisioningService.name);

  constructor(private dataSource: DataSource) {}

  async createDatabase(databaseName: string): Promise<string> {
    try {
      this.logger.log(`Creating database: ${databaseName}`);
      
      // Create database
      await this.dataSource.query(`CREATE DATABASE "${databaseName}"`);
      
      // Generate connection string
      const connectionString = this.generateConnectionString(databaseName);
      
      // Run schema migration
      await this.runSchemaMigration(connectionString);
      
      this.logger.log(`Database ${databaseName} created successfully`);
      return connectionString;
      
    } catch (error) {
      this.logger.error(`Failed to create database ${databaseName}:`, error);
      throw error;
    }
  }

  private generateConnectionString(databaseName: string): string {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '5432';
    const username = process.env.DB_USERNAME || 'medicore';
    const password = process.env.DB_PASSWORD || 'medicore_password';
    
    return `postgresql://${username}:${password}@${host}:${port}/${databaseName}`;
  }

  private async runSchemaMigration(connectionString: string): Promise<void> {
    const tenantDataSource = new DataSource({
      type: 'postgres',
      url: connectionString,
    });

    try {
      await tenantDataSource.initialize();
      
      // Execute clinic template schema
      const statements = this.getClinicSchema();
      
      for (const statement of statements) {
        if (statement.trim()) {
          await tenantDataSource.query(statement);
        }
      }
      
      this.logger.log('Schema migration completed');
      
    } finally {
      await tenantDataSource.destroy();
    }
  }

  private getClinicSchema(): string[] {
    const schema = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          role VARCHAR(50) NOT NULL CHECK (role IN ('doctor', 'nurse', 'receptionist', 'admin', 'pharmacist')),
          license_number VARCHAR(100),
          specialization VARCHAR(100),
          phone VARCHAR(50),
          is_active BOOLEAN DEFAULT true,
          must_change_password BOOLEAN DEFAULT false,
          password_changed_at TIMESTAMP WITH TIME ZONE,
          last_login TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE patients (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          patient_number VARCHAR(50) UNIQUE NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          date_of_birth DATE NOT NULL,
          gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
          id_number VARCHAR(50) UNIQUE,
          phone VARCHAR(50),
          email VARCHAR(255),
          address TEXT,
          city VARCHAR(100),
          emergency_contact_name VARCHAR(200),
          emergency_contact_phone VARCHAR(50),
          medical_aid_name VARCHAR(100),
          medical_aid_number VARCHAR(100),
          medical_aid_plan VARCHAR(100),
          blood_type VARCHAR(5),
          allergies TEXT,
          chronic_conditions TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;
    
    return schema.split(';').filter(stmt => stmt.trim());
  }

  async deleteDatabase(databaseName: string): Promise<void> {
    try {
      // Terminate connections to the database
      await this.dataSource.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()
      `);
      
      // Drop database
      await this.dataSource.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      
      this.logger.log(`Database ${databaseName} deleted successfully`);
      
    } catch (error) {
      this.logger.error(`Failed to delete database ${databaseName}:`, error);
      throw error;
    }
  }
}