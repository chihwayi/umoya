import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthEducatorGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const staffId = req.user?.sub;
    const tenantDb = req.tenantDb as DataSource | undefined;

    if (!staffId || !tenantDb) {
      throw new ForbiddenException('Health educator role required');
    }

    const rows = await tenantDb.query(
      `SELECT is_health_educator FROM staff WHERE id = $1`,
      [staffId],
    );

    if (!rows[0]?.is_health_educator) {
      throw new ForbiddenException('Health educator role required');
    }

    return true;
  }
}
