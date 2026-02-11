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
      console.log('🛡️ [JwtAuthGuard] Public endpoint - skipping auth check');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    console.log('🛡️ [JwtAuthGuard] Checking authentication for:', request.method, request.url);
    return super.canActivate(context);
  }

  handleRequest(err, user, info, context) {
    const request = context?.switchToHttp()?.getRequest();
    console.log('🛡️ [JwtAuthGuard] handleRequest called for:', request?.method, request?.url);
    console.log('🛡️ [JwtAuthGuard] Error:', err?.message || 'none');
    console.log('🛡️ [JwtAuthGuard] User:', user ? 'present' : 'missing');
    console.log('🛡️ [JwtAuthGuard] Info:', info?.message || 'none');
    
    if (err || !user) {
      console.log('❌ [JwtAuthGuard] Authentication failed');
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    
    // Check if user has temporary token and is trying to access non-password-change endpoints
    if (user.temporary && context) {
      const request = context.switchToHttp().getRequest();
      const allowedPaths = ['/auth/change-password', '/auth/force-password-change'];
      
      if (!allowedPaths.some(path => request.url.includes(path))) {
        console.log('❌ [JwtAuthGuard] Password change required');
        throw new UnauthorizedException('Password change required');
      }
    }
    
    console.log('✅ [JwtAuthGuard] Authentication successful');
    return user;
  }
}