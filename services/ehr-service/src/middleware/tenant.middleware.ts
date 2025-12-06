import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../services/tenant.service';
import { DataSource } from 'typeorm';

// Properly extend Express Request - TypeScript will inherit all Request properties automatically
export interface RequestWithTenant extends Request {
  tenantId?: string;
  tenantDb?: DataSource;
  user?: any;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantService: TenantService) {}

  async use(req: RequestWithTenant, res: Response, next: NextFunction) {
    console.log('🔧 [TenantMiddleware] Processing request:', req.method, req.originalUrl);
    console.log('🔧 [TenantMiddleware] Headers:', JSON.stringify(req.headers, null, 2));
    
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

    const tenantId = req.headers['x-tenant-id'] as string;
    console.log('🔧 [TenantMiddleware] Tenant ID:', tenantId);
    
    if (!tenantId) {
      console.log('❌ [TenantMiddleware] No tenant ID provided');
      throw new BadRequestException('Tenant ID is required');
    }

    // Validate tenant and get database connection
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) {
      console.log('❌ [TenantMiddleware] Invalid tenant:', tenantId);
      throw new BadRequestException('Invalid tenant');
    }

    req.tenantId = tenantId;
    req.tenantDb = tenantDb;
    console.log('✅ [TenantMiddleware] Tenant set successfully:', tenantId);
    console.log('✅ [TenantMiddleware] Calling next() for:', req.originalUrl);
    
    next();
  }
}