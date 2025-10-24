import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

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
    // Create new connection for tenant database
    const tenantDataSource = new DataSource({
      type: 'postgres',
      url: connectionString,
    });

    try {
      await tenantDataSource.initialize();
      
      // Read and execute clinic template schema
      const schemaPath = path.join(process.cwd(), 'database/schemas/clinic-template.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = schema.split(';').filter(stmt => stmt.trim());
      
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