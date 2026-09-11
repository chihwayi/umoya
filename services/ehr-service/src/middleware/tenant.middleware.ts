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
      normalizedOriginal.startsWith('/terminology/import/') ||
      // B-012/MOAS-16: liveness/readiness probes have no tenant context by
      // definition — an orchestrator or docker-compose healthcheck calling
      // these has no X-Tenant-ID to send. (ehr.module.ts's MiddlewareConsumer
      // .exclude() also lists these, but this hardcoded allowlist is what
      // actually governs the bypass at runtime, same as the two entries
      // above — keep both in sync.)
      normalizedPath === '/health' ||
      normalizedOriginal === '/health' ||
      normalizedPath === '/health/ready' ||
      normalizedOriginal === '/health/ready' ||
      // Payment-provider callbacks: external providers (M-Pesa, MTN, EcoCash,
      // Airtel, Flutterwave) cannot send an X-Tenant-Id header. Tenant
      // resolution for these happens inside MobileMoneyController via
      // SINGLE_TENANT_ID — without this bypass every callback 400s before
      // ever reaching the controller, so payments could never confirm.
      normalizedPath.startsWith('/payments/mobile-money/callback/') ||
      normalizedOriginal.startsWith('/payments/mobile-money/callback/')
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
