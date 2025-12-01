import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../services/tenant.service';

export interface RequestWithTenant extends Request {
  tenantId?: string;
  tenantDb?: any;
  user?: any;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantService: TenantService) {}

  async use(req: RequestWithTenant, res: Response, next: NextFunction) {
    // Skip middleware for public endpoints that don't require tenant
    // NestJS strips the global prefix 'api' from req.path, so '/api/tenants/active' becomes '/tenants/active'
    const requestPath = (req.path || '').split('?')[0];
    const originalUrl = (req.originalUrl || req.url || '').split('?')[0] || '';
    const method = req.method || '';
    
    // Check if this is the tenants/active endpoint (public, no tenant required)
    // Match all possible path variations (with/without /api prefix, case insensitive)
    const pathLower = requestPath.toLowerCase();
    const urlLower = originalUrl.toLowerCase();
    
    // Comprehensive check for tenants/active endpoint
    const isTenantsActiveEndpoint = 
      pathLower.includes('tenants/active') ||
      pathLower.includes('tenants\\/active') ||
      urlLower.includes('tenants/active') ||
      urlLower.includes('tenants\\/active') ||
      pathLower.endsWith('/tenants/active') ||
      pathLower === '/tenants/active' ||
      pathLower === 'tenants/active' ||
      urlLower.endsWith('/api/tenants/active') ||
      urlLower.endsWith('/tenants/active') ||
      urlLower.includes('/api/tenants/active') ||
      (method.toUpperCase() === 'GET' && (pathLower.includes('tenant') && pathLower.includes('active')));
    
    if (isTenantsActiveEndpoint) {
      return next();
    }

    const tenantId = (req as any).headers['x-tenant-id'] as string;
    
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
    
    next();
  }
}