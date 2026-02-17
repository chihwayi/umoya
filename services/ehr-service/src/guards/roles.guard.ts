import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';

const ADMIN_OVERRIDE_ROLES = new Set(['admin', 'super_admin']);

const ROLE_NORMALIZATION_MAP: Record<string, string> = {
  'nurse accounts': 'nurse',
  nurse_accounts: 'nurse',
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const rawRole = (request.user as any)?.role;

    if (!rawRole) {
      throw new ForbiddenException('User role is missing');
    }

    const userRole = typeof rawRole === 'string' ? rawRole : String(rawRole);
    const normalizedRole = ROLE_NORMALIZATION_MAP[userRole] || userRole;

    if (ADMIN_OVERRIDE_ROLES.has(normalizedRole)) {
      return true;
    }

    if (requiredRoles.includes(normalizedRole)) {
      return true;
    }

    throw new ForbiddenException('You do not have access to this resource');
  }
}




