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
    
    // Check if user has temporary token and is trying to access non-password-change endpoints
    if (user.temporary && context) {
      const request = context.switchToHttp().getRequest();
      const allowedPaths = ['/auth/change-password', '/auth/force-password-change'];
      
      if (!allowedPaths.some(path => request.url.includes(path))) {
        throw new UnauthorizedException('Password change required');
      }
    }
    return user;
  }
}
