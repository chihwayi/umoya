import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
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