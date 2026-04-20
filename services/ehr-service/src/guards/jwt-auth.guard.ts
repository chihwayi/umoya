import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err, user, info, context) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }

    const request = context.switchToHttp().getRequest();

    // Check if user has temporary token and is trying to access non-password-change endpoints
    if (user.temporary) {
      const allowedPaths = ['/auth/change-password', '/auth/force-password-change'];
      if (!allowedPaths.some(path => request.url.includes(path))) {
        throw new UnauthorizedException('Password change required');
      }
    }

    // Cross-validate: the tenant encoded in the JWT must match the tenant in the request header.
    // Prevents a valid token issued for Clinic A from being replayed against Clinic B's database.
    // If the request carries a tenantId (set by TenantMiddleware), the JWT MUST also carry one
    // and it MUST match — a token with no tenantId claim is rejected for tenant-scoped requests.
    const requestTenantId = request.tenantId as string | undefined;
    if (requestTenantId) {
      if (!user.tenantId) {
        throw new UnauthorizedException('Token does not carry a tenant claim');
      }
      if (user.tenantId !== requestTenantId) {
        throw new UnauthorizedException('Token is not valid for this tenant');
      }
    }

    return user;
  }
}
