import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../services/tenant.service';
import { DataSource } from 'typeorm';

// Properly extend Express Request - TypeScript will inherit all Request properties automatically
export interface RequestWithTenant extends Request {
  tenantId?: string;
  tenant?: {
    id: string;
    subdomain: string;
    mfaRequired: boolean;
    sessionTimeoutMinutes: number;
    allowEmergencyBypass: boolean;
  };
  tenantDb?: DataSource;
  user?: any;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantService: TenantService) {}

  async use(req: RequestWithTenant, res: Response, next: NextFunction) {
    const requestPath = ((req.path || '').split('?')[0] || '').toLowerCase();
    const originalPath = ((req.originalUrl || req.url || '').split('?')[0] || '').toLowerCase();

    const normalize = (pathValue: string) => pathValue.replace(/^\/api\//, '/').replace(/\/+/g, '/');
    const normalizedPath = normalize(requestPath);
    const normalizedOriginal = normalize(originalPath);

    const isPublicTenantEndpoint = (
      normalizedPath === '/tenants/active' ||
      normalizedOriginal === '/tenants/active' ||
      normalizedPath.startsWith('/tenants/subdomain/') ||
      normalizedOriginal.startsWith('/tenants/subdomain/') ||
      normalizedPath.startsWith('/terminology/import/') ||
      normalizedOriginal.startsWith('/terminology/import/')
    );
    
    if (isPublicTenantEndpoint) {
      return next();
    }

    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Validate tenant and get database connection
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      throw new BadRequestException('Invalid tenant');
    }

    req.tenantId = tenantId;
    req.tenantDb = tenantDb;
    req.tenant = await this.tenantService.getTenantSecurityPolicy(tenantId) || undefined;
    
    next();
  }
}
