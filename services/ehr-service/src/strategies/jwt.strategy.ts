import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.trim().length === 0) {
      throw new Error('JWT_SECRET is required for JWT strategy.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      temporary: payload.temporary || false,
      sub: payload.sub,
      type: payload.type,
      patientId: payload.patientId,
      accessLevel: payload.accessLevel,
      mfaVerified: payload.mfaVerified === true,
      mfaRequired: payload.mfaRequired === true,
      sessionTimeoutMinutes: payload.sessionTimeoutMinutes,
      jti: payload.jti,
    };
  }
}
