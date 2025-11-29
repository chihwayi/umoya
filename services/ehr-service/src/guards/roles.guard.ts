import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';

const ADMIN_OVERRIDE_ROLES = new Set(['admin', 'super_admin']);

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
    const userRole = (request.user as any)?.role;

    if (!userRole) {
      throw new ForbiddenException('User role is missing');
    }

    if (ADMIN_OVERRIDE_ROLES.has(userRole)) {
      return true;
    }

    if (requiredRoles.includes(userRole)) {
      return true;
    }

    throw new ForbiddenException('You do not have access to this resource');
  }
}





