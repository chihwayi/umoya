import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PatientJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired patient token');
    }

    const request = context.switchToHttp().getRequest();
    const role = String(user.role || '').toLowerCase();
    const tokenType = String(user.type || '').toLowerCase();

    if (role !== 'patient' && tokenType !== 'caregiver') {
      throw new UnauthorizedException('Patient portal token required');
    }

    request.patientId = tokenType === 'caregiver' ? user.patientId : user.sub;
    return user;
  }
}
