import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantService {
  private tenantConnections = new Map<string, DataSource>();

  async getTenantDatabase(tenantId: string): Promise<DataSource | null> {
    // Check if connection already exists
    if (this.tenantConnections.has(tenantId)) {
      return this.tenantConnections.get(tenantId);
    }

    try {
      // Create new connection for tenant
      const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME || 'medicore',
        password: process.env.DB_PASSWORD || 'medicore_password',
        database: `medicore_tenant_${tenantId}`,
        entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
        synchronize: true, // Only for development
      });

      await dataSource.initialize();
      this.tenantConnections.set(tenantId, dataSource);
      
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