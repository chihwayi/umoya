import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RequestWithTenant } from '../middleware/tenant.middleware';

/**
 * Custom decorator to extract tenant database connection from request
 * This bypasses NestJS dependency injection issues with custom request types
 */
export const TenantDb = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): DataSource => {
    console.log('🔍 [TenantDb Decorator] Called');
    const request = ctx.switchToHttp().getRequest<RequestWithTenant>();
    console.log('🔍 [TenantDb Decorator] Request URL:', request.url);
    console.log('🔍 [TenantDb Decorator] Tenant DB exists:', !!request.tenantDb);
    if (!request.tenantDb) {
      console.error('❌ [TenantDb Decorator] Tenant database connection not available');
      throw new Error('Tenant database connection not available. Ensure TenantMiddleware is configured.');
    }
    console.log('✅ [TenantDb Decorator] Returning tenant DB');
    return request.tenantDb;
  },
);

/**
 * Custom decorator to extract tenant ID from request
 * This bypasses NestJS dependency injection issues with custom request types
 */
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    console.log('🔍 [TenantId Decorator] Called');
    const request = ctx.switchToHttp().getRequest<RequestWithTenant>();
    console.log('🔍 [TenantId Decorator] Request URL:', request.url);
    console.log('🔍 [TenantId Decorator] Tenant ID:', request.tenantId);
    if (!request.tenantId) {
      console.error('❌ [TenantId Decorator] Tenant ID not available');
      throw new Error('Tenant ID not available. Ensure TenantMiddleware is configured and X-Tenant-ID header is provided.');
    }
    console.log('✅ [TenantId Decorator] Returning tenant ID:', request.tenantId);
    return request.tenantId;
  },
);

