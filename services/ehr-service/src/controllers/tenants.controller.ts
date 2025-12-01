import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  private masterDb: DataSource | null = null;

  constructor() {
    // Initialize master database connection once
    this.masterDb = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'medicore',
      password: process.env.DB_PASSWORD || 'medicore_password',
      database: 'medicore_master',
    });
    
    this.masterDb.initialize().catch((error) => {
      console.error('Failed to initialize master database:', error);
      this.masterDb = null;
    });
  }

  @Get('active')
  @ApiOperation({ summary: 'Get list of active tenants', description: 'Returns all active tenants for patient portal tenant selection. This endpoint does not require tenant authentication.' })
  @ApiResponse({ status: 200, description: 'List of active tenants' })
  async getActiveTenants() {
    try {
      // Ensure master database is initialized
      if (!this.masterDb || !this.masterDb.isInitialized) {
        if (!this.masterDb) {
          this.masterDb = new DataSource({
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            username: process.env.DB_USERNAME || 'medicore',
            password: process.env.DB_PASSWORD || 'medicore_password',
            database: 'medicore_master',
          });
        }
        await this.masterDb.initialize();
      }

      const tenants = await this.masterDb.query(
        `SELECT id, subdomain, "databaseName", status 
         FROM tenants 
         WHERE status = 'active' 
         ORDER BY subdomain ASC`
      );

      return {
        tenants: tenants.map((t: any) => ({
          id: t.id,
          subdomain: t.subdomain,
          name: t.subdomain.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        })),
      };
    } catch (error) {
      console.error('Error fetching active tenants:', error);
      // Return fallback tenant
      return {
        tenants: [
          { id: '1', subdomain: 'bulawayo-general', name: 'Bulawayo General Clinic' },
        ],
      };
    }
  }
}

