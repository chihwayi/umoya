import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { getMasterDbConfig } from '../utils/runtime-env';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  private masterDb: DataSource | null = null;

  constructor() {
    // Initialize master database connection once
    const cfg = getMasterDbConfig();
    this.masterDb = new DataSource({
      type: 'postgres',
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      password: cfg.password,
      database: cfg.database,
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
          const cfg = getMasterDbConfig();
          this.masterDb = new DataSource({
            type: 'postgres',
            host: cfg.host,
            port: cfg.port,
            username: cfg.username,
            password: cfg.password,
            database: cfg.database,
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

  @Get('subdomain/:subdomain')
  @ApiOperation({ summary: 'Get tenant details by subdomain', description: 'Returns tenant details for a specific subdomain. This endpoint does not require tenant authentication.' })
  @ApiParam({ name: 'subdomain', description: 'The subdomain of the tenant' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getTenantBySubdomain(@Param('subdomain') subdomain: string) {
    try {
      // Ensure master database is initialized
      if (!this.masterDb || !this.masterDb.isInitialized) {
        if (!this.masterDb) {
          const cfg = getMasterDbConfig();
          this.masterDb = new DataSource({
            type: 'postgres',
            host: cfg.host,
            port: cfg.port,
            username: cfg.username,
            password: cfg.password,
            database: cfg.database,
          });
        }
        await this.masterDb.initialize();
      }

      const tenants = await this.masterDb.query(
        `SELECT id, subdomain, "clinicName", "databaseName", status, "logoUrl"
         FROM tenants 
         WHERE subdomain = $1`,
        [subdomain]
      );

      if (!tenants || tenants.length === 0) {
        // Fallback for development if not found in DB
        if (process.env.NODE_ENV === 'development' && subdomain === 'test') {
           return {
             id: 'test-tenant-id',
             subdomain: 'test',
             name: 'Test Clinic',
             status: 'active',
             logoUrl: null
           };
        }
        throw new NotFoundException(`Tenant with subdomain "${subdomain}" not found`);
      }

      const tenant = tenants[0];
      return {
        id: tenant.id,
        subdomain: tenant.subdomain,
        name: tenant.clinicName || tenant.subdomain.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        status: tenant.status,
        logoUrl: tenant.logoUrl
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error fetching tenant with subdomain ${subdomain}:`, error);
      // Fallback for development on error
      if (process.env.NODE_ENV === 'development' && subdomain === 'test') {
          return {
            id: 'test-tenant-id',
            subdomain: 'test',
            name: 'Test Clinic',
            status: 'active'
          };
      }
      throw new NotFoundException(`Tenant with subdomain "${subdomain}" not found`);
    }
  }
}
