import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SKIP_MFA_KEY } from '../decorators/skip-mfa.decorator';

@Injectable()
export class MfaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skipMfa = this.reflector.getAllAndOverride<boolean>(SKIP_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipMfa) return true;

    const request = context.switchToHttp().getRequest();
    const tenantMfaRequired = Boolean(request.tenant?.mfaRequired);
    if (!tenantMfaRequired) return true;

    if (!request.headers?.authorization) return true;

    const user = request.user || this.decodeBearerClaims(request);
    if (!user?.mfaVerified) {
      throw new UnauthorizedException('MFA verification required');
    }
    return true;
  }

  private decodeBearerClaims(request: any): any | null {
    const header = String(request.headers?.authorization || '');
    const [, token] = header.match(/^Bearer\s+(.+)$/i) || [];
    if (!token) return null;
    try {
      return this.jwtService.decode(token);
    } catch {
      return null;
    }
  }
}
