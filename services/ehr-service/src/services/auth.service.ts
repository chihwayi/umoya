import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { User } from '../entities/user.entity';
import { LoginDto } from '../dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(loginDto: LoginDto, tenantDb: DataSource, ipAddress: string, userAgent: string) {
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
        { sub: user.id, _2fa: true },
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
          { sub: user.id, email: user.email, role: user.role, temporary: true },
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

    // Generate JWT token
    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    };

    return {
      token: this.jwtService.sign(payload),
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
      lastName: payload.lastName
    };
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

  async complete2FALogin(tempToken: string, code: string, tenantDb: DataSource) {
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
    const jwtPayload = { sub: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName };
    return {
      token: this.jwtService.sign(jwtPayload),
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
}