import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantSimpleService } from '../services/tenant-simple.service';

export interface RequestWithTenant extends Request {
  tenantId?: string;
  tenantDb?: any;
  user?: any;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantService: TenantSimpleService) {}

  async use(req: RequestWithTenant, res: Response, next: NextFunction) {
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