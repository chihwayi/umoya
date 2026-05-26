import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { randomUUID } from 'crypto';
import { User } from '../entities/user.entity';
import { LoginDto } from '../dto/auth.dto';

interface TenantSecurityPolicy {
  mfaRequired?: boolean;
  sessionTimeoutMinutes?: number;
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(
    loginDto: LoginDto,
    tenantDb: DataSource,
    tenantId: string,
    ipAddress: string,
    userAgent: string,
    tenantPolicy: TenantSecurityPolicy = {},
  ) {
    const userRepository = tenantDb.getRepository(User);
    
    const user = await userRepository.findOne({
      where: { email: loginDto.email }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is not active');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // If 2FA enabled, return temp token for TOTP step
    if (user.twoFactorEnabled) {
      const tempToken = this.jwtService.sign(
        { sub: user.id, _2fa: true, tenantId },
        { expiresIn: '5m' },
      );
      return {
        requiresTwoFactor: true,
        tempToken,
        message: 'Enter your authenticator code',
      };
    }

    // Update last login
    user.lastLogin = new Date();
    await userRepository.save(user);

    // Check if password change is required
    if (user.mustChangePassword) {
      return {
        token: this.jwtService.sign(
          { sub: user.id, email: user.email, role: user.role, tenantId, temporary: true, mfaVerified: !tenantPolicy.mfaRequired },
          { expiresIn: '15m' }
        ),
        mustChangePassword: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        message: 'Password change required'
      };
    }

    const mfaVerified = !tenantPolicy.mfaRequired;
    const token = await this.issueStaffJwt(user, tenantDb, tenantId, mfaVerified, tenantPolicy, ipAddress, userAgent);

    return {
      token,
      mfaRequired: Boolean(tenantPolicy.mfaRequired),
      mfaVerified,
      mfaSetupRequired: Boolean(tenantPolicy.mfaRequired && !user.twoFactorEnabled),
      sessionTimeoutMinutes: Number(tenantPolicy.sessionTimeoutMinutes || 60),
      mustChangePassword: false,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        specialization: user.specialization,
        mustChangePassword: user.mustChangePassword
      }
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string, tenantDb: DataSource) {
    const userRepository = tenantDb.getRepository(User);
    
    const user = await userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password with same salt rounds as tenant service
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user
    user.passwordHash = hashedPassword;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();

    await userRepository.save(user);
  }

  async forcePasswordChange(userId: string, newPassword: string, tenantDb: DataSource) {
    const userRepository = tenantDb.getRepository(User);
    
    const user = await userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Hash new password with same salt rounds as tenant service
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user
    user.passwordHash = hashedPassword;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();

    await userRepository.save(user);
  }

  async validateUser(payload: any): Promise<any> {
    return {
      id: payload.sub,
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      firstName: payload.firstName,
      lastName: payload.lastName,
      mfaVerified: payload.mfaVerified === true,
      mfaRequired: payload.mfaRequired === true,
      jti: payload.jti,
    };
  }

  async findUserById(userId: string, tenantDb: DataSource): Promise<User | null> {
    return tenantDb.getRepository(User).findOne({ where: { id: userId } });
  }

  async setup2FA(userId: string, tenantDb: DataSource): Promise<{ secret: string; otpauthUrl: string }> {
    const userRepository = tenantDb.getRepository(User);
    const user = await userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    const secret = authenticator.generateSecret();
    user.twoFactorSecret = secret;
    user.twoFactorEnabled = false;
    await userRepository.save(user);
    const otpauthUrl = authenticator.keyuri(user.email, 'MediCore', secret);
    return { secret, otpauthUrl };
  }

  async verify2FA(userId: string, token: string, tenantDb: DataSource): Promise<void> {
    const userRepository = tenantDb.getRepository(User);
    const user = await userRepository.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) throw new BadRequestException('2FA not set up');
    const valid = authenticator.verify({ token, secret: user.twoFactorSecret });
    if (!valid) throw new UnauthorizedException('Invalid authenticator code');
    user.twoFactorEnabled = true;
    await userRepository.save(user);
  }

  async verifyMfaLogin(userId: string, code: string, tenantDb: DataSource): Promise<void> {
    const user = await this.findUserById(userId, tenantDb);
    if (!user?.twoFactorSecret) throw new BadRequestException('2FA not set up');
    const valid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    if (!valid) throw new UnauthorizedException('Invalid authenticator code');
  }

  async markSessionMfaVerified(tenantDb: DataSource, jti?: string): Promise<void> {
    if (!jti) return;
    try {
      await tenantDb.query(
        `UPDATE active_staff_sessions SET mfa_verified = true, last_activity = NOW() WHERE jwt_jti = $1`,
        [jti],
      );
    } catch {
      // Session registry may not be backfilled yet; do not fail MFA on that basis.
    }
  }

  async disable2FA(userId: string, token: string, tenantDb: DataSource): Promise<void> {
    const userRepository = tenantDb.getRepository(User);
    const user = await userRepository.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) throw new BadRequestException('2FA not enabled');
    const valid = authenticator.verify({ token, secret: user.twoFactorSecret });
    if (!valid) throw new UnauthorizedException('Invalid authenticator code');
    user.twoFactorSecret = null;
    user.twoFactorEnabled = false;
    await userRepository.save(user);
  }

  async complete2FALogin(
    tempToken: string,
    code: string,
    tenantDb: DataSource,
    tenantId: string,
    tenantPolicy: TenantSecurityPolicy = {},
  ) {
    let payload: any;
    try {
      payload = this.jwtService.verify(tempToken);
    } catch {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
    if (!payload._2fa || !payload.sub) throw new UnauthorizedException('Invalid token');
    const userRepository = tenantDb.getRepository(User);
    const user = await userRepository.findOne({ where: { id: payload.sub } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) throw new UnauthorizedException('2FA not enabled');
    const valid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    if (!valid) throw new UnauthorizedException('Invalid authenticator code');
    user.lastLogin = new Date();
    await userRepository.save(user);
    const token = await this.issueStaffJwt(user, tenantDb, tenantId, true, tenantPolicy);
    return {
      token,
      mfaRequired: Boolean(tenantPolicy.mfaRequired),
      mfaVerified: true,
      sessionTimeoutMinutes: Number(tenantPolicy.sessionTimeoutMinutes || 60),
      mustChangePassword: false,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        specialization: user.specialization,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async reissueMfaVerifiedToken(
    userId: string,
    tenantDb: DataSource,
    tenantId: string,
    tenantPolicy: TenantSecurityPolicy,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const user = await this.findUserById(userId, tenantDb);
    if (!user) throw new UnauthorizedException('User not found');
    return this.issueStaffJwt(user, tenantDb, tenantId, true, tenantPolicy, ipAddress, userAgent);
  }

  async listActiveSessions(userId: string, tenantDb: DataSource): Promise<any[]> {
    return tenantDb.query(
      `
        SELECT
          id,
          jwt_jti,
          ip_address,
          user_agent,
          mfa_verified,
          created_at,
          last_activity,
          expires_at,
          revoked,
          revoked_at,
          revoked_reason
        FROM active_staff_sessions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [userId],
    );
  }

  async revokeSession(userId: string, jti: string, tenantDb: DataSource, reason = 'user_revoked'): Promise<void> {
    await tenantDb.query(
      `
        UPDATE active_staff_sessions
        SET revoked = true,
            revoked_at = NOW(),
            revoked_reason = $3
        WHERE user_id = $1
          AND jwt_jti = $2
      `,
      [userId, jti, reason],
    );
  }

  private async issueStaffJwt(
    user: User,
    tenantDb: DataSource,
    tenantId: string,
    mfaVerified: boolean,
    tenantPolicy: TenantSecurityPolicy = {},
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const jti = randomUUID();
    const sessionTimeoutMinutes = Number(tenantPolicy.sessionTimeoutMinutes || 60);
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId,
      firstName: user.firstName,
      lastName: user.lastName,
      mfaVerified,
      mfaRequired: Boolean(tenantPolicy.mfaRequired),
      sessionTimeoutMinutes,
      jti,
    };

    await this.recordStaffSession(tenantDb, {
      userId: user.id,
      jti,
      ipAddress,
      userAgent,
      mfaVerified,
      sessionTimeoutMinutes,
    });

    return this.jwtService.sign(payload, { expiresIn: `${sessionTimeoutMinutes}m` });
  }

  private async recordStaffSession(
    tenantDb: DataSource,
    session: {
      userId: string;
      jti: string;
      ipAddress?: string;
      userAgent?: string;
      mfaVerified: boolean;
      sessionTimeoutMinutes: number;
    },
  ): Promise<void> {
    try {
      await tenantDb.query(
        `
          INSERT INTO active_staff_sessions (
            user_id,
            jwt_jti,
            ip_address,
            user_agent,
            mfa_verified,
            expires_at
          )
          VALUES ($1, $2, $3, $4, $5, NOW() + ($6::TEXT || ' minutes')::INTERVAL)
          ON CONFLICT (jwt_jti) DO NOTHING
        `,
        [
          session.userId,
          session.jti,
          session.ipAddress || null,
          session.userAgent || null,
          session.mfaVerified,
          session.sessionTimeoutMinutes,
        ],
      );
    } catch {
      // Tenant schema repair may not have run yet; authentication should remain available.
    }
  }
}
