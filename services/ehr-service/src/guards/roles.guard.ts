import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestWithTenant } from '../middleware/tenant.middleware';

const ADMIN_OVERRIDE_ROLES = new Set(['admin', 'super_admin']);

// A combined role grants access to EACH of its constituent roles. Previously
// nurse_accounts was *collapsed* to 'nurse', which broke endpoints that explicitly
// allow 'nurse_accounts'/'accounts' (e.g. finance payments → 403). Expand instead so a
// nurse_accounts user satisfies nurse, accounts, AND nurse_accounts.
const ROLE_EXPANSION_MAP: Record<string, string[]> = {
  'nurse accounts': ['nurse_accounts', 'nurse', 'accounts'],
  nurse_accounts: ['nurse_accounts', 'nurse', 'accounts'],
};

function effectiveRoles(userRole: string): string[] {
  const expanded = ROLE_EXPANSION_MAP[userRole];
  return expanded ? [userRole, ...expanded] : [userRole];
}

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
    const roles = effectiveRoles(userRole);

    if (roles.some((r) => ADMIN_OVERRIDE_ROLES.has(r))) {
      return true;
    }

    if (roles.some((r) => requiredRoles.includes(r))) {
      return true;
    }

    throw new ForbiddenException('You do not have access to this resource');
  }
}




